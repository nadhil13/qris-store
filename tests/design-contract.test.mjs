import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('styles/main.css');
const design = read('DESIGN.md');

test('storefront source uses current branding and plain section comments', () => {
  assert.doesNotMatch(html, /Atelier Rasa/i);
  assert.doesNotMatch(html, /<!--\s*={5,}/);
  assert.doesNotMatch(css, /\.admin-view-tools\b/);
});

test('documented root tokens match the stylesheet', () => {
  const declarations = (source) => new Map(
    [...source.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])
  );
  const actual = declarations(css.match(/:root\s*\{([^}]+)\}/)[1]);
  const documented = declarations(design.match(/:root\s*\{([^}]+)\}/)[1]);
  assert.deepEqual(documented, actual);
  assert.doesNotMatch(design, /--color-paper|--color-matcha-deep/);
});
