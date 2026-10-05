import { afterNextRender, Component, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { privateSeo, publicSeo, SeoPage } from '../../core/seo/seo-pages';
import { SeoService } from '../../core/seo/seo.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ChangeUsernameModal } from '../../features/identity/components/change-username-modal/change-username-modal';
import { Header } from '../header/header';
import { Footer } from '../footer/footer';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { AnalyticsConsent } from '../../shared/components/analytics-consent/analytics-consent';

@Component({
  selector: 'td-app-shell',
  imports: [RouterOutlet, Header, Footer, ChangeUsernameModal, AnalyticsConsent],
  templateUrl: './app-shell.html',
  host: { class: 'block' },
})
export class AppShell {
  readonly usernameModalOpen = signal(false);
  private readonly preferences = inject(PreferencesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly analytics = inject(AnalyticsService);

  private readonly routeSeo = signal<SeoPage | null>(null);

  constructor() {
    effect(() => {
      const page = this.routeSeo();
      const language = this.preferences.language();
      if (page) this.seo.apply(page.pageId === 'progress' ? privateSeo(language) : publicSeo(page.pageId, language));
    });
    afterNextRender(() => this.analytics.initialize());
    this.applyRouteContext();
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => this.applyRouteContext());
  }

  private applyRouteContext(): void {
    let activeRoute = this.route.snapshot;
    while (activeRoute.firstChild) activeRoute = activeRoute.firstChild;

    const seoPage = activeRoute.data['seo'] as SeoPage | undefined;

    if (seoPage) {
      this.routeSeo.set(seoPage);
      this.seo.apply(seoPage.pageId === 'progress' ? privateSeo(this.preferences.language())
        : publicSeo(seoPage.pageId, this.preferences.language()));
      this.analytics.viewPage(seoPage.path, seoPage.title);
    }
  }
}
