import { PromptWord, TypingInput, TypingTest } from '../../models/typing-test';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const characters = (value: string): string[] =>
  Array.from(segmenter.segment(value.normalize('NFC')), part => part.segment);

// Presentation-only prediction. Never used for scores, persistence or validation.
export function previewWords(test: TypingTest, pending: TypingInput[], singleLine: boolean): PromptWord[] {
  if (!pending.length) return test.view.words;
  const expected = characters(test.text);
  let actual = characters(test.typed);
  let autoSeparator = test.auto_inserted_separator ?? false;
  let mode = test.input_word_by_word ?? false;
  for (const input of pending) {
    if (mode !== input.wordByWord) autoSeparator = false;
    mode = input.wordByWord;
    if (input.key === 'Backspace') {
      actual.pop();
      autoSeparator = false;
    } else if (characters(input.key).length === 1) {
      if (mode && input.key === ' ' && autoSeparator) {
        autoSeparator = false;
        continue;
      }
      let end = expected.length;
      let cursor = 0;
      for (const word of test.text.split(' ')) {
        end = cursor + characters(word).length;
        if (end >= actual.length) break;
        cursor = end + 1;
      }
      const separator = end < expected.length;
      if (mode && input.key === ' ') {
        actual.push(...Array(Math.max(0, end - actual.length)).fill('\ufffd'));
        if (separator) actual.push(' ');
        autoSeparator = false;
      } else {
        actual.push(input.key);
        autoSeparator = mode && separator && actual.length >= end;
        if (autoSeparator) actual.push(' ');
      }
      actual = characters(actual.join('')).slice(0, expected.length);
    }
  }
  let cursor = 0;
  const source = test.text.split(' ');
  const words: PromptWord[] = source.map((word, index) => ({
    index,
    chars: characters(word + (index < source.length - 1 ? ' ' : '')).map(value => {
      const position = cursor++;
      return {
        index: position, value, current: position === actual.length,
        correct: position < actual.length && actual[position] === value,
        incorrect: position < actual.length && actual[position] !== value,
        space: value === ' ',
      };
    }),
  }));
  return singleLine ? [words.find(word => word.chars.some(char => char.current)) ?? words[words.length - 1]] : words;
}
