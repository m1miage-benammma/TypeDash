import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

const { sessionChart } = await loadTypeScript('../src/app/features/typing-game/components/session-results/session-chart.ts', import.meta.url);

test('coordinates represent backend samples over the actual session duration', () => {
  const samples = [{ second: 1, wpm: 60, height_percent: 100 }, { second: 30, wpm: 50.4, height_percent: 84 }];
  const chart = sessionChart(samples, 30);
  assert.equal(chart.line, '33,0 1000,32');
  assert.equal(chart.area, '33,200 33,0 1000,32 1000,200');
  assert.equal(chart.points[1].wpm, 50.4);
  assert.equal(chart.maximum, 60);
});

test('short sessions display one point without inventing a line or area', () => {
  const chart = sessionChart([{ second: .5, wpm: 12, height_percent: 100 }], .5);
  assert.equal(chart.line, '1000,0');
  assert.equal(chart.area, '');
});

test('empty and zero-duration plots remain finite and inside their bounds', () => {
  assert.equal(sessionChart([], 0).line, '');
  const chart = sessionChart([{ second: 0, wpm: 0, height_percent: 0 }], 0);
  assert.equal(chart.line, '0,200');
  assert.equal(chart.maximum, 10);
});

test('chart rendering does not change server-provided samples', () => {
  const samples = [{ second: 15, wpm: 50.4, height_percent: 75 }];
  const original = structuredClone(samples);
  sessionChart(samples, 30);
  assert.deepEqual(samples, original);
});
