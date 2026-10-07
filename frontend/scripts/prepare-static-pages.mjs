import { readdirSync, renameSync, rmdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Pages serves slug.html directly at /slug without directory-index redirects.
export function prepareStaticPages(publish, routes) {
  return routes.filter(route => route !== '/').map(route => {
    if (!/^\/[a-z0-9-]+$/.test(route)) throw new Error('Unsupported static page path: ' + route);
    const slug = route.slice(1);
    const directory = resolve(publish, slug);
    const files = readdirSync(directory);
    if (files.length !== 1 || files[0] !== 'index.html') {
      throw new Error('Refusing to relocate a directory containing other assets: ' + route);
    }
    renameSync(resolve(directory, 'index.html'), resolve(publish, slug + '.html'));
    rmdirSync(directory);
    return route;
  });
}
