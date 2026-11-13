import { PRODUCTS as SEED_PRODUCTS, CATEGORIES, getCategoryLabel } from './core/catalog.js';
import { createModalManager, createDialogService, bindTabs } from './core/dialogs.js';

let modalManager;
let dialogService;
function overlays() {
  return modalManager ||= createModalManager(document);
}
function showDialog(message, options) {
  dialogService ||= createDialogService(overlays(), document);
  return dialogService(message, options);
}
import {
  lineKey,
  getVariant,
  unitPrice,
  isPurchasable,
  maxQty,
  productQty,
  addLine,
  setLineQty,
  setLineNote,
  removeLine,
  resolveLines,
  findVoucher,
  computeTotals,
  isDigitalOnly
} from './core/cart.js';
import {
  STATUS,
  PAYMENT_WINDOW_MS,
  createOrder,
  statusLabel,
  statusTone,
  trackerSteps,
  remainingMs,
  isExpired,
  applyExpiry,
  markPaid,
  advanceOrder,
  cancelOrder,
  isPaidStatus,
  isOpenStatus
} from './core/orders.js';
import {
  formatIDR,
  formatDateTime,
  formatTime,
  formatCountdown,
  escapeHTML,
  normalizePhone
} from './core/format.js';
import {
  calculateCRC16,
  parseEMVCoQRIS,
  validateQRIS,
  describeQRIS,
  convertStaticToDynamicQRIS,
  renderQRCodeSVG,
  renderQRCodeCanvas,
  scanQRISFromImageFile,
  qrMatrix,
  acquirerLabel,
  DEMO_STATIC_QRIS
} from './qris.js';
import {
  getProducts,
  getCatalogProducts,
  getAdminOrders,
  publishProducts,
  getInventoryStock,
  getProduct,
  getOrders,
  getOrder,
  saveOrder,
  sweepExpiredOrders,
  clearOrders,
  getSettings,
  saveSettings,
  replaceQRIS,
  saveSharedSettings,
  syncSettingsWithCloud,
  syncOrdersWithCloud,
  pushSettingsToCloud,
  moveStockForOrder,
  getCart,
  saveCart,
  getMyOrderIds,
  rememberMyOrder,
  forgetMyOrder,
  getPrefs,
  savePrefs,
  subscribe,
  isRealtimeSupported,
  STORAGE_KEYS
} from './core/store.js';
import {
  confirmPayment,
  cancelOrderById,
  advancePaymentOrder,
  buildPaymentPayload,
  paymentStaticPayload,
  watchOrder
} from './core/payments.js';

import { reserveInventory, getPendingReservation, refreshInventoryOrder, isInventoryOrder, syncInventory, listInventoryOrders, setInventoryAdminToken, hasInventoryAdminToken, refreshInventoryStock, adjustInventoryStock } from './core/inventory.js';

// Realtime synchronization across browser tabs powered by BroadcastChannel
export const REALTIME_CHANNEL_TYPE = typeof BroadcastChannel !== 'undefined' ? 'BroadcastChannel' : 'StorageEvent';
export const PRODUCTS = [...SEED_PRODUCTS];
export { getCategoryLabel };

export const STORAGE_KEY_CUSTOM_PRODUCTS = STORAGE_KEYS.products;
export const STORAGE_KEY_ADMIN_SESSION = 'an.admin.session.v3';

function updateStorefrontStatus() {
  const { store } = getSettings();
  const label = document.getElementById('store-status-label');
  if (label) label.textContent = `${store.isOpen === false ? 'Tutup' : 'Buka'} (${store.hours || 'Jam operasional belum diatur'})`;
  const dot = document.getElementById('store-status-dot');
  if (dot) dot.hidden = store.isOpen === false;

  const waNum = configuredWhatsApp(store.whatsapp);
  document.querySelectorAll('[data-store-whatsapp]').forEach((el) => {
    if (waNum) {
      el.href = `https://wa.me/${waNum}`;
      el.target = '_blank';
      el.rel = 'noreferrer noopener';
      el.setAttribute('aria-disabled', 'false');
    } else {
      el.href = '#pembayaran-info';
      el.target = '';
      el.removeAttribute?.('target');
      el.removeAttribute?.('rel');
      el.setAttribute('aria-disabled', 'true');
    }
  });
}

function configuredWhatsApp(value) {
  const number = normalizePhone(value);
  return /^62\d{8,13}$/.test(number) ? number : '';
}

function requireWhatsApp() {
  const number = configuredWhatsApp(getSettings().store.whatsapp);
  if (!number) showToast('Nomor WhatsApp toko belum tersedia. Silakan gunakan pembayaran QRIS.');
  return number;
}

function canCheckout() {
  const products = getProducts();
  const invalidLine = state.cart.find((line) => {
    const product = products.find((p) => p.id === line.productId);
    return !isPurchasable(product) || productQty(state.cart, line.productId) > maxQty(product);
  });
  // A retry may see stock already held by its own unresolved reservation.
  // HTTP checkout always lets the server validate the immutable request.
  if (invalidLine && window.location.protocol === 'file:') {
    showToast('Stok berubah. Sesuaikan atau hapus item keranjang sebelum melanjutkan.');
    updateCartUI();
    return false;
  }
  const { store } = getSettings();
  if (store.isOpen !== false) return true;
  showToast(`Toko sedang tutup. Jam operasional: ${store.hours || 'belum diatur'}.`);
  return false;
}

class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = getPrefs().audio !== false;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggle(force) {
    this.enabled = typeof force === 'boolean' ? force : !this.enabled;
    savePrefs({ audio: this.enabled });
    return this.enabled;
  }

  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    } catch {}
  }

  playSuccess() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + i * 0.09;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.23);
      });
    } catch {}
  }

  playCashChime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1320, now);
      osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
      gain1.gain.setValueAtTime(0.16, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.16);

      const oscBell = this.ctx.createOscillator();
      const gainBell = this.ctx.createGain();
      oscBell.type = 'sine';
      oscBell.frequency.setValueAtTime(2093, now + 0.08);
      gainBell.gain.setValueAtTime(0.24, now + 0.08);
      gainBell.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
      oscBell.connect(gainBell);
      gainBell.connect(this.ctx.destination);
      oscBell.start(now + 0.08);
      oscBell.stop(now + 0.85);
    } catch {}
  }
}

const sfx = new SoundFX();

export const state = {
  activeCategory: 'semua',
  searchQuery: '',
  sortBy: 'featured',
  cart: getCart(),
  activeShippingId: 'instant',
  activeVoucherCode: '',
  voucherDiscountPercent: 0,
  customer: { name: '', phone: '', address: '' },
  activeQuickViewId: null,
  selectedQuickViewVariant: null,
  activeCheckoutOrderId: null,
  activeReceiptOrderId: null,
  activeOrderStopWatch: null,
  currentQRISDisplayMode: 'dynamic',
  adminAuthenticated: false,
  activeAdminSection: 'overview',
  editingProductId: null,
  orderFilter: 'all',
  lastHighlightedInvoice: null
};

