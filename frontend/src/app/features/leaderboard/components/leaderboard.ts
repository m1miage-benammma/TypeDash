import { Component, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DeviceIdentityService } from '../../../core/services/device-identity.service';
import { I18nService } from '../../../core/services/i18n.service';
import { SessionAuthService } from '../../../core/services/session-auth.service';
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
  private readonly session = inject(SessionAuthService);
  private readonly api = inject(LeaderboardApiService);
  private profileInitialized = false;
  readonly data = signal<Leaderboards | null>(null);
  readonly failed = signal(false);

  constructor() {
    effect(onCleanup => {
      if (!this.session.deviceId()) return;
      const subscription = this.load();
      onCleanup(() => subscription.unsubscribe());
    });
    effect(onCleanup => {
      const initialized = this.identity.initialized();
      this.identity.profile();
      if (!initialized) return;
      // Profile and leaderboard start together; only later profile changes need a refresh.
      if (!this.profileInitialized) {
        this.profileInitialized = true;
        return;
      }
      const subscription = this.load(true);
      onCleanup(() => subscription.unsubscribe());
    });
  }

  private load(refresh = false) {
    this.failed.set(false);
    return this.api.get(refresh).subscribe({
      next: data => this.data.set(data),
      error: () => { if (!this.data()) this.failed.set(true); },
    });
  }
}
