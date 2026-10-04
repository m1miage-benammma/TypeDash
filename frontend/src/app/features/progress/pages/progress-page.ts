import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/services/i18n.service';
import { Icon } from '../../../shared/components/icon/icon';
import { HistoryService, median } from '../../typing-game/services/history.service';

@Component({
  selector: 'td-progress-page',
  imports: [DatePipe, DecimalPipe, RouterLink, Icon],
  templateUrl: './progress-page.html',
  styleUrl: './progress-page.css',
})
export class ProgressPage {
  readonly history = inject(HistoryService);
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.t.bind(this.i18n);
  readonly Math = Math;
  readonly entries = toSignal(this.history.history$, { initialValue: this.history.current });
  readonly best = computed(() => Math.max(0, ...this.entries().map(entry => entry.wpm)));
  readonly medianWpm = computed(() => median(this.entries().map(entry => entry.wpm)));
  readonly medianAccuracy = computed(() => median(this.entries().map(entry => entry.accuracy)));
  readonly historyChart = computed(() => this.entries().slice(0, 12).reverse());
  readonly confirmClear = signal(false);

  clearHistory(): void {
    this.history.clear();
    this.confirmClear.set(false);
  }
}