export function showToast(message, { duration = 3200 } = {}) {
  const toast = document.getElementById('toast-notification');
  const text = document.getElementById('toast-text');
  if (!toast || !text) return;
  text.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

export function renderCategoryBadges() {
  const products = getProducts();
  const tabs = document.querySelectorAll('.category-tabs .tab-btn');
  tabs.forEach((tab) => {
    const cat = tab.dataset.category;
    const countEl = tab.querySelector('.tab-count');
    if (!countEl) return;
    if (cat === 'semua') {
      countEl.textContent = products.length;
    } else {
      const match = products.filter((p) => p.category === cat);
      countEl.textContent = match.length;
    }
  });
}

export function renderCatalog() {
  const grid = document.getElementById('product-grid');
  const countEl = document.getElementById('results-count');
  if (!grid) return;

  renderCategoryBadges();

  const all = getProducts();
  let list = all.filter((p) => {
    const matchCat = state.activeCategory === 'semua' || p.category === state.activeCategory;
    const q = state.searchQuery.toLowerCase();
    const matchQuery = !q ||
      p.name.toLowerCase().includes(q) ||
      (p.desc && p.desc.toLowerCase().includes(q)) ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)));
    return matchCat && matchQuery;
  });

  if (state.sortBy === 'price-low') {
    list.sort((a, b) => a.price - b.price);
  } else if (state.sortBy === 'price-high') {
    list.sort((a, b) => b.price - a.price);
  } else if (state.sortBy === 'popular') {
    list.sort((a, b) => {
      const aPop = (a.tags && a.tags.some((t) => /best|populer|favorit/i.test(t))) ? 1 : 0;
      const bPop = (b.tags && b.tags.some((t) => /best|populer|favorit/i.test(t))) ? 1 : 0;
      return bPop - aPop;
    });
  }

  if (countEl) {
    countEl.textContent = `Menampilkan ${list.length} produk & karya pilihan`;
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <h3>Koleksi tidak ditemukan</h3>
        <p>Coba gunakan kata kunci lain atau pilih kategori koleksi di atas.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map((item) => {
    const available = isPurchasable(item);
    const cardClass = available ? 'product-card' : 'product-card is-sold-out';
    const totalInCart = productQty(state.cart, item.id);
    const firstVariant = item.variants && item.variants[0] ? item.variants[0].label : '';
    const singleVariantKey = lineKey(item.id, firstVariant);

    return `
      <article class="${cardClass}" data-id="${escapeHTML(item.id)}" id="card-${escapeHTML(item.id)}">
        <div class="card-media">
          ${!available ? '<span class="badge-sold-out">Stok Habis</span>' : ''}
          <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" width="380" height="240" loading="lazy" style="aspect-ratio: 16/10; object-fit: cover;" />
        </div>
        <div class="card-body">
          <div class="card-meta-row">
            <span class="badge-pill badge-category" data-cat="${escapeHTML(item.category)}">${escapeHTML(getCategoryLabel(item.category))}</span>
            ${item.tags && item.tags[0] ? `<span class="badge-pill badge-tag">${escapeHTML(item.tags[0])}</span>` : ''}
          </div>
          <button type="button" class="card-title-btn" data-action="quick-view" data-product-id="${escapeHTML(item.id)}" aria-label="Lihat detail ${escapeHTML(item.name)}">
            <h3 class="card-title">${escapeHTML(item.name)}</h3>
          </button>
          <p class="card-desc">${escapeHTML(item.desc || '')}</p>
          <div class="card-footer">
            <div class="card-price">
              <span class="price-label">Mulai dari</span>
              <span class="price-value">${formatIDR(item.price)}</span>
            </div>
            <div class="card-action-slot">
              ${!available ? `
                <button type="button" class="btn-add" disabled title="Stok sedang habis">
                  Habis
                </button>
              ` : totalInCart > 0 && item.variants && item.variants.length > 1 ? `
                <button type="button" class="btn-add in-cart" data-action="quick-view" data-product-id="${escapeHTML(item.id)}" aria-label="Sudah ada ${totalInCart} di keranjang. Buka varian lain">
                  <span>${totalInCart} di Keranjang</span>
                </button>
              ` : totalInCart > 0 && (!item.variants || item.variants.length <= 1) ? `
                <div class="qty-stepper">
                  <button type="button" class="stepper-btn" data-action="update-qty" data-line-key="${escapeHTML(singleVariantKey)}" data-qty="${totalInCart - 1}" aria-label="Kurangi kuantitas">−</button>
                  <span class="stepper-val">${totalInCart}</span>
                  <button type="button" class="stepper-btn" data-action="update-qty" data-line-key="${escapeHTML(singleVariantKey)}" data-qty="${totalInCart + 1}" aria-label="Tambah kuantitas">+</button>
                </div>
              ` : `
                <button type="button" class="btn-add" data-action="quick-view" data-product-id="${escapeHTML(item.id)}" aria-label="Pilih varian ${escapeHTML(item.name)}">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  <span>Pilih Varian</span>
                </button>
              `}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

export function openQuickView(productId) {
  const product = getProduct(productId);
  if (!product) return;

  state.activeQuickViewId = productId;
  state.selectedQuickViewVariant = product.variants && product.variants[0] ? product.variants[0].label : '';
  sfx.playClick();

  const modal = document.getElementById('quick-view-modal-backdrop');
  const imgEl = document.getElementById('qv-img');
  const titleEl = document.getElementById('qv-title');
  const priceEl = document.getElementById('qv-price');
  const storyEl = document.getElementById('qv-story');
  const factsEl = document.getElementById('qv-facts');
  const variantTitleEl = document.getElementById('qv-variant-title');
  const variantGridEl = document.getElementById('qv-variant-grid');

  if (imgEl) {
    imgEl.src = product.image;
    imgEl.alt = product.name;
  }
  if (titleEl) titleEl.textContent = product.name;
  if (storyEl) storyEl.textContent = product.story || product.desc || '';
  if (priceEl) {
    const p = unitPrice(product, state.selectedQuickViewVariant);
    priceEl.textContent = formatIDR(p);
  }
  if (factsEl) {
    const origin = product.origin ? `<span>Asal: ${escapeHTML(product.origin)}</span>` : '';
    const spec = product.spec ? `<span>${escapeHTML(product.spec)}</span>` : '';
    const stock = product.stock !== null && product.stock !== undefined ? `<span>Sisa stok: ${product.stock}</span>` : '';
    factsEl.innerHTML = [origin, spec, stock].filter(Boolean).join(' · ');
  }

  if (variantGridEl) {
    if (product.variants && product.variants.length > 0) {
      if (variantTitleEl) variantTitleEl.textContent = product.variantTitle || 'Pilih Varian';
      variantGridEl.innerHTML = product.variants.map((v) => {
        const delta = v.delta ? ` (+${formatIDR(v.delta)})` : '';
        const active = v.label === state.selectedQuickViewVariant ? 'active' : '';
        return `
          <button type="button" class="variant-pill-label ${active}" data-action="select-variant" data-variant="${escapeHTML(v.label)}">
            <span>${escapeHTML(v.label)}${delta}</span>
          </button>
        `;
      }).join('');
    } else {
      if (variantTitleEl) variantTitleEl.textContent = 'Pilihan Tunggal';
      variantGridEl.innerHTML = '<span style="font-size:0.85rem; color:var(--ink-secondary);">Standar koleksi</span>';
    }
  }

  overlays().open(modal, closeQuickView);
}

export function closeQuickView() {
  const modal = document.getElementById('quick-view-modal-backdrop');
  overlays().close(modal);
  state.activeQuickViewId = null;
  state.selectedQuickViewVariant = null;
}

export function selectVariantOption(optionVal, element) {
  state.selectedQuickViewVariant = optionVal;
  sfx.playClick();
  document.querySelectorAll('.variant-pill-label').forEach((el) => el.classList.remove('active'));
  if (element) element.classList.add('active');

  const product = getProduct(state.activeQuickViewId);
  const priceEl = document.getElementById('qv-price');
  if (product && priceEl) {
    priceEl.textContent = formatIDR(unitPrice(product, optionVal));
  }
}

export function addQuickViewToCart() {
  const product = getProduct(state.activeQuickViewId);
  if (!product) return;

  const res = addLine(state.cart, product, {
    variant: state.selectedQuickViewVariant,
    qty: 1
  });

  if (res.reason === 'sold-out') {
    showToast('Maaf, produk ini sedang habis.');
    return;
  }
  if (res.reason === 'stock-limit') {
    showToast('Jumlah di keranjang sudah mencapai batas stok.');
    return;
  }

  const chosenVariant = state.selectedQuickViewVariant || 'Standar';
  state.cart = res.cart;
  saveCart(state.cart);
  sfx.playClick();
  updateCartUI();
  renderCatalog();
  closeQuickView();
  showToast(`Ditambahkan: ${product.name} (${chosenVariant})`);
}

export function addToCart(productId, variantLabel = '') {
  const product = getProduct(productId);
  if (!product) return;
  const res = addLine(state.cart, product, { variant: variantLabel, qty: 1 });
  if (res.reason === 'sold-out') {
    showToast('Maaf, produk ini sedang habis.');
    return;
  }
  if (res.reason === 'stock-limit') {
    showToast('Jumlah di keranjang sudah mencapai batas stok.');
    return;
  }
  state.cart = res.cart;
  saveCart(state.cart);
  sfx.playClick();
  updateCartUI();
  renderCatalog();
  showToast(`Ditambahkan: ${product.name}`);
}

export function updateQuantity(lineKeyToUpdate, newQty) {
  sfx.playClick();
  state.cart = setLineQty(state.cart, lineKeyToUpdate, newQty, getProducts());
  saveCart(state.cart);
  updateCartUI();
  renderCatalog();
}

export async function promptNote(targetLineKey) {
  const line = state.cart.find((l) => l.key === targetLineKey);
  if (!line) return;
  const product = getProduct(line.productId);
  const title = product ? product.name : 'Produk';
  const val = await showDialog(`Catatan khusus untuk ${title} (${line.variant || 'Standar'}):`, { kind: 'prompt', value: line.note || '' });
  if (val !== null) {
    state.cart = setLineNote(state.cart, targetLineKey, val);
    saveCart(state.cart);
    updateCartUI();
  }
}

export function selectShippingMethod(methodId) {
  sfx.playClick();
  state.activeShippingId = methodId;
  updateCartUI();
}

export function updateCustomerInfo() {
  const nameEl = document.getElementById('customer-name');
  const phoneEl = document.getElementById('customer-phone');
  const addrEl = document.getElementById('customer-address');
  state.customer = {
    name: nameEl ? nameEl.value.trim() : state.customer.name,
    phone: phoneEl ? phoneEl.value.trim() : state.customer.phone,
    address: addrEl ? addrEl.value.trim() : state.customer.address
  };
}

export function applyVoucher() {
  const input = document.getElementById('voucher-input');
  if (!input) return;
  const code = input.value.trim().toUpperCase();
  const settings = getSettings();
  const found = findVoucher(code, settings.vouchers);

  if (found) {
    state.activeVoucherCode = found.code;
    state.voucherDiscountPercent = found.percent;
    sfx.playSuccess();
    showToast(`Voucher ${found.code} aktif! Diskon ${found.percent}%.`);
  } else if (code === '') {
    state.activeVoucherCode = '';
    state.voucherDiscountPercent = 0;
    showToast('Voucher dihapus.');
  } else {
    showToast('Kode voucher tidak valid atau sudah tidak berlaku.');
  }
  updateCartUI();
}

const DIGITAL_SHIPPING = { id: 'digital', name: 'Dikirim digital via WhatsApp', price: 0, eta: 'Setelah pembayaran' };

export function getCalculatedCart() {
  const products = getProducts();
  const lines = resolveLines(state.cart, products);
  const settings = getSettings();
  const digitalOnly = isDigitalOnly(lines.filter((l) => l.available));
  const chosen = settings.shipping.find((s) => s.id === state.activeShippingId) || settings.shipping[0];
  if (!digitalOnly && chosen && chosen.id !== state.activeShippingId) state.activeShippingId = chosen.id;
  // Orders record the digital option so tracker labels read "dikirim ke WhatsApp".
  const activeShipping = digitalOnly ? DIGITAL_SHIPPING : chosen;
  const voucher = state.activeVoucherCode ? { code: state.activeVoucherCode, percent: state.voucherDiscountPercent } : null;
  const totals = computeTotals({
    lines,
    shipping: activeShipping,
    voucher,
    packagingFee: settings.packagingFee
  });
  return { lines, totals, settings, activeShipping, voucher };
}

function renderShippingOptions(settings, totals) {
  const grid = document.getElementById('shipping-methods-grid');
  const note = document.getElementById('shipping-digital-note');
  const title = document.getElementById('shipping-section-title');
  const addressEl = document.getElementById('customer-address');
  const digital = totals.digitalOnly;

  if (note) note.hidden = !digital;
  if (grid) grid.hidden = digital;
  if (title) title.textContent = digital ? 'Pengiriman' : 'Metode Pengiriman';
  if (addressEl) {
    const pickup = state.activeShippingId === 'pickup';
    addressEl.hidden = digital;
    addressEl.placeholder = pickup ? 'Catatan untuk toko (opsional)' : 'Alamat pengantaran lengkap';
    addressEl.setAttribute('aria-label', addressEl.placeholder);
  }
  if (!grid || digital) return;

  const signature = JSON.stringify(settings.shipping) + state.activeShippingId;
  if (grid.dataset.signature === signature) return;
  grid.dataset.signature = signature;
  grid.innerHTML = settings.shipping.map((s) => `
    <button type="button" class="shipping-method-card ${s.id === state.activeShippingId ? 'active' : ''}" data-action="select-shipping" data-shipping-id="${escapeHTML(s.id)}"
      aria-pressed="${s.id === state.activeShippingId}">
      <span class="shipping-name">${escapeHTML(s.name)}</span>
      <span class="shipping-price">${Number(s.price) > 0 ? formatIDR(s.price) : 'Gratis'}</span>
      <span class="shipping-eta">${escapeHTML(s.eta || '')}</span>
    </button>
  `).join('');
}

export function updateCartUI() {
  const countBadge = document.getElementById('cart-badge');
  const mobBadge = document.getElementById('mob-cart-badge');
  const drawerCount = document.getElementById('drawer-count');
  const drawerItems = document.getElementById('drawer-items');
  const subtotalEl = document.getElementById('summary-subtotal');
  const discountRow = document.getElementById('summary-discount-row');
  const discountEl = document.getElementById('summary-discount');
  const discountLabel = document.getElementById('summary-discount-label');
  const shippingEl = document.getElementById('summary-shipping');
  const packagingRow = document.getElementById('summary-packaging-row');
  const packagingEl = document.getElementById('summary-packaging');
  const totalEl = document.getElementById('summary-total');
  const btnCheckout = document.getElementById('btn-checkout');

  const { lines, totals, settings, activeShipping, voucher } = getCalculatedCart();

  if (countBadge) countBadge.textContent = totals.itemCount;
  if (mobBadge) mobBadge.textContent = totals.itemCount;
  if (drawerCount) drawerCount.textContent = `(${totals.itemCount} pesanan)`;

  if (subtotalEl) subtotalEl.textContent = formatIDR(totals.subtotal);
  if (shippingEl) shippingEl.textContent = totals.digitalOnly ? 'Gratis (digital)' : formatIDR(totals.shippingCost);
  if (packagingRow) packagingRow.style.display = totals.packaging > 0 ? 'flex' : 'none';
  if (packagingEl) packagingEl.textContent = formatIDR(totals.packaging);
  if (totalEl) totalEl.textContent = formatIDR(totals.total);

  if (discountRow && discountEl) {
    if (totals.discount > 0) {
      discountRow.style.display = 'flex';
      discountEl.textContent = `- ${formatIDR(totals.discount)}`;
      if (discountLabel && voucher) discountLabel.textContent = `Diskon ${voucher.code} (${voucher.percent}%)`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  renderShippingOptions(settings, totals);

  if (btnCheckout) {
    btnCheckout.disabled = checkoutPending || (!getPendingReservation() && (totals.itemCount === 0 || settings.store.isOpen === false));
    btnCheckout.style.opacity = btnCheckout.disabled ? '0.6' : '1';
  }
  const whatsappCheckout = document.getElementById('btn-checkout-whatsapp');
  if (whatsappCheckout) whatsappCheckout.disabled = checkoutPending || (!getPendingReservation() && (totals.itemCount === 0 || settings.store.isOpen === false));

  if (!drawerItems) return;

  if (lines.length === 0) {
    drawerItems.innerHTML = `
      <div class="cart-empty-view">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        <p>Keranjang pesanan masih kosong.<br>Silakan pilih menu atau karya yang Anda inginkan.</p>
      </div>
    `;
    return;
  }

  drawerItems.innerHTML = lines.map((item) => `
    <div class="cart-item ${!item.available ? 'cart-item-unavailable' : ''}">
      <div class="cart-item-thumb">
        <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" width="64" height="64" style="aspect-ratio: 1/1; object-fit: cover;" />
      </div>
      <div class="cart-item-info">
        <h4>${escapeHTML(item.name)}</h4>
        <div style="font-size:0.75rem; color:var(--ink-secondary); margin-bottom: 2px;">
          ${item.variant ? `<span class="cart-variant-tag">${escapeHTML(item.variant)}</span>` : ''}
          <span class="cart-item-price">${formatIDR(item.unitPrice)}</span>
        </div>
        <button type="button" class="cart-item-note" data-action="prompt-note" data-line-key="${escapeHTML(item.key)}" aria-label="Tambah catatan khusus">
          ${item.note ? `Catatan: ${escapeHTML(item.note)}` : '+ Catatan khusus'}
        </button>
      </div>
      <div class="qty-stepper">
        <button type="button" class="stepper-btn" data-action="update-qty" data-line-key="${escapeHTML(item.key)}" data-qty="${item.qty - 1}" aria-label="Kurangi kuantitas">−</button>
        <span class="stepper-val">${item.qty}</span>
        <button type="button" class="stepper-btn" data-action="update-qty" data-line-key="${escapeHTML(item.key)}" data-qty="${item.qty + 1}" aria-label="Tambah kuantitas">+</button>
      </div>
    </div>
  `).join('');
}

export function openCartDrawer() {
  sfx.playClick();
  setActiveMobileNav('mob-nav-cart');
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  overlays().open(drawer, closeCartDrawer);
  if (backdrop) backdrop.classList.add('open');
}

export function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  overlays().close(drawer);
  if (backdrop) backdrop.classList.remove('open');
  setActiveMobileNav('mob-nav-katalog');
}

let checkoutPending = false;
function setCheckoutPending(value) {
  checkoutPending = value;
  updateCartUI();
  for (const id of ['btn-checkout', 'btn-checkout-whatsapp']) {
    const button = document.getElementById(id);
    if (button) { button.disabled ||= value; button.setAttribute('aria-busy', String(value)); }
  }
}
async function reserveCheckout(method, activeShipping) {
  const pending = getPendingReservation();
  if (pending) {
    showToast('Memulihkan reservasi sebelumnya dengan data asli, bukan membuat pesanan baru.');
    const { action, id, capability, ...original } = pending.payload;
    return reserveInventory(original);
  }
  return reserveInventory({
    items: state.cart.map(line => ({ productId: line.productId, variant: line.variant || '', qty: line.qty, note: line.note || '' })),
    customer: { ...state.customer }, shippingId: activeShipping?.id || 'digital',
    voucherCode: state.activeVoucherCode || '', paymentMethod: method
  });
}

export async function openCheckoutModal(existingOrderId = null) {
  if (checkoutPending) return;
  if (typeof existingOrderId !== 'string') existingOrderId = null;
  const pending = getPendingReservation();
  if (!pending && !existingOrderId && !canCheckout()) return;
  const { lines, totals, settings, activeShipping } = getCalculatedCart();
  if (!pending && !existingOrderId && totals.itemCount === 0) {
    showToast('Keranjang Anda masih kosong.');
    return;
  }

  updateCustomerInfo();
  let newOrder;
  setCheckoutPending(true);
  try {
    if (existingOrderId) {
      if (!getMyOrderIds().includes(existingOrderId)) throw Error('Pesanan bukan milik pembeli ini.');
      const owned = getOrder(existingOrderId);
      newOrder = isInventoryOrder(owned) ? await refreshInventoryOrder(existingOrderId) : owned;
    } else newOrder = await reserveCheckout('qris', activeShipping);
    if (!newOrder) throw Error('Pesanan tidak tersedia.');
    if (newOrder.payment?.method !== 'qris') throw Error('Reservasi sebelumnya menggunakan WhatsApp. Lanjutkan melalui tombol WhatsApp.');
  }
  catch (error) { showToast(error.message || 'Reservasi gagal. Keranjang tetap tersimpan.'); return; }
  finally { setCheckoutPending(false); }
  if (newOrder.status !== STATUS.AWAITING || remainingMs(newOrder) <= 0) {
    showToast(`Reservasi berstatus ${statusLabel(newOrder.status, newOrder)}. Tidak ada tagihan baru dibuat.`);
    return;
  }

  const adminDash = document.getElementById('admin-dashboard-modal-backdrop');
  overlays().close(adminDash);
  const adminLogin = document.getElementById('admin-login-modal-backdrop');
  overlays().close(adminLogin);
  closeCartDrawer();

  updateCustomerInfo();
  sfx.playClick();

  rememberMyOrder(newOrder.id);
  state.activeCheckoutOrderId = newOrder.id;
  state.activeOrder = newOrder;

  // Open modal immediately so buyer always sees the payment modal without delay
  const modal = document.getElementById('payment-modal-backdrop');
  overlays().open(modal, closeCheckoutModal);

  try {
    renderCheckoutView(newOrder);
  } catch (err) {
    console.error('Checkout view render error:', err);
  }

  if (state.activeOrderStopWatch) state.activeOrderStopWatch();
  try {
    state.activeOrderStopWatch = watchOrder(newOrder.id, {
      onTick: (msRemaining, currentOrder) => {
        const clockEl = document.getElementById('payment-countdown-clock');
        if (clockEl) clockEl.textContent = formatCountdown(msRemaining);
      },
      onUpdate: (updatedOrder, previousOrder) => {
        if (updatedOrder.status === STATUS.PAID) {
          handlePaymentCompleted(updatedOrder);
        } else if (updatedOrder.status === STATUS.EXPIRED) {
          handlePaymentExpired(updatedOrder);
        }
      }
    });
  } catch (err) {
    console.warn('Watch order warning:', err);
  }
}

function renderCheckoutView(order) {
  const settings = getSettings();
  let rawStatic;
  try { rawStatic = paymentStaticPayload(order, settings.qris.payload || DEMO_STATIC_QRIS); }
  catch (error) { showPaymentSnapshotError(error); return; }
  const desc = describeQRIS(rawStatic);

  const amountEl = document.getElementById('qris-amount-number');
  const invoiceEl = document.getElementById('payment-invoice-number');
  const merchantEl = document.getElementById('qris-merchant-display');
  const nmidEl = document.getElementById('qris-nmid-display');
  const vaEl = document.getElementById('va-code-number');
  const banner = document.getElementById('payment-expired-banner');
  const polling = document.querySelector('.polling-indicator');
  const clockEl = document.getElementById('payment-countdown-clock');
  const msLeft = remainingMs(order);
  const expired = msLeft <= 0 || order.status === STATUS.EXPIRED;

  if (banner) banner.style.display = expired ? 'block' : 'none';
  if (polling) polling.style.display = expired ? 'none' : 'flex';
  if (clockEl) clockEl.textContent = expired ? '00:00 (Hangus)' : formatCountdown(msLeft);

  if (amountEl) amountEl.textContent = formatIDR(order.totals.total);
  if (invoiceEl) invoiceEl.textContent = order.invoice;
  if (merchantEl) merchantEl.textContent = desc.merchantName || settings.store.name;
  if (nmidEl) nmidEl.textContent = [desc.nmid ? `NMID: ${desc.nmid}` : '', desc.city].filter(Boolean).join(' · ');
  if (vaEl) {
    vaEl.textContent = 'Toko ini belum mengaktifkan integrasi penyedia Virtual Account perbankan.';
  }

  switchQRISDisplayMode(state.currentQRISDisplayMode || 'dynamic', order);
}

function showPaymentSnapshotError(error) {
  state.activeCheckoutPayload = '';
  const qr = document.getElementById('qris-svg-container');
  if (qr) { qr.innerHTML = ''; qr.textContent = error.message; }
  showToast(error.message);
}

export function switchQRISDisplayMode(mode = 'dynamic', explicitOrder = null) {
  state.currentQRISDisplayMode = mode;
  const order = explicitOrder || (state.activeCheckoutOrderId ? getOrder(state.activeCheckoutOrderId) : null) || state.activeOrder;
  const settings = getSettings();
  let rawStatic;
  try { rawStatic = paymentStaticPayload(order, settings.qris.payload || DEMO_STATIC_QRIS); }
  catch (error) { showPaymentSnapshotError(error); return; }

  const pill = document.getElementById('qris-acquirer-pill');
  if (pill) {
    const acquirer = acquirerLabel(describeQRIS(rawStatic).acquirer);
    const modeLabel = mode === 'static' ? 'QRIS Statis' : 'QRIS Dinamis';
    pill.textContent = acquirer ? `${acquirer} · ${modeLabel}` : modeLabel;
  }

  const btnDynamic = document.getElementById('btn-qris-mode-dynamic');
  const btnStatic = document.getElementById('btn-qris-mode-static');
  const helperText = document.getElementById('qris-mode-helper');
  const amountLabelEl = document.getElementById('qris-amount-label');
  const qrContainer = document.getElementById('qris-svg-container');

  if (btnDynamic) {
    btnDynamic.style.background = mode === 'dynamic' ? 'var(--accent-terracotta)' : 'transparent';
    btnDynamic.style.color = mode === 'dynamic' ? '#FFFFFF' : 'var(--ink-secondary)';
  }
  if (btnStatic) {
    btnStatic.style.background = mode === 'static' ? 'var(--accent-terracotta)' : 'transparent';
    btnStatic.style.color = mode === 'static' ? '#FFFFFF' : 'var(--ink-secondary)';
  }

  let payload = rawStatic;
  if (mode === 'static') {
    if (amountLabelEl) amountLabelEl.textContent = 'Nominal Bayar (Ketik di HP):';
    if (helperText) helperText.textContent = 'Mode Statis Asli: Scan QR poster lalu ketik nominal pesanan Anda di aplikasi bank.';
  } else {
    try {
      const amount = order ? order.totals.total : 10000;
      const invoice = order ? order.invoice : 'INV01';
      payload = convertStaticToDynamicQRIS(rawStatic, amount, invoice);
    } catch (error) {
      if (isInventoryOrder(order)) { showPaymentSnapshotError(error); return; }
      payload = rawStatic;
    }
    if (amountLabelEl) amountLabelEl.textContent = 'Total Tagihan Otomatis (Terkunci di HP):';
    if (helperText) helperText.textContent = 'Mode Dinamis: Tagihan terkunci otomatis di scanner aplikasi perbankan Anda.';
  }

  state.activeCheckoutPayload = payload;

  if (qrContainer) {
    try {
      const svg = renderQRCodeSVG(payload, { label: 'Kode QRIS Pembayaran', size: 236 });
      if (svg && svg.includes('<svg')) {
        qrContainer.innerHTML = svg;
      } else {
        throw new Error('SVG output invalid');
      }
    } catch (err) {
      console.warn('QR SVG render error, falling back to canvas:', err);
      qrContainer.innerHTML = '<canvas class="qr-canvas" style="display:block; width:100%; height:100%; aspect-ratio:1/1;"></canvas>';
      const canvasEl = qrContainer.querySelector('canvas');
      const rendered = renderQRCodeCanvas(canvasEl, payload, { size: 236 });
      if (!rendered) {
        qrContainer.innerHTML = `<div class="qr-fallback" style="padding:15px; font-size:0.8rem; text-align:center; color:#374151;">Scan QRIS atau salin string di bawah ini.<br><small style="word-break:break-all; font-family:monospace; display:block; margin-top:6px;">${escapeHTML(payload)}</small></div>`;
      }
    }
  }
}

export function copyQRISPayload() {
  if (isInventoryOrder(getOrder(state.activeCheckoutOrderId)) && !state.activeCheckoutPayload) { showToast('Snapshot QRIS pesanan belum tersedia.'); return; }
  const payload = state.activeCheckoutPayload || getSettings().qris.payload || DEMO_STATIC_QRIS;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(payload).then(() => {
      showToast('Payload string QRIS berhasil disalin ke clipboard.');
    }).catch(() => {
      return showDialog('Salin data string QRIS berikut:', { kind: 'prompt', value: payload, readOnly: true });
    });
  } else {
    return showDialog('Salin data string QRIS berikut:', { kind: 'prompt', value: payload, readOnly: true });
  }
}

export function downloadQRISImage() {
  if (isInventoryOrder(getOrder(state.activeCheckoutOrderId)) && !state.activeCheckoutPayload) { showToast('Snapshot QRIS pesanan belum tersedia.'); return; }
  sfx.playClick();
  const payload = state.activeCheckoutPayload || getSettings().qris.payload || DEMO_STATIC_QRIS;
  const order = getOrder(state.activeCheckoutOrderId) || { invoice: 'INV-AN', totals: { total: 0 } };
  const desc = describeQRIS(payload);

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1040;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    showToast('Browser tidak mendukung ekspor canvas.');
    return;
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 800, 1040);

  ctx.fillStyle = '#C8102E';
  ctx.fillRect(0, 0, 800, 16);

  ctx.fillStyle = '#C8102E';
  ctx.font = 'bold 44px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QRIS', 400, 75);

  ctx.fillStyle = '#4B5563';
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('STANDAR PEMBAYARAN DIGITAL NASIONAL', 400, 102);

  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 122);
  ctx.lineTo(740, 122);
  ctx.stroke();

  ctx.fillStyle = '#1B2B1E';
  ctx.font = 'bold 24px "Playfair Display", Georgia, serif';
  ctx.fillText(desc.merchantName || 'Atelier Nusantara', 400, 165);

  ctx.fillStyle = '#6E5B4F';
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.fillText([desc.nmid ? `NMID: ${desc.nmid}` : '', desc.city].filter(Boolean).join(' · '), 400, 195);

  const qrX = 150;
  const qrY = 225;
  const qrSize = 500;

  // Same generator as the on-screen QR, including the low-ECC retry for long payloads.
  const matrix = qrMatrix(payload);
  if (!matrix) {
    showToast('Gagal membuat gambar QR. Salin string QRIS sebagai gantinya.');
    return;
  }
  const count = matrix.length;
  const modSize = qrSize / count;
  ctx.fillStyle = '#000000';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(qrX + c * modSize, qrY + r * modSize, modSize + 0.3, modSize + 0.3);
      }
    }
  }

  const isStatic = state.currentQRISDisplayMode === 'static';
  const boxY = 790;
  ctx.fillStyle = '#F9FAFB';
  ctx.fillRect(100, boxY, 600, 130);
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(100, boxY, 600, 130);

  ctx.fillStyle = '#4B5563';
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(isStatic ? 'KETIK NOMINAL INI DI APLIKASI SAAT MEMBAYAR:' : 'NOMINAL SUDAH TERISI OTOMATIS SAAT DIPINDAI:', 400, boxY + 36);

  ctx.fillStyle = '#C8102E';
  ctx.font = '800 36px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(formatIDR(order.totals.total), 400, boxY + 80);

  ctx.fillStyle = '#6E5B4F';
  ctx.font = '600 14px "JetBrains Mono", monospace';
  ctx.fillText(`No. Invoice: ${order.invoice}`, 400, boxY + 112);

  ctx.fillStyle = '#1B2B1E';
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('GOPAY · BCA · DANA · LIVIN · SHOPEEPAY · OVO · LINKAJA', 400, 960);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QRIS_${order.invoice}${isStatic ? '_statis' : ''}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    sfx.playSuccess();
    showToast('Gambar QRIS tersimpan. Buka aplikasi bank, pilih scan dari galeri.');
  }, 'image/png');
}

function handlePaymentCompleted(order) {
  if (state.activeOrderStopWatch) {
    state.activeOrderStopWatch();
    state.activeOrderStopWatch = null;
  }
  closeCheckoutModal();
  sfx.playCashChime();
  triggerPaymentAlert(order);

  // Clear cart after payment
  state.cart = [];
  saveCart(state.cart);
  updateCartUI();
  renderCatalog();
  updateOrderTrackerDockUI();

  // Populate and open receipt modal
  renderReceiptModal(order);
  const receiptModal = document.getElementById('receipt-modal-backdrop');
  overlays().open(receiptModal, closeReceiptModal);
  showToast('Pembayaran dikonfirmasi oleh toko.');
}

function handlePaymentExpired(order) {
  const clockEl = document.getElementById('payment-countdown-clock');
  if (clockEl) clockEl.textContent = '00:00 (Hangus)';
  const banner = document.getElementById('payment-expired-banner');
  if (banner) banner.style.display = 'block';
  const polling = document.querySelector('.polling-indicator');
  if (polling) polling.style.display = 'none';
  showToast('Batas waktu pembayaran 10 menit telah habis. Silakan buat pesanan ulang.');
}

export function restartExpiredOrder() {
  closeCheckoutModal();
  openCartDrawer();
  showToast('Silakan cek kembali keranjang Anda dan lanjutkan checkout.');
}

export function closeCheckoutModal() {
  const modal = document.getElementById('payment-modal-backdrop');
  overlays().close(modal);
  if (state.activeOrderStopWatch) {
    state.activeOrderStopWatch();
    state.activeOrderStopWatch = null;
  }
}

function paymentMethodLabel(order, desc) {
  const method = order?.payment?.method;
  if (method === 'va') return 'Virtual Account';
  if (method === 'whatsapp') return 'Konfirmasi via WhatsApp';
  const acquirer = acquirerLabel(desc?.acquirer);
  return acquirer ? `QRIS (${acquirer})` : 'QRIS';
}

function formatPhoneDisplay(raw) {
  const digits = normalizePhone(raw);
  if (!digits) return '';
  const local = digits.startsWith('62') ? `0${digits.slice(2)}` : digits;
  return local.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
}

export function renderReceiptModal(order) {
  state.activeReceiptOrderId = order.id || null;
  const settings = getSettings();
  const receiptPayload = order?.payment?.payload || settings.qris.payload || DEMO_STATIC_QRIS;
  const desc = describeQRIS(receiptPayload);
  const receiptInvoice = document.getElementById('receipt-invoice');
  const receiptTime = document.getElementById('receipt-time');
  const receiptTotal = document.getElementById('receipt-total');
  const receiptItemsList = document.getElementById('receipt-items-list');
  const receiptCustomerName = document.getElementById('receipt-customer-name');
  const receiptShippingName = document.getElementById('receipt-shipping-name');
  const receiptMethod = document.getElementById('receipt-method');
  const printStore = document.getElementById('receipt-print-store');
  const printAddress = document.getElementById('receipt-print-address');
  const printContact = document.getElementById('receipt-print-contact');
  const printFooter = document.getElementById('receipt-print-footer');

  const methodLabel = paymentMethodLabel(order, desc);
  if (receiptMethod) receiptMethod.textContent = methodLabel;
  if (printStore) printStore.textContent = (settings.store.name || 'Atelier Nusantara').toUpperCase();
  if (printAddress) {
    printAddress.textContent = settings.store.address || '';
    printAddress.hidden = !settings.store.address;
  }
  if (printContact) {
    const phone = formatPhoneDisplay(settings.store.whatsapp);
    printContact.textContent = [desc.nmid ? `NMID: ${desc.nmid}` : '', phone ? `WA: ${phone}` : ''].filter(Boolean).join(' · ');
  }
  if (printFooter) printFooter.textContent = `STRUK PEMBAYARAN ${methodLabel.toUpperCase()}`;

  if (receiptInvoice) receiptInvoice.textContent = order.invoice;
  if (receiptTime) receiptTime.textContent = formatDateTime(order.payment?.paidAt || order.updatedAt);
  if (receiptTotal) receiptTotal.textContent = formatIDR(order.totals.total);
  if (receiptCustomerName) receiptCustomerName.textContent = order.customer.name || 'Pelanggan Umum';
  if (receiptShippingName) receiptShippingName.textContent = order.shipping?.name || 'Ambil di Tempat';

  if (receiptItemsList) {
    receiptItemsList.innerHTML = order.items.map((i) => `
      <div class="receipt-slip-row">
        <span>${escapeHTML(i.name)} ${i.variant ? `(${escapeHTML(i.variant)})` : ''} (x${i.qty})</span>
        <span>${formatIDR(i.unitPrice * i.qty)}</span>
      </div>
    `).join('');
  }
}

export function closeReceiptModal() {
  const receiptModal = document.getElementById('receipt-modal-backdrop');
  overlays().close(receiptModal);
  showToast('Pesanan aktif. Anda dapat memantau prosesnya di dock bawah.');
}

export async function checkoutViaWhatsApp(existingOrderId = null) {
  if (typeof existingOrderId !== 'string') existingOrderId = null;
  const pending = getPendingReservation();
  if (checkoutPending || (!pending && !existingOrderId && !canCheckout()) || !requireWhatsApp()) return;
  const { lines, totals, settings, activeShipping } = getCalculatedCart();
  if (!pending && !existingOrderId && totals.itemCount === 0) {
    showToast('Keranjang Anda masih kosong.');
    return;
  }
  updateCustomerInfo();

  let popup = null;
  try { popup = window.open('about:blank', '_blank'); if (popup) popup.opener = null; } catch {}
  let newOrder;
  setCheckoutPending(true);
  try {
    if (existingOrderId) {
      if (!getMyOrderIds().includes(existingOrderId)) throw Error('Pesanan bukan milik pembeli ini.');
      newOrder = await refreshInventoryOrder(existingOrderId);
    } else newOrder = await reserveCheckout('whatsapp', activeShipping);
  }
  catch (error) { popup?.close(); showToast(error.message || 'Reservasi gagal. Keranjang tetap tersimpan.'); return; }
  finally { setCheckoutPending(false); }
  if (newOrder.status !== STATUS.AWAITING || remainingMs(newOrder) <= 0 || newOrder.payment?.method !== 'whatsapp') {
    popup?.close();
    showToast('Reservasi tidak menunggu konfirmasi WhatsApp. Periksa pelacak pesanan.');
    return;
  }
  rememberMyOrder(newOrder.id);

  let msg = `*PESANAN BARU: ${(settings.store.name || 'Atelier Nusantara').toUpperCase()}*\n`;
  msg += `----------------------------------------\n`;
  msg += `No. Invoice: ${newOrder.invoice}\n`;
  msg += `Waktu: ${formatDateTime(newOrder.createdAt)}\n\n`;
  msg += `*Data Pemesan:*\n`;
  msg += `• Nama: ${newOrder.customer.name || '-'}\n`;
  msg += `• WhatsApp: ${newOrder.customer.phone || '-'}\n`;
  msg += `• Pengiriman: ${newOrder.shipping?.name || 'Ambil di toko'}\n`;
  if (newOrder.shipping?.id !== 'digital') msg += `• Alamat/Catatan: ${newOrder.customer.address || '-'}\n`;
  msg += `\n*Rincian Pesanan:*\n`;
  newOrder.items.forEach((i) => {
    msg += `• ${i.name} (x${i.qty}) ${i.variant ? `[${i.variant}]` : ''} ${i.note ? `catatan: ${i.note}` : ''}: ${formatIDR(i.unitPrice * i.qty)}\n`;
  });
  msg += `\nSubtotal: ${formatIDR(newOrder.totals.subtotal)}\n`;
  if (newOrder.totals.discount > 0) msg += `Diskon (${newOrder.voucherCode}): -${formatIDR(newOrder.totals.discount)}\n`;
  if (newOrder.totals.shippingCost > 0) msg += `Ongkos Kirim: ${formatIDR(newOrder.totals.shippingCost)}\n`;
  if (newOrder.totals.packaging > 0) msg += `Kemasan: ${formatIDR(newOrder.totals.packaging)}\n`;
  msg += `*TOTAL: ${formatIDR(newOrder.totals.total)}*\n`;
  msg += `Pembayaran: dikonfirmasi lewat chat ini sebelum ${formatTime(newOrder.expiresAt)} (reservasi 10 menit)\n`;
  msg += `----------------------------------------\n`;
  msg += `Mohon konfirmasi ketersediaan pesanan ini. Terima kasih!`;

  const waNum = configuredWhatsApp(settings.store.whatsapp);
  const url = `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`;
  const fallback = document.getElementById('checkout-whatsapp-link');
  if (fallback) { fallback.href = url; fallback.hidden = false; }
  let launched = false;
  try { if (popup && !popup.closed) { popup.location.href = url; launched = true; } } catch { popup?.close(); }
  if (!launched) {
    updateOrderTrackerDockUI();
    showToast('Reservasi tersimpan. Ketuk Buka WhatsApp untuk melanjutkan; pesan belum dikirim dan keranjang tetap tersimpan.', { duration: 6000 });
    return;
  }

  state.cart = [];
  state.activeVoucherCode = '';
  state.voucherDiscountPercent = 0;
  saveCart(state.cart);
  updateCartUI();
  renderCatalog();
  closeCartDrawer();
  updateOrderTrackerDockUI();
  showToast(`WhatsApp dibuka untuk pesanan ${newOrder.invoice}. Ketuk Kirim di WhatsApp; pengiriman pesan belum dikonfirmasi.`, { duration: 5000 });
}

export function sendOrderToWhatsApp() {
  const order = getOrder(state.activeCheckoutOrderId);
  if (!order) return;
  const settings = getSettings();
  let msg = `*SALINAN TAGIHAN QRIS: ATELIER NUSANTARA*\n`;
  msg += `----------------------------------------\n`;
  msg += `No. Invoice: ${order.invoice}\n`;
  msg += `Pemesan: ${order.customer.name || 'Pelanggan'}\n`;
  msg += `Total Tagihan: ${formatIDR(order.totals.total)}\n`;
  msg += `Status: Menunggu Pembayaran (Batas 10 Menit)\n`;
  let payload;
  try { payload = buildPaymentPayload(order, settings.qris.payload); }
  catch (error) { showPaymentSnapshotError(error); return; }
  msg += `String QRIS: ${payload}\n`;
  const waNum = requireWhatsApp();
  if (!waNum) return;
  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');
}

export function shareReceiptWhatsApp() {
  const order = state.activeReceiptOrderId ? getOrder(state.activeReceiptOrderId) : null;
  if (!order || !isPaidStatus(order.status)) {
    showToast('Struk pembayaran tidak tersedia untuk pesanan ini.');
    return;
  }
  const settings = getSettings();
  let msg = `*STRUK RESMI PEMBAYARAN: ATELIER NUSANTARA*\n`;
  msg += `No. Invoice: ${order.invoice}\n`;
  msg += `Status: ${statusLabel(order.status)}\n`;
  msg += `Total: ${formatIDR(order.totals.total)}\n`;
  msg += `Terima kasih atas pesanan Anda!`;
  const waNum = requireWhatsApp();
  if (!waNum) return;
  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');
}

export function printThermalReceipt() {
  window.print();
}

export function updateOrderTrackerDockUI() {
  const dock = document.getElementById('order-tracker-dock');
  const textEl = document.getElementById('tracker-dock-text');
  const statusEl = document.getElementById('tracker-dock-status');
  if (!dock) return;

  const myIds = getMyOrderIds();
  const orders = getOrders();
  const active = myIds.map((id) => orders.find((o) => o.id === id)).filter((o) => o && isOpenStatus(o.status))[0];

  if (active) {
    dock.style.display = 'flex';
    if (textEl) textEl.textContent = `Pesanan Aktif: ${active.invoice}`;
    if (statusEl) statusEl.textContent = `• ${statusLabel(active.status, active)}`;
  } else {
    dock.style.display = 'none';
  }
}

export async function openOrderTrackerModal() {
  const myIds = getMyOrderIds();
  const orders = getOrders();
  const owned = myIds.map(id => orders.find(o => o.id === id)).filter(Boolean);
  const active = owned.find(o => isOpenStatus(o.status)) || owned[0];
  if (!active) {
    showToast('Tidak ada pesanan aktif saat ini.');
    return;
  }

  if (active.status === STATUS.AWAITING && active.payment?.method === 'qris') return openCheckoutModal(active.id);
  if (active.status === STATUS.AWAITING && active.payment?.method === 'whatsapp') return checkoutViaWhatsApp(active.id);
  sfx.playClick();
  const modal = document.getElementById('order-tracker-modal-backdrop');
  const invoiceEl = document.getElementById('tracker-invoice');
  const timelineEl = document.getElementById('tracker-timeline');

  if (invoiceEl) invoiceEl.textContent = active.invoice;
  if (timelineEl) {
    if (active.status === STATUS.CANCELLED || active.status === STATUS.EXPIRED) {
      const label = statusLabel(active.status, active);
      const detail = active.status === STATUS.EXPIRED
        ? 'Batas waktu reservasi atau pembayaran berakhir dan stok telah dikembalikan.'
        : 'Pesanan ini dibatalkan. Buat pesanan baru jika masih membutuhkan item.';
      timelineEl.innerHTML = `
        <div class="timeline-step step-danger">
          <div class="timeline-marker">!</div>
          <div class="timeline-body">
            <strong>${escapeHTML(label)}</strong>
            <small style="color:var(--ink-secondary);">${escapeHTML(detail)}</small>
          </div>
        </div>
      `;
    } else {
      const steps = trackerSteps(active);
      const flowStatus = [STATUS.PAID, STATUS.PROCESSING, STATUS.READY, STATUS.COMPLETED];
      const currentIndex = flowStatus.indexOf(active.status);
      const allDone = active.status === STATUS.COMPLETED;

      timelineEl.innerHTML = steps.map((st, idx) => {
        let stateClass = 'step-waiting';
        let stateDesc = 'Menunggu antrean';
        if (allDone || idx < currentIndex) {
          stateClass = 'step-done';
          stateDesc = 'Selesai';
        } else if (idx === currentIndex) {
          stateClass = 'step-active';
          stateDesc = 'Sedang berlangsung';
        }

        return `
          <div class="timeline-step ${stateClass}">
            <div class="timeline-marker">${idx + 1}</div>
            <div class="timeline-body">
              <strong>${escapeHTML(st.label)}</strong>
              <small style="color:var(--ink-secondary);">${stateDesc}</small>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  overlays().open(modal, closeOrderTrackerModal);
}

export function closeOrderTrackerModal() {
  const modal = document.getElementById('order-tracker-modal-backdrop');
  overlays().close(modal);
}

export function clearActiveOrder() {
  const myIds = getMyOrderIds();
  if (myIds.length) {
    forgetMyOrder(myIds[0]);
    updateOrderTrackerDockUI();
    closeOrderTrackerModal();
    showToast('Pesanan selesai diarsipkan.');
  }
}

export function openMerchantConfigModal() {
  sfx.playClick();
  switchAdminSection('payments');
}

export function openAdminLoginModal() {
  const modal = document.getElementById('admin-login-modal-backdrop');
  const password = document.getElementById('admin-login-password');
  const errorEl = document.getElementById('admin-login-error');
  const passwordLabel = document.querySelector('label[for="admin-login-password"]');
  if (passwordLabel) passwordLabel.textContent = 'Token admin backend';
  const credentialHint = password?.parentElement?.querySelector('p');
  if (credentialHint) credentialHint.textContent = 'Token diverifikasi oleh server dan disimpan hanya selama halaman ini terbuka.';
  if (password) {
    password.value = '';
    password.type = 'password';
    password.placeholder = 'Token admin backend';
    password.setAttribute('autocomplete', 'off');
    password.setAttribute('aria-label', 'Token admin backend');
  }
  if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
  overlays().open(modal, closeAdminLoginModal, { initialFocus: password });
}

export function closeAdminLoginModal() {
  const modal = document.getElementById('admin-login-modal-backdrop');
  overlays().close(modal);
}

export async function submitAdminLogin(event) {
  if (event && event.preventDefault) event.preventDefault();
  const passwordEl = document.getElementById('admin-login-password');
  const errorEl = document.getElementById('admin-login-error');
  const password = (passwordEl && passwordEl.value || '').trim();

  if (passwordEl) passwordEl.value = '';
  setInventoryAdminToken(password);
  try {
    await listInventoryOrders();
    if (errorEl) errorEl.style.display = 'none';
    state.adminAuthenticated = true;
    closeAdminLoginModal();
    openAdminDashboardModal();
    sfx.playSuccess();
    showToast('Akses admin aktif. Dashboard toko terbuka.');
    return;
  } catch (error) {
    state.adminAuthenticated = false;
    setInventoryAdminToken('');
    if (errorEl) { errorEl.textContent = error.message; errorEl.style.display = 'block'; }
    showToast('Akses backend belum terverifikasi. Periksa token dan koneksi.');
  }
}

export function logoutAdminSession() {
  state.adminAuthenticated = false;
  setInventoryAdminToken('');
  try { localStorage.removeItem(STORAGE_KEY_ADMIN_SESSION); } catch {}
  closeAdminDashboardModal();
  openAdminLoginModal();
  showToast('Sesi admin ditutup.');
}

export function openAdminDashboardModal() {
  if (!state.adminAuthenticated || !hasInventoryAdminToken()) {
    openAdminLoginModal();
    return;
  }
  state.adminAuthenticated = true;
  sfx.playClick();

  const modal = document.getElementById('admin-dashboard-modal-backdrop');
  if (modal) {
    overlays().open(modal, closeAdminDashboardModal);
    switchAdminSection('overview');
    refreshAdminDashboard();
  }
}

export function closeAdminDashboardModal() {
  const modal = document.getElementById('admin-dashboard-modal-backdrop');
  overlays().close(modal);
}

export function switchAdminSection(sectionName) {
  state.activeAdminSection = sectionName;
  document.querySelectorAll('.admin-section-nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.adminSection === sectionName);
  });
  document.querySelectorAll('.admin-section-view').forEach((sec) => {
    sec.hidden = sec.id !== `admin-section-${sectionName}`;
  });
  refreshAdminDashboard();
}

let storefrontDraftBaseline = null;
let storefrontDraftDirty = false;
function storefrontDraftValues() {
  return ['admin-storefront-hours', 'admin-storefront-is-open', 'admin-storefront-whatsapp'].map(id => {
    const el = document.getElementById(id);
    return id.endsWith('is-open') ? el?.checked : el?.value;
  });
}
export function refreshAdminDashboard() {
  const orders = getAdminOrders();
  const products = getProducts();
  const settings = getSettings();

  const totalOmzet = orders.filter((o) => isPaidStatus(o.status)).reduce((sum, o) => sum + o.totals.total, 0);
  const totalOrders = orders.length;
  const aov = totalOrders > 0 ? Math.round(totalOmzet / totalOrders) : 0;
  const needsAction = orders.filter((o) => o.status === STATUS.PAID || o.status === STATUS.PROCESSING).length;
  const activeOrders = orders.filter((o) => isOpenStatus(o.status)).length;

  const omzetEl = document.getElementById('admin-metric-omzet');
  const ordersEl = document.getElementById('admin-metric-orders');
  const aovEl = document.getElementById('admin-metric-aov');
  const settledEl = document.getElementById('admin-metric-settled');
  const countEl = document.getElementById('admin-orders-count');
  const needsActionEl = document.getElementById('admin-needs-action');
  const activeOrdersEl = document.getElementById('admin-active-orders');
  const overviewOrders = document.getElementById('admin-overview-orders');
  const overviewProducts = document.getElementById('admin-overview-products');
  const hoursInput = document.getElementById('admin-storefront-hours');
  const openInput = document.getElementById('admin-storefront-is-open');
  const storefrontWa = document.getElementById('admin-storefront-whatsapp');
  const syncStatus = document.getElementById('admin-live-sync');

  if (omzetEl) omzetEl.textContent = formatIDR(totalOmzet);
  if (ordersEl) ordersEl.textContent = totalOrders;
  if (aovEl) aovEl.textContent = formatIDR(aov);
  if (settledEl) settledEl.textContent = orders.filter((o) => isPaidStatus(o.status)).length;
  if (countEl) countEl.textContent = `${totalOrders} pesanan tercatat`;
  if (needsActionEl) needsActionEl.textContent = needsAction;
  if (activeOrdersEl) activeOrdersEl.textContent = activeOrders;
  if (overviewOrders) overviewOrders.textContent = `${totalOrders} pesanan (${activeOrders} aktif)`;
  if (overviewProducts) overviewProducts.textContent = `${products.length} produk di katalog`;
  if (storefrontDraftBaseline && JSON.stringify(storefrontDraftValues()) !== JSON.stringify(storefrontDraftBaseline)) storefrontDraftDirty = true;
  if (!storefrontDraftDirty) {
    if (hoursInput) hoursInput.value = settings.store.hours || '';
    if (openInput) openInput.checked = settings.store.isOpen !== false;
    if (storefrontWa) storefrontWa.value = settings.store.whatsapp || '';
    storefrontDraftBaseline = storefrontDraftValues();
  }
  if (syncStatus) syncStatus.textContent = 'Sinkronisasi tab aktif · server diperiksa setiap 12 detik';

  renderAdminOrderTable();
  renderAdminProductsTable();
  const paymentSection = document.getElementById('admin-section-payments');
  const customQrisInput = document.getElementById('admin-custom-qris-input');
  const hasQrisDraft = Boolean(customQrisInput && customQrisInput.value !== customQrisInput.defaultValue);
  const focusInPayments = Boolean(
    paymentSection
    && document.activeElement
    && (document.activeElement === paymentSection || paymentSection.contains?.(document.activeElement))
  );
  if (!hasQrisDraft && !focusInPayments) {
    renderAdminPaymentsSection();
  }
}

function renderAdminOrderTable() {
  const tbody = document.getElementById('admin-orders-tbody');
  const emptyStateEl = document.getElementById('admin-empty-state');
  if (!tbody) return;

  const orders = getAdminOrders();
  if (emptyStateEl) emptyStateEl.hidden = orders.length !== 0;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--ink-secondary);">Belum ada riwayat pesanan.</td></tr>`;
    return;
  }

  const desc = describeQRIS(getSettings().qris.payload || DEMO_STATIC_QRIS);
  tbody.innerHTML = orders.map((o) => {
    const itemsSummary = o.items.map((i) => `${escapeHTML(i.name)} (x${i.qty})`).join(', ');
    const isAwaiting = o.status === STATUS.AWAITING;
    const isComplete = o.status === STATUS.COMPLETED || o.status === STATUS.CANCELLED || o.status === STATUS.EXPIRED;

    let actionBtn = '';
    if (isAwaiting) {
      actionBtn = `<button type="button" class="btn-admin-action" style="background:var(--brand-forest); color:#fff;" data-action="admin-confirm-payment" data-order-id="${escapeHTML(o.id)}">Konfirmasi Lunas</button>`;
    } else if (!isComplete) {
      actionBtn = `<button type="button" class="btn-admin-action" data-action="admin-advance-order" data-invoice="${escapeHTML(o.invoice)}">Majukan status</button>`;
    } else if (o.status === STATUS.CANCELLED) {
      actionBtn = `<span style="font-size:0.75rem; color:var(--ink-secondary);">Dibatalkan</span>`;
    } else if (o.status === STATUS.EXPIRED) {
      actionBtn = `<span style="font-size:0.75rem; color:var(--ink-secondary);">Kedaluwarsa</span>`;
    } else {
      actionBtn = `<span style="font-size:0.75rem; color:var(--ink-secondary);">Selesai</span>`;
    }
    if (!isComplete) {
      actionBtn += ` <button type="button" class="btn-admin-action" data-action="admin-cancel-order" data-order-id="${escapeHTML(o.id)}">Batalkan</button>`;
    }

    return `
      <tr class="admin-order-row" data-admin-row="${escapeHTML(o.invoice)}">
        <td><strong style="font-family: var(--font-mono);">${escapeHTML(o.invoice)}</strong></td>
        <td style="white-space: nowrap; font-size: 0.74rem;">${formatDateTime(o.createdAt)}</td>
        <td><strong>${escapeHTML(o.customer.name || 'Pelanggan')}</strong><br><span style="font-size:0.7rem; color:var(--ink-secondary);">${escapeHTML(o.customer.phone || '-')}</span></td>
        <td style="max-width: 220px; font-size: 0.76rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHTML(itemsSummary)}">${escapeHTML(itemsSummary)}</td>
        <td style="font-size: 0.74rem;">${escapeHTML(paymentMethodLabel(o, desc))}</td>
        <td style="font-weight: 700; font-family: var(--font-mono); color: var(--brand-forest);">${formatIDR(o.totals.total)}</td>
        <td><span class="status-badge-step ${statusTone(o.status)}">${escapeHTML(statusLabel(o.status, o))}</span></td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

export async function adminConfirmPayment(orderId) {
  const res = await confirmPayment(orderId, { by: 'admin_dashboard' });
  if (res.ok) {
    refreshAdminDashboard();
    showToast(`Pesanan ${res.order.invoice} dikonfirmasi lunas.`);
  } else {
    showToast(`Gagal: ${res.reason}`);
  }
}

export async function adminAdvanceOrderStatus(invoice) {
  const order = getAdminOrders().find((o) => o.invoice === invoice);
  if (!order) return;
  sfx.playClick();
  const result = await advancePaymentOrder(order.id);
  if (!result.ok) { showToast(`Gagal: ${result.reason}`); return; }
  const updated = result.order;
  if (updated) {
    refreshAdminDashboard();
    showToast(`Status pesanan ${invoice} dimajukan ke: ${statusLabel(updated.status, updated)}`);
  }
}

export async function adminCancelOrder(orderId) {
  if (!await showDialog('Batalkan pesanan ini?', { kind: 'confirm' })) return;
  sfx.playClick();
  const res = await cancelOrderById(orderId, { by: 'admin_dashboard', note: 'Dibatalkan oleh admin' });
  if (res.ok) {
    refreshAdminDashboard();
    showToast(`Pesanan ${res.order.invoice} dibatalkan.`);
  } else {
    showToast(`Gagal membatalkan pesanan: ${res.reason}`);
  }
}

let adjustingStock = false;
export async function adminAdjustStock(productId) {
  if (adjustingStock) return;
  adjustingStock = true;
  try {
    await refreshInventoryStock();
    const snapshot = getInventoryStock();
    const initialized = Object.hasOwn(snapshot.products, productId);
    const value = await showDialog(`Stok tersedia untuk ${getProduct(productId)?.name || productId}. Pesanan aktif sudah mengurangi stok ini. Isi 0–1000000000 atau "tanpa batas".${initialized ? '' : ' Produk ini belum diinisialisasi.'}`, { kind: 'prompt', value: initialized ? (snapshot.products[productId] === null ? 'tanpa batas' : String(snapshot.products[productId])) : '0' });
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (text !== 'tanpa batas' && !/^\d+$/.test(text)) throw Error('Isi bilangan bulat atau "tanpa batas".');
    const stock = text === 'tanpa batas' ? null : Number(text);
    await adjustInventoryStock(productId, stock, snapshot.revision);
    showToast('Stok tersimpan di server.');
  } catch (error) {
    showToast(error.message === 'REVISION_CONFLICT' ? 'Stok berubah saat diedit. Buka Atur stok lagi dan periksa nilai terbaru; perubahan belum diterapkan.' : `Stok belum tersimpan: ${error.message}`);
  } finally { adjustingStock = false; refreshAdminDashboard(); }
}

function renderAdminProductsTable() {
  const tbody = document.getElementById('admin-products-tbody');
  if (!tbody) return;
  const products = getProducts();
  const snapshot = getInventoryStock();
  const stockLabel = p => !snapshot ? 'Stok server belum dimuat'
    : !Object.hasOwn(snapshot.products, p.id) ? 'Stok belum diinisialisasi'
      : p.stock === null ? 'Stok: Tanpa Batas' : `Stok: ${p.stock}`;

  tbody.innerHTML = products.map((p) => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${escapeHTML(p.image)}" width="36" height="36" style="border-radius:4px; object-fit:cover;" alt="" />
          <div>
            <strong>${escapeHTML(p.name)}</strong>
            <span style="display:block; font-size:0.72rem; color:var(--ink-secondary);">${stockLabel(p)}</span>
          </div>
        </div>
      </td>
      <td style="font-size:0.78rem;">${escapeHTML(getCategoryLabel(p.category))}</td>
      <td style="font-family:var(--font-mono); font-weight:700;">${formatIDR(p.price)}</td>
      <td>
        <span class="status-badge-step ${p.isAvailable !== false ? 'done' : 'muted'}">
          ${p.isAvailable !== false ? 'Tersedia' : 'Habis'}
        </span>
      </td>
      <td>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="btn-secondary" data-action="admin-adjust-stock" data-product-id="${escapeHTML(p.id)}">Atur stok</button>
          <button type="button" class="btn-secondary" style="padding:4px 8px; font-size:0.74rem;" data-action="admin-edit-product" data-product-id="${escapeHTML(p.id)}">Edit</button>
          <button type="button" class="btn-secondary" style="padding:4px 8px; font-size:0.74rem;" data-action="admin-toggle-product" data-product-id="${escapeHTML(p.id)}">
            ${p.isAvailable !== false ? 'Set Habis' : 'Set Ready'}
          </button>
          <button type="button" class="btn-secondary" style="padding:4px 8px; font-size:0.74rem; color:var(--status-danger);" data-action="admin-delete-product" data-product-id="${escapeHTML(p.id)}">Hapus</button>
        </div>
      </td>
    </tr>
  `).join('');
}

