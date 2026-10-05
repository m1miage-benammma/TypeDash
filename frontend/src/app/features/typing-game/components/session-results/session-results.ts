import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '../../../../core/services/i18n.service';
import { Icon } from '../../../../shared/components/icon/icon';
import { SessionResultResponse } from '../../responses/session-result.response';
import { sessionChart } from './session-chart';

@Component({
  selector: 'td-session-results',
  imports: [DatePipe, DecimalPipe, Icon],
  templateUrl: './session-results.html',
  styleUrl: './session-results.css',
  host: { class: 'block' },
})
export class SessionResults {
  readonly test = input.required<SessionResultResponse>();
  readonly showAgain = input(true);
  readonly again = output<void>();
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.t.bind(this.i18n);
  readonly chart = computed(() => sessionChart(
    this.test().view.result_chart, this.test().result?.elapsed_seconds ?? 0,
  ));
}
