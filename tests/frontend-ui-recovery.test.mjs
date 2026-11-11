import { test } from 'node:test';
import assert from 'node:assert/strict';
const nativeSetInterval = globalThis.setInterval;
globalThis.setInterval = (...args) => { const timer = nativeSetInterval(...args); timer.unref(); return timer; };
const data = new Map(), elements = new Map(), handlers = new Map();
globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,String(v)), removeItem: k => data.delete(k) };
const element = id => ({ id, value: '', defaultValue: '', checked: false, style: {}, dataset: {}, parentElement: document.body, setAttribute() {}, getAttribute() { return null; }, focus() {}, matches() { return true; }, contains() { return false; }, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, removeEventListener() {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
globalThis.document = { addEventListener(type, fn) { handlers.set(type, fn); }, removeEventListener() {}, getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); }, querySelectorAll() { return []; }, querySelector() { return null; }, body: { children: [], style: {}, classList: { add() {}, remove() {} } } };
globalThis.window = { document, localStorage, location: { protocol: 'https:' }, addEventListener() {}, removeEventListener() {}, open() { return null; } };
globalThis.requestAnimationFrame = () => {};
const store = await import('../scripts/core/store.js');
const inv = await import('../scripts/core/inventory.js');
const app = await import('../scripts/app.js');
const response = body => ({ ok: true, status: 200, json: async () => ({ ok: true, ...body }) });
const product = app.PRODUCTS[0];
const owned = id => ({ id, inventory: true, invoice: 'TEST', status: 'awaiting_payment', updatedAt: 1, createdAt: Date.now(), expiresAt: Date.now()+600000, customer: { name: 'Buyer', phone: '08123456789' }, items: [{ productId: product.id, name: product.name, qty: 1, unitPrice: product.price }], totals: { total: product.price, subtotal: product.price }, payment: { method: 'qris', payload: store.DEMO_STATIC_QRIS }, shipping: { id: 'digital' } });
const seed = (id, method = 'qris') => {
 const payload = { action: 'reserve', id, capability: 'secret', items: [{ productId: product.id, variant: product.variants[0]?.label || '', qty: 1, note: '' }], customer: {}, shippingId: 'digital', voucherCode: '', paymentMethod: method };
 data.set('an.inventory.reservations.v1', JSON.stringify([{ pending: true, signature: JSON.stringify(Object.fromEntries(Object.entries(payload).filter(([k]) => !['action','id','capability'].includes(k)))), payload }]));
 return payload;
};

test('sold out pending recovery remains enabled and opens existing QRIS without new hold', async () => {
 seed('inv_last');
 store.setInventoryStock({ revision: 500, products: { [product.id]: 0 } });
 app.updateCartUI();
 assert.equal(document.getElementById('btn-checkout').disabled, false);
 const calls = [];
 globalThis.fetch = async (url, options) => { calls.push({ url, options }); return response({ order: owned('inv_last') }); };
 await app.openCheckoutModal();
 assert.equal(document.getElementById('payment-invoice-number').textContent, 'TEST');
 assert.equal(calls.filter(c => c.options.method === 'POST').length, 0);
 app.closeCheckoutModal();
});

test('owned tracker reopens awaiting checkout without reserving again', async () => {
 store.rememberMyOrder('inv_last');
 let posts = 0;
 globalThis.fetch = async (url, options) => { if (options.method === 'POST') posts++; return response({ order: owned('inv_last') }); };
 await app.openOrderTrackerModal();
 assert.equal(document.getElementById('payment-invoice-number').textContent, 'TEST');
 assert.equal(posts, 0);
 app.closeCheckoutModal();
});

test('owned WhatsApp tracker resumes the same reservation without a POST', async () => {
 seed('inv_wa_resume', 'whatsapp');
 store.rememberMyOrder('inv_wa_resume');
 store.saveOrder({ ...owned('inv_wa_resume'), payment: { method: 'whatsapp', payload: store.DEMO_STATIC_QRIS } }, { fromCloud: true });
 store.saveOrder({ ...owned('inv_last'), status: 'completed', updatedAt: 100 }, { fromCloud: true });
 let posts = 0;
 globalThis.fetch = async (url, options) => { if (options.method === 'POST') posts++; return response({ order: { ...owned('inv_wa_resume'), payment: { method: 'whatsapp', payload: store.DEMO_STATIC_QRIS } } }); };
 await app.openOrderTrackerModal();
 assert.equal(posts, 0);
 assert.match(document.getElementById('checkout-whatsapp-link').href || '', /No.%20Invoice/);
});

test('blurred dirty settings form survives dashboard polling', () => {
 app.refreshAdminDashboard();
 const input = document.getElementById('admin-storefront-hours');
 input.value = 'unsaved hours';
 handlers.get('input')?.({ target: input });
 document.activeElement = null;
 app.refreshAdminDashboard();
 assert.equal(input.value, 'unsaved hours');
});

test('missing inventory snapshot clears QR and copy state instead of using current config', () => {
 app.switchQRISDisplayMode('dynamic', { ...owned('inv_missing'), payment: { payload: '' } });
 assert.match(document.getElementById('qris-svg-container').textContent, /QRIS.*belum tersedia/);
});

test('WhatsApp blocked popup preserves cart and offers explicit link without sent claim', async () => {
 seed('inv_wa', 'whatsapp');
 const originalCart = [{ key: product.id+'::', productId: product.id, qty: 1 }];
 store.saveCart(originalCart);
 globalThis.fetch = async () => response({ order: { ...owned('inv_wa'), payment: { method: 'whatsapp', payload: store.DEMO_STATIC_QRIS } } });
 await app.checkoutViaWhatsApp();
 assert.deepEqual(store.getCart(), originalCart);
 assert.match(document.getElementById('checkout-whatsapp-link').href, /^https:\/\/wa.me\//);
});