export function toggleAddProductForm(forceOpen) {
  const formBox = document.getElementById('admin-product-form-box');
  if (!formBox) return;
  if (typeof forceOpen === 'boolean') {
    formBox.style.display = forceOpen ? 'flex' : 'none';
  } else {
    formBox.style.display = formBox.style.display === 'none' ? 'flex' : 'none';
  }
  if (!forceOpen) {
    state.editingProductId = null;
    const label = document.getElementById('admin-product-submit-label');
    if (label) label.textContent = 'Simpan Produk Baru';
  }
}

export function openProductEditForm(productId) {
  const p = getCatalogProducts().find(p => p.id === productId);
  if (!p) return;
  state.editingProductId = productId;
  toggleAddProductForm(true);

  const nameInput = document.getElementById('new-prod-name');
  const catSelect = document.getElementById('new-prod-category');
  const priceInput = document.getElementById('new-prod-price');
  const tagInput = document.getElementById('new-prod-tag');
  const imgInput = document.getElementById('new-prod-image');
  const descInput = document.getElementById('new-prod-desc');
  const label = document.getElementById('admin-product-submit-label');

  if (nameInput) nameInput.value = p.name || '';
  if (catSelect) catSelect.value = p.category || 'makanan';
  if (priceInput) priceInput.value = p.price || '';
  if (tagInput) tagInput.value = p.tags && p.tags[0] ? p.tags[0] : '';
  if (imgInput) imgInput.value = p.image || '';
  if (descInput) descInput.value = p.desc || '';
  if (label) label.textContent = 'Simpan Perubahan Produk';
}

