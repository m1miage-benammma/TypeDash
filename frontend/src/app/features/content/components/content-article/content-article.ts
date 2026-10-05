import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { pagePath } from '../../../../core/seo/page-routes';
import { PreferencesService } from '../../../../core/services/preferences.service';
import { CONTENT_PAGES } from '../../data/content-pages';
import { ContentPageId } from '../../models/content-page';

import { RevealDirective } from '../../../../shared/directives/reveal.directive';

@Component({
  selector: 'td-content-article',
  imports: [RevealDirective, RouterLink],
  templateUrl: './content-article.html',
  host: { class: 'block' },
})
export class ContentArticle {
  readonly pageId = input.required<ContentPageId>();
  readonly language = inject(PreferencesService).language;
  readonly page = computed(() => CONTENT_PAGES[this.language()][this.pageId()]);
  readonly typingTestPath = computed(() => pagePath('typingTest'));
}
