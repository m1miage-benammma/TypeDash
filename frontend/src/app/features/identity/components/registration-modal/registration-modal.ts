import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { DeviceIdentityService } from '../../../../core/services/device-identity.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Icon } from '../../../../shared/components/icon/icon';

@Component({
  selector: 'td-registration-modal',
  imports: [Dialog, Icon],
  templateUrl: './registration-modal.html',
})
export class RegistrationModal {
  readonly registered = output<void>();
  readonly registering = signal(false);
  readonly usernameDraft = signal('');
  readonly usernameError = signal<'usernameInvalid' | 'usernameTaken' | 'registrationFailed' | null>(null);
  private readonly identity = inject(DeviceIdentityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.t.bind(this.i18n);

  validateUsername(event: Event): void {
    const username = (event.target as HTMLInputElement).value;
    this.usernameDraft.set(username);
    this.usernameError.set(null);
  }

  registerUsername(): void {
    if (this.registering()) return;
    const username = this.usernameDraft();
    this.registering.set(true);
    this.usernameError.set(null);
    this.identity.register(username).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.registering.set(false)),
    ).subscribe({
      next: () => this.registered.emit(),
      error: (error: HttpErrorResponse) => {
        this.usernameError.set(
          error.error?.error?.code === 'invalid_username' ? 'usernameInvalid'
            : error.error?.error?.code === 'username_taken' ? 'usernameTaken' : 'registrationFailed',
        );
      },
    });
  }
}
