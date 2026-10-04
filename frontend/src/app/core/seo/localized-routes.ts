import { Language } from '../../features/typing-game/models/typing-test';

export type LocalizedPageId =
  | 'typingTest'
  | 'typingSpeedGuide'
  | 'accuracyGuide'
  | 'wpmCalculator'
  | 'programmerTest'
  | 'progress';

export const LOCALIZED_PATHS: Record<Language, Record<LocalizedPageId, string>> = {
  en: {
    typingTest: '/en/typing-test',
    typingSpeedGuide: '/en/typing-speed-guide',
    accuracyGuide: '/en/improve-typing-accuracy',
    wpmCalculator: '/en/wpm-calculator',
    programmerTest: '/en/typing-test-for-programmers',
    progress: '/en/progress',
  },
  fr: {
    typingTest: '/fr/test-de-frappe',
    typingSpeedGuide: '/fr/guide-vitesse-frappe',
    accuracyGuide: '/fr/ameliorer-precision-frappe',
    wpmCalculator: '/fr/calculateur-mpm',
    programmerTest: '/fr/test-frappe-programmeurs',
    progress: '/fr/progres',
  },
};

export function localizedPath(page: LocalizedPageId, language: Language): string {
  return LOCALIZED_PATHS[language][page];
}