export async function submitNewProduct(e) {
  if (e && e.preventDefault) e.preventDefault();
  sfx.playClick();

  const name = document.getElementById('new-prod-name')?.value.trim();
  const category = document.getElementById('new-prod-category')?.value || 'makanan';
  const price = Number(document.getElementById('new-prod-price')?.value) || 0;
  const tag = document.getElementById('new-prod-tag')?.value.trim();
  let image = document.getElementById('new-prod-image')?.value.trim();
  const desc = document.getElementById('new-prod-desc')?.value.trim() || 'Koleksi pilihan toko.';

  if (!name || price <= 0) {
    showToast('Mohon isi nama produk dan harga yang valid.');
    return;
  }

  if (!image) {
    const defaults = {
      makanan: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80',
      minuman: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=700&q=80',
      barang: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=700&q=80',
      fashion: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=700&q=80',
      gadget: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=700&q=80',
      digital: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=700&q=80'
    };
    image = defaults[category] || defaults.makanan;
  }

  try {
  const list = getCatalogProducts();
  if (state.editingProductId) {
    const target = list.find((p) => p.id === state.editingProductId);
    if (target) {
      Object.assign(target, { name, category, price, tags: tag ? [tag] : target.tags, desc, image });
      await publishProducts(list, { type: 'edit', id: target.id });
      showToast(`Produk "${name}" berhasil diperbarui.`);
    }
  } else {
    const newProd = {
      id: `prod-custom-${Date.now()}`,
      name,
      category,
      price,
      tags: tag ? [tag] : ['Baru'],
      desc,
      story: desc,
      image,
      isAvailable: false,
      stock: 0,
      variants: [{ label: 'Standar Pilihan', delta: 0 }]
    };
    list.unshift(newProd);
    await publishProducts(list, { type: 'create', id: newProd.id });
    try {
      await refreshInventoryStock();
      await adjustInventoryStock(newProd.id, 0, getInventoryStock().revision);
      showToast(`Produk "${name}" tersimpan dengan stok 0. Atur stok lalu Set Ready.`);
    } catch (error) {
      showToast(`Produk tersimpan tetapi stok belum diinisialisasi: ${error.message}. Gunakan Atur stok sebelum Set Ready.`);
    }
  }

  toggleAddProductForm(false);
  refreshAdminDashboard();
  renderCatalog();
  } catch (error) { showToast(error.message); }
}

