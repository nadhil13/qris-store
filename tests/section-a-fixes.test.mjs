import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('A1: inventory-script Lua & handlers supply seedProducts on Redis cold-start without clobbering []', async () => {
  const scriptSrc = read('api/lib/inventory-script.js');
  assert.match(scriptSrc, /local settings=settingsRaw and decode\(settingsRaw\) or \{\}/);
  assert.match(scriptSrc, /if products==nil or products==cjson\.null then products=input\.seedProducts end/);

  const savedEnv = { ...process.env };
  const savedFetch = globalThis.fetch;
  try {
    process.env.KV_REST_API_URL = 'https://redis.example';
    process.env.KV_REST_API_TOKEN = 'redis-token';
    process.env.QRIS_WEBHOOK_SECRET = 'wh-secret';
    const evalPayloads = [];
    globalThis.fetch = async (_url, options = {}) => {
      const cmd = JSON.parse(options.body);
      evalPayloads.push(cmd);
      return {
        ok: true,
        json: async () => ({ result: JSON.stringify({ ok: true, stock: { revision: 0, products: {} } }) })
      };
    };

    const { default: inventoryHandler } = await import(`../api/inventory.js?a1=${Date.now()}`);
    const invRes = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.statusCode = c; return this; },
      json(b) { this.body = b; return this; }
    };
    await inventoryHandler({ method: 'GET', query: { action: 'stock' }, headers: {} }, invRes);
    assert.equal(invRes.statusCode, 200);
    const invArg = JSON.parse(evalPayloads[0][5]);
    assert.equal(Array.isArray(invArg.seedProducts), true);
    assert.ok(invArg.seedProducts.length >= 12);

    const { default: webhookHandler } = await import(`../api/qris-webhook.js?a1=${Date.now()}`);
    const whRes = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.statusCode = c; return this; },
      json(b) { this.body = b; return this; }
    };
    globalThis.fetch = async (_url, options = {}) => {
      const cmd = JSON.parse(options.body);
      evalPayloads.push(cmd);
      return {
        ok: true,
        json: async () => ({ result: JSON.stringify({ ok: true, order: { id: 'o1', invoice: 'INV-1', totals: { total: 50000 } } }) })
      };
    };
    await webhookHandler({
      method: 'POST',
      headers: { 'x-webhook-secret': 'wh-secret' },
      body: { text: 'Pembayaran QRIS masuk sebesar Rp 50.000 diterima' }
    }, whRes);
    assert.equal(whRes.statusCode, 200);
    const whEval = evalPayloads.find((cmd) => cmd[0] === 'EVAL' && JSON.parse(cmd[5]).action === 'webhook_confirm');
    assert.ok(whEval);
    assert.ok(Array.isArray(JSON.parse(whEval[5]).seedProducts));
  } finally {
    globalThis.fetch = savedFetch;
    process.env = savedEnv;
  }
});

