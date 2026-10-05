import { Component } from '@angular/core';

import { ContentArticle } from '../components/content-article/content-article';

@Component({
  selector: 'td-programmer-typing-test-page',
  imports: [ContentArticle],
  templateUrl: './programmer-typing-test-page.html',
  host: { class: 'block' },
})
export class ProgrammerTypingTestPage {}
