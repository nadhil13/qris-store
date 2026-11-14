// Payment orchestration between buyer screen, admin dashboard and (later) a
// payment provider.
//
// How "auto respond" works today: the buyer screen watches its order. When the
// order flips to "paid" (admin taps "Konfirmasi lunas", the demo simulator, or a
// provider check), every open tab updates within a moment, without reloading.
//
// Static QRIS cannot report settlement on its own. To make detection fully
// automatic, register a provider whose `check(order)` asks your backend (bank
// mutation checker or a QRIS aggregator webhook) and returns
// { paid: true, reference } when money has arrived.

import { convertStaticToDynamicQRIS } from '../qris.js';
import { getOrder, getAdminOrder, updateOrder, saveAdminOrder, moveStockForOrder, subscribe, sweepExpiredOrders, getServerNow } from './store.js';
import { markPaid, cancelOrder, advanceOrder, isExpired, isPaidStatus, remainingMs, STATUS } from './orders.js';
import { isInventoryOrder, transitionInventoryOrder, refreshInventoryOrder } from './inventory.js';

const manualProvider = {
  id: 'manual',
  label: 'Konfirmasi manual dari dasbor admin',
  async check() {
    return null;
  }
};

let provider = manualProvider;

export function setPaymentProvider(next) {
  provider = next && typeof next.check === 'function' ? next : manualProvider;
}

export function getPaymentProvider() {
  return provider;
}

export function paymentStaticPayload(order, fallback) {
  if (isInventoryOrder(order)) {
    if (!order?.payment?.payload) throw Error('Snapshot QRIS pesanan belum tersedia. Muat ulang pesanan atau hubungi toko.');
    return order.payment.payload;
  }
  return fallback;
}
export function buildPaymentPayload(order, staticPayload) {
  return convertStaticToDynamicQRIS(paymentStaticPayload(order, staticPayload), order.totals.total, order.invoice);
}

async function inventoryTransition(action, orderId, detail) {
  try { return { ok: true, order: await transitionInventoryOrder(action, orderId, detail) }; }
  catch (error) { return { ok: false, reason: error.message, code: error.code }; }
}

export function advancePaymentOrder(orderId) {
  const order = getAdminOrder(orderId) || getOrder(orderId);
  if (!order) return { ok: false, reason: 'not-found' };
  if (isInventoryOrder(order)) return inventoryTransition('advance', orderId, { expectedStatus: order.status });
  const next = advanceOrder(order, { by: 'admin_dashboard' });
  return next ? { ok: true, order: updateOrder(orderId, () => next) } : { ok: false, reason: 'INVALID_TRANSITION' };
}

export function confirmPayment(orderId, { by = 'admin', reference = '', now = Date.now() } = {}) {
  const current = getAdminOrder(orderId) || getOrder(orderId);
  if (!current) return { ok: false, reason: 'not-found' };
  if (isInventoryOrder(current)) return inventoryTransition('confirm', orderId, { reference });
  if (current.status !== STATUS.AWAITING) return { ok: false, reason: current.status, order: current };
  if (isExpired(current, now)) {
    sweepExpiredOrders(now);
    return { ok: false, reason: STATUS.EXPIRED, order: getOrder(orderId) };
  }
  const saved = updateOrder(orderId, (o) => markPaid(o, { now, by, reference }), { type: 'paid' });
  if (!saved) return { ok: false, reason: 'rejected' };
  moveStockForOrder(saved, -1);
  return { ok: true, order: saved };
}

export function cancelOrderById(orderId, { by = 'admin', note = '' } = {}) {
  const current = getAdminOrder(orderId) || getOrder(orderId);
  if (!current) return { ok: false, reason: 'not-found' };
  if (isInventoryOrder(current)) return inventoryTransition('cancel', orderId, { note });
  const wasPaid = isPaidStatus(current.status);
  const owned = Boolean(getOrder(orderId));
  let saved = null;
  if (owned) {
    saved = updateOrder(orderId, (o) => cancelOrder(o, { by, note }), { type: 'cancelled' });
  } else {
    const cancelled = cancelOrder(current, { by, note });
    if (cancelled) saved = saveAdminOrder(cancelled, { type: 'cancelled' });
  }
  if (!saved) return { ok: false, reason: current.status };
  if (wasPaid) moveStockForOrder(saved, +1);
  return { ok: true, order: saved };
}

// Watches one order: 1s ticks for the countdown, expiry sweep, provider polling
// every 2s, and instant updates from other tabs. Returns a stop function.
export function watchOrder(orderId, { onUpdate, onTick, onError } = {}) {
  let last = getOrder(orderId);
  let stopped = false;
  let polling = false;
  const nowMs = () => (typeof getServerNow === 'function' ? getServerNow() : Date.now());

  const stopAll = () => {
    stopped = true;
    unsubscribe();
    clearInterval(tick);
    clearInterval(poll);
  };

  const push = () => {
    const fresh = getOrder(orderId);
    if (!fresh) return;
    if (!last || fresh.status !== last.status || fresh.updatedAt !== last.updatedAt) {
      const previous = last;
      last = fresh;
      if (last.status !== STATUS.AWAITING) stopAll();
      onUpdate && onUpdate(fresh, previous);
    } else if (last.status !== STATUS.AWAITING) {
      stopAll();
    }
  };

  const checkServerOrder = async () => {
    if (stopped || polling || !last) return;
    if (last.status !== STATUS.AWAITING) {
      stopAll();
      return;
    }
    polling = true;
    try {
      if (isInventoryOrder(last)) {
        await refreshInventoryOrder(orderId);
        push();
        return;
      }
      const result = await provider.check(last);
      if (result && result.paid) confirmPayment(orderId, { by: provider.id, reference: result.reference || '' });
    } catch (err) {
      if (err?.status === 404 && err?.code === 'ORDER_NOT_FOUND') {
        stopAll();
        onError && onError(err);
      } else {
        console.warn('Cek status pembayaran gagal', err);
      }
    } finally {
      polling = false;
    }
  };

  const unsubscribe = subscribe((change) => {
    if (change.domain === 'orders' && (!change.id || change.id === orderId)) push();
  });

  const tick = setInterval(() => {
    if (stopped || !last) return;
    if (last.status !== STATUS.AWAITING) {
      stopAll();
      return;
    }
    const now = nowMs();
    const msLeft = remainingMs(last, now);
    if (msLeft <= 0) {
      if (isInventoryOrder(last)) {
        checkServerOrder();
      } else {
        sweepExpiredOrders(now);
        push();
      }
    }
    onTick && onTick(msLeft, last);
  }, 1000);

  const poll = setInterval(checkServerOrder, 2000);

  if (last && onTick && last.status === STATUS.AWAITING) {
    const now = nowMs();
    const msLeft = remainingMs(last, now);
    if (msLeft <= 0) {
      if (isInventoryOrder(last)) checkServerOrder();
      else { sweepExpiredOrders(now); push(); }
    }
    onTick(msLeft, last);
  }

  return stopAll;
}
