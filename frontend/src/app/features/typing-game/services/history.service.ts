import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HistoryEntry, TypingTest } from '../models/typing-test';
import { readLocal, writeLocal } from '../../../core/services/preferences.service';

export function median(values: number[]): number {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return 0;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly entries = new BehaviorSubject<HistoryEntry[]>(this.load());
  readonly history$ = this.entries.asObservable();
  get current(): HistoryEntry[] { return this.entries.value; }

  add(test: TypingTest): void {
    if (!test.result) return;
    const { id, difficulty, duration, language, punctuation, numbers } = test;
    const next = [
      { id, difficulty, duration, language, punctuation, numbers, ...test.result },
      ...this.current.filter(entry => entry.id !== id),
    ].slice(0, 30);
    this.entries.next(next);
    writeLocal('typedash.history', next);
  }

  clear(): void {
    this.entries.next([]);
    writeLocal('typedash.history', []);
  }

  private load(): HistoryEntry[] {
    const stored = readLocal<unknown>('typedash.history', []);
    if (!Array.isArray(stored)) return [];
    return stored
      .filter(entry => entry && typeof entry.id === 'string'
        && Number.isFinite(entry.wpm) && entry.wpm >= 0
        && Number.isFinite(entry.accuracy) && entry.accuracy >= 0 && entry.accuracy <= 100
        && Number.isFinite(entry.completed_words) && entry.completed_words >= 0
        && ['easy', 'medium', 'hard'].includes(entry.difficulty)
        && ['en', 'fr'].includes(entry.language)
        && Number.isInteger(entry.duration) && entry.duration >= 1 && entry.duration <= 300
        && Number.isFinite(Date.parse(entry.finished_at)))
      .slice(0, 30)
      .map(entry => ({
        ...entry,
        punctuation: entry.punctuation === true,
        numbers: entry.numbers === true,
      }));
  }
}
