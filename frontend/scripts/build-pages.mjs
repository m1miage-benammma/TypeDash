import { prepareStaticPages } from './prepare-static-pages.mjs';
import { securityHeaders } from './security-headers.mjs';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const publish = resolve(frontend, 'dist/frontend/browser');

function publicOrigin(value, name) {
  if (!value) throw new Error(`Set ${name} in the Docker build environment.`);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be an HTTPS origin without credentials, paths or query parameters.`);
  }
  return url.origin;
}

// Only public addresses are read here. Never expose database credentials or keys.
const apiOrigin = publicOrigin(process.env.TYPEDASH_API_ORIGIN, 'TYPEDASH_API_ORIGIN');
// Canonicals describe the public domain, never a deployment hostname.
const siteOrigin = 'https://typedash.online';
if (apiOrigin === siteOrigin) throw new Error('API origin must point to the separately hosted FastAPI backend.');

const result = spawnSync(process.execPath, [
  resolve(frontend, 'node_modules/@angular/cli/bin/ng.js'),
  'build', '--define', `TYPEDASH_SITE_ORIGIN=${JSON.stringify(siteOrigin)}`,
  '--define', `TYPEDASH_API_ORIGIN=${JSON.stringify(apiOrigin)}`,
], { cwd: frontend, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const prerendered = JSON.parse(readFileSync(resolve(frontend, 'dist/frontend/prerendered-routes.json'), 'utf8'));
prepareStaticPages(publish, Object.keys(prerendered.routes));

const legacyPaths = {
  "/typing-test": "/",
  "/en/typing-test": "/",
  "/fr/test-de-frappe": "/",
  "/en/typing-speed-guide": "/typing-speed-guide",
  "/fr/guide-vitesse-frappe": "/typing-speed-guide",
  "/en/improve-typing-accuracy": "/improve-typing-accuracy",
  "/fr/ameliorer-precision-frappe": "/improve-typing-accuracy",
  "/en/wpm-calculator": "/wpm-calculator",
  "/fr/calculateur-mpm": "/wpm-calculator",
  "/en/typing-test-for-programmers": "/typing-test-for-programmers",
  "/fr/test-frappe-programmeurs": "/typing-test-for-programmers",
  "/en/progress": "/progress",
  "/fr/progres": "/progress"
};
// Host and HTTPS normalization belong to zone redirect rules, not Pages assets.
writeFileSync(resolve(publish, '_redirects'),
  [
    ...Object.entries(legacyPaths).map(([from, to]) => `${from} ${siteOrigin}${to} 301`),
    '',
  ].join('\n'), 'utf8');
// Static files stay on the free asset path; only API calls invoke the proxy.
writeFileSync(resolve(publish, '_routes.json'), JSON.stringify({
  version: 1, include: ['/api/*'], exclude: [],
}), 'utf8');
writeFileSync(resolve(publish, '_worker.js'),
  readFileSync(resolve(frontend, 'cloudflare/worker.mjs'), 'utf8')
    .replace('__TYPEDASH_API_ORIGIN__', JSON.stringify(apiOrigin)), 'utf8');
writeFileSync(resolve(publish, '_headers'), securityHeaders(publish, apiOrigin), 'utf8');
for (const file of ['robots.txt', 'sitemap.xml']) {
  const path = resolve(publish, file);
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll('https://typedash.online', siteOrigin), 'utf8');
}
