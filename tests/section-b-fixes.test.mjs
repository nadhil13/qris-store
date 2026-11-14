import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (rel) => readFile(new URL(`../${rel}`, import.meta.url), 'utf8');

function setupMockDom() {
  const domMap = new Map();
  const storageMap = new Map();
  let fetchHandler = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, orders: [], products: [], settings: {} })
  });

  const makeEl = (id = '') => {
    const classes = new Set();
    const attrs = new Map();
    return {
      id,
      hidden: false,
      disabled: false,
      checked: false,
      value: '',
      defaultValue: '',
      src: '',
      alt: '',
      href: '',
      textContent: '',
      _html: '',
      style: {},
      dataset: {},
      inert: false,
      attributes: attrs,
      parentElement: null,
      children: [],
      set innerHTML(val) { this._html = String(val); },
      get innerHTML() { return this._html; },
      addEventListener: () => {},
      removeEventListener: () => {},
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      removeAttribute: (k) => attrs.delete(k),
      focus: () => {},
      closest: () => null,
      matches: (sel) => sel === '[role="dialog"]',
      contains: () => false,
      querySelector: (sel) => {
        if (sel === 'span') return makeEl(`${id}__span`);
        return null;
      },
      querySelectorAll: () => [],
      classList: {
        add: (...names) => names.forEach((n) => classes.add(n)),
        remove: (...names) => names.forEach((n) => classes.delete(n)),
        toggle: (n, force) => {
          if (typeof force === 'boolean') {
            if (force) classes.add(n);
            else classes.delete(n);
            return force;
          }
          if (classes.has(n)) {
            classes.delete(n);
            return false;
          }
          classes.add(n);
          return true;
        },
        contains: (n) => classes.has(n)
      }
    };
  };

  const doc = {
    body: { ...makeEl('body') },
    head: { appendChild: (node) => node.onload?.() },
    readyState: 'loading',
    visibilityState: 'visible',
    activeElement: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: (tag) => makeEl(tag),
    getElementById: (id) => {
      if (!domMap.has(id)) {
        const el = makeEl(id);
        el.parentElement = doc.body;
        domMap.set(id, el);
      }
      return domMap.get(id);
    },
    querySelectorAll: () => [],
    querySelector: () => null
  };

  const storage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => { storageMap.set(k, String(v)); },
    removeItem: (k) => { storageMap.delete(k); }
  };

  globalThis.document = doc;
  globalThis.localStorage = storage;
  globalThis.fetch = (url, opts) => fetchHandler(url, opts);
  globalThis.window = {
    document: doc,
    localStorage: storage,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { href: 'https://qris-store.vercel.app/', origin: 'https://qris-store.vercel.app', search: '' }
  };
  globalThis.requestAnimationFrame = (cb) => cb();
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });

  return {
    domMap,
    storageMap,
    setFetch: (fn) => { fetchHandler = fn; }
  };
}

test('Section B #1: jsQR is lazy-loaded only on admin QR scan, not eagerly in index.html or SW precache', async () => {
  const [html, sw, qrisSrc] = await Promise.all([
    read('index.html'),
    read('sw.js'),
    read('scripts/qris.js')
  ]);

  assert.doesNotMatch(html, /<script[^>]+jsqr\.js/i, 'index.html must not eagerly load jsqr.js');
  assert.doesNotMatch(sw, /vendor\/jsqr\.js/, 'sw.js must not precache 257KB jsqr.js for storefront visitors');
  assert.match(qrisSrc, /export async function ensureJsQRLoaded\(\)/);
  assert.match(qrisSrc, /await ensureJsQRLoaded\(\)/);
});

