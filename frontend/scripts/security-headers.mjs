import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function securityHeaders(directory, apiOrigin) {
  const hashes = new Set();
  const scan = path => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (entry.name.endsWith('.html')) {
        for (const [, attributes, script] of readFileSync(file, 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
          if (!/\bsrc\s*=/i.test(attributes) && script.trim()) {
            hashes.add(`'sha256-${createHash('sha256').update(script).digest('base64')}'`);
          }
        }
      }
    }
  };
  scan(directory);
  const websocket = new URL(apiOrigin);
  websocket.protocol = 'wss:';
  const csp = [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
    "form-action 'self'", "frame-src 'none'",
    `script-src 'self' https://www.googletagmanager.com ${[...hashes].join(' ')}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'", "font-src 'self'",
    "img-src 'self' data: https://*.google-analytics.com https://www.googletagmanager.com",
    `connect-src 'self' ${websocket.origin} https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com`,
    'upgrade-insecure-requests',
  ].join('; ');
  return [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  X-Frame-Options: DENY',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Strict-Transport-Security: max-age=31536000',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    '',
  ].join('\n');
}
