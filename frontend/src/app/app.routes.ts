import { Routes } from '@angular/router';

import { homeSeo, privateSeo, publicSeo } from './core/seo/seo-pages';

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
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/content/pages/home-page').then(module => module.HomePage), data: { pageId: 'typingTest', seo: homeSeo } },

      { path: 'typing-test', loadComponent: typingTestPage, data: { pageId: 'typingTest', seo: publicSeo('typingTest', 'en') } },
      { path: 'typing-speed-guide', loadComponent: typingSpeedGuidePage, data: { pageId: 'typingSpeedGuide', seo: publicSeo('typingSpeedGuide', 'en') } },
      { path: 'improve-typing-accuracy', loadComponent: accuracyGuidePage, data: { pageId: 'accuracyGuide', seo: publicSeo('accuracyGuide', 'en') } },
      { path: 'wpm-calculator', loadComponent: wpmCalculatorPage, data: { pageId: 'wpmCalculator', seo: publicSeo('wpmCalculator', 'en') } },
      { path: 'typing-test-for-programmers', loadComponent: programmerTypingTestPage, data: { pageId: 'programmerTest', seo: publicSeo('programmerTest', 'en') } },
      { path: 'progress', loadComponent: progressPage, data: { pageId: 'progress', seo: privateSeo('en') } },

      { path: 'en/typing-test', pathMatch: 'full', redirectTo: 'typing-test' },
      { path: 'fr/test-de-frappe', pathMatch: 'full', redirectTo: 'typing-test' },
      { path: 'en/typing-speed-guide', pathMatch: 'full', redirectTo: 'typing-speed-guide' },
      { path: 'fr/guide-vitesse-frappe', pathMatch: 'full', redirectTo: 'typing-speed-guide' },
      { path: 'en/improve-typing-accuracy', pathMatch: 'full', redirectTo: 'improve-typing-accuracy' },
      { path: 'fr/ameliorer-precision-frappe', pathMatch: 'full', redirectTo: 'improve-typing-accuracy' },
      { path: 'en/wpm-calculator', pathMatch: 'full', redirectTo: 'wpm-calculator' },
      { path: 'fr/calculateur-mpm', pathMatch: 'full', redirectTo: 'wpm-calculator' },
      { path: 'en/typing-test-for-programmers', pathMatch: 'full', redirectTo: 'typing-test-for-programmers' },
      { path: 'fr/test-frappe-programmeurs', pathMatch: 'full', redirectTo: 'typing-test-for-programmers' },
      { path: 'en/progress', pathMatch: 'full', redirectTo: 'progress' },
      { path: 'fr/progres', pathMatch: 'full', redirectTo: 'progress' },
    ],
  },
  { path: '**', redirectTo: 'typing-test' },
];