test('Section B #2: index.html & styles/main.css enforce accessible semantics, opaque cards, 44px targets, and clean placeholders', async () => {
  const [html, css] = await Promise.all([
    read('index.html'),
    read('styles/main.css')
  ]);

  assert.match(html, /<button[^>]+type="button"[^>]+id="drawer-backdrop"/);
  assert.doesNotMatch(html, /<div[^>]+id="drawer-backdrop"/);
  assert.doesNotMatch(html, /<img[^>]+src=""/, 'Images must never have empty src=""');
  assert.doesNotMatch(html, /id="(payment-invoice-number|receipt-invoice|qv-title|tracker-invoice)"[^>]*>\s*-\s*</);
  assert.match(html, /class="qris-mode-btn is-active"/);
  assert.doesNotMatch(html, /id="btn-qris-mode-dynamic"[^>]*style="[^"]*background:/);
  assert.match(html, /id="admin-orders-error-banner"[^>]*role="alert"/);
  assert.match(html, /id="admin-overview-queue"/);
  assert.match(html, /id="admin-overview-qris"/);
  assert.match(html, /id="admin-overview-webhook"/);
  assert.match(html, /id="admin-orders-table-wrap"/);
  assert.match(html, /Lacak Pesanan[^<]*sudut kanan bawah|sudut kanan bawah[^<]*Lacak Pesanan/i);

  assert.match(css, /--bg-card:\s*#fffcf7;/i);
  assert.match(css, /\.qris-mode-btn\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /\.btn-admin-action\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /\.btn-admin-sm\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /\.btn-copy-raw\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /\.pay-tab\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /\.admin-orders-items\s*\{/);
  assert.match(css, /\.admin-orders-table\s+td::before[\s\S]*?content:\s*attr\(data-label\)/);
  assert.doesNotMatch(css, /\.admin-login-btn\b|\.hero-kicker\b|\.btn-simulate-pay\b|\.merchant-config-modal\b/);
});

test('Section B #3: syncFeaturedShowcase binds hero and story dossier to live catalog prices & availability', async () => {
  setupMockDom();
  const [app, store] = await Promise.all([
    import('../scripts/app.js'),
    import('../scripts/core/store.js')
  ]);

  const products = store.getProducts();
  const target = {
    ...products[0],
    id: 'prod-01',
    name: 'Wagyu Se’i Reserve',
    price: 92000,
    isAvailable: true,
    stock: 4,
    variants: [
      { label: 'Level 0: Mild', priceDelta: 0 },
      { label: 'Level 2: Extra Truffle', priceDelta: 15000 }
    ]
  };
  app.syncFeaturedShowcase([target]);

  assert.equal(document.getElementById('hero-showcase-title').textContent, 'Wagyu Se’i Reserve');
  assert.match(document.getElementById('hero-showcase-price').textContent, /92\.000/);
  assert.equal(document.getElementById('story-panel-1-title').textContent, 'Wagyu Se’i Reserve');
  assert.match(document.getElementById('story-panel-1-price').textContent, /92\.000/);
  assert.match(document.getElementById('story-panel-1-chips').innerHTML, /Level 2 · Extra Truffle|Level 2/);

  app.syncFeaturedShowcase([{ ...target, isAvailable: false, stock: 0 }]);
  assert.equal(document.getElementById('hero-showcase-btn').disabled, true);
  assert.equal(document.getElementById('hero-showcase-quick-btn').disabled, true);
  assert.equal(document.getElementById('hero-showcase-tag').textContent, 'Stok habis');
});

test('Section B #4: Admin AOV divides by settled orders, single empty state avoids double table text, and order sync failure offers retry', async () => {
  const { setFetch } = setupMockDom();
  const [app, store, inv] = await Promise.all([
    import('../scripts/app.js'),
    import('../scripts/core/store.js'),
    import('../scripts/core/inventory.js')
  ]);

  inv.setInventoryAdminToken('secret-token');
  app.state.adminAuthenticated = true;

  // Empty state renders once (table container hidden, tbody empty)
  app.refreshAdminDashboard();
  assert.equal(document.getElementById('admin-empty-state').hidden, false);
  assert.equal(document.getElementById('admin-orders-table-wrap').hidden, true);
  assert.equal(document.getElementById('admin-orders-tbody').innerHTML, '', 'Must not render a second empty state inside tbody');

  for (const ord of [
    {
      id: 'ord-paid-1',
      invoice: 'INV-PAID-1',
      status: 'paid',
      createdAt: Date.now(),
      customer: { name: 'Budi', phone: '0811111111' },
      items: [{ name: 'Wagyu Se’i', qty: 1 }],
      totals: { total: 100000 }
    },
    {
      id: 'ord-done-2',
      invoice: 'INV-DONE-2',
      status: 'completed',
      createdAt: Date.now() - 1000,
      customer: { name: 'Sari', phone: '0822222222' },
      items: [{ name: 'Kopi Susu', qty: 2 }],
      totals: { total: 60000 }
    },
    {
      id: 'ord-cancel-3',
      invoice: 'INV-CANC-3',
      status: 'cancelled',
      createdAt: Date.now() - 2000,
      customer: { name: 'Andi', phone: '0833333333' },
      items: [{ name: 'Gelato', qty: 1 }],
      totals: { total: 40000 }
    },
    {
      id: 'ord-exp-4',
      invoice: 'INV-EXP-4',
      status: 'expired',
      createdAt: Date.now() - 3000,
      customer: { name: 'Tono', phone: '0844444444' },
      items: [{ name: 'Matcha', qty: 1 }],
      totals: { total: 50000 }
    }
  ]) {
    store.saveAdminOrder(ord, { silent: true });
  }

  app.refreshAdminDashboard();

  assert.equal(document.getElementById('admin-metric-orders').textContent, 4);
  assert.equal(document.getElementById('admin-metric-settled').textContent, 2);
  assert.match(document.getElementById('admin-metric-omzet').textContent, /160\.000/);
  assert.match(document.getElementById('admin-metric-aov').textContent, /80\.000/, 'AOV must divide settled omzet by settled orders count (2), not total orders (4)');
  assert.equal(document.getElementById('admin-empty-state').hidden, true);
  assert.equal(document.getElementById('admin-orders-table-wrap').hidden, false);
  const tbodyHtml = document.getElementById('admin-orders-tbody').innerHTML;
  assert.match(tbodyHtml, /data-label="Item Pesanan" class="admin-orders-items"/);
  assert.doesNotMatch(tbodyHtml, /max-width:\s*220px/);
  assert.match(document.getElementById('admin-overview-queue').innerHTML, /INV-PAID-1/);

  setFetch(async (url) => {
    if (String(url).includes('action=list')) {
      return { ok: false, status: 503, json: async () => ({ error: 'KV_TIMEOUT' }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, configured: false, recentEvents: [] }) };
  });

  app.openAdminDashboardModal();
  await new Promise((r) => setTimeout(r, 20));
  const errBanner = document.getElementById('admin-orders-error-banner');
  assert.equal(errBanner.hidden, false, 'Order sync failure must show visible error banner');
  assert.match(errBanner.innerHTML, /retryAdminOrdersSync\(\)/);

  setFetch(async (url) => {
    if (String(url).includes('action=list')) {
      return { ok: true, status: 200, json: async () => ({ ok: true, orders: [] }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  await app.retryAdminOrdersSync();
  assert.equal(errBanner.hidden, true, 'Successful retry must clear admin order error banner');
});

test('Section B #5: Dead .hero-kicker GSAP animations removed, clearProps never undefined, and responsive CSS contracts enforced', async () => {
  const [src, css] = await Promise.all([read('scripts/app.js'), read('styles/main.css')]);
  assert.doesNotMatch(src, /\.hero-kicker/);
  assert.doesNotMatch(src, /clearProps:\s*isScrub\s*\?\s*undefined/);
  assert.match(src, /el\.classList\.toggle\(['"]is-active['"]/);
  assert.match(src, /setModeState\(btnDynamic, mode === 'dynamic'\)/);
  assert.match(src, /setModeState\(btnStatic, mode === 'static'\)/);
  assert.match(css, /\.catalog-section\s*\{[\s\S]*?scroll-margin-top:/);
  assert.match(css, /\.qris-mode-switch\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.admin-orders-table\s+td\[data-label="No\. Invoice"\]/);
});

test('Section B #6: products domain sync and openCartDrawer refresh stale cart totals when live inventory arrives after load', async () => {
  setupMockDom();
  const nativeSetInterval = globalThis.setInterval;
  const spawnedTimers = [];
  globalThis.setInterval = (fn, ms, ...args) => {
    const id = nativeSetInterval(fn, ms, ...args);
    spawnedTimers.push(id);
    return id;
  };
  try {
    const [app, store] = await Promise.all([
      import('../scripts/app.js'),
      import('../scripts/core/store.js')
    ]);

    const prod = {
      id: 'prod-custom-delay',
      name: 'Kopi Digital',
      category: 'digital',
      price: 1000,
      isAvailable: true,
      stock: 0,
      description: 'Produk digital',
      story: 'Riwayat singkat.',
      image: './assets/notification-icon.svg',
      variants: []
    };
    store.saveSettings((s) => ({ ...s, store: { ...s.store, isOpen: true } }));
    store.saveProducts([prod], { fromCloud: true, catalogUpdatedAt: Date.now() });
    const baseRev = store.getInventoryStock()?.revision || 0;
    store.setInventoryStock({ revision: baseRev + 1, products: {} });
    const cartLines = [{ key: `${prod.id}::`, productId: prod.id, variant: '', qty: 1, note: '' }];
    store.saveCart(cartLines);
    app.state.cart = cartLines;

    app.initRealtimeSync();
    app.updateCartUI();
    assert.equal(document.getElementById('drawer-count').textContent, '(0 pesanan)');
    assert.equal(document.getElementById('btn-checkout').disabled, true);

    store.setInventoryStock({ revision: baseRev + 2, products: { [prod.id]: 98 } });
    assert.equal(document.getElementById('drawer-count').textContent, '(1 pesanan)');
    assert.match(document.getElementById('summary-subtotal').textContent, /1\.000/);
    assert.equal(document.getElementById('btn-checkout').disabled, false);
    assert.equal(document.getElementById('btn-checkout-whatsapp').disabled, false);

    document.getElementById('drawer-count').textContent = 'stale';
    app.openCartDrawer();
    assert.equal(document.getElementById('drawer-count').textContent, '(1 pesanan)');
    app.closeCartDrawer();
  } finally {
    spawnedTimers.forEach((id) => clearInterval(id));
    globalThis.setInterval = nativeSetInterval;
  }
});
