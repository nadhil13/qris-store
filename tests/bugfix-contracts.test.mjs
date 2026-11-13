import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { webcrypto } from 'node:crypto';

const read = (rel) => readFile(new URL(`../${rel}`, import.meta.url), 'utf8');

function extractRootBlock(source) {
  const match = source.match(/:root\s*\{([\s\S]*?)\n\}/);
  assert.ok(match, 'Expected :root block');
  return match[1];
}

test('P0 #1: settings MERGE_SETTINGS_SCRIPT and inventory script align on QRIS Redis schema', async () => {
  const settingsSource = await read('api/settings.js');
  const inventoryLuaSource = await read('api/lib/inventory-script.js');

  assert.match(
    settingsSource,
    /qris\s*=\s*\{\s*payload\s*=\s*nextPayload[\s\S]*?\}/,
    'MERGE_SETTINGS_SCRIPT must store nested qris object in Redis record'
  );
  assert.match(
    inventoryLuaSource,
    /type\(settings\.qris\)\s*==\s*'table'[\s\S]*?elseif\s+type\(settings\.payload\)\s*==\s*'string'/,
    'INVENTORY_SCRIPT must read settings.qris.payload and fall back cleanly to flat settings.payload'
  );
});

test('P1 #1 & P1 #3: JS selectors match CSS, root tokens exist cleanly, DESIGN.md matches, and sticky uses overflow-x clip', async () => {
  const [appSource, cssSource, designSource] = await Promise.all([
    read('scripts/app.js'),
    read('styles/main.css'),
    read('DESIGN.md')
  ]);

  assert.doesNotMatch(appSource, /\bshipping-option-card\b/);
  assert.match(appSource, /\bshipping-method-card\b/);
  assert.doesNotMatch(appSource, /\bbtn-note\b/);
  assert.match(appSource, /\bcart-item-note\b/);
  assert.doesNotMatch(appSource, /['"]status-paid['"]|['"]status-cancelled['"]/);

  const rootCss = extractRootBlock(cssSource);
  assert.match(rootCss, /--status-danger:\s*#[0-9a-fA-F]{6};/);
  assert.match(rootCss, /--shadow-modal:\s*[^;]+;/);
  assert.equal(rootCss.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim(),
    extractRootBlock(designSource).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim());

  const htmlBlock = cssSource.match(/html\s*\{([\s\S]*?)\}/)?.[1] || '';
  const bodyBlock = cssSource.match(/body\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(htmlBlock, /overflow-x:\s*clip;/);
  assert.match(bodyBlock, /overflow-x:\s*clip;/);
  assert.doesNotMatch(htmlBlock + bodyBlock, /overflow-x:\s*hidden;/);
});

test('P1 #2: index.html has valid admin product form close button markup and no stray aria-label text', async () => {
  const html = await read('index.html');
  assert.doesNotMatch(html, /<\/div>\s+aria-label="Tutup formulir produk"/);
  assert.match(
    html,
    /<button[^>]*onclick="window\.toggleAddProductForm\(false\)"[^>]*aria-label="Tutup formulir produk"[^>]*>/
  );
  const btnTag = html.match(/<button[^>]*onclick="window\.toggleAddProductForm\(false\)"[^>]*>/)?.[0] || '';
  assert.match(btnTag, /min-width:\s*44px/);
  assert.match(btnTag, /min-height:\s*44px/);
});

test('P1 #4 (client): syncOrdersWithCloud skips unauthenticated polling and sends Bearer auth when signed in', async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k)
  };
  globalThis.window = {
    location: { protocol: 'https:' },
    addEventListener() {}
  };
  const auth = await import('../scripts/core/auth.js');
  const store = await import('../scripts/core/store.js');

  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, orders: [{ id: 'legacy-1', status: 'paid', items: [], totals: { total: 5000 }, createdAt: 100, updatedAt: 200 }] })
    };
  };

  auth.setInventoryAdminToken('');
  const guestResult = await store.syncOrdersWithCloud();
  assert.equal(guestResult.online, false);
  assert.equal(calls.length, 0, 'Anonymous visitors must never poll /api/orders');

  auth.setInventoryAdminToken('secret-token');
  store.rememberMyOrder('legacy-1');
  const adminResult = await store.syncOrdersWithCloud();
  assert.equal(adminResult.online, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-token');
  assert.equal(store.getOrder('legacy-1')?.status, 'paid');
  auth.setInventoryAdminToken('');
});

