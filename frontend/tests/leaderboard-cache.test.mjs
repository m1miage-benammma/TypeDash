import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import * as rxjs from 'rxjs';

let requests = 0;
globalThis.__leaderboardRxjs = rxjs;
globalThis.__leaderboardInject = () => ({
  get: () => rxjs.defer(() => {
    requests += 1;
    return rxjs.of({ data: { average: [], top_speed: [] } });
  }),
});

const source = (await readFile(new URL(
  '../src/app/features/leaderboard/services/leaderboard-api.service.ts', import.meta.url,
), 'utf8'))
  .replace("import { inject, Injectable } from '@angular/core';", `
    const Injectable = () => target => target;
    const inject = globalThis.__leaderboardInject;`)
  .replace("import { HttpClient } from '@angular/common/http';", 'const HttpClient = {};')
  .replace(/import \{ ([^}]+) \} from 'rxjs';/, 'const { $1 } = globalThis.__leaderboardRxjs;')
  .replace(/import \{ environment \} from '[^']+';/, "const environment = { apiUrl: '/api' };")
  .replace(/^import .*;\r?\n/gm, '');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true },
}).outputText;
const { LeaderboardApiService } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

test('leaderboard is reused until an explicit profile refresh', async () => {
  const api = new LeaderboardApiService();
  await rxjs.firstValueFrom(api.get());
  await rxjs.firstValueFrom(api.get());
  assert.equal(requests, 1);
  await rxjs.firstValueFrom(api.get(true));
  assert.equal(requests, 2);
});
