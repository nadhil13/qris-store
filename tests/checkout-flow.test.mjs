import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getSettings, saveSettings, getOrders, saveProducts } from '../scripts/core/store.js';

const requests = [];
globalThis.fetch = async (url, options) => {
  requests.push({ url, ...options });
  const body = options?.body ? JSON.parse(options.body) : {};
  return { ok: true, json: async () => ({ ok: true, settings: { ...body, qris: { payload: body.payload, updatedAt: body.updatedAt } } }) };
};

// Set up minimal browser DOM mock
const domMap = new Map();
const storageMap = new Map();
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
        inert: false,
        parentElement: document.body,
        _html: '',
        addEventListener: () => {},
        removeEventListener: () => {},
        setAttribute: () => {},
        getAttribute: () => null,
        focus: () => {},
        matches: (sel) => sel === '[role="dialog"]',
        contains: () => false,
        querySelector: (sel) => null,
        querySelectorAll: () => [],
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
  querySelectorAll: (sel) => {
    if (sel === '[data-store-whatsapp]') {
      return [document.getElementById('cta-whatsapp-link')];
    }
    return [];
  },
  querySelector: () => null,
  body: { children: [], style: {}, classList: { add: () => {}, remove: () => {} } }
};

globalThis.window = {
  document: globalThis.document,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { href: 'https://qris-store.vercel.app/' },
  localStorage: {
    getItem: (k) => storageMap.has(k) ? storageMap.get(k) : null,
    setItem: (k, v) => { storageMap.set(k, String(v)); },
    removeItem: (k) => { storageMap.delete(k); }
  }
};

globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });

const app = await import('../scripts/app.js');
const { setInventoryAdminToken } = await import('../scripts/core/inventory.js');
setInventoryAdminToken('test-backend-token');
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
assert.doesNotMatch(html, /admin123|admin-login-username|Kredensial bawaan/);
assert.match(html, /INVENTORY_ADMIN_TOKEN/);
assert.match(source, /data-action="admin-adjust-stock"/);
assert.match(source, /adminAdjustStock\(trigger.dataset.productId\)/);
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
await saveAdminStorefrontSetting('availability');
assert.equal(getSettings().store.hours, '10:00 - 18:00');
assert.equal(getSettings().store.isOpen, true);
assert.ok(getSettings().sharedUpdatedAt > hoursVersion);
assert.equal(JSON.parse(requests.findLast((r) => r.url === '/api/settings').body).store.isOpen, true);
assert.match(document.getElementById('store-status-label').textContent, /Buka.*10:00 - 18:00/);
assert.equal(document.getElementById('btn-checkout').disabled, false);
assert.equal(document.getElementById('btn-checkout-whatsapp').disabled, false);
const savedHours = getSettings().store.hours;
document.getElementById('admin-storefront-hours').value = '   ';
await saveAdminStorefrontSetting('availability');
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

// Test 2: Buyer payment QRIS stays in Dynamic mode even if called with legacy 'static' argument
switchQRISDisplayMode('static', {
  id: 'test-order-1',
  invoice: 'AN2611099158',
  totals: { total: 80000 }
});
assert.ok(qrBox.innerHTML.includes('<svg class="qr-svg"'), 'qrBox always renders SVG');

const pill = document.getElementById('qris-acquirer-pill');
assert.match(pill.textContent, /QRIS Dinamis$/, 'Checkout QRIS must always remain dynamic');

switchQRISDisplayMode('dynamic', {
  id: 'test-order-1',
  invoice: 'AN2611099158',
  totals: { total: 80000 }
});
assert.match(pill.textContent, /QRIS Dinamis$/, 'Dynamic mode must label the QRIS as dynamic');

document.getElementById('admin-storefront-whatsapp').value = '628222222222';
const merchantVersion = getSettings().sharedUpdatedAt;
await saveAdminStorefrontSetting('merchantWhatsApp');
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

