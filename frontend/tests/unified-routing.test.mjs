import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

const { PAGE_PATHS, pagePath } = await loadTypeScript('../src/app/core/seo/page-routes.ts', import.meta.url);

test('all pages use one language-neutral path', () => {
  assert.equal(pagePath('typingTest'), '/typing-test');
  assert.equal(new Set(Object.values(PAGE_PATHS)).size, 6);
  for (const path of Object.values(PAGE_PATHS)) assert.doesNotMatch(path, /^\/(en|fr)\//);
});

test('the sitemap lists public canonical pages only', async () => {
  const xml = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.equal(urls.length, 6);
  assert.equal(new Set(urls).size, urls.length);
  for (const path of Object.values(PAGE_PATHS).filter(path => path !== '/progress')) {
    assert.ok(urls.includes('https://typedash.online' + path));
  }
  assert.doesNotMatch(xml, /hreflang|\/en\/|\/fr\/|\/progress/);
});

test('legacy URLs redirect directly to unified paths without loops', async () => {
  const script = await readFile(new URL('../scripts/build-netlify.mjs', import.meta.url), 'utf8');
  const legacy = JSON.parse(script.match(/const legacyPaths = (\{[\s\S]*?\});/)[1]);
  assert.equal(Object.keys(legacy).length, 12);
  for (const [from, to] of Object.entries(legacy)) {
    assert.match(from, /^\/(en|fr)\//);
    assert.ok(Object.values(PAGE_PATHS).includes(to));
    assert.notEqual(from, to);
    assert.equal(legacy[to], undefined);
  }
});
