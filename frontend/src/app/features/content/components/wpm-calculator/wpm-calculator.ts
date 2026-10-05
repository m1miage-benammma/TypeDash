import { DecimalPipe } from '@angular/common';
import { afterNextRender, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, EMPTY, Subject, switchMap } from 'rxjs';

import { I18nService } from '../../../../core/services/i18n.service';
import { CalculatorRequest, CalculatorResult } from '../../models/calculator';
import { CalculatorApiService } from '../../services/calculator-api.service';

@Component({
  selector: 'td-wpm-calculator',
  imports: [DecimalPipe],
  templateUrl: './wpm-calculator.html',
  host: { class: 'block' },
})
export class WpmCalculator {
  private readonly i18n = inject(I18nService);
  private readonly api = inject(CalculatorApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subject<CalculatorRequest>();
  readonly t = this.i18n.t.bind(this.i18n);

  readonly characters = signal('');
  readonly seconds = signal('');
  readonly errors = signal('');
  readonly failed = signal(false);
  readonly result = signal<CalculatorResult | null>(null);
  readonly grossWpm = computed(() => this.result()?.gross_wpm);
  readonly adjustedWpm = computed(() => this.result()?.adjusted_wpm);
  readonly calculatedAccuracy = computed(() => this.result()?.accuracy);

  constructor() {
    this.requests.pipe(
      debounceTime(150),
      switchMap(request => this.api.calculate(request).pipe(
        catchError(() => {
          this.result.set(null);
          this.failed.set(true);
          return EMPTY;
        }),
      )),
      takeUntilDestroyed(),
    ).subscribe(result => this.show(result));

    afterNextRender(() => {
      this.api.defaults().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => this.show(result),
        error: () => this.failed.set(true),
      });
    });
  }

  setCharacters(event: Event): void {
    this.characters.set((event.target as HTMLInputElement).value);
    this.calculate();
  }

  setSeconds(event: Event): void {
    this.seconds.set((event.target as HTMLInputElement).value);
    this.calculate();
  }

  setErrors(event: Event): void {
    this.errors.set((event.target as HTMLInputElement).value);
    this.calculate();
  }

  private calculate(): void {
    this.failed.set(false);
    this.requests.next({
      characters: this.characters(), seconds: this.seconds(), errors: this.errors(),
    });
  }

  private show(result: CalculatorResult): void {
    this.result.set(result);
    this.characters.set(String(result.characters));
    this.seconds.set(String(result.seconds));
    this.errors.set(String(result.errors));
    this.failed.set(false);
  }
}