export async function toggleProductAvailability(productId) {
  sfx.playClick();
  const list = getCatalogProducts();
  const p = list.find((item) => item.id === productId);
  if (!p) return;
  if (p.isAvailable === false) {
    try { await refreshInventoryStock(); } catch (error) { showToast(error.message); return; }
    if (!Object.hasOwn(getInventoryStock()?.products || {}, p.id)) { showToast('Inisialisasi stok melalui Atur stok terlebih dahulu.'); return; }
  }
  p.isAvailable = p.isAvailable === false ? true : false;
  try { await publishProducts(list, { type: 'availability', id: p.id }); }
  catch (error) { showToast(error.message); return; }
  refreshAdminDashboard();
  renderCatalog();
  showToast(`Status "${p.name}": ${p.isAvailable ? 'Tersedia' : 'Habis'}`);
}

export async function deleteProduct(productId) {
  const p = getProduct(productId);
  if (!p) return;
  if (!await showDialog(`Hapus produk "${p.name}" dari katalog toko?`, { kind: 'confirm' })) return;
  sfx.playClick();
  const list = getCatalogProducts().filter((item) => item.id !== productId);
  try { await publishProducts(list, { type: 'delete', id: productId }); }
  catch (error) { showToast(error.message); return; }
  refreshAdminDashboard();
  renderCatalog();
  showToast(`Produk "${p.name}" dihapus.`);
}