test('P1 #4 (backend preview): api/orders.js fails closed in preview even when KV is unconfigured', async () => {
  const prevEnv = process.env.VERCEL_ENV;
  const prevNode = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  process.env.VERCEL_ENV = 'preview';
  try {
    const { default: ordersHandler } = await import(`../api/orders.js?preview=${Date.now()}`);
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.statusCode = c; return this; },
      json(b) { this.body = b; return this; },
      end() {}
    };
    await ordersHandler({ method: 'GET', headers: {} }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'STORAGE_UNAVAILABLE');
  } finally {
    if (prevEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevEnv;
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
  }
});

test('P0 #2 & P1 #4 (local server): node server.js without KV supports checkout & protects GET /api/orders', async () => {
  const envKeys = ['NODE_ENV', 'VERCEL_ENV', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'INVENTORY_ADMIN_TOKEN'];
  const savedEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
  envKeys.forEach((k) => delete process.env[k]);
  process.env.NODE_ENV = 'development';
  process.env.INVENTORY_ADMIN_TOKEN = 'local-admin-test';

  const { handleRequest } = await import(`../server.js?local=${Date.now()}`);

  const sendReq = async (url, { method = 'GET', body, headers = {} } = {}) => {
    const req = new EventEmitter();
    req.url = url;
    req.method = method;
    req.headers = { ...headers };
    req.resume = () => {};

    const raw = body !== undefined ? JSON.stringify(body) : '';
    if (raw) req.headers['content-length'] = String(Buffer.byteLength(raw));

    const resHeaders = {};
    const chunks = [];
    const res = {
      statusCode: 200,
      setHeader(k, v) { resHeaders[k.toLowerCase()] = v; },
      writeHead(code, extra = {}) {
        this.statusCode = code;
        for (const [k, v] of Object.entries(extra)) resHeaders[k.toLowerCase()] = v;
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        this._done?.();
      }
    };
    const done = new Promise((resolve) => { res._done = resolve; });
    const pending = handleRequest(req, res);
    if (raw) req.emit('data', Buffer.from(raw));
    req.emit('end');
    await Promise.all([pending, done]);
    return { status: res.statusCode, headers: resHeaders, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  };

  try {
    // Public stock snapshot works locally without KV
    const stockRes = await sendReq('/api/inventory?action=stock');
    assert.equal(stockRes.status, 200);
    assert.equal(stockRes.body.ok, true);
    const initialStock = stockRes.body.stock.products['prod-01'];
    assert.ok(initialStock >= 2);

    // Save custom flat settings payload to /api/settings (memory mode) and confirm local inventory picks up updated QRIS payload
    const qrisPayload = '00020101021126610014COM.GO-JEK.WWW01189360091430501410280210G0501410280303UMI51440014ID.CO.QRIS.WWW0215ID10265330868010303UMI5204899953033605802ID5925Toko Terpusat Belanja, Di6013JAKARTA BARAT61051182062070703A0163048201';
    const settingsRes = await sendReq('/api/settings', {
      method: 'POST',
      body: { updatedAt: Date.now(), payload: qrisPayload, store: { name: 'Toko Lokal', isOpen: true } }
    });
    assert.equal(settingsRes.status, 200);

    // Buyer QRIS reservation works locally and captures QRIS payload snapshot
    const cap = webcrypto.getRandomValues(new Uint8Array(24));
    const capability = Array.from(cap, (b) => b.toString(16).padStart(2, '0')).join('');
    const reserveBody = {
      action: 'reserve',
      id: 'inv_local_test_01',
      capability,
      items: [{ productId: 'prod-01', variant: 'Level 0: Ramah Anak', qty: 2, note: 'pedas pisah' }],
      customer: { name: 'Budi', phone: '081234567890', address: '' },
      shippingId: 'pickup',
      voucherCode: 'RASAHEMAT',
      paymentMethod: 'qris'
    };
    const reserveRes = await sendReq('/api/inventory', { method: 'POST', body: reserveBody });
    assert.equal(reserveRes.status, 200);
    assert.equal(reserveRes.body.ok, true);
    assert.equal(reserveRes.body.order.status, 'awaiting_payment');
    assert.equal(reserveRes.body.order.payment.payload, qrisPayload);
    assert.equal(reserveRes.body.order.totals.total, Math.round(78000 * 2 * 0.85) + 2000);
    assert.equal(reserveRes.body.stock.products['prod-01'], initialStock - 2);

    // Idempotent retry succeeds cleanly
    const retryRes = await sendReq('/api/inventory', { method: 'POST', body: reserveBody });
    assert.equal(retryRes.status, 200);
    assert.equal(retryRes.body.order.invoice, reserveRes.body.order.invoice);

    // Capability lookup succeeds for buyer, fails 404 on wrong capability
    const orderOk = await sendReq(`/api/inventory?action=order&id=inv_local_test_01&capability=${capability}`);
    assert.equal(orderOk.status, 200);
    const orderBad = await sendReq(`/api/inventory?action=order&id=inv_local_test_01&capability=${'a'.repeat(48)}`);
    assert.equal(orderBad.status, 404);

    // Admin confirm + advance + cancel fail without token and succeed with token
    const unauthConfirm = await sendReq('/api/inventory', {
      method: 'POST',
      body: { action: 'confirm', id: 'inv_local_test_01', reference: 'ok' }
    });
    assert.equal(unauthConfirm.status, 401);

    const cancelRes = await sendReq('/api/inventory', {
      method: 'POST',
      headers: { authorization: 'Bearer local-admin-test' },
      body: { action: 'cancel', id: 'inv_local_test_01', note: 'test cancel' }
    });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.order.status, 'cancelled');
    assert.equal(cancelRes.body.stock.products['prod-01'], initialStock);

    // Unauthenticated GET /api/orders must be rejected even on local dev HTTP server
    const unauthOrders = await sendReq('/api/orders');
    assert.equal(unauthOrders.status, 401);
    const authOrders = await sendReq('/api/orders', { headers: { authorization: 'Bearer local-admin-test' } });
    assert.equal(authOrders.status, 200);
  } finally {
    envKeys.forEach((k) => {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    });
  }
});

