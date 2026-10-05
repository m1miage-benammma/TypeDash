import { Routes } from '@angular/router';

import { languageRedirectGuard } from './core/seo/language-redirect.guard';
import { privateSeo, publicSeo } from './core/seo/seo-pages';

const typingTestPage = () => import('./features/typing-game/pages/typing-test-page').then(module => module.TypingTestPage);
const progressPage = () => import('./features/progress/pages/progress-page').then(module => module.ProgressPage);
const typingSpeedGuidePage = () => import('./features/content/pages/typing-speed-guide-page').then(module => module.TypingSpeedGuidePage);
const accuracyGuidePage = () => import('./features/content/pages/accuracy-guide-page').then(module => module.AccuracyGuidePage);
const wpmCalculatorPage = () => import('./features/content/pages/wpm-calculator-page').then(module => module.WpmCalculatorPage);
const programmerTypingTestPage = () => import('./features/content/pages/programmer-typing-test-page').then(module => module.ProgrammerTypingTestPage);

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layouts/app-shell/app-shell').then(module => module.AppShell),
    children: [
      { path: '', pathMatch: 'full', canActivate: [languageRedirectGuard], loadComponent: typingTestPage },

      { path: 'en/typing-test', loadComponent: typingTestPage, data: { pageId: 'typingTest', language: 'en', seo: publicSeo('typingTest', 'en') } },
      { path: 'fr/test-de-frappe', loadComponent: typingTestPage, data: { pageId: 'typingTest', language: 'fr', seo: publicSeo('typingTest', 'fr') } },
      { path: 'en/progress', loadComponent: progressPage, data: { pageId: 'progress', language: 'en', seo: privateSeo('en') } },
      { path: 'fr/progres', loadComponent: progressPage, data: { pageId: 'progress', language: 'fr', seo: privateSeo('fr') } },

      { path: 'en/typing-speed-guide', loadComponent: typingSpeedGuidePage, data: { pageId: 'typingSpeedGuide', language: 'en', seo: publicSeo('typingSpeedGuide', 'en') } },
      { path: 'fr/guide-vitesse-frappe', loadComponent: typingSpeedGuidePage, data: { pageId: 'typingSpeedGuide', language: 'fr', seo: publicSeo('typingSpeedGuide', 'fr') } },
      { path: 'en/improve-typing-accuracy', loadComponent: accuracyGuidePage, data: { pageId: 'accuracyGuide', language: 'en', seo: publicSeo('accuracyGuide', 'en') } },
      { path: 'fr/ameliorer-precision-frappe', loadComponent: accuracyGuidePage, data: { pageId: 'accuracyGuide', language: 'fr', seo: publicSeo('accuracyGuide', 'fr') } },
      { path: 'en/wpm-calculator', loadComponent: wpmCalculatorPage, data: { pageId: 'wpmCalculator', language: 'en', seo: publicSeo('wpmCalculator', 'en') } },
      { path: 'fr/calculateur-mpm', loadComponent: wpmCalculatorPage, data: { pageId: 'wpmCalculator', language: 'fr', seo: publicSeo('wpmCalculator', 'fr') } },
      { path: 'en/typing-test-for-programmers', loadComponent: programmerTypingTestPage, data: { pageId: 'programmerTest', language: 'en', seo: publicSeo('programmerTest', 'en') } },
      { path: 'fr/test-frappe-programmeurs', loadComponent: programmerTypingTestPage, data: { pageId: 'programmerTest', language: 'fr', seo: publicSeo('programmerTest', 'fr') } },

      { path: 'typing-test', pathMatch: 'full', redirectTo: 'en/typing-test' },
      { path: 'typing-speed-guide', pathMatch: 'full', redirectTo: 'en/typing-speed-guide' },
      { path: 'improve-typing-accuracy', pathMatch: 'full', redirectTo: 'en/improve-typing-accuracy' },
      { path: 'wpm-calculator', pathMatch: 'full', redirectTo: 'en/wpm-calculator' },
      { path: 'typing-test-for-programmers', pathMatch: 'full', redirectTo: 'en/typing-test-for-programmers' },
      { path: 'progress', pathMatch: 'full', redirectTo: 'en/progress' },
    ],
  },
  { path: '**', redirectTo: 'en/typing-test' },
];
