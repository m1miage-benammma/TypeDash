import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

const { previewWords } = await loadTypeScript(
  '../src/app/features/typing-game/components/typing-game/typing-preview.ts', import.meta.url);

const session = (text, typed = '', language = 'fr') => ({
  text, typed, language, view: { words: [] }, auto_inserted_separator: false, input_word_by_word: false,
});
const inputs = (keys, wordByWord = false) => keys.map((key, sequence) => ({ key, sequence, wordByWord }));
const chars = (state, pending = [], singleLine = false) =>
  previewWords(state, pending, singleLine, true).flatMap(word => word.chars);

test('oe and native œ render correctly without shifting following characters', () => {
  for (const typed of ['coeur soeur', 'cœur sœur', 'coeur sœur', 'cœur soeur']) {
    const rendered = chars(session('cœur sœur', typed));
    assert.ok(rendered.every(char => char.correct));
    assert.ok(rendered.every(char => !char.incorrect));
  }
});

test('partial o keeps the caret on œ and does not flash an error', () => {
  const rendered = chars(session('cœur'), inputs(['c', 'o']));
  assert.equal(rendered.find(char => char.current).value, 'œ');
  assert.ok(rendered.every(char => !char.incorrect));
  assert.equal(rendered[0].correct, true);
});

test('backspace deletes e and o separately and remains aligned after acknowledgements', () => {
  let rendered = chars(session('cœur', 'coe'), inputs(['Backspace']));
  assert.equal(rendered.find(char => char.current).value, 'œ');
  assert.ok(rendered.every(char => !char.incorrect));
  rendered = chars(session('cœur', 'co'), inputs(['Backspace', 'œ', 'u', 'r']));
  assert.ok(rendered.every(char => char.correct));
});

test('word-by-word mode waits for e before completing a final ligature', () => {
  let rendered = chars(session('œ sœur'), inputs(['o'], true), true);
  assert.equal(rendered.find(char => char.current).value, 'œ');
  assert.equal(rendered[0].index, 0);
  rendered = chars(session('œ sœur'), inputs(['o', 'e', ' ', 's', 'o', 'e', 'u', 'r'], true));
  assert.ok(rendered.every(char => char.correct));
});

test('French uppercase ligatures preserve case and genuine mistakes stay red', () => {
  assert.ok(chars(session('ŒUVRE', 'OEUVRE')).every(char => char.correct));
  assert.equal(chars(session('cœur', 'cox'))[1].incorrect, true);
  assert.equal(chars(session('cœur', 'coeur', 'en'))[1].incorrect, true);
  assert.equal(chars(session('été', 'ete'))[0].incorrect, true);
});
