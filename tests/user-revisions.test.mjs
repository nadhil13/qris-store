import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('Revision 1 & 2: Buyer payment modal removes Salin String QRIS, Dinamis/Statis switcher, and private Redis copy', () => {
  const html = read('index.html');
  const appSrc = read('scripts/app.js');

  assert.doesNotMatch(html, /Salin String QRIS|copyQRISPayload/);
  assert.doesNotMatch(html, /qris-mode-switch|qris-mode-btn|btn-qris-mode-dynamic|btn-qris-mode-static|qris-mode-helper/);
  assert.doesNotMatch(html, /Dinamis: Nominal Terisi|Statis Asli: Poster Toko/);
  assert.doesNotMatch(html, /database Redis\/KV|menahan stok/);

  assert.match(html, /id="customer-address-group"/);
  assert.match(html, /id="admin-storefront-shipping-enabled"/);
  assert.match(html, /id="admin-storefront-pickup-enabled"/);
  assert.match(html, /id="new-prod-requires-shipping"/);
  assert.match(html, /id="admin-new-category-box"/);

  assert.doesNotMatch(appSrc, /export function copyQRISPayload|SALINAN TAGIHAN QRIS|String QRIS:/);
});

test('Revision 3 & 4: Backend inventory supports requiresShipping, storewide courier flags, and cancelling expired/completed orders', async () => {
  const [{ createLocalInventoryEngine }, { parseInventoryInput, INVENTORY_COMMERCE }, apiSettings] = await Promise.all([
    import(`../api/lib/local-inventory.js?rev=${Date.now()}`),
    import(`../api/inventory.js?rev=${Date.now()}`),
    import(`../api/settings.js?rev=${Date.now()}`)
  ]);

  assert.match(
    apiSettings.validateCatalogProducts?.([{ id: 'p1', name: 'Bad', price: 1000, requiresShipping: 'yes' }]) || '',
    /requiresShipping/i
  );

  let now = 1_700_000_000_000;
  let sharedSettings = {
    products: [
      { id: 'phys-1', name: 'Kopi Tubruk', price: 30000, stock: 5, category: 'minuman', isAvailable: true, requiresShipping: true, variants: [] },
      { id: 'nocour-1', name: 'Voucher Kelas Offline', price: 25000, stock: 5, category: 'minuman', isAvailable: true, requiresShipping: false, variants: [] }
    ],
    store: { isOpen: true, shippingEnabled: true, pickupEnabled: true }
  };

  const engine = createLocalInventoryEngine({
    getSettings: () => sharedSettings,
    nowFn: () => now
  });

  const savedToken = process.env.INVENTORY_ADMIN_TOKEN;
  process.env.INVENTORY_ADMIN_TOKEN = 'rev-admin-token';
  try {
    const parseReq = (body, { admin = false } = {}) => {
      const parsed = parseInventoryInput({
        method: 'POST',
        headers: admin ? { authorization: 'Bearer rev-admin-token' } : {},
        body
      });
      assert.equal(parsed.ok, true);
      return parsed.input;
    };

    // 1) Product with requiresShipping: false checks out without courier or address and packaging = 0
    const rNoCourier = engine.execute(parseReq({
      action: 'reserve',
      id: 'inv_nocour_001',
      capability: 'a'.repeat(64),
      items: [{ productId: 'nocour-1', variant: '', qty: 1, note: '' }],
      customer: { name: 'Rina', phone: '081234567890', address: '' },
      shippingId: 'no_courier',
      voucherCode: '',
      paymentMethod: 'qris'
    }));
    assert.equal(rNoCourier.ok, true);
    assert.equal(rNoCourier.order.shipping.id, 'no_courier');
    assert.equal(rNoCourier.order.totals.shippingCost, 0);
    assert.equal(rNoCourier.order.totals.packaging, 0);
    assert.equal(rNoCourier.order.totals.total, 25000);

    // 2) Storefront disables shippingEnabled -> courier 'instant' rejected, 'pickup' succeeds
    sharedSettings = { ...sharedSettings, store: { isOpen: true, shippingEnabled: false, pickupEnabled: true } };
    const rBlockedCourier = engine.execute(parseReq({
      action: 'reserve',
      id: 'inv_block_001',
      capability: 'b'.repeat(64),
      items: [{ productId: 'phys-1', variant: '', qty: 1, note: '' }],
      customer: { name: 'Budi', phone: '081234567890', address: 'Jl. Melati' },
      shippingId: 'instant',
      voucherCode: '',
      paymentMethod: 'qris'
    }));
    assert.equal(rBlockedCourier.ok, false);
    assert.equal(rBlockedCourier.code, 'INVALID_SHIPPING');

    const rPickup = engine.execute(parseReq({
      action: 'reserve',
      id: 'inv_pick_001',
      capability: 'c'.repeat(64),
      items: [{ productId: 'phys-1', variant: '', qty: 2, note: '' }],
      customer: { name: 'Budi', phone: '081234567890', address: '' },
      shippingId: 'pickup',
      voucherCode: '',
      paymentMethod: 'qris'
    }));
    assert.equal(rPickup.ok, true);
    assert.equal(rPickup.stock.products['phys-1'], 3);

    // 3) Advance time past expiry so hold expires to 5 stock, then admin cancels -> no double release!
    now += 11 * 60 * 1000;
    const stockAfterExpiry = engine.execute({ action: 'stock' });
    assert.equal(stockAfterExpiry.stock.products['phys-1'], 5);
    const cancelExpired = engine.execute(parseReq({
      action: 'cancel',
      id: 'inv_pick_001',
      note: 'Admin batalkan pesanan kedaluwarsa'
    }, { admin: true }));
    assert.equal(cancelExpired.ok, true);
    assert.equal(cancelExpired.order.status, 'cancelled');
    assert.equal(cancelExpired.stock.products['phys-1'], 5, 'Cancelling an already expired order must not double-release stock');

    // 4) Reserve + confirm + advance to completed, then admin cancels -> releases stock once cleanly
    const rComplete = engine.execute(parseReq({
      action: 'reserve',
      id: 'inv_comp_001',
      capability: 'd'.repeat(64),
      items: [{ productId: 'phys-1', variant: '', qty: 2, note: '' }],
      customer: { name: 'Dina', phone: '081234567890', address: '' },
      shippingId: 'pickup',
      voucherCode: '',
      paymentMethod: 'qris'
    }));
    assert.equal(rComplete.ok, true);
    assert.equal(rComplete.stock.products['phys-1'], 3);
    assert.equal(engine.execute(parseReq({ action: 'confirm', id: 'inv_comp_001', reference: 'ok' }, { admin: true })).ok, true);
    assert.equal(engine.execute(parseReq({ action: 'advance', id: 'inv_comp_001', expectedStatus: 'paid' }, { admin: true })).ok, true);
    assert.equal(engine.execute(parseReq({ action: 'advance', id: 'inv_comp_001', expectedStatus: 'processing' }, { admin: true })).ok, true);
    assert.equal(engine.execute(parseReq({ action: 'advance', id: 'inv_comp_001', expectedStatus: 'ready' }, { admin: true })).ok, true);

    const cancelCompleted = engine.execute(parseReq({
      action: 'cancel',
      id: 'inv_comp_001',
      note: 'Refund & batal'
    }, { admin: true }));
    assert.equal(cancelCompleted.ok, true);
    assert.equal(cancelCompleted.order.status, 'cancelled');
    assert.equal(cancelCompleted.stock.products['phys-1'], 5, 'Cancelling completed order releases stock once');

    // 5) Storefront disables both shipping & pickup -> only 'no_courier' allowed without address
    sharedSettings = { ...sharedSettings, store: { isOpen: true, shippingEnabled: false, pickupEnabled: false } };
    const rDirectNoCourier = engine.execute(parseReq({
      action: 'reserve',
      id: 'inv_direct_001',
      capability: 'e'.repeat(64),
      items: [{ productId: 'phys-1', variant: '', qty: 1, note: '' }],
      customer: { name: 'Edo', phone: '081234567890', address: '' },
      shippingId: 'no_courier',
      voucherCode: '',
      paymentMethod: 'qris'
    }));
    assert.equal(rDirectNoCourier.ok, true);
    assert.equal(rDirectNoCourier.order.totals.shippingCost, 0);
    assert.equal(rDirectNoCourier.order.totals.packaging, 0);
    assert.ok(INVENTORY_COMMERCE.shipping.length >= 3);
  } finally {
    if (savedToken === undefined) delete process.env.INVENTORY_ADMIN_TOKEN;
    else process.env.INVENTORY_ADMIN_TOKEN = savedToken;
  }
});

