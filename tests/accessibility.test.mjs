import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createModalManager, bindTabs } from '../scripts/core/dialogs.js';

const source = readFileSync(new URL('../scripts/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function fixture() {
  const listeners = {};
  const doc = { addEventListener: (type, fn) => { listeners[type] = fn; }, querySelector: () => background };
  function element(parent = null) {
    const classes = new Set();
    const el = { parentElement: parent, children: [], style: {}, inert: false, tabIndex: 0, isConnected: true,
      classList: { add: (v) => classes.add(v), remove: (v) => classes.delete(v), contains: (v) => classes.has(v) },
      setAttribute() {}, matches: () => true, getClientRects: () => [1],
      contains: (target) => target === el || el.children.some((child) => child.contains(target)),
      closest: () => el.inert ? el : parent?.closest(),
      querySelectorAll: () => el.children,
      focus: () => { doc.activeElement = el; }
    };
    parent?.children.push(el);
    return el;
  }
  doc.body = element();
  doc.body.style.overflow = 'auto';
  const background = element(doc.body);
  const trigger = element(background);
  const outer = element(doc.body);
  const first = element(outer);
  const last = element(outer);
  const inner = element(doc.body);
  element(inner);
  trigger.focus();
  const manager = createModalManager(doc);
  const key = (key, shiftKey = false) => listeners.keydown({ key, shiftKey, preventDefault() {}, stopImmediatePropagation() {} });
  return { doc, manager, background, trigger, outer, inner, first, last, key };
}

test('nested dialogs retain scroll lock and Escape closes only the top, restoring focus', () => {
  const f = fixture();
  f.manager.open(f.outer, () => f.manager.close(f.outer));
  assert.equal(f.doc.activeElement, f.first);
  assert.equal(f.background.inert, true);
  f.manager.open(f.inner, () => f.manager.close(f.inner));
  assert.equal(f.outer.inert, true);
  f.key('Escape');
  assert.equal(f.outer.classList.contains('open'), true);
  assert.equal(f.inner.classList.contains('open'), false);
  assert.equal(f.doc.activeElement, f.first);
  assert.equal(f.doc.body.style.overflow, 'hidden');
  f.key('Escape');
  assert.equal(f.doc.activeElement, f.trigger);
  assert.equal(f.doc.body.style.overflow, 'auto');
  assert.equal(f.background.inert, false);
  assert.equal(f.inner.inert, true);
});

test('Tab and Shift+Tab wrap within the active dialog', () => {
  const f = fixture();
  f.manager.open(f.outer, () => f.manager.close(f.outer));
  f.key('Tab', true);
  assert.equal(f.doc.activeElement, f.last);
  f.key('Tab');
  assert.equal(f.doc.activeElement, f.first);
});

test('closing an underlying overlay does not unlock the page or steal focus', () => {
  const f = fixture();
  f.manager.open(f.outer, () => f.manager.close(f.outer));
  f.manager.open(f.inner, () => f.manager.close(f.inner));
  const focused = f.doc.activeElement;
  f.manager.close(f.outer);
  assert.equal(f.doc.activeElement, focused);
  assert.equal(f.doc.body.style.overflow, 'hidden');
  f.key('Escape');
  assert.equal(f.doc.activeElement, f.trigger);
  assert.equal(f.outer.inert, true);
});

test('user flows never invoke blocking browser dialogs', () => {
  assert.doesNotMatch(source, /\b(?:alert|confirm|prompt)\s*\(/);
});

test('search clear is a named native button', () => {
  assert.match(html, /<button[^>]*id="search-clear"[^>]*aria-label="Hapus pencarian"/);
});

test('QRIS upload has a keyboard button rather than a clickable container', () => {
  assert.doesNotMatch(source, /<div[^>]*id="admin-qris-dropzone"[^>]*onclick=/);
  assert.match(source, /<button[^>]*onclick="window.triggerQRISUpload\(\)"/);
});

test('all overlay visibility is delegated to the shared lifecycle', () => {
  assert.doesNotMatch(source, /(?:modal|receiptModal|drawer|adminDash|adminLogin)\.classList\.(?:add|remove)\('open'\)/);
  assert.match(source, /createModalManager/);
});

test('initial HTML exposes category filter state and payment selection', () => {
  const categories = html.match(/<div class="category-tabs"[^>]*>([\s\S]*?)<\/div>/)[0];
  assert.match(categories, /role="group" aria-label="Kategori produk"/);
  assert.doesNotMatch(categories, /role="tab"/);
  assert.equal((categories.match(/aria-pressed="true"/g) || []).length, 1);
  assert.equal((categories.match(/aria-pressed="false"/g) || []).length, 6);
  const paymentTabs = html.match(/<button[^>]*class="pay-tab[^>]*>/g);
  assert.match(paymentTabs[0], /aria-selected="true"/);
  assert.match(paymentTabs[1], /aria-selected="false"/);
});

function tabFixture() {
  const listeners = {};
  const panels = [0, 1].map(() => ({ setAttribute(name, value) { this[name] = value; } }));
  const tabs = panels.map((panel, i) => ({
    dataset: { target: `panel-${i}` },
    selected: i === 0,
    classList: { contains: () => tabs[i].selected },
    setAttribute(name, value) { this[name] = value; },
    focus() { container.focused = this; },
    click() { tabs.forEach((tab) => { tab.selected = tab === this; }); listeners.click(); }
  }));
  const container = {
    querySelectorAll: () => tabs,
    ownerDocument: { getElementById: (id) => panels[Number(id.slice(-1))] },
    setAttribute(name, value) { this[name] = value; },
    addEventListener(type, handler) { listeners[type] = handler; }
  };
  return { tabs, panels, container, listeners };
}

test('payment tabs support arrows, Home and End with selected state and linked panels', () => {
  const f = tabFixture();
  bindTabs(f.container);
  assert.equal(f.tabs[0]['aria-selected'], 'true');
  assert.equal(f.panels[1].hidden, true);
  for (const [key, from, to] of [['ArrowRight', 0, 1], ['ArrowRight', 1, 0], ['End', 0, 1], ['Home', 1, 0], ['ArrowLeft', 0, 1]]) {
    f.listeners.keydown({ key, target: f.tabs[from], preventDefault() {} });
    assert.equal(f.container.focused, f.tabs[to]);
    assert.equal(f.tabs[to]['aria-selected'], 'true');
    assert.equal(f.tabs[to].tabIndex, 0);
    assert.equal(f.panels[to].hidden, false);
    assert.equal(f.panels[to]['aria-labelledby'], f.tabs[to].id);
    assert.equal(f.panels[1 - to].hidden, true);
  }
});

test('category filters expose pressed state without hiding a shared catalog as a tab panel', () => {
  const f = tabFixture();
  bindTabs(f.container, { filter: true });
  f.tabs[1].click();
  assert.equal(f.container.role, 'group');
  assert.equal(f.tabs[0]['aria-pressed'], 'false');
  assert.equal(f.tabs[1]['aria-pressed'], 'true');
  assert.ok(f.tabs.every((tab) => tab.tabIndex === 0));
  assert.ok(f.panels.every((panel) => panel.hidden === undefined));
});