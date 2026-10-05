import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { RouterLink } from '@angular/router';

import { DeviceIdentityService } from '../../../core/services/device-identity.service';
import { I18nService } from '../../../core/services/i18n.service';
import { Icon } from '../../../shared/components/icon/icon';
import { ConfirmationModal } from '../../../shared/components/confirmation-modal/confirmation-modal';

import { RevealDirective } from '../../../shared/directives/reveal.directive';

@Component({
  selector: 'td-progress-page',
  imports: [RevealDirective, DatePipe, DecimalPipe, RouterLink, Icon, ConfirmationModal],
  templateUrl: './progress-page.html',
  host: { class: 'block' },
})
export class ProgressPage {
  readonly identity = inject(DeviceIdentityService);
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.t.bind(this.i18n);
  readonly entries = computed(() => this.identity.profile()?.stats ?? []);
  readonly best = computed(() => this.identity.profile()?.summary.best_wpm ?? 0);
  readonly averageWpm = computed(() => this.identity.profile()?.summary.average_wpm ?? 0);
  readonly averageAccuracy = computed(() => this.identity.profile()?.summary.average_accuracy ?? 0);
  readonly historyChart = computed(() => this.identity.profile()?.history_chart ?? []);
  readonly confirmClear = signal(false);
  readonly clearing = signal(false);
  readonly clearError = signal(false);
  private readonly destroyRef = inject(DestroyRef);

  openClearConfirmation(): void {
    this.clearError.set(false);
    this.confirmClear.set(true);
  }

  clearHistory(): void {
    if (this.clearing()) return;
    this.clearError.set(false);
    this.clearing.set(true);
    this.identity.clearStats().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.clearing.set(false)),
    ).subscribe({
      next: () => this.confirmClear.set(false),
      error: () => this.clearError.set(true),
    });
  }
}
