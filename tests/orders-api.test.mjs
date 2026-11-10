import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

const envNames = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'NODE_ENV', 'VERCEL_ENV', 'INVENTORY_ADMIN_TOKEN'];
let savedEnv;
let savedFetch;
let handler;
let mergeOrder;
let instance = 0;

beforeEach(async () => {
  savedEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  savedFetch = globalThis.fetch;
  for (const name of envNames) delete process.env[name];
  ({ default: handler, mergeOrder } = await import(`../api/orders.js?test=${++instance}`));
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

function order(overrides = {}) {
  return { id: 'order-1', status: 'awaiting', items: [], totals: { total: 100 }, createdAt: 10, updatedAt: 10, ...overrides };
}

async function request(method, incoming, headers = {}) {
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() {}
  };
  await handler({ method, body: incoming ? { order: incoming } : undefined, headers }, response);
  return response;
}

for (const prefix of ['KV_REST_API', 'UPSTASH_REDIS_REST']) {
  test(`${prefix}: POST submits one EVAL command using the legacy key and incoming order`, async () => {
    configureKV(prefix);
    const calls = [];
    globalThis.fetch = async (...args) => {
      calls.push(args);
      return { ok: true, json: async () => ({ result: 1 }) };
    };
    const incoming = order();
    const response = await request('POST', incoming);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { ok: true, storage: 'kv', id: 'order-1' });
    assert.equal(calls.length, 1, 'No client-side GET/SET read-modify-write');
    const [url, options] = calls[0];
    assert.equal(url, 'https://redis.example');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.ok(options.signal instanceof AbortSignal);
    const [command, script, keyCount, key, payload, limit] = JSON.parse(options.body);
    assert.equal(command, 'EVAL');
    assert.equal(typeof script, 'string');
    assert.ok(script.length > 0);
    assert.equal(keyCount, 1);
    assert.equal(key, 'atelier_orders');
    assert.deepEqual(JSON.parse(payload), incoming);
    assert.equal(Number(limit), 200);
  });
}

test('existing merge rejects stale updates, accepts newer and equal timestamps', () => {
  const paid = order({ status: 'paid', updatedAt: 20 });
  const existing = [paid];
  assert.strictEqual(mergeOrder(existing, order()), existing);
  assert.deepEqual(existing, [paid]);
  assert.equal(mergeOrder(existing, order({ updatedAt: 21 }))[0].status, 'awaiting');
  assert.equal(mergeOrder(existing, order({ updatedAt: 20 }))[0].status, 'awaiting');
});

test('existing merge sorts additions by createdAt and retains at most 200 orders', () => {
  const existing = Array.from({ length: 200 }, (_, i) => order({ id: `old-${i}`, createdAt: i }));
  const merged = mergeOrder(existing, order({ createdAt: 201 }));
  assert.equal(merged.length, 200);
  assert.equal(merged[0].id, 'order-1');
  assert.equal(merged.at(-1).id, 'old-1');
  assert.equal(existing.length, 200);
});

test('without KV, memory mode is explicit and protects newer updates', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('No network in memory mode'); };
  const paid = order({ status: 'paid', updatedAt: 20 });
  assert.deepEqual((await request('POST', paid)).body, { ok: true, storage: 'memory', id: paid.id });
  await request('POST', order());
  const response = await request('GET');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true, storage: 'memory', orders: [paid] });
  assert.equal(calls, 0);
});

test('KV GET reads the existing serialized array', async () => {
  configureKV();
  const existing = [order({ status: 'paid' })];
  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://redis.example/get/atelier_orders');
    return { ok: true, json: async () => ({ result: JSON.stringify(existing) }) };
  };
  assert.deepEqual((await request('GET')).body, { ok: true, storage: 'kv', orders: existing });
});

test('a missing KV key returns an empty list, never process memory', async () => {
  await request('POST', order());
  configureKV();
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: null }) });
  assert.deepEqual((await request('GET')).body, { ok: true, storage: 'kv', orders: [] });
});

