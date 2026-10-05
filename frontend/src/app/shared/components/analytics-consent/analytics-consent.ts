import { Component, inject } from '@angular/core';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { PreferencesService } from '../../../core/services/preferences.service';

@Component({
  selector: 'td-analytics-consent',
  templateUrl: './analytics-consent.html',
  styleUrl: './analytics-consent.css',
})
export class AnalyticsConsent {
  readonly analytics = inject(AnalyticsService);
  readonly preferences = inject(PreferencesService);
}
