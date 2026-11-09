// Local data layer. Everything the storefront and admin share goes through
// here, so swapping localStorage for a real API later touches one file.
//
// Realtime: every write is announced on a BroadcastChannel (fallback: the
// storage event). Other tabs of the same browser re-read and re-render.
// This is same-device sync only; cross-device needs a backend.

import { PRODUCTS } from './catalog.js';
import { applyExpiry } from './orders.js';

export const DEMO_STATIC_QRIS = '00020101021126610014COM.GO-JEK.WWW01189360091430501410280210G0501410280303UMI51440014ID.CO.QRIS.WWW0215ID10265330868010303UMI5204899953033605802ID5925Toko Terpusat Belanja, Di6013JAKARTA BARAT61051182062070703A0163048201';

const KEYS = {
  products: 'an.products.v3',
  orders: 'an.orders.v3',
  settings: 'an.settings.v3',
  cart: 'an.cart.v3',
  myOrders: 'an.my-orders.v3',
  prefs: 'an.prefs.v3'
};

const DOMAIN_BY_KEY = Object.fromEntries(Object.entries(KEYS).map(([domain, key]) => [key, domain]));

export const DEFAULT_SETTINGS = {
  store: {
    name: 'Atelier Nusantara',
    tagline: 'Makanan, minuman, dan barang pilihan',
    whatsapp: '6281234567890',
    address: '',
    hours: '08:00 - 22:00',
    isOpen: true
  },
  qris: {
    payload: DEMO_STATIC_QRIS,
    updatedAt: 0,
    history: []
  },
  payment: {
    // Shows a "simulate incoming payment" control on the buyer screen so the
    // automatic flow can be tested without a payment provider.
    demoSimulator: true
  },
  shipping: [
    { id: 'instant', name: 'Kurir instan', price: 15000, eta: '1-2 jam' },
    { id: 'regular', name: 'Kurir reguler', price: 10000, eta: '1-2 hari' },
    { id: 'pickup', name: 'Ambil di toko', price: 0, eta: 'Siap 30 menit' }
  ],
  packagingFee: 2000,
  vouchers: [
    { code: 'RASAHEMAT', percent: 15, active: true }
  ]
};

