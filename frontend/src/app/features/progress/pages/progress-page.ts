import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DeviceIdentityService } from '../../../core/services/device-identity.service';
import { I18nService } from '../../../core/services/i18n.service';
import { Icon } from '../../../shared/components/icon/icon';

@Component({
  selector: 'td-progress-page',
  imports: [DatePipe, DecimalPipe, RouterLink, Icon],
  templateUrl: './progress-page.html',
  host: { class: 'block' },
})
export class ProgressPage {
  readonly identity = inject(DeviceIdentityService);
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.t.bind(this.i18n);
  readonly Math = Math;
  readonly entries = computed(() => this.identity.profile()?.stats ?? []);
  readonly best = computed(() => this.identity.profile()?.summary.best_wpm ?? 0);
  readonly averageWpm = computed(() => this.identity.profile()?.summary.average_wpm ?? 0);
  readonly averageAccuracy = computed(() => this.identity.profile()?.summary.average_accuracy ?? 0);
  readonly historyChart = computed(() => this.entries().slice(0, 12).reverse());
  readonly confirmClear = signal(false);

  clearHistory(): void {
    this.identity.clearStats().subscribe({
      next: () => this.confirmClear.set(false),
    });
  }
}
