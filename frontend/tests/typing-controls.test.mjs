import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function compile(path, prelude) {
  const source = (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '');
  const compiled = ts.transpileModule(prelude + '\n' + source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

const { TypingGame } = await compile('../src/app/features/typing-game/components/typing-game/typing-game.ts', `
const Component = () => target => target;
const ViewChild = () => () => {};
const writeLocal = () => {};
const DecimalPipe = 0, Icon = 0, RegistrationModal = 0, ConfirmationModal = 0,
  TypingInputComponent = 0, SessionResults = 0;
`);

function controls() {
  const game = Object.create(TypingGame.prototype);
  let selection = { language: 'en', duration: 15, difficulty: 'easy', punctuation: false, numbers: false };
  game.options = () => selection;
  game.options.set = value => { selection = value; };
  game.preferences = { language: () => 'en' };
  game.clearActive = () => {};
  game.singleLineMode = () => false;
  let session = {
    id: 'same-session', text: 'same words', duration: 15, remaining_seconds: 15,
    view: { durations: [15, 30, 60], custom_duration: false },
  };
  game.test = () => session;
  game.test.set = value => { session = value; };
  game.locked = () => false;
  game.durations = () => [15, 30, 60];
  game.receivedAt = { set() {} };
  game.durationError = { set() {} };
  game.customOpen = { set() {} };
  game.focusInput = () => {};
  game.durationFrames = [];
  game.connection = { setDuration: value => game.durationFrames.push(value) };
  game.loading = { set: value => { game.pending = value; } };
  game.requests = [];
  game.prepareRequests = { next: value => game.requests.push(value) };
  return game;
}

test('duration selection preserves the session and words without preparing again', () => {
  const game = controls();
  game.setDuration(30);
  assert.equal(game.options().duration, 30);
  assert.equal(game.test().id, 'same-session');
  assert.equal(game.test().text, 'same words');
  assert.equal(game.test().remaining_seconds, 30);
  assert.deepEqual(game.durationFrames, [30]);
  assert.deepEqual(game.requests, []);
});

test('rapid controls merge with the latest selection rather than old confirmed state', () => {
  const game = controls();
  game.setDuration(60);
  game.toggleOption('punctuation');
  game.toggleOption('numbers');
  assert.equal(game.options().duration, 60);
  assert.equal(game.options().punctuation, true);
  assert.equal(game.options().numbers, true);
  game.toggleOption('punctuation');
  assert.equal(game.options().punctuation, false);
  assert.equal(game.requests.at(-1).duration, 60);
});

test('language selection keeps pending timer and difficulty settings', () => {
  const game = controls();
  game.setDuration(30);
  game.setDifficulty({ target: { value: 'hard' } });
  game.preferences.language = () => 'fr';
  game.prepare({ language: 'fr' });
  assert.equal(game.options().language, 'fr');
  assert.equal(game.options().duration, 30);
  assert.equal(game.options().difficulty, 'hard');
});
