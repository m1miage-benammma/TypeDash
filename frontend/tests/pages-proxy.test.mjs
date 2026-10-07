import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../cloudflare/worker.mjs', import.meta.url), 'utf8'))
  .replace('__TYPEDASH_API_ORIGIN__', JSON.stringify('https://typedash-gkbn.onrender.com'));
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('Pages API proxy preserves method, body, origin, cookies and query without caching', async t => {
  t.mock.method(globalThis, 'fetch', async (request, options) => {
    assert.equal(request.url, 'https://typedash-gkbn.onrender.com/api/tests?compact=true');
    assert.equal(request.method, 'POST');
    assert.equal(await request.text(), '{"language":"fr"}');
    assert.equal(options.headers.get('origin'), 'https://typedash.online');
    assert.equal(options.headers.get('cookie'), '__Host-typedash-session=signed');
    assert.equal(options.headers.get('x-typedash-request'), '1');
    assert.equal(options.headers.get('x-forwarded-for'), null);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.cf.cacheTtl, 0);
    const response = new Response('{"data":{}}', {status:201});
    response.headers.append('Set-Cookie', 'a=1; Secure; HttpOnly');
    response.headers.append('Set-Cookie', 'b=2; Secure; HttpOnly');
    return response;
  });
  const response = await worker.fetch(new Request('http://localhost:8788/api/tests?compact=true', {
    method:'POST', body:'{"language":"fr"}', headers:{
      Origin:'https://typedash.online', Cookie:'__Host-typedash-session=signed',
      'X-Typedash-Request':'1', 'X-Forwarded-For':'spoofed',
    },
  }), {});
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.deepEqual(await response.json(), {data:{}});
});

test('Pages proxy fails closed with a private error when the backend is unavailable', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('private details'); });
  const response = await worker.fetch(new Request('https://typedash.online/api/session'), {});
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.doesNotMatch(await response.text(), /private details/);
});

test('non-API routes use the static asset binding and only API paths invoke Functions', async () => {
  const request = new Request('https://typedash.online/typing-speed-guide');
  const response = await worker.fetch(request, {ASSETS:{fetch:async value => {
    assert.equal(value, request);
    return new Response('<h1>Guide</h1>');
  }}});
  assert.match(await response.text(), /Guide/);
  const script = await readFile(new URL('../scripts/build-pages.mjs', import.meta.url), 'utf8');
  assert.match(script, /include: \['\/api\/\*'\]/);
  assert.doesNotMatch(script, /\/api\/\*.*200!/);
});

test('deployment stays manual and Pages publication depends on backend success', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+push:|NETLIFY_AUTH_TOKEN|npm install|npx /);
  assert.match(workflow, /needs: \[verify, deploy_backend\]/);
  assert.match(workflow, /secrets.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /check-public-artifact.py/);
  assert.match(workflow, /check-pages-deployment.py/);
});