test('P2 #1-#4 & Section 2.A: source contracts (dead code, landmarks, headings, contrast, mobile targets)', async () => {
  const [appSource, htmlSource, cssSource, swSource] = await Promise.all([
    read('scripts/app.js'),
    read('index.html'),
    read('styles/main.css'),
    read('sw.js')
  ]);

  // P2 #1: Dead admin credential exports removed
  assert.doesNotMatch(appSource, /\bADMIN_USERNAME\b|\bADMIN_PASSWORD\b|\bVALID_ADMIN_PASSWORDS\b/);

  // P2 #4: Dead refs, broken #contact link, leftover placeholders, sw.js & dead CSS cleanup
  assert.doesNotMatch(appSource, /btn-copy-va|'#contact'|"#contact"|#9CA3AF/);
  assert.doesNotMatch(htmlSource, /href="#contact"|INV-RASA-000000/);
  assert.match(htmlSource, /id="results-count">Menampilkan 18 menu/);
  assert.doesNotMatch(
    htmlSource,
    /<a[^>]*id="cta-whatsapp-link"[^>]*target="_blank"/,
    'Fallback WA CTA anchor must not hardcode target="_blank" when WA number may be empty'
  );
  assert.doesNotMatch(swSource, /api\.restful-api\.dev|addAll\(ASSETS_TO_CACHE\)\.catch\(\(\)\s*=>\s*\{\s*\}\)/);
  assert.doesNotMatch(
    cssSource,
    /\.(hero-content|hero-title|hero-subtitle|hero-stats|stat-item|stat-num|stat-label|card-actions|btn-add-cart|btn-quick-view)\b/
  );

  // Section 2.A: Single <main> landmark, heading hierarchy, native <button> tracker dock
  const mainCount = (htmlSource.match(/<main\b/gi) || []).length;
  assert.equal(mainCount, 1, 'Document must expose exactly one <main> landmark');
  assert.match(htmlSource, /<section class="luxury-ritual reveal-section" id="pembayaran-info">[\s\S]*?<h2>QRIS dinamis/);
  assert.match(htmlSource, /<button type="button" class="order-tracker-dock" id="order-tracker-dock"/);
  assert.doesNotMatch(htmlSource, /<div class="order-tracker-dock"/);
  assert.doesNotMatch(htmlSource, /<h5\b/i, 'Admin storefront cards should use <h4> under <h3> section headings');
  for (const selectorOrId of [
    'class="drawer-title"',
    'id="modal-payment-title"',
    'class="receipt-title"',
    'id="qv-title"',
    'id="tracker-invoice"',
    'id="admin-login-title"',
    'id="modal-admin-title"'
  ]) {
    assert.match(htmlSource, new RegExp(`<h2\\b[^>]*${selectorOrId}`), `Dialog title ${selectorOrId} should be <h2>`);
  }
  for (const adminH3Id of [
    'id="admin-overview-title"',
    'id="admin-orders-section-title"',
    'id="admin-catalog-section-title"',
    'id="admin-storefront-title"',
    'id="admin-payments-title"',
    'id="admin-tools-title"'
  ]) {
    assert.match(htmlSource, new RegExp(`<h3\\b[^>]*${adminH3Id}`), `Admin section ${adminH3Id} should be <h3>`);
  }
  assert.match(htmlSource, /color:\s*#0C6B5E[\s\S]{0,120}>[\s\n]*Kirim ke WhatsApp/);
  assert.match(htmlSource, /color:\s*#0C6B5E[\s\S]{0,120}>[\s\n]*Konfirmasi via WhatsApp/);

  // Section 2.A: Contrast tokens & mobile touch targets in CSS
  assert.match(cssSource, /\.section-kicker\.dark\s*\{[\s\S]*?color:\s*#7A2F13;/);
  assert.match(cssSource, /\.btn-whatsapp-order\s*\{[\s\S]*?background:\s*#146C36;/);
  assert.match(cssSource, /\.btn-whatsapp-order:hover\s*\{[\s\S]*?background:\s*#115E30;/);
  assert.match(cssSource, /\.badge-gopay span\s*\{\s*color:\s*#006680;\s*\}/);
  assert.match(
    cssSource,
    /\.product-card\.is-sold-out\s+\.btn-add:disabled[\s\S]*?color:\s*#4B5563\s*!important;[\s\S]*?opacity:\s*1\s*!important;/
  );
  assert.match(cssSource, /\.ritual-copy h2\s*\{/);
  assert.doesNotMatch(cssSource, /\.ritual-copy h3\s*\{/);
  assert.match(cssSource, /\.admin-section-heading h3\s*\{/);
  assert.match(cssSource, /\.admin-settings-card h4\s*\{/);
  assert.match(cssSource, /\.audio-toggle\s*\{\s*width:\s*44px;\s*height:\s*44px;/);
  assert.doesNotMatch(cssSource, /min-height:\s*42px;/);
  assert.match(cssSource, /\.btn-admin-action\s*\{[\s\S]*?min-height:\s*44px;/);
});

test('P2 #1-#4 runtime behaviors: admin modal, tracker states, countdown sync, mobile nav, WA fallback & admin labels', async () => {
  const nativeSetInterval = globalThis.setInterval;
  globalThis.setInterval = (...args) => {
    const timer = nativeSetInterval(...args);
    timer.unref?.();
    return timer;
  };

  const elements = new Map();
  const makeEl = (id) => ({
    id,
    value: '',
    defaultValue: '',
    textContent: '',
    _html: '',
    href: '',
    target: '',
    rel: '',
    hidden: false,
    disabled: false,
    checked: false,
    inert: false,
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
    matches: (sel) => sel === '[role="dialog"]',
    contains: () => false,
    querySelector: () => null,
    querySelectorAll: () => [],
    classList: {
      add: (c) => elements.get(id)?.classes.add(c),
      remove: (c) => elements.get(id)?.classes.delete(c),
      contains: (c) => elements.get(id)?.classes.has(c) ?? false
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

  const mockBody = { children: [], style: {}, querySelector: () => null, querySelectorAll: () => [], classList: { add() {}, remove() {} } };
  globalThis.document = {
    body: mockBody,
    addEventListener() {},
    removeEventListener() {},
    getElementById: getEl,
    querySelector: () => null,
    querySelectorAll: (sel) => {
      if (sel === '[data-store-whatsapp]') return [ctaWa];
      if (sel === '.mobile-app-bar .mobile-nav-item') return [mobKatalog, mobSearch, mobCart];
      return [];
    }
  };
  const mobKatalog = getEl('mob-nav-katalog');
  mobKatalog.classes.add('active');
  const mobSearch = getEl('mob-nav-search');
  const mobCart = getEl('mob-nav-cart');
  const ctaWa = getEl('cta-whatsapp-link');
  ctaWa.target = '_blank';
  ctaWa.href = '#pembayaran-info';

  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k)
  };
  globalThis.window = {
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    location: { protocol: 'https:', search: '', hash: '' },
    addEventListener() {},
    removeEventListener() {}
  };
  globalThis.requestAnimationFrame = () => {};

  try {
    const auth = await import('../scripts/core/auth.js');
    const store = await import('../scripts/core/store.js');
    const inventory = await import('../scripts/core/inventory.js');
    const app = await import('../scripts/app.js');

    // P2 #1: admin login modal starts clean with hidden error box
    app.openAdminLoginModal();
    const loginErr = getEl('admin-login-error');
    assert.equal(loginErr.style.display, 'none');
    assert.equal(loginErr.textContent, '');
    app.closeAdminLoginModal();

    // P2 #3: mobile nav tabs switch .active class cleanly
    app.switchMobileTab('search');
    assert.equal(mobSearch.classes.has('active'), true);
    assert.equal(mobKatalog.classes.has('active'), false);
    app.openCartDrawer();
    assert.equal(mobCart.classes.has('active'), true);
    assert.equal(mobSearch.classes.has('active'), false);
    app.closeCartDrawer();
    assert.equal(mobKatalog.classes.has('active'), true);
    assert.equal(mobCart.classes.has('active'), false);

    // P2 #2: openOrderTrackerModal renders terminal states properly
    const sampleItem = { productId: 'prod-01', name: 'Menu', qty: 1, unitPrice: 10000 };
    const mkOrder = (id, status, extra = {}) => ({
      id,
      invoice: `INV-${id}`,
      status,
      createdAt: 1000,
      updatedAt: 2000,
      expiresAt: Date.now() + 245000,
      items: [sampleItem],
      customer: { name: 'Ana', phone: '08123456789' },
      shipping: { id: 'pickup', name: 'Ambil di toko' },
      totals: { subtotal: 10000, total: 10000, itemCount: 1 },
      payment: { method: 'qris', payload: store.DEMO_STATIC_QRIS },
      ...extra
    });

    for (const [id, status, expectText] of [
      ['cancelled_1', 'cancelled', /Dibatalkan/],
      ['expired_1', 'expired', /Kedaluwarsa/]
    ]) {
      storage.set(store.STORAGE_KEYS.orders, JSON.stringify([mkOrder(id, status)]));
      storage.set(store.STORAGE_KEYS.myOrders, JSON.stringify([id]));
      await app.openOrderTrackerModal();
      const html = getEl('tracker-timeline').innerHTML;
      assert.match(html, expectText);
      assert.doesNotMatch(html, /Menunggu antrean|step-waiting/);
      app.closeOrderTrackerModal();
    }

    storage.set(store.STORAGE_KEYS.orders, JSON.stringify([mkOrder('done_1', 'completed')]));
    storage.set(store.STORAGE_KEYS.myOrders, JSON.stringify(['done_1']));
    await app.openOrderTrackerModal();
    const doneHtml = getEl('tracker-timeline').innerHTML;
    assert.doesNotMatch(doneHtml, /step-active|step-waiting/, 'Completed orders must mark all steps step-done');
    assert.match(doneHtml, /step-done/);
    app.closeOrderTrackerModal();

    // P2 #2: checkout modal preserves actual remaining countdown (not reset to 10:00)
    const exp = Date.now() + 245000;
    const awaiting = mkOrder('await_timer', 'awaiting_payment', { expiresAt: exp });
    storage.set(store.STORAGE_KEYS.orders, JSON.stringify([awaiting]));
    storage.set(store.STORAGE_KEYS.myOrders, JSON.stringify(['await_timer']));
    await app.openCheckoutModal('await_timer');
    assert.match(getEl('payment-countdown-clock').textContent, /^04:0[0-5]$/);
    // Re-rendering (as cloud settings sync does) must also keep actual remaining clock
    app.switchQRISDisplayMode('dynamic', awaiting);
    assert.doesNotMatch(getEl('payment-countdown-clock').textContent, /^10:00$/);
    app.closeCheckoutModal();

    // P2 #4: WA fallback without configured WA clears target & uses #pembayaran-info, and admin table labels cancelled/expired accurately
    store.saveSettings({ ...store.getSettings(), store: { ...store.getSettings().store, whatsapp: '' } });
    assert.equal(ctaWa.href, '#pembayaran-info');
    assert.equal(ctaWa.target, '');
    assert.equal(ctaWa.getAttribute('aria-disabled'), 'true');

    auth.setInventoryAdminToken('adm-test');
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        orders: [
          mkOrder('row_c', 'cancelled'),
          mkOrder('row_e', 'expired'),
          mkOrder('row_d', 'completed')
        ]
      })
    });
    await inventory.listInventoryOrders();
    app.refreshAdminDashboard();
    const rowsHtml = getEl('admin-orders-tbody').innerHTML;
    assert.match(rowsHtml, /INV-row_c[\s\S]*?>Dibatalkan</);
    assert.match(rowsHtml, /INV-row_e[\s\S]*?>Kedaluwarsa</);
    assert.match(rowsHtml, /INV-row_d[\s\S]*?>Selesai</);
    auth.setInventoryAdminToken('');
  } finally {
    globalThis.setInterval = nativeSetInterval;
  }
});

test('Section B & C: visual craft, non-blocking fonts, copy honesty, comment hygiene & card/admin DOM', async () => {
  const [cssSource, designSource, htmlSource, manifestSource, serverSource, appSource] = await Promise.all([
    read('styles/main.css'),
    read('DESIGN.md'),
    read('index.html'),
    read('manifest.json'),
    read('server.js'),
    read('scripts/app.js')
  ]);

  // B.1 Glassmorphism dose cap: at most 1 blur declaration (.site-header only)
  const blurMatches = cssSource.match(/(?:-webkit-)?backdrop-filter:\s*blur\(/g) || [];
  assert.ok(blurMatches.length <= 2, `Expected backdrop-filter blur only on .site-header, found ${blurMatches.length}`);
  assert.match(cssSource, /\.site-header\s*\{[^}]*backdrop-filter:\s*blur\(/);
  for (const selector of ['.ritual-shell', '.showcase-tag', '.toolbar-wrapper', '.badge-category', '.drawer-backdrop', '.modal-backdrop', '.toast-toaster', '.order-tracker-dock', '.mobile-app-bar']) {
    const escaped = selector.replace('.', '\\.');
    const block = cssSource.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] || '';
    assert.doesNotMatch(block, /backdrop-filter:\s*blur\(/, `${selector} must not use backdrop-filter blur`);
  }

  // B.2 No decorative radial glow blobs or neon pulse keyframes
  assert.doesNotMatch(cssSource, /\.ritual-shell::before|\.ritual-shell::after|\.cta-shell::before|\.showcase-card::after/);
  assert.doesNotMatch(cssSource, /@keyframes\s+pulse-beacon|#22C55E/i);

  // B.3 & B.4 Card meta row replaces photo overlay badges; search radius unified
  assert.match(cssSource, /\.card-meta-row\s*\{/);
  assert.doesNotMatch(cssSource, /\.card-badge-wrap\b/);
  const searchBox = cssSource.match(/\.search-box\s*\{([^}]*)\}/)?.[1] || '';
  const searchInput = cssSource.match(/\.search-input\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(searchBox, /background:\s*transparent/);
  assert.match(searchInput, /border-radius:\s*10px/);

  // B.6 Visual cohesion on CTA & payment info sections (matte warm paper canvas)
  const finalCta = cssSource.match(/\.final-cta\s*\{([^}]*)\}/)?.[1] || '';
  const ctaShell = cssSource.match(/\.cta-shell\s*\{([^}]*)\}/)?.[1] || '';
  const luxuryRitual = cssSource.match(/\.luxury-ritual\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(finalCta, /background:\s*var\(--bg-canvas\)/);
  assert.doesNotMatch(ctaShell, /linear-gradient/);
  assert.match(luxuryRitual, /background:\s*var\(--bg-canvas\)/);

  // C.1 Copy honesty: no butik/kurasi hype, no false "realtime" claim in admin QRIS intro, manifest generic, demo WA labeled
  assert.doesNotMatch(htmlSource, /\bButik\b|\bkurasi\b/i);
  assert.doesNotMatch(manifestSource, /\bButik\b|\bkurasi\b|GoPay/i);
  assert.doesNotMatch(appSource, /Pelanggan Butik|secara <strong>realtime<\/strong>/i);
  assert.match(htmlSource, /6281234567890/);
  assert.match(htmlSource, /contoh demo/i);

  // C.2 Comment & log hygiene (keep functional comments, strip template tags & ==== banners)
  assert.doesNotMatch(htmlSource, /Scroll-craft hero section|\(Feature B\)|\(feature E\)|UI mobility R-/i);
  assert.doesNotMatch(cssSource, /\(R-32, R-39, Impeccable\)/);
  assert.doesNotMatch(serverSource, /={10,}/);

  // C.3 Non-blocking Google Fonts & offline system fallbacks mirrored in DESIGN.md
  assert.doesNotMatch(cssSource, /@import\s+url\(['"]https:\/\/fonts\.googleapis\.com/);
  assert.match(htmlSource, /fonts\.googleapis\.com\/css2[\s\S]{0,300}media="print"[^>]*onload="this\.media='all'"/);
  assert.match(cssSource, /--font-sans:[^;]*Segoe UI/);
  assert.match(cssSource, /--font-mono:[^;]*ui-monospace[^;]*Consolas/);
  assert.equal(
    extractRootBlock(cssSource).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim(),
    extractRootBlock(designSource).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()
  );

  // B.3 & B.5 Runtime DOM behavior: clean card photography + smooth admin payments polling
  const nativeSetInterval = globalThis.setInterval;
  globalThis.setInterval = (...args) => {
    const timer = nativeSetInterval(...args);
    timer.unref?.();
    return timer;
  };
  const elements = new Map();
  const makeEl = (id) => ({
    id,
    value: '',
    defaultValue: '',
    textContent: '',
    _html: '',
    href: '',
    hidden: false,
    checked: false,
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
      add: (c) => elements.get(id)?.classes.add(c),
      remove: (c) => elements.get(id)?.classes.delete(c),
      contains: (c) => elements.get(id)?.classes.has(c) ?? false
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
  globalThis.document = {
    body: { children: [], style: {}, querySelector: () => null, querySelectorAll: () => [], classList: { add() {}, remove() {} } },
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
    getElementById: getEl,
    querySelector: () => null,
    querySelectorAll: () => []
  };
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k)
  };
  globalThis.window = {
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    location: { protocol: 'https:', search: '', hash: '' },
    addEventListener() {},
    removeEventListener() {}
  };
  globalThis.requestAnimationFrame = () => {};

  try {
    const store = await import('../scripts/core/store.js');
    const app = await import(`../scripts/app.js?bc=${Date.now()}`);

    // B.3 Card layout keeps category/tag out of .card-media into .card-meta-row
    app.renderCatalog();
    const gridHtml = getEl('product-grid').innerHTML;
    assert.doesNotMatch(gridHtml, /card-badge-wrap/);
    assert.match(gridHtml, /<div class="card-media">[\s\S]*?<img [^>]*>[\s\S]*?<\/div>\s*<div class="card-body">\s*<div class="card-meta-row">/);

    // B.5 Admin payments section uses h3/h4 (not h4/h5), skips unnecessary re-renders on unchanged poll, preserves #admin-qris-scan-status
    const paySec = getEl('admin-section-payments');
    const insideBtn = getEl('admin-inside-payments-control');
    paySec.contains = (target) => target === insideBtn;
    const seedScanStatus = getEl('admin-qris-scan-status');
    seedScanStatus.style.display = 'block';
    seedScanStatus.innerHTML = 'Status scan tersimpan';

    let innerWrites = 0;
    let backingHtml = '';
    Object.defineProperty(paySec, 'innerHTML', {
      get: () => backingHtml,
      set: (v) => {
        innerWrites += 1;
        backingHtml = v;
        const freshScan = makeEl('admin-qris-scan-status');
        freshScan.style.display = 'none';
        elements.set('admin-qris-scan-status', freshScan);
      }
    });

    app.refreshAdminDashboard();
    assert.equal(innerWrites, 1);
    assert.match(backingHtml, /<h3 id="admin-payments-title">/);
    assert.doesNotMatch(backingHtml, /<h4 id="admin-payments-title">|<h5\b/i);
    assert.doesNotMatch(backingHtml, /secara <strong>realtime<\/strong>/i);
    assert.equal(getEl('admin-qris-scan-status').style.display, 'block');
    assert.equal(getEl('admin-qris-scan-status').innerHTML, 'Status scan tersimpan');

    // Unchanged settings poll should not clobber #admin-section-payments DOM
    app.refreshAdminDashboard();
    assert.equal(innerWrites, 1, 'Polling with unchanged QRIS settings must not replace #admin-section-payments innerHTML');

    // Focus inside #admin-section-payments skips re-render even when QRIS settings change
    const curSettings = store.getSettings();
    store.saveSettings({
      ...curSettings,
      qris: {
        ...curSettings.qris,
        history: [{ payload: store.DEMO_STATIC_QRIS, replacedAt: 1700000000000 }]
      }
    });
    globalThis.document.activeElement = insideBtn;
    app.refreshAdminDashboard();
    assert.equal(innerWrites, 1, 'Focus inside #admin-section-payments must defer re-render');

    // Once focus leaves, re-render updates history buttons and still preserves #admin-qris-scan-status feedback
    globalThis.document.activeElement = null;
    app.refreshAdminDashboard();
    assert.equal(innerWrites, 2);
    assert.match(backingHtml, /Pulihkan #1/);
    assert.equal(getEl('admin-qris-scan-status').style.display, 'block');
    assert.equal(getEl('admin-qris-scan-status').innerHTML, 'Status scan tersimpan');
  } finally {
    globalThis.setInterval = nativeSetInterval;
  }
});
