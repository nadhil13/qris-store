import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PRODUCTS } from '../scripts/core/catalog.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('styles/main.css');
const privacy = read('PRIVACY.md');

const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing CSS rule ${selector}`);
  return match[1];
};

const hexToLum = (hex) => {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [hexToLum(a), hexToLum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const token = (name) => css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))[1];

test('demo catalog makes no unverified health, certification, or lifetime claims', () => {
  const text = JSON.stringify(PRODUCTS);
  for (const pattern of [/kkal/i, /probiotik/i, /pencernaan/i, /tidur lelap/i, /menenangkan pikiran/i,
    /Q-Grader/i, /bersertifikat/i, /sertifikat resmi/i, /diskon 20%/i, /selamanya/i, /4 tahun/i, /100%/]) {
    assert.doesNotMatch(text, pattern);
  }
});

test('storefront labels demo content and avoids repeated mood copy', () => {
  assert.match(html, /data-demo-notice/);
  assert.doesNotMatch(html, /Jelajahi Koleksi/);
  assert.doesNotMatch(html, /etalase tenang|konteks yang jujur|bahan jujur|lebih tenang/i);
  assert.doesNotMatch(html, /\u2014/);
});

test('admin access is not promoted to buyers', () => {
  assert.doesNotMatch(html, /Username: admin/);
  assert.doesNotMatch(html, /id="mob-nav-admin"/);
  assert.doesNotMatch(html, /id="header-admin-btn"/);
  assert.doesNotMatch(html, /Admin Terpadu/);
  assert.doesNotMatch(html, /Masuk Panel Admin Toko/);
});

test('checkout explains customer data use and links to a real privacy section', () => {
  assert.match(html, /id="checkout-privacy-note"/);
  assert.match(html, /href="#privasi"/);
  assert.match(html, /id="privasi"/);
  assert.match(privacy, /Upstash|KV/);
  assert.match(privacy, /localStorage/);
  assert.match(privacy, /WhatsApp/);
});

test('skip link targets main content', () => {
  assert.match(html, /<a href="#main-content" class="skip-link">/);
  assert.match(html, /<main id="main-content" tabindex="-1">/);
  assert.match(rule('.skip-link:focus'), /transform|top|clip/);
});

test('countdown meets 4.5:1 on its surface and checkout inputs avoid iOS zoom', () => {
  const box = rule('.countdown-box');
  const colorVar = box.match(/color:\s*var\((--[\w-]+)\)/)[1];
  assert.ok(contrast(token(colorVar), token('--bg-card-muted')) >= 4.5);
  assert.ok(contrast(token(colorVar), '#ffffff') >= 4.5);
  assert.match(rule('.customer-input-field'), /font-size:\s*16px/);
  assert.match(rule('.voucher-input'), /font-size:\s*16px/);
});
