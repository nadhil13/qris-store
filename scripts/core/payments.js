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
import { getOrder, updateOrder, moveStockForOrder, subscribe, sweepExpiredOrders } from './store.js';
import { markPaid, cancelOrder, isExpired, isPaidStatus, remainingMs, STATUS } from './orders.js';

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

export function buildPaymentPayload(order, staticPayload) {
  return convertStaticToDynamicQRIS(staticPayload, order.totals.total, order.invoice);
}

export function confirmPayment(orderId, { by = 'admin', reference = '', now = Date.now() } = {}) {
  const current = getOrder(orderId);
  if (!current) return { ok: false, reason: 'not-found' };
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
  const current = getOrder(orderId);
  if (!current) return { ok: false, reason: 'not-found' };
  const wasPaid = isPaidStatus(current.status);
  const saved = updateOrder(orderId, (o) => cancelOrder(o, { by, note }), { type: 'cancelled' });
  if (!saved) return { ok: false, reason: current.status };
  if (wasPaid) moveStockForOrder(saved, +1);
  return { ok: true, order: saved };
}

// Watches one order: 1s ticks for the countdown, expiry sweep, provider polling
// every 5s, and instant updates from other tabs. Returns a stop function.
export function watchOrder(orderId, { onUpdate, onTick } = {}) {
  let last = getOrder(orderId);
  let stopped = false;
  let polling = false;

  const push = () => {
    const fresh = getOrder(orderId);
    if (!fresh) return;
    if (!last || fresh.status !== last.status || fresh.updatedAt !== last.updatedAt) {
      const previous = last;
      last = fresh;
      onUpdate && onUpdate(fresh, previous);
    }
  };

  const unsubscribe = subscribe((change) => {
    if (change.domain === 'orders' && (!change.id || change.id === orderId)) push();
  });

  const tick = setInterval(() => {
    if (stopped || !last) return;
    if (last.status === STATUS.AWAITING) {
      if (remainingMs(last) <= 0) {
        sweepExpiredOrders();
        push();
      }
      onTick && onTick(remainingMs(last), last);
    }
  }, 1000);

  const poll = setInterval(async () => {
    if (stopped || polling || !last || last.status !== STATUS.AWAITING) return;
    polling = true;
    try {
      const result = await provider.check(last);
      if (result && result.paid) confirmPayment(orderId, { by: provider.id, reference: result.reference || '' });
    } catch (err) {
      console.warn('Cek status pembayaran gagal', err);
    } finally {
      polling = false;
    }
  }, 5000);

  if (last && onTick && last.status === STATUS.AWAITING) onTick(remainingMs(last), last);

  return () => {
    stopped = true;
    unsubscribe();
    clearInterval(tick);
    clearInterval(poll);
  };
}
