import assert from 'node:assert/strict';

// Set up minimal browser DOM mock
const domMap = new Map();
globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: (id) => {
    if (!domMap.has(id)) {
      domMap.set(id, {
        id,
        style: {},
        textContent: '',
        dataset: {},
        _html: '',
        addEventListener: () => {},
        removeEventListener: () => {},
        setAttribute: () => {},
        getAttribute: () => null,
        focus: () => {},
        set innerHTML(val) { this._html = val; },
        get innerHTML() { return this._html; },
        classList: {
          add: () => {},
          remove: () => {},
          contains: () => false
        }
      });
    }
    return domMap.get(id);
  },
  querySelectorAll: () => [],
  querySelector: () => null,
  body: { classList: { add: () => {}, remove: () => {} } }
};

globalThis.window = {
  document: globalThis.document,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { href: 'https://qris-store.vercel.app/' },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  }
};

globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

const app = await import('../scripts/app.js');
const { switchQRISDisplayMode } = app;

// Test 1: Dynamic QRIS mode produces SVG immediately
switchQRISDisplayMode('dynamic', {
  id: 'test-order-1',
  invoice: 'AN2611099158',
  totals: { total: 80000 }
});

const qrBox = document.getElementById('qris-svg-container');
assert.ok(qrBox.innerHTML.includes('<svg class="qr-svg"'), 'qrBox must contain <svg class="qr-svg"');
assert.ok(!qrBox.innerHTML.includes('Menyiapkan QRIS Dinamis'), 'Spinner text must be replaced');
assert.ok(qrBox.innerHTML.length > 5000, 'SVG payload must be complete');

// Test 2: Static QRIS mode also updates SVG
switchQRISDisplayMode('static', {
  id: 'test-order-1',
  invoice: 'AN2611099158',
  totals: { total: 80000 }
});
assert.ok(qrBox.innerHTML.includes('<svg class="qr-svg"'), 'qrBox in static mode also renders SVG');

console.log('PASS checkout-flow.test.mjs! Dynamic & Static checkout rendering verified!');
process.exit(0);
