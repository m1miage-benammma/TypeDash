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
  game.loading = { set: value => { game.pending = value; } };
  game.requests = [];
  game.prepareRequests = { next: value => game.requests.push(value) };
  return game;
}

test('duration selection updates immediately without a backend response', () => {
  const game = controls();
  game.setDuration(30);
  assert.equal(game.options().duration, 30);
  assert.equal(game.pending, true);
  assert.equal(game.requests[0].duration, 30);
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

const { TypingRouteReuseStrategy } = await compile('../src/app/core/seo/typing-route-reuse.strategy.ts', `
const Injectable = () => target => target;
class BaseRouteReuseStrategy {
  shouldReuseRoute(future, current) { return future.routeConfig === current.routeConfig; }
}
`);

test('localized typing routes reuse the same component without another restoration request', () => {
  const strategy = new TypingRouteReuseStrategy();
  const route = (pageId, language) => ({ routeConfig: {}, data: { pageId, language } });
  assert.equal(strategy.shouldReuseRoute(route('typingTest', 'en'), route('typingTest', 'fr')), true);
  assert.equal(strategy.shouldReuseRoute(route('typingTest', 'en'), route('typingTest', undefined)), false);
  assert.equal(strategy.shouldReuseRoute(route('progress', 'en'), route('typingTest', 'en')), false);
  assert.equal(strategy.shouldReuseRoute(route('progress', 'en'), route('progress', 'fr')), false);
});
