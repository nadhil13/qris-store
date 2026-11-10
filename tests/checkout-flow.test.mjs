import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getSettings, saveSettings, getOrders } from '../scripts/core/store.js';

const requests = [];
globalThis.fetch = async (url, options) => {
  requests.push({ url, ...options });
  return { ok: true };
};

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
const { switchQRISDisplayMode, saveAdminStorefrontSetting, renderReceiptModal } = app;
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../scripts/app.js', import.meta.url), 'utf8');
const section = (name) => html.split(`id="admin-section-${name}"`)[1]?.split('\n        </section>')[0] || '';

assert.equal(app.advanceOrderStatus, undefined, 'Buyer status simulation must not be exported');
assert.equal(window.advanceOrderStatus, undefined, 'Buyer status simulation must not be globally callable');
assert.equal(app.simulatePaymentSuccess, undefined, 'Buyer payment simulation must not be exported');
assert.equal(window.simulatePaymentSuccess, undefined, 'Buyer payment simulation must not be globally callable');
assert.doesNotMatch(html, /advanceOrderStatus|simulatePaymentSuccess|admin-tabs-nav|switchAdminTab|admin-merchant-phone/);
assert.doesNotMatch(source, /switchAdminTab|saveAdminMerchantPhone|simulasi_pelanggan/);
for (const handler of ['exportOrdersCSV', 'requestNotificationPermission', 'testNotificationSound']) {
  assert.equal(html.split(`window.${handler}()`).length - 1, 1, `${handler} must have exactly one control`);
  assert.ok(section('tools').includes(`window.${handler}()`), `${handler} belongs in Tools`);
}
assert.ok(section('storefront').includes('admin-storefront-hours'));
assert.ok(section('storefront').includes('admin-storefront-is-open'));
assert.doesNotMatch(html + source, /[\p{Extended_Pictographic}\uFE0F]/u, 'UI must not contain decorative emoji');

app.addToCart(app.PRODUCTS[0].id);
const countBeforeClosedCheckout = getOrders().length;
saveSettings({ store: { isOpen: false, hours: '09:00 - 17:00' } });
assert.match(document.getElementById('store-status-label').textContent, /Tutup.*09:00 - 17:00/);
assert.equal(document.getElementById('btn-checkout').disabled, true);
assert.equal(document.getElementById('btn-checkout-whatsapp').disabled, true);
for (const submit of [app.openCheckoutModal, app.checkoutViaWhatsApp]) {
  submit();
  assert.equal(getOrders().length, countBeforeClosedCheckout, 'Closed store must not create orders through direct submission');
}
document.getElementById('admin-storefront-hours').value = '10:00 - 18:00';
document.getElementById('admin-storefront-is-open').checked = true;
const hoursVersion = getSettings().sharedUpdatedAt || 0;
saveAdminStorefrontSetting('availability');
assert.equal(getSettings().store.hours, '10:00 - 18:00');
assert.equal(getSettings().store.isOpen, true);
assert.ok(getSettings().sharedUpdatedAt > hoursVersion);
assert.equal(JSON.parse(requests.findLast((r) => r.url === '/api/settings').body).store.isOpen, true);
assert.match(document.getElementById('store-status-label').textContent, /Buka.*10:00 - 18:00/);
assert.equal(document.getElementById('btn-checkout').disabled, false);
assert.equal(document.getElementById('btn-checkout-whatsapp').disabled, false);
const savedHours = getSettings().store.hours;
document.getElementById('admin-storefront-hours').value = '   ';
saveAdminStorefrontSetting('availability');
assert.equal(getSettings().store.hours, savedHours, 'Blank hours must not overwrite the saved setting');

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

const pill = document.getElementById('qris-acquirer-pill');
assert.match(pill.textContent, /QRIS Statis$/, 'Static mode must not label the QRIS as dynamic');

switchQRISDisplayMode('dynamic', {
  id: 'test-order-1',
  invoice: 'AN2611099158',
  totals: { total: 80000 }
});
assert.match(pill.textContent, /QRIS Dinamis$/, 'Dynamic mode must label the QRIS as dynamic');

document.getElementById('admin-storefront-whatsapp').value = '628222222222';
const merchantVersion = getSettings().sharedUpdatedAt;
saveAdminStorefrontSetting('merchantWhatsApp');
assert.equal(getSettings().store.whatsapp, '628222222222');
assert.ok(getSettings().sharedUpdatedAt > merchantVersion, 'Storefront save must advance shared version');
assert.equal(JSON.parse(requests.findLast((r) => r.url === '/api/settings').body).store.whatsapp, '628222222222');

const snapshotPayload = '00020101021226610014COM.GO-JEK.WWW01189360091438279124610210G8279124610303UMI51440014ID.CO.QRIS.WWW0215ID10264865583680303UMI5204899953033605802ID5925NI NYOMAN SUTRIANI, Digit6008DENPASAR61058011762070703A0163044D86';
const order = {
  invoice: 'INV-SNAPSHOT',
  payment: { method: 'qris', payload: snapshotPayload, paidAt: 1 },
  totals: { total: 80000 },
  customer: { name: 'Test' },
  shipping: null,
  items: []
};
renderReceiptModal(order);
assert.match(document.getElementById('receipt-print-contact').textContent, /1026486558368/, 'Receipt must use the order QRIS snapshot');
const before = JSON.stringify(order);
saveSettings({ qris: { payload: snapshotPayload.replace('1026486558368', '1026486559999') } });
renderReceiptModal(order);
assert.match(document.getElementById('receipt-print-contact').textContent, /1026486558368/);
assert.equal(JSON.stringify(order), before, 'Rendering must not rewrite historical payment data');
for (const payment of [undefined, { method: 'qris', payload: '' }]) {
  renderReceiptModal({ ...order, payment });
  assert.match(document.getElementById('receipt-print-contact').textContent, /1026486559999/, 'Legacy receipts fall back to current QRIS');
}
for (const [method, label] of [['va', 'Virtual Account'], ['whatsapp', 'Konfirmasi via WhatsApp']]) {
  renderReceiptModal({ ...order, payment: { ...order.payment, method } });
  assert.equal(document.getElementById('receipt-method').textContent, label);
}

console.log('PASS checkout-flow.test.mjs! Dynamic & Static checkout rendering verified!');
process.exit(0);
