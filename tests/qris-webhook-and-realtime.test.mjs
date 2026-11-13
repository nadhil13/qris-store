import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { test, beforeEach, afterEach } from 'node:test';

const read = (rel) => readFile(new URL(`../${rel}`, import.meta.url), 'utf8');

const ENV_NAMES = [
  'NODE_ENV',
  'VERCEL_ENV',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'INVENTORY_ADMIN_TOKEN',
  'QRIS_WEBHOOK_SECRET'
];

let savedEnv;
let savedFetch;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_NAMES.map((k) => [k, process.env[k]]));
  savedFetch = globalThis.fetch;
  ENV_NAMES.forEach((k) => delete process.env[k]);
});

afterEach(() => {
  globalThis.fetch = savedFetch;
  for (const k of ENV_NAMES) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

test('parseIndonesianAmount extracts Rupiah totals from GoPay Merchant notifications without timestamp collisions', async () => {
  const { parseIndonesianAmount } = await import('../api/qris-webhook.js');
  assert.equal(parseIndonesianAmount('11:35 Pembayaran QRIS diterima sebesar Rp173.412 dari BUDI'), 173412);
  assert.equal(parseIndonesianAmount('Kamu menerima Rp 54.000,00 via QRIS GoPay Merchant'), 54000);
  assert.equal(parseIndonesianAmount('IDR 1.250.000 berhasil masuk pukul 14:20'), 1250000);
  assert.equal(parseIndonesianAmount({ amount: 88321 }), 88321);
  assert.equal(parseIndonesianAmount({ amount: 'Rp 15.400' }), 15400);
  assert.equal(parseIndonesianAmount('Diterima 88.321 via QRIS'), 88321);
  assert.equal(parseIndonesianAmount('IDR 88,321.00'), 88321);
  assert.equal(parseIndonesianAmount('Pesan tanpa nominal 12:30'), null);
});

test('qris-webhook fails closed without secret/auth before reading body and confirms unique-code & single matching orders', async () => {
  const { default: webhookHandler } = await import('../api/qris-webhook.js');
  const { createLocalInventoryEngine } = await import('../api/lib/local-inventory.js');
  const { PRODUCTS } = await import('../scripts/core/catalog.js');

  let storedSettings = {
    payload: '000201010211',
    merchantName: 'GoPay Toko',
    uniqueCodeEnabled: true,
    qris: { payload: '000201010211', merchantName: 'GoPay Toko', uniqueCodeEnabled: true },
    products: PRODUCTS
  };
  const localEngine = createLocalInventoryEngine({ getSettings: () => storedSettings });

  const callWebhook = async (method, body, headers = {}) => {
    const req = { method, headers, query: {} };
    if (body === 'UNREAD_SENTINEL') {
      Object.defineProperty(req, 'body', { get() { throw new Error('Must fail closed before parsing body'); } });
    } else {
      req.body = body;
    }
    const res = {
      headers: {},
      statusCode: 200,
      setHeader(k, v) { this.headers[k] = v; },
      status(n) { this.statusCode = n; return this; },
      json(v) { this.body = v; return this; },
      end() { return this; }
    };
    await webhookHandler(req, res, { localExecutor: localEngine.execute });
    return res;
  };

  // Unconfigured secret fails closed 503
  assert.equal((await callWebhook('GET')).statusCode, 200);
  assert.equal((await callWebhook('GET')).body.configured, false);
  const unconfigured = await callWebhook('POST', 'UNREAD_SENTINEL');
  assert.equal(unconfigured.statusCode, 503);
  assert.equal(unconfigured.body.code, 'WEBHOOK_NOT_CONFIGURED');

  // Wrong token fails closed 401 before body read
  process.env.QRIS_WEBHOOK_SECRET = 'gopay-webhook-secret';
  assert.equal((await callWebhook('GET')).body.configured, true);
  assert.equal((await callWebhook('POST', 'UNREAD_SENTINEL', { authorization: 'Bearer wrong' })).statusCode, 401);

  // Reserve two identical-item orders -> uniqueCode makes totals distinct!
  const cap = () => Array.from(webcrypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
  const reserve = (id) => localEngine.execute({
    action: 'reserve',
    id,
    capabilityHash: 'a'.repeat(64),
    fingerprint: `fp-${id}`,
    items: [{ productId: 'prod-01', variant: 'Level 0: Ramah Anak', qty: 1, note: '' }],
    customer: { name: 'Pembeli', phone: '081234567890', address: '' },
    shippingId: 'pickup',
    voucherCode: '',
    paymentMethod: 'qris',
    commerce: { shipping: [{ id: 'pickup', name: 'Ambil di toko', price: 0, eta: '30m' }], vouchers: [], packagingFee: 2000 }
  });

  const first = reserve('ord_u1');
  const second = reserve('ord_u2');
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.ok(first.order.totals.uniqueCode >= 101 && first.order.totals.uniqueCode <= 999);
  assert.ok(second.order.totals.uniqueCode >= 101 && second.order.totals.uniqueCode <= 999);
  assert.notEqual(first.order.totals.total, second.order.totals.total);
  const stockAfterReserve = second.stock.products['prod-01'];

  // Forward GoPay Merchant notification matching first order
  const paidRes = await callWebhook(
    'POST',
    { text: `Pembayaran QRIS masuk Rp${first.order.totals.total.toLocaleString('id-ID')} via GoPay Merchant`, reference: 'GP-991' },
    { authorization: 'Bearer gopay-webhook-secret' }
  );
  assert.equal(paidRes.statusCode, 200);
  assert.equal(paidRes.body.ok, true);
  assert.equal(paidRes.body.order.id, 'ord_u1');
  assert.equal(paidRes.body.order.status, 'paid');
  assert.equal(paidRes.body.order.payment.confirmedBy, 'gopay_merchant_webhook');
  assert.equal(paidRes.body.order.payment.reference, 'GP-991');
  assert.equal(paidRes.body.stock.products['prod-01'], stockAfterReserve, 'Paid webhook must consume hold without double decrement');

  // When uniqueCodeEnabled is false and two active orders share the exact amount, webhook fails closed AMBIGUOUS_AMOUNT
  storedSettings = { ...storedSettings, uniqueCodeEnabled: false, qris: { ...storedSettings.qris, uniqueCodeEnabled: false } };
  const d1 = reserve('ord_dup1');
  const d2 = reserve('ord_dup2');
  assert.equal(d1.order.totals.uniqueCode ?? 0, 0);
  assert.equal(d1.order.totals.total, d2.order.totals.total);
  const dupRes = await callWebhook(
    'POST',
    { amount: d1.order.totals.total },
    { 'x-webhook-secret': 'gopay-webhook-secret' }
  );
  assert.equal(dupRes.statusCode, 409);
  assert.equal(dupRes.body.code, 'AMBIGUOUS_AMOUNT');

  // Re-enable uniqueCodeEnabled, then verify unescaped newline in MacroDroid JSON string parses cleanly and logs for admin
  storedSettings = { ...storedSettings, uniqueCodeEnabled: true, qris: { ...storedSettings.qris, uniqueCodeEnabled: true } };
  const streamOrder = reserve('ord_stream');
  assert.equal(streamOrder.ok, true);
  const brokenJsonWithNewline = `{"title":"GoPay Merchant","text":"Pembayaran masuk\nRp ${streamOrder.order.totals.total.toLocaleString('id-ID')} dari BCA","message":""}`;
  const brokenRes = await callWebhook(
    'POST',
    brokenJsonWithNewline,
    { 'x-webhook-secret': 'gopay-webhook-secret' }
  );
  assert.equal(brokenRes.statusCode, 200);
  assert.equal(brokenRes.body.order.status, 'paid');

  // Admin-authenticated GET returns recentEvents while unauthenticated GET omits recentEvents
  process.env.INVENTORY_ADMIN_TOKEN = 'admin-panel-secret';
  const pubGet = await callWebhook('GET');
  assert.equal(pubGet.body.recentEvents, undefined);
  const adminGet = await callWebhook('GET', null, { authorization: 'Bearer admin-panel-secret' });
  assert.ok(Array.isArray(adminGet.body.recentEvents));
  assert.equal(adminGet.body.recentEvents[0].code, 'CONFIRMED');
});

test('syncInventory prunes stale 404 ORDER_NOT_FOUND reservations & setInventoryStock broadcasts snapshot', async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k)
  };
  globalThis.window = { location: { protocol: 'https:' }, addEventListener() {} };

  const store = await import(`../scripts/core/store.js?sync=${Date.now()}`);
  const inventory = await import(`../scripts/core/inventory.js?sync=${Date.now()}`);

  const broadcasts = [];
  store.subscribe((change) => broadcasts.push(change));
  store.setInventoryStock({ revision: 9, products: { 'prod-01': 11 } });
  const stockEvent = broadcasts.findLast((c) => c.domain === 'products' && c.type === 'inventory-stock');
  assert.equal(stockEvent?.snapshot?.products?.['prod-01'], 11);

  // Seed an orphaned non-pending reservation whose server record returns 404 ORDER_NOT_FOUND
  storage.set('an.inventory.reservations.v1', JSON.stringify([
    {
      pending: false,
      createdAt: Date.now() - 60000,
      signature: JSON.stringify({ items: [] }),
      payload: { action: 'reserve', id: 'inv_9b95b9e75b', capability: 'c'.repeat(64), items: [] }
    }
  ]));
  storage.set('an.myOrders', JSON.stringify(['inv_9b95b9e75b']));

  let orderPollCount = 0;
  globalThis.fetch = async (url) => {
    if (url.includes('action=stock')) {
      return { ok: true, status: 200, json: async () => ({ ok: true, stock: { revision: 10, products: { 'prod-01': 11 } } }) };
    }
    if (url.includes('action=order')) {
      orderPollCount++;
      return { ok: false, status: 404, json: async () => ({ ok: false, code: 'ORDER_NOT_FOUND' }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };

  await inventory.syncInventory();
  await inventory.syncInventory();
  assert.equal(orderPollCount, 1, 'Orphaned 404 ORDER_NOT_FOUND must be pruned after first 404 and never polled again');
  assert.deepEqual(JSON.parse(storage.get('an.inventory.reservations.v1')), []);
  assert.equal(inventory.formatInventoryError(Object.assign(new Error('ADDRESS_REQUIRED'), { code: 'ADDRESS_REQUIRED' })), 'Alamat pengantaran wajib diisi untuk kurir pilihan Anda.');
});

test('checkout customer validation prevents 400 POST, .sr-only hides voucher label, and admin notifies on incoming orders', async () => {
  const [css, html] = await Promise.all([read('styles/main.css'), read('index.html')]);
  assert.match(css, /\.sr-only\s*\{[^}]*position:\s*absolute;/);
  assert.match(css, /\.customer-field-error/);
  assert.match(css, /#admin-live-alert-banner|\.admin-live-alert/);
  assert.match(html, /id="admin-live-alert-banner"/);
  assert.match(html, /id="admin-orders-nav-badge"/);

  const elements = new Map();
  const makeEl = (id) => ({
    id,
    value: '',
    defaultValue: '',
    textContent: '',
    _html: '',
    checked: false,
    disabled: false,
    hidden: id === 'admin-live-alert-banner' || id === 'admin-orders-nav-badge',
    attrs: {},
    style: {},
    dataset: {},
    classes: new Set(),
    parentElement: null,
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] ?? null; },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener() {},
    removeEventListener() {},
    scrollIntoView() {},
    focus() {},
    matches: () => false,
    contains: () => false,
    querySelector: () => null,
    querySelectorAll: () => [],
    classList: {
      add(c) { this._classes?.add(c); },
      remove(c) { this._classes?.delete(c); },
      toggle(c, f) { if (f) this._classes?.add(c); else this._classes?.delete(c); },
      contains(c) { return Boolean(this._classes?.has(c)); },
      get _classes() { return elements.get(id)?.classes; }
    }
  });
  const getEl = (id) => {
    if (!elements.has(id)) {
      const el = makeEl(id);
      el.parentElement = globalThis.document?.body || null;
      elements.set(id, el);
    }
    return elements.get(id);
  };
  const storage = new Map();
  globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) };
  globalThis.document = {
    body: { children: [], style: {}, querySelector: () => null, querySelectorAll: () => [], classList: { add() {}, remove() {} } },
    activeElement: null,
    visibilityState: 'visible',
    addEventListener() {},
    removeEventListener() {},
    getElementById: getEl,
    querySelector: () => null,
    querySelectorAll: () => []
  };
  globalThis.window = {
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    location: { protocol: 'https:', origin: 'https://qris-store.vercel.app', search: '', hash: '' },
    addEventListener() {},
    removeEventListener() {}
  };
  globalThis.requestAnimationFrame = () => {};

  const nativeSetInterval = globalThis.setInterval;
  globalThis.setInterval = (...args) => {
    const timer = nativeSetInterval(...args);
    timer.unref?.();
    return timer;
  };
  try {
    const app = await import(`../scripts/app.js?ui=${Date.now()}`);
    const auth = await import('../scripts/core/auth.js');

    app.addToCart(app.PRODUCTS[0].id, app.PRODUCTS[0].variants?.[0]?.label || '');
    app.selectShippingMethod('instant');
    getEl('customer-name').value = '';
    getEl('customer-phone').value = '081';
    getEl('customer-address').value = '';

    let reserveCalls = 0;
    globalThis.fetch = async (url, options = {}) => {
      if (url === '/api/inventory' && options.method === 'POST') reserveCalls++;
      return { ok: true, status: 200, json: async () => ({ ok: true, stock: { revision: 1, products: {} } }) };
    };

    await app.openCheckoutModal();
    assert.equal(reserveCalls, 0, 'Invalid customer fields must be stopped on client before POST /api/inventory 400');
    assert.equal(getEl('customer-name').classList.contains('is-invalid'), true);
    assert.equal(getEl('customer-phone').classList.contains('is-invalid'), true);
    assert.equal(getEl('customer-address').classList.contains('is-invalid'), true);
    assert.equal(getEl('error-customer-address').hidden, false);

    // Admin real-time alert triggers when a new awaiting order arrives after login
    auth.setInventoryAdminToken('admin-secret');
    const now = Date.now();
    const existing = { id: 'inv_old', invoice: 'AN1', status: 'completed', createdAt: now - 50000, updatedAt: now - 50000, expiresAt: now - 10000, items: [{ name: 'Wagyu', qty: 1 }], totals: { total: 78000 }, customer: { name: 'Lama', phone: '08123456789' }, payment: { method: 'qris' } };
    const incoming = { id: 'inv_new', invoice: 'AN2', status: 'awaiting_payment', createdAt: now, updatedAt: now, expiresAt: now + 600000, items: [{ name: 'Wagyu', qty: 2 }], totals: { total: 158321, uniqueCode: 321 }, customer: { name: 'Rani', phone: '081234567890' }, payment: { method: 'qris' } };
    let step = 0;
    globalThis.fetch = async (url) => {
      if (url === '/api/inventory?action=list') {
        step++;
        return { ok: true, status: 200, json: async () => ({ ok: true, orders: step === 1 ? [existing] : [incoming, existing], stock: { revision: step, products: { 'prod-01': 20 } } }) };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, stock: { revision: step, products: { 'prod-01': 20 } } }) };
    };

    const { listInventoryOrders } = await import('../scripts/core/inventory.js');
    app.state.adminAuthenticated = true;
    await listInventoryOrders();
    app.refreshAdminDashboard();
    await listInventoryOrders();
    app.refreshAdminDashboard();
    assert.equal(getEl('admin-orders-nav-badge').hidden, false);
    assert.equal(getEl('admin-live-alert-banner').hidden, false);
    assert.match(getEl('admin-live-alert-banner').innerHTML, /AN2/);
    assert.match(getEl('admin-live-alert-banner').innerHTML, /Rani/);
    assert.match(getEl('admin-section-payments').innerHTML, /admin-unique-code-toggle/);
    assert.match(getEl('admin-section-payments').innerHTML, /\/api\/qris-webhook/);

    // Turning on uniqueCodeEnabled and immediately applying a new QRIS (even with focus inside #admin-section-payments)
    // must preserve uniqueCodeEnabled, omit full catalog products from the QRIS POST, and force-refresh the preview.
    const store = await import('../scripts/core/store.js');
    const qris = await import('../scripts/qris.js');
    const settingsPosts = [];
    globalThis.fetch = async (url, options = {}) => {
      if (url === '/api/settings' && options.method === 'POST') {
        const body = JSON.parse(options.body);
        settingsPosts.push(body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            settings: {
              updatedAt: body.updatedAt,
              qris: { payload: body.payload, merchantName: body.merchantName, uniqueCodeEnabled: Boolean(body.uniqueCodeEnabled), updatedAt: body.updatedAt },
              store: body.store
            }
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, orders: [incoming, existing], stock: { revision: step, products: { 'prod-01': 20 } } }) };
    };

    await app.toggleUniqueCodeSetting(true);
    assert.equal(store.getSettings().qris.uniqueCodeEnabled, true);

    const paySec = getEl('admin-section-payments');
    const applyBtn = getEl('admin-apply-qris-btn');
    const qrisInput = getEl('admin-custom-qris-input');
    paySec.contains = (target) => target === applyBtn || target === qrisInput;
    globalThis.document.activeElement = applyBtn;

    const rawBody = qris.buildTLV([
      ...qris.parseTLV(store.DEMO_STATIC_QRIS).items.filter((i) => i.tag !== '63' && i.tag !== '59'),
      { tag: '59', value: 'GoPay Merchant Cepat' }
    ]);
    const updatedPayload = `${rawBody}6304${qris.calculateCRC16(`${rawBody}6304`)}`;
    qrisInput.value = updatedPayload;

    await app.adminApplyCustomQRIS();
    assert.equal(store.getSettings().qris.payload, updatedPayload);
    assert.equal(store.getSettings().qris.uniqueCodeEnabled, true, 'replaceQRIS must preserve uniqueCodeEnabled');
    assert.match(paySec.innerHTML, /GoPay Merchant Cepat/, 'Active QRIS preview must refresh immediately without blurring focus');
    assert.equal(settingsPosts.at(-1).products, undefined, 'QRIS-only settings save must not upload full product catalog');
  } finally {
    globalThis.setInterval = nativeSetInterval;
  }
});

test('Cache-busting config: vercel.json disables stale HTML/JS/CSS/SW caching and index.html auto-reloads on SW update', async () => {
  const [vercelRaw, html, sw] = await Promise.all([
    read('vercel.json'),
    read('index.html'),
    read('sw.js')
  ]);
  const vercel = JSON.parse(vercelRaw);

  const rules = new Map((vercel.headers || []).map((h) => [h.source, h.headers || []]));
  for (const source of ['/', '/index.html', '/sw.js', '/scripts/(.*)', '/styles/(.*)']) {
    const cc = rules.get(source)?.find((x) => x.key === 'Cache-Control')?.value || '';
    assert.match(cc, /no-store/, `${source} must disable stale edge/browser caching`);
  }
  assert.match(html, /styles\/main\.css\?v=20261113-v23/);
  assert.match(html, /scripts\/app\.js\?v=20261113-v23/);
  assert.match(html, /controllerchange/);
  assert.match(sw, /atelier-nusantara-cache-v23/);
});

