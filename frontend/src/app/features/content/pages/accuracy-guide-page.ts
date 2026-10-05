import { Component } from '@angular/core';

import { ContentArticle } from '../components/content-article/content-article';

@Component({
  selector: 'td-accuracy-guide-page',
  imports: [ContentArticle],
  templateUrl: './accuracy-guide-page.html',
  host: { class: 'block' },
})
export class AccuracyGuidePage {}
