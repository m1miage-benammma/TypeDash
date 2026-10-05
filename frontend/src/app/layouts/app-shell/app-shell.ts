import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { LocalizedPageId } from '../../core/seo/localized-routes';
import { SeoPage } from '../../core/seo/seo-pages';
import { SeoService } from '../../core/seo/seo.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ChangeUsernameModal } from '../../features/identity/components/change-username-modal/change-username-modal';
import { Language } from '../../core/models/language';
import { Header } from '../header/header';
import { Footer } from '../footer/footer';

@Component({
  selector: 'td-app-shell',
  imports: [RouterOutlet, Header, Footer, ChangeUsernameModal],
  templateUrl: './app-shell.html',
  host: { class: 'block' },
})
export class AppShell {
  readonly usernameModalOpen = signal(false);
  readonly currentPage = signal<LocalizedPageId>('typingTest');
  private readonly preferences = inject(PreferencesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  constructor() {
    this.applyRouteContext();
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => this.applyRouteContext());
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
