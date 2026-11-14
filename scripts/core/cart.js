// Pure cart logic. A cart line is identified by product + variant, so two
// variants of the same product are separate lines with their own qty and note.

export function lineKey(productId, variantLabel = '') {
  return `${productId}::${variantLabel || ''}`;
}

export function getVariant(product, variantLabel) {
  if (!product || !Array.isArray(product.variants) || product.variants.length === 0) return null;
  return product.variants.find((v) => v.label === variantLabel) || product.variants[0];
}

export function unitPrice(product, variantLabel) {
  const variant = getVariant(product, variantLabel);
  return (Number(product?.price) || 0) + (variant ? Number(variant.delta) || 0 : 0);
}

export function isPurchasable(product) {
  if (!product || product.isAvailable === false) return false;
  return product.stock === null || product.stock === undefined || Number(product.stock) > 0;
}

export function maxQty(product) {
  if (product.stock === null || product.stock === undefined) return 99;
  return Math.max(0, Math.min(99, Number(product.stock)));
}

export function productQty(cart, productId) {
  return cart.filter((l) => l.productId === productId).reduce((sum, l) => sum + l.qty, 0);
}

// Returns { cart, added, reason } so the UI can explain why nothing was added.
export function addLine(cart, product, { variant = '', qty = 1, note = '' } = {}) {
  if (!isPurchasable(product)) return { cart, added: 0, reason: 'sold-out' };
  const chosen = getVariant(product, variant);
  const label = chosen ? chosen.label : '';
  const key = lineKey(product.id, label);
  const limit = maxQty(product);
  const inCart = productQty(cart, product.id);
  const room = Math.max(0, limit - inCart);
  const addQty = Math.min(room, Math.max(1, Math.floor(qty)));
  if (addQty === 0) return { cart, added: 0, reason: 'stock-limit' };

  const existing = cart.find((l) => l.key === key);
  const next = existing
    ? cart.map((l) => (l.key === key ? { ...l, qty: l.qty + addQty, note: note || l.note } : l))
    : [...cart, { key, productId: product.id, variant: label, qty: addQty, note: note.trim() }];
  return { cart: next, added: addQty, reason: addQty < qty ? 'stock-limit' : null };
}

export function setLineQty(cart, key, qty, products = []) {
  const line = cart.find((l) => l.key === key);
  if (!line) return cart;
  if (qty <= 0) return cart.filter((l) => l.key !== key);
  const product = products.find((p) => p.id === line.productId);
  let target = Math.floor(qty);
  if (product) {
    const others = productQty(cart, line.productId) - line.qty;
    target = Math.min(target, Math.max(0, maxQty(product) - others));
  }
  if (target <= 0) return cart.filter((l) => l.key !== key);
  return cart.map((l) => (l.key === key ? { ...l, qty: target } : l));
}

export function setLineNote(cart, key, note) {
  return cart.map((l) => (l.key === key ? { ...l, note: String(note || '').trim().slice(0, 140) } : l));
}

export function removeLine(cart, key) {
  return cart.filter((l) => l.key !== key);
}

// Joins cart lines with the live catalog. Lines whose product was deleted are
// dropped; lines for sold-out products are kept but flagged.
export function resolveLines(cart, products) {
  return cart
    .map((line) => {
      const product = products.find((p) => p.id === line.productId);
      if (!product) return null;
      const price = unitPrice(product, line.variant);
      return {
        ...line,
        product,
        name: product.name,
        image: product.image,
        unitPrice: price,
        lineTotal: price * line.qty,
        available: isPurchasable(product)
      };
    })
    .filter(Boolean);
}

export function findVoucher(code, vouchers = []) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  return vouchers.find((v) => v.active !== false && v.code.toUpperCase() === normalized) || null;
}

export function productRequiresShipping(product) {
  if (!product) return false;
  if (typeof product.requiresShipping === 'boolean') return product.requiresShipping;
  return product.category !== 'digital';
}

export function isDigitalOnly(lines) {
  return lines.length > 0 && lines.every((l) => l.product && !productRequiresShipping(l.product));
}

export function isStrictDigitalOnly(lines) {
  return lines.length > 0 && lines.every((l) => l.product && l.product.category === 'digital' && !productRequiresShipping(l.product));
}

export function computeTotals({ lines, shipping, voucher, packagingFee = 0 }) {
  const purchasable = lines.filter((l) => l.available);
  const itemCount = purchasable.reduce((sum, l) => sum + l.qty, 0);
  const subtotal = purchasable.reduce((sum, l) => sum + l.lineTotal, 0);
  const discount = voucher ? Math.round(subtotal * (Number(voucher.percent) || 0) / 100) : 0;
  const digitalOnly = isDigitalOnly(purchasable);
  const noCourier = digitalOnly || shipping?.id === 'no_courier' || shipping?.id === 'digital';
  const shippingCost = subtotal > 0 && shipping && !digitalOnly ? Number(shipping.price) || 0 : 0;
  const packaging = subtotal > 0 && !noCourier ? Number(packagingFee) || 0 : 0;
  const total = Math.max(0, subtotal - discount + shippingCost + packaging);
  return { itemCount, subtotal, discount, shippingCost, packaging, total, digitalOnly };
}
