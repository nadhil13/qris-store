import { test } from 'node:test';
import assert from 'node:assert/strict';
const data = new Map();
globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
globalThis.window = { location: { protocol: 'https:' }, addEventListener() {} };
const store = await import('../scripts/core/store.js');
const inventory = await import('../scripts/core/inventory.js');
const payments = await import('../scripts/core/payments.js');
const { statusLabel } = await import('../scripts/core/orders.js');
const order = (id, status = 'awaiting_payment', updatedAt = 1) => ({ id, status, updatedAt, items: [], totals: { total: 100 }, payment: { method: 'qris', payload: store.DEMO_STATIC_QRIS }, expiresAt: Date.now()+600000 });
const response = body => ({ ok: true, status: 200, json: async () => ({ ok: true, ...body }) });
const key = 'an.inventory.reservations.v1';
const seedReservation = (id, pending = true) => data.set(key, JSON.stringify([{ pending, signature: JSON.stringify({ items: [] }), payload: { action: 'reserve', id, capability: 'secret', items: [] } }]));

test('refresh recovers a pending reservation and buyer ownership', async () => {
  seedReservation('inv_recover');
  globalThis.fetch = async () => response({ order: order('inv_recover') });
  await inventory.refreshInventoryOrder('inv_recover');
  assert.equal(JSON.parse(data.get(key))[0].pending, false);
  assert.ok(store.getMyOrderIds().includes('inv_recover'));
});

test('pending reserve retry replays original payload and does not create a changed intent', async () => {
  seedReservation('inv_retry');
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, body: options.body && JSON.parse(options.body) }); return response({ order: order('inv_retry') }); };
  await inventory.reserveInventory({ items: [] });
  assert.equal(calls[0].url.startsWith('/api/inventory?action=order'), true);
  assert.equal(calls.filter(c => c.body).length, 0);
  seedReservation('inv_retry');
  await assert.rejects(inventory.reserveInventory({ items: [{ productId: 'changed' }] }), /sebelumnya/);
});

test('not-found recovery retries same capability while transport ambiguity preserves pending', async () => {
  seedReservation('inv_missing');
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    if (options.method === 'POST') {
      assert.equal(JSON.parse(options.body).id, 'inv_missing');
      return response({ order: order('inv_missing') });
    }
    return { ok: false, status: 404, json: async () => ({ ok: false, code: 'ORDER_NOT_FOUND' }) };
  };
  await inventory.reserveInventory({ items: [] });
  assert.equal(calls, 2);
  assert.equal(JSON.parse(data.get(key))[0].pending, false);
  seedReservation('inv_missing');
  globalThis.fetch = async () => { throw Error('network'); };
  await assert.rejects(inventory.refreshInventoryOrder('inv_missing'));
  assert.equal(JSON.parse(data.get(key))[0].pending, true);
});

test('repeating the same awaiting checkout resumes its hold instead of reserving twice', async () => {
  seedReservation('inv_existing', false);
  store.rememberMyOrder('inv_existing');
  store.saveOrder({ ...order('inv_existing'), inventory: true }, { fromCloud: true });
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push(options.method); return response({ order: order('inv_existing') }); };
  const result = await inventory.reserveInventory({ items: [] });
  assert.equal(result.id, 'inv_existing');
  assert.deepEqual(calls, ['GET']);
});

test('admin orders live only in memory and are cleared by logout', async () => {
  inventory.setInventoryAdminToken('token');
  globalThis.fetch = async () => response({ orders: [order('inv_stranger')] });
  await inventory.listInventoryOrders();
  assert.equal(store.getOrders().some(o => o.id === 'inv_stranger'), false);
  assert.equal(store.getAdminOrder('inv_stranger').id, 'inv_stranger');
  assert.equal([...data.values()].some(v => v.includes('inv_stranger')), false);
  inventory.setInventoryAdminToken('');
  assert.equal(store.getAdminOrder('inv_stranger'), null);
});

test('admin response arriving after logout cannot repopulate the cache', async () => {
  inventory.setInventoryAdminToken('old-session');
  let resolve;
  globalThis.fetch = () => new Promise(done => { resolve = done; });
  const pending = inventory.listInventoryOrders();
  inventory.setInventoryAdminToken('');
  resolve(response({ orders: [order('inv_late_private')] }));
  await assert.rejects(pending, /Sesi/);
  inventory.setInventoryAdminToken('new-session');
  assert.equal(store.getAdminOrder('inv_late_private'), null);
  inventory.setInventoryAdminToken('');
});

