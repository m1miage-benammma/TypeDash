import { Component } from '@angular/core';

import { ContentArticle } from '../components/content-article/content-article';

@Component({
  selector: 'td-typing-speed-guide-page',
  imports: [ContentArticle],
  templateUrl: './typing-speed-guide-page.html',
  host: { class: 'block' },
})
export class TypingSpeedGuidePage {}