// Test 3: No fabricated Virtual Account numbers or fake auto-verification claims
assert.doesNotMatch(source, /88019/, 'Source must not fabricate fake 88019 Virtual Account numbers');
assert.doesNotMatch(html, /88019123456789/, 'HTML must not display fake Virtual Account number');
assert.doesNotMatch(html, /real-time dalam hitungan detik/i, 'HTML must not claim automatic real-time bank verification without a gateway');
assert.doesNotMatch(html, /Menunggu pembayaran otomatis dari aplikasi e-wallet Anda/i, 'HTML must not claim automatic e-wallet settlement');

// Test 4: Final WhatsApp CTA uses dynamic store WhatsApp setting
assert.match(html, /data-store-whatsapp/, 'Final CTA WhatsApp link must have data-store-whatsapp attribute');
document.getElementById('admin-storefront-whatsapp').value = '081987654321';
await saveAdminStorefrontSetting('merchantWhatsApp');
assert.match(document.getElementById('cta-whatsapp-link').href || '', /wa\.me\/6281987654321/, 'CTA WhatsApp link must reflect normalized admin WhatsApp number');

// Test 5: Apostrophes in variant labels and cart keys do not produce broken inline JS handlers
const customList = app.PRODUCTS.map((p, idx) => idx === 0
  ? { ...p, variants: [{ label: "Jumbo 500g (Chef's Cut)", delta: 15000 }] }
  : p
);
saveProducts(customList, { type: 'test-apostrophe' });

app.openQuickView(app.PRODUCTS[0].id);
const variantsHtml = document.getElementById('qv-variant-grid').innerHTML;
assert.match(variantsHtml, /data-action="select-variant"/, 'Variant buttons must use data-action delegation');
assert.match(variantsHtml, /data-variant="Jumbo 500g \(Chef&#39;s Cut\)"/, 'Variant label must be HTML-escaped in data-variant attribute');
assert.doesNotMatch(variantsHtml, /onclick=/, 'Variant buttons must not use inline onclick strings');

