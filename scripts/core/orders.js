// Order lifecycle. Pure functions: every transition returns a new order object
// and appends to the timeline, so admin and buyer render the same history.

import { uid } from './format.js';

export const PAYMENT_WINDOW_MS = 10 * 60 * 1000;

export const STATUS = {
  AWAITING: 'awaiting_payment',
  PAID: 'paid',
  PROCESSING: 'processing',
  READY: 'ready',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
};

const FLOW = [STATUS.PAID, STATUS.PROCESSING, STATUS.READY, STATUS.COMPLETED];

export function fulfillmentKind(order) {
  if (order?.shipping?.id === 'digital') return 'digital';
  if (order?.shipping?.id === 'pickup') return 'pickup';
  return 'delivery';
}

export function statusLabel(status, order) {
  const kind = fulfillmentKind(order);
  switch (status) {
    case STATUS.AWAITING: return 'Menunggu pembayaran';
    case STATUS.PAID: return 'Pembayaran diterima';
    case STATUS.PROCESSING: return kind === 'digital' ? 'Sedang disiapkan' : 'Sedang dikemas';
    case STATUS.READY:
      if (kind === 'pickup') return 'Siap diambil';
      if (kind === 'digital') return 'Dikirim ke WhatsApp';
      return 'Dalam pengiriman';
    case STATUS.COMPLETED: return 'Selesai';
    case STATUS.EXPIRED: return 'Kedaluwarsa';
    case STATUS.CANCELLED: return 'Dibatalkan';
    default: return 'Status tidak dikenal';
  }
}

export function statusTone(status) {
  if (status === STATUS.AWAITING) return 'pending';
  if (status === STATUS.EXPIRED || status === STATUS.CANCELLED) return 'muted';
  if (status === STATUS.COMPLETED) return 'done';
  return 'active';
}

export function trackerSteps(order) {
  return FLOW.map((status) => ({ status, label: statusLabel(status, order) }));
}

export function nextStatus(status) {
  const i = FLOW.indexOf(status);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
}

function makeInvoice(now) {
  const d = new Date(now);
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const tail = uid().replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase();
  return `AN${ymd}${tail}`;
}

export function createOrder({ lines, totals, customer, shipping, voucherCode = '', now = Date.now() }) {
  return {
    id: uid('ord_'),
    invoice: makeInvoice(now),
    createdAt: now,
    updatedAt: now,
    expiresAt: now + PAYMENT_WINDOW_MS,
    status: STATUS.AWAITING,
    items: lines.filter((l) => l.available).map((l) => ({
      productId: l.productId,
      name: l.name,
      image: l.image,
      variant: l.variant,
      qty: l.qty,
      unitPrice: l.unitPrice,
      note: l.note || ''
    })),
    totals: { ...totals },
    voucherCode,
    customer: { ...customer },
    shipping: shipping ? { ...shipping } : null,
    payment: { method: 'qris', payload: '', paidAt: null, confirmedBy: null },
    timeline: [{ status: STATUS.AWAITING, at: now, by: 'pelanggan' }]
  };
}

export function remainingMs(order, now = Date.now()) {
  return Math.max(0, (order?.expiresAt || 0) - now);
}

export function isExpired(order, now = Date.now()) {
  return order?.status === STATUS.AWAITING && now >= order.expiresAt;
}

function transition(order, status, { now = Date.now(), by = 'sistem', note = '' } = {}) {
  return {
    ...order,
    status,
    updatedAt: now,
    timeline: [...(order.timeline || []), { status, at: now, by, ...(note ? { note } : {}) }]
  };
}

export function applyExpiry(order, now = Date.now()) {
  return isExpired(order, now) ? transition(order, STATUS.EXPIRED, { now, by: 'sistem' }) : order;
}

// Returns null when the order can no longer be paid (expired, cancelled, already paid).
export function markPaid(order, { now = Date.now(), by = 'admin', reference = '' } = {}) {
  if (!order || order.status !== STATUS.AWAITING) return null;
  if (now >= order.expiresAt) return null;
  const next = transition(order, STATUS.PAID, { now, by });
  return { ...next, payment: { ...next.payment, paidAt: now, confirmedBy: by, reference } };
}

export function advanceOrder(order, { now = Date.now(), by = 'admin' } = {}) {
  const target = nextStatus(order?.status);
  return target ? transition(order, target, { now, by }) : null;
}

export function cancelOrder(order, { now = Date.now(), by = 'admin', note = '' } = {}) {
  if (!order || [STATUS.COMPLETED, STATUS.CANCELLED, STATUS.EXPIRED].includes(order.status)) return null;
  return transition(order, STATUS.CANCELLED, { now, by, note });
}

export function isPaidStatus(status) {
  return FLOW.includes(status);
}

export function isOpenStatus(status) {
  return status === STATUS.AWAITING || status === STATUS.PAID || status === STATUS.PROCESSING || status === STATUS.READY;
}
