import assert from 'node:assert/strict';
import { PRODUCTS, getCategoryLabel } from '../scripts/core/catalog.js';
import { addLine, setLineQty, setLineNote, removeLine, resolveLines, computeTotals, lineKey } from '../scripts/core/cart.js';
import { createOrder, markPaid, advanceOrder, cancelOrder, isExpired, STATUS, trackerSteps } from '../scripts/core/orders.js';
import { convertStaticToDynamicQRIS, parseEMVCoQRIS, calculateCRC16, describeQRIS, validateQRIS } from '../scripts/qris.js';
import { getProducts, saveProducts, applyRemoteCatalog, getCatalogVersion, getOrders, saveOrder, replaceQRIS, syncSettingsWithCloud, pushSettingsToCloud, DEMO_STATIC_QRIS } from '../scripts/core/store.js';
import { confirmPayment, cancelOrderById } from '../scripts/core/payments.js';

// 1. Catalog integrity
assert.ok(PRODUCTS.length >= 18, 'Catalog has at least 18 items');
assert.equal(getCategoryLabel('makanan'), 'Makanan');
assert.equal(getCategoryLabel('gadget'), 'Gadget');

// 2. Cart variant logic
const p1 = PRODUCTS[0]; // Wagyu Se'i
assert.ok(p1.variants.length > 1, 'Product 1 has variants');
let cart = [];

// Add variant 0
const res1 = addLine(cart, p1, { variant: p1.variants[0].label, qty: 1 });
cart = res1.cart;
assert.equal(cart.length, 1);
assert.equal(cart[0].qty, 1);
assert.equal(cart[0].variant, p1.variants[0].label);

// Add variant 1 (different variant of the SAME product)
const res2 = addLine(cart, p1, { variant: p1.variants[1].label, qty: 2 });
cart = res2.cart;
assert.equal(cart.length, 2, 'Two separate lines in cart for different variants');

// Update qty of variant 1 specifically
const key2 = lineKey(p1.id, p1.variants[1].label);
cart = setLineQty(cart, key2, 5, PRODUCTS);
const line2 = cart.find(l => l.key === key2);
assert.equal(line2.qty, 5, 'Variant 2 quantity updated without affecting variant 1');

// Variant 1 remains qty 1
const key1 = lineKey(p1.id, p1.variants[0].label);
const line1 = cart.find(l => l.key === key1);
assert.equal(line1.qty, 1, 'Variant 1 qty unchanged');

// Reducing variant 1 to 0 removes ONLY variant 1
cart = setLineQty(cart, key1, 0, PRODUCTS);
assert.equal(cart.length, 1, 'Only one variant removed');
assert.equal(cart[0].key, key2, 'Variant 2 still in cart');

// 3. Totals computation
const resolved = resolveLines(cart, PRODUCTS);
const totals = computeTotals({
  lines: resolved,
  shipping: { id: 'instant', name: 'GoSend Instan', price: 15000 },
  voucher: { code: 'RASAHEMAT', percent: 15 },
  packagingFee: 2000
});
assert.ok(totals.subtotal > 0);
assert.ok(totals.discount > 0);
assert.ok(totals.total > 0);
assert.equal(totals.total, totals.subtotal - totals.discount + 15000 + 2000);

// 4. Order creation & 10-minute expiry
const now = Date.now();
const order = createOrder({
  lines: resolved,
  totals,
  customer: { name: 'Budi Santoso', phone: '081234567890', address: 'Jl. Merdeka 10' },
  shipping: { id: 'instant', name: 'GoSend Instan', price: 15000 },
  now
});

assert.equal(order.status, STATUS.AWAITING);
assert.equal(order.expiresAt - now, 10 * 60 * 1000, 'Exact 10 minutes (600,000 ms) window');
assert.equal(isExpired(order, now), false);
assert.equal(isExpired(order, now + 10 * 60 * 1000 + 1000), true);

// 5. Payment marking
const paidOrder = markPaid(order, { now: now + 5000, by: 'admin' });
assert.equal(paidOrder.status, STATUS.PAID);
assert.equal(paidOrder.payment.paidAt, now + 5000);

