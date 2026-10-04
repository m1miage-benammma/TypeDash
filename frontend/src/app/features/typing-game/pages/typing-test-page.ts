import { Component } from '@angular/core';

import { TypingPage } from './typing-page';

@Component({
  selector: 'td-typing-test-page',
  imports: [TypingPage],
  template: `
    @defer (on immediate) {
      <td-typing-page />
    } @placeholder {
      <div class="min-h-[640px]" aria-hidden="true"></div>
    }
  `,
})
export class TypingTestPage {}
