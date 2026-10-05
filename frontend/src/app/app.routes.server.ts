import { RenderMode, ServerRoute } from '@angular/ssr';
import { PAGE_PATHS } from './core/seo/page-routes';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  ...Object.entries(PAGE_PATHS).filter(([page]) => page !== 'progress')
    .map(([, path]) => ({ path: path.slice(1), renderMode: RenderMode.Prerender as const })),
  { path: '**', renderMode: RenderMode.Client },
];
