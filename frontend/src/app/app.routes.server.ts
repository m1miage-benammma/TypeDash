import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'en/typing-test', renderMode: RenderMode.Prerender },
  { path: 'fr/test-de-frappe', renderMode: RenderMode.Prerender },
  { path: 'en/typing-speed-guide', renderMode: RenderMode.Prerender },
  { path: 'fr/guide-vitesse-frappe', renderMode: RenderMode.Prerender },
  { path: 'en/improve-typing-accuracy', renderMode: RenderMode.Prerender },
  { path: 'fr/ameliorer-precision-frappe', renderMode: RenderMode.Prerender },
  { path: 'en/wpm-calculator', renderMode: RenderMode.Prerender },
  { path: 'fr/calculateur-mpm', renderMode: RenderMode.Prerender },
  { path: 'en/typing-test-for-programmers', renderMode: RenderMode.Prerender },
  { path: 'fr/test-frappe-programmeurs', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
