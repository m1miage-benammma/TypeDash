import { Component, inject, input, output } from '@angular/core';

import { I18nService } from '../../../core/services/i18n.service';
import { Dialog } from '../dialog/dialog';
import { Icon } from '../icon/icon';

@Component({
  selector: 'td-confirmation-modal',
  imports: [Dialog, Icon],
  templateUrl: './confirmation-modal.html',
})
export class ConfirmationModal {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.t.bind(this.i18n);
}
