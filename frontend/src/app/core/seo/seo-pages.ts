import { Language } from '../models/language';
import { LOCALIZED_PATHS, LocalizedPageId } from './localized-routes';

// Replaced by Angular's build-time define; public configuration, never a secret.
declare const TYPEDASH_SITE_ORIGIN: string;
export const SITE_ORIGIN = typeof TYPEDASH_SITE_ORIGIN === 'undefined'
  ? 'https://typedash.online' : TYPEDASH_SITE_ORIGIN;
export const SOCIAL_IMAGE_PATH = '/typedash-social-card.svg';

export type PublicPageId = Exclude<LocalizedPageId, 'progress'>;

export interface SeoPage {
  pageId: LocalizedPageId;
  language: Language;
  path: string;
  title: string;
  description: string;
  pageType: 'application' | 'article' | 'private';
  robots?: 'index,follow' | 'noindex,follow';
}

type PublicSeoCopy = Record<PublicPageId, Pick<SeoPage, 'title' | 'description' | 'pageType'>>;

const copy: Record<Language, PublicSeoCopy> = {
  en: {
    typingTest: {
      title: 'Free Typing Test — Speed and Accuracy | TypeDash',
      description: 'Take a free English typing test, measure WPM and accuracy, and practise with punctuation, numbers and focused word-by-word modes.',
      pageType: 'application',
    },
    typingSpeedGuide: {
      title: 'How to Type Faster: A Practical Guide | TypeDash',
      description: 'Build typing speed with correct technique, deliberate practice, realistic goals and a repeatable training plan that protects accuracy.',
      pageType: 'article',
    },
    accuracyGuide: {
      title: 'How to Improve Typing Accuracy | TypeDash',
      description: 'Reduce typing errors through rhythm, posture, targeted drills and useful accuracy metrics before increasing your typing speed.',
      pageType: 'article',
    },
    wpmCalculator: {
      title: 'WPM Calculator — Words Per Minute | TypeDash',
      description: 'Calculate gross and adjusted typing speed, accuracy and words per minute using characters typed, elapsed time and errors.',
      pageType: 'application',
    },
    programmerTest: {
      title: 'Typing Test for Programmers | TypeDash',
      description: 'Practise typing code-oriented text, punctuation, symbols and technical vocabulary while improving accuracy and sustainable speed.',
      pageType: 'article',
    },
  },
  fr: {
    typingTest: {
      title: 'Test de frappe gratuit — Vitesse et précision | TypeDash',
      description: 'Passez un test de frappe en français, mesurez vos MPM et votre précision, puis entraînez-vous avec ponctuation, nombres et mode mot par mot.',
      pageType: 'application',
    },
    typingSpeedGuide: {
      title: 'Comment taper plus vite : guide pratique | TypeDash',
      description: 'Améliorez votre vitesse de frappe avec une bonne technique, des exercices ciblés, des objectifs réalistes et un plan régulier.',
      pageType: 'article',
    },
    accuracyGuide: {
      title: 'Comment améliorer sa précision de frappe | TypeDash',
      description: 'Réduisez vos erreurs grâce au rythme, à la posture, aux exercices ciblés et à des mesures utiles avant d’accélérer votre frappe.',
      pageType: 'article',
    },
    wpmCalculator: {
      title: 'Calculateur MPM — Mots par minute | TypeDash',
      description: 'Calculez votre vitesse brute et corrigée, votre précision et vos mots par minute à partir des caractères, du temps et des erreurs.',
      pageType: 'application',
    },
    programmerTest: {
      title: 'Test de frappe pour programmeurs | TypeDash',
      description: 'Entraînez-vous sur du vocabulaire technique, de la ponctuation et des symboles de code tout en améliorant précision et vitesse.',
      pageType: 'article',
    },
  },
};

export function publicSeo(pageId: PublicPageId, language: Language): SeoPage {
  return {
    pageId,
    language,
    path: LOCALIZED_PATHS[language][pageId],
    ...copy[language][pageId],
  };
}

export function privateSeo(language: Language): SeoPage {
  return {
    pageId: 'progress',
    language,
    path: LOCALIZED_PATHS[language].progress,
    title: language === 'fr' ? 'Mes progrès de frappe | TypeDash' : 'My Typing Progress | TypeDash',
    description: language === 'fr'
      ? 'Consultez les statistiques de frappe enregistrées pour cet appareil.'
      : 'Review the typing statistics saved for this device.',
    pageType: 'private',
    robots: 'noindex,follow',
  };
}
