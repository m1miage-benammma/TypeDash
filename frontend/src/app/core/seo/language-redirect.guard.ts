import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { PreferencesService } from '../services/preferences.service';
import { localizedPath } from './localized-routes';

export const languageRedirectGuard: CanActivateFn = () => {
  const preferences = inject(PreferencesService);
  const router = inject(Router);

  return router.parseUrl(localizedPath('typingTest', preferences.language()));
};
