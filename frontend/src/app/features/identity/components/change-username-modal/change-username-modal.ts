import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { I18nService } from '../../../../core/services/i18n.service';
import { DeviceIdentityService } from '../../../../core/services/device-identity.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';

@Component({
  selector: 'td-change-username-modal',
  imports: [Dialog],
  templateUrl: './change-username-modal.html',
})
export class ChangeUsernameModal {
  readonly closed = output<void>();
  readonly identity = inject(DeviceIdentityService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  readonly t = this.i18n.t.bind(this.i18n);
  readonly usernameDraft = signal(this.identity.profile()?.username ?? '');
  readonly usernameError = signal<'usernameInvalid' | 'usernameTaken' | 'usernameChangeLimitReached' | 'usernameUpdateFailed' | null>(
    this.usernameLimitReached() ? 'usernameChangeLimitReached' : null,
  );
  readonly updatingUsername = signal(false);

  closeUsernameModal(): void {
    if (!this.updatingUsername()) this.closed.emit();
  }

  validateUsername(event: Event): void {
    const username = (event.target as HTMLInputElement).value;
    this.usernameDraft.set(username);
    this.usernameError.set(null);
  }

  saveUsername(): void {
    if (this.updatingUsername()) return;
    const username = this.usernameDraft();

    this.usernameError.set(null);
    this.updatingUsername.set(true);
    this.identity.updateUsername(username).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.updatingUsername.set(false)),
    ).subscribe({
      next: () => this.closed.emit(),
      error: (error: HttpErrorResponse) => {
        const code = error.error?.error?.code;
        this.usernameError.set(
          code === 'invalid_username'
            ? 'usernameInvalid'
            : code === 'username_taken'
              ? 'usernameTaken'
            : code === 'username_change_limit_reached'
              ? 'usernameChangeLimitReached'
              : 'usernameUpdateFailed',
        );
      },
    });
  }

  usernameLimitReached(): boolean {
    return this.identity.profile()?.can_change_username === false;
  }
}
