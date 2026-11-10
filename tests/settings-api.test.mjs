import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

const envNames = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'NODE_ENV', 'VERCEL_ENV', 'INVENTORY_ADMIN_TOKEN'];
let savedEnv;
let savedFetch;
let handler;
let instance = 0;

beforeEach(async () => {
  savedEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  savedFetch = globalThis.fetch;
  for (const name of envNames) delete process.env[name];
  ({ default: handler } = await import(`../api/settings.js?test=${++instance}`));
  globalThis.fetch = async () => { throw new Error('Unexpected network request'); };
});

afterEach(() => {
  globalThis.fetch = savedFetch;
  for (const name of envNames) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});

function configureKV(prefix = 'KV_REST_API') {
  process.env[`${prefix}_URL`] = 'https://redis.example';
  process.env[`${prefix}_TOKEN`] = 'test-token';
}

async function request(method, body, headers = {}) {
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() {}
  };
  await handler({ method, body, headers }, response);
  return response;
}

test('memory mode preserves independent settings and catalog versions without clobbering', async () => {
  const settingsRes = await request('POST', {
    updatedAt: 100,
    payload: '000201010211',
    merchantName: 'Toko Satu',
    store: { name: 'Toko Satu', whatsapp: '628111111111' }
  });
  assert.equal(settingsRes.statusCode, 200);
  assert.equal(settingsRes.body.ok, true);
  assert.equal(settingsRes.body.settings.updatedAt, 100);
  assert.equal(settingsRes.body.settings.store.whatsapp, '628111111111');

  const catalogRes = await request('POST', {
    catalogUpdatedAt: 200,
    products: [{ id: 'p-1', name: "Wagyu Se'i", price: 65000, stock: 4, available: true }]
  });
  assert.equal(catalogRes.statusCode, 200);
  assert.equal(catalogRes.body.ok, true);
  assert.equal(catalogRes.body.settings.updatedAt, 100, 'Catalog save must not overwrite settings version');
  assert.equal(catalogRes.body.settings.store.whatsapp, '628111111111', 'Catalog save must preserve store settings');
  assert.equal(catalogRes.body.settings.catalogUpdatedAt, 200);
  assert.equal(catalogRes.body.settings.products.length, 1);
  assert.equal(catalogRes.body.settings.products[0].stock, 4);

  // Subsequent settings save must not wipe catalog
  const settingsRes2 = await request('POST', {
    updatedAt: 150,
    payload: '000201010211',
    merchantName: 'Toko Dua',
    store: { name: 'Toko Dua', whatsapp: '628222222222' }
  });
  assert.equal(settingsRes2.statusCode, 200);
  assert.equal(settingsRes2.body.settings.updatedAt, 150);
  assert.equal(settingsRes2.body.settings.catalogUpdatedAt, 200);
  assert.equal(settingsRes2.body.settings.products.length, 1);
  assert.equal(settingsRes2.body.settings.products[0].id, 'p-1');
});

test('stale settings or stale catalog versions are rejected independently', async () => {
  await request('POST', {
    updatedAt: 300,
    store: { name: 'Terbaru', whatsapp: '628999999999' },
    catalogUpdatedAt: 400,
    products: [{ id: 'p-fresh', name: 'Kopi', price: 25000, stock: 10 }]
  });

  const staleSettings = await request('POST', {
    updatedAt: 250,
    store: { name: 'Lama', whatsapp: '628000000000' }
  });
  assert.equal(staleSettings.statusCode, 200);
  assert.equal(staleSettings.body.stale, true);
  assert.equal(staleSettings.body.settings.store.name, 'Terbaru');

  const staleCatalog = await request('POST', {
    catalogUpdatedAt: 350,
    products: [{ id: 'p-old', name: 'Lama', price: 10000, stock: 1 }]
  });
  assert.equal(staleCatalog.statusCode, 200);
  assert.equal(staleCatalog.body.staleCatalog, true);
  assert.equal(staleCatalog.body.settings.products[0].id, 'p-fresh');
});

test('empty product catalog array is persisted as valid state', async () => {
  await request('POST', {
    catalogUpdatedAt: 500,
    products: []
  });
  const getRes = await request('GET');
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.settings.catalogUpdatedAt, 500);
  assert.deepEqual(getRes.body.settings.products, []);
});

test('configured KV failure returns 503 instead of silently reporting success', async () => {
  configureKV();
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });

  const getRes = await request('GET');
  assert.equal(getRes.statusCode, 503);
  assert.equal(getRes.body.ok, false);

  const postRes = await request('POST', {
    updatedAt: 100,
    store: { name: 'Toko KV' }
  });
  assert.equal(postRes.statusCode, 503);
  assert.equal(postRes.body.ok, false);
});

