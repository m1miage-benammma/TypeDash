import { TestOptions } from '../models/test-options';

export type PrepareTestRequest = Partial<Omit<TestOptions, 'duration'>> & {
  duration?: number | string;
  word_by_word?: boolean;
};

export interface TypingBatchRequest {
  device_id: string;
  inputs: { key: string; sequence: number; word_by_word: boolean }[];
}