// Order advancement
const prepOrder = advanceOrder(paidOrder, { now: now + 10000 });
assert.equal(prepOrder.status, STATUS.PROCESSING);

// 6. QRIS Dynamic conversion
const dynamicQRIS = convertStaticToDynamicQRIS(DEMO_STATIC_QRIS, totals.total, order.invoice);
const parsed = parseEMVCoQRIS(dynamicQRIS);
assert.equal(parsed['01'], '12', 'Tag 01 is dynamic (12)');
assert.equal(parsed['54'], String(totals.total), 'Tag 54 matches exact bill');
assert.equal(dynamicQRIS.slice(-4), calculateCRC16(dynamicQRIS.slice(0, -4)), 'Valid CRC16 checksum');

// Describe QRIS & validation integrity
const desc = describeQRIS(dynamicQRIS);
assert.ok(desc.merchantName.length > 0);
assert.equal(desc.isDynamic, true);

const demoVal = validateQRIS(DEMO_STATIC_QRIS);
assert.equal(demoVal.ok, true, 'DEMO_STATIC_QRIS must be valid without checksum or TLV errors');
assert.equal(demoVal.errors.length, 0);

// 7. Store QRIS Replacement
const newStatic = '00020101021126610014COM.GO-JEK.WWW01189360091430501410280210G0501410280303UMI51440014ID.CO.QRIS.WWW0215ID10265330868010303UMI5204899953033605802ID5925Toko Terpusat Belanja, Di6013JAKARTA BARAT61051182062070703A0163048201';
const repResult = replaceQRIS(newStatic, { merchantName: 'Toko Baru' });
assert.equal(repResult.payload, newStatic);

// 8. Payments lifecycle & expiry rejection
assert.equal(typeof syncSettingsWithCloud, 'function');
assert.equal(typeof pushSettingsToCloud, 'function');
saveOrder(order);
const confirmRes = confirmPayment(order.id, { by: 'admin' });
assert.equal(confirmRes.ok, true);
assert.equal(confirmRes.order.status, STATUS.PAID);

// Expired order rejection
const expiredOrder = createOrder({
  lines: resolved,
  totals,
  now: now - (15 * 60 * 1000) // created 15 mins ago
});
saveOrder(expiredOrder);
const expiredConfirm = confirmPayment(expiredOrder.id, { by: 'admin', now });
assert.equal(expiredConfirm.ok, false);
assert.equal(expiredConfirm.reason, STATUS.EXPIRED);

// 9. Cloud catalog versioning & remote sync
assert.equal(typeof applyRemoteCatalog, 'function', 'applyRemoteCatalog must be exported');
assert.equal(typeof getCatalogVersion, 'function', 'getCatalogVersion must be exported');
const versionBefore = getCatalogVersion();
const customProducts = PRODUCTS.map((item, idx) => idx === 0 ? { ...item, price: 79000, stock: 3 } : { ...item });
saveProducts(customProducts, { reason: 'test-edit' });
const versionAfterSave = getCatalogVersion();
assert.ok(versionAfterSave > versionBefore, 'Local saveProducts must advance catalog version');
assert.equal(getProducts()[0].price, 79000);

// Stale remote catalog must be ignored
const staleApplied = applyRemoteCatalog({
  catalogUpdatedAt: versionAfterSave - 10,
  products: [{ id: 'stale', name: 'Stale', price: 1000, stock: 1 }]
});
assert.equal(staleApplied, null, 'Stale remote catalog must not overwrite newer local catalog');
assert.equal(getProducts()[0].price, 79000);

// Newer remote catalog must apply without re-advancing local clock beyond remote version
const remoteVersion = versionAfterSave + 5000;
const remoteApplied = applyRemoteCatalog({
  catalogUpdatedAt: remoteVersion,
  products: customProducts.map((item, idx) => idx === 0 ? { ...item, price: 82000, stock: 2 } : item)
});
assert.ok(Array.isArray(remoteApplied), 'Newer remote catalog must be applied');
assert.equal(getProducts()[0].price, 82000);
assert.equal(getProducts()[0].stock, 2);
assert.equal(getCatalogVersion(), remoteVersion);

console.log('PASS core-store.test.mjs');
