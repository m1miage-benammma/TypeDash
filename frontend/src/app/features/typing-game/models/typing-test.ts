import { Language } from '../../../core/models/language';

export type Difficulty = 'easy' | 'medium' | 'hard';

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
  observed_at: string;
  remaining_seconds: number;
  pause_after_seconds: number;
  idle_timeout_seconds: number;
  metrics: Metrics;
  result: TestResult | null;
  view: TypingView;
  auto_inserted_separator?: boolean;
  input_word_by_word?: boolean;
}

export interface TypingInput {
  key: string;
  sequence: number;
  wordByWord: boolean;
}

export interface PromptWord {
  index: number;
  chars: {
    index: number; value: string; current: boolean;
    correct: boolean; incorrect: boolean; space: boolean;
  }[];
}

export interface TypingView {
  words: PromptWord[];
  clock: string;
  elapsed_percent: number;
  active: boolean;
  can_type: boolean;
  can_configure: boolean;
  urgent: boolean;
  custom_duration: boolean;
  durations: number[];
  result_chart: { second: number; wpm: number; height_percent: number }[];
}

export type PrepareTestRequest = Partial<Omit<TestOptions, 'duration'>> & {
  duration?: number | string;
  word_by_word?: boolean;
};
