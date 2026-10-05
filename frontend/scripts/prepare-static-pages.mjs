import { mkdirSync, readdirSync, renameSync, rmdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Keep prerendering, but avoid directory-index redirects for slashless routes.
export function prepareStaticPages(publish, routes) {
  const pagesDirectory = resolve(publish, '_pages');
  mkdirSync(pagesDirectory, { recursive: true });
  return routes.filter(route => route !== '/').map(route => {
    if (!/^\/[a-z0-9-]+$/.test(route)) throw new Error('Unsupported static page path: ' + route);
    const slug = route.slice(1);
    const directory = resolve(publish, slug);
    const files = readdirSync(directory);
    if (files.length !== 1 || files[0] !== 'index.html') {
      throw new Error('Refusing to relocate a directory containing other assets: ' + route);
    }
    renameSync(resolve(directory, 'index.html'), resolve(pagesDirectory, slug + '.html'));
    rmdirSync(directory);
    return route + ' /_pages/' + slug + '.html 200!';
  });
}
