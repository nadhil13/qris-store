import { PRODUCTS as SEED_PRODUCTS } from '../../scripts/core/catalog.js';
import { getInMemorySettings } from '../settings.js';
import { parseInventoryInput } from '../inventory.js';

const RECLAIM_LIMIT = 128;
const RECORD_LIMIT = 5000;
const MAX_INTEGER = 1_000_000_000;

const isSafeStockInt = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_INTEGER;
const fail = (code, status = 409) => ({ ok: false, code, status });

function clone(value) {
  return structuredClone(value);
}

function resolveCatalog(settings) {
  const products = Array.isArray(settings?.products) ? settings.products : SEED_PRODUCTS;
  if (!Array.isArray(products) || products.length > 2000) return { error: fail('CATALOG_UNAVAILABLE', 503) };
  const catalog = new Map();
  for (const p of products) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || catalog.has(p.id) || typeof p.name !== 'string' || !isSafeStockInt(p.price)) {
      return { error: fail('CATALOG_INVALID', 503) };
    }
    if (p.stock !== undefined && p.stock !== null && !isSafeStockInt(p.stock)) {
      return { error: fail('CATALOG_INVALID', 503) };
    }
    if (p.requiresShipping !== undefined && p.requiresShipping !== null && typeof p.requiresShipping !== 'boolean') {
      return { error: fail('CATALOG_INVALID', 503) };
    }
    if (p.variants !== undefined && !Array.isArray(p.variants)) {
      return { error: fail('CATALOG_INVALID', 503) };
    }
    const labels = new Set();
    for (const v of p.variants || []) {
      if (!v || typeof v !== 'object' || typeof v.label !== 'string' || labels.has(v.label)
        || typeof v.delta !== 'number' || !Number.isInteger(v.delta) || Math.abs(v.delta) > MAX_INTEGER || p.price + v.delta < 0) {
        return { error: fail('CATALOG_INVALID', 503) };
      }
      labels.add(v.label);
    }
    catalog.set(p.id, p);
  }
  return { catalog };
}