test('existing buyer storage contamination migrates using ownership and reservation IDs', () => {
  seedReservation('inv_capability', false);
  data.set(store.STORAGE_KEYS.myOrders, JSON.stringify(['legacy_mine']));
  data.set(store.STORAGE_KEYS.orders, JSON.stringify([order('inv_stranger'), order('inv_capability'), order('legacy_mine'), order('legacy_stranger')]));
  assert.deepEqual(store.getOrders().map(o => o.id), ['inv_capability', 'legacy_mine']);
  assert.equal(data.get(store.STORAGE_KEYS.orders).includes('stranger'), false);
});

test('stale and equal-time regressive inventory reads cannot roll paid back', () => {
  seedReservation('inv_monotonic', false);
  store.saveOrder({ ...order('inv_monotonic', 'paid', 10), inventory: true }, { fromCloud: true });
  store.saveOrder({ ...order('inv_monotonic', 'awaiting_payment', 9), inventory: true }, { fromCloud: true });
  assert.equal(store.getOrder('inv_monotonic').status, 'paid');
  store.saveOrder({ ...order('inv_monotonic', 'awaiting_payment', 10), inventory: true }, { fromCloud: true });
  assert.equal(store.getOrder('inv_monotonic').status, 'paid');
});

test('unknown status has a safe enum fallback and inventory snapshot never falls back to live QRIS', () => {
  assert.equal(statusLabel('<img onerror=alert(1)>'), 'Status tidak dikenal');
  assert.throws(() => payments.buildPaymentPayload({ ...order('inv_no_snapshot'), payment: { payload: '' } }, store.DEMO_STATIC_QRIS), /QRIS/);
  const snapshot = order('inv_snapshot');
  assert.equal(payments.buildPaymentPayload(snapshot, 'invalid-live-config'), payments.buildPaymentPayload(snapshot, store.DEMO_STATIC_QRIS));
});

test('catalog concurrent acknowledgements allocate unique versions and cannot roll metadata back', async () => {
  inventory.setInventoryAdminToken('token');
  const pending = [];
  globalThis.fetch = (url, options) => new Promise(resolve => pending.push({ payload: JSON.parse(options.body), resolve }));
  const a = store.publishProducts([{ id: 'a', name: 'old', stock: null, isAvailable: true }]);
  const b = store.publishProducts([{ id: 'a', name: 'new', stock: null, isAvailable: true }]);
  assert.ok(pending[1].payload.catalogUpdatedAt > pending[0].payload.catalogUpdatedAt);
  pending[1].resolve(response({ settings: pending[1].payload })); await b;
  pending[0].resolve(response({ settings: pending[0].payload })); await a;
  assert.equal(store.getProduct('a').name, 'new');
});

test('newer settings acknowledgement survives reversed response order', async () => {
  const pending = [];
  globalThis.fetch = (url, options) => new Promise(resolve => pending.push({ payload: JSON.parse(options.body), resolve }));
  const a = store.saveSharedSettings({ store: { name: 'old' } });
  const b = store.saveSharedSettings({ store: { name: 'new' } });
  assert.ok(pending[1].payload.updatedAt > pending[0].payload.updatedAt);
  pending[1].resolve(response({ settings: pending[1].payload })); await b;
  pending[0].resolve(response({ settings: pending[0].payload })); await a;
  assert.equal(store.getSettings().store.name, 'new');
});

test('metadata getter does not project missing stock into publication availability', async () => {
  store.setInventoryStock({ revision: 999, products: {} });
  assert.equal(store.getProduct('a').isAvailable, false);
  assert.equal(store.getCatalogProducts()[0].isAvailable, true);
  globalThis.fetch = async (url, options) => response({ settings: JSON.parse(options.body) });
  await store.publishProducts(store.getCatalogProducts().map(p => ({ ...p, name: 'edited' })));
  assert.equal(JSON.parse(data.get(store.STORAGE_KEYS.products))[0].isAvailable, true);
});