test('Revision 5 & 6: Frontend checkout UX, WhatsApp formatting, expiry banner/polling stop, custom categories & admin cancel buttons', async () => {
  const storage = new Map();
  const makeEl = (tag = 'div', id = '') => {
    const cls = new Set();
    const attrs = new Map();
    const children = [];
    const el = {
      tagName: tag.toUpperCase(),
      id,
      style: {},
      dataset: {},
      hidden: false,
      disabled: false,
      checked: true,
      inert: false,
      tabIndex: 0,
      value: '',
      children,
      parentNode: null,
      parentElement: null,
      _html: '',
      _text: '',
      get firstElementChild() { return children[0] || el; },
      classList: {
        add: (...k) => k.forEach((x) => cls.add(x)),
        remove: (...k) => k.forEach((x) => cls.delete(x)),
        toggle: (k, f) => (f === undefined ? !cls.has(k) : f) ? cls.add(k) : cls.delete(k),
        contains: (k) => cls.has(k)
      },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => attrs.get(k) ?? null,
      removeAttribute: (k) => attrs.delete(k),
      appendChild: (c) => { c.parentNode = el; c.parentElement = el; children.push(c); return c; },
      insertBefore: (c, ref) => {
        c.parentNode = el;
        c.parentElement = el;
        const idx = children.indexOf(ref);
        if (idx >= 0) children.splice(idx, 0, c);
        else children.push(c);
        return c;
      },
      remove: () => {},
      addEventListener: () => {},
      matches: (sel) => sel === '[role="dialog"]' && (id.includes('modal') || id.includes('drawer')),
      contains: () => false,
      closest: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      getClientRects: () => [],
      focus: () => {},
      scrollIntoView: () => {},
      set innerHTML(v) { el._html = String(v); },
      get innerHTML() { return el._html; },
      set textContent(v) { el._text = String(v); },
      get textContent() { return el._text; }
    };
    return el;
  };

  const bodyEl = makeEl('body', 'body');
  const els = new Map();
  const getEl = (id) => {
    if (!els.has(id)) {
      const node = makeEl('div', id);
      bodyEl.appendChild(node);
      els.set(id, node);
    }
    return els.get(id);
  };

  const pollingEl = makeEl('div');
  pollingEl.style.display = 'flex';
  const catTabsEl = makeEl('div');
  const sliderEl = getEl('tab-active-slider');
  catTabsEl.appendChild(sliderEl);
  catTabsEl.querySelectorAll = (sel) => sel === '.tab-btn' ? catTabsEl.children.filter((c) => c.classList.contains('tab-btn')) : [];

  const nativeSetInterval = globalThis.setInterval;
  const spawnedTimers = [];
  globalThis.setInterval = (fn, ms, ...args) => {
    const id = nativeSetInterval(fn, ms, ...args);
    spawnedTimers.push(id);
    return id;
  };

  let openedWaUrl = '';
  const localStorageMock = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear()
  };

  globalThis.window = {
    location: { protocol: 'http:', search: '', hash: '', origin: 'http://localhost:3000' },
    localStorage: localStorageMock,
    open: (url) => { openedWaUrl = url; return { opener: null }; },
    addEventListener: () => {},
    matchMedia: () => ({ matches: false })
  };
  globalThis.localStorage = localStorageMock;
  globalThis.document = {
    readyState: 'complete',
    body: bodyEl,
    getElementById: (id) => getEl(id),
    createElement: (tag) => makeEl(tag),
    querySelector: (sel) => {
      if (sel === '.polling-indicator') return pollingEl;
      if (sel === '.category-tabs') return catTabsEl;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === '.category-tabs .tab-btn') return catTabsEl.querySelectorAll('.tab-btn');
      return [];
    },
    addEventListener: () => {}
  };
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url).includes('/api/settings') && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, settings: { ...body, qris: { payload: body.payload, uniqueCodeEnabled: false, updatedAt: body.updatedAt } } })
      };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, settings: null, orders: [] }) };
  };

  try {
    const [app, store, catalog, cart, auth] = await Promise.all([
      import('../scripts/app.js'),
      import('../scripts/core/store.js'),
      import('../scripts/core/catalog.js'),
      import('../scripts/core/cart.js'),
      import('../scripts/core/auth.js')
    ]);

    // A) Custom category creation updates catalog selector & storefront tabs
    auth.setInventoryAdminToken('adm-secret');
    getEl('admin-new-category-name').value = 'Roti Manis';
    await app.addCustomProductCategory();
    assert.equal(catalog.getCategoryLabel('roti-manis'), 'Roti Manis');
    assert.ok(store.getSettings().store.categories.some((c) => c.id === 'roti-manis'));
    assert.ok(catTabsEl.children.some((c) => c.dataset.category === 'roti-manis'));
    assert.ok(getEl('new-prod-category').children.some((opt) => opt.value === 'roti-manis'));

    // B) No-courier product hides #customer-address-group + input completely
    const noCourierProd = { ...app.PRODUCTS[0], id: 'prod-nocourier', category: 'roti-manis', requiresShipping: false, stock: 5, isAvailable: true };
    store.saveProducts([noCourierProd, ...app.PRODUCTS], { fromCloud: true, catalogUpdatedAt: Date.now() });
    app.state.cart = [{ key: cart.lineKey('prod-nocourier', noCourierProd.variants[0].label), productId: 'prod-nocourier', variant: noCourierProd.variants[0].label, qty: 1, note: '' }];
    app.updateCartUI();
    assert.equal(getEl('customer-address-group').hidden, true);
    assert.equal(getEl('customer-address').hidden, true);
    assert.equal(getEl('summary-shipping').textContent, 'Tanpa kurir');

    // C) sendOrderToWhatsApp sends clean structured order without QRIS payload string
    const sampleOrder = {
      id: 'ord_wa_1',
      invoice: 'AN261114-001',
      status: 'awaiting_payment',
      createdAt: Date.now(),
      expiresAt: Date.now() + 600_000,
      customer: { name: 'Sari', phone: '081299998888', address: 'Jl. Kenanga 5' },
      shipping: { id: 'instant', name: 'Kurir instan', price: 15000 },
      items: [{ name: 'Kopi Susu', qty: 2, variant: 'Less Sugar', unitPrice: 25000, note: 'Es terpisah' }],
      totals: { subtotal: 50000, discount: 0, shippingCost: 15000, packaging: 2000, total: 67000 },
      payment: { method: 'qris', payload: store.DEMO_STATIC_QRIS }
    };
    store.rememberMyOrder(sampleOrder.id);
    store.saveOrder(sampleOrder, { fromCloud: true });
    app.state.activeCheckoutOrderId = sampleOrder.id;
    app.sendOrderToWhatsApp();
    const decodedMsg = decodeURIComponent(openedWaUrl.split('text=')[1] || '');
    assert.match(decodedMsg, /AN261114-001/);
    assert.match(decodedMsg, /Kopi Susu \(x2\) \[Less Sugar\]/);
    assert.match(decodedMsg, /081299998888/);
    assert.doesNotMatch(decodedMsg, /String QRIS:|00020101/);

    // D) Expired order stops polling spinner and renders auto-cancel banner
    assert.equal(store.acceptsOrder({ status: 'awaiting_payment', updatedAt: 100 }, { status: 'expired', updatedAt: 100 }), true);
    assert.equal(store.acceptsOrder({ status: 'paid', updatedAt: 100 }, { status: 'expired', updatedAt: 200 }), false);
    const expiredOrder = { ...sampleOrder, id: 'ord_exp_1', invoice: 'AN-EXP-1', status: 'awaiting_payment', updatedAt: 100, expiresAt: Date.now() - 1000 };
    store.rememberMyOrder(expiredOrder.id);
    store.saveOrder(expiredOrder, { fromCloud: true });
    await app.openCheckoutModal(expiredOrder.id);
    assert.equal(pollingEl.style.display, 'none');
    assert.equal(getEl('payment-expired-banner').style.display, 'block');
    assert.match(getEl('payment-countdown-clock').textContent, /Batal Otomatis/);
    app.closeCheckoutModal();

    // E) Admin transitions awaiting_payment -> expired to Kedaluwarsa (not Menunggu/Konfirmasi Lunas) and exposes Batalkan
    store.saveAdminOrder({ ...sampleOrder, id: 'adm_exp', invoice: 'INV-EXP', status: 'awaiting_payment', updatedAt: 100 });
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        orders: [
          { ...sampleOrder, id: 'adm_paid', invoice: 'INV-PAID', status: 'paid' },
          { ...sampleOrder, id: 'adm_exp', invoice: 'INV-EXP', status: 'expired', updatedAt: 100 },
          { ...sampleOrder, id: 'adm_comp', invoice: 'INV-COMP', status: 'completed' },
          { ...sampleOrder, id: 'adm_canc', invoice: 'INV-CANC', status: 'cancelled' },
          { ...expiredOrder, status: 'expired', updatedAt: 200 }
        ]
      })
    });
    const inv = await import('../scripts/core/inventory.js');
    await inv.listInventoryOrders();
    app.refreshAdminDashboard();
    const adminRows = getEl('admin-orders-tbody').innerHTML;
    assert.match(adminRows, /INV-EXP[\s\S]*Kedaluwarsa/);
    assert.doesNotMatch(adminRows, /data-order-id="adm_exp"[^>]*>Konfirmasi Lunas/);
    assert.match(adminRows, /AN-EXP-1[\s\S]*Kedaluwarsa/);
    assert.match(adminRows, /adm_paid"[^>]*>Batalkan/);
    assert.match(adminRows, /adm_exp"[^>]*>Batalkan/);
    assert.match(adminRows, /adm_comp"[^>]*>Batalkan/);
    assert.doesNotMatch(adminRows, /adm_canc"[^>]*>Batalkan/);
  } finally {
    spawnedTimers.forEach((id) => clearInterval(id));
    globalThis.setInterval = nativeSetInterval;
  }
});
