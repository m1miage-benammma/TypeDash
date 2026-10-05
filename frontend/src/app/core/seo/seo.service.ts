import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { SeoPage, SITE_ORIGIN, SOCIAL_IMAGE_PATH } from './seo-pages';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);

  apply(page: SeoPage): void {
    const canonicalUrl = SITE_ORIGIN + page.path;

    this.document.documentElement.lang = page.language;
    this.title.setTitle(page.title);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({ name: 'robots', content: page.robots ?? 'index,follow' });
    this.meta.updateTag({ property: 'og:site_name', content: 'TypeDash' });
    this.meta.updateTag({ property: 'og:type', content: page.pageType === 'article' ? 'article' : 'website' });
    this.meta.updateTag({ property: 'og:title', content: page.title });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:image', content: SITE_ORIGIN + SOCIAL_IMAGE_PATH });
    this.meta.updateTag({ property: 'og:locale', content: page.language === 'fr' ? 'fr_FR' : 'en_US' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: page.title });
    this.meta.updateTag({ name: 'twitter:description', content: page.description });
    this.meta.updateTag({ name: 'twitter:image', content: SITE_ORIGIN + SOCIAL_IMAGE_PATH });

    this.setLink('canonical', canonicalUrl);
    this.document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(link => link.remove());
    this.setStructuredData(page, canonicalUrl);
  }

  private setLink(rel: string, href: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]:not([hreflang])`);
    if (!link) {
      link = this.document.createElement('link');
      link.rel = rel;
      this.document.head.appendChild(link);
    }
    link.href = href;
  }

  private setStructuredData(page: SeoPage, canonicalUrl: string): void {
    let script = this.document.head.querySelector<HTMLScriptElement>('#typedash-structured-data');
    if (!script) {
      script = this.document.createElement('script');
      script.id = 'typedash-structured-data';
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }

    const website = {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      url: SITE_ORIGIN,
      name: 'TypeDash',
      inLanguage: ['en', 'fr'],
    };
    const pageSchema = {
      '@type': page.pageType === 'article' ? 'Article' : 'WebPage',
      '@id': canonicalUrl + '#page',
      name: page.title.split('|')[0].trim(),
      headline: page.title.split('|')[0].trim(),
      url: canonicalUrl,
      description: page.description,
      inLanguage: page.language,
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
    };

    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [website, pageSchema],
    });
  }
}
