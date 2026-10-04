import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { I18nService } from '../../core/services/i18n.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { Language } from '../../features/typing-game/models/typing-test';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'td-app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShell {
  readonly preferences = inject(PreferencesService);
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.t.bind(this.i18n);

  setLanguage(language: Language): void {
    this.preferences.setLanguage(language);
  }
}
