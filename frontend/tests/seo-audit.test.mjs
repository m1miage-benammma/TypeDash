import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { prepareStaticPages } from '../scripts/prepare-static-pages.mjs';

test('privacy preferences sit between the tagline and device notice', async () => {
  const html = await readFile(new URL('../src/app/layouts/footer/footer.html', import.meta.url), 'utf8');
  const tagline = html.indexOf("t('footer')");
  const settings = html.indexOf('analytics.openSettings()');
  const deviceNotice = html.indexOf("t('local')");
  assert.ok(tagline < settings && settings < deviceNotice);
  assert.equal(html.match(/analytics.openSettings\(\)/g).length, 1);
});

test('slashless pages retain their prerendered HTML without public index directories', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'typedash-static-audit-'));
  try {
    await mkdir(join(directory, 'typing-test'));
    await writeFile(join(directory, 'typing-test', 'index.html'), '<h1>Typing test</h1>');
    const rewrites = prepareStaticPages(directory, ['/', '/typing-test']);
    assert.deepEqual(rewrites, ['/typing-test /_pages/typing-test.html 200!']);
    assert.equal(await readFile(join(directory, '_pages', 'typing-test.html'), 'utf8'), '<h1>Typing test</h1>');
    assert.ok(!(await readdir(directory)).includes('typing-test'));
    assert.throws(() => prepareStaticPages(directory, ['/../outside']), /Unsupported/);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test('static relocation refuses directories with unrelated assets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'typedash-static-audit-'));
  try {
    await mkdir(join(directory, 'typing-test'));
    await writeFile(join(directory, 'typing-test', 'index.html'), 'keep');
    await writeFile(join(directory, 'typing-test', 'asset.svg'), 'keep too');
    assert.throws(() => prepareStaticPages(directory, ['/typing-test']), /Refusing/);
    assert.equal(await readFile(join(directory, 'typing-test', 'index.html'), 'utf8'), 'keep');
  } finally {
    await rm(directory, { recursive: true });
  }
});

test('application pages use truthful WebPage data without unsupported app ratings', async () => {
  const source = (await readFile(new URL('../src/app/core/seo/seo.service.ts', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '');
  const compiled = ts.transpileModule(`const Injectable = () => target => target;
    const SITE_ORIGIN = 'https://typedash.online';
    ` + source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const { SeoService } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  const script = {};
  const service = Object.create(SeoService.prototype);
  service.document = { head: { querySelector: () => script } };
  service.setStructuredData({
    pageType: 'application', language: 'en', title: 'Typing Test | TypeDash', description: 'Typing practice',
  }, 'https://typedash.online/typing-test');
  const graph = JSON.parse(script.textContent)['@graph'];
  assert.equal(graph[1]['@type'], 'WebPage');
  assert.equal(graph[1].url, 'https://typedash.online/typing-test');
  assert.ok(!('aggregateRating' in graph[1]));
  assert.ok(!('review' in graph[1]));
});

test('production domain cannot be overwritten by a Netlify deployment hostname', async () => {
  const script = await readFile(new URL('../scripts/build-netlify.mjs', import.meta.url), 'utf8');
  assert.match(script, /const siteOrigin = 'https:\/\/typedash.online'/);
  assert.doesNotMatch(script, /process.env.TYPEDASH_SITE_ORIGIN/);
  const workflow = await readFile(new URL('../../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(workflow, /vars.TYPEDASH_SITE_ORIGIN/);
  assert.match(workflow, /TYPEDASH_SITE_ORIGIN: https:\/\/typedash.online/);
});
