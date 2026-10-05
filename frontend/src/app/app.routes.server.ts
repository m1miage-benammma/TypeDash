import { RenderMode, ServerRoute } from '@angular/ssr';
import { LOCALIZED_PATHS } from './core/seo/localized-routes';

export const serverRoutes: ServerRoute[] = [
  ...Object.values(LOCALIZED_PATHS).flatMap(paths => Object.entries(paths)
    .filter(([page]) => page !== 'progress')
    .map(([, path]) => ({ path: path.slice(1), renderMode: RenderMode.Prerender as const }))),
  { path: '**', renderMode: RenderMode.Client },
];
