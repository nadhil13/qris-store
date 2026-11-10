import { test } from 'node:test';
import assert from 'node:assert/strict';
const data = new Map();
globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) };
globalThis.window = { location: { protocol: 'https:' }, addEventListener() {} };
const store = await import('../scripts/core/store.js');
const inventory = await import('../scripts/core/inventory.js');

test('settings rejection preserves local state and carries memory-only bearer token', async () => {
  inventory.setInventoryAdminToken('backend-secret');
  const before = store.getSettings();
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer backend-secret');
    return { ok: false, status: 401, json: async () => ({ ok: false }) };
  };
  await assert.rejects(store.saveSharedSettings({ store: { name: 'Rejected' } }));
  assert.deepEqual(store.getSettings(), before);
  assert.equal(inventory.hasInventoryAdminToken(), false);
  assert.ok(![...data.values()].some(value => value.includes('backend-secret')));
});

test('catalog rejection does not save metadata or advance its version', async () => {
  inventory.setInventoryAdminToken('backend-secret');
  const before = store.getProducts();
  const revision = store.getCatalogVersion();
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ ok: false }) });
  await assert.rejects(store.publishProducts([{ id: 'new', stock: 0 }]));
  assert.deepEqual(store.getProducts(), before);
  assert.equal(store.getCatalogVersion(), revision);
});

test('adjust uses displayed snapshot revision; conflicts refresh but never retry mutation', async () => {
  inventory.setInventoryAdminToken('backend-secret');
  store.setInventoryStock({ revision: 4, products: {} });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'POST') {
      assert.deepEqual(JSON.parse(options.body), { action: 'adjust', productId: 'new', stock: 7, expectedRevision: 4 });
      return { ok: false, status: 409, json: async () => ({ ok: false, code: 'REVISION_CONFLICT' }) };
    }
    return { ok: true, json: async () => ({ ok: true, stock: { revision: 5, products: { new: 2 } } }) };
  };
  await assert.rejects(inventory.adjustInventoryStock('new', 7, 4), /REVISION_CONFLICT/);
  assert.equal(calls.length, 2);
  assert.equal(store.getInventoryStock().revision, 5);
});

test('initialization accepts null and waits for authoritative acknowledgement', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer backend-secret');
    assert.equal(JSON.parse(options.body).stock, null);
    return { ok: true, json: async () => ({ ok: true, stock: { revision: 6, products: { new: null } } }) };
  };
  await inventory.adjustInventoryStock('new', null, 5);
  assert.equal(store.getInventoryStock().products.new, null);
  await assert.rejects(inventory.adjustInventoryStock('new', -1, 6));
});

test('uninitialized stock is not advertised from catalog metadata', () => {
  store.saveProducts([{ id: 'uninitialized', stock: 99, isAvailable: true }], { fromCloud: true });
  const product = store.getProduct('uninitialized');
  assert.equal(product.stock, 0);
  assert.equal(product.isAvailable, false);
});

test('malformed unauthorized inventory response still clears the token', async () => {
  inventory.setInventoryAdminToken('expired-secret');
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => { throw new SyntaxError('Invalid JSON'); } });
  await assert.rejects(inventory.listInventoryOrders());
  assert.equal(inventory.hasInventoryAdminToken(), false);
});

test('catalog publication sends bearer auth but does not mutate authoritative stock', async () => {
  inventory.setInventoryAdminToken('catalog-secret');
  store.saveProducts([{ id: 'new', stock: 10 }], { fromCloud: true });
  const snapshot = store.getInventoryStock();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/settings');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer catalog-secret');
    const payload = JSON.parse(options.body);
    assert.equal(payload.products[0].stock, 10);
    return { ok: true, json: async () => ({ ok: true, settings: payload }) };
  };
  await store.publishProducts([{ id: 'new', stock: 999, name: 'Edited' }]);
  assert.deepEqual(store.getInventoryStock(), snapshot);
  assert.equal(store.getProduct('new').stock, null);
  assert.equal(store.getProduct('new').name, 'Edited');
});

test('stock reads and adjustments require an authoritative snapshot acknowledgement', async () => {
  inventory.setInventoryAdminToken('catalog-secret');
  const before = store.getInventoryStock();
  for (const stock of [undefined, { revision: -1, products: {} }, { revision: 7, products: [] }, { revision: 7, products: { new: -1 } }]) {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, stock }) });
    await assert.rejects(inventory.refreshInventoryStock(), /stok/i);
    await assert.rejects(inventory.adjustInventoryStock('new', 1, before.revision), /stok/i);
    assert.deepEqual(store.getInventoryStock(), before);
  }
});