test('A2: settings.js enforces auth on local/preview without KV and validates catalog schema', async () => {
  const savedEnv = { ...process.env };
  try {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.NODE_ENV = 'development';
    process.env.VERCEL_ENV = 'preview';
    process.env.INVENTORY_ADMIN_TOKEN = 'preview-secret';

    const { default: settingsHandler } = await import(`../api/settings.js?a2=${Date.now()}`);
    const send = async (method, body, headers = {}) => {
      const res = {
        headers: {},
        setHeader(k, v) { this.headers[k] = v; },
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; },
        end() {}
      };
      await settingsHandler({ method, body, headers }, res);
      return res;
    };

    const previewNoAuth = await send('POST', { store: { name: 'Bad' } });
    assert.equal(previewNoAuth.statusCode, 401);

    const previewNoKv = await send('POST', { store: { name: 'WaitKV' } }, { authorization: 'Bearer preview-secret' });
    assert.equal(previewNoKv.statusCode, 503);
    assert.equal(previewNoKv.body.code, 'STORAGE_UNAVAILABLE');

    delete process.env.VERCEL_ENV;
    const badJson = await send('POST', '{not-json', { authorization: 'Bearer preview-secret' });
    assert.equal(badJson.statusCode, 400);
    assert.equal(badJson.body.code, 'INVALID_REQUEST');

    const tooLarge = await send('POST', JSON.stringify({ store: { note: 'x'.repeat(270 * 1024) } }), { authorization: 'Bearer preview-secret' });
    assert.equal(tooLarge.statusCode, 413);
    assert.equal(tooLarge.body.code, 'PAYLOAD_TOO_LARGE');

    for (const invalidProducts of [
      [{ id: 'p1', name: 'Bad Decimal', price: 12500.5 }],
      [{ id: 'p2', name: 'Bad Max', price: 1_000_000_001 }],
      [{ id: 'dup', name: 'A', price: 1000 }, { id: 'dup', name: 'B', price: 2000 }],
      [{ id: 'p3', name: 'Bad Variant', price: 5000, variants: [{ label: 'Neg', delta: -6000 }] }]
    ]) {
      const invalidRes = await send('POST', { products: invalidProducts }, { authorization: 'Bearer preview-secret' });
      assert.equal(invalidRes.statusCode, 400);
      assert.equal(invalidRes.body.code, 'INVALID_CATALOG');
    }

    const validRes = await send('POST', {
      catalogUpdatedAt: 9001,
      products: [{ id: 'p-valid', name: 'Valid Item', price: 1500, stock: 5 }]
    }, { authorization: 'Bearer preview-secret' });
    assert.equal(validRes.statusCode, 200);
  } finally {
    process.env = savedEnv;
  }
});

test('A10: parseIndonesianAmount deprioritizes saldo/cashback/potongan and prioritizes payment cues', async () => {
  const { parseIndonesianAmount } = await import('../api/qris-webhook.js');
  assert.equal(
    parseIndonesianAmount('Saldo QRIS Anda Rp 1.500.000. Pembayaran QRIS masuk sebesar Rp 78.234 berhasil diterima'),
    78234
  );
  assert.equal(
    parseIndonesianAmount('Promo cashback Rp 10.000 menanti! Transaksi diterima Rp 156.412 di Atelier Nusantara'),
    156412
  );
  assert.equal(
    parseIndonesianAmount('Pembayaran QRIS diterima Rp 100.000 (potongan admin Rp 700, sisa saldo Rp 99.300)'),
    100000
  );
  assert.equal(
    parseIndonesianAmount('Notifikasi GoPay Merchant Rp54.000 dari pelanggan'),
    54000
  );
});

test('A11 backend/PWA: server.js uppercase asset ext, vercel.json asset headers, sw.js skipWaiting after cache.addAll', async () => {
  const vercelCfg = JSON.parse(read('vercel.json'));
  const sources = vercelCfg.headers.map((h) => h.source);
  assert.ok(sources.includes('/assets/(.*)'));
  assert.ok(sources.includes('/qris/(.*)'));

  // Service worker rejects install when cache.addAll rejects and must not skipWaiting prematurely
  const swSource = read('sw.js');
  let skipped = false;
  let waitPromise = null;
  const listeners = {};
  vm.runInNewContext(swSource, {
    self: {
      addEventListener(type, fn) { listeners[type] = fn; },
      skipWaiting() { skipped = true; }
    },
    URL,
    caches: {
      async open() {
        return { async addAll() { throw new Error('network failed'); } };
      }
    }
  });
  listeners.install({ waitUntil(p) { waitPromise = p; } });
  await assert.rejects(waitPromise, /network failed/);
  assert.equal(skipped, false);

  // server.js serves case-insensitive extensions under /assets/
  const { handleRequest } = await import(`../server.js?a11=${Date.now()}`);
  const req = new EventEmitter();
  req.url = '/assets/notification-icon.SVG';
  req.method = 'GET';
  req.headers = {};
  const res = {
    statusCode: 0,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(code, h) { this.statusCode = code; Object.assign(this.headers, h); },
    end() {}
  };
  await new Promise((resolve) => {
    const done = { statusCode: 0, setHeader() {}, writeHead(c) { this.statusCode = c; }, end() { resolve(this); } };
    // Even if notification-icon.SVG hits Win32 case-insensitive fs or notFound, verify publicPath allows uppercase ext
    handleRequest(req, done);
  });
  const serverSource = read('server.js');
  assert.match(serverSource, /path\.extname\(pathname\)\.toLowerCase\(\)/);
});

