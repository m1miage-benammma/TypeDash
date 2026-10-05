import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function sources(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) paths.push(...await sources(path));
    else if (/\.(ts|mjs)$/.test(entry.name)) paths.push(path);
  }
  return paths;
}

test('frontend source and build scripts contain no ad-hoc console logging', async () => {
  const files = [...await sources(new URL('../src/', import.meta.url)), ...await sources(new URL('../scripts/', import.meta.url))];
  for (const path of files) {
    const file = ts.createSourceFile(path.pathname, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true);
    function inspect(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const call = node.expression;
        assert.ok(!(call.expression.getText(file) === 'console'
          && ['log', 'error', 'warn', 'info', 'debug'].includes(call.name.text)), path.pathname);
      }
      ts.forEachChild(node, inspect);
    }
    inspect(file);
  }
});
