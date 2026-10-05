import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LocalizedPageId, localizedPath } from '../../core/seo/localized-routes';
import { I18nService } from '../../core/services/i18n.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'td-footer',
  imports: [RouterLink, Icon],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
  host: { class: 'block' },
})
export class Footer {
  private readonly preferences = inject(PreferencesService);
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.t.bind(this.i18n);

  routeFor(page: LocalizedPageId): string {
    return localizedPath(page, this.preferences.language());
  }
}
