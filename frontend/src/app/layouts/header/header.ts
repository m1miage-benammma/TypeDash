import { Component, ElementRef, HostListener, inject, input, output, signal, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { LocalizedPageId, localizedPath } from '../../core/seo/localized-routes';
import { I18nService } from '../../core/services/i18n.service';
import { DeviceIdentityService } from '../../core/services/device-identity.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { Language } from '../../core/models/language';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'td-header',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './header.html',
  styleUrl: './header.css',
  host: { class: 'block' },
})
export class Header {
  @ViewChild('mobileMenuRoot') mobileMenuRoot?: ElementRef<HTMLElement>;

  readonly currentPage = input.required<LocalizedPageId>();
  readonly usernameChangeRequested = output<void>();
  readonly preferences = inject(PreferencesService);
  readonly identity = inject(DeviceIdentityService);
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.t.bind(this.i18n);
  readonly mobileMenuOpen = signal(false);
  private readonly router = inject(Router);

  setLanguage(language: Language): void {
    const destination = localizedPath(this.currentPage(), language);
    if (this.preferences.language() === language && this.router.url === destination) return;
    this.preferences.setLanguage(language);
    this.closeMobileMenu();
    void this.router.navigateByUrl(destination);
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
    this.closeMobileMenu();
    this.usernameChangeRequested.emit();
  }
}
