import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { INVENTORY_SCRIPT } from '../api/lib/inventory-script.js';
import { redisCommand } from './helpers/redis-rest-bridge.mjs';

let redis, directory, port, exited;
before(async () => {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  port = listener.address().port;
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  directory = await mkdtemp(path.join(tmpdir(), 'inventory-serialization-'));
  const executable = process.env.INVENTORY_TEST_REDIS_SERVER || path.join(tmpdir(), 'atelier-redis-test', 'redis-server.exe');
  redis = spawn(executable, ['--bind', '127.0.0.1', '--port', String(port), '--protected-mode', 'yes', '--save', '', '--appendonly', 'no', '--dir', directory], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  exited = new Promise(resolve => {
    redis.once('error', error => resolve({ error }));
    redis.once('exit', code => resolve({ code }));
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Isolated Redis startup timed out')), 10000);
    let output = '';
    const ready = chunk => {
      output = (output + chunk.toString()).slice(-8192);
      if (/ready to accept connections/i.test(output)) { clearTimeout(timer); resolve(); }
    };
    redis.stdout.on('data', ready);
    redis.stderr.on('data', ready);
    exited.then(result => { clearTimeout(timer); reject(result.error || Error('Isolated Redis exited before startup')); });
  });
});
after(async () => {
  try {
    if (redis && redis.exitCode === null && redis.signalCode === null && redis.pid) {
      redis.kill();
      await exited;
    }
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
});

const productIds = ['items', 'timeline', 'orders', 'stock', 'holds', 'quantities', '1', '01', '0', '123'];
const seed = { products: productIds.map(id => ({ id, name: id, price: 100, stock: 5, category: 'digital' })) };
const draft = id => ({
  action: 'reserve', id, capabilityHash: 'a'.repeat(64), fingerprint: 'b'.repeat(64),
  items: productIds.map(productId => ({ productId, variant: '', qty: 2, note: '' })),
  customer: { name: 'Buyer', phone: '081234567890', address: '' },
  paymentMethod: 'qris', shippingId: 'pickup', voucherCode: '',
  commerce: { shipping: [], vouchers: [], packagingFee: 0 }
});
async function fixture(fn, settings = seed, script = INVENTORY_SCRIPT) {
  const prefix = `serialization:{${randomUUID()}}`;
  const keys = [`${prefix}:state`, `${prefix}:settings`];
  const command = (...args) => redisCommand(port, args);
  const run = async input => JSON.parse(await command('EVAL', script, 2, ...keys, JSON.stringify(input)));
  const state = async () => JSON.parse(await command('GET', keys[0]));
  const save = value => command('SET', keys[0], JSON.stringify(value));
  try {
    await command('SET', keys[1], JSON.stringify(settings));
    await fn({ run, state, save, command, keys });
  } finally { await command('DEL', ...keys); }
}
function stockIs(result, quantity) {
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.stock.products, Object.fromEntries(productIds.map(id => [id, quantity])));
}
function orderIs(result, id, status) {
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.order.id, id);
  assert.equal(result.order.status, status);
  assert.equal(result.order.items.length, productIds.length);
  assert.ok(Array.isArray(result.order.timeline));
}