test('configured KV uses atomic EVAL script to merge settings and catalog', async () => {
  configureKV();
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null });
    return {
      ok: true,
      json: async () => ({
        result: JSON.stringify({
          payload: '000201010211',
          merchantName: 'Toko KV',
          updatedAt: 700,
          store: { name: 'Toko KV', whatsapp: '628777777777' },
          catalogUpdatedAt: 800,
          products: [{ id: 'p-kv', name: 'Matcha', price: 42000, stock: 6 }],
          stale: false,
          staleCatalog: false
        })
      })
    };
  };

  const postRes = await request('POST', {
    catalogUpdatedAt: 800,
    products: [{ id: 'p-kv', name: 'Matcha', price: 42000, stock: 6 }]
  });
  assert.equal(postRes.statusCode, 200);
  assert.equal(postRes.body.storage, 'kv');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body[0], 'EVAL');
  assert.equal(calls[0].body[2], 1);
  assert.equal(calls[0].body[3], 'atelier_settings');
  assert.equal(postRes.body.settings.catalogUpdatedAt, 800);
  assert.equal(postRes.body.settings.products[0].id, 'p-kv');
  const input = JSON.parse(calls[0].body[4]);
  assert.equal(input.hasStoreInput, false, 'Catalog publication must preserve the store');
  assert.equal(input.productsJson, JSON.stringify(input.products));
});

test('KV rejects malformed EVAL acknowledgements rather than reporting success', async () => {
  configureKV();
  for (const result of [null, {}, 'null', JSON.stringify({ payload: 'qr', products: {} })]) {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ result }) });
    const response = await request('POST', { products: [], catalogUpdatedAt: 900 });
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.ok, false);
  }
});

for (const productionEnv of ['NODE_ENV', 'VERCEL_ENV']) {
  test(`${productionEnv}: production requires KV without reading or changing memory`, async () => {
    await request('POST', { updatedAt: 100, store: { name: 'Local only' } });
    process.env[productionEnv] = 'production';
    process.env.INVENTORY_ADMIN_TOKEN = 'admin-secret';
    for (const method of ['GET', 'POST']) {
      const response = await request(method, { updatedAt: 200, store: { name: 'Blocked' } }, { authorization: 'Bearer admin-secret' });
      assert.equal(response.statusCode, 503);
      assert.deepEqual(response.body, { ok: false, code: 'STORAGE_UNAVAILABLE', error: 'Settings storage unavailable' });
    }
    delete process.env[productionEnv];
    assert.equal((await request('GET')).body.settings.store.name, 'Local only');
  });

  test(`${productionEnv}: production settings GET remains public and canonical`, async () => {
    process.env[productionEnv] = 'production';
    configureKV('UPSTASH_REDIS_REST');
    const record = { payload: 'qr', merchantName: 'Public Store', updatedAt: 100, store: { name: 'Public Store' }, catalogUpdatedAt: 200, products: [] };
    globalThis.fetch = async (url) => {
      assert.equal(url, 'https://redis.example/get/atelier_settings');
      return { ok: true, json: async () => ({ result: JSON.stringify(record) }) };
    };
    const response = await request('GET');
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      ok: true, storage: 'kv', source: 'cloud',
      settings: { updatedAt: 100, qris: { payload: 'qr', merchantName: 'Public Store', updatedAt: 100 }, store: record.store, catalogUpdatedAt: 200, products: [] }
    });
  });

  test(`${productionEnv}: production settings POST requires admin token before parsing or writing`, async () => {
    process.env[productionEnv] = 'production';
    configureKV();
    let calls = 0;
    const record = { payload: 'qr', merchantName: 'Admin Store', updatedAt: 100, store: null, catalogUpdatedAt: 200, products: [] };
    globalThis.fetch = async (_url, options) => {
      calls++;
      const command = JSON.parse(options.body);
      assert.equal(command[0], 'EVAL');
      assert.equal(command[3], 'atelier_settings');
      return { ok: true, json: async () => ({ result: JSON.stringify(record) }) };
    };
    const unavailable = await request('POST', '{invalid');
    assert.equal(unavailable.statusCode, 503);
    assert.deepEqual(unavailable.body, { ok: false, code: 'ADMIN_UNAVAILABLE' });
    process.env.INVENTORY_ADMIN_TOKEN = 'admin-secret';
    for (const authorization of [undefined, 'admin-secret', 'Basic admin-secret', 'Bearer ', 'Bearer wrong-secret', 'Bearer x', ['Bearer admin-secret']]) {
      const denied = await request('POST', '{invalid', { authorization });
      assert.equal(denied.statusCode, 401);
      assert.deepEqual(denied.body, { ok: false, code: 'UNAUTHORIZED' });
    }
    assert.equal(calls, 0);
    const allowed = await request('POST', record, { authorization: 'Bearer admin-secret' });
    assert.equal(allowed.statusCode, 200);
    assert.equal(allowed.body.storage, 'kv');
    assert.equal(allowed.body.settings.catalogUpdatedAt, 200);
    assert.deepEqual(allowed.body.settings.products, []);
    assert.equal(calls, 1);
    assert.match(allowed.headers['Access-Control-Allow-Headers'], /Authorization/i);
    assert.equal((await request('OPTIONS')).statusCode, 204);
  });
}
