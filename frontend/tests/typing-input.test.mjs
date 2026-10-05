import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/app/features/typing-game/components/typing-input/input-keys.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { inputKeys } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

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
