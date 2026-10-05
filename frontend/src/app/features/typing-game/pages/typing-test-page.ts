import { afterNextRender, Component, inject, signal } from '@angular/core';
import { I18nService } from '../../../core/services/i18n.service';
import { PreferencesService } from '../../../core/services/preferences.service';

import { TypingGame } from '../components/typing-game/typing-game';

@Component({
  selector: 'td-typing-test-page',
  imports: [TypingGame],
  template: `
    @if (browser()) {
      <td-typing-game />
    } @else {
      <section class="min-h-[640px]">
        <header class="page-heading">
          <h1>{{ i18n.t('headline') }} <em>{{ i18n.t('flow') }}</em></h1>
          <p>{{ preferences.language() === 'fr'
            ? 'Entraînez-vous gratuitement à la frappe en français. Choisissez la durée et la difficulté, puis consultez votre vitesse et votre précision à la fin du test.'
            : 'Practise English typing for free. Choose your duration and difficulty, then see your typing speed and accuracy at the end of the test.' }}</p>
        </header>
      </section>
    }
  `,
})
export class TypingTestPage {
  readonly browser = signal(false);
  readonly i18n = inject(I18nService);
  readonly preferences = inject(PreferencesService);

  constructor() {
    afterNextRender(() => this.browser.set(true));
  }
}
