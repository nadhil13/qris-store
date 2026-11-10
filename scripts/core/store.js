// Local data layer. Everything the storefront and admin share goes through
// here, so swapping localStorage for a real API later touches one file.
//
// Realtime: every write is announced on a BroadcastChannel (fallback: the
// storage event). Other tabs of the same browser re-read and re-render.
// Cross-device: settings go to /api/settings and orders to /api/orders; each
// record carries an updatedAt version and the newer copy wins on merge.

import { PRODUCTS } from './catalog.js';
import { applyExpiry } from './orders.js';
import { inventoryAdminHeaders, hasInventoryAdminToken, rejectUnauthorized } from './auth.js';

export const DEMO_STATIC_QRIS = '00020101021126610014COM.GO-JEK.WWW01189360091430501410280210G0501410280303UMI51440014ID.CO.QRIS.WWW0215ID10265330868010303UMI5204899953033605802ID5925Toko Terpusat Belanja, Di6013JAKARTA BARAT61051182062070703A0163048201';

const KEYS = {
  products: 'an.products.v3',
  catalogVersion: 'an.products.version.v3',
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

let inventoryStock = null;
export const getInventoryStock = () => inventoryStock ? structuredClone(inventoryStock) : null;
export function setInventoryStock(snapshot) {
  if (!snapshot || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0
    || !snapshot.products || typeof snapshot.products !== 'object' || Array.isArray(snapshot.products)
    || Object.values(snapshot.products).some(stock => stock !== null && (!Number.isSafeInteger(stock) || stock < 0 || stock > 1e9))) return false;
  if (inventoryStock && snapshot.revision < inventoryStock.revision) return false;
  inventoryStock = structuredClone(snapshot);
  announce('products', { type: 'inventory-stock' });
  return true;
}

export function getProducts() {
  const saved = read(KEYS.products, null);
  const products = Array.isArray(saved) ? saved : PRODUCTS;
  return products.map(p => !inventoryStock ? { ...p }
    : Object.hasOwn(inventoryStock.products, p.id)
      ? { ...p, stock: inventoryStock.products[p.id] }
      : { ...p, stock: 0, isAvailable: false });
}

const authoritative = order => Boolean(order?.inventory || order?.id?.startsWith('inv_'));

export function getCatalogVersion() {
  return Number(read(KEYS.catalogVersion, 0) || 0);
}

export function saveProducts(list, detail = {}) {
  const metadata = read(KEYS.products, PRODUCTS);
  const safeList = (Array.isArray(list) ? list : []).map(p => {
    const original = metadata.find(old => old.id === p.id);
    return inventoryStock && !detail.fromCloud && original ? { ...p, stock: original.stock } : p;
  });
  write(KEYS.products, safeList);
  let version = getCatalogVersion();
  if (detail && detail.fromCloud) {
    if (Number(detail.catalogUpdatedAt || 0) > 0) {
      version = Number(detail.catalogUpdatedAt);
      write(KEYS.catalogVersion, version);
    }
  } else {
    version = Math.max(Date.now(), version + 1);
    write(KEYS.catalogVersion, version);
    pushCatalogToCloud(safeList, version);
  }
  announce('products', { ...detail, catalogUpdatedAt: version });
  return safeList;
}

export function applyRemoteCatalog(remote) {
  if (!remote || !Array.isArray(remote.products)) return null;
  const remoteTime = Number(remote.catalogUpdatedAt || 0);
  const localVersion = getCatalogVersion();
  if (!(remoteTime > localVersion)) return null;

  const current = getProducts();
  const contentChanged = JSON.stringify(remote.products) !== JSON.stringify(current);
  write(KEYS.catalogVersion, remoteTime);
  if (!contentChanged) return null;

  saveProducts(remote.products, {
    fromCloud: true,
    catalogUpdatedAt: remoteTime,
    type: 'cloud-sync'
  });
  return remote.products;
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
  if (!detail.fromCloud && (authoritative(order) || authoritative(list.find(o => o.id === order.id)))) return null;
  const index = list.findIndex((o) => o.id === order.id);
  if (index >= 0) list[index] = order;
  else list.unshift(order);
  write(KEYS.orders, list);
  announce('orders', { id: order.id, status: order.status, ...detail });
  if (!detail.fromCloud) pushOrderToCloud(order);
  return order;
}

// Read-modify-write on a single order. `fn` returns the new order or null to skip.
export function updateOrder(id, fn, detail = {}) {
  const current = getOrder(id);
  if (!current || authoritative(current)) return null;
  const next = fn(current);
  if (!next) return null;
  return saveOrder(next, detail);
}

// Expires overdue unpaid orders. Safe to call from any tab on a timer.
export function sweepExpiredOrders(now = Date.now()) {
  const list = getOrders();
  const expired = [];
  const next = list.map((o) => {
    if (authoritative(o)) return o;
    const updated = applyExpiry(o, now);
    if (updated !== o) expired.push(updated);
    return updated;
  });
  if (expired.length) {
    write(KEYS.orders, next);
    expired.forEach((o) => {
      announce('orders', { id: o.id, status: o.status, type: 'expired' });
      pushOrderToCloud(o);
    });
  }
  return expired;
}

const ORDERS_ENDPOINT = '/api/orders';

function canReachNetwork() {
  return typeof window !== 'undefined' && typeof fetch === 'function';
}

// Product photos uploaded by the admin are data URLs; they stay local.
function orderForCloud(order) {
  return {
    ...order,
    items: (order.items || []).map((i) => (
      typeof i.image === 'string' && i.image.startsWith('data:') ? { ...i, image: '' } : i
    ))
  };
}

export function pushOrderToCloud(order) {
  if (!canReachNetwork() || !order || !order.id || authoritative(order)) return;
  try {
    fetch(ORDERS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: orderForCloud(order) }),
      keepalive: true
    }).catch(() => {});
  } catch {}
}

