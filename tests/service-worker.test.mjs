import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('offline versioned assets use only the current cache and ignore query strings', async () => {
  const listeners = {};
  const lookups = [];
  const asset = { status: 200 };
  const cache = {
    async match(request, options) {
      lookups.push({ request, options });
      return options?.ignoreSearch ? asset : undefined;
    }
  };
  vm.runInNewContext(source, {
    self: { addEventListener(type, handler) { listeners[type] = handler; } },
    URL,
    caches: { async open() { return cache; }, async match() { return undefined; } },
    fetch: async () => { throw new Error('offline'); }
  });
  for (const path of ['styles/main.css?v=new', 'scripts/app.js?v=new']) {
    let response;
    listeners.fetch({
      request: { method: 'GET', url: `https://store.example/${path}`, mode: 'cors' },
      respondWith(promise) { response = promise; }
    });
    assert.equal(await response, asset);
  }
  assert.equal(lookups.length, 2);
  assert.ok(lookups.every(({ options }) => options.ignoreSearch === true));
});

test('notification icon is a real local image and included in precache', () => {
  const app = readFileSync(new URL('../scripts/app.js', import.meta.url), 'utf8');
  const icon = app.match(/new Notification\(title, \{ body, icon: '([^']+)'/)?.[1];
  assert.match(icon || '', /\.(svg|png)$/);
  assert.ok(existsSync(new URL(`../${icon}`, import.meta.url)));
  assert.ok(source.includes(`'${icon}'`));
});
