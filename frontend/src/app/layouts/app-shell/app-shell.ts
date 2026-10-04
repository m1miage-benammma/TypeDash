import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, finalize } from 'rxjs';

import { LocalizedPageId, localizedPath } from '../../core/seo/localized-routes';
import { SeoPage } from '../../core/seo/seo-pages';
import { SeoService } from '../../core/seo/seo.service';
import { I18nService } from '../../core/services/i18n.service';
import { DeviceIdentityService } from '../../core/services/device-identity.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { isValidUsername, normalizeUsername } from '../../core/validation/username';
import { Language } from '../../features/typing-game/models/typing-test';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'td-app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShell {
  @ViewChild('usernameInput') usernameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('mobileMenuRoot') mobileMenuRoot?: ElementRef<HTMLElement>;

  readonly preferences = inject(PreferencesService);
  readonly identity = inject(DeviceIdentityService);
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.t.bind(this.i18n);
  readonly usernameModal = signal(false);
  readonly usernameDraft = signal('');
  readonly usernameError = signal<'usernameInvalid' | 'usernameTaken' | 'usernameChangeLimitReached' | 'usernameUpdateFailed' | null>(null);
  readonly updatingUsername = signal(false);
  readonly mobileMenuOpen = signal(false);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly currentPage = signal<LocalizedPageId>('typingTest');

  constructor() {
    this.applyRouteContext();
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => this.applyRouteContext());
  }

  setLanguage(language: Language): void {
    this.preferences.setLanguage(language);
    this.closeMobileMenu();
    void this.router.navigateByUrl(localizedPath(this.currentPage(), language));
  }

  routeFor(page: LocalizedPageId): string {
    return localizedPath(page, this.preferences.language());
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(open => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event.target'])
  closeMobileMenuOnOutsideClick(target: EventTarget | null): void {
    if (
      this.mobileMenuOpen()
      && target instanceof Node
      && !this.mobileMenuRoot?.nativeElement.contains(target)
    ) {
      this.closeMobileMenu();
    }
  }

  @HostListener('document:keydown.escape')
  closeMobileMenuOnEscape(): void {
    this.closeMobileMenu();
  }

  openUsernameModal(): void {
    this.usernameDraft.set(this.identity.profile()?.username ?? '');
    this.usernameError.set(this.usernameLimitReached() ? 'usernameChangeLimitReached' : null);
    this.usernameModal.set(true);
    if (!this.usernameLimitReached()) {
      setTimeout(() => this.usernameInput?.nativeElement.focus());
    }
  }

  closeUsernameModal(): void {
    if (!this.updatingUsername()) this.usernameModal.set(false);
  }

  validateUsername(event: Event): void {
    if (this.usernameLimitReached()) return;
    const username = (event.target as HTMLInputElement).value;
    this.usernameDraft.set(username);
    this.usernameError.set(isValidUsername(username) ? null : 'usernameInvalid');
  }

  saveUsername(): void {
    if (this.usernameLimitReached()) {
      this.usernameError.set('usernameChangeLimitReached');
      return;
    }
    const username = normalizeUsername(this.usernameDraft());
    if (!isValidUsername(username)) {
      this.usernameError.set('usernameInvalid');
      return;
    }

    this.usernameError.set(null);
    this.updatingUsername.set(true);
    this.identity.updateUsername(username).pipe(
      finalize(() => this.updatingUsername.set(false)),
    ).subscribe({
      next: () => this.usernameModal.set(false),
      error: (error: HttpErrorResponse) => {
        const code = error.error?.error?.code;
        this.usernameError.set(
          code === 'username_taken'
            ? 'usernameTaken'
            : code === 'username_change_limit_reached'
              ? 'usernameChangeLimitReached'
              : 'usernameUpdateFailed',
        );
      },
    });
  }

  usernameLimitReached(): boolean {
    return this.identity.profile()?.username_changes_remaining === 0;
  }

  private applyRouteContext(): void {
    let activeRoute = this.route.snapshot;
    while (activeRoute.firstChild) activeRoute = activeRoute.firstChild;

    const pageId = activeRoute.data['pageId'] as LocalizedPageId | undefined;
    const language = activeRoute.data['language'] as Language | undefined;
    const seoPage = activeRoute.data['seo'] as SeoPage | undefined;

    if (pageId) this.currentPage.set(pageId);
    if (language && this.preferences.language() !== language) this.preferences.setLanguage(language);
    if (seoPage) this.seo.apply(seoPage);
  }
}
