import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = (await readFile(new URL('../src/app/features/typing-game/services/typing-stream.service.ts', import.meta.url), 'utf8'))
  .replace("import { inject, Injectable } from '@angular/core';", `
    const Injectable = () => target => target;
    const inject = () => ({ post: () => ({ subscribe: ({ next }) => {
      next({ data: { ticket: 'short-lived-ticket' } }); return { unsubscribe() {} };
    } }) });`)
  .replace("import { HttpClient } from '@angular/common/http';", 'const HttpClient = {};')
  .replace(/import \{ environment \} from '[^']+';/, "const environment = { streamOrigin: 'https://backend.example' };");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true },
}).outputText;
const { TypingStreamService } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

class FakeSocket {
  static OPEN = 1;
  static instances = [];
  readyState = 1;
  sent = [];
  constructor(url) { this.url = url; FakeSocket.instances.push(this); }
  send(frame) { this.sent.push(JSON.parse(frame)); }
  close() { this.readyState = 3; this.onclose?.(); }
  frame(data) { this.onmessage?.({ data: JSON.stringify({ data }) }); }
}

function connect(context, initial) {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const originalSocket = globalThis.WebSocket;
  globalThis.WebSocket = FakeSocket;
  context.after(() => { globalThis.WebSocket = originalSocket; });
  const available = [], frames = [];
  const connection = new TypingStreamService().connect('test-id', 'device-id', false,
    frame => frames.push(frame), ready => available.push(ready), initial);
  context.after(() => connection.close());
  return { connection, available, frames, socket: FakeSocket.instances.at(-1) };
}

test('initial connection is not reported as an interruption and uses direct secure backend transport', context => {
  const { socket, available } = connect(context);
  assert.equal(socket.url.protocol, 'wss:');
  assert.equal(socket.url.host, 'backend.example');
  assert.equal(socket.url.searchParams.has('device_id'), false);
  assert.equal(socket.url.searchParams.has('ticket'), false);
  socket.onopen();
  assert.deepEqual(socket.sent.shift(), { ticket: 'short-lived-ticket' });
  assert.deepEqual(available, []);
  context.mock.timers.tick(10001);
  assert.deepEqual(available, []);
  socket.frame({ id: 'test-id', revision: -1, text: 'hello', view: { words: ['hello'] } });
  assert.deepEqual(available, [true]);
});

test('an actual interruption reconnects, preserves the prompt, and replays unacknowledged input', context => {
  const { socket, available, frames, connection } = connect(context);
  socket.frame({ id: 'test-id', revision: -1, text: 'hello', view: { words: ['hello'] } });
  assert.equal(connection.send([{ key: 'h', sequence: 0, wordByWord: false }]), true);
  socket.close();
  assert.deepEqual(available, [true, false]);
  assert.equal(connection.send([{ key: 'e', sequence: 1, wordByWord: false }]), false);
  context.mock.timers.tick(500);
  const restored = FakeSocket.instances.at(-1);
  restored.frame({ id: 'test-id', revision: -1, text: 'hello', view: { words: ['hello'] } });
  assert.equal(restored.sent[0].inputs[0].key, 'h');
  restored.frame({ id: 'test-id', revision: 0, typed: 'h', view: { active: true } });
  assert.equal(frames.at(-1).text, 'hello');
  assert.deepEqual(frames.at(-1).view.words, ['hello']);
  assert.deepEqual(available, [true, false, true]);
  socket.frame({ id: 'test-id', revision: 99, typed: 'stale', view: {} });
  assert.equal(frames.at(-1).typed, 'h');
});

test('intentional closure cancels reconnects and ignores late frames', context => {
  const { socket, frames, available, connection } = connect(context);
  const count = FakeSocket.instances.length;
  connection.close();
  socket.frame({ id: 'test-id', revision: 1, view: {} });
  context.mock.timers.tick(60001);
  assert.equal(FakeSocket.instances.length, count);
  assert.deepEqual(frames, []);
  assert.deepEqual(available, []);
});

test('compact first frames retain the already loaded prompt and options', context => {
  const initial = { id: 'test-id', text: 'hello', language: 'en', duration: 30,
    revision: -1, view: { words: ['hello'], durations: [15, 30, 60] } };
  const { socket, frames } = connect(context, initial);
  assert.equal(socket.url.searchParams.get('compact'), 'true');
  socket.frame({ id: 'test-id', revision: -1, remaining_seconds: 30, view: { active: false } });
  assert.equal(frames[0].text, 'hello');
  assert.equal(frames[0].language, 'en');
  assert.equal(frames[0].duration, 30);
  assert.deepEqual(frames[0].view.words, ['hello']);
});

test('duration changes reuse the current stream and survive connection startup', context => {
  const initial = { id: 'test-id', text: 'same words', language: 'en', duration: 30,
    revision: -1, view: { words: ['same words'], durations: [15, 30, 60] } };
  const { socket, connection, frames } = connect(context, initial);
  assert.equal(connection.setDuration(60), false);
  socket.onopen();
  socket.frame({ id: 'test-id', revision: -1, view: { active: false } });
  assert.deepEqual(socket.sent[1], { type: 'duration', device_id: 'device-id', duration: 60 });
  socket.frame({ id: 'test-id', revision: -1, duration: 60, remaining_seconds: 60,
    view: { active: false, custom_duration: false } });
  assert.equal(frames.at(-1).text, 'same words');
  assert.equal(frames.at(-1).duration, 60);
});
