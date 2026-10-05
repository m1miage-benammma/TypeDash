import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageId, pagePath } from '../../core/seo/page-routes';
import { I18nService } from '../../core/services/i18n.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { Icon } from '../../shared/components/icon/icon';
import { AnalyticsService } from '../../core/analytics/analytics.service';

@Component({
  selector: 'td-footer',
  imports: [RouterLink, Icon],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
  host: { class: 'block' },
})
export class Footer {
  readonly analytics = inject(AnalyticsService);
  readonly language = inject(PreferencesService).language;
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.t.bind(this.i18n);

  routeFor(page: PageId): string {
    return pagePath(page);
  }
}