function isValidOrder(o) {
  return o && typeof o.id === 'string' && typeof o.status === 'string' && Array.isArray(o.items) && o.totals;
}

// Merges orders received from the server into local storage. The copy with
// the higher updatedAt wins. Returns what changed so the UI can react, plus
// local orders the server has not seen yet (or holds an older copy of).
export function mergeRemoteOrders(remoteList) {
  const local = getOrders();
  const byId = new Map(local.map((o) => [o.id, o]));
  const added = [];
  const changed = [];
  const remoteIds = new Set();

  (Array.isArray(remoteList) ? remoteList : []).filter(isValidOrder).forEach((remote) => {
    const mine = byId.get(remote.id);
    if (authoritative(remote) || authoritative(mine)) return;
    remoteIds.add(remote.id);
    if (!mine) {
      byId.set(remote.id, remote);
      added.push(remote);
    } else if (Number(remote.updatedAt || 0) > Number(mine.updatedAt || 0)) {
      const items = remote.items.map((item, i) => ({ ...item, image: item.image || mine.items?.[i]?.image || '' }));
      byId.set(remote.id, { ...remote, items });
      changed.push(remote);
    }
  });

  const remoteById = new Map((Array.isArray(remoteList) ? remoteList : []).filter(isValidOrder).map((o) => [o.id, o]));
  const staleOnServer = local.filter((o) => {
    if (authoritative(o)) return false;
    const remote = remoteById.get(o.id);
    return !remote || Number(o.updatedAt || 0) > Number(remote.updatedAt || 0);
  });

  if (added.length || changed.length) {
    const merged = [...byId.values()].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    write(KEYS.orders, merged);
    announce('orders', { type: 'cloud-sync', added: added.map((o) => o.id), changed: changed.map((o) => o.id) });
  }
  return { added, changed, staleOnServer, remoteCount: remoteIds.size };
}

// Pulls the shared order list. `online` is false when the endpoint could not
// be reached, so the admin screen can say the data is local only.
export async function syncOrdersWithCloud() {
  if (!canReachNetwork()) return { online: false, added: [], changed: [] };
  let remote = null;
  try {
    const res = await fetch(ORDERS_ENDPOINT, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.orders)) remote = data.orders;
    }
  } catch {
    // offline or endpoint missing
  }
  if (!remote) return { online: false, added: [], changed: [] };
  const result = mergeRemoteOrders(remote);
  // Re-upload anything created here while the server was unreachable.
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  result.staleOnServer.filter((o) => Number(o.createdAt || 0) > dayAgo).slice(0, 20).forEach(pushOrderToCloud);
  return { online: true, ...result };
}

export function clearOrders() {
  write(KEYS.orders, getOrders().filter(authoritative));
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
export async function replaceQRIS(payload, info = {}) {
  const next = await saveSharedSettings((s) => {
    const previous = s.qris.payload;
    const history = previous && previous !== payload
      ? [{ payload: previous, replacedAt: Date.now() }, ...s.qris.history.filter((h) => h.payload !== payload && h.payload !== previous)].slice(0, 5)
      : s.qris.history;
    return { ...s, qris: { payload, updatedAt: Date.now(), history, merchantName: info.merchantName || '' } };
  }, { type: 'qris' });
  return next.qris;
}

// Version of the settings every visitor shares (QRIS + store contact).
// Older saved data only has qris.updatedAt, so fall back to it.
export function sharedVersion(settings) {
  return Number(settings?.sharedUpdatedAt || settings?.qris?.updatedAt || 0);
}

// Saves settings that every visitor must see and publishes them. Each save
// gets a fresh version so a later poll cannot roll it back.
export async function saveSharedSettings(patchOrFn, detail = {}) {
  const s = getSettings();
  const patched = typeof patchOrFn === 'function' ? patchOrFn(structuredClone(s)) : { ...s, ...patchOrFn, store: { ...s.store, ...(patchOrFn?.store || {}) } };
  const next = mergeSettings({ ...patched, sharedUpdatedAt: Math.max(Date.now(), sharedVersion(s) + 1) });
  if (canReachNetwork() && !await pushSettingsToCloud(next)) throw Error('Pengaturan belum tersimpan di server. Periksa token dan koneksi lalu coba lagi.');
  return saveSettings(next, detail);
}

export async function publishProducts(products, detail = {}) {
  const metadata = read(KEYS.products, PRODUCTS);
  const safeList = products.map(p => {
    const original = metadata.find(old => old.id === p.id);
    return inventoryStock && original ? { ...p, stock: original.stock } : { ...p };
  });
  const version = Math.max(Date.now(), getCatalogVersion() + 1);
  if (canReachNetwork() && !await pushCatalogToCloud(safeList, version)) throw Error('Katalog belum tersimpan di server. Periksa token dan koneksi lalu coba lagi.');
  return saveProducts(safeList, { ...detail, fromCloud: true, catalogUpdatedAt: version });
}

const CLOUD_SYNC_ENDPOINT = '/api/settings';
async function postShared(payload) {
  const response = await fetch(CLOUD_SYNC_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...inventoryAdminHeaders() },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(8000)
  });
  rejectUnauthorized(response);
  if (!response.ok) throw Error('Pengaturan ditolak server.');
  return response;
}