export async function resetProductsToDefault() {
  if (!await showDialog('Kembalikan seluruh katalog ke daftar produk awal bawaan?', { kind: 'confirm' })) return;
  sfx.playClick();
  try { await publishProducts(PRODUCTS.map(p => ({ ...p })), { type: 'reset' }); }
  catch (error) { showToast(error.message); return; }
  refreshAdminDashboard();
  renderCatalog();
  showToast('Katalog produk di-reset ke default.');
}

function snapshotQrisScanStatus() {
  const el = document.getElementById('admin-qris-scan-status');
  if (!el || el.style?.display === 'none' || !el.innerHTML) return null;
  return {
    display: el.style.display || 'block',
    background: el.style.background || '',
    color: el.style.color || '',
    border: el.style.border || '',
    html: el.innerHTML
  };
}

function clearQrisScanStatus() {
  const el = document.getElementById('admin-qris-scan-status');
  if (!el) return;
  el.style.display = 'none';
  el.innerHTML = '';
}

function renderAdminPaymentsSection({ force = false } = {}) {
  const section = document.getElementById('admin-section-payments');
  if (!section) return;
  const settings = getSettings();
  const activePayload = settings.qris.payload || DEMO_STATIC_QRIS;
  const nextSignature = JSON.stringify({
    payload: activePayload,
    history: (settings.qris.history || []).map((h) => h.payload),
    storeName: settings.store.name || ''
  });
  if (!force && section.innerHTML && section.dataset?.qrisSignature === nextSignature) return;

  const prevScanStatus = snapshotQrisScanStatus();
  const desc = describeQRIS(activePayload);
  const val = validateQRIS(activePayload);

  section.innerHTML = `
    <div class="admin-section-heading">
      <div>
        <span class="admin-section-kicker">Konfigurasi Pembayaran Toko</span>
        <h3 id="admin-payments-title">Kelola QRIS Toko (Upload Foto / Statis ke Dinamis)</h3>
        <p>Unggah foto atau poster QRIS merchant Anda (GoPay, BCA, Mandiri, ShopeePay, DANA, dsb). Sistem otomatis memindai QR, memverifikasi checksum, dan mengubahnya menjadi QRIS Dinamis yang mengunci nominal tagihan otomatis di scanner pembeli.</p>
      </div>
    </div>

    <div class="admin-settings-grid">
      <!-- Active QRIS Status Card -->
      <section class="admin-settings-card">
        <span class="admin-section-kicker">QRIS Aktif Toko Saat Ini</span>
        <h4 style="margin-bottom:4px;">${escapeHTML(desc.merchantName || settings.store.name)}</h4>
        <div style="font-family:var(--font-mono); font-size:0.75rem; color:var(--ink-secondary); margin:6px 0 14px; line-height:1.6;">
          NMID: <strong>${escapeHTML(desc.nmid || 'ID1026533086801')}</strong><br>
          Kota: <strong>${escapeHTML(desc.city || 'JAKARTA BARAT')}</strong><br>
          Acquirer: <strong>${escapeHTML(desc.acquirer || 'QRIS NASIONAL')}</strong><br>
          Status Checksum: <span style="color:${val.ok ? 'var(--status-success)' : 'var(--status-danger)'}; font-weight:700;">${val.ok ? 'Valid (CRC OK)' : 'Rusak'}</span>
        </div>
        <div style="background:#ffffff; padding:12px; border-radius:8px; display:inline-block; border:1px solid var(--border-hairline); box-shadow:0 2px 8px rgba(0,0,0,0.06); text-align:center;">
          ${renderQRCodeSVG(activePayload, { label: 'Preview QRIS Toko', size: 180 })}
          <span style="display:block; font-size:0.72rem; color:var(--ink-secondary); margin-top:8px;">Kode QRIS Toko Siap Digunakan</span>
        </div>
        <div style="margin-top:12px; font-size:0.76rem; color:var(--brand-forest); background:rgba(46,69,50,0.08); padding:8px 12px; border-radius:6px; line-height:1.4;">
          <strong>QRIS dinamis aktif:</strong> Nominal tagihan disertakan dalam kode QRIS saat checkout.
        </div>
      </section>

      <!-- Update QRIS Card -->
      <section class="admin-settings-card">
        <span class="admin-section-kicker">Perbarui QRIS Toko</span>
        <h4>1. Upload Foto / Poster QRIS Baru</h4>
        <p style="font-size:0.78rem; color:var(--ink-secondary); margin-bottom:12px;">
          Punya poster atau screenshot QRIS dari m-Banking / aplikasi merchant? Upload langsung fotonya di sini:
        </p>

        <!-- Drag & Drop Zone -->
        <div id="admin-qris-dropzone" class="qris-upload-dropzone" ondragover="window.handleQRISDragOver(event)" ondragleave="window.handleQRISDragLeave(event)" ondrop="window.handleQRISDrop(event)">
          <div class="upload-icon-circle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <strong style="display:block; font-size:0.88rem; margin-top:8px; color:var(--ink-primary);">Klik atau Seret Foto QRIS ke Sini</strong>
          <p style="font-size:0.75rem; color:var(--ink-secondary); margin:4px 0 10px;">Format: PNG, JPG, JPEG, atau WebP</p>
          <button type="button" class="btn-primary" onclick="window.triggerQRISUpload()">Pilih File Gambar</button>
          <input type="file" id="admin-qris-file-input" aria-label="Foto QRIS" accept="image/*" hidden onchange="window.handleQRISImageUpload(event)" />
        </div>
        <div id="admin-qris-scan-status" role="status" style="display:none; padding:8px 12px; border-radius:6px; font-size:0.8rem; margin-bottom:12px;"></div>

        <!-- Manual String Option -->
        <div style="border-top:1px dashed var(--border-hairline); padding-top:12px; margin-top:8px;">
          <h4 style="font-size:0.85rem;">2. Atau Tempel String EMVCo QRIS Manual</h4>
          <p style="font-size:0.75rem; color:var(--ink-secondary); margin-bottom:6px;">Jika Anda memiliki salinan teks string QRIS (diawali <code>000201...</code>):</p>
          <textarea id="admin-custom-qris-input" class="config-textarea" rows="3" placeholder="000201010211...">${escapeHTML(activePayload)}</textarea>
          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <button type="button" class="btn-primary" onclick="window.adminApplyCustomQRIS()" style="padding:6px 14px; font-size:0.8rem;">Terapkan String QRIS</button>
            <button type="button" class="btn-secondary" onclick="window.adminResetQRISDefault()" style="padding:6px 12px; font-size:0.78rem;">Gunakan QRIS Demo</button>
          </div>
        </div>

        ${settings.qris.history && settings.qris.history.length > 0 ? `
          <div style="margin-top:14px; border-top:1px dashed var(--border-hairline); padding-top:8px;">
            <small style="color:var(--ink-secondary); display:block; margin-bottom:4px; font-weight:600;">Riwayat QRIS Sebelumnya:</small>
            ${settings.qris.history.map((h, idx) => `
              <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:4px 8px; margin:2px;" data-action="admin-restore-qris" data-qris-payload="${escapeHTML(h.payload)}">
                Pulihkan #${idx + 1} (${formatDateTime(h.replacedAt)})
              </button>
            `).join('')}
          </div>
        ` : ''}
      </section>
    </div>
  `;
  if (section.dataset) section.dataset.qrisSignature = nextSignature;
  if (prevScanStatus) {
    const nextStatusEl = document.getElementById('admin-qris-scan-status');
    if (nextStatusEl) {
      nextStatusEl.style.display = prevScanStatus.display;
      nextStatusEl.style.background = prevScanStatus.background;
      nextStatusEl.style.color = prevScanStatus.color;
      nextStatusEl.style.border = prevScanStatus.border;
      nextStatusEl.innerHTML = prevScanStatus.html;
    }
  }
}

