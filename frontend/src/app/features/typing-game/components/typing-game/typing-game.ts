import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, inject, signal, untracked, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Subject, catchError, exhaustMap, finalize, interval, switchMap, takeUntil, tap } from 'rxjs';

import { I18nService } from '../../../../core/services/i18n.service';
import { DeviceIdentityService } from '../../../../core/services/device-identity.service';
import { PreferencesService, writeLocal } from '../../../../core/services/preferences.service';
import { RegistrationModal } from '../../../identity/components/registration-modal/registration-modal';
import { ConfirmationModal } from '../../../../shared/components/confirmation-modal/confirmation-modal';
import { Icon } from '../../../../shared/components/icon/icon';
import { Difficulty, PrepareTestRequest, TypingTest } from '../../models/typing-test';
import { TypingApiService } from '../../services/typing-api.service';
import { previewWords } from './typing-preview';

interface InputMessage {
  testId: string;
  key: string;
  sequence: number;
  wordByWord: boolean;
}

@Component({
  selector: 'td-typing-game',
  imports: [DecimalPipe, Icon, RegistrationModal, ConfirmationModal],
  templateUrl: './typing-game.html',
  styleUrl: './typing-game.css',
})
export class TypingGame {
  readonly i18n = inject(I18nService);
  readonly preferences = inject(PreferencesService);
  readonly identity = inject(DeviceIdentityService);
  private readonly api = inject(TypingApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewport = window.matchMedia('(max-width: 560px)');

  @ViewChild('customInput') customInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passage') passage?: ElementRef<HTMLElement>;

  readonly t = this.i18n.t.bind(this.i18n);
  readonly test = signal<TypingTest | null>(null);
  readonly options = computed(() => this.test());
  readonly metrics = computed(() => this.test()?.metrics);
  readonly loading = signal(true);
  readonly finishing = signal(false);
  readonly loadError = signal(false);
  readonly saveError = signal(false);
  readonly offline = signal(false);
  readonly pasteHint = signal(false);
  readonly restartModal = signal(false);
  readonly customOpen = signal(false);
  readonly customDraft = signal('');
  readonly durationError = signal<'durationMax' | 'durationInvalid' | null>(null);
  readonly registrationModal = signal(false);
  readonly isMobile = signal(this.viewport.matches);
  readonly durations = computed(() => this.test()?.view.durations ?? []);
  readonly entries = computed(() => this.identity.profile()?.stats ?? []);
  readonly best = computed(() => this.identity.profile()?.summary.best_wpm ?? 0);
  readonly averageWpm = computed(() => this.identity.profile()?.summary.average_wpm ?? 0);
  readonly averageAccuracy = computed(() => this.identity.profile()?.summary.average_accuracy ?? 0);
  readonly engaged = computed(() => (this.test()?.view.active ?? false) || this.pendingInputs().length > 0);
  readonly running = computed(() => this.test()?.status === 'running');
  readonly locked = computed(() => this.loading() || this.saveError() || this.pendingInputs().length > 0 || this.test()?.view.can_configure === false);
  readonly result = computed(() => this.test()?.result ?? null);
  readonly canType = computed(() => this.test()?.view.can_type === true
    && !this.loading() && !this.loadError() && !this.saveError()
    && !this.finishing()
    && !this.restartModal() && !this.registrationModal());
  readonly customSelected = computed(() => this.test()?.view.custom_duration ?? false);
  readonly singleLineMode = computed(() => this.isMobile() || this.preferences.singleLine());
  readonly clock = computed(() => this.test()?.view.clock ?? '—');
  readonly elapsedPercent = computed(() => this.test()?.view.elapsed_percent ?? 0);
  readonly visibleWords = computed(() => {
    const test = this.test();
    return test ? previewWords(test, this.pendingInputs(), this.singleLineMode()) : [];
  });
  readonly resultChart = computed(() => this.test()?.view.result_chart ?? []);

  private readonly prepareRequests = new Subject<PrepareTestRequest>();
  private readonly pendingInputs = signal<InputMessage[]>([]);
  private readonly stopRequests = new Subject<void>();
  private sequence = -1;
  private failedBatch: InputMessage[] | null = null;

  constructor() {
    this.prepareRequests.pipe(
      switchMap(options => {
        this.loading.set(true);
        this.loadError.set(false);
        this.durationError.set(null);
        this.stopRequests.next();
        this.pendingInputs.set([]);
        return this.api.prepare(options).pipe(
          tap(test => {
            this.sequence = test.revision;
            this.failedBatch = null;
            this.saveError.set(false);
            this.offline.set(false);
            this.pasteHint.set(false);
            this.customOpen.set(false);
            this.test.set(test);
            this.remember(test.id);
            writeLocal('typedash.options', this.requestOptions());
          }),
          catchError((error: HttpErrorResponse) => {
            const code = error.error?.error?.code;
            if (code === 'duration_max' || code === 'duration_invalid') {
              this.durationError.set(code === 'duration_max' ? 'durationMax' : 'durationInvalid');
            } else this.loadError.set(true);
            return EMPTY;
          }),
          finalize(() => {
            this.loading.set(false);
            this.focusInput();
          }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe();

    interval(40).pipe(
      exhaustMap(() => {
        const batch = this.pendingInputs().slice(0, 256);
        if (!batch.length || this.loading() || this.saveError()) return EMPTY;
        return this.sendInputs(batch).pipe(takeUntil(this.stopRequests));
      }),
      takeUntilDestroyed(),
    ).subscribe();

    interval(250).pipe(
      exhaustMap(() => {
        const test = this.test();
        if (!test || test.status !== 'running' || this.loading() || this.saveError() || this.pendingInputs().length) return EMPTY;
        return this.api.get(test.id, this.identity.deviceId(), this.singleLineMode()).pipe(
          takeUntil(this.stopRequests),
          tap(response => this.accept(response)),
          catchError(() => { this.offline.set(true); return EMPTY; }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe();

    const viewportChanged = (event: MediaQueryListEvent): void => {
      this.isMobile.set(event.matches);
      this.refreshView();
    };
    this.viewport.addEventListener('change', viewportChanged);
    this.destroyRef.onDestroy(() => {
      this.stopRequests.next();
      this.viewport.removeEventListener('change', viewportChanged);
    });

    effect(() => {
      const language = this.preferences.language();
      untracked(() => {
        if (this.test() && this.test()?.language !== language && !this.locked()) {
          this.prepare({ language });
        }
      });
    });
    effect(() => {
      if (this.identity.profile()?.requires_registration) {
        untracked(() => this.registrationModal.set(true));
      }
    });

    this.restoreOrPrepare();
  }

  private requestOptions(): PrepareTestRequest {
    const test = this.test();
    return test ? {
      difficulty: test.difficulty, duration: test.duration, language: test.language,
      punctuation: test.punctuation, numbers: test.numbers,
    } : this.preferences.loadOptions();
  }

  prepare(changes: PrepareTestRequest = {}): void {
    this.prepareRequests.next({
      ...this.requestOptions(), language: this.preferences.language(),
      ...changes, word_by_word: this.singleLineMode(),
    });
  }

  toggleOption(option: 'punctuation' | 'numbers'): void {
    this.prepare({ [option]: !this.options()?.[option] });
  }

  setDuration(duration: number): void { this.prepare({ duration }); }

  toggleCustom(): void {
    this.customOpen.update(open => !open);
    if (!this.customOpen()) return;
    this.customDraft.set(this.customSelected() ? String(this.options()?.duration) : '');
    this.durationError.set(null);
    setTimeout(() => this.customInput?.nativeElement.focus());
  }

  validateCustom(event: Event): void {
    this.customDraft.set((event.target as HTMLInputElement).value);
    this.durationError.set(null);
  }

  applyCustomDuration(): void { this.prepare({ duration: this.customDraft() }); }

  setDifficulty(event: Event): void {
    this.prepare({ difficulty: (event.target as HTMLSelectElement).value as Difficulty });
  }

  setLineMode(singleLine: boolean): void {
    this.preferences.setLineMode(singleLine);
    this.refreshView();
    this.focusInput();
  }

  private refreshView(): void {
    const test = this.test();
    if (!test || this.loading()) return;
    this.api.get(test.id, this.identity.deviceId(), this.singleLineMode()).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({ next: response => this.accept(response), error: () => this.offline.set(true) });
  }

  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
      this.preventPaste(event);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.isComposing || event.key === 'Tab') return;
    event.preventDefault();
    const test = this.test();
    if (!test || !this.canType()) return;
    this.identity.ensureDeviceId();
    this.pendingInputs.update(pending => [...pending, {
      testId: test.id, key: event.key, sequence: ++this.sequence,
      wordByWord: this.singleLineMode(),
    }]);
    this.scrollCaret();
  }

  private sendInputs(batch: InputMessage[]) {
    return this.api.inputs(
      batch[0].testId, this.identity.ensureDeviceId(), batch,
    ).pipe(
      tap(test => {
        this.failedBatch = null;
        this.accept(test);
      }),
      catchError(() => {
        if (batch[0].testId === this.test()?.id) {
          this.failedBatch = batch;
          this.saveError.set(true);
        }
        return EMPTY;
      }),
    );
  }

  private accept(test: TypingTest): void {
    const current = this.test();
    // Ignore stale HTTP responses, never derive or modify server state locally.
    if (test.id !== current?.id || test.revision < current.revision) return;
    if (test.revision === current.revision && test.observed_at < current.observed_at) return;
    const previouslyFinished = !!current.result;
    this.test.set(test);
    this.pendingInputs.update(pending => test.result ? [] : pending.filter(input => input.sequence > test.revision));
    this.offline.set(false);
    setTimeout(() => this.scrollCaret());
    if (test.result && !previouslyFinished) {
      this.clearActive();
      this.identity.loadProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        error: () => this.offline.set(true),
      });
    }
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
    if (this.singleLineMode()) box.scrollLeft += rect.left - bounds.left - bounds.width / 4;
    else if (rect.bottom > bounds.bottom - 25 || rect.top < bounds.top + 10) {
      box.scrollTop += rect.top - bounds.top - 25;
    }
  }

  focusInput(): void { setTimeout(() => this.passage?.nativeElement.focus()); }

  confirmRestart(): void {
    this.restartModal.set(false);
    this.saveError.set(false);
    this.prepare();
  }

  finish(): void {
    if (!this.failedBatch || this.finishing()) return;
    this.finishing.set(true);
    // Retry the same transport sequence; the backend handles idempotency.
    this.sendInputs(this.failedBatch).pipe(
      takeUntilDestroyed(this.destroyRef),
      tap(() => this.saveError.set(false)),
      finalize(() => {
        this.finishing.set(false);
        this.sequence = Math.max(this.sequence, this.test()?.revision ?? -1);
        this.focusInput();
      }),
    ).subscribe();
  }

  private remember(id: string): void {
    try { sessionStorage.setItem('typedash.active', JSON.stringify({ id })); }
    catch { /* Session recovery is optional. */ }
  }

  private clearActive(): void {
    try { sessionStorage.removeItem('typedash.active'); } catch { /* Optional storage. */ }
  }

  private restoreOrPrepare(): void {
    let active: { id: string } | null = null;
    try { active = JSON.parse(sessionStorage.getItem('typedash.active') || 'null'); }
    catch { this.clearActive(); }
    if (!active?.id) {
      this.prepare();
      return;
    }
    this.api.get(active.id, this.identity.deviceId(), this.singleLineMode()).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: test => {
        this.sequence = test.revision;
        this.test.set(test);
        this.loading.set(false);
        if (test.result) {
          this.clearActive();
          this.identity.loadProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            error: () => this.offline.set(true),
          });
        }
        this.focusInput();
      },
      error: () => { this.clearActive(); this.prepare(); },
    });
  }
}
