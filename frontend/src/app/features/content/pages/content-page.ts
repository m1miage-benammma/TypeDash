import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { I18nService } from '../../../core/services/i18n.service';
import { localizedPath } from '../../../core/seo/localized-routes';
import { Language } from '../../typing-game/models/typing-test';
import { CONTENT_PAGES, ContentPageId } from '../data/content-pages';

@Component({
  selector: 'td-content-page',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './content-page.html',
})
export class ContentPage {
  private readonly route = inject(ActivatedRoute);
  private readonly routeData = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t.bind(this.i18n);
  readonly pageId = computed(() => this.routeData()['pageId'] as ContentPageId);
  readonly language = computed(() => this.routeData()['language'] as Language);
  readonly page = computed(() => CONTENT_PAGES[this.language()][this.pageId()]);
  readonly typingTestPath = computed(() => localizedPath('typingTest', this.language()));

  readonly characters = signal(250);
  readonly seconds = signal(60);
  readonly errors = signal(0);
  readonly grossWpm = computed(() => (this.characters() / 5) / (this.seconds() / 60));
  readonly adjustedWpm = computed(() => Math.max(0, this.grossWpm() - this.errors() / (this.seconds() / 60)));
  readonly calculatedAccuracy = computed(() => this.characters() === 0
    ? 0
    : Math.max(0, ((this.characters() - this.errors()) / this.characters()) * 100));

  isCalculator(): boolean {
    return this.pageId() === 'wpmCalculator';
  }

  setCharacters(event: Event): void {
    const value = this.readNumber(event, 0, 100000);
    this.characters.set(value);
    this.errors.update(errors => Math.min(errors, value));
  }

  setSeconds(event: Event): void {
    this.seconds.set(this.readNumber(event, 1, 3600));
  }

  setErrors(event: Event): void {
    this.errors.set(this.readNumber(event, 0, this.characters()));
  }

  private readNumber(event: Event, minimum: number, maximum: number): number {
    const value = Number((event.target as HTMLInputElement).value);
    return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.round(value))) : minimum;
  }
}