app.addToCart(app.PRODUCTS[0].id, "Jumbo 500g (Chef's Cut)");
const cartHtml = document.getElementById('drawer-items').innerHTML;
assert.match(cartHtml, /data-action="update-qty"/, 'Cart item controls must use data-action delegation');
assert.match(cartHtml, /Chef&#39;s Cut/, 'Cart item key must escape apostrophe safely');
assert.doesNotMatch(cartHtml, /onclick=/, 'Cart item controls must not use inline onclick strings');

const { saveOrder, rememberMyOrder } = await import('../scripts/core/store.js');
const displayedOrder = { ...order, id: 'receipt-paid', status: 'paid' };
saveOrder(displayedOrder);
rememberMyOrder(displayedOrder.id);
const newerOrder = { ...order, id: 'new-unpaid', invoice: 'INV-UNPAID', status: 'awaiting_payment' };
saveOrder(newerOrder);
rememberMyOrder(newerOrder.id);
renderReceiptModal(displayedOrder);
let sharedUrl = '';
window.open = (url) => { sharedUrl = url; };
app.shareReceiptWhatsApp();
assert.match(decodeURIComponent(sharedUrl), /INV-SNAPSHOT/, 'Share must reference the displayed receipt');
assert.doesNotMatch(decodeURIComponent(sharedUrl), /INV-UNPAID/);
sharedUrl = '';
renderReceiptModal(newerOrder);
app.shareReceiptWhatsApp();
assert.equal(sharedUrl, '', 'Unpaid orders must not be shared as payment receipts');
assert.doesNotMatch(html, /diterima dapur/i, 'Receipt copy must work for every product category');
assert.doesNotMatch(source, /api\.restful-api\.dev/, 'Settings must never use public backup storage');
assert.doesNotMatch(readFileSync(new URL('../api/settings.js', import.meta.url), 'utf8'), /api\.restful-api\.dev/);

// Real HTTP checkout cannot expose payment instructions before reserve succeeds.
globalThis.localStorage = window.localStorage;
window.location.protocol = 'https:';
for (const [id, value] of [['customer-name', 'Buyer'], ['customer-phone', '08123456789'], ['customer-address', 'Test address']]) document.getElementById(id).value = value;
app.state.cart = [{ productId: app.PRODUCTS[0].id, variant: app.PRODUCTS[0].variants?.[0]?.label || '', qty: 1, note: '' }];
let respondReserve;
let reserveCount = 0;
let reservePayload;
const cartBeforeReserve = JSON.stringify(app.state.cart);
globalThis.fetch = async (url, options = {}) => {
  if (url.startsWith('/api/inventory?action=order')) return { ok: false, status: 404, json: async () => ({ ok: false, code: 'ORDER_NOT_FOUND' }) };
  if (url !== '/api/inventory') return { ok: true, json: async () => ({}) };
  reserveCount++;
  reservePayload = JSON.parse(options.body);
  return new Promise(resolve => { respondReserve = resolve; });
};
const activeBeforeReserve = app.state.activeCheckoutOrderId;
const checkoutPromise = app.openCheckoutModal();
await app.checkoutViaWhatsApp();
assert.equal(reserveCount, 1, 'Concurrent checkout must not reserve twice');
assert.equal(app.state.activeCheckoutOrderId, activeBeforeReserve, 'Payment modal waits for canonical reservation');
assert.equal(document.getElementById('btn-checkout').disabled, true);
respondReserve({ ok: false, status: 503, json: async () => ({ ok: false, code: 'STORAGE_UNAVAILABLE' }) });
await checkoutPromise;
assert.equal(JSON.stringify(app.state.cart), cartBeforeReserve, 'Failure preserves cart');
assert.equal(app.state.activeCheckoutOrderId, activeBeforeReserve);
const originalPayload = reservePayload;
const retry = app.openCheckoutModal();
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(reservePayload, originalPayload, 'Checkout retry keeps original capability and id');
const now = Date.now();
const canonical = { id: reservePayload.id, invoice: 'SERVER-INVOICE', createdAt: now, updatedAt: now, expiresAt: now + 600000, status: 'awaiting_payment', items: [], customer: { name: 'Buyer' }, totals: { total: 777, itemCount: 1 }, payment: { method: 'qris', payload: getSettings().qris.payload }, timeline: [] };
respondReserve({ ok: true, json: async () => ({ ok: true, order: canonical }) });
await retry;
assert.equal(app.state.activeCheckoutOrderId, canonical.id);
assert.equal(getOrders().find(o => o.id === canonical.id).totals.total, 777);
app.state.activeOrderStopWatch?.();
app.closeCheckoutModal();
let whatsappMessage = '';
window.open = url => {
  assert.equal(url, 'about:blank', 'Reserve a window during the click, before awaiting network');
  return { location: { set href(value) { whatsappMessage = decodeURIComponent(value); } }, close() {} };
};
globalThis.fetch = async (url, options = {}) => {
  assert.equal(url, '/api/inventory');
  const payload = JSON.parse(options.body);
  assert.equal(payload.paymentMethod, 'whatsapp');
  return { ok: true, json: async () => ({ ok: true, order: { ...canonical, id: payload.id, payment: { method: 'whatsapp' } } }) };
};
await app.checkoutViaWhatsApp();
assert.match(whatsappMessage, /Status: Konfirmasi & ketersediaan lewat WhatsApp \(berlaku hingga /);
assert.doesNotMatch(whatsappMessage, /String QRIS:|00020101/);
assert.equal(app.state.cart.length, 0);

// Login is authorized by the backend, never by a fixed browser credential.
const auth = await import('../scripts/core/auth.js');
app.state.adminAuthenticated = false;
document.getElementById('admin-login-password').value = 'not-a-demo-password';
globalThis.fetch = async (url, options) => {
  assert.equal(url, '/api/inventory?action=list');
  assert.equal(options.headers.Authorization, 'Bearer not-a-demo-password');
  return { ok: false, status: 401, json: async () => ({ ok: false, code: 'UNAUTHORIZED' }) };
};
await app.submitAdminLogin({ preventDefault() {} });
assert.equal(app.state.adminAuthenticated, false);
assert.equal(auth.hasInventoryAdminToken(), false);
assert.equal(document.getElementById('admin-login-password').value, '');
assert.match(document.getElementById('admin-login-error').textContent, /UNAUTHORIZED/);

// New product metadata is published first; only adjust initializes inventory.
auth.setInventoryAdminToken('creation-token');
const store = await import('../scripts/core/store.js');
store.setInventoryStock({ revision: 100, products: {} });
for (const [id, value] of [['new-prod-name', 'Regression product'], ['new-prod-price', '12000'], ['new-prod-category', 'makanan'], ['new-prod-tag', ''], ['new-prod-image', ''], ['new-prod-desc', 'Test product']]) document.getElementById(id).value = value;
const creationCalls = [];
let createdId;
globalThis.fetch = async (url, options = {}) => {
  creationCalls.push({ url, options });
  if (url === '/api/settings') {
    assert.equal(options.headers.Authorization, 'Bearer creation-token');
    const payload = JSON.parse(options.body);
    createdId = payload.products[0].id;
    assert.equal(payload.products[0].isAvailable, false);
    assert.equal(payload.products[0].stock, 0);
    return { ok: true, json: async () => ({ ok: true, settings: payload }) };
  }
  if (options.method === 'GET') return { ok: true, json: async () => ({ ok: true, stock: { revision: 101, products: {} } }) };
  assert.equal(url, '/api/inventory');
  assert.equal(options.headers.Authorization, 'Bearer creation-token');
  assert.deepEqual(JSON.parse(options.body), { action: 'adjust', productId: createdId, stock: 0, expectedRevision: 101 });
  assert.equal(Object.hasOwn(store.getInventoryStock().products, createdId), false);
  return { ok: true, json: async () => ({ ok: true, stock: { revision: 102, products: { [createdId]: 0 } } }) };
};
await app.submitNewProduct({ preventDefault() {} });
assert.deepEqual(creationCalls.map(call => call.url), ['/api/settings', '/api/inventory?action=stock', '/api/inventory']);
assert.equal(store.getInventoryStock().products[createdId], 0);
assert.equal(store.getProduct(createdId).isAvailable, false);
assert.ok(![...storageMap.values()].some(value => value.includes('creation-token')));

// A failed initialization keeps published metadata but cannot make stock ready.
document.getElementById('new-prod-name').value = 'Uninitialized product';
let failedProductId;
globalThis.fetch = async (url, options = {}) => {
  if (url === '/api/settings') {
    const payload = JSON.parse(options.body);
    failedProductId = payload.products[0].id;
    return { ok: true, json: async () => ({ ok: true, settings: payload }) };
  }
  if (options.method === 'GET') return { ok: true, json: async () => ({ ok: true, stock: { revision: 103, products: { [createdId]: 0 } } }) };
  return { ok: false, status: 503, json: async () => ({ ok: false, code: 'STORAGE_UNAVAILABLE' }) };
};
await app.submitNewProduct({ preventDefault() {} });
assert.equal(Object.hasOwn(store.getInventoryStock().products, failedProductId), false);
assert.equal(store.getProduct(failedProductId).isAvailable, false);
assert.match(document.getElementById('toast-text').textContent, /stok belum diinisialisasi/);
let catalogWriteCount = 0;
globalThis.fetch = async (url, options = {}) => {
  if (url === '/api/settings') catalogWriteCount++;
  return { ok: true, json: async () => ({ ok: true, stock: { revision: 103, products: { [createdId]: 0 } } }) };
};
await app.toggleProductAvailability(failedProductId);
assert.equal(catalogWriteCount, 0);
assert.equal(store.getProduct(failedProductId).isAvailable, false);

console.log('PASS checkout-flow.test.mjs! Dynamic & Static checkout rendering verified!');
process.exit(0);
