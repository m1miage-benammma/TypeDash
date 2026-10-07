import { prepareStaticPages } from './prepare-static-pages.mjs';
import { securityHeaders } from './security-headers.mjs';
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
// Canonicals describe the public domain, never the Netlify deployment hostname.
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
const staticRewrites = prepareStaticPages(publish, Object.keys(prerendered.routes));

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
const siteHost = new URL(siteOrigin).hostname;
// Combine host, scheme and legacy-path normalization in the same redirect.
// Keep preview domains independent; normalize only production aliases.
const aliases = [
  `http://${siteHost}`, `http://www.${siteHost}`, `https://www.${siteHost}`,
  'http://typedasha.netlify.app', 'https://typedasha.netlify.app',
].filter(origin => origin !== siteOrigin);
writeFileSync(resolve(publish, '_redirects'),
  [
    ...aliases.flatMap(origin => [
      ...Object.entries(legacyPaths).map(([from, to]) => `${origin}${from} ${siteOrigin}${to} 301!`),
      `${origin}/* ${siteOrigin}/:splat 301!`,
    ]),
    `/api/* ${apiOrigin}/api/:splat 200!`,
    ...Object.entries(legacyPaths).map(([from, to]) => `${from} ${siteOrigin}${to} 301!`),
    ...staticRewrites,
    '/* /index.csr.html 200',
    '',
  ].join('\n'), 'utf8');
// CLI uploads do not read the repository's netlify.toml: preserve its headers.
writeFileSync(resolve(publish, '_headers'), securityHeaders(publish, apiOrigin), 'utf8');
for (const file of ['robots.txt', 'sitemap.xml']) {
  const path = resolve(publish, file);
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll('https://typedash.online', siteOrigin), 'utf8');
}
