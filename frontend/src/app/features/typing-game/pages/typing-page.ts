import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, inject, signal, untracked, ViewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Subject, auditTime, catchError, exhaustMap, filter, finalize, interval, merge, switchMap, takeUntil, tap } from 'rxjs';

import { I18nService } from '../../../core/services/i18n.service';
import { PreferencesService, writeLocal } from '../../../core/services/preferences.service';
import { Icon } from '../../../shared/components/icon/icon';
import { Difficulty, Metrics, TestOptions, TypingTest } from '../models/typing-test';
import { HistoryService, median } from '../services/history.service';
import { TypingApiService } from '../services/typing-api.service';

const EMPTY_METRICS: Metrics = {
  wpm: 0,
  accuracy: 0,
  correct_characters: 0,
  incorrect_characters: 0,
  typed_characters: 0,
  completed_words: 0,
  elapsed_seconds: 0,
};
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
const graphemes = (text: string): string[] =>
  Array.from(segmenter.segment(text.normalize('NFC')), part => part.segment);

@Component({
  selector: 'td-typing-page',
  imports: [DecimalPipe, Icon],
  templateUrl: './typing-page.html',
  styleUrl: './typing-page.css',
})
export class TypingPage {
  readonly Math = Math;
  readonly i18n = inject(I18nService);
  readonly preferences = inject(PreferencesService);
  private readonly api = inject(TypingApiService);
  private readonly history = inject(HistoryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewport = window.matchMedia('(max-width: 560px)');

  @ViewChild('customInput') customInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passage') passage?: ElementRef<HTMLElement>;

  readonly t = this.i18n.t.bind(this.i18n);
  readonly options = signal<TestOptions>(this.preferences.loadOptions());
  readonly test = signal<TypingTest | null>(null);
  readonly typed = signal('');
  readonly typedCharacters = computed(() => graphemes(this.typed()));
  readonly metrics = signal<Metrics>(EMPTY_METRICS);
  readonly remaining = signal(this.options().duration);
  readonly loading = signal(true);
  readonly finishing = signal(false);
  readonly loadError = signal(false);
  readonly saveError = signal(false);
  readonly offline = signal(false);
  readonly pasteHint = signal(false);
  readonly restartModal = signal(false);
  readonly customOpen = signal(false);
  readonly customDraft = signal(String(this.options().duration));
  readonly durationError = signal<'durationMax' | 'durationInvalid' | null>(null);
  readonly isMobile = signal(this.viewport.matches);
  readonly durations = [15, 30, 60] as const;
  readonly entries = toSignal(this.history.history$, { initialValue: this.history.current });
  readonly best = computed(() => Math.max(0, ...this.entries().map(entry => entry.wpm)));
  readonly medianWpm = computed(() => median(this.entries().map(entry => entry.wpm)));
  readonly medianAccuracy = computed(() => median(this.entries().map(entry => entry.accuracy)));
  readonly engaged = computed(() => this.test()?.status === 'running' || this.test()?.status === 'paused');
  readonly running = computed(() => this.test()?.status === 'running' && !this.finishing() && !this.saveError());
  readonly locked = computed(() => this.engaged() || this.finishing() || this.saveError());
  readonly result = computed(() => this.test()?.result ?? null);
  readonly canType = computed(() =>
    !!this.test() && !this.result() && !this.loading() && !this.loadError()
    && !this.finishing() && !this.saveError() && !this.durationError() && !this.restartModal());
  readonly customSelected = computed(() => !this.durations.includes(this.options().duration as 15 | 30 | 60));
  readonly singleLineMode = computed(() => this.isMobile() || this.preferences.singleLine());
  readonly clock = computed(() => {
    const seconds = Math.max(0, Math.ceil(this.remaining()));
    return Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + (seconds % 60).toString().padStart(2, '0');
  });
  readonly elapsedPercent = computed(() => 100 * (1 - this.remaining() / this.options().duration));
  readonly prompt = signal<{
    chars: { value: string; index: number }[];
    textEnd: number;
    end: number;
  }[]>([]);
  readonly activeWord = computed(() => {
    const index = this.prompt().findIndex(word => word.end >= this.typedCharacters().length);
    return index < 0 ? this.prompt().length - 1 : index;
  });
  readonly visibleWords = computed(() => {
    const words = this.prompt();
    if (!words.length) return [];
    return this.singleLineMode()
      ? words.slice(Math.max(0, this.activeWord()), Math.max(0, this.activeWord()) + 1)
      : words;
  });
  readonly resultChart = computed(() => this.result()?.samples ?? []);
  readonly maxResultWpm = computed(() => Math.max(10, ...this.resultChart().map(sample => sample.wpm)));

  private readonly prepareRequests = new Subject<void>();
  private readonly inputChanges = new Subject<void>();
  private readonly stopProgress = new Subject<void>();
  private revision = 0;
  private lastMetricRevision = -1;
  private promptLength = 0;
  private anchorRemaining = 0;
  private anchorAt = 0;
  private activeUntil = 0;
  private lastInputAt = 0;
  private autoInsertedSeparator = false;

  constructor() {
    this.prepareRequests.pipe(
      switchMap(() => {
        this.loading.set(true);
        this.loadError.set(false);
        this.test.set(null);
        return this.api.prepare(this.options()).pipe(
          tap(test => this.acceptReady(test)),
          catchError(() => { this.loadError.set(true); return EMPTY; }),
          finalize(() => this.loading.set(false)),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe();

    merge(
      this.inputChanges,
      interval(600).pipe(filter(() => this.running())),
    ).pipe(
      auditTime(160),
      filter(() => this.engaged() && !this.finishing() && !this.saveError()),
      exhaustMap(() => {
        const current = this.test()!;
        const sentAt = performance.now();
        return this.api.progress(current.id, this.typed(), this.revision).pipe(
          takeUntil(this.stopProgress),
          tap(test => this.acceptProgress(test, sentAt)),
          catchError(() => { this.offline.set(true); return EMPTY; }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe();

    interval(50).pipe(takeUntilDestroyed()).subscribe(() => this.tickClock());

    const viewportChanged = (event: MediaQueryListEvent): void => this.isMobile.set(event.matches);
    this.viewport.addEventListener('change', viewportChanged);
    this.destroyRef.onDestroy(() => {
      this.stopProgress.next();
      this.viewport.removeEventListener('change', viewportChanged);
    });

    effect(() => {
      const language = this.preferences.language();
      untracked(() => {
        if (this.options().language === language) return;
        this.options.update(options => ({ ...options, language }));
        writeLocal('typedash.options', this.options());
        if (!this.locked()) this.prepare();
      });
    });

    this.restoreOrPrepare();
  }

  private setPrompt(text: string): void {
    let index = 0;
    this.prompt.set(text.split(' ').map((word, position, words) => {
      const chars = graphemes(word).map(value => ({ value, index: index++ }));
      const textEnd = index;
      if (position < words.length - 1) chars.push({ value: ' ', index: index++ });
      return { chars, textEnd, end: index - 1 };
    }));
    this.promptLength = index;
  }

  private acceptReady(test: TypingTest): void {
    this.test.set(test);
    this.setPrompt(test.text);
    this.typed.set('');
    this.metrics.set(EMPTY_METRICS);
    this.remaining.set(test.duration);
    this.revision = 0;
    this.lastMetricRevision = -1;
    this.offline.set(false);
    this.saveError.set(false);
    this.pasteHint.set(false);
    this.anchorRemaining = test.duration;
    this.activeUntil = 0;
    this.lastInputAt = 0;
    this.autoInsertedSeparator = false;
    this.focusInput();
  }

  prepare(): void {
    if (this.locked() || this.durationError()) return;
    this.stopProgress.next();
    this.clearActive();
    this.prepareRequests.next();
  }

  toggleOption(option: 'punctuation' | 'numbers'): void {
    if (this.locked()) return;
    this.options.update(options => ({ ...options, [option]: !options[option] }));
    this.saveAndPrepare();
  }

  setDuration(duration: number): void {
    if (this.locked()) return;
    this.customOpen.set(false);
    this.durationError.set(null);
    this.options.update(options => ({ ...options, duration }));
    this.saveAndPrepare();
  }

  toggleCustom(): void {
    if (this.locked()) return;
    this.customOpen.update(open => !open);
    if (!this.customOpen()) return;
    this.customDraft.set(this.customSelected() ? String(this.options().duration) : '');
    this.durationError.set(null);
    setTimeout(() => this.customInput?.nativeElement.focus());
  }

  validateCustom(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.customDraft.set(raw);
    const duration = Number(raw);
    if (duration > 300) this.durationError.set('durationMax');
    else if (!/^\d+$/.test(raw) || !Number.isInteger(duration) || duration < 1) this.durationError.set('durationInvalid');
    else this.durationError.set(null);
  }

  applyCustomDuration(): void {
    const duration = Number(this.customDraft());
    if (!Number.isInteger(duration) || duration < 1 || duration > 300) {
      this.durationError.set(duration > 300 ? 'durationMax' : 'durationInvalid');
      return;
    }
    this.options.update(options => ({ ...options, duration }));
    this.customOpen.set(false);
    this.saveAndPrepare();
  }

  setDifficulty(event: Event): void {
    if (this.locked()) return;
    this.options.update(options => ({
      ...options,
      difficulty: (event.target as HTMLSelectElement).value as Difficulty,
    }));
    this.saveAndPrepare();
  }

  setLineMode(singleLine: boolean): void {
    this.preferences.setLineMode(singleLine);
    this.autoInsertedSeparator = false;
    setTimeout(() => {
      this.scrollCaret();
      this.focusInput();
    });
  }

  private saveAndPrepare(): void {
    writeLocal('typedash.options', this.options());
    this.prepare();
  }

  private anchorClock(seconds: number, pauseAfter: number): void {
    this.anchorRemaining = seconds;
    this.anchorAt = performance.now();
    this.activeUntil = this.anchorAt + Math.max(0, pauseAfter) * 1000;
    this.remaining.set(seconds);
  }

  private tickClock(): void {
    if (!this.running()) return;
    const elapsed = Math.max(0, Math.min(performance.now(), this.activeUntil) - this.anchorAt) / 1000;
    this.remaining.set(Math.max(0, this.anchorRemaining - elapsed));
    if (this.remaining() <= 0) {
      this.finish();
      return;
    }
    if (performance.now() >= this.activeUntil) {
      this.test.update(test => test ? { ...test, status: 'paused' } : test);
    }
  }

  private acceptProgress(test: TypingTest, sentAt: number): void {
    if (test.id !== this.test()?.id) return;
    this.offline.set(false);
    if (test.status === 'finished') {
      this.acceptResult(test);
      return;
    }
    if (test.revision >= this.lastMetricRevision) {
      this.metrics.set(test.metrics);
      this.lastMetricRevision = test.revision;
    }
    if (test.revision === this.revision) {
      const transit = Math.min(Math.max(0, (performance.now() - sentAt) / 2000), test.pause_after_seconds);
      this.test.set(test);
      this.anchorClock(
        Math.max(0, test.remaining_seconds - transit),
        Math.max(0, test.pause_after_seconds - transit),
      );
      if (this.lastInputAt
          && performance.now() - this.lastInputAt >= test.idle_timeout_seconds * 1000
          && test.remaining_seconds > 0) {
        this.test.update(current => current ? { ...current, status: 'paused' } : current);
      }
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      this.pasteHint.set(true);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.isComposing) return;
    if (!this.canType()) {
      if (event.key.length === 1 || event.key === 'Backspace') event.preventDefault();
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      const chars = this.typedCharacters();
      if (chars.length) this.commitTyping(chars.slice(0, -1).join(''));
      this.autoInsertedSeparator = false;
      return;
    }
    if (event.key.length !== 1) return;
    event.preventDefault();

    if (this.singleLineMode() && event.key === ' ' && this.autoInsertedSeparator) {
      this.autoInsertedSeparator = false;
      return;
    }

    const word = this.prompt()[this.activeWord()];
    if (this.singleLineMode() && event.key === ' ' && word) {
      const missingCharacters = Math.max(0, word.textEnd - this.typedCharacters().length);
      const separator = word.end >= word.textEnd ? ' ' : '';
      this.autoInsertedSeparator = false;
      this.commitTyping(this.typed() + '�'.repeat(missingCharacters) + separator);
      return;
    }

    let value = this.typed() + event.key;
    const length = graphemes(value).length;
    if (this.singleLineMode() && word && length >= word.textEnd && word.end >= word.textEnd) {
      value += ' ';
      this.autoInsertedSeparator = true;
    } else {
      this.autoInsertedSeparator = false;
    }
    this.commitTyping(value);
  }

  private commitTyping(value: string): void {
    this.tickClock();
    if (!this.canType()) return;
    const text = graphemes(value).slice(0, this.promptLength).join('');
    if (text === this.typed()) return;

    this.typed.set(text);
    this.revision += 1;
    this.lastInputAt = performance.now();
    this.anchorClock(this.remaining(), this.test()!.idle_timeout_seconds);
    this.test.update(test => test ? { ...test, status: 'running' } : test);
    this.remember();
    this.inputChanges.next();
    setTimeout(() => this.scrollCaret());
    if (graphemes(text).length === this.promptLength) this.finish();
  }

  preventPaste(event: Event): void {
    event.preventDefault();
    this.pasteHint.set(true);
  }

  private scrollCaret(): void {
    const box = this.passage?.nativeElement;
    const caret = box?.querySelector<HTMLElement>('.current');
    if (!box || !caret) return;
    const rect = caret.getBoundingClientRect();
    const bounds = box.getBoundingClientRect();
    if (this.singleLineMode()) {
      box.scrollLeft += rect.left - bounds.left - Math.min(120, bounds.width / 4);
    } else if (rect.bottom > bounds.bottom - 25 || rect.top < bounds.top + 10) {
      box.scrollTop += rect.top - bounds.top - 25;
    }
  }

  focusInput(): void {
    setTimeout(() => this.passage?.nativeElement.focus());
  }

  confirmRestart(): void {
    this.restartModal.set(false);
    this.stopProgress.next();
    this.clearActive();
    this.finishing.set(false);
    this.saveError.set(false);
    this.test.set(null);
    this.prepare();
  }

  finish(): void {
    const test = this.test();
    if (!test || test.status === 'finished' || this.finishing()) return;
    this.stopProgress.next();
    this.finishing.set(true);
    this.saveError.set(false);
    this.api.finish(test.id, this.typed(), this.revision).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.error?.error?.code === 'still_running') return this.api.get(test.id);
        throw error;
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.finishing.set(false)),
    ).subscribe({
      next: response => {
        if (response.id !== this.test()?.id) return;
        if (response.result) this.acceptResult(response);
        else {
          this.test.set(response);
          this.anchorClock(response.remaining_seconds, response.pause_after_seconds);
          this.metrics.set(response.metrics);
          this.focusInput();
        }
      },
      error: () => {
        if (test.id === this.test()?.id) this.saveError.set(true);
      },
    });
  }

  private acceptResult(test: TypingTest): void {
    if (!test.result || test.id !== this.test()?.id) return;
    this.test.set(test);
    this.metrics.set(test.metrics);
    this.remaining.set(0);
    this.history.add(test);
    this.clearActive();
    this.offline.set(false);
    this.saveError.set(false);
    this.finishing.set(false);
  }

  private remember(): void {
    try {
      sessionStorage.setItem('typedash.active', JSON.stringify({
        id: this.test()?.id,
        typed: this.typed(),
        revision: this.revision,
      }));
    } catch { /* Session recovery is optional. */ }
  }

  private clearActive(): void {
    try { sessionStorage.removeItem('typedash.active'); } catch { /* Optional storage. */ }
  }

  private restoreOrPrepare(): void {
    let active: { id: string; typed: string; revision: number } | null = null;
    try { active = JSON.parse(sessionStorage.getItem('typedash.active') || 'null'); }
    catch { this.clearActive(); }

    if (!active || typeof active.id !== 'string' || typeof active.typed !== 'string' || !Number.isInteger(active.revision)) {
      this.prepare();
      return;
    }

    const saved = active;
    this.api.get(saved.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: test => {
        this.options.set({
          difficulty: test.difficulty,
          duration: test.duration,
          language: test.language,
          punctuation: test.punctuation,
          numbers: test.numbers,
        });
        this.preferences.setLanguage(test.language);
        this.customDraft.set(String(test.duration));
        this.acceptReady(test);
        this.loading.set(false);
        if (test.status === 'finished') {
          this.acceptResult(test);
          return;
        }
        if (test.status !== 'ready') {
          this.typed.set(saved.revision >= test.revision ? saved.typed : test.typed);
          this.revision = Math.max(saved.revision, test.revision);
          this.metrics.set(test.metrics);
          this.test.set(test);
          this.anchorClock(test.remaining_seconds, test.pause_after_seconds);
          this.focusInput();
        }
      },
      error: () => {
        this.clearActive();
        this.prepare();
      },
    });
  }
}