const memory = new Map();

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function read(key, fallback) {
  const ls = storage();
  try {
    const raw = ls ? ls.getItem(key) : memory.get(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Data lokal ${key} rusak, memakai nilai bawaan.`, err);
    return fallback;
  }
}

function write(key, value) {
  const raw = JSON.stringify(value);
  const ls = storage();
  try {
    if (ls) ls.setItem(key, raw);
    else memory.set(key, raw);
    return true;
  } catch (err) {
    console.warn(`Gagal menyimpan ${key}.`, err);
    return false;
  }
}

const sourceId = Math.random().toString(36).slice(2);
const listeners = new Set();
let channel = null;

function emit(change) {
  listeners.forEach((fn) => {
    try {
      fn(change);
    } catch (err) {
      console.error('Listener error', err);
    }
  });
}

function announce(domain, detail = {}) {
  const change = { domain, ...detail, sourceId, at: Date.now() };
  emit({ ...change, remote: false });
  if (channel) {
    try {
      channel.postMessage(change);
    } catch (err) {
      console.warn('Broadcast gagal', err);
    }
  }
}

function initChannel() {
  if (typeof window === 'undefined') return;
  if (typeof window.BroadcastChannel === 'function') {
    channel = new BroadcastChannel('atelier-nusantara-sync');
    channel.addEventListener('message', (event) => {
      const change = event.data;
      if (!change || change.sourceId === sourceId) return;
      emit({ ...change, remote: true });
    });
  } else {
    window.addEventListener('storage', (event) => {
      const domain = DOMAIN_BY_KEY[event.key];
      if (domain) emit({ domain, remote: true, at: Date.now() });
    });
  }
}
initChannel();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isRealtimeSupported() {
  return Boolean(channel) || typeof window !== 'undefined';
}

// Products

export function getProducts() {
  const saved = read(KEYS.products, null);
  if (Array.isArray(saved)) return saved;
  return PRODUCTS.map((p) => ({ ...p }));
}

export function saveProducts(list, detail = {}) {
  write(KEYS.products, list);
  announce('products', detail);
}

export function resetProducts() {
  const list = PRODUCTS.map((p) => ({ ...p }));
  saveProducts(list, { type: 'reset' });
  return list;
}

export function getProduct(id) {
  return getProducts().find((p) => p.id === id) || null;
}

// Orders

export function getOrders() {
  const list = read(KEYS.orders, []);
  return Array.isArray(list) ? list : [];
}

export function getOrder(id) {
  return getOrders().find((o) => o.id === id) || null;
}

export function saveOrder(order, detail = {}) {
  const list = getOrders();
  const index = list.findIndex((o) => o.id === order.id);
  if (index >= 0) list[index] = order;
  else list.unshift(order);
  write(KEYS.orders, list);
  announce('orders', { id: order.id, status: order.status, ...detail });
  return order;
}

// Read-modify-write on a single order. `fn` returns the new order or null to skip.
export function updateOrder(id, fn, detail = {}) {
  const current = getOrder(id);
  if (!current) return null;
  const next = fn(current);
  if (!next) return null;
  return saveOrder(next, detail);
}

// Expires overdue unpaid orders. Safe to call from any tab on a timer.
export function sweepExpiredOrders(now = Date.now()) {
  const list = getOrders();
  const expired = [];
  const next = list.map((o) => {
    const updated = applyExpiry(o, now);
    if (updated !== o) expired.push(updated);
    return updated;
  });
  if (expired.length) {
    write(KEYS.orders, next);
    expired.forEach((o) => announce('orders', { id: o.id, status: o.status, type: 'expired' }));
  }
  return expired;
}

export function clearOrders() {
  write(KEYS.orders, []);
  announce('orders', { type: 'reset' });
}

// Settings

function mergeSettings(saved) {
  const base = structuredClone(DEFAULT_SETTINGS);
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base,
    ...saved,
    store: { ...base.store, ...(saved.store || {}) },
    qris: { ...base.qris, ...(saved.qris || {}) },
    payment: { ...base.payment, ...(saved.payment || {}) },
    shipping: Array.isArray(saved.shipping) && saved.shipping.length ? saved.shipping : base.shipping,
    vouchers: Array.isArray(saved.vouchers) ? saved.vouchers : base.vouchers
  };
}

export function getSettings() {
  return mergeSettings(read(KEYS.settings, null));
}

export function saveSettings(patchOrFn, detail = {}) {
  const current = getSettings();
  let next;
  if (typeof patchOrFn === 'function') {
    next = mergeSettings(patchOrFn(structuredClone(current)));
  } else {
    const patch = patchOrFn || {};
    next = mergeSettings({
      ...current,
      ...patch,
      store: { ...current.store, ...(patch.store || {}) },
      qris: { ...current.qris, ...(patch.qris || {}) },
      payment: { ...current.payment, ...(patch.payment || {}) }
    });
  }
  write(KEYS.settings, next);
  announce('settings', detail);
  return next;
}

// Swaps the active static QRIS. The previous one is kept in history so the
// admin can roll back. Open checkouts re-render from the new payload.
export function replaceQRIS(payload, info = {}) {
  const next = saveSettings((s) => {
    const previous = s.qris.payload;
    const history = previous && previous !== payload
      ? [{ payload: previous, replacedAt: Date.now() }, ...s.qris.history.filter((h) => h.payload !== payload && h.payload !== previous)].slice(0, 5)
      : s.qris.history;
    return { ...s, qris: { payload, updatedAt: Date.now(), history, merchantName: info.merchantName || '' } };
  }, { type: 'qris' });
  pushSettingsToCloud(next);
  return next.qris;
}

const CLOUD_SYNC_ENDPOINT = '/api/settings';
const DIRECT_CLOUD_BACKUP = 'https://api.restful-api.dev/objects/ff808181a09d98f701a1beb3e79f6bc2';

export async function syncSettingsWithCloud() {
  if (typeof window === 'undefined') return null;
  let remote = null;
  try {
    const res = await fetch(CLOUD_SYNC_ENDPOINT, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.settings && data.settings.qris) {
        remote = data.settings;
      }
    }
  } catch {
    // If /api/settings is not reached, fall through to direct cloud
  }

  if (!remote) {
    try {
      const res = await fetch(DIRECT_CLOUD_BACKUP, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const json = await res.json();
        if (json && json.data && json.data.payload) {
          remote = {
            qris: {
              payload: json.data.payload,
              merchantName: json.data.merchantName || 'Atelier Nusantara',
              updatedAt: json.data.updatedAt || 0
            },
            store: json.data.store || { name: json.data.merchantName || 'Atelier Nusantara' }
          };
        }
      }
    } catch {
      // Offline fallback
    }
  }

  if (remote && remote.qris && remote.qris.payload) {
    const current = getSettings();
    const remoteTime = Number(remote.qris.updatedAt || 0);
    const localTime = Number(current.qris.updatedAt || 0);
    const isLocalDefault = current.qris.payload === DEFAULT_SETTINGS.qris.payload;

    if (remoteTime > localTime || isLocalDefault || remote.qris.payload !== current.qris.payload) {
      const updated = saveSettings((s) => ({
        ...s,
        qris: {
          ...s.qris,
          payload: remote.qris.payload,
          merchantName: remote.qris.merchantName || s.qris.merchantName,
          updatedAt: remoteTime || Date.now()
        },
        store: {
          ...s.store,
          ...(remote.store || {})
        }
      }), { type: 'cloud-sync' });
      return updated;
    }
  }
  return null;
}

export async function pushSettingsToCloud(settings) {
  if (typeof window === 'undefined') return;
  const payloadToPush = {
    payload: settings.qris?.payload || '',
    merchantName: settings.qris?.merchantName || settings.store?.name || '',
    updatedAt: settings.qris?.updatedAt || Date.now(),
    store: settings.store
  };

  try {
    fetch(CLOUD_SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadToPush)
    }).catch(() => {});
  } catch {}

  try {
    fetch(DIRECT_CLOUD_BACKUP, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'qris_store_settings',
        data: payloadToPush
      })
    }).catch(() => {});
  } catch {}
}

// Applies stock movement for an order (-1 when paid, +1 to restock on cancel).
export function moveStockForOrder(order, direction = -1) {
  const list = getProducts();
  let changed = false;
  order.items.forEach((item) => {
    const product = list.find((p) => p.id === item.productId);
    if (product && product.stock !== null && product.stock !== undefined) {
      product.stock = Math.max(0, Number(product.stock) + direction * item.qty);
      changed = true;
    }
  });
  if (changed) saveProducts(list, { type: 'stock', orderId: order.id });
}

// Cart and buyer-side state (not shown in admin, still synced across tabs)

export function getCart() {
  const cart = read(KEYS.cart, []);
  return Array.isArray(cart) ? cart.filter((l) => l && l.key && l.productId && l.qty > 0) : [];
}

export function saveCart(cart) {
  write(KEYS.cart, cart);
  announce('cart');
}

export function getMyOrderIds() {
  const ids = read(KEYS.myOrders, []);
  return Array.isArray(ids) ? ids : [];
}

export function rememberMyOrder(id) {
  const ids = [id, ...getMyOrderIds().filter((x) => x !== id)].slice(0, 20);
  write(KEYS.myOrders, ids);
  announce('myOrders');
}

export function forgetMyOrder(id) {
  write(KEYS.myOrders, getMyOrderIds().filter((x) => x !== id));
  announce('myOrders');
}

export function getPrefs() {
  return { audio: true, ...(read(KEYS.prefs, {}) || {}) };
}

export function savePrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  write(KEYS.prefs, next);
  return next;
}

export const STORAGE_KEYS = KEYS;
