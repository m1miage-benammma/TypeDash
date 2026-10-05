import { Language } from '../../../core/models/language';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface TestOptions {
  punctuation: boolean;
  numbers: boolean;
  difficulty: Difficulty;
  language: Language;
  duration: number;
}