for (const id of ['items', 'timeline', 'orders', '1', '01']) {
  test(`real Redis serialization: reservation ID ${id} survives stock, lookup, retry, confirm, cancel and expiry`, async () => {
    await fixture(async ({ run, state, save, command, keys }) => {
      const input = draft(id);
      orderIs(await run(input), id, 'awaiting_payment');
      stockIs(await run({ action: 'stock' }), 3);
      const stored = await state();
      assert.equal(Array.isArray(stored.orders), false);
      assert.equal(Array.isArray(stored.holds), false);
      assert.equal(Array.isArray(stored.orders[id]), false);
      assert.equal(Array.isArray(stored.holds[id]), false);
      assert.deepEqual(stored.orders[id].quantities, Object.fromEntries(productIds.map(pid => [pid, 2])));
      assert.deepEqual(stored.holds[id].quantities, stored.orders[id].quantities);
      orderIs(await run({ action: 'order', id, capabilityHash: input.capabilityHash }), id, 'awaiting_payment');
      stockIs(await run(input), 3);
      const listed = await run({ action: 'list' });
      assert.equal(listed.orders.length, 1);
      assert.equal(listed.orders[0].id, id);
      orderIs(await run({ action: 'confirm', id, reference: 'checked' }), id, 'paid');
      stockIs(await run({ action: 'confirm', id, reference: 'retry' }), 3);
      stockIs(await run({ action: 'stock' }), 3);
      orderIs(await run({ action: 'cancel', id, note: '' }), id, 'cancelled');
      stockIs(await run({ action: 'cancel', id, note: '' }), 5);
      stockIs(await run({ action: 'stock' }), 5);
      assert.deepEqual((await state()).holds, {});

      await command('DEL', keys[0]);
      orderIs(await run(input), id, 'awaiting_payment');
      const pending = await state();
      pending.holds[id].expiresAt = 0;
      pending.orders[id].order.expiresAt = 0;
      await save(pending);
      stockIs(await run({ action: 'stock' }), 5);
      orderIs(await run({ action: 'order', id, capabilityHash: input.capabilityHash }), id, 'expired');
      assert.equal((await run({ action: 'confirm', id, reference: '' })).code, 'INVALID_TRANSITION');
      stockIs(await run({ action: 'stock' }), 5);
      assert.deepEqual((await state()).holds, {});
    });
  });
}

test('real Redis: reservations snapshot only the canonical merchant QRIS and retain it after settings change', async () => {
  await fixture(async ({ run, state, command, keys }) => {
    const input = { ...draft('qris_snapshot'), payload: 'client-payload', payment: { payload: 'client-payment-payload' } };
    const reserved = await run(input);
    orderIs(reserved, input.id, 'awaiting_payment');
    assert.equal(reserved.order.payment.payload, 'merchant-static-qris');
    assert.equal((await state()).orders[input.id].order.payment.payload, 'merchant-static-qris');
    await command('SET', keys[1], JSON.stringify({ ...seed, qris: { payload: 'replacement-qris' } }));
    for (const action of [input, { action: 'order', id: input.id, capabilityHash: input.capabilityHash }, { action: 'confirm', id: input.id, reference: '' }]) {
      assert.equal((await run(action)).order.payment.payload, 'merchant-static-qris');
    }
    assert.equal((await run({ action: 'list' })).orders[0].payment.payload, 'merchant-static-qris');
    assert.equal((await state()).orders[input.id].order.payment.payload, 'merchant-static-qris');
    const next = await run({ ...draft('new_snapshot'), paymentMethod: 'whatsapp' });
    assert.equal(next.order.payment.payload, 'replacement-qris');
  }, { ...seed, qris: { payload: 'merchant-static-qris' } });
});

for (const qris of [undefined, null, {}, { payload: null }, { payload: 123 }, { payload: {} }, { payload: [] }, { payload: '' }]) {
  test(`real Redis: missing or non-string QRIS ${JSON.stringify(qris)} stores an empty snapshot for either payment method`, async () => {
    await fixture(async ({ run, state }) => {
      for (const paymentMethod of ['qris', 'whatsapp']) {
        const input = { ...draft(paymentMethod), paymentMethod, payload: 'untrusted-client-payload' };
        const result = await run(input);
        orderIs(result, input.id, 'awaiting_payment');
        assert.equal(result.order.payment.payload, '');
        assert.equal((await state()).orders[input.id].order.payment.payload, '');
      }
    }, { ...seed, qris });
  });
}

