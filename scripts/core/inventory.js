import { saveOrder, saveAdminOrder, notifyOrdersBatch, getAdminOrders, rememberMyOrder, forgetMyOrder, setInventoryStock, getOrders } from './store.js';

const KEY = 'an.inventory.reservations.v1';
const INVENTORY_ERROR_MESSAGES = {
  ADDRESS_REQUIRED: 'Alamat pengantaran wajib diisi untuk kurir pilihan Anda.',
  INVALID_REQUEST: 'Lengkapi nama pemesan (minimal 2 huruf), nomor WhatsApp (minimal 8 angka), dan alamat yang sesuai.',
  OUT_OF_STOCK: 'Sebagian stok produk baru saja habis. Periksa kembali keranjang Anda.',
  PRODUCT_UNAVAILABLE: 'Salah satu produk di keranjang sedang tidak tersedia.',
  STORE_CLOSED: 'Maaf, toko sedang tutup sementara waktu.',
  INVALID_VOUCHER: 'Kode voucher tidak berlaku atau sudah tidak aktif.',
  INVALID_SHIPPING: 'Metode pengiriman tidak valid. Silakan pilih ulang.',
  INVALID_VARIANT: 'Varian produk berubah. Hapus item lalu tambahkan ulang ke keranjang.',
  ORDER_NOT_FOUND: 'Pesanan tidak ditemukan atau sudah kedaluwarsa di server.',
  ORDER_CAPACITY_REACHED: 'Antrean server sedang penuh. Hubungi penjual lewat WhatsApp.',
  STORAGE_UNAVAILABLE: 'Server sedang sibuk menyimpan pesanan. Coba beberapa detik lagi.',
  IDEMPOTENCY_CONFLICT: 'Pesanan sebelumnya masih tersimpan dengan rincian berbeda. Muat ulang halaman lalu coba lagi.',
  INVALID_TRANSITION: 'Status pesanan sudah berubah dan tidak dapat diproses lagi.',
  REVISION_CONFLICT: 'Data stok baru saja berubah. Tampilan sudah diperbarui, silakan ulangi.'
};
export function formatInventoryError(error) {
  const code = error?.code || error?.message || '';
  if (INVENTORY_ERROR_MESSAGES[code]) return INVENTORY_ERROR_MESSAGES[code];
  if (typeof error?.message === 'string' && error.message && !/^[A-Z_]+$/.test(error.message)) return error.message;
  return 'Terjadi kendala saat menghubungi server toko. Coba lagi sebentar lagi.';
}
import { hasInventoryAdminToken, getAdminSessionVersion, inventoryAdminHeaders, rejectUnauthorized } from './auth.js';
export { hasInventoryAdminToken, setInventoryAdminToken } from './auth.js';
let reserving = false;
let syncing = false;
export const isInventoryOrder = order => Boolean(order?.inventory || order?.id?.startsWith('inv_') || getReservations().some(r => r.payload.id === order?.id));