export function triggerQRISUpload() {
  const fileInput = document.getElementById('admin-qris-file-input');
  if (fileInput) fileInput.click();
}

export function handleQRISDragOver(event) {
  event.preventDefault();
  const zone = document.getElementById('admin-qris-dropzone');
  if (zone) zone.classList.add('drag-active');
}

export function handleQRISDragLeave(event) {
  event.preventDefault();
  const zone = document.getElementById('admin-qris-dropzone');
  if (zone) zone.classList.remove('drag-active');
}

export function handleQRISDrop(event) {
  event.preventDefault();
  const zone = document.getElementById('admin-qris-dropzone');
  if (zone) zone.classList.remove('drag-active');
  if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
    processQRISFile(event.dataTransfer.files[0]);
  }
}

export function handleQRISImageUpload(event) {
  const file = event.target && event.target.files && event.target.files[0];
  if (file) {
    processQRISFile(file);
  }
}

export async function processQRISFile(file) {
  const statusEl = document.getElementById('admin-qris-scan-status');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.background = '#EFF6FF';
    statusEl.style.color = '#1D4ED8';
    statusEl.style.border = '1px solid #BFDBFE';
    statusEl.innerHTML = `Sedang memindai gambar <strong>${escapeHTML(file.name)}</strong>...`;
  }
  sfx.playClick();

  try {
    const rawPayload = await scanQRISFromImageFile(file);
    if (!rawPayload) {
      if (statusEl) {
        statusEl.style.background = '#FEE2E2';
        statusEl.style.color = '#B91C1C';
        statusEl.style.border = '1px solid #FCA5A5';
        statusEl.innerHTML = `Kode QR tidak terdeteksi dari foto ini. Pastikan foto QRIS jelas, tidak buram, dan tidak terpotong.`;
      }
      showToast('Gambar QRIS tidak dapat dideteksi.');
      return;
    }

    const val = validateQRIS(rawPayload);
    if (!val.ok) {
      if (statusEl) {
        statusEl.style.background = '#FEE2E2';
        statusEl.style.color = '#B91C1C';
        statusEl.style.border = '1px solid #FCA5A5';
        statusEl.textContent = `Kode QR terdeteksi namun struktur QRIS tidak valid: ${val.errors.join(', ')}`;
      }
      showToast('QRIS tidak valid: ' + val.errors[0]);
      return;
    }

    // Success: preserve status feedback across subscriber re-render and save QRIS
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'var(--status-success-bg)';
      statusEl.style.color = 'var(--status-success)';
      statusEl.style.border = '1px solid #B7E4C7';
      statusEl.innerHTML = `QRIS <strong>${escapeHTML(val.info?.merchantName || 'Toko')}</strong> valid (CRC OK) dan disimpan.`;
    }
    await replaceQRIS(val.payload, val.info || {});
    sfx.playSuccess();
    refreshAdminDashboard();
    showToast(`QRIS ${val.info.merchantName || 'Toko'} berhasil diperbarui.`);
  } catch (err) {
    console.error('QR decode error:', err);
    if (statusEl) {
      statusEl.style.background = '#FEE2E2';
      statusEl.style.color = '#B91C1C';
      statusEl.style.border = '1px solid #FCA5A5';
      statusEl.innerHTML = `Gagal memproses gambar: ${escapeHTML(err.message)}`;
    }
    showToast('Gagal memproses gambar: ' + err.message);
  }
}

export async function adminApplyCustomQRIS() {
  const input = document.getElementById('admin-custom-qris-input');
  if (!input) return;
  const str = input.value.trim();
  const val = validateQRIS(str);
  if (!val.ok) {
    await showDialog(`String QRIS tidak valid:\n${val.errors.join('\n')}`);
    return;
  }
  clearQrisScanStatus();
  try { await replaceQRIS(val.payload, val.info || {}); }
  catch (error) { showToast(error.message); return; }
  sfx.playSuccess();
  refreshAdminDashboard();
  showToast('QRIS baru berhasil diterapkan ke toko.');
}

export async function adminRestoreQRIS(payload) {
  const val = validateQRIS(payload);
  if (!val.ok) return;
  clearQrisScanStatus();
  try { await replaceQRIS(val.payload, val.info || {}); }
  catch (error) { showToast(error.message); return; }
  sfx.playSuccess();
  refreshAdminDashboard();
  showToast('QRIS riwayat berhasil dipulihkan.');
}

export async function adminResetQRISDefault() {
  clearQrisScanStatus();
  try { await replaceQRIS(DEMO_STATIC_QRIS, { merchantName: 'Atelier Nusantara' }); }
  catch (error) { showToast(error.message); return; }
  sfx.playSuccess();
  refreshAdminDashboard();
  showToast('QRIS di-reset ke default demo.');
}

export async function saveAdminStorefrontSetting(key) {
  try {
  if (key === 'merchantWhatsApp') {
    const input = document.getElementById('admin-storefront-whatsapp');
    const whatsapp = configuredWhatsApp(input?.value.trim() || '');
    if (!whatsapp) {
      showToast('Isi nomor WhatsApp Indonesia yang valid, diawali 08 atau 62.');
      return;
    }
    await saveSharedSettings((s) => ({ ...s, store: { ...s.store, whatsapp } }));
    updateStorefrontStatus();
    showToast('Nomor WhatsApp storefront berhasil diperbarui.');
  } else if (key === 'availability') {
    const hours = document.getElementById('admin-storefront-hours')?.value.trim();
    const isOpen = document.getElementById('admin-storefront-is-open')?.checked;
    if (!hours) {
      showToast('Jam operasional wajib diisi.');
      return;
    }
    await saveSharedSettings((s) => ({ ...s, store: { ...s.store, hours, isOpen } }));
    updateStorefrontStatus();
    showToast('Ketersediaan toko berhasil disimpan.');
  }
  storefrontDraftDirty = false;
  storefrontDraftBaseline = null;
  refreshAdminDashboard();
  } catch (error) { showToast(error.message); }
}

export function exportOrdersCSV() {
  const orders = getAdminOrders();
  if (orders.length === 0) {
    showToast('Belum ada pesanan untuk diekspor.');
    return;
  }
  sfx.playSuccess();

  let csv = 'Invoice,Tanggal,Status,Nama Pemesan,WhatsApp,Pengiriman,Alamat,Item Ringkasan,Total (Rp)\n';
  orders.forEach((o) => {
    const items = o.items.map((i) => `${i.name} (x${i.qty})`).join('; ');
    const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
    csv += [
      escapeCsv(o.invoice),
      escapeCsv(formatDateTime(o.createdAt)),
      escapeCsv(statusLabel(o.status)),
      escapeCsv(o.customer.name || 'Pelanggan Umum'),
      escapeCsv(o.customer.phone || '-'),
      escapeCsv(o.shipping?.name || 'Ambil di Toko'),
      escapeCsv(o.customer.address || '-'),
      escapeCsv(items),
      o.totals.total
    ].join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pesanan_atelier_nusantara_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('File CSV pesanan berhasil diunduh.');
}

export function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Browser ini tidak mendukung Web Notifications.');
    return;
  }
  Notification.requestPermission().then((perm) => {
    if (perm === 'granted') {
      sfx.playCashChime();
      showToast('Notifikasi aktif. Anda akan menerima peringatan saat pesanan dibayar.');
      triggerPaymentAlert({ invoice: 'NOTIF-TEST', totals: { total: 50000 }, customer: { name: 'Tes Notifikasi' } });
    } else {
      showToast('Izin notifikasi tidak diberikan.');
    }
  });
}

export function testNotificationSound() {
  sfx.playCashChime();
  if (navigator.vibrate) {
    try { navigator.vibrate([200, 100, 200, 100, 400]); } catch {}
  }
  showToast('Memutar bunyi kasir.');
}

export function triggerPaymentAlert(order) {
  sfx.playCashChime();
  if (navigator.vibrate) {
    try { navigator.vibrate([200, 100, 200, 100, 400]); } catch {}
  }

  const title = `Pembayaran diterima`;
  const body = `Invoice: ${order.invoice} (${formatIDR(order.totals.total)}) dari ${order.customer.name || 'Pelanggan'}`;

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: './assets/notification-icon.svg', tag: order.invoice });
    } catch {}
  }
}

function setActiveMobileNav(activeId) {
  document.querySelectorAll('.mobile-app-bar .mobile-nav-item').forEach((item) => {
    item.classList.remove('active');
    if (item.id === activeId) {
      item.classList.add('active');
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute?.('aria-current');
    }
  });
}

