import { PublicPageId } from '../../../core/seo/seo-pages';

export type ContentPageId = Exclude<PublicPageId, 'typingTest'>;

export interface ContentSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface ContentPage {
  eyebrow: string;
  title: string;
  summary: string;
  sections: ContentSection[];
  ctaTitle: string;
  ctaText: string;
  ctaLabel: string;
}
