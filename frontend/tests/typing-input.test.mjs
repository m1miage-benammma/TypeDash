import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

const { inputKeys } = await loadTypeScript('../src/app/features/typing-game/components/typing-input/input-keys.ts', import.meta.url);

test('native desktop and mobile input send characters and spaces once', () => {
  assert.deepEqual(inputKeys('insertText', 'a', ' a'), ['a']);
  assert.deepEqual(inputKeys('insertText', ' ', '  '), [' ']);
  assert.deepEqual(inputKeys('insertText', null, ' hello'), ['h', 'e', 'l', 'l', 'o']);
});

test('IME and accented text are normalized and segmented as graphemes', () => {
  assert.deepEqual(inputKeys('insertCompositionText', 'e\u0301', ' e\u0301'), ['é']);
  assert.deepEqual(inputKeys('insertCompositionText', null, ' 中文'), ['中', '文']);
});

test('backspace works with a native buffer even at the beginning', () => {
  assert.deepEqual(inputKeys('deleteContentBackward', null, ''), ['Backspace']);
});

test('paste and drag/drop never become typing input', () => {
  assert.deepEqual(inputKeys('insertFromPaste', 'hello', ' hello'), []);
  assert.deepEqual(inputKeys('insertFromDrop', 'hello', ' hello'), []);
});

test('line breaks map to the existing backend Enter key contract', () => {
  assert.deepEqual(inputKeys('insertLineBreak', null, ' \n'), ['Enter']);
  assert.deepEqual(inputKeys('historyUndo', null, ' '), []);
  assert.deepEqual(inputKeys('deleteContentForward', null, ''), []);
});