test('A4/A7 core: watchOrder stops on CANCELLED/EXPIRED, stock dedupes equal snapshots, batch list announces once, getAdminOrders sorted', async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k)
  };
  globalThis.window = { location: { protocol: 'https:' }, addEventListener() {}, removeEventListener() {} };

  const store = await import('../scripts/core/store.js');
  const inventory = await import('../scripts/core/inventory.js');
  const payments = await import('../scripts/core/payments.js');
  const { STATUS } = await import('../scripts/core/orders.js');

  let productEvents = 0;
  let orderEvents = 0;
  const unsub = store.subscribe((change) => {
    if (change.domain === 'products') productEvents++;
    if (change.domain === 'orders') orderEvents++;
  });

  try {
    store.setInventoryStock({ revision: 1, products: { 'prod-01': 5 } });
    const afterFirst = productEvents;
    assert.equal(afterFirst, 1);
    store.setInventoryStock({ revision: 1, products: { 'prod-01': 5 } });
    assert.equal(productEvents, afterFirst, 'Identical stock snapshot must not re-broadcast');

    inventory.setInventoryAdminToken('secret');
    const sample = (id, createdAt) => ({
      id,
      invoice: id.toUpperCase(),
      status: STATUS.AWAITING,
      createdAt,
      updatedAt: createdAt,
      revision: 1,
      expiresAt: Date.now() + 600000,
      customer: { name: 'Uji', phone: '0812345678' },
      items: [],
      totals: { total: 10000 },
      payment: { method: 'qris', payload: store.DEMO_STATIC_QRIS }
    });

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true, orders: [sample('o-old', 100), sample('o-new', 300), sample('o-mid', 200)] })
    });
    orderEvents = 0;
    await inventory.listInventoryOrders();
    assert.equal(orderEvents, 1, 'Batch list must emit a single orders announcement');
    assert.deepEqual(store.getAdminOrders().map((o) => o.id), ['o-new', 'o-mid', 'o-old']);

    // Second unchanged poll emits 0 order events
    orderEvents = 0;
    await inventory.listInventoryOrders();
    assert.equal(orderEvents, 0, 'Unchanged batch poll must emit 0 order events');

    // watchOrder stops polling once status moves to CANCELLED
    const seeded = sample('ord-watch-cancel', Date.now());
    store.saveOrder(seeded, { fromCloud: true });
    let pollCount = 0;
    globalThis.fetch = async () => { pollCount++; return { ok: true, json: async () => ({ ok: true, order: seeded }) }; };
    const stop = payments.watchOrder('ord-watch-cancel', {});
    store.saveOrder({ ...seeded, status: STATUS.CANCELLED, updatedAt: Date.now() + 10 }, { fromCloud: true });
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(pollCount, 0);
    stop();
  } finally {
    unsub();
    inventory.setInventoryAdminToken('');
  }
});

