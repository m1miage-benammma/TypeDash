import { inject, Injectable } from '@angular/core';

import en from '../i18n/en.json';
import fr from '../i18n/fr.json';
import { Language } from '../../features/typing-game/models/typing-test';
import { PreferencesService } from './preferences.service';

export type TranslationKey = keyof typeof en;

const translations: Record<Language, Record<TranslationKey, string>> = { en, fr };

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly preferences = inject(PreferencesService);

  t(key: TranslationKey): string {
    return translations[this.preferences.language()][key];
  }
}
