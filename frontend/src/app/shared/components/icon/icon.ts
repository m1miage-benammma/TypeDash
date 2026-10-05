import { Component, computed, input } from '@angular/core';
import {
  faArrowRight, faRotateLeft, faTrophy,
  faSun, faMoon, faChartLine, faShieldHalved, faBars, faXmark, faEye,
} from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faClock } from '@fortawesome/free-regular-svg-icons';

// Import only the icons used by the app; no remote kit or global DOM scanner.
const icons = {
  arrow: faArrowRight, reset: faRotateLeft, clock: faClock,
  trophy: faTrophy, sun: faSun, moon: faMoon, chart: faChartLine,
  shield: faShieldHalved, github: faGithub,
  menu: faBars, close: faXmark, eye: faEye,
} as const;

@Component({
  selector: 'td-icon',
  template: `<svg [class.clock-face]="name() === 'clock'" [attr.viewBox]="viewBox()" fill="currentColor" aria-hidden="true" focusable="false">
    @for (path of paths(); track $index) { <path [attr.d]="path" /> }
  </svg>`,
  styles: ':host { display:inline-flex; width:1.2em; height:1.2em; flex-shrink:0; } svg { width:100%; height:100%; } .clock-face { border-radius:50%; background:var(--uga-white); color:var(--uga-orange); }',
})
export class Icon {
  readonly name = input<keyof typeof icons>('arrow');
  private readonly definition = computed(() => icons[this.name()].icon);
  readonly viewBox = computed(() => `0 0 ${this.definition()[0]} ${this.definition()[1]}`);
  readonly paths = computed(() => {
    const path = this.definition()[4];
    return typeof path === 'string' ? [path] : path;
  });
}
