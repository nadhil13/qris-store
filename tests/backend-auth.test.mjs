import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import settings from '../api/settings.js';
import orders from '../api/orders.js';

const names = ['NODE_ENV', 'VERCEL_ENV', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'INVENTORY_ADMIN_TOKEN'];
let savedEnv;
let savedFetch;
beforeEach(() => {
  savedEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));
  names.forEach(name => delete process.env[name]);
  savedFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = savedFetch;
  for (const name of names) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});
async function request(handler, method, authorization) {
  const req = { method, headers: { authorization } };
  Object.defineProperty(req, 'body', { get() { throw new Error('Unauthorized body must not be parsed'); } });
  const res = {
    setHeader() {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }, end() {}
  };
  await handler(req, res);
  return res;
}
for (const environment of ['development', 'preview', 'production']) {
  for (const prefix of ['KV_REST_API', 'UPSTASH_REDIS_REST']) {
    test(`${environment}/${prefix}: durable admin operations fail closed before body or storage access`, async () => {
      process.env.NODE_ENV = environment === 'preview' ? 'development' : environment;
      process.env.VERCEL_ENV = environment;
      process.env[`${prefix}_URL`] = 'https://redis.example';
      process.env[`${prefix}_TOKEN`] = 'test-only-token';
      let calls = 0;
      globalThis.fetch = async () => { calls++; throw new Error('Forbidden storage access'); };
      for (const [handler, method] of [[settings, 'POST'], [orders, 'GET']]) {
        delete process.env.INVENTORY_ADMIN_TOKEN;
        assert.equal((await request(handler, method)).statusCode, 503);
        process.env.INVENTORY_ADMIN_TOKEN = 'test-only-admin';
        for (const authorization of [undefined, 'Basic test-only-admin', 'Bearer ', 'Bearer incorrect', ['Bearer test-only-admin']]) {
          const denied = await request(handler, method, authorization);
          assert.equal(denied.statusCode, 401);
          assert.equal(denied.body.code, 'UNAUTHORIZED');
        }
      }
      for (const authorization of [undefined, 'Bearer incorrect', 'Bearer test-only-admin']) {
        const denied = await request(orders, 'POST', authorization);
        assert.equal(denied.statusCode, 409);
        assert.equal(denied.body.code, 'LEGACY_ORDER_WRITES_DISABLED');
      }
      assert.equal(calls, 0);
      assert.equal((await request(settings, 'OPTIONS')).statusCode, 204);
      assert.equal((await request(orders, 'OPTIONS')).statusCode, 204);

      const record = { payload: 'qr', merchantName: 'Store', updatedAt: 1, store: null, catalogUpdatedAt: 1, products: [] };
      globalThis.fetch = async (url, options) => {
        calls++;
        if (url.endsWith('/get/atelier_orders')) return { ok: true, json: async () => ({ result: '[]' }) };
        if (options?.method === 'POST') assert.equal(JSON.parse(options.body)[0], 'EVAL');
        return { ok: true, json: async () => ({ result: JSON.stringify(record) }) };
      };
      const allowed = await request(orders, 'GET', 'Bearer test-only-admin');
      assert.equal(allowed.statusCode, 200);
      assert.deepEqual(allowed.body.orders, []);
      const response = {
        setHeader() {}, status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
      };
      await settings({ method: 'POST', headers: { authorization: 'Bearer test-only-admin' }, body: record }, response);
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.storage, 'kv');
      const publicSettings = await request(settings, 'GET');
      assert.equal(publicSettings.statusCode, 200);
      assert.deepEqual(publicSettings.body.settings.products, []);
      assert.equal(calls, 3);
    });
  }
}
