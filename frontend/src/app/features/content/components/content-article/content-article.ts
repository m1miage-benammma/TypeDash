import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { localizedPath } from '../../../../core/seo/localized-routes';
import { Language } from '../../../../core/models/language';
import { CONTENT_PAGES } from '../../data/content-pages';
import { ContentPageId } from '../../models/content-page';

@Component({
  selector: 'td-content-article',
  imports: [RouterLink],
  templateUrl: './content-article.html',
  host: { class: 'block' },
})
export class ContentArticle {
  readonly pageId = input.required<ContentPageId>();
  private readonly route = inject(ActivatedRoute);
  private readonly routeData = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  readonly language = computed(() => this.routeData()['language'] as Language);
  readonly page = computed(() => CONTENT_PAGES[this.language()][this.pageId()]);
  readonly typingTestPath = computed(() => localizedPath('typingTest', this.language()));
}
