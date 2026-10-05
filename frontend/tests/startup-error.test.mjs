import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

const { showStartupError } = await loadTypeScript('../src/app/core/startup/show-startup-error.ts', import.meta.url);

function page(pathname, withHost = true) {
  const host = {
    children: [], classes: [],
    classList: { add(name) { host.classes.push(name); } },
    replaceChildren(...children) { this.children = children; },
  };
  return {
    location: { pathname }, documentElement: { lang: pathname === 'fr' ? 'fr' : 'en' }, host,
    querySelector: () => withHost ? host : null,
    createElement: tag => ({
      tag, attributes: {}, listeners: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, listener) { this.listeners[name] = listener; },
    }),
  };
}

test('bootstrap failure displays an accessible message and a working reload action', () => {
  const document = page('/typing-test');
  let reloads = 0;
  showStartupError(document, () => reloads++);
  const [message, retry] = document.host.children;
  assert.equal(message.attributes.role, 'alert');
  assert.match(message.textContent, /could not start/);
  assert.equal(retry.textContent, 'Reload page');
  assert.equal(retry.type, 'button');
  retry.listeners.click();
  assert.equal(reloads, 1);
});

test('the startup message follows the selected language without exposing internal errors', () => {
  const document = page('fr');
  showStartupError(document, () => {});
  assert.match(document.host.children[0].textContent, /n’a pas pu démarrer/);
  assert.equal(document.host.children[1].textContent, 'Recharger la page');
});

test('a missing app host does not cause another startup exception', () => {
  assert.doesNotThrow(() => showStartupError(page('/typing-test', false), () => {}));
});
