import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { Language } from '../models/language';
import { TestOptions } from '../../features/typing-game/models/typing-test';

export function readLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
export function writeLocal(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing may restrict storage. */ }
}

function initialLanguage(): Language {
  const saved = readLocal<unknown>('typedash.language', null);
  if (saved === 'fr' || saved === 'en') return saved;
  const browserLanguage = typeof navigator === 'undefined' ? 'en' : navigator.language.toLowerCase();
  return browserLanguage === 'fr' || browserLanguage.startsWith('fr-') ? 'fr' : 'en';
}

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly document = inject(DOCUMENT);
  readonly language = signal<Language>(initialLanguage());
  readonly dark = signal(readLocal<boolean>('typedash.dark', false) === true);
  readonly singleLine = signal(readLocal<boolean>('typedash.single-line', false) === true);
  constructor() { this.apply(); }
  setLanguage(language: Language): void {
    this.language.set(language); writeLocal('typedash.language', language); this.apply();
  }
  toggleTheme(): void {
    this.dark.update(v => !v); writeLocal('typedash.dark', this.dark()); this.apply();
  }
  setLineMode(singleLine: boolean): void {
    this.singleLine.set(singleLine); writeLocal('typedash.single-line', singleLine);
  }
  loadOptions(): Partial<TestOptions> {
    return readLocal<Partial<TestOptions>>('typedash.options', {});
  }
  private apply(): void {
    const dark = this.dark();
    this.document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    this.document.documentElement.lang = this.language();
    const favicon = this.document.getElementById('app-favicon') as HTMLLinkElement | null;
    if (favicon) favicon.href = dark ? 'typedash-logo-dark.svg' : 'typedash-logo.svg';
  }
}
