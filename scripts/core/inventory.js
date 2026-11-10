import { saveOrder, setInventoryStock, getOrders } from './store.js';

const KEY = 'an.inventory.reservations.v1';
import { hasInventoryAdminToken, inventoryAdminHeaders, rejectUnauthorized } from './auth.js';
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
  try { return JSON.parse(durableStorage().getItem(KEY) || '[]'); } catch { return []; }
}
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
  const url = body ? '/api/inventory' : `/api/inventory?${new URLSearchParams({ action, ...query })}`;
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET', cache: 'no-store',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(admin ? inventoryAdminHeaders() : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000)
  });
  rejectUnauthorized(response);
  const result = await response.json();
  if (!response.ok || result.ok !== true) {
    const error = Error(result.code || 'Reservasi gagal. Coba lagi dengan pesanan yang sama.');
    error.definitive = response.status >= 400 && response.status < 500;
    throw error;
  }
  if (action === 'stock' || action === 'adjust') {
    if (!setInventoryStock(result.stock)) throw Error('Respons stok tidak valid atau sudah usang. Muat ulang stok.');
  } else if (result.stock) setInventoryStock(result.stock);
  return result;
}
function accept(order) {
  if (!order?.id || !order.status || !Array.isArray(order.items) || !order.totals) throw Error('Respons pesanan tidak valid. Coba lagi.');
  return saveOrder({ ...order, inventory: true }, { fromCloud: true, type: 'inventory' });
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
      record = { signature, pending: true, payload: { action: 'reserve', id: `inv_${randomHex(16)}`, capability: randomHex(32), ...input } };
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
    if (error.message === 'REVISION_CONFLICT') await refreshInventoryStock().catch(() => {});
    throw error;
  }
}
export async function refreshInventoryStock() { return request('stock'); }
export async function refreshInventoryOrder(id) {
  const record = getReservations().find(r => r.payload.id === id);
  if (!record) throw Error('Kapabilitas pesanan tidak tersedia.');
  return accept((await request('order', { query: { id, capability: record.payload.capability } })).order);
}
export async function listInventoryOrders() {
  const result = await request('list', { admin: true });
  if (!Array.isArray(result.orders)) throw Error('Respons daftar pesanan tidak valid.');
  return result.orders.map(accept);
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
      await Promise.all(getReservations().filter(r => r.pending || !['completed','expired','cancelled'].includes(known.get(r.payload.id)?.status)).map(r => refreshInventoryOrder(r.payload.id).catch(() => null)));
    }
  } finally { syncing = false; }
}
