import { PromptWord, TypingTest } from '../../responses/typing-test.response';
import { TypingInput } from '../../models/typing-input';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const characters = (value: string): string[] =>
  Array.from(segmenter.segment(value.normalize('NFC')), part => part.segment);
let cachedText = '';
let cachedExpected: string[] = [];

function promptCharacters(text: string): string[] {
  if (text !== cachedText) {
    cachedText = text;
    cachedExpected = characters(text);
  }
  return cachedExpected;
}

function align(expected: string[], raw: string[], language: string): { actual: string[]; partial: boolean } {
  if (language !== 'fr') return { actual: raw, partial: false };
  const actual: string[] = [];
  for (let index = 0; index < raw.length; index++) {
    const target = expected[actual.length];
    const expansion = target === 'œ' ? 'oe' : target === 'Œ' ? 'OE' : '';
    if (expansion && raw[index] === expansion[0]) {
      if (index + 1 === raw.length) return { actual: [...actual, raw[index]], partial: true };
      if (raw[index + 1] === expansion[1]) {
        actual.push(target);
        index++;
        continue;
      }
    }
    actual.push(raw[index]);
  }
  return { actual, partial: false };
}

// Presentation-only prediction. Never used for scores, persistence or validation.
export function previewWords(test: TypingTest, pending: TypingInput[], singleLine: boolean, renderSnapshot = false): PromptWord[] {
  if (!pending.length && !renderSnapshot) return test.view.words;
  const expected = promptCharacters(test.text);
  let raw = characters(test.typed);
  let { actual, partial } = align(expected, raw, test.language);
  let autoSeparator = test.auto_inserted_separator ?? false;
  let mode = test.input_word_by_word ?? false;
  for (const input of pending) {
    if (mode !== input.wordByWord) autoSeparator = false;
    mode = input.wordByWord;
    if (input.key === 'Backspace') {
      raw.pop();
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
        raw.push(...Array(Math.max(0, end - actual.length)).fill('\ufffd'));
        if (separator) raw.push(' ');
        autoSeparator = false;
      } else {
        raw.push(input.key);
        const next = align(expected, characters(raw.join('')), test.language);
        autoSeparator = mode && separator && next.actual.length >= end && !next.partial;
        if (autoSeparator) raw.push(' ');
      }
      raw = characters(raw.join(''));
      while (align(expected, raw, test.language).actual.length > expected.length) raw.pop();
    }
    ({ actual, partial } = align(expected, raw, test.language));
  }
  const caret = actual.length - Number(partial);
  let cursor = 0;
  const source = test.text.split(' ');
  const words: PromptWord[] = source.map((word, index) => ({
    index,
    chars: characters(word + (index < source.length - 1 ? ' ' : '')).map(value => {
      const position = cursor++;
      return {
        index: position, value, current: position === caret,
        correct: position < caret && actual[position] === value,
        incorrect: position < caret && actual[position] !== value,
        space: value === ' ',
      };
    }),
  }));
  return singleLine ? [words.find(word => word.chars.some(char => char.current)) ?? words[words.length - 1]] : words;
}
