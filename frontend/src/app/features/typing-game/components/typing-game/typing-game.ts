import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, inject, signal, untracked, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Subject, Subscription, catchError, finalize, interval, switchMap, tap, timer } from 'rxjs';

import { I18nService } from '../../../../core/services/i18n.service';
import { DeviceIdentityService } from '../../../../core/services/device-identity.service';
import { PreferencesService, writeLocal } from '../../../../core/services/preferences.service';
import { RegistrationModal } from '../../../identity/components/registration-modal/registration-modal';
import { Icon } from '../../../../shared/components/icon/icon';
import { Difficulty } from '../../models/test-options';
import { PrepareTestRequest } from '../../requests/typing-test.request';
import { TypingTest } from '../../responses/typing-test.response';
import { TypingApiService } from '../../services/typing-api.service';
import { TypingInputComponent } from '../typing-input/typing-input';
import { TypingInput } from '../../models/typing-input';
import { SessionResults } from '../session-results/session-results';
import { previewWords } from './typing-preview';
import { TypingConnection, TypingStreamService } from '../../services/typing-stream.service';
import { AnalyticsService } from '../../../../core/analytics/analytics.service';

@Component({
  selector: 'td-typing-game',
  imports: [DecimalPipe, Icon, RegistrationModal, TypingInputComponent, SessionResults],
  templateUrl: './typing-game.html',
  styleUrl: './typing-game.css',
})
export class TypingGame {
  readonly i18n = inject(I18nService);
  readonly preferences = inject(PreferencesService);
  readonly identity = inject(DeviceIdentityService);
  private readonly api = inject(TypingApiService);
  private readonly analytics = inject(AnalyticsService);
  private readonly stream = inject(TypingStreamService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewport = window.matchMedia('(max-width: 560px)');

  @ViewChild('customInput') customInput?: ElementRef<HTMLInputElement>;
  @ViewChild(TypingInputComponent) keyboard?: TypingInputComponent;
  @ViewChild('passage') passage?: ElementRef<HTMLElement>;

  readonly t = this.i18n.t.bind(this.i18n);
  readonly test = signal<TypingTest | null>(null);
  // UI selection is synchronous; confirmed session state stays server-owned.
  readonly options = signal<PrepareTestRequest>({
    duration: 30, difficulty: 'easy', punctuation: false, numbers: false,
    ...this.preferences.loadOptions(), language: this.preferences.language(),
  });
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly offline = signal(false);
  readonly pasteHint = signal(false);
  readonly customOpen = signal(false);
  readonly customDraft = signal('');
  readonly durationError = signal<'durationMax' | 'durationInvalid' | null>(null);
  readonly registrationModal = signal(false);
  readonly isMobile = signal(this.viewport.matches);
  readonly durations = computed(() => this.test()?.view.durations ?? [15, 30, 60]);
  readonly best = computed(() => this.identity.profile()?.summary.best_wpm ?? 0);
  readonly engaged = computed(() => (this.test()?.view.active ?? false) || this.pendingInputs().length > 0);
  readonly running = computed(() => this.test()?.status === 'running');
  readonly locked = computed(() => !this.loading()
    && (this.pendingInputs().length > 0 || this.test()?.view.can_configure === false));
  readonly result = computed(() => this.loading() ? null : this.test()?.result ?? null);
  readonly canType = computed(() => this.test()?.view.can_type === true
    && this.test()?.language === this.preferences.language()
    && !this.loading() && !this.loadError()
    && !this.registrationModal());
  readonly customSelected = computed(() => !this.durations().includes(Number(this.options().duration)));
  readonly singleLineMode = computed(() => this.isMobile() || this.preferences.singleLine());
  private readonly displayNow = signal(performance.now());
  private readonly receivedAt = signal(performance.now());
  // Display interpolation only; never calculate scores or finish a test locally.
  private readonly displayedRemaining = computed(() => {
    const test = this.test();
    if (!test) return 0;
    const since = Math.max(0, (this.displayNow() - this.receivedAt()) / 1000);
    const advance = test.status === 'running' && !this.offline()
      ? Math.min(since, test.pause_after_seconds) : 0;
    return Math.max(0, test.remaining_seconds - advance);
  });
  readonly clock = computed(() => {
    if (this.loading()) {
      const selected = Number(this.options().duration);
      if (!Number.isFinite(selected) || selected < 1) return '—';
      return `${String(Math.floor(selected / 60)).padStart(2, '0')}:${String(selected % 60).padStart(2, '0')}`;
    }
    if (!this.test()) return '—';
    const seconds = Math.ceil(this.displayedRemaining());
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  });
  readonly elapsedPercent = computed(() => {
    if (this.loading()) return 0;
    const test = this.test();
    return test ? (1 - this.displayedRemaining() / test.duration) * 100 : 0;
  });
  private readonly passageSnapshot = computed(() => this.test(), {
    equal: (previous, next) => previous?.id === next?.id && previous?.typed === next?.typed
      && previous?.auto_inserted_separator === next?.auto_inserted_separator
      && previous?.input_word_by_word === next?.input_word_by_word,
  });
  readonly visibleWords = computed(() => {
    const test = this.passageSnapshot();
    return test ? previewWords(test, this.pendingInputs(), this.singleLineMode(), true) : [];
  });

  private readonly prepareRequests = new Subject<{
    options: PrepareTestRequest;
    forceNew: boolean;
  }>();
  private readonly pendingInputs = signal<TypingInput[]>([]);
  private connection: TypingConnection | null = null;
  private sentSequence = -1;
  private sequence = -1;
  private requestedLanguage = this.preferences.language();
  private preparationStarted = false;
  private restoreSubscription?: Subscription;

  constructor() {
    this.prepareRequests.pipe(
      switchMap(request => {
        const { options, forceNew } = request;
        this.restoreSubscription?.unsubscribe();
        this.loading.set(true);
        this.loadError.set(false);
        this.offline.set(false);
        this.durationError.set(null);
        this.connection?.close();
        this.connection = null;
        this.pendingInputs.set([]);
        // Cancel immediately on the next selection, including during this
        // short coalescing window. Only the latest settings reach the server.
        const delay = this.preparationStarted ? 50 : 0;
        this.preparationStarted = true;
        return timer(delay).pipe(switchMap(() => this.api.prepare(options, forceNew)),
          tap(test => {
            const requestedDuration = Number(options.duration);
            this.sequence = test.revision;
            this.offline.set(false);
            this.pasteHint.set(false);
            this.customOpen.set(false);
            this.test.set(test);
            this.options.set(this.confirmedOptions(test));
            this.receivedAt.set(performance.now());
            this.connectStream(test);
            if (Number.isInteger(requestedDuration) && requestedDuration >= 1
                && requestedDuration <= 300 && requestedDuration !== test.duration) {
              this.setDuration(requestedDuration);
            }
            this.remember(test.id);
            writeLocal('typedash.options', this.requestOptions());
          }),
          catchError((error: HttpErrorResponse) => {
            const code = error.error?.error?.code;
            if (code === 'duration_max' || code === 'duration_invalid') {
              this.durationError.set(code === 'duration_max' ? 'durationMax' : 'durationInvalid');
              const confirmed = this.test();
              if (confirmed) this.options.set(this.confirmedOptions(confirmed));
            } else this.loadError.set(true);
            return EMPTY;
          }),
          finalize(() => {
            this.loading.set(false);
            if (!this.isMobile()) setTimeout(() => this.focusInput());
          }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe();

    interval(100).pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.running() && !this.offline()) this.displayNow.set(performance.now());
      if (this.pendingInputs().length) this.flushInputs();
    });

    const viewportChanged = (event: MediaQueryListEvent): void => {
      this.isMobile.set(event.matches);
      setTimeout(() => this.scrollCaret());
    };
    this.viewport.addEventListener('change', viewportChanged);
    this.destroyRef.onDestroy(() => {
      this.connection?.close();
      this.viewport.removeEventListener('change', viewportChanged);
    });

    effect(() => {
      const language = this.preferences.language();
      untracked(() => {
        // Language changes supersede even an in-flight load or an active test.
        // switchMap cancels the old request; its words must never win this race.
        if (this.requestedLanguage !== language) {
          this.prepare({ language }, false);
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

  private confirmedOptions(test: TypingTest): PrepareTestRequest {
    return {
      difficulty: test.difficulty, duration: test.duration, language: test.language,
      punctuation: test.punctuation, numbers: test.numbers,
    };
  }

  private requestOptions(): PrepareTestRequest {
    return this.options();
  }

  prepare(changes: PrepareTestRequest = {}, forceNew = true): void {
    this.requestedLanguage = this.preferences.language();
    this.clearActive();
    const options = {
      ...this.requestOptions(), language: this.preferences.language(),
      ...changes, word_by_word: this.singleLineMode(),
    };
    this.options.set(options);
    this.loading.set(true);
    this.prepareRequests.next({ options, forceNew });
  }

  toggleOption(option: 'punctuation' | 'numbers'): void {
    this.prepare({ [option]: !this.options()[option] }, false);
  }

  setDuration(duration: number): void {
    const test = this.test();
    if (!test || this.locked()) return;
    this.options.set({ ...this.options(), duration });
    this.test.set({
      ...test,
      duration,
      remaining_seconds: duration,
      view: { ...test.view, custom_duration: !this.durations().includes(duration) },
    });
    this.api.remember(this.test()!);
    this.receivedAt.set(performance.now());
    this.durationError.set(null);
    this.customOpen.set(false);
    this.connection?.setDuration(duration);
    writeLocal('typedash.options', this.requestOptions());
    this.focusInput();
  }

  toggleCustom(): void {
    this.customOpen.update(open => !open);
    if (!this.customOpen()) return;
    this.customDraft.set(this.customSelected() ? String(this.options().duration) : '');
    this.durationError.set(null);
    setTimeout(() => this.customInput?.nativeElement.focus());
  }

  validateCustom(event: Event): void {
    this.customDraft.set((event.target as HTMLInputElement).value);
    this.durationError.set(null);
  }

  applyCustomDuration(): void {
    const value = this.customDraft().trim();
    if (!/^\d+$/.test(value) || Number(value) < 1) {
      this.durationError.set('durationInvalid');
      return;
    }
    const duration = Number(value);
    if (duration > 300) {
      this.durationError.set('durationMax');
      return;
    }
    this.setDuration(duration);
  }

  setDifficulty(event: Event): void {
    this.prepare({ difficulty: (event.target as HTMLSelectElement).value as Difficulty }, false);
  }

  setLineMode(singleLine: boolean): void {
    this.preferences.setLineMode(singleLine);
    this.focusInput();
  }

  queueKeys(keys: string[]): void {
    if (!this.test() || !this.canType()) return;
    this.identity.ensureDeviceId();
    this.pendingInputs.update(pending => [...pending, ...keys.map(key => ({
      key, sequence: ++this.sequence, wordByWord: this.singleLineMode(),
    }))]);
    this.flushInputs();
    setTimeout(() => this.scrollCaret());
  }

  private flushInputs(): void {
    const batch = this.pendingInputs().filter(input => input.sequence > this.sentSequence).slice(0, 32);
    if (batch.length && this.connection?.send(batch)) this.sentSequence = batch[batch.length - 1].sequence;
  }

  private connectStream(test: TypingTest): void {
    this.connection?.close();
    if (test.result) return;
    this.sentSequence = test.revision;
    this.connection = this.stream.connect(test.id, this.identity.ensureDeviceId(), this.singleLineMode(),
      response => this.accept(response), ready => {
        this.offline.set(!ready);
        // Replay unacknowledged sequences after reconnect; backend deduplicates.
        if (ready) {
          this.sentSequence = this.test()?.revision ?? -1;
          this.flushInputs();
        }
      }, test);
  }

  private accept(test: TypingTest): void {
    const current = this.test();
    // Ignore stale HTTP responses, never derive or modify server state locally.
    if (test.id !== current?.id || test.revision < current.revision) return;
    if (test.revision === current.revision && test.observed_at < current.observed_at) return;
    const previouslyFinished = !!current.result;
    if (!current.started_at && test.started_at) this.analytics.sessionEvent('typing_session_start', test);
    this.test.set(test);
    this.api.remember(test);
    this.receivedAt.set(performance.now());
    this.pendingInputs.update(pending => {
      if (!pending.length) return pending;
      if (test.result) return [];
      const remaining = pending.filter(input => input.sequence > test.revision);
      return remaining.length === pending.length ? pending : remaining;
    });
    this.offline.set(false);
    if (test.typed !== current.typed) setTimeout(() => this.scrollCaret());
    if (test.result && !previouslyFinished) {
      this.analytics.sessionEvent('typing_session_complete', test);
      this.clearActive();
      this.identity.loadProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        error: () => undefined, // Profile availability is not stream availability.
      });
    }
  }

  showPasteHint(): void { this.pasteHint.set(true); }

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

  focusInput(): void { this.keyboard?.focus(); }

  private remember(id: string): void {
    try { sessionStorage.setItem('typedash.active', JSON.stringify({ id })); }
    catch { /* Session recovery is optional. */ }
  }

  private clearActive(): void {
    try { sessionStorage.removeItem('typedash.active'); } catch { /* Optional storage. */ }
  }

  private restoreOrPrepare(): void {
    const cached = this.api.current();
    if (cached) {
      if (cached.language === this.preferences.language()) this.restore(cached);
      else this.prepare({ language: this.preferences.language() }, false);
      return;
    }
    let active: { id: string } | null = null;
    try { active = JSON.parse(sessionStorage.getItem('typedash.active') || 'null'); }
    catch { this.clearActive(); }
    if (!active?.id) {
      this.prepare();
      return;
    }
    this.restoreSubscription = this.api.get(active.id, this.identity.deviceId(), this.singleLineMode()).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: test => {
        if (test.language !== this.preferences.language()) {
          this.prepare({ language: this.preferences.language() }, false);
          return;
        }
        this.restore(test);
      },
      error: () => { this.clearActive(); this.prepare(); },
    });
  }

  private restore(test: TypingTest): void {
    this.sequence = test.revision;
    this.test.set(test);
    this.options.set(this.confirmedOptions(test));
    this.receivedAt.set(performance.now());
    this.connectStream(test);
    this.loading.set(false);
    if (test.result) {
      this.clearActive();
      this.identity.loadProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        error: () => undefined,
      });
    } else this.remember(test.id);
    if (!this.isMobile()) setTimeout(() => this.focusInput());
  }
}
