import { Component, input } from '@angular/core';

const paths = {
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6',
  clock: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  target: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0M12 11v2',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-7l1-7Z',
  trophy: 'M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v7m-4 1h8',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  moon: 'M20.5 13A8.5 8.5 0 0 1 11 3a9 9 0 1 0 9.5 10Z',
  chart: 'M4 4v16h17M8 15l4-5 4 2 5-7',
  check: 'm5 12 4 4L19 6',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
} as const;
@Component({
  selector: 'td-icon',
  template: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path" /></svg>',
  styles: ':host { display:inline-flex; width:1.2em; height:1.2em; flex-shrink:0; } svg { width:100%; height:100%; }',
})
export class Icon { readonly name = input<keyof typeof paths>('arrow'); get path(): string { return paths[this.name()]; } }
