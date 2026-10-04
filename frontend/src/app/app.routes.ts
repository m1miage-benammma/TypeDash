import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layouts/app-shell/app-shell').then(m => m.AppShell),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/typing-game/pages/typing-page').then(m => m.TypingPage),
      },
      {
        path: 'progress',
        loadComponent: () => import('./features/progress/pages/progress-page').then(m => m.ProgressPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