const fixedNow = 1800000000000;
const fixedTimeScript = INVENTORY_SCRIPT.replace("redis.call('TIME')", `{1800000000,0}`);
for (const route of ['complete', 'cancel', 'expire']) {
  test(`real Redis: ${route} transitions are strictly monotonic at the same Redis millisecond and retries are unchanged`, async () => {
    assert.notEqual(fixedTimeScript, INVENTORY_SCRIPT, 'fixed clock must replace the Redis TIME call');
    await fixture(async ({ run, state, save }) => {
      const input = draft(`clock_${route}`);
      let previous = (await run(input)).order;
      assert.equal(previous.updatedAt, fixedNow);
      const unchanged = async action => assert.deepEqual((await run(action)).order, previous);
      await unchanged(input);
      const transition = async (action, status) => {
        const result = await run(action);
        orderIs(result, input.id, status);
        assert.equal(result.order.updatedAt, previous.updatedAt + 1);
        assert.equal(result.order.timeline.at(-1).at, result.order.updatedAt);
        assert.equal(result.stock.serverTime, fixedNow);
        assert.equal(result.order.createdAt, fixedNow);
        assert.equal(result.order.payment.payload, 'clock-merchant-qris');
        assert.deepEqual((await state()).orders[input.id].order, result.order);
        previous = result.order;
        return result;
      };
      if (route === 'expire') {
        const stored = await state();
        stored.orders[input.id].order.updatedAt = fixedNow + 100;
        stored.holds[input.id].expiresAt = fixedNow;
        stored.orders[input.id].order.expiresAt = fixedNow;
        await save(stored);
        previous = stored.orders[input.id].order;
        await transition({ action: 'order', id: input.id, capabilityHash: input.capabilityHash }, 'expired');
        await unchanged({ action: 'order', id: input.id, capabilityHash: input.capabilityHash });
      } else {
        const confirm = { action: 'confirm', id: input.id, reference: 'checked' };
        await transition(confirm, 'paid');
        await unchanged({ ...confirm, reference: 'retry' });
        if (route === 'cancel') {
          const cancel = { action: 'cancel', id: input.id, note: 'cancel' };
          await transition(cancel, 'cancelled');
          await unchanged(cancel);
        } else {
          for (const [expectedStatus, status] of [['paid', 'processing'], ['processing', 'ready'], ['ready', 'completed']]) {
            const advance = { action: 'advance', id: input.id, expectedStatus };
            await transition(advance, status);
            await unchanged(advance);
          }
        }
      }
      await unchanged(input);
    }, { ...seed, qris: { payload: 'clock-merchant-qris' } }, fixedTimeScript);
  });
}

test('real Redis: a null optional store does not block a valid reservation', async () => {
  await fixture(async ({ run }) => {
    orderIs(await run(draft('null_store')), 'null_store', 'awaiting_payment');
    stockIs(await run({ action: 'stock' }), 3);
  }, { ...seed, store: null });
});

test('real Redis serialization: only schema arrays remain arrays when empty, including response orders', async () => {
  await fixture(async ({ run, state, save }) => {
    const empty = await run({ action: 'list' });
    assert.deepEqual(empty.orders, []);
    assert.deepEqual((await state()).orders, {});
    assert.deepEqual((await state()).holds, {});
    await run(draft('items'));
    const stored = await state();
    assert.equal(Array.isArray(stored.orders.items), false, 'user-keyed order record must remain an object');
    stored.orders.items.order.items = [];
    stored.orders.items.order.timeline = [];
    await save(stored);
    const listed = await run({ action: 'list' });
    assert.equal(listed.ok, true);
    assert.deepEqual(listed.orders[0].items, []);
    assert.deepEqual(listed.orders[0].timeline, []);
    const lookup = await run({ action: 'order', id: 'items', capabilityHash: 'a'.repeat(64) });
    assert.deepEqual(lookup.order.items, []);
    assert.deepEqual(lookup.order.timeline, []);
    const persisted = await state();
    assert.deepEqual(persisted.orders.items.order.items, []);
    assert.deepEqual(persisted.orders.items.order.timeline, []);
    assert.deepEqual(persisted.orders.items.quantities, Object.fromEntries(productIds.map(id => [id, 2])));
  });
  await fixture(async ({ run, state }) => {
    assert.deepEqual((await run({ action: 'list' })).orders, []);
    assert.deepEqual((await run({ action: 'stock' })).stock.products, {});
    const stored = await state();
    for (const key of ['stock', 'orders', 'holds']) assert.deepEqual(stored[key], {});
  }, { products: [] });
});
