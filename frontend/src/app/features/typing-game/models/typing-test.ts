export type Difficulty = 'easy' | 'medium' | 'hard';
export type Language = 'en' | 'fr';

export interface TestOptions {
  punctuation: boolean;
  numbers: boolean;
  difficulty: Difficulty;
  language: Language;
  duration: number;
}

export interface Metrics {
  wpm: number;
  accuracy: number;
  correct_characters: number;
  incorrect_characters: number;
  typed_characters: number;
  completed_words: number;
  elapsed_seconds: number;
}

export interface TestResult extends Metrics {
  finished_at: string;
  samples: { second: number; wpm: number }[];
}

export interface TypingTest extends TestOptions {
  id: string;
  text: string;
  status: 'ready' | 'running' | 'paused' | 'finished';
  started_at: string | null;
  typed: string;
  revision: number;
  remaining_seconds: number;
  pause_after_seconds: number;
  idle_timeout_seconds: number;
  metrics: Metrics;
  result: TestResult | null;
}

export interface HistoryEntry extends TestOptions, TestResult {
  id: string;
}

export interface ApiResponse<T> {
  data: T;
}
