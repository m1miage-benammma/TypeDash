import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const publish = resolve(frontend, 'dist/frontend/browser');

function publicOrigin(value, name) {
  if (!value) throw new Error(`Set ${name} in the Netlify build environment.`);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be an HTTPS origin without credentials, paths or query parameters.`);
  }
  return url.origin;
}

// Only public addresses are read here. Never expose database credentials or keys.
const apiOrigin = publicOrigin(process.env.TYPEDASH_API_ORIGIN, 'TYPEDASH_API_ORIGIN');
const siteOrigin = publicOrigin(process.env.TYPEDASH_SITE_ORIGIN || process.env.URL, 'TYPEDASH_SITE_ORIGIN');
if (apiOrigin === siteOrigin) throw new Error('API origin must point to the separately hosted FastAPI backend.');

const result = spawnSync(process.execPath, [
  resolve(frontend, 'node_modules/@angular/cli/bin/ng.js'),
  'build', '--define', `TYPEDASH_SITE_ORIGIN=${JSON.stringify(siteOrigin)}`,
  '--define', `TYPEDASH_API_ORIGIN=${JSON.stringify(apiOrigin)}`,
], { cwd: frontend, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

writeFileSync(resolve(publish, '_redirects'),
  `/api/* ${apiOrigin}/api/:splat 200!\n/* /index.csr.html 200\n`, 'utf8');
// CLI uploads do not read the repository's netlify.toml: preserve its headers.
writeFileSync(resolve(publish, '_headers'), [
  '/api/*',
  '  Cache-Control: no-store',
  '/*',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '',
].join('\n'), 'utf8');
for (const file of ['robots.txt', 'sitemap.xml']) {
  const path = resolve(publish, file);
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll('https://typedash.com', siteOrigin), 'utf8');
}
