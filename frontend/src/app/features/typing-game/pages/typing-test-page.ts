import { Component } from '@angular/core';

import { TypingGame } from '../components/typing-game/typing-game';

@Component({
  selector: 'td-typing-test-page',
  imports: [TypingGame],
  template: `
    @defer (on immediate) {
      <td-typing-game />
    } @placeholder {
      <div class="min-h-[640px]" aria-hidden="true"></div>
    }
  `,
})
export class TypingTestPage {}
