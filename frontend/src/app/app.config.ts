import { ApplicationConfig } from '@angular/core';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { TypingRouteReuseStrategy } from './core/seo/typing-route-reuse.strategy';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), { provide: RouteReuseStrategy, useClass: TypingRouteReuseStrategy },
    provideHttpClient(withFetch()), provideClientHydration(withEventReplay())]
};
