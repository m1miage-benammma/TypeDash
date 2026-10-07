import { Component, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DeviceIdentityService } from '../../../core/services/device-identity.service';
import { I18nService } from '../../../core/services/i18n.service';
import { Icon } from '../../../shared/components/icon/icon';
import { Leaderboards } from '../responses/leaderboard.response';
import { LeaderboardApiService } from '../services/leaderboard-api.service';

@Component({
  selector: 'td-leaderboard',
  imports: [DecimalPipe, Icon],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.css',
})
export class Leaderboard {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.t.bind(this.i18n);
  private readonly identity = inject(DeviceIdentityService);
  private readonly api = inject(LeaderboardApiService);
  readonly data = signal<Leaderboards | null>(null);
  readonly failed = signal(false);

  constructor() {
    effect(onCleanup => {
      if (!this.identity.initialized()) return;
      this.identity.profile();
      this.failed.set(false);
      const subscription = this.api.get().subscribe({
        next: data => this.data.set(data), error: () => this.failed.set(true),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
