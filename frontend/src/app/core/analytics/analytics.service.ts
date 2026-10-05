import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

const MEASUREMENT_ID = 'G-R0C9JGSNQ8';
const CONSENT_KEY = 'typedash.analytics-consent.v1';
const CONSENT_LIFETIME = 180 * 24 * 60 * 60 * 1000;
const DENIED = { analytics_storage: 'denied', ad_storage: 'denied',
  ad_user_data: 'denied', ad_personalization: 'denied' };
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly document = inject(DOCUMENT);
  readonly settingsOpen = signal(false);
  private consent = false;
  private initialized = false;
  private configured = false;
  private page: { path: string; title: string } | null = null;
  private previousLocation = '';

  private get browser(): AnalyticsWindow | null {
    const browser = this.document.defaultView;
    return browser && ['typedash.online', 'www.typedash.online'].includes(browser.location.hostname)
      ? browser as AnalyticsWindow : null;
  }

  initialize(): void {
    const browser = this.browser;
    if (this.initialized || !browser) return;
    this.initialized = true;
    try {
      const saved: unknown = JSON.parse(browser.localStorage.getItem(CONSENT_KEY) || 'null');
      if (saved && typeof saved === 'object' && 'accepted' in saved && 'expires' in saved
        && typeof saved.accepted === 'boolean' && typeof saved.expires === 'number'
        && saved.expires > Date.now()) {
        this.consent = saved.accepted;
        if (this.consent) this.enable();
        return;
      }
    } catch { /* Storage can be unavailable; ask without blocking the application. */ }
    this.settingsOpen.set(true);
  }

  openSettings(): void {
    if (this.browser) this.settingsOpen.set(true);
  }

  choose(accepted: boolean): void {
    const browser = this.browser;
    if (!browser) return;
    try {
      browser.localStorage.setItem(CONSENT_KEY, JSON.stringify({ accepted,
        expires: Date.now() + CONSENT_LIFETIME }));
    } catch { /* Keep the choice for this page even if storage is unavailable. */ }
    const wasConfigured = this.configured;
    this.consent = accepted;
    this.settingsOpen.set(false);
    if (accepted) {
      this.enable();
    } else if (wasConfigured) {
      Reflect.set(browser, `ga-disable-${MEASUREMENT_ID}`, true);
      this.document.getElementById('typedash-google-tag')?.remove();
      this.deleteAnalyticsCookies();
      // Reload removes Google's runtime entirely; do not send denied-consent pings.
      browser.location.reload();
    }
  }

  viewPage(path: string, title: string): void {
    if (this.page?.path === path) return;
    this.page = { path, title };
    this.sendPage();
  }

  private enable(): void {
    const browser = this.browser;
    if (!browser || this.configured || !this.consent) return;
    this.configured = true;
    browser.dataLayer ??= [];
    browser.gtag = function () { browser.dataLayer!.push(arguments); };
    browser.gtag('consent', 'default', DENIED);
    browser.gtag('consent', 'update', { ...DENIED, analytics_storage: 'granted' });
    browser.gtag('js', new Date());
    browser.gtag('config', MEASUREMENT_ID, { send_page_view: false,
      page_location: browser.location.origin + (this.page?.path ?? browser.location.pathname),
      page_referrer: this.cleanReferrer(),
      allow_google_signals: false, allow_ad_personalization_signals: false });
    const script = this.document.createElement('script');
    script.id = 'typedash-google-tag';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    this.document.head.appendChild(script);
    this.sendPage();
  }

  private sendPage(): void {
    const browser = this.browser;
    if (!browser?.gtag || !this.configured || !this.consent || !this.page) return;
    const location = browser.location.origin + this.page.path;
    const referrer = this.previousLocation || this.cleanReferrer();
    browser.gtag('set', { page_location: location, page_title: this.page.title, page_referrer: referrer });
    browser.gtag('event', 'page_view', { send_to: MEASUREMENT_ID,
      page_location: location, page_title: this.page.title, page_referrer: referrer });
    this.previousLocation = location;
  }

  private deleteAnalyticsCookies(): void {
    for (const cookie of this.document.cookie.split(';')) {
      const name = cookie.trim().split('=')[0];
      if (name !== '_ga' && !name.startsWith('_ga_')) continue;
      for (const domain of ['', '; Domain=typedash.online', '; Domain=www.typedash.online']) {
        this.document.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax; Secure`;
      }
    }
  }

  private cleanReferrer(): string {
    if (!this.document.referrer) return '';
    try { const url = new URL(this.document.referrer); return url.origin + url.pathname; }
    catch { return ''; }
  }

  sessionEvent(name: 'typing_session_start' | 'typing_session_complete', options: {
    language: string; difficulty: string; duration: number;
  }): void {
    if (!this.consent || !this.configured) return;
    this.browser?.gtag?.('event', name, { send_to: MEASUREMENT_ID,
      test_language: options.language, difficulty: options.difficulty,
      duration_seconds: options.duration });
  }
}