for (const method of ['GET', 'POST']) {
  for (const failure of ['HTTP', 'Redis', 'network', 'invalid JSON', 'invalid result']) {
    test(`${method}: configured KV ${failure} failure returns 503 without memory success`, async () => {
      const prior = order({ id: 'memory-only' });
      await request('POST', prior);
      configureKV();
      globalThis.fetch = async () => {
        if (failure === 'network') throw new Error('Connection failed');
        return {
          ok: failure !== 'HTTP',
          status: failure === 'HTTP' ? 500 : 200,
          json: async () => {
            if (failure === 'invalid JSON') throw new SyntaxError('Invalid JSON');
            if (failure === 'Redis') return { error: 'ERR denied', result: 'OK' };
            if (failure === 'invalid result') return {};
            return { result: method === 'GET' ? null : 1 };
          }
        };
      };
      const response = await request(method, order());
      assert.equal(response.statusCode, 503);
      assert.equal(response.body.ok, false);
      assert.equal(response.body.storage, undefined);
      assert.equal(typeof response.body.error, 'string');
      for (const name of envNames) delete process.env[name];
      assert.deepEqual((await request('GET')).body.orders, [prior]);
    });
  }
}

test('Redis stale/no-op acknowledgement is a durable success', async () => {
  configureKV();
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: 0 }) });
  const response = await request('POST', order());
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.storage, 'kv');
});

for (const productionEnv of ['NODE_ENV', 'VERCEL_ENV']) {
  test(`${productionEnv}: production requires KV and never exposes or mutates memory`, async () => {
    await request('POST', order());
    process.env[productionEnv] = 'production';
    process.env.INVENTORY_ADMIN_TOKEN = 'admin-secret';
    for (const method of ['GET', 'POST']) {
      const response = await request(method, order({ id: 'blocked' }), { authorization: 'Bearer admin-secret' });
      assert.equal(response.statusCode, 503);
      assert.deepEqual(response.body, { ok: false, code: 'STORAGE_UNAVAILABLE', error: 'Order storage unavailable' });
    }
    delete process.env[productionEnv];
    assert.deepEqual((await request('GET')).body.orders, [order()]);
  });

  test(`${productionEnv}: production disables all legacy writes before storage access`, async () => {
    process.env[productionEnv] = 'production';
    configureKV();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('Must not access KV'); };
    for (const headers of [{}, { authorization: 'Bearer admin-secret' }]) {
      process.env.INVENTORY_ADMIN_TOKEN = 'admin-secret';
      const response = await request('POST', order(), headers);
      assert.equal(response.statusCode, 409);
      assert.deepEqual(response.body, { ok: false, code: 'LEGACY_ORDER_WRITES_DISABLED' });
    }
    assert.equal(calls, 0);
  });

  test(`${productionEnv}: production legacy reads require admin authentication`, async () => {
    process.env[productionEnv] = 'production';
    configureKV();
    let calls = 0;
    const existing = [order({ customer: { phone: 'private' } })];
    globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ result: JSON.stringify(existing) }) }; };
    const unavailable = await request('GET');
    assert.equal(unavailable.statusCode, 503);
    assert.deepEqual(unavailable.body, { ok: false, code: 'ADMIN_UNAVAILABLE' });
    process.env.INVENTORY_ADMIN_TOKEN = 'admin-secret';
    for (const authorization of [undefined, 'admin-secret', 'Basic admin-secret', 'Bearer ', 'Bearer wrong-secret', 'Bearer x', ['Bearer admin-secret']]) {
      const denied = await request('GET', undefined, { authorization });
      assert.equal(denied.statusCode, 401);
      assert.deepEqual(denied.body, { ok: false, code: 'UNAUTHORIZED' });
    }
    assert.equal(calls, 0);
    const allowed = await request('GET', undefined, { authorization: 'Bearer admin-secret' });
    assert.equal(allowed.statusCode, 200);
    assert.deepEqual(allowed.body, { ok: true, storage: 'kv', orders: existing });
    assert.equal(calls, 1);
    assert.match(allowed.headers['Access-Control-Allow-Headers'], /Authorization/i);
    const preflight = await request('OPTIONS');
    assert.equal(preflight.statusCode, 204);
  });
}