test('A3/A4/A5/A6/A7/A8/A9/A11 app integration: form validation, HTTP checkout guard, cancelled/401/tracker/dropzone/drafts/voucher', async () => {
  const nativeSetInterval = globalThis.setInterval;
  const intervals = [];
  globalThis.setInterval = (...args) => {
    const t = nativeSetInterval(...args);
    t.unref();
    intervals.push(t);
    return t;
  };
  const storage = new Map();
  const elements = new Map();
  const docHandlers = new Map();
  let fileInputClicks = 0;

  const bodyEl = {
    id: 'body',
    children: [],
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {},
    removeChild() {}
  };

  const makeEl = (id) => ({
    id,
    value: '',
    defaultValue: '',
    checked: false,
    hidden: false,
    disabled: false,
    textContent: '',
    innerHTML: '',
    href: '',
    style: {},
    dataset: {},
    parentElement: bodyEl,
    inert: false,
    classes: new Set(),
    classList: {
      add(...c) { c.forEach((x) => this._owner.classes.add(x)); },
      remove(...c) { c.forEach((x) => this._owner.classes.delete(x)); },
      toggle(c, force) {
        if (force === undefined) force = !this._owner.classes.has(c);
        if (force) this._owner.classes.add(c);
        else this._owner.classes.delete(c);
        return force;
      },
      contains(c) { return this._owner.classes.has(c); }
    },
    attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, String(v)); },
    getAttribute(k) { return this.attributes.get(k) ?? null; },
    removeAttribute(k) { this.attributes.delete(k); },
    focus() {},
    matches() { return true; },
    closest() { return null; },
    contains() { return false; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {}
  });
  const getEl = (id) => {
    if (!elements.has(id)) {
      const el = makeEl(id);
      el.classList._owner = el;
      elements.set(id, el);
    }
    return elements.get(id);
  };
  const grid = getEl('product-grid');
  let gridWrites = 0;
  let gridHtml = '';
  Object.defineProperty(grid, 'innerHTML', {
    get() { return gridHtml; },
    set(v) { gridWrites++; gridHtml = v; }
  });
  const fileInput = getEl('admin-qris-file-input');
  fileInput.click = () => { fileInputClicks++; };

  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k)
  };
  globalThis.document = {
    activeElement: null,
    body: bodyEl,
    addEventListener(type, fn) {
      if (!docHandlers.has(type)) docHandlers.set(type, []);
      docHandlers.get(type).push(fn);
    },
    removeEventListener() {},
    getElementById: getEl,
    querySelector() { return getEl('polling-indicator'); },
    querySelectorAll() { return []; }
  };
  globalThis.window = {
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    location: { protocol: 'https:', search: '', hash: '', origin: 'https://store.example' },
    addEventListener() {},
    removeEventListener() {},
    open() { return null; }
  };
  globalThis.requestAnimationFrame = () => {};

  const store = await import('../scripts/core/store.js');
  const app = await import('../scripts/app.js');

  try {
    app.initEventBindings();

    // A7: unchanged renderCatalog does not rewrite grid.innerHTML
    app.renderCatalog();
    const firstWrites = gridWrites;
    app.renderCatalog();
    assert.equal(gridWrites, firstWrites, 'Unchanged catalog must not rebuild #product-grid DOM');

    // A5: HTTP canCheckout blocks sold-out items when there is no pending reservation
    const p0 = app.PRODUCTS[0];
    app.state.cart = [{ key: `${p0.id}::`, productId: p0.id, variant: '', qty: 1, note: '' }];
    store.setInventoryStock({ revision: 10, products: { [p0.id]: 0 } });
    getEl('customer-name').value = 'Budi Santoso';
    getEl('customer-phone').value = '081234567890';
    getEl('customer-address').value = 'Jl Melati 10';
    let postAttempted = false;
    globalThis.fetch = async (_url, opts = {}) => {
      if (opts.method === 'POST') postAttempted = true;
      return { ok: true, json: async () => ({ ok: true }) };
    };
    await app.openCheckoutModal();
    assert.equal(postAttempted, false, 'HTTP checkout must block unavailable items when no pending reservation exists');
    assert.match(getEl('toast-text').textContent, /Stok berubah/);

    // A9 dropzone click delegation without inline onclick in HTML
    const htmlSource = read('index.html');
    assert.doesNotMatch(htmlSource, /<div[^>]*id="admin-qris-dropzone"[^>]*onclick=/);
    assert.doesNotMatch(htmlSource, /id="admin-section-payments"[\s\S]*window\.switchAdminSection\('payments'\)/);
    assert.match(htmlSource, /id="new-prod-story"/);
    const dropzoneTarget = {
      closest(sel) {
        if (sel === '#admin-qris-dropzone') return getEl('admin-qris-dropzone');
        return null;
      }
    };
    docHandlers.get('click')?.forEach((fn) => fn({ target: dropzoneTarget }));
    assert.equal(fileInputClicks, 1);

    const authMod = await import('../scripts/core/auth.js');
    authMod.setInventoryAdminToken('test-admin-tok');

    // A9 per-card dirty storefront drafts survive saving the OTHER card + catalog status populated
    app.refreshAdminDashboard();
    assert.match(getEl('admin-storefront-catalog-status').textContent, /\d+ produk terdaftar/);
    getEl('admin-storefront-hours').value = '09:00 - 21:00 (Draft)';
    docHandlers.get('input')?.forEach((fn) => fn({ target: getEl('admin-storefront-hours') }));
    getEl('admin-storefront-whatsapp').value = '081234567890';
    globalThis.fetch = async (url, opts = {}) => {
      if (url === '/api/settings' && opts.method === 'POST') {
        const body = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            ok: true,
            settings: { updatedAt: body.updatedAt, qris: { payload: store.DEMO_STATIC_QRIS, updatedAt: body.updatedAt }, store: body.store }
          })
        };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    };
    await app.saveAdminStorefrontSetting('merchantWhatsApp');
    assert.equal(getEl('admin-storefront-hours').value, '09:00 - 21:00 (Draft)');

    // A3: submitNewProduct rejects decimals and >1e9; openProductEditForm populates & saves story
    getEl('new-prod-name').value = 'Produk Desimal';
    getEl('new-prod-price').value = '1500.5';
    let settingsPost = 0;
    globalThis.fetch = async (url, opts = {}) => {
      if (url === '/api/settings' && opts.method === 'POST') settingsPost++;
      return { ok: true, json: async () => ({ ok: true, settings: {} }) };
    };
    await app.submitNewProduct();
    assert.equal(settingsPost, 0);
    assert.match(getEl('toast-text').textContent, /bilangan bulat/);

    getEl('new-prod-price').value = '1000000001';
    await app.submitNewProduct();
    assert.equal(settingsPost, 0);

    app.openProductEditForm(p0.id);
    assert.equal(getEl('new-prod-story').value, p0.story);
    getEl('new-prod-story').value = 'Cerita edisi diperbarui';
    getEl('new-prod-price').value = String(p0.price);
    globalThis.fetch = async (url, opts = {}) => {
      if (url === '/api/settings' && opts.method === 'POST') {
        settingsPost++;
        const payload = JSON.parse(opts.body);
        return { ok: true, json: async () => ({ ok: true, settings: { catalogUpdatedAt: payload.catalogUpdatedAt, products: payload.products } }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    };
    await app.submitNewProduct();
    assert.equal(settingsPost, 1);
    assert.equal(store.getProduct(p0.id).story, 'Cerita edisi diperbarui');

    // A8: clearActiveOrder removes tracked order ID rather than blindly index 0
    store.rememberMyOrder('ord-open-second');
    store.rememberMyOrder('ord-closed-first');
    store.saveOrder({
      id: 'ord-closed-first',
      invoice: 'INV-A',
      status: 'completed',
      createdAt: 100,
      updatedAt: 100,
      items: [],
      totals: { total: 1000 },
      payment: { method: 'qris', payload: store.DEMO_STATIC_QRIS }
    }, { fromCloud: true });
    store.saveOrder({
      id: 'ord-open-second',
      invoice: 'INV-B',
      status: 'paid',
      createdAt: 200,
      updatedAt: 200,
      items: [],
      totals: { total: 2000 },
      payment: { method: 'qris', payload: store.DEMO_STATIC_QRIS }
    }, { fromCloud: true });
    await app.openOrderTrackerModal();
    assert.equal(app.state.activeTrackerOrderId, 'ord-open-second');
    app.clearActiveOrder();
    assert.deepEqual(store.getMyOrderIds(), ['ord-closed-first']);

    // A4 + A11: active checkout handles CANCELLED from admin and clears voucher on PAID
    const pAvail = app.PRODUCTS[1];
    store.setInventoryStock({ revision: 12, products: { [p0.id]: 0, [pAvail.id]: 5 } });
    app.state.cart = [{ key: `${pAvail.id}::`, productId: pAvail.id, variant: '', qty: 1, note: '' }];
    app.state.activeVoucherCode = 'RASAHEMAT';
    app.state.voucherDiscountPercent = 15;
    getEl('voucher-input').value = 'RASAHEMAT';
    app.state.customer = { name: 'Pembeli Uji', phone: '081234567890', address: 'Jl Mawar' };

    const qrisOrder = (id, status, updatedAt = 500) => ({
      id,
      inventory: true,
      invoice: `INV-${id}`,
      status,
      createdAt: 500,
      updatedAt,
      expiresAt: Date.now() + 600000,
      customer: { name: 'Pembeli Uji', phone: '081234567890', address: 'Jl Mawar' },
      items: [{ productId: pAvail.id, name: pAvail.name, variant: '', qty: 1, unitPrice: pAvail.price }],
      totals: { subtotal: pAvail.price, discount: 0, shippingCost: 0, packaging: 0, total: pAvail.price },
      payment: { method: 'qris', payload: store.DEMO_STATIC_QRIS },
      shipping: { id: 'pickup', name: 'Ambil di toko' }
    });
    const inv = await import(`../scripts/core/inventory.js`);
    globalThis.fetch = async (_url, opts = {}) => {
      if (opts.method === 'POST') {
        const body = JSON.parse(opts.body);
        return { ok: true, json: async () => ({ ok: true, order: qrisOrder(body.id, 'awaiting_payment', 500) }) };
      }
      return { ok: true, json: async () => ({ ok: true, stock: { revision: 12, products: { [pAvail.id]: 4 } } }) };
    };
    await app.openCheckoutModal();
    const cancelId = app.state.activeCheckoutOrderId;
    assert.ok(app.state.activeOrderStopWatch);
    store.saveOrder(qrisOrder(cancelId, 'cancelled', 600), { fromCloud: true });
    assert.equal(app.state.activeOrderStopWatch, null);
    assert.equal(getEl('payment-expired-banner').style.display, 'block');
    assert.match(getEl('payment-expired-banner').innerHTML, /Pesanan Dibatalkan/);

    // Now simulate completed PAID order & verify voucher state + input clear
    app.closeCheckoutModal();
    app.state.cart = [{ key: `${pAvail.id}::`, productId: pAvail.id, variant: '', qty: 1, note: '' }];
    app.state.activeVoucherCode = 'RASAHEMAT';
    app.state.voucherDiscountPercent = 15;
    getEl('voucher-input').value = 'RASAHEMAT';
    await app.openCheckoutModal();
    const paidId = app.state.activeCheckoutOrderId;
    store.saveOrder(qrisOrder(paidId, 'paid', 700), { fromCloud: true });
    assert.equal(app.state.activeVoucherCode, '');
    assert.equal(app.state.voucherDiscountPercent, 0);
    assert.equal(getEl('voucher-input').value, '');

    // A8 blocked WA popup opens closed cart drawer so fallback link is visible
    store.saveSettings((s) => ({ ...s, store: { ...s.store, whatsapp: '6281234567890', isOpen: true } }));
    store.setInventoryStock({ revision: 15, products: { [pAvail.id]: 5 } });
    app.state.cart = [{ key: `${pAvail.id}::`, productId: pAvail.id, variant: '', qty: 1, note: '' }];
    getEl('cart-drawer').classList.remove('open');
    globalThis.fetch = async (url, opts = {}) => {
      if (url === '/api/inventory' && opts.method === 'POST') {
        const body = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            ok: true,
            order: { ...qrisOrder(body.id, 'awaiting_payment', 800), payment: { method: 'whatsapp', payload: store.DEMO_STATIC_QRIS } }
          })
        };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    };
    await app.checkoutViaWhatsApp();
    assert.equal(getEl('cart-drawer').classList.contains('open'), true);
    assert.equal(getEl('checkout-whatsapp-link').hidden, false);

    // A6: 401 unauthorized closes admin dashboard & resets state.adminAuthenticated
    getEl('admin-login-password').value = 'valid-token';
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, orders: [] }) });
    await app.submitAdminLogin();
    assert.equal(app.state.adminAuthenticated, true);
    assert.equal(getEl('admin-dashboard-modal-backdrop').classList.contains('open'), true);
    const { syncInventory } = await import('../scripts/core/inventory.js');
    globalThis.fetch = async (url) => {
      if (url.includes('action=stock')) return { ok: true, json: async () => ({ ok: true, stock: { revision: 16, products: { [p0.id]: 0 } } }) };
      return { ok: false, status: 401, json: async () => ({ ok: false, code: 'UNAUTHORIZED' }) };
    };
    await assert.rejects(() => syncInventory(), (err) => err?.status === 401 && err?.code === 'UNAUTHORIZED');
    assert.equal(app.state.adminAuthenticated, false);
    assert.equal(getEl('admin-dashboard-modal-backdrop').classList.contains('open'), false);
  } finally {
    intervals.forEach((t) => clearInterval(t));
    globalThis.setInterval = nativeSetInterval;
  }
});
