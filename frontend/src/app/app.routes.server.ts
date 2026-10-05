import { RenderMode, ServerRoute } from '@angular/ssr';
import { PAGE_PATHS } from './core/seo/page-routes';

export const serverRoutes: ServerRoute[] = [
  ...Object.values(PAGE_PATHS)
    .map(path => ({ path: path.slice(1), renderMode: RenderMode.Prerender as const })),
  { path: '**', renderMode: RenderMode.Client },
];
