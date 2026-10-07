import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import * as rxjs from 'rxjs';

let http;
globalThis.__typingCacheRxjs = rxjs;
globalThis.__typingCacheInject = () => http;

const source = (await readFile(new URL(
  '../src/app/features/typing-game/services/typing-api.service.ts', import.meta.url,
), 'utf8'))
  .replace("import { inject, Injectable } from '@angular/core';", `
    const Injectable = () => target => target;
    const inject = globalThis.__typingCacheInject;`)
  .replace("import { HttpClient } from '@angular/common/http';", 'const HttpClient = {};')
  .replace(/import \{ ([^}]+) \} from 'rxjs';/, 'const { $1 } = globalThis.__typingCacheRxjs;')
  .replace(/import \{ environment \} from '[^']+';/, "const environment = { apiUrl: '/api' };")
  .replace(/^import .*;\r?\n/gm, '');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    experimentalDecorators: true,
  },
}).outputText;
const { TypingApiService } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

function session(id, difficulty = 'easy', duration = 30) {
  return {
    id, text: `${difficulty} cached words`, status: 'ready', started_at: null,
    typed: '', revision: -1, observed_at: '2026-10-07T00:00:00Z',
    remaining_seconds: duration, pause_after_seconds: 1.2, result: null,
    punctuation: false, numbers: false, difficulty, language: 'en', duration,
    view: { words: [], active: false, can_type: true, can_configure: true,
      custom_duration: false, durations: [15, 30, 60], result_chart: [] },
  };
}

function service() {
  let posts = 0;
  let gets = 0;
  http = {
    post: (_url, body) => rxjs.of({
      data: session(`post-${++posts}`, body.difficulty, Number(body.duration)),
    }),
    get: () => { gets += 1; return rxjs.of({ data: session('remote') }); },
  };
  return { api: new TypingApiService(), posts: () => posts, gets: () => gets };
}

test('word pools are cached by difficulty while duration reuses the same words', async () => {
  const { api, posts } = service();
  const easy = await rxjs.firstValueFrom(api.prepare({
    language: 'en', difficulty: 'easy', punctuation: false, numbers: false, duration: 30,
  }));
  const sameWords = await rxjs.firstValueFrom(api.prepare({
    language: 'en', difficulty: 'easy', punctuation: false, numbers: false, duration: 60,
  }));
  assert.equal(posts(), 1);
  assert.equal(sameWords.id, easy.id);

  const medium = await rxjs.firstValueFrom(api.prepare({
    language: 'en', difficulty: 'medium', punctuation: false, numbers: false, duration: 30,
  }));
  assert.equal(posts(), 2);
  assert.notEqual(medium.id, easy.id);

  const cachedEasy = await rxjs.firstValueFrom(api.prepare({
    language: 'en', difficulty: 'easy', punctuation: false, numbers: false, duration: 15,
  }));
  assert.equal(posts(), 2);
  assert.equal(cachedEasy.id, easy.id);
});

test('manual refresh bypasses the pool and navigation restores without a GET', async () => {
  const { api, posts, gets } = service();
  const first = await rxjs.firstValueFrom(api.prepare({ difficulty: 'easy' }));
  const refreshed = await rxjs.firstValueFrom(api.prepare({ difficulty: 'easy' }, true));
  assert.equal(posts(), 2);
  assert.notEqual(refreshed.id, first.id);

  const restored = await rxjs.firstValueFrom(api.get(refreshed.id, 'device', false));
  assert.equal(gets(), 0);
  assert.equal(restored.id, refreshed.id);
  assert.equal(api.current()?.id, refreshed.id);
});