function durableStorage() {
  const storage = globalThis.localStorage || globalThis.window?.localStorage;
  if (!storage) throw Error('Penyimpanan browser diperlukan untuk reservasi.');
  return storage;
}
function getReservations() {
  try { const records = JSON.parse(durableStorage().getItem(KEY) || '[]'); return Array.isArray(records) ? records.filter(r => r?.payload?.id && r.payload.capability) : []; } catch { return []; }
}
export const getPendingReservation = () => structuredClone(getReservations().find(r => r.pending) || null);
function persist(records) {
  const storage = durableStorage();
  const raw = JSON.stringify(records);
  storage.setItem(KEY, raw);
  if (storage.getItem(KEY) !== raw) throw Error('Reservasi tidak dapat disimpan.');
}
function randomHex(bytes) {
  if (!globalThis.crypto?.getRandomValues) throw Error('Browser memerlukan kriptografi aman.');
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), n => n.toString(16).padStart(2, '0')).join('');
}
async function request(action, { body, query = {}, admin = false } = {}) {
  if (globalThis.window?.location?.protocol === 'file:') throw Error('Reservasi tidak didukung pada demo file. Gunakan server HTTP.');
  if (admin && !hasInventoryAdminToken()) throw Error('Token admin backend diperlukan. Masuk melalui formulir admin.');
  const sessionVersion = getAdminSessionVersion();
  const url = body ? '/api/inventory' : `/api/inventory?${new URLSearchParams({ action, ...query })}`;
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET', cache: 'no-store',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(admin ? inventoryAdminHeaders() : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000)
  });
  if (admin && sessionVersion !== getAdminSessionVersion()) throw Error('Sesi admin berubah. Masuk kembali.');
  rejectUnauthorized(response);
  const result = await response.json();
  if (admin && response.status !== 401 && sessionVersion !== getAdminSessionVersion()) throw Error('Sesi admin berubah. Masuk kembali.');
  if (!response.ok || result.ok !== true) {
    const error = Error(result.code || 'Reservasi gagal. Coba lagi dengan pesanan yang sama.');
    error.code = result.code;
    error.status = response.status;
    error.definitive = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
    throw error;
  }
  if (action === 'stock' || action === 'adjust') {
    if (!setInventoryStock(result.stock)) throw Error('Respons stok tidak valid atau sudah usang. Muat ulang stok.');
  } else if (result.stock) setInventoryStock(result.stock);
  return result;
}
function accept(order, { silent = false } = {}) {
  if (!order?.id || !['awaiting_payment', 'paid', 'processing', 'ready', 'completed', 'expired', 'cancelled'].includes(order.status) || !Array.isArray(order.items) || !order.totals) throw Error('Respons pesanan tidak valid. Coba lagi.');
  const owned = getReservations().some(r => r.payload.id === order.id);
  if (owned) rememberMyOrder(order.id);
  const next = { ...order, inventory: true };
  return owned ? saveOrder(next, { fromCloud: true, type: 'inventory', silent }) : saveAdminOrder(next, { silent });
}
export async function reserveInventory(input) {
  if (reserving) throw Error('Reservasi sedang diproses.');
  reserving = true;
  try {
    const records = getReservations();
    const signature = JSON.stringify(input);
    let record = records.find(r => r.pending);
    if (record && record.signature !== signature) throw Error('Reservasi sebelumnya belum pasti. Coba lagi dengan keranjang dan data pemesan yang sama.');
    if (!record) {
      const known = new Map(getOrders().map(order => [order.id, order]));
      const existing = records.find(r => r.signature === signature && known.get(r.payload.id)?.status === 'awaiting_payment');
      if (existing) {
        const recovered = await refreshInventoryOrder(existing.payload.id);
        if (recovered.status === 'awaiting_payment') return recovered;
      }
    }
    if (record) {
      try { return await refreshInventoryOrder(record.payload.id); }
      catch (error) {
        if (!(error.status === 404 && error.code === 'ORDER_NOT_FOUND')) throw error;
      }
    }
    if (!record) {
      record = { createdAt: Date.now(), signature, pending: true, payload: { action: 'reserve', id: `inv_${randomHex(16)}`, capability: randomHex(32), ...input } };
      records.push(record);
    }
    persist(records);
    let result;
    try { result = await request('reserve', { body: record.payload }); }
    catch (error) {
      if (error.definitive) { records.splice(records.indexOf(record), 1); persist(records); }
      throw error;
    }
    const order = accept(result.order);
    record.pending = false;
    persist(records);
    return order;
  } finally { reserving = false; }
}
export async function adjustInventoryStock(productId, stock, expectedRevision) {
  if (!(stock === null || (Number.isSafeInteger(stock) && stock >= 0 && stock <= 1e9)) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw Error('Stok atau revisi tidak valid.');
  try {
    return await request('adjust', { admin: true, body: { action: 'adjust', productId, stock, expectedRevision } });
  } catch (error) {
    if (error.message === 'REVISION_CONFLICT') await refreshInventoryStock().catch(() => { });
    throw error;
  }
}
export async function refreshInventoryStock() { return request('stock'); }
export async function refreshInventoryOrder(id) {
  const record = getReservations().find(r => r.payload.id === id);
  if (!record) throw Error('Kapabilitas pesanan tidak tersedia.');
  const result = await request('order', { query: { id, capability: record.payload.capability } });
  if (result.order?.id !== id) throw Error('Respons pesanan tidak cocok.');
  const order = accept(result.order);
  const records = getReservations();
  const current = records.find(r => r.payload.id === id);
  if (current) { current.pending = false; persist(records); }
  return order;
}
export async function listInventoryOrders() {
  const result = await request('list', { admin: true });
  if (!Array.isArray(result.orders)) throw Error('Respons daftar pesanan tidak valid.');
  const orderSignature = () => getAdminOrders()
    .map((o) => `${o.id}:${o.status}:${o.updatedAt || 0}:${o.revision ?? ''}`)
    .join('|');
  const before = orderSignature();
  const saved = result.orders.map((order) => accept(order, { silent: true }));
  if (orderSignature() !== before) {
    notifyOrdersBatch({ type: 'admin-inventory' });
  }
  return saved;
}
export async function transitionInventoryOrder(action, id, detail = {}) {
  const result = await request(action, { admin: true, body: { action, id, ...detail } });
  return accept(result.order);
}
export async function syncInventory() {
  if (syncing) return;
  syncing = true;
  try {
    await refreshInventoryStock();
    if (hasInventoryAdminToken()) await listInventoryOrders();
    else {
      const known = new Map(getOrders().map(o => [o.id, o]));
      const targets = getReservations().filter(r => r.pending || !['completed', 'expired', 'cancelled'].includes(known.get(r.payload.id)?.status));
      const deadIds = new Set();
      await Promise.all(targets.map(r => refreshInventoryOrder(r.payload.id).catch((error) => {
        const stalePending = r.pending && !reserving && Number.isFinite(r.createdAt) && (Date.now() - r.createdAt > 120000);
        if (error?.status === 404 && error?.code === 'ORDER_NOT_FOUND' && (!r.pending || stalePending)) {
          deadIds.add(r.payload.id);
        }
        return null;
      })));
      if (deadIds.size) {
        persist(getReservations().filter(r => !deadIds.has(r.payload.id)));
        deadIds.forEach(id => forgetMyOrder(id));
        getOrders();
      }
    }
  } finally { syncing = false; }
}
