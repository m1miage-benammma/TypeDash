import { Component, DestroyRef, inject, input, output, signal, afterNextRender } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { I18nService } from '../../../../core/services/i18n.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Icon } from '../../../../shared/components/icon/icon';
import { SessionResults } from '../../../typing-game/components/session-results/session-results';
import { SessionResultResponse } from '../../../typing-game/responses/session-result.response';
import { SessionHistoryService } from '../../services/session-history.service';

@Component({
  selector: 'td-session-details-modal',
  imports: [Dialog, Icon, SessionResults],
  templateUrl: './session-details-modal.html',
})
export class SessionDetailsModal {
  readonly statId = input.required<string>();
  readonly closed = output<void>();
  readonly session = signal<SessionResultResponse | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.t.bind(this.i18n);
  private readonly api = inject(SessionHistoryService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() { afterNextRender(() => this.load()); }

  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.failed.set(false);
    this.api.get(this.statId()).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)),
    ).subscribe({ next: session => this.session.set(session), error: () => this.failed.set(true) });
  }
}
