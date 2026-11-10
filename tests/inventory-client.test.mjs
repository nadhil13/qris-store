import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const data = new Map();
globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) };
globalThis.window = { location: { protocol: 'https:' }, addEventListener() {} };
globalThis.crypto ||= webcrypto;
const inventory = await import('../scripts/core/inventory.js');
const store = await import('../scripts/core/store.js');
const input = { items: [{ productId: 'one', qty: 1, variant: '', note: '' }], customer: { name: 'Buyer', phone: '08123456789', address: '' }, shippingId: 'pickup', voucherCode: '', paymentMethod: 'qris' };

test('ambiguous reservation retries use durable identical payload and canonical response without legacy upload', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/inventory');
    const payload = JSON.parse(options.body); calls.push(payload);
    assert.ok([...data.values()].some(raw => raw.includes(payload.capability) && raw.includes(payload.id)));
    if (calls.length === 1) throw Error('connection lost');
    return { ok: true, json: async () => ({ ok: true, order: { id: payload.id, status: 'awaiting_payment', items: [], totals: { total: 123 }, expiresAt: 600001 }, stock: { revision: 1, products: { one: 2 } } }) };
  };
  await assert.rejects(inventory.reserveInventory(input));
  const order = await inventory.reserveInventory(input);
  assert.deepEqual(calls[0], calls[1]);
  assert.match(calls[0].capability, /^[a-zA-Z0-9_-]{43,128}$/);
  assert.equal(order.totals.total, 123);
  assert.equal(store.getOrder(order.id).inventory, true);
  assert.equal(store.updateOrder(order.id, o => ({ ...o, status: 'paid' })), null);
  store.sweepExpiredOrders(9999999999999);
  assert.equal(store.getOrder(order.id).status, 'awaiting_payment');
  assert.equal(store.mergeRemoteOrders([{ ...order, status: 'paid', updatedAt: 9999999999999 }]).changed.length, 0);
  store.pushOrderToCloud(store.getOrder(order.id));
  assert.equal(calls.length, 2);
});

test('stock overlays never get published as catalog metadata', () => {
  store.saveProducts([{ id: 'one', stock: 9 }], { fromCloud: true });
  assert.equal(store.getProducts()[0].stock, 2);
  assert.equal(JSON.parse(data.get(store.STORAGE_KEYS.products))[0].stock, 9);
});

test('protected transitions wait for server acknowledgement and never mutate on rejection', async () => {
  const payments = await import('../scripts/core/payments.js');
  const order = store.getOrders()[0];
  inventory.setInventoryAdminToken('test-admin-token');
  let respond;
  globalThis.fetch = (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-admin-token');
    assert.equal(JSON.parse(options.body).action, 'confirm');
    return new Promise(resolve => { respond = resolve; });
  };
  const pending = payments.confirmPayment(order.id);
  assert.equal(store.getOrder(order.id).status, 'awaiting_payment');
  respond({ ok: false, status: 409, json: async () => ({ ok: false, code: 'INVALID_TRANSITION' }) });
  assert.equal((await pending).ok, false);
  assert.equal(store.getOrder(order.id).status, 'awaiting_payment');
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, order: { ...order, status: 'paid' } }) });
  assert.equal((await payments.confirmPayment(order.id)).order.status, 'paid');
  assert.equal(store.getProducts()[0].stock, 2);
  inventory.setInventoryAdminToken('');
  assert.equal((await payments.cancelOrderById(order.id)).ok, false);
});

test('no durable storage means no reservation request', async () => {
  globalThis.localStorage = { getItem() { return null; }, setItem() { throw Error('quota'); } };
  globalThis.fetch = () => assert.fail('must not request before persistence');
  await assert.rejects(inventory.reserveInventory({ ...input, voucherCode: 'changed' }));
});
