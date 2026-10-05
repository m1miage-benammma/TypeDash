import { Component } from '@angular/core';

import { ContentArticle } from '../components/content-article/content-article';
import { WpmCalculator } from '../components/wpm-calculator/wpm-calculator';

@Component({
  selector: 'td-wpm-calculator-page',
  imports: [ContentArticle, WpmCalculator],
  templateUrl: './wpm-calculator-page.html',
  host: { class: 'block' },
})
export class WpmCalculatorPage {}