export function switchMobileTab(target = 'katalog') {
  if (target === 'search') {
    focusMobileSearch();
    return;
  }
  if (target === 'cart') {
    openCartDrawer();
    return;
  }
  setActiveMobileNav('mob-nav-katalog');
  const catalogEl = document.getElementById('katalog');
  if (catalogEl) catalogEl.scrollIntoView({ behavior: 'smooth' });
}

export function focusMobileSearch() {
  setActiveMobileNav('mob-nav-search');
  const catalogEl = document.getElementById('katalog');
  if (catalogEl) catalogEl.scrollIntoView({ behavior: 'smooth' });
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    setTimeout(() => searchInput.focus(), 350);
  }
}

function initEventBindings() {
  // Category tabs
  document.querySelectorAll('.category-tabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      sfx.playClick();
      document.querySelectorAll('.category-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeCategory = btn.dataset.category;
      renderCatalog();
    });
  });

  // Search
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      if (searchClear) searchClear.style.display = state.searchQuery ? 'block' : 'none';
      renderCatalog();
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      state.searchQuery = '';
      searchClear.style.display = 'none';
      renderCatalog();
      searchInput?.focus();
    });
  }

  // Sort
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderCatalog();
    });
  }

  // Audio toggle
  const audioBtn = document.getElementById('audio-toggle-btn');
  if (audioBtn) {
    const updateAudioIcon = () => {
      audioBtn.setAttribute('aria-pressed', sfx.enabled ? 'true' : 'false');
      audioBtn.innerHTML = sfx.enabled
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
    };
    updateAudioIcon();
    audioBtn.addEventListener('click', () => {
      const next = sfx.toggle();
      updateAudioIcon();
      showToast(next ? 'Efek audio diaktifkan' : 'Efek audio dimatikan');
    });
  }

  // Checkout payment view tab switcher (QRIS vs VA)
  document.querySelectorAll('.payment-tabs .pay-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      sfx.playClick();
      document.querySelectorAll('.payment-tabs .pay-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.target;
      state.activePayTab = target;
      const viewQris = document.getElementById('view-qris');
      const viewVa = document.getElementById('view-va');
      if (viewQris) viewQris.style.display = target === 'view-qris' ? 'block' : 'none';
      if (viewVa) viewVa.style.display = target === 'view-va' ? 'block' : 'none';
    });
  });

  // Delegated dynamic actions (safe from apostrophes/quotes in IDs, variant labels, or QR payloads)
  document.addEventListener('click', (e) => {
    const waLink = e.target && typeof e.target.closest === 'function' ? e.target.closest('[data-store-whatsapp]') : null;
    if (waLink && waLink.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      showToast('Nomor WhatsApp toko belum tersedia. Silakan gunakan pembayaran QRIS.');
      return;
    }
    const trigger = e.target && typeof e.target.closest === 'function' ? e.target.closest('[data-action]') : null;
    if (!trigger) return;
    const action = trigger.dataset.action;
    if (action === 'quick-view') {
      openQuickView(trigger.dataset.productId);
    } else if (action === 'update-qty') {
      updateQuantity(trigger.dataset.lineKey, Number(trigger.dataset.qty));
    } else if (action === 'select-variant') {
      selectVariantOption(trigger.dataset.variant, trigger);
    } else if (action === 'select-shipping') {
      selectShippingMethod(trigger.dataset.shippingId);
    } else if (action === 'prompt-note') {
      promptNote(trigger.dataset.lineKey);
    } else if (action === 'admin-confirm-payment') {
      adminConfirmPayment(trigger.dataset.orderId);
    } else if (action === 'admin-advance-order') {
      adminAdvanceOrderStatus(trigger.dataset.invoice);
    } else if (action === 'admin-cancel-order') {
      adminCancelOrder(trigger.dataset.orderId);
    } else if (action === 'admin-adjust-stock') {
      adminAdjustStock(trigger.dataset.productId);
    } else if (action === 'admin-edit-product') {
      openProductEditForm(trigger.dataset.productId);
    } else if (action === 'admin-toggle-product') {
      toggleProductAvailability(trigger.dataset.productId);
    } else if (action === 'admin-delete-product') {
      deleteProduct(trigger.dataset.productId);
    } else if (action === 'admin-restore-qris') {
      adminRestoreQRIS(trigger.dataset.qrisPayload);
    }
  });

  bindTabs(document.querySelector('.category-tabs'), { filter: true });
  bindTabs(document.querySelector('.payment-tabs'));
  document.querySelectorAll('.modal-backdrop, #cart-drawer').forEach((root) => { root.inert = true; });
  overlays();

  // Shift + Alt + A, Ctrl + Shift + A, or Alt + A opens admin login/dashboard
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    const isAKey = e.key && (e.key.toLowerCase() === 'a' || e.code === 'KeyA');
    if (isAKey && ((e.shiftKey && e.altKey) || (e.ctrlKey && e.shiftKey) || (e.altKey && e.key.toLowerCase() === 'a'))) {
      e.preventDefault();
      if (state.adminAuthenticated && hasInventoryAdminToken()) {
        openAdminDashboardModal();
      } else {
        openAdminLoginModal();
      }
    }
  });

  // Check URL query param for ?admin=1
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') === '1' || params.get('mode') === 'admin' || window.location.hash === '#admin') {
    if (state.adminAuthenticated && hasInventoryAdminToken()) {
      openAdminDashboardModal();
    } else {
      openAdminLoginModal();
    }
  }
}

function initRealtimeSync() {
  subscribe((change) => {
    if (change.domain === 'products') {
      renderCatalog();
      renderCategoryBadges();
      if (state.adminAuthenticated) renderAdminProductsTable();
    } else if (change.domain === 'orders') {
      updateCartUI();
      updateOrderTrackerDockUI();
      if (state.adminAuthenticated) refreshAdminDashboard();
    } else if (change.domain === 'settings') {
      updateStorefrontStatus();
      updateCartUI();
      if (change.type === 'qris' && state.activeCheckoutOrderId) {
        const order = getOrder(state.activeCheckoutOrderId);
        if (order) renderCheckoutView(order);
      }
      if (state.adminAuthenticated) refreshAdminDashboard();
    } else if (change.domain === 'cart') {
      state.cart = getCart();
      updateCartUI();
      renderCatalog();
    }
  });

  // Sweep expired orders periodically
  setInterval(() => {
    sweepExpiredOrders();
  }, 10000);
}

export function initGSAPAnimations() {
  if (typeof window.gsap === 'undefined') return;
  const gsap = window.gsap;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (reduced) return;

  const entrance = gsap.timeline({ defaults: { ease: 'power2.out' } });
  entrance
    .from('.hero-headline', { y: 28, opacity: 0, duration: 0.85 })
    .from('.hero-description', { y: 16, opacity: 0, duration: 0.65 }, '-=0.5')
    .from('.hero-actions', { y: 12, opacity: 0, duration: 0.55 }, '-=0.4')
    .from('.hero-visual', { y: 36, opacity: 0, duration: 1 }, '-=0.85');

  if (typeof window.ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(window.ScrollTrigger);
  const largeScreen = window.matchMedia?.('(min-width: 769px)')?.matches;
  if (largeScreen) {
    gsap.to('.showcase-img-wrap img', {
      yPercent: -8,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.8
      }
    });
  }

  const reveal = (selector, options = {}) => {
    const element = document.querySelector(selector);
    if (!element) return;
    gsap.from(element, {
      y: options.y ?? 22,
      x: options.x ?? 0,
      opacity: 0,
      duration: options.duration ?? 0.8,
      ease: 'power2.out',
      scrollTrigger: { trigger: element, start: 'top 88%', once: true }
    });
  };
  reveal('.story-copy', { x: -24, y: 0 });
  reveal('.story-visual', { x: 24, y: 0, duration: 0.95 });
  reveal('.cta-copy', { y: 28 });
  reveal('.ritual-copy', { y: 20 });
}

function initApp() {
  updateStorefrontStatus();
  renderCatalog();
  updateCartUI();
  updateOrderTrackerDockUI();
  initEventBindings();
  initRealtimeSync();
  syncInventory().catch(() => {});
  setInterval(() => syncInventory().catch(() => {}), 5000);
  window.addEventListener('focus', () => syncInventory().catch(() => {}));

  // Cloud QRIS and settings sync for all visitors across devices
  syncSettingsWithCloud().then((updated) => {
    if (updated && state.activeCheckoutOrderId) {
      const order = getOrder(state.activeCheckoutOrderId);
      if (order) renderCheckoutView(order);
    }
  }).catch(() => {});

  syncOrdersWithCloud().catch(() => {});

  // Polling every 12s so admin QRIS changes update all visitor screens in real time
  if (typeof window !== 'undefined') {
    setInterval(() => {
      syncSettingsWithCloud().then((updated) => {
        if (updated && state.activeCheckoutOrderId) {
          const order = getOrder(state.activeCheckoutOrderId);
          if (order) renderCheckoutView(order);
        }
      }).catch(() => {});
      syncOrdersWithCloud().catch(() => {});
    }, 12000);

    window.addEventListener('focus', () => {
      syncSettingsWithCloud().then((updated) => {
        if (updated && state.activeCheckoutOrderId) {
          const order = getOrder(state.activeCheckoutOrderId);
          if (order) renderCheckoutView(order);
        }
      }).catch(() => {});
      syncOrdersWithCloud().catch(() => {});
    });
  }

  if (typeof window !== 'undefined' && typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      initGSAPAnimations();
    });
  }

  // Register service worker if available with instant update check
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((registration) => {
      registration.update().catch(() => {});
    }).catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  window.addToCart = addToCart;
  window.updateQuantity = updateQuantity;
  window.promptNote = promptNote;
  window.openCartDrawer = openCartDrawer;
  window.closeCartDrawer = closeCartDrawer;
  window.openCheckoutModal = openCheckoutModal;
  window.closeCheckoutModal = closeCheckoutModal;
  window.applyVoucher = applyVoucher;
  window.closeReceiptModal = closeReceiptModal;
  window.openQuickView = openQuickView;
  window.closeQuickView = closeQuickView;
  window.selectVariantOption = selectVariantOption;
  window.addQuickViewToCart = addQuickViewToCart;
  window.openOrderTrackerModal = openOrderTrackerModal;
  window.closeOrderTrackerModal = closeOrderTrackerModal;
  window.clearActiveOrder = clearActiveOrder;
  window.openMerchantConfigModal = openMerchantConfigModal;
  window.switchQRISDisplayMode = switchQRISDisplayMode;
  window.copyQRISPayload = copyQRISPayload;
  window.downloadQRISImage = downloadQRISImage;
  window.checkoutViaWhatsApp = checkoutViaWhatsApp;
  window.sendOrderToWhatsApp = sendOrderToWhatsApp;
  window.shareReceiptWhatsApp = shareReceiptWhatsApp;
  window.printThermalReceipt = printThermalReceipt;
  window.openAdminLoginModal = openAdminLoginModal;
  window.closeAdminLoginModal = closeAdminLoginModal;
  window.submitAdminLogin = submitAdminLogin;
  window.logoutAdminSession = logoutAdminSession;
  window.openAdminDashboardModal = openAdminDashboardModal;
  window.closeAdminDashboardModal = closeAdminDashboardModal;
  window.switchAdminSection = switchAdminSection;
  window.toggleAddProductForm = toggleAddProductForm;
  window.openProductEditForm = openProductEditForm;
  window.submitNewProduct = submitNewProduct;
  window.toggleProductAvailability = toggleProductAvailability;
  window.deleteProduct = deleteProduct;
  window.resetProductsToDefault = resetProductsToDefault;
  window.adminAdvanceOrderStatus = adminAdvanceOrderStatus;
  window.adminConfirmPayment = adminConfirmPayment;
  window.adminCancelOrder = adminCancelOrder;
  window.saveAdminStorefrontSetting = saveAdminStorefrontSetting;
  window.exportOrdersCSV = exportOrdersCSV;
  window.requestNotificationPermission = requestNotificationPermission;
  window.testNotificationSound = testNotificationSound;
  window.selectShippingMethod = selectShippingMethod;
  window.updateCustomerInfo = updateCustomerInfo;
  window.switchMobileTab = switchMobileTab;
  window.focusMobileSearch = focusMobileSearch;
  window.adminApplyCustomQRIS = adminApplyCustomQRIS;
  window.adminRestoreQRIS = adminRestoreQRIS;
  window.adminResetQRISDefault = adminResetQRISDefault;
  window.restartExpiredOrder = restartExpiredOrder;
  window.triggerQRISUpload = triggerQRISUpload;
  window.handleQRISDragOver = handleQRISDragOver;
  window.handleQRISDragLeave = handleQRISDragLeave;
  window.handleQRISDrop = handleQRISDrop;
  window.handleQRISImageUpload = handleQRISImageUpload;
  window.processQRISFile = processQRISFile;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
