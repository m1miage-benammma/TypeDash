import { TestOptions } from '../models/test-options';
import { TestResult, TypingView } from './typing-test.response';

export interface SessionResultResponse extends TestOptions {
  id: string;
  result: TestResult | null;
  view: Pick<TypingView, 'result_chart'>;
}
