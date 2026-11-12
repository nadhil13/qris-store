import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../scripts/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('editorial motion respects reduced motion and keeps catalog controls visible', () => {
  assert.ok(app.includes("matchMedia?.('(prefers-reduced-motion: reduce)')"));
  assert.match(app, /scrollTrigger:\s*\{[^}]*trigger:\s*['"]\.hero-section['"]/s);
  assert.doesNotMatch(app, /gsap\.from\(sec,\s*\{[\s\S]*?scrollTrigger:/);
  assert.match(html, /class="catalog-section reveal-section"/);
  assert.doesNotMatch(app, /gsap\.from\(['"]\.catalog-section/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