export async function pushCatalogToCloud(products = read(KEYS.products, PRODUCTS), catalogUpdatedAt = getCatalogVersion()) {
  if (!canReachNetwork() || !hasInventoryAdminToken()) return false;
  const version = Number(catalogUpdatedAt || 0);
  if (version <= 0) return;
  const payloadToPush = {
    catalogUpdatedAt: version,
    products: (Array.isArray(products) ? products : []).map(p => {
      const metadata = read(KEYS.products, PRODUCTS).find(original => original.id === p.id);
      return inventoryStock && metadata ? { ...p, stock: metadata.stock } : p;
    })
  };
  try {
    const response = await postShared(payloadToPush);
    const data = await response.json();
    if (!data.ok || !data.settings || Number(data.settings.catalogUpdatedAt) !== version) return false;
    applyRemoteSettings(data.settings);
    return true;
  } catch { return false; }
}

// Adopts remote settings only when they are strictly newer than ours.
// Returns the saved settings when something visible changed, else null.
export function applyRemoteSettings(remote) {
  if (!remote) return null;
  if (Array.isArray(remote.products) && Number(remote.catalogUpdatedAt || 0) > 0) {
    applyRemoteCatalog(remote);
  }
  if (!remote.qris || !remote.qris.payload) return null;
  const current = getSettings();
  const remoteTime = Number(remote.updatedAt || remote.qris.updatedAt || 0);
  if (!(remoteTime > sharedVersion(current))) return null;

  const remoteStore = remote.store && typeof remote.store === 'object' ? remote.store : {};
  const nextStore = { ...current.store, ...remoteStore };
  const contentChanged = remote.qris.payload !== current.qris.payload
    || JSON.stringify(nextStore) !== JSON.stringify(current.store);

  const updated = saveSettings((s) => ({
    ...s,
    sharedUpdatedAt: remoteTime,
    qris: {
      ...s.qris,
      payload: remote.qris.payload,
      merchantName: remote.qris.merchantName || s.qris.merchantName,
      updatedAt: remoteTime
    },
    store: nextStore
  }), { type: contentChanged ? 'cloud-sync' : 'cloud-version' });
  return contentChanged ? updated : null;
}

export async function syncSettingsWithCloud() {
  if (typeof window === 'undefined') return null;
  let remote = null;
  try {
    const res = await fetch(CLOUD_SYNC_ENDPOINT, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.settings) {
        remote = data.settings;
      }
    }
  } catch {
    // Offline or endpoint unreachable
  }

  const remoteCatalogVersion = Number(remote?.catalogUpdatedAt || 0);
  const localCatalogVersion = getCatalogVersion();
  if (hasInventoryAdminToken() && localCatalogVersion > remoteCatalogVersion) {
    pushCatalogToCloud(getProducts(), localCatalogVersion);
  }

  const localSettings = getSettings();
  if (hasInventoryAdminToken() && sharedVersion(localSettings) > Number(remote?.updatedAt || remote?.qris?.updatedAt || 0)) {
    pushSettingsToCloud(localSettings);
  }
  return applyRemoteSettings(remote);
}

export async function pushSettingsToCloud(settings) {
  if (!canReachNetwork() || !hasInventoryAdminToken()) return false;
  const catalogVersion = getCatalogVersion();
  const payloadToPush = {
    payload: settings.qris?.payload || '',
    merchantName: settings.qris?.merchantName || settings.store?.name || '',
    updatedAt: sharedVersion(settings) || Date.now(),
    store: settings.store
  };
  if (catalogVersion > 0) {
    payloadToPush.catalogUpdatedAt = catalogVersion;
    payloadToPush.products = read(KEYS.products, PRODUCTS);
  }

  try {
    const response = await postShared(payloadToPush);
    const data = await response.json();
    if (!data.ok || !data.settings || Number(data.settings.updatedAt) !== payloadToPush.updatedAt) return false;
    return true;
  } catch { return false; }
}

// Applies stock movement for an order (-1 when paid, +1 to restock on cancel).
export function moveStockForOrder(order, direction = -1) {
  if (authoritative(order) || inventoryStock) return;
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