export function createLocalInventoryEngine({ getSettings = getInMemorySettings, nowFn = () => Date.now() } = {}) {
  let state = null;

  function ensureState(catalog) {
    if (!state) {
      const stock = {};
      for (const [id, p] of catalog.entries()) {
        stock[id] = p.stock == null ? null : p.stock;
      }
      state = { version: 1, revision: 0, stock, holds: {}, orders: {}, sequence: 0 };
    } else {
      for (const [id, p] of catalog.entries()) {
        if (!Object.hasOwn(state.stock, id)) {
          state.stock[id] = p.stock == null ? null : p.stock;
        }
      }
    }
    return state;
  }

  function release(quantities) {
    for (const [id, qty] of Object.entries(quantities)) {
      if (state.stock[id] !== null) {
        if (state.stock[id] + qty > MAX_INTEGER) throw new Error('Stock overflow');
        state.stock[id] += qty;
      }
    }
  }

  function transition(order, status, now, note = '') {
    const updatedAt = Math.max(now, Number(order.updatedAt || 0) + 1);
    order.status = status;
    order.updatedAt = updatedAt;
    order.timeline.push({ status, at: updatedAt, by: 'server', note });
  }

  function snapshot(now) {
    return { revision: state.revision, products: clone(state.stock), serverTime: now };
  }

  function execute(input) {
    const now = nowFn();
    const settings = getSettings() || {};
    const { catalog, error } = resolveCatalog(settings);
    if (error) return error;

    ensureState(catalog);

    const expired = Object.keys(state.holds).filter((id) => state.holds[id].expiresAt <= now);
    expired.sort((a, b) => {
      if (a === b) return 0;
      if (a === input.id) return -1;
      if (b === input.id) return 1;
      return state.holds[a].expiresAt - state.holds[b].expiresAt;
    });

    const reclaimedCount = Math.min(expired.length, RECLAIM_LIMIT);
    for (let i = 0; i < reclaimedCount; i++) {
      const id = expired[i];
      release(state.holds[id].quantities);
      delete state.holds[id];
      transition(state.orders[id].order, 'expired', now);
      state.revision++;
    }
    const reclaimPending = expired.length > RECLAIM_LIMIT;

    if (input.action === 'stock') {
      return { ok: true, stock: snapshot(now), reclaimPending };
    }
    if (input.action === 'list') {
      const orders = Object.values(state.orders)
        .sort((a, b) => b.sequence - a.sequence)
        .slice(0, 200)
        .map((entry) => clone(entry.order));
      return { ok: true, orders, stock: snapshot(now), reclaimPending };
    }

    const existingRecord = state.orders[input.id];
    if (input.action === 'order') {
      if (!existingRecord || existingRecord.capabilityHash !== input.capabilityHash) return fail('ORDER_NOT_FOUND', 404);
      return { ok: true, order: clone(existingRecord.order), stock: snapshot(now) };
    }

    if (input.action === 'reserve' && existingRecord) {
      if (existingRecord.capabilityHash !== input.capabilityHash || existingRecord.fingerprint !== input.fingerprint) {
        return fail('IDEMPOTENCY_CONFLICT', 409);
      }
      return { ok: true, order: clone(existingRecord.order), stock: snapshot(now) };
    }

    if (reclaimPending) return fail('RECLAIM_REQUIRED', 503);

    if (input.action === 'reserve') {
      if (Object.keys(state.orders).length >= RECORD_LIMIT) return fail('ORDER_CAPACITY_REACHED', 503);
      if (settings.store && settings.store.isOpen === false) return fail('STORE_CLOSED', 409);

      const items = [];
      const quantities = {};
      const seen = new Set();
      let subtotal = 0;
      let itemCount = 0;
      let digitalOnly = true;
      let allDigital = true;

      for (const line of input.items) {
        const p = catalog.get(line.productId);
        if (!p || p.isAvailable === false) return fail('PRODUCT_UNAVAILABLE', 409);
        if (!Object.hasOwn(state.stock, p.id)) return fail('STOCK_NOT_INITIALIZED', 409);
        const variants = p.variants || [];
        let label = line.variant;
        let delta = 0;
        if (variants.length > 0) {
          if (!label) label = variants[0].label;
          const variantObj = variants.find((v) => v.label === label);
          if (!variantObj) return fail('INVALID_VARIANT', 400);
          delta = variantObj.delta;
        } else if (label !== '') {
          return fail('INVALID_VARIANT', 400);
        }
        const key = `${p.id}::${label}`;
        if (seen.has(key)) return fail('DUPLICATE_LINE', 400);
        seen.add(key);

        const price = p.price + delta;
        if (!isSafeStockInt(price)) return fail('CATALOG_INVALID', 503);
        quantities[p.id] = (quantities[p.id] || 0) + line.qty;
        if (quantities[p.id] > 99 || (state.stock[p.id] !== null && quantities[p.id] > state.stock[p.id])) {
          return fail('OUT_OF_STOCK', 409);
        }
        itemCount += line.qty;
        subtotal += price * line.qty;
        const needsCourier = p.requiresShipping === true || ((p.requiresShipping === undefined || p.requiresShipping === null) && p.category !== 'digital');
        if (needsCourier) digitalOnly = false;
        if (p.category !== 'digital') allDigital = false;
        items.push({ productId: p.id, name: p.name, image: p.image || '', variant: label, qty: line.qty, unitPrice: price, note: line.note });
      }

      const storeSettings = settings.store && typeof settings.store === 'object' ? settings.store : {};
      const shippingEnabled = storeSettings.shippingEnabled !== false;
      const pickupEnabled = storeSettings.pickupEnabled !== false;
      let shipping;
      if (digitalOnly) {
        shipping = allDigital
          ? { id: 'digital', name: 'Dikirim digital via WhatsApp', price: 0, eta: 'Setelah pembayaran' }
          : { id: 'no_courier', name: 'Tanpa kurir (diproses toko)', price: 0, eta: 'Sesuai konfirmasi toko' };
      } else if (!shippingEnabled && !pickupEnabled) {
        if (input.shippingId === 'no_courier') {
          shipping = { id: 'no_courier', name: 'Tanpa kurir (diatur toko)', price: 0, eta: 'Sesuai konfirmasi toko' };
        } else {
          return fail('INVALID_SHIPPING', 400);
        }
      } else {
        shipping = input.commerce.shipping.find((c) => {
          if (c.id !== input.shippingId) return false;
          return c.id === 'pickup' ? pickupEnabled : shippingEnabled;
        });
        if (!shipping) return fail('INVALID_SHIPPING', 400);
        if (shipping.id !== 'pickup' && shipping.id !== 'no_courier' && input.customer.address.length === 0) return fail('ADDRESS_REQUIRED', 400);
      }

      let discount = 0;
      if (input.voucherCode !== '') {
        const voucher = input.commerce.vouchers.find((v) => v.active !== false && v.code === input.voucherCode);
        if (!voucher) return fail('INVALID_VOUCHER', 400);
        discount = Math.floor((subtotal * voucher.percent) / 100 + 0.5);
      }

      const packaging = (!digitalOnly && shipping.id !== 'no_courier' && subtotal > 0) ? input.commerce.packagingFee : 0;
      const shippingCost = subtotal > 0 ? shipping.price : 0;
      const baseTotal = Math.max(0, subtotal - discount + shippingCost + packaging);
      const uniqueFlag = (settings.qris && typeof settings.qris === 'object' && settings.qris.uniqueCodeEnabled !== undefined)
        ? settings.qris.uniqueCodeEnabled === true
        : settings.uniqueCodeEnabled === true;
      let uniqueCode = 0;
      if (input.paymentMethod === 'qris' && uniqueFlag && baseTotal > 0) {
        const usedTotals = new Set();
        for (const [id, entry] of Object.entries(state.orders)) {
          if (entry.order.status === 'awaiting_payment' && state.holds[id] && entry.order.totals) {
            usedTotals.add(entry.order.totals.total);
          }
        }
        const start = (state.sequence * 137) % 899;
        for (let offset = 0; offset < 899; offset++) {
          const candidate = 101 + ((start + offset) % 899);
          if (!usedTotals.has(baseTotal + candidate)) {
            uniqueCode = candidate;
            break;
          }
        }
      }
      const totals = {
        itemCount,
        subtotal,
        discount,
        shippingCost,
        packaging,
        total: baseTotal + uniqueCode,
        digitalOnly
      };
      if (uniqueCode > 0) totals.uniqueCode = uniqueCode;

      for (const [id, qty] of Object.entries(quantities)) {
        if (state.stock[id] !== null) state.stock[id] -= qty;
      }

      let payload = '';
      if (settings.qris && typeof settings.qris === 'object') {
        if (typeof settings.qris.payload === 'string') payload = settings.qris.payload;
      } else if (typeof settings.payload === 'string') {
        payload = settings.payload;
      }

      const order = {
        id: input.id,
        invoice: `AN${now}-${state.sequence + 1}`,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + 600000,
        status: 'awaiting_payment',
        items,
        totals,
        voucherCode: input.voucherCode,
        customer: clone(input.customer),
        shipping: clone(shipping),
        payment: { method: input.paymentMethod, payload, paidAt: null, confirmedBy: null },
        timeline: [{ status: 'awaiting_payment', at: now, by: 'pelanggan' }]
      };

      state.sequence++;
      state.orders[input.id] = {
        order,
        capabilityHash: input.capabilityHash,
        fingerprint: input.fingerprint,
        sequence: state.sequence,
        quantities
      };
      state.holds[input.id] = { expiresAt: order.expiresAt, quantities };
      state.revision++;
      return { ok: true, order: clone(order), stock: snapshot(now) };
    }

    if (input.action === 'adjust') {
      if (input.expectedRevision !== state.revision) return fail('REVISION_CONFLICT', 409);
      if (!catalog.has(input.productId)) return fail('PRODUCT_NOT_FOUND', 404);
      const previous = state.stock[input.productId];
      let liability = 0;
      for (const entry of Object.values(state.orders)) {
        const status = entry.order.status;
        if (status !== 'completed' && status !== 'cancelled' && status !== 'expired') {
          const qty = entry.quantities[input.productId];
          if (qty) {
            if ((previous === null) !== (input.stock === null)) return fail('ACTIVE_ORDER_MODE_CONFLICT', 409);
            liability += qty;
          }
        }
      }
      if (input.stock !== null && input.stock + liability > MAX_INTEGER) return fail('STOCK_LIMIT_EXCEEDED', 400);
      state.stock[input.productId] = input.stock;
      state.revision++;
      return { ok: true, stock: snapshot(now) };
    }

    if (input.action === 'webhook_confirm') {
      let targetId = '';
      let targetOrder = null;
      const invoice = typeof input.invoice === 'string' ? input.invoice : '';
      const reqId = typeof input.id === 'string' ? input.id : '';
      const reqAmount = Number(input.amount || 0) || 0;
      if (reqId) {
        const rec = state.orders[reqId];
        if (!rec) return fail('ORDER_NOT_FOUND', 404);
        targetId = reqId;
        targetOrder = rec.order;
      } else if (invoice) {
        for (const [id, entry] of Object.entries(state.orders)) {
          if (entry.order.invoice === invoice) {
            targetId = id;
            targetOrder = entry.order;
            break;
          }
        }
        if (!targetOrder) return fail('ORDER_NOT_FOUND', 404);
      } else if (reqAmount > 0) {
        const matches = [];
        for (const [id, entry] of Object.entries(state.orders)) {
          const o = entry.order;
          if (o.status === 'awaiting_payment' && state.holds[id] && now < o.expiresAt && o.totals?.total === reqAmount) {
            matches.push(id);
          }
        }
        if (matches.length > 1) return fail('AMBIGUOUS_AMOUNT', 409);
        if (matches.length === 1) {
          targetId = matches[0];
          targetOrder = state.orders[targetId].order;
        } else {
          const ref = typeof input.reference === 'string' ? input.reference : '';
          if (ref) {
            for (const entry of Object.values(state.orders)) {
              const o = entry.order;
              if (o.status === 'paid' && o.payment?.reference === ref && o.totals?.total === reqAmount) {
                return { ok: true, order: clone(o), stock: snapshot(now) };
              }
            }
          }
          return fail('ORDER_NOT_FOUND', 404);
        }
      } else {
        return fail('INVALID_REQUEST', 400);
      }
      if (reqAmount > 0 && targetOrder.totals?.total !== reqAmount) return fail('AMOUNT_MISMATCH', 409);
      if (targetOrder.status === 'paid') return { ok: true, order: clone(targetOrder), stock: snapshot(now) };
      if (targetOrder.status !== 'awaiting_payment' || !state.holds[targetId] || now >= targetOrder.expiresAt) {
        return fail('INVALID_TRANSITION', 409);
      }
      transition(targetOrder, 'paid', now, typeof input.note === 'string' ? input.note : '');
      targetOrder.payment.paidAt = now;
      targetOrder.payment.confirmedBy = (typeof input.confirmedBy === 'string' && input.confirmedBy)
        ? input.confirmedBy
        : 'gopay_merchant_webhook';
      if (typeof input.reference === 'string' && input.reference) targetOrder.payment.reference = input.reference;
      delete state.holds[targetId];
      state.revision++;
      return { ok: true, order: clone(targetOrder), stock: snapshot(now) };
    }

    if (!existingRecord) return fail('ORDER_NOT_FOUND', 404);
    const order = existingRecord.order;

    if (input.action === 'confirm') {
      if (order.status === 'paid') return { ok: true, order: clone(order), stock: snapshot(now) };
      if (order.status !== 'awaiting_payment' || !state.holds[input.id] || now >= order.expiresAt) {
        return fail('INVALID_TRANSITION', 409);
      }
      transition(order, 'paid', now);
      order.payment.paidAt = now;
      order.payment.confirmedBy = 'admin';
      order.payment.reference = input.reference;
      delete state.holds[input.id];
    } else if (input.action === 'cancel') {
      if (order.status === 'cancelled') return { ok: true, order: clone(order), stock: snapshot(now) };
      if (state.holds[input.id]) {
        release(existingRecord.quantities);
        delete state.holds[input.id];
      } else if (order.status !== 'expired') {
        release(existingRecord.quantities);
      }
      transition(order, 'cancelled', now, input.note);
    } else if (input.action === 'advance') {
      const nextStatus = { paid: 'processing', processing: 'ready', ready: 'completed' };
      const target = nextStatus[input.expectedStatus];
      if (target && order.status === target) return { ok: true, order: clone(order), stock: snapshot(now) };
      if (order.status !== input.expectedStatus || !target) return fail('INVALID_TRANSITION', 409);
      transition(order, target, now);
    } else {
      return fail('INVALID_ACTION', 400);
    }

    state.revision++;
    return { ok: true, order: clone(order), stock: snapshot(now) };
  }

  function handleLocalInventory(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const send = (status, body) => res.status(status).json(body);
    if (!['GET', 'POST', 'OPTIONS'].includes(req.method)) return send(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'GET, POST, OPTIONS');
      return res.status(204).end();
    }
    try {
      const parsed = parseInventoryInput(req);
      if (!parsed.ok) return send(parsed.status, parsed.body);
      const result = execute(parsed.input);
      if (!result.ok) {
        const { status, ...payload } = result;
        return send(status, payload);
      }
      return send(200, result);
    } catch (error) {
      return send(error.status === 400 ? 400 : 503, {
        ok: false,
        code: error.status === 400 ? 'INVALID_REQUEST' : 'STORAGE_UNAVAILABLE'
      });
    }
  }
  handleLocalInventory.execute = execute;
  return handleLocalInventory;
}

