import {
  PRODUCTS as SEED_PRODUCTS,
  CATEGORIES,
  normalizeCategorySlug,
  getAllCategories,
  setCustomCategories,
  getCategoryLabel
} from './core/catalog.js';
import { createModalManager, createDialogService, bindTabs } from './core/dialogs.js';

let modalManager;
let modalManagerDoc;
let dialogService;
let dialogServiceDoc;
function overlays() {
  if (!modalManager || modalManagerDoc !== document) {
    modalManagerDoc = document;
    modalManager = createModalManager(document);
  }
  return modalManager;
}
function showDialog(message, options) {
  if (!dialogService || dialogServiceDoc !== document) {
    dialogServiceDoc = document;
    dialogService = createDialogService(overlays(), document);
  }
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
  isDigitalOnly,
  isStrictDigitalOnly,
  productRequiresShipping
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
  getServerNow,
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

import { reserveInventory, getPendingReservation, refreshInventoryOrder, isInventoryOrder, syncInventory, listInventoryOrders, setInventoryAdminToken, hasInventoryAdminToken, refreshInventoryStock, adjustInventoryStock, formatInventoryError } from './core/inventory.js';
import { inventoryAdminHeaders, onAdminLogout } from './core/auth.js';

// Realtime synchronization across browser tabs powered by BroadcastChannel
export const REALTIME_CHANNEL_TYPE = typeof BroadcastChannel !== 'undefined' ? 'BroadcastChannel' : 'StorageEvent';
export const PRODUCTS = [...SEED_PRODUCTS];
export { getCategoryLabel };

export const STORAGE_KEY_CUSTOM_PRODUCTS = STORAGE_KEYS.products;
export const STORAGE_KEY_ADMIN_SESSION = 'an.admin.session.v3';

export function updateStorefrontStatus() {
  const { store } = getSettings();
  const statusPrefix = store.isOpen === false ? 'Tutup' : 'Buka';
  const hoursLabel = store.hours || 'Jam operasional belum diatur';
  const label = document.getElementById('store-status-label');
  if (label) label.textContent = `${statusPrefix} (${hoursLabel})`;
  const dot = document.getElementById('store-status-dot');
  if (dot) dot.hidden = store.isOpen === false;

  const footerLabel = document.getElementById('footer-status-label');
  if (footerLabel) footerLabel.textContent = `${statusPrefix} · ${hoursLabel}`;
  const footerDot = document.getElementById('footer-status-dot');
  if (footerDot) footerDot.hidden = store.isOpen === false;

  const waNum = configuredWhatsApp(store.whatsapp);
  const footerWaLabel = document.getElementById('footer-whatsapp-label');
  if (footerWaLabel) footerWaLabel.textContent = waNum ? 'WhatsApp Toko' : 'WhatsApp belum diatur';
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
  syncFeaturedShowcase();
}

export function toggleFooterPrivacy(forceOpen) {
  const panel = document.getElementById('privasi');
  const trigger = document.getElementById('footer-privacy-trigger');
  if (!panel) return false;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : panel.hidden;
  panel.hidden = !shouldOpen;
  if (trigger) trigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  if (shouldOpen && typeof window !== 'undefined' && window.gsap && !isReducedMotion()) {
    window.gsap.fromTo(panel, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.34, ease: 'power2.out', clearProps: 'transform,opacity' });
  }
  scheduleScrollTriggerRefresh();
  if (shouldOpen && forceOpen === true) {
    panel.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    panel.focus?.({ preventScroll: true });
  }
  return shouldOpen;
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
  if (invalidLine) {
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

  playOrderAlert() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [660, 880, 1100].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + idx * 0.085;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.25);
      });
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
  activeTrackerOrderId: null,
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

function handleCategoryTabSelect(btn) {
  if (!btn) return;
  sfx.playClick();
  document.querySelectorAll('.category-tabs .tab-btn').forEach((b) => {
    b.classList.remove('active');
    b.setAttribute?.('aria-pressed', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute?.('aria-pressed', 'true');
  state.activeCategory = btn.dataset.category;
  renderCatalog();
  syncCategoryTabSlider();
}

function bindCategoryTabButton(btn) {
  if (!btn || btn._catTabBound) return;
  btn._catTabBound = true;
  btn.addEventListener?.('click', () => handleCategoryTabSelect(btn));
}

export function renderCategoryTabs() {
  const container = document.querySelector?.('.category-tabs');
  if (!container || typeof document?.createElement !== 'function' || typeof container.appendChild !== 'function') {
    renderCategoryBadges();
    return;
  }
  const products = getProducts();
  const settings = getSettings();
  const allCats = getAllCategories(products, settings.store?.categories);
  const allowedIds = new Set(['semua', ...allCats.map((c) => c.id)]);
  if (!allowedIds.has(state.activeCategory)) state.activeCategory = 'semua';

  const existingButtons = Array.from(container.querySelectorAll?.('.tab-btn') || []);
  const byCat = new Map();
  existingButtons.forEach((btn) => {
    const catId = btn.dataset?.category;
    if (!allowedIds.has(catId)) {
      btn.remove?.();
    } else {
      byCat.set(catId, btn);
    }
  });

  const slider = document.getElementById?.('tab-active-slider');
  for (const cat of allCats) {
    let btn = byCat.get(cat.id);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab-btn';
      btn.dataset.category = cat.id;
      btn.innerHTML = `<span>${escapeHTML(cat.label)}</span><span class="tab-count">0</span>`;
      if (slider && slider.parentNode === container) container.insertBefore(btn, slider);
      else container.appendChild(btn);
    }
    bindCategoryTabButton(btn);
  }

  Array.from(container.querySelectorAll?.('.tab-btn') || []).forEach((btn) => {
    const active = btn.dataset?.category === state.activeCategory;
    btn.classList?.toggle?.('active', active);
    btn.setAttribute?.('aria-pressed', active ? 'true' : 'false');
  });

  renderCategoryBadges();
  syncCategoryTabSlider(true);
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

let lastRenderedCatalogHtml = '';
let featuredProductId = 'prod-01';

/**
 * Formats live stock availability for a product across admin and storefront views.
 */
function formatProductStockLabel(product, { fallback = 'Stok server belum dimuat' } = {}) {
  if (!product) return fallback;
  const snapshot = getInventoryStock();
  if (!snapshot) return fallback;
  if (!Object.hasOwn(snapshot.products, product.id)) return 'Stok belum diinisialisasi';
  return product.stock === null ? 'Stok: Tanpa Batas' : `Stok: ${product.stock}`;
}

export function syncFeaturedShowcase(products = getProducts()) {
  if (typeof document === 'undefined') return null;
  const list = Array.isArray(products) ? products : [];
  const featured =
    list.find((p) => p.id === 'prod-01' && isPurchasable(p))
    || list.find((p) => isPurchasable(p))
    || list.find((p) => p.id === 'prod-01')
    || list[0];
  if (!featured) return null;

  featuredProductId = featured.id;
  const available = isPurchasable(featured);
  const { store } = getSettings();
  const storeOpen = store.isOpen !== false;
  const variants = Array.isArray(featured.variants) ? featured.variants : [];
  const firstVariant = variants[0]?.label || '';
  const activeVariantObj = variants.find((v) => v.label === selectedStoryVariant) || variants[0] || null;
  selectedStoryVariant = activeVariantObj ? activeVariantObj.label : '';
  const effectivePrice = Math.max(0, Number(featured.price || 0) + Number(activeVariantObj?.priceDelta || 0));

  const heroQuickBtn = document.getElementById('hero-showcase-quick-btn');
  if (heroQuickBtn) {
    heroQuickBtn.disabled = !available || !storeOpen;
    heroQuickBtn.onclick = () => addToCart(featured.id, firstVariant);
    const span = heroQuickBtn.querySelector?.('span');
    const shortName = featured.name.split(/\s+/).slice(0, 2).join(' ');
    if (span) {
      span.textContent = !storeOpen
        ? 'Toko Sedang Tutup'
        : available
          ? `+ Pesan ${shortName}`
          : `${shortName} Habis`;
    }
  }

  const heroTag = document.getElementById('hero-showcase-tag');
  if (heroTag) heroTag.textContent = available ? (featured.tags?.[0] || 'Produk unggulan') : 'Stok habis';
  const heroImg = document.getElementById('hero-showcase-img');
  if (heroImg && featured.image) {
    heroImg.src = featured.image;
    heroImg.alt = `${featured.name} Atelier Nusantara`;
  }
  const heroTitle = document.getElementById('hero-showcase-title');
  if (heroTitle) heroTitle.textContent = featured.name;
  const heroPrice = document.getElementById('hero-showcase-price');
  if (heroPrice) heroPrice.textContent = formatIDR(featured.price);
  const heroDesc = document.getElementById('hero-showcase-desc');
  if (heroDesc) heroDesc.textContent = featured.desc || '';
  const heroBtn = document.getElementById('hero-showcase-btn');
  if (heroBtn) {
    heroBtn.disabled = !available || !storeOpen;
    heroBtn.onclick = () => addToCart(featured.id, firstVariant);
    const btnSpan = heroBtn.querySelector?.('span');
    if (btnSpan) {
      btnSpan.textContent = !storeOpen ? 'Toko Tutup' : available ? 'Tambah ke Pesanan' : 'Stok Habis';
    }
  }

  const storyImg = document.getElementById('story-preview-img');
  if (storyImg && featured.image) {
    storyImg.src = featured.image;
    storyImg.alt = `${featured.name} Atelier Nusantara`;
  }
  const storyTitle = document.getElementById('story-panel-1-title');
  if (storyTitle) storyTitle.textContent = featured.name;
  const storyDesc = document.getElementById('story-panel-1-desc');
  if (storyDesc) {
    storyDesc.textContent = featured.desc || 'Buka detail untuk melihat varian, sisa stok, dan harga terkini sebelum menambahkannya ke keranjang.';
  }
  const storyPrice = document.getElementById('story-panel-1-price');
  if (storyPrice) storyPrice.textContent = formatIDR(effectivePrice);
  const storyBtn = document.getElementById('story-panel-1-btn');
  if (storyBtn) {
    storyBtn.onclick = () => openQuickView(featured.id, selectedStoryVariant);
  }

  const chipsWrap = document.getElementById('story-panel-1-chips');
  const noteEl = document.getElementById('story-variant-note');
  if (chipsWrap) {
    if (variants.length > 0) {
      chipsWrap.hidden = false;
      const chipSig = `${featured.id}|${variants.map((v) => `${v.label}:${v.priceDelta || 0}`).join(',')}|${selectedStoryVariant}`;
      if (chipsWrap.dataset?.signature !== chipSig) {
        if (chipsWrap.dataset) chipsWrap.dataset.signature = chipSig;
        chipsWrap.innerHTML = variants.map((v) => {
          const isSelected = v.label === selectedStoryVariant;
          return `<button type="button" class="story-variant-chip${isSelected ? ' is-active' : ''}" data-story-variant="${escapeHTML(v.label)}" aria-pressed="${isSelected ? 'true' : 'false'}">${escapeHTML(v.label.replace(':', ' ·'))}</button>`;
        }).join('');
      }
      if (noteEl) {
        const stockText = formatProductStockLabel(featured, { fallback: 'Stok aktif' });
        noteEl.textContent = `Varian dipilih: ${selectedStoryVariant} (${formatIDR(effectivePrice)}) · ${stockText}.`;
      }
    } else {
      chipsWrap.hidden = true;
      chipsWrap.innerHTML = '';
      if (noteEl) noteEl.textContent = `Stok saat ini: ${formatProductStockLabel(featured, { fallback: 'Stok aktif' })}.`;
    }
  }

  return featured;
}

export function renderCatalog() {
  const all = getProducts();
  syncFeaturedShowcase(all);

  const grid = document.getElementById('product-grid');
  const countEl = document.getElementById('results-count');
  if (!grid) return;

  renderCategoryBadges();
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

  const filterKey = `${state.activeCategory}|${state.sortBy}|${state.searchQuery}`;
  const filterChanged = gsapReady && filterKey !== lastCatalogFilterKey;
  const countChanged = gsapReady && list.length !== lastCatalogCount;
  lastCatalogFilterKey = filterKey;
  lastCatalogCount = list.length;

  const emptyHtml = `
      <div class="empty-state">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <h3>Koleksi tidak ditemukan</h3>
        <p>Coba gunakan kata kunci lain atau pilih kategori koleksi di atas.</p>
      </div>
    `;

  const nextHtml = list.length === 0 ? emptyHtml : list.map((item) => {
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
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                  <span>Pilih Varian</span>
                </button>
              `}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  if (!filterChanged && !countChanged && nextHtml === lastRenderedCatalogHtml && grid.innerHTML !== '') {
    return;
  }

  grid.innerHTML = nextHtml;
  lastRenderedCatalogHtml = nextHtml;

  if (list.length === 0) {
    if (countChanged) scheduleScrollTriggerRefresh();
    return;
  }

  if (filterChanged) {
    animateCatalogCards(grid);
    scheduleScrollTriggerRefresh();
  } else if (countChanged) {
    scheduleScrollTriggerRefresh();
  }
}

export function openQuickView(productId, preferredVariant = '') {
  const product = getProduct(productId);
  if (!product) return;

  const matchedVariant = preferredVariant && product.variants?.find((v) => v.label === preferredVariant);
  state.activeQuickViewId = productId;
  state.selectedQuickViewVariant = matchedVariant
    ? matchedVariant.label
    : (product.variants && product.variants[0] ? product.variants[0].label : '');
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
  clearCustomerErrors();
}

function setCustomerFieldError(field, message) {
  const input = document.getElementById(`customer-${field}`);
  const errEl = document.getElementById(`error-customer-${field}`);
  const hasErr = Boolean(message);
  if (input) {
    if (hasErr) {
      input.classList?.add?.('is-invalid');
      input.setAttribute?.('aria-invalid', 'true');
    } else {
      input.classList?.remove?.('is-invalid');
      input.removeAttribute?.('aria-invalid');
    }
  }
  if (errEl) {
    errEl.textContent = message || '';
    errEl.hidden = !hasErr;
  }
  return hasErr ? input : null;
}

function clearCustomerErrors() {
  for (const field of ['name', 'phone', 'address']) {
    setCustomerFieldError(field, '');
  }
}

function validateCheckoutCustomer({ digitalOnly = false, shippingId = 'instant' } = {}) {
  clearCustomerErrors();
  const name = String(state.customer?.name || '').trim();
  const phone = String(state.customer?.phone || '').trim();
  const address = String(state.customer?.address || '').trim();
  const phoneDigits = phone.replace(/\D/g, '');
  const needsAddress = !digitalOnly && shippingId !== 'pickup' && shippingId !== 'no_courier';

  let firstInvalid = null;
  let firstMessage = '';
  const recordErr = (field, msg) => {
    const el = setCustomerFieldError(field, msg);
    if (!firstInvalid && el) firstInvalid = el;
    if (!firstMessage) firstMessage = msg;
  };

  if (name.length < 2 || name.length > 100) {
    recordErr('name', 'Isi nama pemesan minimal 2 huruf.');
  }
  if (!phone || !/^\+?[0-9 ()-]{8,24}$/.test(phone) || phoneDigits.length < 8) {
    recordErr('phone', 'Isi nomor WhatsApp aktif minimal 8 angka.');
  }
  if (needsAddress && address.length === 0) {
    recordErr('address', 'Alamat pengantaran wajib diisi untuk kurir pilihan Anda.');
  } else if (address.length > 500) {
    recordErr('address', 'Alamat terlalu panjang (maksimal 500 karakter).');
  }

  if (firstMessage) {
    if (firstInvalid) {
      firstInvalid.focus?.();
      firstInvalid.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }
    showToast(firstMessage);
    return false;
  }
  return true;
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
const NO_COURIER_SHIPPING = { id: 'no_courier', name: 'Tanpa kurir (diproses toko)', price: 0, eta: 'Sesuai konfirmasi toko' };

function resolveAvailableShippingMethods(settings, purchasableLines) {
  const digitalOnly = isDigitalOnly(purchasableLines);
  const strictDigital = isStrictDigitalOnly(purchasableLines);
  if (digitalOnly) {
    return [strictDigital ? DIGITAL_SHIPPING : NO_COURIER_SHIPPING];
  }
  const shippingEnabled = settings?.store?.shippingEnabled !== false;
  const pickupEnabled = settings?.store?.pickupEnabled !== false;
  const list = (Array.isArray(settings?.shipping) ? settings.shipping : []).filter((s) =>
    s.id === 'pickup' ? pickupEnabled : shippingEnabled
  );
  return list.length ? list : [NO_COURIER_SHIPPING];
}

export function getCalculatedCart() {
  const products = getProducts();
  const lines = resolveLines(state.cart, products);
  const settings = getSettings();
  const purchasable = lines.filter((l) => l.available);
  const digitalOnly = isDigitalOnly(purchasable);
  const availableShipping = resolveAvailableShippingMethods(settings, purchasable);
  const chosen = availableShipping.find((s) => s.id === state.activeShippingId) || availableShipping[0];
  if (!digitalOnly && chosen && chosen.id !== state.activeShippingId) state.activeShippingId = chosen.id;
  const activeShipping = chosen;
  const voucher = state.activeVoucherCode ? { code: state.activeVoucherCode, percent: state.voucherDiscountPercent } : null;
  const totals = computeTotals({
    lines,
    shipping: activeShipping,
    voucher,
    packagingFee: settings.packagingFee
  });
  return { lines, totals, settings, activeShipping, availableShipping, voucher };
}

function renderShippingOptions(settings, totals, activeShipping, availableShipping = []) {
  const grid = document.getElementById('shipping-methods-grid');
  const note = document.getElementById('shipping-digital-note');
  const title = document.getElementById('shipping-section-title');
  const addressGroup = document.getElementById('customer-address-group');
  const addressEl = document.getElementById('customer-address');
  const errorAddressEl = document.getElementById('error-customer-address');
  const digital = totals.digitalOnly;
  const noCourierOnly = digital || activeShipping?.id === 'no_courier';

  if (note) {
    note.hidden = !noCourierOnly;
    if (noCourierOnly) {
      note.textContent = activeShipping?.id === 'no_courier'
        ? 'Pesanan ini tidak memerlukan kurir pengiriman. Tanpa ongkir dan alamat kurir.'
        : 'Produk digital dikirim ke WhatsApp Anda setelah pembayaran diterima. Tanpa ongkir dan alamat.';
    }
  }
  if (grid) grid.hidden = noCourierOnly;
  if (title) title.textContent = noCourierOnly ? 'Pengiriman' : 'Metode Pengiriman';
  if (addressGroup) addressGroup.hidden = noCourierOnly;
  if (noCourierOnly && errorAddressEl) errorAddressEl.hidden = true;
  if (addressEl) {
    const pickup = activeShipping?.id === 'pickup';
    addressEl.hidden = noCourierOnly;
    addressEl.placeholder = pickup ? 'Catatan pengambilan di toko (opsional)' : 'Alamat pengantaran lengkap';
    addressEl.setAttribute('aria-label', addressEl.placeholder);
  }
  if (!grid || noCourierOnly) return;

  const list = availableShipping.length ? availableShipping : settings.shipping;
  const signature = JSON.stringify(list) + state.activeShippingId;
  if (grid.dataset.signature === signature) return;
  grid.dataset.signature = signature;
  grid.innerHTML = list.map((s) => `
    <button type="button" class="shipping-method-card ${s.id === state.activeShippingId ? 'active' : ''}" data-action="select-shipping" data-shipping-id="${escapeHTML(s.id)}"
      aria-pressed="${s.id === state.activeShippingId}">
      <span class="shipping-name">${escapeHTML(s.name)}</span>
      <span class="shipping-price">${Number(s.price) > 0 ? formatIDR(s.price) : 'Gratis'}</span>
      <span class="shipping-eta">${escapeHTML(s.eta || '')}</span>
    </button>
  `).join('');
}

let lastCartBadgeCount = null;
let ritualPreviewMode = 'auto';
let lastShownRitualAmount = null;
let selectedStoryVariant = 'Level 0: Ramah Anak';
let manualStoryOverrideUntil = 0;
let lastAutoStoryStep = '1';
let applyStoryStepFn = null;

function syncRitualLiveTicket(totalsOverride = null) {
  const amountEl = document.getElementById?.('ritual-ticket-amount');
  const labelEl = document.getElementById?.('ritual-ticket-label');
  if (!amountEl || !labelEl) return;

  const totals = totalsOverride || getCalculatedCart()?.totals || { itemCount: 0, total: 0 };
  const presetBtns = Array.from(document.querySelectorAll?.('.ritual-preset-btn') || []);
  let mode = ritualPreviewMode;
  if (mode === 'auto') {
    mode = totals.itemCount > 0 ? 'cart' : '78000';
  }

  let displayAmount = 78000;
  let displayLabel = 'Contoh nominal produk';
  if (mode === '156000') {
    displayAmount = 156000;
    displayLabel = 'Simulasi 2 porsi Wagyu Se’i';
  } else if (mode === 'cart') {
    displayAmount = totals.total > 0 ? totals.total : 0;
    displayLabel = totals.itemCount > 0
      ? `Total keranjang Anda (${totals.itemCount} item)`
      : 'Keranjang masih kosong';
  }

  presetBtns.forEach((btn) => {
    const active = btn.dataset?.ritualPreset === mode;
    btn.classList?.toggle?.('is-active', active);
    btn.setAttribute?.('aria-pressed', active ? 'true' : 'false');
  });

  labelEl.textContent = displayLabel;
  amountEl.textContent = formatIDR(displayAmount);

  if (lastShownRitualAmount !== null && lastShownRitualAmount !== displayAmount && gsapReady && !isReducedMotion() && typeof window?.gsap?.fromTo === 'function') {
    window.gsap.fromTo(
      amountEl,
      { y: 5 },
      { y: 0, duration: 0.24, ease: 'power2.out', clearProps: 'transform', overwrite: 'auto' }
    );
  }
  lastShownRitualAmount = displayAmount;
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

  const { lines, totals, settings, activeShipping, availableShipping, voucher } = getCalculatedCart();

  if (countBadge) countBadge.textContent = totals.itemCount;
  if (mobBadge) mobBadge.textContent = totals.itemCount;
  if (lastCartBadgeCount !== null && lastCartBadgeCount !== totals.itemCount && gsapReady && !isReducedMotion() && typeof window?.gsap?.fromTo === 'function') {
    const badgeTargets = [countBadge, mobBadge].filter(Boolean);
    if (badgeTargets.length) {
      window.gsap.fromTo(
        badgeTargets,
        { scale: 1.28 },
        { scale: 1, duration: 0.34, ease: 'back.out(2.4)', clearProps: 'transform', overwrite: 'auto' }
      );
    }
  }
  lastCartBadgeCount = totals.itemCount;
  syncRitualLiveTicket(totals);
  if (drawerCount) drawerCount.textContent = `(${totals.itemCount} pesanan)`;

  if (subtotalEl) subtotalEl.textContent = formatIDR(totals.subtotal);
  if (shippingEl) {
    if (totals.digitalOnly || activeShipping?.id === 'no_courier') {
      shippingEl.textContent = isStrictDigitalOnly(lines.filter((l) => l.available)) ? 'Gratis (digital)' : 'Tanpa kurir';
    } else {
      shippingEl.textContent = formatIDR(totals.shippingCost);
    }
  }
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

  renderShippingOptions(settings, totals, activeShipping, availableShipping);

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
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
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
  updateCartUI();
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
  if (!pending && !existingOrderId && !validateCheckoutCustomer({ digitalOnly: totals.digitalOnly, shippingId: activeShipping?.id || 'digital' })) {
    return;
  }
  let newOrder;
  const settingsSync = syncSettingsWithCloud().catch(() => null);
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
  catch (error) { showToast(formatInventoryError(error)); return; }
  finally { setCheckoutPending(false); }
  const alreadyExpiredOrCancelled = newOrder.status === STATUS.EXPIRED
    || newOrder.status === STATUS.CANCELLED
    || (newOrder.status === STATUS.AWAITING && remainingMs(newOrder, getServerNow()) <= 0);
  if (!existingOrderId && (newOrder.status !== STATUS.AWAITING || remainingMs(newOrder, getServerNow()) <= 0)) {
    showToast(`Reservasi berstatus ${statusLabel(newOrder.status, newOrder)}. Tidak ada tagihan baru dibuat.`);
    return;
  }
  if (existingOrderId && isPaidStatus(newOrder.status)) {
    showToast(`Pesanan berstatus ${statusLabel(newOrder.status, newOrder)}. Tidak perlu pembayaran ulang.`);
    return;
  }
  if (alreadyExpiredOrCancelled && newOrder.status === STATUS.AWAITING && !isInventoryOrder(newOrder)) {
    sweepExpiredOrders(getServerNow());
    newOrder = getOrder(newOrder.id) || newOrder;
  }
  await Promise.race([settingsSync, new Promise((resolve) => setTimeout(resolve, 400))]);

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

  stopActiveOrderWatch();
  try {
    state.activeOrderStopWatch = watchOrder(newOrder.id, {
      onTick: (msRemaining, currentOrder) => {
        const clockEl = document.getElementById('payment-countdown-clock');
        const expiredNow = msRemaining <= 0;
        if (clockEl) clockEl.textContent = expiredNow ? '00:00 (Batal Otomatis)' : formatCountdown(msRemaining);
        if (expiredNow) {
          const polling = document.querySelector('.polling-indicator');
          if (polling) polling.style.display = 'none';
          const banner = document.getElementById('payment-expired-banner');
          if (banner && banner.style.display !== 'block') {
            renderPaymentTerminationBanner(banner, 'expired');
            banner.style.display = 'block';
            updateOrderTrackerDockUI();
            renderCatalog();
          }
        }
      },
      onUpdate: (updatedOrder, previousOrder) => {
        if (updatedOrder.status === STATUS.PAID) {
          handlePaymentCompleted(updatedOrder);
        } else if (updatedOrder.status === STATUS.EXPIRED) {
          handlePaymentExpired(updatedOrder);
        } else if (updatedOrder.status === STATUS.CANCELLED) {
          handlePaymentCancelled(updatedOrder);
        }
      },
      onError: () => {
        const polling = document.querySelector('.polling-indicator');
        if (polling) polling.style.display = 'none';
        showToast('Pesanan ini sudah kedaluwarsa atau dihapus dari server. Silakan buat pesanan baru.');
      }
    });
  } catch (err) {
    console.warn('Watch order warning:', err);
  }
}

function stopActiveOrderWatch() {
  if (state.activeOrderStopWatch) {
    state.activeOrderStopWatch();
    state.activeOrderStopWatch = null;
  }
}

function renderPaymentTerminationBanner(banner, mode) {
  if (!banner) return;
  if (mode === 'cancelled') {
    banner.innerHTML = `
      <strong>Pesanan Dibatalkan</strong>
      <p style="font-size:0.8rem; margin:4px 0 8px;">Pesanan ini dibatalkan dan reservasi stok telah dikembalikan.</p>
      <button type="button" class="btn-primary" onclick="window.restartExpiredOrder()" style="background:#B91C1C; padding:10px 16px; min-height:44px; font-size:0.85rem; margin:0 auto;">Buat Pesanan Ulang</button>
    `;
  } else {
    banner.innerHTML = `
      <strong>Waktu Pembayaran 10 Menit Habis · Pesanan Dibatalkan Otomatis</strong>
      <p style="font-size:0.8rem; margin:4px 0 8px;">Batas waktu pembayaran telah berakhir sehingga pesanan ini dibatalkan otomatis. Silakan buat pesanan ulang.</p>
      <button type="button" class="btn-primary" onclick="window.restartExpiredOrder()" style="background:#B91C1C; padding:10px 16px; min-height:44px; font-size:0.85rem; margin:0 auto;">Buat Pesanan Ulang</button>
    `;
  }
}

function renderCheckoutView(order) {
  const settings = getSettings();
  let rawStatic;
  try { rawStatic = paymentStaticPayload(order, settings.qris.payload || DEMO_STATIC_QRIS); }
  catch (error) { showPaymentSnapshotError(error); return; }
  const desc = describeQRIS(rawStatic);

  const amountEl = document.getElementById('qris-amount-number');
  const uniqueBadgeEl = document.getElementById('qris-unique-badge');
  const invoiceEl = document.getElementById('payment-invoice-number');
  const merchantEl = document.getElementById('qris-merchant-display');
  const nmidEl = document.getElementById('qris-nmid-display');
  const vaEl = document.getElementById('va-code-number');
  const banner = document.getElementById('payment-expired-banner');
  const polling = document.querySelector('.polling-indicator');
  const clockEl = document.getElementById('payment-countdown-clock');
  const msLeft = remainingMs(order, getServerNow());
  const cancelled = order.status === STATUS.CANCELLED;
  const expired = !cancelled && (msLeft <= 0 || order.status === STATUS.EXPIRED);

  if (banner) {
    renderPaymentTerminationBanner(banner, cancelled ? 'cancelled' : 'expired');
    banner.style.display = (cancelled || expired) ? 'block' : 'none';
  }
  if (polling) polling.style.display = (cancelled || expired) ? 'none' : 'flex';
  if (clockEl) clockEl.textContent = cancelled ? 'Dibatalkan' : (expired ? '00:00 (Batal Otomatis)' : formatCountdown(msLeft));

  if (amountEl) amountEl.textContent = formatIDR(order.totals.total);
  if (uniqueBadgeEl) {
    const code = Number(order.totals?.uniqueCode || 0);
    if (code > 0) {
      uniqueBadgeEl.textContent = `Sudah termasuk kode unik +Rp ${code} (verifikasi otomatis)`;
      uniqueBadgeEl.hidden = false;
    } else {
      uniqueBadgeEl.textContent = '';
      uniqueBadgeEl.hidden = true;
    }
  }
  if (invoiceEl) invoiceEl.textContent = order.invoice;
  if (merchantEl) merchantEl.textContent = desc.merchantName || settings.store.name;
  if (nmidEl) nmidEl.textContent = [desc.nmid ? `NMID: ${desc.nmid}` : '', desc.city].filter(Boolean).join(' · ');
  if (vaEl) {
    vaEl.textContent = 'Toko ini belum mengaktifkan integrasi penyedia Virtual Account perbankan.';
  }

  switchQRISDisplayMode('dynamic', order);
}

function showPaymentSnapshotError(error) {
  state.activeCheckoutPayload = '';
  const qr = document.getElementById('qris-svg-container');
  if (qr) { qr.innerHTML = ''; qr.textContent = error.message; }
  showToast(error.message);
}

export function switchQRISDisplayMode(mode = 'dynamic', explicitOrder = null) {
  state.currentQRISDisplayMode = 'dynamic';
  const order = explicitOrder || (state.activeCheckoutOrderId ? getOrder(state.activeCheckoutOrderId) : null) || state.activeOrder;
  const settings = getSettings();
  let rawStatic;
  try { rawStatic = paymentStaticPayload(order, settings.qris.payload || DEMO_STATIC_QRIS); }
  catch (error) { showPaymentSnapshotError(error); return; }

  const pill = document.getElementById('qris-acquirer-pill');
  if (pill) {
    const acquirer = acquirerLabel(describeQRIS(rawStatic).acquirer);
    pill.textContent = acquirer ? `${acquirer} · QRIS Dinamis` : 'QRIS Dinamis';
  }

  const amountLabelEl = document.getElementById('qris-amount-label');
  const qrContainer = document.getElementById('qris-svg-container');
  if (amountLabelEl) amountLabelEl.textContent = 'Total Tagihan Otomatis (Terkunci di HP):';

  let payload = rawStatic;
  try {
    const amount = order ? order.totals.total : 10000;
    const invoice = order ? order.invoice : 'INV01';
    payload = convertStaticToDynamicQRIS(rawStatic, amount, invoice);
  } catch (error) {
    if (isInventoryOrder(order)) { showPaymentSnapshotError(error); return; }
    payload = rawStatic;
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
        qrContainer.innerHTML = '<div class="qr-fallback" style="padding:15px; font-size:0.82rem; text-align:center; color:#374151;">Gagal membuat kode QRIS di perangkat ini. Muat ulang halaman atau hubungi toko lewat WhatsApp.</div>';
      }
    }
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
    showToast('Gagal membuat gambar QR. Silakan coba lagi atau hubungi toko via WhatsApp.');
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
  stopActiveOrderWatch();
  closeCheckoutModal();
  sfx.playCashChime();
  triggerPaymentAlert(order);

  // Clear cart & applied voucher after payment
  state.cart = [];
  state.activeVoucherCode = '';
  state.voucherDiscountPercent = 0;
  const voucherInput = document.getElementById('voucher-input');
  if (voucherInput) voucherInput.value = '';
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
  stopActiveOrderWatch();
  const clockEl = document.getElementById('payment-countdown-clock');
  if (clockEl) clockEl.textContent = '00:00 (Batal Otomatis)';
  const banner = document.getElementById('payment-expired-banner');
  renderPaymentTerminationBanner(banner, 'expired');
  if (banner) banner.style.display = 'block';
  const polling = document.querySelector('.polling-indicator');
  if (polling) polling.style.display = 'none';
  renderCatalog();
  updateCartUI();
  updateOrderTrackerDockUI();
  showToast('Waktu pembayaran 10 menit telah habis dan pesanan dibatalkan otomatis. Silakan buat pesanan ulang.');
}

function handlePaymentCancelled(order) {
  stopActiveOrderWatch();
  const clockEl = document.getElementById('payment-countdown-clock');
  if (clockEl) clockEl.textContent = 'Dibatalkan';
  const banner = document.getElementById('payment-expired-banner');
  renderPaymentTerminationBanner(banner, 'cancelled');
  if (banner) banner.style.display = 'block';
  const polling = document.querySelector('.polling-indicator');
  if (polling) polling.style.display = 'none';
  renderCatalog();
  updateOrderTrackerDockUI();
  showToast('Pesanan dibatalkan oleh toko. Stok reservasi telah dikembalikan.');
}

export function restartExpiredOrder() {
  closeCheckoutModal();
  openCartDrawer();
  showToast('Silakan cek kembali keranjang Anda dan lanjutkan checkout.');
}

export function closeCheckoutModal() {
  const modal = document.getElementById('payment-modal-backdrop');
  overlays().close(modal);
  stopActiveOrderWatch();
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

function buildWhatsAppOrderMessage(order, settings) {
  const storeName = String(settings?.store?.name || 'Atelier Nusantara').trim();
  const lines = [
    `*PESANAN ${storeName.toUpperCase()}*`,
    '----------------------------------------',
    `No. Invoice: ${order.invoice || '-'}`,
    `Waktu: ${formatDateTime(order.createdAt || Date.now())}`,
    '',
    '*Data Pemesan:*',
    `- Nama: ${order.customer?.name || '-'}`,
    `- WhatsApp: ${order.customer?.phone || '-'}`,
    `- Pengiriman: ${order.shipping?.name || 'Ambil di toko'}`
  ];
  if (order.shipping?.id && !['digital', 'no_courier'].includes(order.shipping.id)) {
    lines.push(`- Alamat/Catatan: ${order.customer?.address || '-'}`);
  } else if (order.customer?.address) {
    lines.push(`- Catatan: ${order.customer.address}`);
  }
  lines.push('', '*Rincian Pesanan:*');
  (order.items || []).forEach((item) => {
    const variantPart = item.variant ? ` [${item.variant}]` : '';
    const notePart = item.note ? ` (catatan: ${item.note})` : '';
    lines.push(`- ${item.name} (x${item.qty})${variantPart}${notePart}: ${formatIDR(Number(item.unitPrice || 0) * Number(item.qty || 1))}`);
  });
  lines.push('', `Subtotal: ${formatIDR(order.totals?.subtotal || 0)}`);
  if (Number(order.totals?.discount || 0) > 0) {
    lines.push(`Diskon${order.voucherCode ? ` (${order.voucherCode})` : ''}: -${formatIDR(order.totals.discount)}`);
  }
  if (Number(order.totals?.shippingCost || 0) > 0) {
    lines.push(`Ongkos Kirim: ${formatIDR(order.totals.shippingCost)}`);
  }
  if (Number(order.totals?.packaging || 0) > 0) {
    lines.push(`Kemasan: ${formatIDR(order.totals.packaging)}`);
  }
  lines.push(`*TOTAL: ${formatIDR(order.totals?.total || 0)}*`);
  if (order.status === STATUS.AWAITING) {
    const methodLabel = order.payment?.method === 'whatsapp'
      ? 'Konfirmasi & ketersediaan lewat WhatsApp'
      : 'Pembayaran QRIS Dinamis';
    lines.push(`Status: ${methodLabel} (berlaku hingga ${formatTime(order.expiresAt)})`);
  } else {
    lines.push(`Status: ${statusLabel(order.status, order)}`);
  }
  lines.push('----------------------------------------', 'Mohon konfirmasi pesanan ini. Terima kasih!');
  return lines.join('\n');
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
  if (!pending && !existingOrderId && !validateCheckoutCustomer({ digitalOnly: totals.digitalOnly, shippingId: activeShipping?.id || 'digital' })) {
    return;
  }

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
  catch (error) { popup?.close(); showToast(formatInventoryError(error)); return; }
  finally { setCheckoutPending(false); }
  if (newOrder.status !== STATUS.AWAITING || remainingMs(newOrder, getServerNow()) <= 0 || newOrder.payment?.method !== 'whatsapp') {
    popup?.close();
    showToast('Reservasi tidak menunggu konfirmasi WhatsApp. Periksa pelacak pesanan.');
    return;
  }
  rememberMyOrder(newOrder.id);

  const msg = buildWhatsAppOrderMessage(newOrder, settings);
  const waNum = configuredWhatsApp(settings.store.whatsapp);
  const url = `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`;
  const fallback = document.getElementById('checkout-whatsapp-link');
  if (fallback) { fallback.href = url; fallback.hidden = false; }
  let launched = false;
  try { if (popup && !popup.closed) { popup.location.href = url; launched = true; } } catch { popup?.close(); }
  if (!launched) {
    const drawer = document.getElementById('cart-drawer');
    if (drawer && !drawer.classList?.contains?.('open')) {
      openCartDrawer();
    }
    updateOrderTrackerDockUI();
    fallback?.focus?.();
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
  const order = getOrder(state.activeCheckoutOrderId) || state.activeOrder;
  if (!order) return;
  if (order.status === STATUS.CANCELLED || order.status === STATUS.EXPIRED || (order.status === STATUS.AWAITING && remainingMs(order, getServerNow()) <= 0)) {
    showToast('Pesanan sudah kedaluwarsa atau dibatalkan. Silakan buat pesanan ulang.');
    return;
  }
  const waNum = requireWhatsApp();
  if (!waNum) return;
  const settings = getSettings();
  const msg = buildWhatsAppOrderMessage(order, settings);
  const url = `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`;
  const popup = window.open(url, '_blank');
  if (popup) popup.opener = null;
  else {
    const fallback = document.getElementById('checkout-whatsapp-link');
    if (fallback) { fallback.href = url; fallback.hidden = false; }
    showToast('Popup WhatsApp diblokir. Gunakan tombol WhatsApp di keranjang atau buka WhatsApp Anda.');
  }
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
  state.activeTrackerOrderId = active.id;
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
  state.activeTrackerOrderId = null;
  const modal = document.getElementById('order-tracker-modal-backdrop');
  overlays().close(modal);
}

export function clearActiveOrder() {
  const myIds = getMyOrderIds();
  const targetId = state.activeTrackerOrderId || myIds[0];
  if (targetId) {
    forgetMyOrder(targetId);
    state.activeTrackerOrderId = null;
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
  } catch (error) {
    state.adminAuthenticated = false;
    setInventoryAdminToken('');
    if (errorEl) { errorEl.textContent = error.message; errorEl.style.display = 'block'; }
    showToast('Akses backend belum terverifikasi. Periksa token dan koneksi.');
    return;
  }
  if (errorEl) errorEl.style.display = 'none';
  state.adminAuthenticated = true;
  closeAdminLoginModal();
  openAdminDashboardModal();
  sfx.playSuccess();
  showToast('Akses admin aktif. Dashboard toko terbuka.');
}

function handleAdminSessionExpired() {
  const wasAuthenticated = state.adminAuthenticated;
  state.adminAuthenticated = false;
  adminBaselineCaptured = false;
  knownAdminOrderStates.clear();
  recentAlertOrderIds.clear();
  dismissAdminAlert();
  if (!wasAuthenticated) return;
  closeAdminDashboardModal();
  showToast('Sesi admin berakhir atau tidak sah. Silakan login kembali.');
}

onAdminLogout(() => {
  handleAdminSessionExpired();
});

export function logoutAdminSession() {
  state.adminAuthenticated = false;
  adminBaselineCaptured = false;
  knownAdminOrderStates.clear();
  recentAlertOrderIds.clear();
  dismissAdminAlert();
  setInventoryAdminToken('');
  try { localStorage.removeItem(STORAGE_KEY_ADMIN_SESSION); } catch {}
  closeAdminDashboardModal();
  openAdminLoginModal();
  showToast('Sesi admin ditutup.');
}

let adminOrdersSyncState = 'idle';

function setAdminOrdersError(message = '') {
  const banner = document.getElementById('admin-orders-error-banner');
  if (!banner) return;
  if (!message) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }
  banner.hidden = false;
  banner.innerHTML = `
    <div>
      <strong>Gagal menyinkronkan pesanan server:</strong>
      <span>${escapeHTML(message)}</span>
    </div>
    <button type="button" class="btn-secondary btn-admin-sm" onclick="window.retryAdminOrdersSync()">Coba Lagi</button>
  `;
}

export async function retryAdminOrdersSync() {
  adminOrdersSyncState = 'loading';
  const syncStatus = document.getElementById('admin-live-sync');
  if (syncStatus) syncStatus.textContent = 'Menyinkronkan ulang pesanan server...';
  setAdminOrdersError('');
  try {
    await listInventoryOrders();
    adminOrdersSyncState = 'ready';
    refreshAdminDashboard();
  } catch (error) {
    adminOrdersSyncState = 'error';
    if (syncStatus) syncStatus.textContent = 'Gagal sinkronisasi server · data lokal ditampilkan';
    setAdminOrdersError(formatInventoryError(error));
  }
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
    adminOrdersSyncState = 'loading';
    setAdminOrdersError('');
    refreshAdminDashboard();
    listInventoryOrders()
      .then(() => {
        adminOrdersSyncState = 'ready';
        setAdminOrdersError('');
        refreshAdminDashboard();
      })
      .catch((error) => {
        adminOrdersSyncState = 'error';
        const syncStatus = document.getElementById('admin-live-sync');
        if (syncStatus) syncStatus.textContent = 'Gagal sinkronisasi server · data lokal ditampilkan';
        setAdminOrdersError(formatInventoryError(error));
      });
    checkWebhookStatus().catch(() => {});
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
  if (sectionName === 'payments') {
    checkWebhookStatus().catch(() => {});
  }
  refreshAdminDashboard();
}

const knownAdminOrderStates = new Map();
const recentAlertOrderIds = new Set();
let adminBaselineCaptured = false;
let adminWebhookStatus = { configured: null, endpoint: '/api/qris-webhook', recentEvents: [] };

function describeWebhookEvent(ev) {
  const timeStr = ev?.at ? new Date(ev.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
  const amt = ev?.amount ? `Rp ${Number(ev.amount).toLocaleString('id-ID')}` : '';
  if (ev?.status === 200 || ev?.code === 'CONFIRMED') {
    return `${timeStr} · OK (Lunas): ${escapeHTML(ev.invoice || ev.orderId || '')} ${amt}`.trim();
  }
  if (ev?.code === 'UNAUTHORIZED') {
    return `${timeStr} · Gagal 401: Header X-Webhook-Secret / Bearer di HP tidak cocok dengan QRIS_WEBHOOK_SECRET Vercel.`;
  }
  if (ev?.code === 'INVALID_REQUEST') {
    return `${timeStr} · Gagal 400: Format isi Body bukan JSON/teks valid (pakai Tipe konten text/plain).`;
  }
  if (ev?.code === 'AMOUNT_NOT_FOUND') {
    return `${timeStr} · Gagal 400: Nominal Rp tidak ditemukan dari teks (${escapeHTML(ev.snippet || '-')}).`;
  }
  if (ev?.code === 'ORDER_NOT_FOUND') {
    return `${timeStr} · 404: Nominal terbaca ${amt || '-'}, tetapi tidak ada pesanan QRIS aktif dengan nominal tepat itu.`;
  }
  if (ev?.code === 'AMBIGUOUS_AMOUNT') {
    return `${timeStr} · 409: Ada lebih dari 1 pesanan dengan nominal ${amt}. Aktifkan Kode Unik 3 digit.`;
  }
  return `${timeStr} · HTTP ${ev?.status || '?'} (${escapeHTML(ev?.code || 'ERR')}) ${amt}`;
}

function renderWebhookStatusBadge() {
  const badge = document.getElementById('admin-webhook-status-badge');
  if (badge) {
    if (adminWebhookStatus.configured === true) {
      badge.className = 'status-badge-step done';
      badge.textContent = 'Webhook aktif (QRIS_WEBHOOK_SECRET terpasang)';
    } else if (adminWebhookStatus.configured === false) {
      badge.className = 'status-badge-step pending';
      badge.textContent = 'Belum terpasang (isi QRIS_WEBHOOK_SECRET di server)';
    } else {
      badge.className = 'status-badge-step muted';
      badge.textContent = 'Memeriksa status webhook server...';
    }
  }
  const overviewWebhook = document.getElementById('admin-overview-webhook');
  if (overviewWebhook) {
    if (adminWebhookStatus.configured === true) {
      overviewWebhook.textContent = 'Webhook aktif (QRIS_WEBHOOK_SECRET terpasang)';
    } else if (adminWebhookStatus.configured === false) {
      overviewWebhook.textContent = 'Konfirmasi manual / pasang QRIS_WEBHOOK_SECRET';
    } else {
      overviewWebhook.textContent = 'Memeriksa status webhook server...';
    }
  }
  const logBox = document.getElementById('admin-webhook-activity-list');
  if (logBox) {
    const events = Array.isArray(adminWebhookStatus.recentEvents) ? adminWebhookStatus.recentEvents : [];
    if (events.length === 0) {
      logBox.innerHTML = '<strong>Log Webhook Terakhir:</strong> Belum ada kiriman POST dari HP Android/MacroDroid yang sampai ke server.';
    } else {
      logBox.innerHTML = `<strong style="display:block; margin-bottom:4px; color:var(--ink-primary);">Log Webhook Terakhir (${events.length}):</strong>`
        + events.slice(0, 5).map((ev) => {
          const isOk = ev.status === 200 || ev.code === 'CONFIRMED';
          return `<div style="padding:2px 0; color:${isOk ? 'var(--status-success)' : 'var(--status-danger, #B91C1C)'};">${describeWebhookEvent(ev)}</div>`;
        }).join('');
    }
  }
}

export async function checkWebhookStatus({ manual = false } = {}) {
  if (typeof fetch !== 'function') return adminWebhookStatus;
  try {
    const res = await fetch('/api/qris-webhook', {
      cache: 'no-store',
      headers: hasInventoryAdminToken() ? inventoryAdminHeaders() : {}
    });
    if (!res.ok) return adminWebhookStatus;
    const data = await res.json();
    adminWebhookStatus = {
      configured: Boolean(data?.configured),
      endpoint: data?.endpoint || '/api/qris-webhook',
      recentEvents: Array.isArray(data?.recentEvents) ? data.recentEvents : []
    };
    renderWebhookStatusBadge();
    if (manual) showToast('Log webhook server diperbarui.');
  } catch {}
  return adminWebhookStatus;
}

export async function toggleUniqueCodeSetting(enabled) {
  const toggleEl = document.getElementById('admin-unique-code-toggle');
  if (toggleEl) toggleEl.disabled = true;
  try {
    await saveSharedSettings((s) => ({
      ...s,
      qris: { ...s.qris, uniqueCodeEnabled: Boolean(enabled) }
    }), { type: 'qris' });
    renderAdminPaymentsSection({ force: true });
    showToast(enabled
      ? 'Kode unik 3 digit diaktifkan untuk checkout QRIS.'
      : 'Kode unik checkout QRIS dinonaktifkan.');
  } catch (error) {
    if (toggleEl) toggleEl.checked = Boolean(getSettings().qris?.uniqueCodeEnabled);
    showToast(error?.message || 'Gagal menyimpan pengaturan kode unik.');
  } finally {
    if (toggleEl) toggleEl.disabled = false;
  }
}

export function dismissAdminAlert() {
  recentAlertOrderIds.clear();
  const banner = document.getElementById('admin-live-alert-banner');
  if (banner) {
    banner.hidden = true;
    banner.className = 'admin-live-alert';
    banner.innerHTML = '';
  }
  renderAdminOrderTable();
}

export function openOrdersFromAlert() {
  switchAdminSection('orders');
}

function renderAdminLiveAlert(type, order, extraCount = 0) {
  const banner = document.getElementById('admin-live-alert-banner');
  if (!banner || !order) return;
  const isPaid = type === 'paid';
  const suffix = extraCount > 0 ? ` (+${extraCount} lainnya)` : '';
  const sourceLabel = order.payment?.confirmedBy === 'gopay_merchant_webhook' ? 'otomatis via GoPay Merchant' : 'terkonfirmasi';
  const title = isPaid
    ? `Pembayaran QRIS masuk (${sourceLabel})`
    : 'Pesanan baru masuk';
  banner.className = isPaid ? 'admin-live-alert is-paid' : 'admin-live-alert';
  banner.hidden = false;
  banner.innerHTML = `
    <div>
      <strong>${escapeHTML(title)}:</strong>
      <span>${escapeHTML(order.invoice)} &middot; ${escapeHTML(order.customer?.name || 'Pelanggan')} &middot; <strong>${formatIDR(order.totals?.total || 0)}</strong>${escapeHTML(suffix)}</span>
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button type="button" class="btn-primary btn-admin-sm" onclick="window.openOrdersFromAlert()">Lihat Pesanan</button>
      <button type="button" class="btn-secondary btn-admin-sm" onclick="window.dismissAdminAlert()">Tutup</button>
    </div>
  `;
}

function syncAdminOrderAlerts(orders) {
  const navBadge = document.getElementById('admin-orders-nav-badge');
  const actionableCount = orders.filter((o) => [STATUS.AWAITING, STATUS.PAID, STATUS.PROCESSING].includes(o.status)).length;
  if (navBadge) {
    navBadge.textContent = String(actionableCount);
    navBadge.hidden = actionableCount === 0;
  }

  if (!state.adminAuthenticated) return;

  if (!adminBaselineCaptured) {
    orders.forEach((o) => knownAdminOrderStates.set(o.id, o.status));
    adminBaselineCaptured = true;
    return;
  }

  const freshOrders = [];
  const freshPaidOrders = [];
  for (const o of orders) {
    const prevStatus = knownAdminOrderStates.get(o.id);
    if (prevStatus === undefined) {
      if (isOpenStatus(o.status)) freshOrders.push(o);
    } else if (prevStatus === STATUS.AWAITING && o.status === STATUS.PAID && o.payment?.confirmedBy !== 'admin') {
      freshPaidOrders.push(o);
    }
    knownAdminOrderStates.set(o.id, o.status);
  }

  if (freshPaidOrders.length > 0) {
    freshPaidOrders.forEach((o) => recentAlertOrderIds.add(o.id));
    renderAdminLiveAlert('paid', freshPaidOrders[0], freshPaidOrders.length - 1);
    triggerPaymentAlert(freshPaidOrders[0]);
  } else if (freshOrders.length > 0) {
    freshOrders.forEach((o) => recentAlertOrderIds.add(o.id));
    renderAdminLiveAlert('incoming', freshOrders[0], freshOrders.length - 1);
    sfx.playOrderAlert();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const first = freshOrders[0];
        new Notification('Pesanan baru masuk', {
          body: `${first.invoice} - ${first.customer?.name || 'Pelanggan'} (${formatIDR(first.totals?.total || 0)})`,
          icon: './assets/notification-icon.svg',
          tag: `new-${first.invoice}`
        });
      } catch {}
    }
  }
}

const storefrontBaselines = { availability: null, merchantWhatsApp: null, shipping: null };
const storefrontDirtyDomains = { availability: false, merchantWhatsApp: false, shipping: false };

function readAvailabilityDraft() {
  return [
    document.getElementById('admin-storefront-hours')?.value,
    document.getElementById('admin-storefront-is-open')?.checked
  ];
}

function readMerchantWhatsAppDraft() {
  return document.getElementById('admin-storefront-whatsapp')?.value;
}

function readShippingDraft() {
  return [
    Boolean(document.getElementById('admin-storefront-shipping-enabled')?.checked),
    Boolean(document.getElementById('admin-storefront-pickup-enabled')?.checked)
  ];
}

export function refreshAdminDashboard() {
  const orders = getAdminOrders();
  const products = getProducts();
  const settings = getSettings();
  syncAdminOrderAlerts(orders);

  const settledOrders = orders.filter((o) => isPaidStatus(o.status));
  const settledCount = settledOrders.length;
  const totalOmzet = settledOrders.reduce((sum, o) => sum + Number(o.totals?.total || 0), 0);
  const totalOrders = orders.length;
  const aov = settledCount > 0 ? Math.round(totalOmzet / settledCount) : 0;
  const needsAction = orders.filter((o) => o.status === STATUS.PAID || o.status === STATUS.PROCESSING).length;
  const activeOrders = orders.filter((o) => isOpenStatus(o.status)).length;
  const readyCount = products.filter((p) => isPurchasable(p)).length;
  const unavailableCount = Math.max(0, products.length - readyCount);

  const omzetEl = document.getElementById('admin-metric-omzet');
  const ordersEl = document.getElementById('admin-metric-orders');
  const aovEl = document.getElementById('admin-metric-aov');
  const settledEl = document.getElementById('admin-metric-settled');
  const countEl = document.getElementById('admin-orders-count');
  const needsActionEl = document.getElementById('admin-needs-action');
  const activeOrdersEl = document.getElementById('admin-active-orders');
  const overviewOrders = document.getElementById('admin-overview-orders');
  const overviewProducts = document.getElementById('admin-overview-products');
  const overviewQueue = document.getElementById('admin-overview-queue');
  const overviewQris = document.getElementById('admin-overview-qris');
  const storefrontCatalogStatus = document.getElementById('admin-storefront-catalog-status');
  const hoursInput = document.getElementById('admin-storefront-hours');
  const openInput = document.getElementById('admin-storefront-is-open');
  const storefrontWa = document.getElementById('admin-storefront-whatsapp');
  const shippingEnabledInput = document.getElementById('admin-storefront-shipping-enabled');
  const pickupEnabledInput = document.getElementById('admin-storefront-pickup-enabled');
  const syncStatus = document.getElementById('admin-live-sync');

  if (omzetEl) omzetEl.textContent = formatIDR(totalOmzet);
  if (ordersEl) ordersEl.textContent = totalOrders;
  if (aovEl) aovEl.textContent = formatIDR(aov);
  if (settledEl) settledEl.textContent = settledCount;
  if (countEl) countEl.textContent = `${totalOrders} pesanan tercatat`;
  if (needsActionEl) needsActionEl.textContent = needsAction;
  if (activeOrdersEl) activeOrdersEl.textContent = activeOrders;
  if (overviewOrders) overviewOrders.textContent = `${totalOrders} pesanan (${activeOrders} aktif)`;
  if (overviewProducts) overviewProducts.textContent = `${products.length} produk (${readyCount} tersedia)`;
  if (overviewQueue) {
    const pendingQueue = orders.filter((o) => [STATUS.AWAITING, STATUS.PAID, STATUS.PROCESSING, STATUS.READY].includes(o.status));
    if (pendingQueue.length === 0) {
      overviewQueue.innerHTML = '<p class="admin-panel-muted">Semua pesanan aktif sudah selesai. Tidak ada antrean tertunda saat ini.</p>';
    } else {
      overviewQueue.innerHTML = pendingQueue.slice(0, 4).map((o) => `
        <div class="admin-queue-row">
          <div>
            <strong>${escapeHTML(o.invoice)} &middot; ${escapeHTML(o.customer?.name || 'Pelanggan')}</strong>
            <span>${formatIDR(o.totals?.total || 0)} &middot; ${escapeHTML(statusLabel(o.status, o))}</span>
          </div>
          <button type="button" class="btn-secondary btn-admin-sm" onclick="window.switchAdminSection('orders')">Proses</button>
        </div>
      `).join('');
    }
  }
  if (overviewQris) {
    const qrisMeta = describeQRIS(settings.qris?.payload || DEMO_STATIC_QRIS);
    overviewQris.textContent = `${qrisMeta.merchantName || settings.store.name} (${qrisMeta.acquirer || 'QRIS Dinamis'})`;
  }
  if (storefrontCatalogStatus) {
    storefrontCatalogStatus.textContent = `${products.length} produk terdaftar (${readyCount} siap dipesan, ${unavailableCount} habis/nonaktif).`;
  }

  if (storefrontBaselines.availability !== null && JSON.stringify(readAvailabilityDraft()) !== JSON.stringify(storefrontBaselines.availability)) {
    storefrontDirtyDomains.availability = true;
  }
  if (!storefrontDirtyDomains.availability) {
    if (hoursInput) hoursInput.value = settings.store.hours || '';
    if (openInput) openInput.checked = settings.store.isOpen !== false;
    storefrontBaselines.availability = readAvailabilityDraft();
  }

  if (storefrontBaselines.merchantWhatsApp !== null && readMerchantWhatsAppDraft() !== storefrontBaselines.merchantWhatsApp) {
    storefrontDirtyDomains.merchantWhatsApp = true;
  }
  if (!storefrontDirtyDomains.merchantWhatsApp) {
    if (storefrontWa) storefrontWa.value = settings.store.whatsapp || '';
    storefrontBaselines.merchantWhatsApp = readMerchantWhatsAppDraft();
  }

  if (storefrontBaselines.shipping !== null && JSON.stringify(readShippingDraft()) !== JSON.stringify(storefrontBaselines.shipping)) {
    storefrontDirtyDomains.shipping = true;
  }
  if (!storefrontDirtyDomains.shipping) {
    if (shippingEnabledInput) shippingEnabledInput.checked = settings.store.shippingEnabled !== false;
    if (pickupEnabledInput) pickupEnabledInput.checked = settings.store.pickupEnabled !== false;
    storefrontBaselines.shipping = readShippingDraft();
  }
  if (syncStatus) {
    if (adminOrdersSyncState === 'loading') {
      syncStatus.textContent = 'Menyinkronkan pesanan server...';
    } else if (adminOrdersSyncState === 'error') {
      syncStatus.textContent = 'Gagal sinkronisasi server · data lokal ditampilkan';
    } else {
      syncStatus.textContent = 'Sinkronisasi aktif · server diperiksa tiap 2 detik saat dasbor terbuka';
    }
  }

  renderWebhookStatusBadge();
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
  const tableWrapEl = document.getElementById('admin-orders-table-wrap');
  if (!tbody) return;

  const orders = getAdminOrders();
  if (emptyStateEl) emptyStateEl.hidden = orders.length !== 0;
  if (tableWrapEl) tableWrapEl.hidden = orders.length === 0;

  if (orders.length === 0) {
    tbody.innerHTML = '';
    return;
  }

  const desc = describeQRIS(getSettings().qris.payload || DEMO_STATIC_QRIS);
  tbody.innerHTML = orders.map((o) => {
    const itemsSummary = (o.items || []).map((i) => `${escapeHTML(i.name)} (x${i.qty})`).join(', ');
    const isAwaiting = o.status === STATUS.AWAITING;
    const isComplete = o.status === STATUS.COMPLETED || o.status === STATUS.CANCELLED || o.status === STATUS.EXPIRED;
    const isNewAlert = recentAlertOrderIds.has(o.id);

    let actionBtn = '';
    if (isAwaiting) {
      actionBtn = `<button type="button" class="btn-admin-action" style="background:var(--brand-forest); color:#fff;" data-action="admin-confirm-payment" data-order-id="${escapeHTML(o.id)}">Konfirmasi Lunas</button>`;
    } else if (!isComplete) {
      actionBtn = `<button type="button" class="btn-admin-action" data-action="admin-advance-order" data-invoice="${escapeHTML(o.invoice)}">Majukan status</button>`;
    } else if (o.status === STATUS.CANCELLED) {
      actionBtn = `<span style="font-size:0.78rem; color:var(--ink-secondary);">Dibatalkan</span>`;
    } else if (o.status === STATUS.EXPIRED) {
      actionBtn = `<span style="font-size:0.78rem; color:var(--ink-secondary);">Kedaluwarsa</span>`;
    } else {
      actionBtn = `<span style="font-size:0.78rem; color:var(--ink-secondary);">Selesai</span>`;
    }
    if (o.status !== STATUS.CANCELLED) {
      actionBtn += `<button type="button" class="btn-admin-action" data-action="admin-cancel-order" data-order-id="${escapeHTML(o.id)}">Batalkan</button>`;
    }

    return `
      <tr class="admin-order-row${isNewAlert ? ' is-new' : ''}" data-admin-row="${escapeHTML(o.invoice)}">
        <td data-label="No. Invoice">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <strong style="font-family: var(--font-mono);">${escapeHTML(o.invoice)}</strong>
            ${isNewAlert ? '<span class="admin-badge-new">Baru</span>' : ''}
          </div>
        </td>
        <td data-label="Waktu" style="white-space: nowrap; font-size: 0.78rem;">${formatDateTime(o.createdAt)}</td>
        <td data-label="Pemesan"><strong>${escapeHTML(o.customer?.name || 'Pelanggan')}</strong><br><span style="font-size:0.75rem; color:var(--ink-secondary);">${escapeHTML(o.customer?.phone || '-')}</span></td>
        <td data-label="Item Pesanan" class="admin-orders-items">${itemsSummary}</td>
        <td data-label="Metode" style="font-size: 0.78rem;">${escapeHTML(paymentMethodLabel(o, desc))}</td>
        <td data-label="Total Tagihan" style="font-weight: 700; font-family: var(--font-mono); color: var(--brand-forest); font-variant-numeric: tabular-nums;">${formatIDR(o.totals?.total || 0)}</td>
        <td data-label="Status"><span class="status-badge-step ${statusTone(o.status)}">${escapeHTML(statusLabel(o.status, o))}</span></td>
        <td data-label="Aksi"><div class="admin-table-actions">${actionBtn}</div></td>
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
    if (state.activeCheckoutOrderId === orderId) handlePaymentCancelled(res.order);
    refreshAdminDashboard();
    renderCatalog();
    updateCartUI();
    updateOrderTrackerDockUI();
    showToast(`Pesanan ${res.order.invoice} dibatalkan.`);
  } else {
    const errText = formatInventoryError({ code: res.code, message: res.reason });
    showToast(`Gagal membatalkan pesanan: ${errText}`);
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

  tbody.innerHTML = products.map((p) => {
    const usesCourier = productRequiresShipping(p);
    return `
    <tr>
      <td data-label="Produk">
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${escapeHTML(p.image)}" width="36" height="36" style="border-radius:4px; object-fit:cover;" alt="" />
          <div>
            <strong>${escapeHTML(p.name)}</strong>
            <span style="display:block; font-size:0.75rem; color:var(--ink-secondary);">${formatProductStockLabel(p)} &middot; ${usesCourier ? 'Kurir aktif' : 'Tanpa kurir'}</span>
          </div>
        </div>
      </td>
      <td data-label="Kategori" style="font-size:0.8rem;">${escapeHTML(getCategoryLabel(p.category))}</td>
      <td data-label="Harga" style="font-family:var(--font-mono); font-weight:700; font-variant-numeric: tabular-nums;">${formatIDR(p.price)}</td>
      <td data-label="Status Stok">
        <span class="status-badge-step ${p.isAvailable !== false ? 'done' : 'muted'}">
          ${p.isAvailable !== false ? 'Tersedia' : 'Habis'}
        </span>
      </td>
      <td data-label="Aksi">
        <div class="admin-table-actions">
          <button type="button" class="btn-secondary btn-admin-sm" data-action="admin-adjust-stock" data-product-id="${escapeHTML(p.id)}">Atur stok</button>
          <button type="button" class="btn-secondary btn-admin-sm" data-action="admin-edit-product" data-product-id="${escapeHTML(p.id)}">Edit</button>
          <button type="button" class="btn-secondary btn-admin-sm" data-action="admin-toggle-product" data-product-id="${escapeHTML(p.id)}">
            ${p.isAvailable !== false ? 'Set Habis' : 'Set Ready'}
          </button>
          <button type="button" class="btn-secondary btn-admin-sm" style="color:var(--status-danger);" data-action="admin-delete-product" data-product-id="${escapeHTML(p.id)}">Hapus</button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

export function syncProductCategoryOptions(preferredValue = '') {
  const select = document.getElementById('new-prod-category');
  if (!select || typeof document?.createElement !== 'function' || typeof select.appendChild !== 'function') return;
  const previous = preferredValue || select.value || 'makanan';
  const categories = getAllCategories(getCatalogProducts(), getSettings().store?.categories);
  select.innerHTML = '';
  categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.label;
    select.appendChild(opt);
  });
  if (categories.some((c) => c.id === previous)) {
    select.value = previous;
  } else if (categories.length) {
    select.value = categories[0].id;
  }
}

export function toggleCustomCategoryInput(forceOpen) {
  const box = document.getElementById('admin-new-category-box');
  const input = document.getElementById('admin-new-category-name');
  if (!box) return;
  const nextVisible = typeof forceOpen === 'boolean' ? forceOpen : box.hidden;
  box.hidden = !nextVisible;
  if (nextVisible) {
    if (input) { input.value = ''; input.focus?.(); }
  } else if (input) {
    input.value = '';
  }
}

export async function addCustomProductCategory() {
  const input = document.getElementById('admin-new-category-name');
  const label = String(input?.value ?? '').trim();
  if (label.length < 2 || label.length > 36) {
    showToast('Nama kategori baru harus 2 hingga 36 karakter.');
    input?.focus?.();
    return;
  }
  const id = normalizeCategorySlug(label);
  if (!id || id === 'semua') {
    showToast('Gunakan huruf atau angka untuk nama kategori.');
    input?.focus?.();
    return;
  }
  const settings = getSettings();
  const existing = getAllCategories(getCatalogProducts(), settings.store?.categories);
  if (existing.some((c) => c.id === id)) {
    syncProductCategoryOptions(id);
    toggleCustomCategoryInput(false);
    showToast(`Kategori "${existing.find((c) => c.id === id).label}" dipilih.`);
    return;
  }
  try {
    const nextCustom = setCustomCategories([...(settings.store?.categories || []), { id, label }]);
    await saveSharedSettings((s) => ({ ...s, store: { ...s.store, categories: nextCustom } }));
    syncProductCategoryOptions(id);
    renderCategoryTabs();
    toggleCustomCategoryInput(false);
    showToast(`Kategori "${label}" berhasil ditambahkan.`);
  } catch (error) {
    showToast(error.message);
  }
}

function resetProductFormFields() {
  for (const id of ['new-prod-name', 'new-prod-price', 'new-prod-tag', 'new-prod-image', 'new-prod-desc', 'new-prod-story']) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  }
  syncProductCategoryOptions('makanan');
  toggleCustomCategoryInput(false);
  const shipCheckbox = document.getElementById('new-prod-requires-shipping');
  if (shipCheckbox) shipCheckbox.checked = true;
}

export function toggleAddProductForm(forceOpen) {
  const formBox = document.getElementById('admin-product-form-box');
  if (!formBox) return;
  const wasEditing = Boolean(state.editingProductId);
  const nextVisible = typeof forceOpen === 'boolean'
    ? forceOpen
    : formBox.style.display === 'none';
  formBox.style.display = nextVisible ? 'flex' : 'none';
  if (nextVisible) syncProductCategoryOptions();
  if (!nextVisible || forceOpen === undefined) {
    state.editingProductId = null;
    if (wasEditing || (forceOpen === undefined && nextVisible)) {
      resetProductFormFields();
    }
    const title = document.getElementById('admin-product-form-title');
    if (title) title.textContent = 'Tambah Produk Baru ke Toko';
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
  const storyInput = document.getElementById('new-prod-story');
  const shipCheckbox = document.getElementById('new-prod-requires-shipping');
  const title = document.getElementById('admin-product-form-title');
  const label = document.getElementById('admin-product-submit-label');

  syncProductCategoryOptions(p.category || 'makanan');
  if (nameInput) nameInput.value = p.name || '';
  if (catSelect) catSelect.value = normalizeCategorySlug(p.category) || 'makanan';
  if (priceInput) priceInput.value = p.price || '';
  if (tagInput) tagInput.value = p.tags && p.tags[0] ? p.tags[0] : '';
  if (imgInput) imgInput.value = p.image || '';
  if (descInput) descInput.value = p.desc || '';
  if (storyInput) storyInput.value = p.story || '';
  if (shipCheckbox) shipCheckbox.checked = productRequiresShipping(p);
  if (title) title.textContent = `Edit Produk: ${p.name}`;
  if (label) label.textContent = 'Simpan Perubahan Produk';
}

export async function submitNewProduct(e) {
  if (e && e.preventDefault) e.preventDefault();
  sfx.playClick();

  const name = String(document.getElementById('new-prod-name')?.value ?? '').trim();
  const category = normalizeCategorySlug(document.getElementById('new-prod-category')?.value || 'makanan') || 'makanan';
  const rawPrice = Number(document.getElementById('new-prod-price')?.value);
  const price = rawPrice;
  const tag = String(document.getElementById('new-prod-tag')?.value ?? '').trim();
  let image = String(document.getElementById('new-prod-image')?.value ?? '').trim();
  const desc = String(document.getElementById('new-prod-desc')?.value ?? '').trim() || 'Koleksi pilihan toko.';
  const story = String(document.getElementById('new-prod-story')?.value ?? '').trim();
  const shipCheckbox = document.getElementById('new-prod-requires-shipping');
  const requiresShipping = shipCheckbox ? Boolean(shipCheckbox.checked) : category !== 'digital';

  if (!name) {
    showToast('Mohon isi nama produk terlebih dahulu.');
    return;
  }
  if (!Number.isSafeInteger(price) || price < 1 || price > 1_000_000_000) {
    showToast('Harga produk harus bilangan bulat antara Rp 1 hingga Rp 1.000.000.000.');
    return;
  }
  if (image && !/^(https?:\/\/|\.\/|\/)/i.test(image)) {
    showToast('URL foto produk harus diawali http://, https://, atau path lokal.');
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
      const invalidVariant = (target.variants || []).find((v) => !Number.isSafeInteger(v.delta) || price + v.delta < 0);
      if (invalidVariant) {
        showToast(`Harga baru membuat varian "${invalidVariant.label}" bernilai negatif.`);
        return;
      }
      Object.assign(target, {
        name,
        category,
        requiresShipping,
        price,
        tags: tag ? [tag] : target.tags,
        desc,
        story: story || target.story || desc,
        image
      });
      await publishProducts(list, { type: 'edit', id: target.id });
      showToast(`Produk "${name}" berhasil diperbarui.`);
    }
  } else {
    const newProd = {
      id: `prod-custom-${Date.now()}`,
      name,
      category,
      requiresShipping,
      price,
      tags: tag ? [tag] : ['Baru'],
      desc,
      story: story || desc,
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
  renderCategoryTabs();
  refreshAdminDashboard();
  renderCatalog();
  updateCartUI();
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
  const uniqueCodeEnabled = Boolean(settings.qris.uniqueCodeEnabled);
  const webhookUrl = `${typeof window !== 'undefined' && window.location?.origin ? window.location.origin : ''}/api/qris-webhook`;
  const nextSignature = JSON.stringify({
    payload: activePayload,
    history: (settings.qris.history || []).map((h) => h.payload),
    storeName: settings.store.name || '',
    uniqueCodeEnabled
  });
  if (!force && section.innerHTML && section.dataset?.qrisSignature === nextSignature) return;

  const prevScanStatus = snapshotQrisScanStatus();
  const desc = describeQRIS(activePayload);
  const val = validateQRIS(activePayload);

  section.innerHTML = `
    <div class="admin-section-heading">
      <div>
        <h3 id="admin-payments-title">Kelola QRIS Toko (Upload Foto / Statis ke Dinamis)</h3>
        <p>Unggah foto atau poster QRIS merchant Anda (GoPay Merchant, BCA, Mandiri, ShopeePay, DANA, dsb). Sistem otomatis memindai QR, memverifikasi checksum, dan mengubahnya menjadi QRIS Dinamis yang mengunci nominal tagihan otomatis di scanner pembeli.</p>
      </div>
    </div>

    <div class="admin-settings-grid">
      <!-- Active QRIS Status Card -->
      <section class="admin-settings-card">
        <h4 style="margin-bottom:4px;">${escapeHTML(desc.merchantName || settings.store.name)}</h4>
        <div style="font-family:var(--font-mono); font-size:0.78rem; color:var(--ink-secondary); margin:6px 0 14px; line-height:1.6;">
          NMID: <strong>${escapeHTML(desc.nmid || 'ID1026533086801')}</strong><br>
          Kota: <strong>${escapeHTML(desc.city || 'JAKARTA BARAT')}</strong><br>
          Acquirer: <strong>${escapeHTML(desc.acquirer || 'QRIS NASIONAL')}</strong><br>
          Status Checksum: <span style="color:${val.ok ? 'var(--status-success)' : 'var(--status-danger)'}; font-weight:700;">${val.ok ? 'Valid (CRC OK)' : 'Rusak'}</span>
        </div>
        <div style="background:#ffffff; padding:12px; border-radius:8px; display:inline-block; border:1px solid var(--border-hairline); box-shadow:0 2px 8px rgba(0,0,0,0.06); text-align:center;">
          ${renderQRCodeSVG(activePayload, { label: 'Preview QRIS Toko', size: 180 })}
          <span style="display:block; font-size:0.75rem; color:var(--ink-secondary); margin-top:8px;">Kode QRIS Toko Siap Digunakan</span>
        </div>
        <div style="margin-top:12px; font-size:0.78rem; color:var(--brand-forest); background:rgba(46,69,50,0.08); padding:8px 12px; border-radius:6px; line-height:1.4;">
          <strong>QRIS dinamis aktif:</strong> Nominal tagihan disertakan dalam kode QRIS saat checkout.
        </div>
      </section>

      <!-- Update QRIS Card -->
      <section class="admin-settings-card">
        <h4>1. Upload Foto / Poster QRIS Baru</h4>
        <p style="font-size:0.8rem; color:var(--ink-secondary); margin-bottom:12px;">
          Punya poster atau screenshot QRIS dari GoPay Merchant / m-Banking? Upload langsung fotonya di sini:
        </p>

        <!-- Drag & Drop Zone -->
        <div id="admin-qris-dropzone" class="qris-upload-dropzone" ondragover="window.handleQRISDragOver(event)" ondragleave="window.handleQRISDragLeave(event)" ondrop="window.handleQRISDrop(event)">
          <div class="upload-icon-circle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <strong style="display:block; font-size:0.88rem; margin-top:8px; color:var(--ink-primary);">Klik atau Seret Foto QRIS ke Sini</strong>
          <p style="font-size:0.78rem; color:var(--ink-secondary); margin:4px 0 10px;">Format: PNG, JPG, JPEG, atau WebP</p>
          <button type="button" id="admin-qris-upload-btn" class="btn-primary" onclick="window.triggerQRISUpload()">Pilih File Gambar</button>
          <input type="file" id="admin-qris-file-input" aria-label="Foto QRIS" accept="image/*" hidden onchange="window.handleQRISImageUpload(event)" />
        </div>
        <div id="admin-qris-scan-status" role="status" style="display:none; padding:8px 12px; border-radius:6px; font-size:0.8rem; margin-bottom:12px;"></div>

        <!-- Manual String Option -->
        <div style="border-top:1px dashed var(--border-hairline); padding-top:12px; margin-top:8px;">
          <h4 style="font-size:0.88rem;">2. Atau Tempel String EMVCo QRIS Manual</h4>
          <p style="font-size:0.78rem; color:var(--ink-secondary); margin-bottom:6px;">Jika Anda memiliki salinan teks string QRIS (diawali <code>000201...</code>):</p>
          <textarea id="admin-custom-qris-input" class="config-textarea" rows="3" placeholder="000201010211...">${escapeHTML(activePayload)}</textarea>
          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <button type="button" id="admin-apply-qris-btn" class="btn-primary btn-admin-sm" onclick="window.adminApplyCustomQRIS()">Terapkan String QRIS</button>
            <button type="button" id="admin-reset-qris-btn" class="btn-secondary btn-admin-sm" onclick="window.adminResetQRISDefault()">Gunakan QRIS Demo</button>
          </div>
        </div>

        ${settings.qris.history && settings.qris.history.length > 0 ? `
          <div style="margin-top:14px; border-top:1px dashed var(--border-hairline); padding-top:8px;">
            <small style="color:var(--ink-secondary); display:block; margin-bottom:6px; font-weight:600;">Riwayat QRIS Sebelumnya:</small>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              ${settings.qris.history.map((h, idx) => `
                <button type="button" class="btn-secondary btn-admin-sm" data-action="admin-restore-qris" data-qris-payload="${escapeHTML(h.payload)}">
                  Pulihkan #${idx + 1} (${formatDateTime(h.replacedAt)})
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </section>

      <!-- GoPay Merchant Webhook Auto-Verification Card -->
      <section class="admin-settings-card webhook-guide-card" style="grid-column: 1 / -1;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <h4 style="margin:0;">3. Konfirmasi Lunas Otomatis dari Notifikasi HP Merchant</h4>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span id="admin-webhook-status-badge" class="status-badge-step muted">Memeriksa status webhook server...</span>
            <button type="button" class="btn-secondary btn-admin-sm" onclick="window.checkWebhookStatus({ manual: true })">Cek Log Webhook</button>
          </div>
        </div>
        <p style="font-size:0.8rem; color:var(--ink-secondary); line-height:1.5; margin:0;">
          Tetap gunakan QRIS GoPay Merchant Anda sendiri tanpa penyedia gateway lain. Saat HP kasir menerima notifikasi dana masuk dari <strong>GoPay Merchant</strong>, aplikasi penerus notifikasi (seperti MacroDroid di Android) mengirim nominal masuk ke endpoint aman di bawah ini agar pesanan langsung berstatus Lunas dan struk terbuka otomatis di HP pembeli.
        </p>

        <label class="webhook-toggle-row" for="admin-unique-code-toggle">
          <input type="checkbox" id="admin-unique-code-toggle" ${uniqueCodeEnabled ? 'checked' : ''} onchange="window.toggleUniqueCodeSetting(this.checked)" />
          <div>
            <strong style="display:block; font-size:0.84rem; color:var(--ink-primary);">Aktifkan kode unik 3 digit (Rp 101 sampai Rp 999)</strong>
            <span style="display:block; font-size:0.76rem; color:var(--ink-secondary); line-height:1.45;">
              Menambahkan angka unik ke total tagihan QRIS tiap pesanan aktif agar dua pembeli dengan nominal belanja sama tidak pernah tertukar saat diverifikasi oleh webhook GoPay Merchant.
            </span>
          </div>
        </label>

        <div id="admin-webhook-activity-list" style="font-size:0.76rem; color:var(--ink-secondary); background:var(--surface-cream, #FAF7F2); border:1px solid var(--border-hairline); border-radius:8px; padding:10px 12px;"></div>

        <div style="font-size:0.78rem; color:var(--ink-secondary); line-height:1.6;">
          <strong style="color:var(--ink-primary); display:block; margin-bottom:4px;">Langkah singkat di HP Android kasir:</strong>
          <div>1. Pasang env <code>QRIS_WEBHOOK_SECRET</code> di pengaturan proyek Vercel lalu redeploy.</div>
          <div>2. Di MacroDroid (Android), buat Pemicu: <em>Notifikasi Diterima</em> dari aplikasi <strong>GoPay Merchant</strong> (isi filter Berisi: <code>Rp</code>).</div>
          <div>3. Buat Tindakan: <em>Permintaan HTTP (POST)</em> ke URL:</div>
          <div class="webhook-code-box" style="margin:6px 0;">${escapeHTML(webhookUrl)}</div>
          <div>4. Di tab <em>Parameter header</em> tambah <code>X-Webhook-Secret: &lt;QRIS_WEBHOOK_SECRET&gt;</code>. Di tab <em>Badan konten</em>, pilih Tipe konten <code>text/plain</code> dan isi <code>[not_title] [notification]</code> (atau JSON <code>{"title":"[not_title]","text":"[notification]"}</code>). Jika HP kasir belum disambungkan, admin tetap dapat menekan <strong>Konfirmasi Lunas</strong> sekali ketuk di tab Pesanan.</div>
        </div>
      </section>
    </div>
  `;
  renderWebhookStatusBadge();
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

function setQrisButtonsBusy(busy, activeBtn = null, activeLabel = 'Menerapkan...') {
  const buttons = [
    document.getElementById('admin-qris-upload-btn'),
    document.getElementById('admin-apply-qris-btn'),
    document.getElementById('admin-reset-qris-btn'),
    ...Array.from(document.querySelectorAll?.('[data-action="admin-restore-qris"]') || [])
  ].filter(Boolean);
  for (const btn of buttons) {
    if (busy) {
      if (!btn.dataset.idleLabel) btn.dataset.idleLabel = btn.textContent || '';
      btn.disabled = true;
      btn.setAttribute?.('aria-busy', 'true');
      if (btn === activeBtn) btn.textContent = activeLabel;
    } else {
      btn.disabled = false;
      btn.removeAttribute?.('aria-busy');
      if (btn.dataset.idleLabel) btn.textContent = btn.dataset.idleLabel;
    }
  }
}

function setQrisScanBanner(tone, content, { textOnly = false } = {}) {
  const statusEl = document.getElementById('admin-qris-scan-status');
  if (!statusEl) return;
  const tones = {
    info: { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' },
    error: { background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5' },
    success: { background: 'var(--status-success-bg)', color: 'var(--status-success)', border: '1px solid #B7E4C7' }
  };
  const style = tones[tone] || tones.info;
  statusEl.style.display = 'block';
  statusEl.style.background = style.background;
  statusEl.style.color = style.color;
  statusEl.style.border = style.border;
  if (textOnly) statusEl.textContent = content;
  else statusEl.innerHTML = content;
}

async function applyQRISUpdate(val, { sourceBtn = null, activeLabel = 'Menerapkan...', statusHtml = '', toastMessage = 'QRIS baru berhasil diterapkan ke toko.' } = {}) {
  clearQrisScanStatus();
  setQrisButtonsBusy(true, sourceBtn, activeLabel);
  try {
    await replaceQRIS(val.payload, val.info || {});
    if (statusHtml) setQrisScanBanner('success', statusHtml);
    // Force-refresh payment panel right away even while focus stays inside #admin-section-payments.
    renderAdminPaymentsSection({ force: true });
    sfx.playSuccess();
    refreshAdminDashboard();
    showToast(toastMessage);
    return true;
  } catch (error) {
    showToast(error.message);
    return false;
  } finally {
    setQrisButtonsBusy(false);
  }
}

export function handleQRISImageUpload(event) {
  const file = event.target && event.target.files && event.target.files[0];
  if (event.target) event.target.value = '';
  if (file) {
    processQRISFile(file);
  }
}

export async function processQRISFile(file) {
  const uploadBtn = document.getElementById('admin-qris-upload-btn');
  setQrisScanBanner('info', `Sedang memindai gambar <strong>${escapeHTML(file.name)}</strong>...`);
  setQrisButtonsBusy(true, uploadBtn, 'Memindai...');
  sfx.playClick();
  await new Promise((resolve) => setTimeout(resolve, 0));

  try {
    const rawPayload = await scanQRISFromImageFile(file);
    if (!rawPayload) {
      setQrisScanBanner('error', 'Kode QR tidak terdeteksi dari foto ini. Pastikan foto QRIS jelas, tidak buram, dan tidak terpotong.');
      showToast('Gambar QRIS tidak dapat dideteksi.');
      return;
    }

    const val = validateQRIS(rawPayload);
    if (!val.ok) {
      setQrisScanBanner('error', `Kode QR terdeteksi namun struktur QRIS tidak valid: ${val.errors.join(', ')}`, { textOnly: true });
      showToast('QRIS tidak valid: ' + val.errors[0]);
      return;
    }

    setQrisScanBanner('info', `QRIS <strong>${escapeHTML(val.info?.merchantName || 'Toko')}</strong> valid (CRC OK). Menyimpan &amp; menerapkan ke toko...`);
    setQrisButtonsBusy(true, uploadBtn, 'Menyimpan...');
    await replaceQRIS(val.payload, val.info || {});
    setQrisScanBanner('success', `QRIS <strong>${escapeHTML(val.info?.merchantName || 'Toko')}</strong> valid (CRC OK) dan langsung aktif.`);
    // Force-refresh immediately because focus stays on the upload button inside #admin-section-payments.
    renderAdminPaymentsSection({ force: true });
    sfx.playSuccess();
    refreshAdminDashboard();
    showToast(`QRIS ${val.info.merchantName || 'Toko'} berhasil diperbarui.`);
  } catch (err) {
    console.error('QR decode error:', err);
    setQrisScanBanner('error', `Gagal memproses gambar: ${escapeHTML(err.message)}`);
    showToast('Gagal memproses gambar: ' + err.message);
  } finally {
    setQrisButtonsBusy(false);
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
  await applyQRISUpdate(val, {
    sourceBtn: document.getElementById('admin-apply-qris-btn'),
    activeLabel: 'Menerapkan...',
    statusHtml: `QRIS <strong>${escapeHTML(val.info?.merchantName || 'Toko')}</strong> berhasil diterapkan dan langsung aktif.`,
    toastMessage: 'QRIS baru berhasil diterapkan ke toko.'
  });
}

export async function adminRestoreQRIS(payload, triggerEl = null) {
  const val = validateQRIS(payload);
  if (!val.ok) return;
  await applyQRISUpdate(val, {
    sourceBtn: triggerEl,
    activeLabel: 'Memulihkan...',
    statusHtml: `QRIS riwayat <strong>${escapeHTML(val.info?.merchantName || 'Toko')}</strong> dipulihkan dan langsung aktif.`,
    toastMessage: 'QRIS riwayat berhasil dipulihkan.'
  });
}

export async function adminResetQRISDefault() {
  await applyQRISUpdate(
    { ok: true, payload: DEMO_STATIC_QRIS, info: { merchantName: 'Atelier Nusantara' } },
    {
      sourceBtn: document.getElementById('admin-reset-qris-btn'),
      activeLabel: 'Mereset...',
      statusHtml: 'QRIS demo default diaktifkan kembali.',
      toastMessage: 'QRIS di-reset ke default demo.'
    }
  );
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
    storefrontDirtyDomains.merchantWhatsApp = false;
    storefrontBaselines.merchantWhatsApp = null;
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
    storefrontDirtyDomains.availability = false;
    storefrontBaselines.availability = null;
    showToast('Ketersediaan toko berhasil disimpan.');
  } else if (key === 'shipping') {
    const shippingEnabled = Boolean(document.getElementById('admin-storefront-shipping-enabled')?.checked);
    const pickupEnabled = Boolean(document.getElementById('admin-storefront-pickup-enabled')?.checked);
    await saveSharedSettings((s) => ({ ...s, store: { ...s.store, shippingEnabled, pickupEnabled } }));
    storefrontDirtyDomains.shipping = false;
    storefrontBaselines.shipping = null;
    updateCartUI();
    showToast('Pengaturan kurir & pengambilan berhasil disimpan.');
  }
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

export function initEventBindings() {
  if (initEventBindings._bound) return;
  initEventBindings._bound = true;
  // Category tabs
  document.querySelectorAll('.category-tabs .tab-btn').forEach((btn) => bindCategoryTabButton(btn));

  // Auto-sync shipping checkbox default when selecting digital vs physical category for new products
  const newProdCatSelect = document.getElementById('new-prod-category');
  const newProdShipCheckbox = document.getElementById('new-prod-requires-shipping');
  if (newProdCatSelect && newProdShipCheckbox) {
    newProdCatSelect.addEventListener?.('change', () => {
      if (!state.editingProductId) {
        newProdShipCheckbox.checked = newProdCatSelect.value !== 'digital';
      }
    });
  }

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
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
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

  // Track per-card storefront drafts so saving or polling never clobbers the other card
  const markStorefrontDirtyByTarget = (target) => {
    const id = target?.id;
    if (id === 'admin-storefront-whatsapp') storefrontDirtyDomains.merchantWhatsApp = true;
    else if (id === 'admin-storefront-hours' || id === 'admin-storefront-is-open') storefrontDirtyDomains.availability = true;
  };
  document.addEventListener('input', (e) => markStorefrontDirtyByTarget(e?.target));
  document.addEventListener('change', (e) => markStorefrontDirtyByTarget(e?.target));

  // Delegated dynamic actions (safe from apostrophes/quotes in IDs, variant labels, or QR payloads)
  document.addEventListener('click', (e) => {
    const dropzone = e.target && typeof e.target.closest === 'function' ? e.target.closest('#admin-qris-dropzone') : null;
    if (dropzone && !e.target.closest('button, input')) {
      triggerQRISUpload();
      return;
    }
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
      adminRestoreQRIS(trigger.dataset.qrisPayload, trigger);
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

let realtimeSyncBound = false;
let expiredSweepTimer = null;
export function initRealtimeSync() {
  if (!realtimeSyncBound) {
    realtimeSyncBound = true;
    subscribe((change) => {
      if (change.domain === 'products') {
        renderCatalog();
        renderCategoryTabs();
        updateCartUI();
        if (state.adminAuthenticated) {
          syncProductCategoryOptions();
          renderAdminProductsTable();
        }
      } else if (change.domain === 'orders') {
        updateCartUI();
        updateOrderTrackerDockUI();
        if (state.adminAuthenticated) {
          if (change.remote && change.type !== 'admin-inventory') {
            listInventoryOrders().then(() => refreshAdminDashboard()).catch(() => {});
          } else {
            refreshAdminDashboard();
          }
        }
      } else if (change.domain === 'settings') {
        updateStorefrontStatus();
        renderCategoryTabs();
        updateCartUI();
        if ((change.type === 'qris' || change.type === 'cloud-sync') && state.activeCheckoutOrderId) {
          const order = getOrder(state.activeCheckoutOrderId);
          if (order) renderCheckoutView(order);
        }
        if (state.adminAuthenticated) {
          syncProductCategoryOptions();
          refreshAdminDashboard();
        }
      } else if (change.domain === 'cart') {
        state.cart = getCart();
        updateCartUI();
        renderCatalog();
      }
    });
  }

  // Story 3-step interactive dossier, timeline rail, variant chips, & QRIS channel/preset selector
  const storyTabs = Array.from(document.querySelectorAll?.('.story-step-tab') || []);
  const storyRailItems = Array.from(document.querySelectorAll?.('.story-rail-item[data-story-step]') || []);
  if (storyTabs.length) {
    const tagByStep = { '1': 'Contoh produk', '2': 'Alur checkout', '3': 'Struk & QRIS' };
    const fillByStep = { '1': 0.333, '2': 0.667, '3': 1 };
    const photoTag = document.querySelector?.('.story-photo-tag');
    const railFill = document.getElementById?.('story-rail-fill');

    const applyStoryStep = (step, { focusTab = false, userInitiated = false, syncRail = true } = {}) => {
      if (!step) return;
      if (userInitiated) {
        manualStoryOverrideUntil = Date.now() + 2800;
      }
      lastAutoStoryStep = String(step);
      let activeTabBtn = null;
      storyTabs.forEach((btn) => {
        const isTarget = btn?.dataset?.storyStep === String(step);
        if (isTarget) activeTabBtn = btn;
        btn.classList?.toggle?.('active', isTarget);
        btn.setAttribute?.('aria-selected', isTarget ? 'true' : 'false');
      });
      storyRailItems.forEach((item) => {
        const isTarget = item?.dataset?.storyStep === String(step);
        item.classList?.toggle?.('is-active', isTarget);
        if (isTarget) item.setAttribute?.('aria-current', 'step');
        else item.removeAttribute?.('aria-current');
      });
      if (syncRail && railFill && fillByStep[step]) {
        if (gsapReady && !isReducedMotion() && typeof window?.gsap?.to === 'function') {
          window.gsap.to(railFill, { scaleY: fillByStep[step], duration: 0.32, ease: 'power2.out', overwrite: 'auto' });
        } else if (railFill.style) {
          railFill.style.transform = `scaleY(${fillByStep[step]})`;
        }
      }
      document.querySelectorAll?.('.story-panel')?.forEach((panel) => {
        const matches = panel.id === `story-panel-${step}`;
        panel.classList?.toggle?.('active', matches);
        if (matches) {
          panel.removeAttribute?.('hidden');
          if (gsapReady && !isReducedMotion() && typeof window?.gsap?.fromTo === 'function') {
            window.gsap.fromTo(
              panel,
              { y: 8 },
              { y: 0, opacity: 1, duration: 0.26, ease: 'power3.out', clearProps: 'transform', overwrite: 'auto' }
            );
          }
        } else {
          panel.setAttribute?.('hidden', '');
        }
      });
      if (photoTag && tagByStep[step]) {
        photoTag.textContent = tagByStep[step];
      }
      if (focusTab && activeTabBtn) activeTabBtn.focus?.();
    };
    applyStoryStepFn = applyStoryStep;

    storyTabs.forEach((btn, idx) => {
      btn.addEventListener?.('click', () => {
        sfx.playClick();
        applyStoryStep(btn.dataset?.storyStep, { userInitiated: true });
      });
      btn.addEventListener?.('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const nextIdx = e.key === 'ArrowRight'
          ? (idx + 1) % storyTabs.length
          : (idx - 1 + storyTabs.length) % storyTabs.length;
        sfx.playClick();
        applyStoryStep(storyTabs[nextIdx]?.dataset?.storyStep, { focusTab: true, userInitiated: true });
      });
    });

    storyRailItems.forEach((item) => {
      item.addEventListener?.('click', () => {
        sfx.playClick();
        applyStoryStep(item.dataset?.storyStep, { userInitiated: true });
      });
    });
  }

  const storyChipsContainer = document.getElementById?.('story-panel-1-chips');
  const storyVariantNote = document.getElementById?.('story-variant-note');
  const storyPriceEl = document.getElementById?.('story-panel-1-price');
  const storyPreviewBtn = document.querySelector?.('#story-panel-1 .story-dossier-btn');
  if (storyPreviewBtn) {
    storyPreviewBtn.onclick = () => window.openQuickView(featuredProductId || 'prod-01', selectedStoryVariant);
  }
  if (storyChipsContainer) {
    storyChipsContainer.addEventListener?.('click', (e) => {
      const chip = e.target?.closest?.('.story-variant-chip[data-story-variant]');
      if (!chip) return;
      sfx.playClick();
      const featured = getProduct(featuredProductId) || getProducts().find((p) => p.id === featuredProductId) || getProducts()[0];
      selectedStoryVariant = chip.dataset?.storyVariant || featured?.variants?.[0]?.label || '';
      storyChipsContainer.querySelectorAll?.('.story-variant-chip[data-story-variant]')?.forEach((c) => {
        const active = c === chip;
        c.classList?.toggle?.('is-active', active);
        c.setAttribute?.('aria-pressed', active ? 'true' : 'false');
      });
      const activeVarObj = featured?.variants?.find((v) => v.label === selectedStoryVariant);
      const effectivePrice = featured
        ? Math.max(0, Number(featured.price || 0) + Number(activeVarObj?.priceDelta || 0))
        : 78000;
      if (storyPriceEl) storyPriceEl.textContent = formatIDR(effectivePrice);
      if (storyVariantNote) {
        const stockText = featured ? ` · ${formatProductStockLabel(featured, { fallback: 'Stok aktif' })}` : '';
        storyVariantNote.textContent = `Varian dipilih: ${selectedStoryVariant} (${formatIDR(effectivePrice)})${stockText}.`;
        if (gsapReady && !isReducedMotion() && typeof window?.gsap?.fromTo === 'function') {
          window.gsap.fromTo(
            storyVariantNote,
            { y: 4 },
            { y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'transform', overwrite: 'auto' }
          );
        }
      }
    });
  }

  const ritualChannelBtns = Array.from(document.querySelectorAll?.('.ritual-badge[data-pay-channel]') || []);
  if (ritualChannelBtns.length) {
    const channelNotes = {
      qris: 'Satu kode standar nasional terbaca langsung dengan nominal tepat.',
      ewallet: 'Pindai langsung lewat GoPay, OVO, DANA, atau ShopeePay tanpa ketik nominal.',
      mbanking: 'Didukung BCA mobile, Livin’ Mandiri, BRImo, dan bank QRIS lainnya.'
    };
    const noteEl = document.getElementById?.('ritual-channel-note');
    ritualChannelBtns.forEach((btn) => {
      btn.addEventListener?.('click', () => {
        sfx.playClick();
        const channel = btn.dataset?.payChannel || 'qris';
        ritualChannelBtns.forEach((item) => {
          const active = item === btn;
          item.classList?.toggle?.('is-active', active);
          item.setAttribute?.('aria-pressed', active ? 'true' : 'false');
        });
        if (noteEl && channelNotes[channel]) {
          noteEl.textContent = channelNotes[channel];
          if (gsapReady && !isReducedMotion() && typeof window?.gsap?.fromTo === 'function') {
            window.gsap.fromTo(
              noteEl,
              { y: 4 },
              { y: 0, duration: 0.24, ease: 'power2.out', clearProps: 'transform', overwrite: 'auto' }
            );
            if (document.querySelector?.('.ritual-qr-scanline')) {
              window.gsap.fromTo(
                '.ritual-qr-scanline',
                { y: 0, opacity: 0.5 },
                { y: 52, opacity: 0.9, duration: 1.05, repeat: 1, yoyo: true, ease: 'sine.inOut', overwrite: 'auto' }
              );
            }
          }
        }
      });
    });
  }

  document.querySelectorAll?.('.ritual-preset-btn[data-ritual-preset]')?.forEach((btn) => {
    btn.addEventListener?.('click', () => {
      sfx.playClick();
      ritualPreviewMode = btn.dataset?.ritualPreset || '78000';
      syncRitualLiveTicket();
    });
  });

  document.querySelectorAll?.('details.ritual-faq-item')?.forEach((detailsEl) => {
    detailsEl.addEventListener?.('toggle', () => {
      const answer = detailsEl.querySelector?.('p');
      if (detailsEl.open && answer && gsapReady && !isReducedMotion() && typeof window?.gsap?.fromTo === 'function') {
        window.gsap.fromTo(
          answer,
          { y: -6 },
          { y: 0, duration: 0.24, ease: 'power2.out', clearProps: 'transform', overwrite: 'auto' }
        );
      }
      scheduleScrollTriggerRefresh();
    });
  });

  // Sweep expired orders periodically (once)
  if (!expiredSweepTimer) {
    expiredSweepTimer = setInterval(() => {
      sweepExpiredOrders();
    }, 10000);
  }
}

let activeGsapContext = null;
let gsapReady = false;
let lastCatalogFilterKey = '';
let lastCatalogCount = -1;
let catalogVelocityTimer = null;
let catalogBatchTriggers = [];
let scrollRefreshQueued = false;
let reducedMotionQueryBound = false;
const kineticElements = new Set();

function isReducedMotion() {
  return Boolean(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

function scheduleScrollTriggerRefresh() {
  if (scrollRefreshQueued || typeof window === 'undefined' || typeof window.ScrollTrigger?.refresh !== 'function') return;
  scrollRefreshQueued = true;
  const run = () => {
    scrollRefreshQueued = false;
    window.ScrollTrigger?.refresh?.();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else run();
}

function getVisibleProductCards(grid) {
  const fromGrid = grid?.querySelectorAll?.('.product-card');
  const list = fromGrid?.length ? fromGrid : document.querySelectorAll?.('.product-card');
  return list ? Array.from(list) : [];
}

function syncCategoryTabSlider(immediate = false) {
  const tabsContainer = document.querySelector?.('.category-tabs');
  const slider = document.getElementById?.('tab-active-slider');
  const activeBtn = tabsContainer?.querySelector?.('.tab-btn.active');
  if (!tabsContainer || !slider || !activeBtn) return;
  const left = activeBtn.offsetLeft || 0;
  const width = activeBtn.offsetWidth || 0;
  if (!width) return;
  if (!immediate && gsapReady && !isReducedMotion() && typeof window?.gsap?.to === 'function') {
    window.gsap.to(slider, { x: left, width, opacity: 1, duration: 0.32, ease: 'power3.out', overwrite: 'auto' });
  } else if (slider.style) {
    slider.style.width = `${width}px`;
    slider.style.transform = `translate3d(${left}px, 0, 0)`;
    slider.style.opacity = '1';
  }
}

function clearCatalogBatchTriggers() {
  catalogBatchTriggers.forEach((st) => st?.kill?.());
  catalogBatchTriggers = [];
}

function bindCatalogCardBatch(gsap, ScrollTrigger, grid) {
  clearCatalogBatchTriggers();
  const cards = getVisibleProductCards(grid);
  if (!cards.length || typeof ScrollTrigger?.batch !== 'function') return;
  const created = ScrollTrigger.batch(cards, {
    start: 'top 93%',
    end: 'bottom 7%',
    onEnter: (batch) => {
      gsap.fromTo(
        batch,
        { y: 40, scale: 0.94, rotationX: 6, transformPerspective: 1100 },
        { y: 0, opacity: 1, scale: 1, rotationX: 0, duration: 0.52, stagger: 0.055, ease: 'power3.out', clearProps: 'transform', overwrite: 'auto' }
      );
    },
    onEnterBack: (batch) => {
      gsap.fromTo(
        batch,
        { y: -34, scale: 0.94, rotationX: -5, transformPerspective: 1100 },
        { y: 0, opacity: 1, scale: 1, rotationX: 0, duration: 0.5, stagger: 0.055, ease: 'power3.out', clearProps: 'transform', overwrite: 'auto' }
      );
    }
  });
  if (Array.isArray(created)) catalogBatchTriggers = created;
}

function animateCatalogCards(grid) {
  if (!gsapReady || isReducedMotion() || typeof window === 'undefined' || typeof window.gsap === 'undefined') return;
  const cards = getVisibleProductCards(grid);
  if (!cards.length) return;
  window.gsap.fromTo(
    cards,
    { y: 34, scale: 0.94, rotationX: 5, transformPerspective: 1100 },
    { y: 0, opacity: 1, scale: 1, rotationX: 0, duration: 0.48, stagger: { amount: 0.28, from: 'start' }, ease: 'power3.out', clearProps: 'transform,opacity', overwrite: 'auto' }
  );
  bindCatalogCardBatch(window.gsap, window.ScrollTrigger, grid);
}

function splitKineticWords(el) {
  if (!el || typeof document?.createElement !== 'function' || typeof Node === 'undefined') return [];
  if (el.dataset.kineticReady === '1') {
    return Array.from(el.querySelectorAll?.('.kt-word') || []);
  }
  const plainText = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!plainText) return [];

  const snapshot = Array.from(el.childNodes || []).map((child) => child.cloneNode(true));
  el._kineticSnapshot = snapshot;
  el._kineticPrevAriaLabel = el.getAttribute?.('aria-label') ?? null;
  el.setAttribute?.('aria-label', plainText);

  const transformNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = [];
      const parts = String(node.textContent || '').split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          frag.push(document.createTextNode(part));
        } else {
          const clip = document.createElement('span');
          clip.className = 'kt-clip';
          clip.setAttribute('aria-hidden', 'true');
          const word = document.createElement('span');
          word.className = 'kt-word';
          word.textContent = part;
          clip.appendChild(word);
          frag.push(clip);
        }
      }
      return frag;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const clone = node.cloneNode(false);
      clone.setAttribute?.('aria-hidden', 'true');
      Array.from(node.childNodes || []).forEach((grandChild) => {
        transformNode(grandChild).forEach((out) => clone.appendChild(out));
      });
      return [clone];
    }
    return [node.cloneNode(true)];
  };

  const rebuilt = [];
  snapshot.forEach((child) => {
    transformNode(child).forEach((out) => rebuilt.push(out));
  });
  el.replaceChildren?.(...rebuilt);
  el.dataset.kineticReady = '1';
  kineticElements.add(el);
  return Array.from(el.querySelectorAll?.('.kt-word') || []);
}

function revertAllKineticWords() {
  kineticElements.forEach((el) => {
    if (Array.isArray(el._kineticSnapshot) && typeof el.replaceChildren === 'function') {
      el.replaceChildren(...el._kineticSnapshot);
      delete el._kineticSnapshot;
    }
    if (el._kineticPrevAriaLabel === null) el.removeAttribute?.('aria-label');
    else if (el._kineticPrevAriaLabel !== undefined) el.setAttribute?.('aria-label', el._kineticPrevAriaLabel);
    delete el._kineticPrevAriaLabel;
    delete el.dataset.kineticReady;
  });
  kineticElements.clear();
}

function cleanupGsapMotion() {
  if (catalogVelocityTimer) {
    clearTimeout(catalogVelocityTimer);
    catalogVelocityTimer = null;
  }
  clearCatalogBatchTriggers();
  activeGsapContext?.revert?.();
  activeGsapContext = null;
  gsapReady = false;
  revertAllKineticWords();
  document.body?.classList?.remove?.('gsap-motion-active');
}

function animateWordReveal(gsap, selector, scrollTriggerConfig, vars = {}) {
  const el = document.querySelector?.(selector);
  if (!el) return;
  const words = splitKineticWords(el);
  if (!words.length) return;
  const isScrub = Boolean(scrollTriggerConfig && scrollTriggerConfig.scrub !== undefined && scrollTriggerConfig.scrub !== false);
  const triggerCfg = scrollTriggerConfig
    ? (isScrub
        ? scrollTriggerConfig
        : { toggleActions: 'play none play none', ...scrollTriggerConfig })
    : undefined;
  const toVars = {
    yPercent: 0,
    opacity: 1,
    rotateZ: 0,
    duration: vars.duration ?? 0.62,
    stagger: vars.stagger ?? (isScrub ? 0.045 : 0.032),
    ease: isScrub ? 'none' : (vars.ease ?? 'power3.out')
  };
  if (!isScrub) toVars.clearProps = 'transform';
  if (triggerCfg) toVars.scrollTrigger = triggerCfg;
  gsap.fromTo(
    words,
    { yPercent: isScrub ? 94 : 104, opacity: 1, rotateZ: isScrub ? 2.2 : 1.5 },
    toVars
  );
}

function setupHeroAntigravityField(gsap, ScrollTrigger, cleanups) {
  const canvas = document.getElementById?.('hero-field-canvas');
  const hero = document.getElementById?.('hero');
  if (!canvas || !hero || typeof canvas.getContext !== 'function') return;
  if (typeof gsap.ticker?.add !== 'function' || typeof gsap.ticker?.remove !== 'function') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let active = true;
  let pointerX = -9999;
  let pointerY = -9999;
  let scrollBoost = 0;
  let scrollDirection = 1;
  let heroScrollProgress = 0;

  const resize = () => {
    const rect = hero.getBoundingClientRect?.() || { width: 1200, height: 680 };
    width = Math.max(320, Math.floor(rect.width || 1200));
    height = Math.max(360, Math.floor(rect.height || 680));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const palette = [
    '45, 72, 56',    // Matcha / Forest Sage
    '163, 72, 37',   // Terracotta
    '194, 134, 62',  // Warm Ochre
    '29, 23, 19'     // Deep Espresso Ink
  ];
  const particleCount = width < 768 ? 36 : 68;
  const particles = Array.from({ length: particleCount }, (_, idx) => {
    const ringTier = idx % 4;
    const baseRadius = (Math.min(width, height) * (0.24 + ringTier * 0.14)) + ((idx * 17) % 38);
    const angle = (idx / particleCount) * Math.PI * 2 + ringTier * 0.45;
    const isCapsule = idx % 5 !== 0;
    const color = palette[idx % palette.length];
    return {
      angle,
      radius: baseRadius,
      angularVel: (0.0014 + (idx % 4) * 0.00045) * (ringTier % 2 === 0 ? 1 : -1),
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
      len: isCapsule ? 10 + (idx % 4) * 4.5 : 3.2,
      thick: isCapsule ? 2.4 + (idx % 3) * 0.5 : 3.2,
      isCapsule,
      tiltOffset: (idx % 7) * 0.22 - 0.65,
      phase: idx * 0.55,
      color,
      alpha: color === '29, 23, 19' ? 0.24 : (color === '163, 72, 37' ? 0.44 : 0.4)
    };
  });

  const onPointerMove = (e) => {
    const rect = hero.getBoundingClientRect?.();
    if (!rect) return;
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
  };
  const onPointerLeave = () => {
    pointerX = -9999;
    pointerY = -9999;
  };

  hero.addEventListener?.('pointermove', onPointerMove, { passive: true });
  hero.addEventListener?.('pointerleave', onPointerLeave);
  window.addEventListener?.('resize', resize, { passive: true });

  ScrollTrigger?.create?.({
    trigger: hero,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const rawVel = self.getVelocity?.() || 0;
      const vel = Math.abs(rawVel);
      scrollDirection = rawVel >= 0 ? 1 : -1;
      scrollBoost = Math.min(3.4, vel / 520);
      heroScrollProgress = Math.max(0, Math.min(1, self.progress ?? 0));
    }
  });

  let io = null;
  if (typeof window.IntersectionObserver === 'function') {
    io = new window.IntersectionObserver((entries) => {
      active = Boolean(entries[0]?.isIntersecting);
    }, { threshold: 0.02 });
    io.observe(hero);
  }

  const tick = (_time, deltaRatio = 1) => {
    if (!active) return;
    const step = Math.min(2.4, Math.max(0.4, deltaRatio));
    ctx.clearRect(0, 0, width, height);
    scrollBoost *= 0.91;

    const originX = width * (width < 768 ? 0.52 : 0.56);
    const originY = height * 0.48;
    const radialSpread = 1 + heroScrollProgress * 0.48 + scrollBoost * 0.05;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.phase += 0.022 * step;
      p.angle += p.angularVel * (1 + scrollBoost * 1.9 * scrollDirection) * step;

      const wobble = Math.sin(p.phase) * 9;
      const r = p.radius * radialSpread + wobble;
      const anchorX = originX + Math.cos(p.angle) * r * 1.18;
      const anchorY = originY + Math.sin(p.angle) * r * 0.78;

      const currX = anchorX + p.ox;
      const currY = anchorY + p.oy;
      const dx = currX - pointerX;
      const dy = currY - pointerY;
      const distSq = dx * dx + dy * dy;

      if (distSq > 4 && distSq < 175 * 175) {
        const dist = Math.sqrt(distSq);
        const force = (1 - dist / 175) * 1.65;
        p.vx += (dx / dist) * force * step;
        p.vy += (dy / dist) * force * step;

        ctx.beginPath();
        ctx.moveTo(currX, currY);
        ctx.lineTo(pointerX, pointerY);
        ctx.strokeStyle = `rgba(${p.color}, ${(1 - dist / 175) * 0.16})`;
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }

      p.vx = (p.vx - p.ox * 0.032 * step) * 0.88;
      p.vy = (p.vy - p.oy * 0.032 * step) * 0.88;
      p.ox += p.vx * step;
      p.oy += p.vy * step;

      const drawX = anchorX + p.ox;
      const drawY = anchorY + p.oy;
      if (drawX < -30 || drawX > width + 30 || drawY < -30 || drawY > height + 30) continue;

      if (p.isCapsule) {
        const tangent = p.angle + Math.PI / 2 + p.tiltOffset;
        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.rotate(tangent);
        ctx.beginPath();
        ctx.moveTo(-p.len * 0.5, 0);
        ctx.lineTo(p.len * 0.5, 0);
        ctx.strokeStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.lineWidth = p.thick;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(drawX, drawY, p.len, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha + 0.08})`;
        ctx.fill();
      }
    }
  };

  gsap.ticker.add(tick);
  cleanups.push(() => {
    gsap.ticker.remove(tick);
    hero.removeEventListener?.('pointermove', onPointerMove);
    hero.removeEventListener?.('pointerleave', onPointerLeave);
    window.removeEventListener?.('resize', resize);
    io?.disconnect?.();
    ctx.clearRect(0, 0, width, height);
  });
}

function bindPointerInteractions(gsap) {
  const finePointer = Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches);
  const cleanups = [];
  const onResizeSlider = () => syncCategoryTabSlider(true);
  window.addEventListener?.('resize', onResizeSlider, { passive: true });
  cleanups.push(() => window.removeEventListener?.('resize', onResizeSlider));

  if (!finePointer) return cleanups;

  const attachMicroTilt = (selector, maxDeg) => {
    const el = document.querySelector?.(selector);
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    gsap.set?.(el, { transformPerspective: 920 });
    const rxTo = gsap.quickTo(el, 'rotationX', { duration: 0.42, ease: 'power3.out' });
    const ryTo = gsap.quickTo(el, 'rotationY', { duration: 0.42, ease: 'power3.out' });
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      rxTo(-ny * maxDeg);
      ryTo(nx * maxDeg);
    };
    const onLeave = () => {
      rxTo(0);
      ryTo(0);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    cleanups.push(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    });
  };

  attachMicroTilt('.showcase-card', 5);
  attachMicroTilt('.story-dossier', 3.4);
  attachMicroTilt('.ritual-ticket', 2.4);

  document.querySelectorAll?.('.hero-actions .btn-primary, .cta-actions .btn-primary, .showcase-btn')?.forEach((btn) => {
    if (typeof btn.getBoundingClientRect !== 'function') return;
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.34, ease: 'power3.out' });
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.34, ease: 'power3.out' });
    const onMove = (e) => {
      const rect = btn.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      xTo(((e.clientX - rect.left) / rect.width - 0.5) * 9);
      yTo(((e.clientY - rect.top) / rect.height - 0.5) * 9);
    };
    const onLeave = () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.52, ease: 'elastic.out(1, 0.48)', overwrite: 'auto' });
    };
    btn.addEventListener('pointermove', onMove);
    btn.addEventListener('pointerleave', onLeave);
    cleanups.push(() => {
      btn.removeEventListener('pointermove', onMove);
      btn.removeEventListener('pointerleave', onLeave);
    });
  });

  return cleanups;
}

function setupGlobalScrollChrome(gsap, ScrollTrigger) {
  const progressBar = document.getElementById('scroll-progress-bar');
  if (progressBar) {
    gsap.to(progressBar, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true
      }
    });
  }

  const header = document.getElementById('site-header');
  if (header) {
    ScrollTrigger.create({
      start: 28,
      end: 'max',
      onUpdate: (self) => header.classList?.toggle?.('is-scrolled', (self.scroll?.() || 0) > 28)
    });
  }

  const navLinks = Array.from(document.querySelectorAll?.('.nav-links .nav-link') || []);
  if (navLinks.length) {
    const syncNav = (id) => {
      navLinks.forEach((link) => link.classList?.toggle?.('active', link.getAttribute?.('href') === `#${id}`));
    };
    ['katalog', 'filosofi', 'pembayaran-info'].forEach((sectionId) => {
      const targetEl = document.getElementById(sectionId);
      if (!targetEl) return;
      ScrollTrigger.create({
        trigger: `#${sectionId}`,
        start: 'top 42%',
        end: 'bottom 42%',
        onToggle: (self) => {
          if (self.isActive) syncNav(sectionId);
        }
      });
    });
  }
}

function setupHeroChoreography(gsap, isDesktop) {
  const headlineWords = splitKineticWords(document.querySelector?.('.hero-headline'));
  const descEl = document.querySelector?.('.hero-description');

  const entrance = gsap.timeline({ defaults: { ease: 'power3.out' } });
  if (headlineWords.length) {
    entrance.fromTo(
      headlineWords,
      { yPercent: 108, opacity: 1, rotateZ: 2.2 },
      { yPercent: 0, opacity: 1, rotateZ: 0, duration: 0.72, stagger: 0.036, clearProps: 'transform' }
    );
  } else {
    entrance.from('.hero-headline', { y: 28, duration: 0.65, clearProps: 'transform' });
  }
  if (descEl) {
    entrance.fromTo(descEl, { y: 20 }, { y: 0, opacity: 1, duration: 0.48, clearProps: 'transform' }, '-=0.45');
  }
  const hasSel = (sel) => Boolean(document.querySelector?.(sel));
  if (hasSel('.hero-actions')) {
    entrance.fromTo('.hero-actions', { y: 22, scale: 0.96 }, { y: 0, scale: 1, opacity: 1, duration: 0.46, clearProps: 'transform' }, '-=0.38');
  }
  if (hasSel('.hero-visual')) {
    entrance.fromTo('.hero-visual', { y: 44, scale: 0.93, rotationX: isDesktop ? 5 : 0, transformPerspective: 1100 }, { y: 0, scale: 1, rotationX: 0, opacity: 1, duration: 0.72, clearProps: 'transform' }, '-=0.54');
  }

  if (hasSel('.hero-section')) {
    const heroScroll = gsap.timeline({
      scrollTrigger: {
        trigger: '.hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.65,
        invalidateOnRefresh: true
      }
    });
    if (hasSel('.hero-editorial')) heroScroll.to('.hero-editorial', { y: isDesktop ? -68 : -24, ease: 'none' }, 0);
    if (hasSel('.hero-actions')) heroScroll.to('.hero-actions', { y: isDesktop ? 22 : 8, ease: 'none' }, 0);
    if (isDesktop) {
      if (hasSel('.hero-visual')) heroScroll.to('.hero-visual', { y: -96, scale: 0.92, rotationX: 4, rotationY: -5, transformPerspective: 1100, ease: 'none' }, 0);
      if (hasSel('.showcase-card')) heroScroll.to('.showcase-card', { yPercent: -12, rotation: -3.6, transformPerspective: 1100, ease: 'none' }, 0);
      if (hasSel('.showcase-tag')) heroScroll.to('.showcase-tag', { y: -44, x: 14, ease: 'none' }, 0);
      if (hasSel('.showcase-img-wrap img')) heroScroll.to('.showcase-img-wrap img', { yPercent: 12, scale: 1.15, ease: 'none' }, 0);
    } else if (hasSel('.hero-visual')) {
      heroScroll.to('.hero-visual', { y: -26, scale: 0.96, ease: 'none' }, 0);
    }
  }
}

function setupCatalogChoreography(gsap, ScrollTrigger) {
  animateWordReveal(gsap, '.catalog-title', {
    trigger: '.catalog-title',
    start: 'top 95%',
    end: 'top 66%',
    scrub: 0.55
  });

  const grid = document.getElementById('product-grid');
  bindCatalogCardBatch(gsap, ScrollTrigger, grid);

  if (grid && typeof gsap.quickTo === 'function') {
    const skewGridTo = gsap.quickTo(grid, 'skewY', { duration: 0.36, ease: 'power3.out' });
    ScrollTrigger.create({
      trigger: '#product-grid',
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        const clamped = Math.max(-2.4, Math.min(2.4, (self.getVelocity?.() || 0) / 550));
        skewGridTo(clamped);
        if (catalogVelocityTimer) clearTimeout(catalogVelocityTimer);
        catalogVelocityTimer = setTimeout(() => skewGridTo(0), 120);
      },
      onLeave: () => skewGridTo(0),
      onLeaveBack: () => skewGridTo(0)
    });
  }
}

function setupStoryAndClosingChoreography(gsap, ScrollTrigger, isDesktop, cleanups) {
  animateWordReveal(gsap, '.story-copy h2', {
    trigger: '.story-copy h2',
    start: 'top 95%',
    end: 'top 64%',
    scrub: 0.55
  });

  const hasSel = (sel) => Boolean(document.querySelector?.(sel));
  if (hasSel('.luxury-story')) {
    const storyArrival = gsap.timeline({
      scrollTrigger: {
        trigger: '.luxury-story',
        start: 'top 94%',
        end: 'top 42%',
        scrub: 0.65
      }
    });
    if (hasSel('.story-copy')) storyArrival.fromTo('.story-copy', { x: isDesktop ? -40 : 0, y: isDesktop ? 14 : 20, opacity: 1 }, { x: 0, y: 0, opacity: 1, ease: 'none' }, 0);
    if (hasSel('.story-visual')) storyArrival.fromTo('.story-visual', { x: isDesktop ? 42 : 0, y: 28, scale: 0.94, rotationY: isDesktop ? -5 : 0, transformPerspective: 1100, opacity: 1 }, { x: 0, y: 0, scale: 1, rotationY: 0, opacity: 1, ease: 'none' }, 0);
    if (hasSel('.story-metrics > div')) storyArrival.fromTo('.story-metrics > div', { y: 24, scale: 0.96, opacity: 1 }, { y: 0, scale: 1, opacity: 1, stagger: 0.08, ease: 'none' }, 0.05);
    if (hasSel('.story-rail-item')) storyArrival.fromTo('.story-rail-item', { x: isDesktop ? -22 : 0, y: 14, opacity: 1 }, { x: 0, y: 0, opacity: 1, stagger: 0.06, ease: 'none' }, 0.08);
  }

  const storyParallax = gsap.timeline({
    scrollTrigger: {
      trigger: '.luxury-story',
      start: 'top bottom',
      end: 'bottom top',
      scrub: 0.65
    }
  });
  if (document.querySelector?.('.story-photo-wrap img')) {
    storyParallax.fromTo('.story-photo-wrap img', { yPercent: -11, scale: 1.16 }, { yPercent: 11, scale: 1, ease: 'none' }, 0);
  }

  const pinStage = document.querySelector?.('.story-stage-pin');
  const railFill = document.getElementById?.('story-rail-fill');
  const headerEl = document.getElementById?.('site-header');
  const headerHeight = Math.round(headerEl?.getBoundingClientRect?.().height || 72);
  const pinTop = headerHeight + 18;
  const stageHeight = Math.round(pinStage?.getBoundingClientRect?.().height || 0);
  const fitsPinnedViewport = Boolean(
    stageHeight > 0 &&
    typeof window?.innerHeight === 'number' &&
    window.innerHeight >= 540 &&
    stageHeight <= (window.innerHeight - pinTop - 18)
  );
  const canPinStoryStage = Boolean(
    isDesktop &&
    pinStage &&
    fitsPinnedViewport &&
    typeof window?.innerWidth === 'number' && window.innerWidth >= 960
  );

  if (typeof applyStoryStepFn === 'function') {
    const syncStoryProgress = (self) => {
      if (Date.now() < manualStoryOverrideUntil) return;
      const p = self.progress ?? 0;
      const nextStep = p < 0.36 ? '1' : p < 0.72 ? '2' : '3';
      if (nextStep !== lastAutoStoryStep) {
        applyStoryStepFn(nextStep, { syncRail: false });
      }
    };

    const storyStageTl = gsap.timeline({
      scrollTrigger: canPinStoryStage
        ? {
            trigger: '.story-stage-pin',
            start: () => `top ${pinTop}px`,
            end: '+=680',
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            scrub: 0.5,
            onUpdate: syncStoryProgress
          }
        : {
            trigger: '.luxury-story',
            start: 'top 74%',
            end: 'bottom 32%',
            scrub: 0.5,
            onUpdate: syncStoryProgress
          }
    });

    if (railFill) {
      storyStageTl.fromTo(railFill, { scaleY: 0.333 }, { scaleY: 1, ease: 'none' }, 0);
    }
    if (document.querySelector?.('.story-dossier')) {
      storyStageTl.fromTo(
        '.story-dossier',
        { rotationY: isDesktop ? -3.5 : 0, rotationX: 2, y: canPinStoryStage ? 12 : 24, transformPerspective: 1100 },
        { rotationY: isDesktop ? 3.5 : 0, rotationX: -1.8, y: canPinStoryStage ? -12 : -24, ease: 'none' },
        0
      );
    }
  } else if (isDesktop && document.querySelector?.('.story-dossier')) {
    storyParallax.fromTo('.story-dossier', { y: 26, rotationY: -4, transformPerspective: 1100 }, { y: -26, rotationY: 4, ease: 'none' }, 0);
  }

  document.querySelectorAll?.('[data-count-to]')?.forEach((counterEl) => {
    const target = Number(counterEl.dataset?.countTo);
    if (!Number.isFinite(target) || target <= 0) return;
    const holder = { value: 1 };
    gsap.fromTo(
      holder,
      { value: 1 },
      {
        value: target,
        duration: 0.78,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.story-metrics',
          start: 'top 92%',
          end: 'bottom 8%',
          toggleActions: 'play none play none'
        },
        onUpdate: () => {
          counterEl.textContent = String(Math.max(1, Math.round(holder.value)));
        }
      }
    );
    cleanups?.push?.(() => {
      counterEl.textContent = String(target);
    });
  });

  animateWordReveal(gsap, '.ritual-copy h2', {
    trigger: '.ritual-copy h2',
    start: 'top 95%',
    end: 'top 64%',
    scrub: 0.55
  });
  if (hasSel('.ritual-shell')) {
    gsap.fromTo(
      '.ritual-shell',
      { y: 42, scale: 0.93, rotationX: isDesktop ? 4 : 1.5, transformPerspective: 1100, opacity: 1 },
      {
        y: 0,
        scale: 1,
        rotationX: 0,
        opacity: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.ritual-shell',
          start: 'top 95%',
          end: 'top 56%',
          scrub: 0.6
        }
      }
    );
  }
  if (hasSel('.ritual-ticket')) {
    gsap.fromTo(
      '.ritual-ticket',
      { y: 46, x: isDesktop ? 24 : 0, scale: 0.92, rotationY: isDesktop ? -9 : 0, rotationX: isDesktop ? 5 : 0, transformPerspective: 1100, opacity: 1 },
      {
        y: 0,
        x: 0,
        scale: 1,
        rotationY: 0,
        rotationX: 0,
        opacity: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.ritual-shell',
          start: 'top 95%',
          end: 'top 56%',
          scrub: 0.6
        }
      }
    );
  }
  if (hasSel('.ritual-qr-scanline')) {
    gsap.fromTo(
      '.ritual-qr-scanline',
      { y: 0, opacity: 0.55 },
      {
        y: 52,
        opacity: 0.95,
        duration: 1.25,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        scrollTrigger: {
          trigger: '.ritual-shell',
          start: 'top 92%',
          end: 'bottom 8%',
          toggleActions: 'play pause resume pause'
        }
      }
    );
  }
  if (hasSel('.ritual-badge')) {
    gsap.fromTo(
      '.ritual-badge',
      { y: 28, scale: 0.9, rotationZ: -2.5, opacity: 1 },
      {
        y: 0,
        scale: 1,
        rotationZ: 0,
        opacity: 1,
        stagger: 0.08,
        ease: 'none',
        scrollTrigger: {
          trigger: '.ritual-shell',
          start: 'top 94%',
          end: 'top 62%',
          scrub: 0.55
        }
      }
    );
  }

  if (hasSel('.cta-shell')) {
    gsap.fromTo(
      '.cta-shell',
      { scale: 0.89, y: 48, rotationX: isDesktop ? 5 : 2, transformPerspective: 1100, opacity: 1 },
      {
        scale: 1,
        y: 0,
        rotationX: 0,
        opacity: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.cta-shell',
          start: 'top 96%',
          end: 'top 58%',
          scrub: 0.6
        }
      }
    );
  }
  animateWordReveal(gsap, '.cta-copy h2', {
    trigger: '.cta-copy h2',
    start: 'top 95%',
    end: 'top 66%',
    scrub: 0.55
  });
  if (hasSel('.cta-actions')) {
    gsap.fromTo(
      '.cta-actions',
      { y: 36, scale: 0.95, opacity: 1 },
      {
        y: 0,
        scale: 1,
        opacity: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.cta-shell',
          start: 'top 95%',
          end: 'top 60%',
          scrub: 0.55
        }
      }
    );
  }

  animateWordReveal(gsap, '.footer-brand', {
    trigger: '.site-footer',
    start: 'top 98%',
    end: 'bottom bottom',
    scrub: 0.45
  });
  const footerTargets = ['.footer-brand-col', '.footer-nav-col', '.footer-bottom'].filter(hasSel);
  if (footerTargets.length && hasSel('.site-footer')) {
    gsap.fromTo(
      footerTargets,
      { y: 42, scale: 0.96, opacity: 1 },
      {
        y: 0,
        scale: 1,
        opacity: 1,
        stagger: 0.08,
        ease: 'none',
        scrollTrigger: {
          trigger: '.site-footer',
          start: 'top 98%',
          end: 'bottom bottom',
          scrub: 0.45
        }
      }
    );
  }

  void ScrollTrigger;
}

export function initGSAPAnimations() {
  cleanupGsapMotion();
  if (typeof window === 'undefined' || typeof window.gsap === 'undefined') return;
  const gsap = window.gsap;
  const reducedQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (!reducedMotionQueryBound && reducedQuery?.addEventListener) {
    reducedMotionQueryBound = true;
    reducedQuery.addEventListener('change', () => initGSAPAnimations());
  }
  if (reducedQuery?.matches) {
    syncCategoryTabSlider(true);
    return;
  }
  if (typeof window.ScrollTrigger === 'undefined') return;

  const ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config?.({ ignoreMobileResize: true });
  gsapReady = true;
  lastCatalogFilterKey = `${state.activeCategory}|${state.sortBy}|${state.searchQuery}`;
  document.body?.classList?.add?.('gsap-motion-active');
  syncCategoryTabSlider(true);

  activeGsapContext = gsap.context(() => {
    const mm = typeof gsap.matchMedia === 'function' ? gsap.matchMedia() : null;
    setupGlobalScrollChrome(gsap, ScrollTrigger);
    setupCatalogChoreography(gsap, ScrollTrigger);
    const cleanups = bindPointerInteractions(gsap);
    setupHeroAntigravityField(gsap, ScrollTrigger, cleanups);

    const runResponsiveSections = (isDesktop) => {
      setupHeroChoreography(gsap, isDesktop);
      setupStoryAndClosingChoreography(gsap, ScrollTrigger, isDesktop, cleanups);
    };

    if (mm) {
      mm.add('(min-width: 769px)', () => runResponsiveSections(true));
      mm.add('(max-width: 768px)', () => runResponsiveSections(false));
    } else {
      const isDesktop = Boolean(window.matchMedia?.('(min-width: 769px)')?.matches);
      runResponsiveSections(isDesktop);
    }

    const onWindowLoad = () => {
      if (gsapReady) scheduleScrollTriggerRefresh();
    };
    window.addEventListener?.('load', onWindowLoad);
    cleanups.push(() => window.removeEventListener?.('load', onWindowLoad));

    if (typeof document !== 'undefined' && document.fonts?.ready?.then) {
      document.fonts.ready.then(() => {
        if (gsapReady) scheduleScrollTriggerRefresh();
      });
    }

    return () => cleanups.forEach((fn) => fn());
  });
}

function initApp() {
  updateStorefrontStatus();
  renderCategoryTabs();
  syncProductCategoryOptions();
  renderCatalog();
  updateCartUI();
  updateOrderTrackerDockUI();
  initEventBindings();
  initRealtimeSync();
  if (typeof window !== 'undefined') {
    if (window.location?.hash === '#privasi') toggleFooterPrivacy(true);
    window.addEventListener?.('hashchange', () => {
      if (window.location?.hash === '#privasi') toggleFooterPrivacy(true);
    });
  }
  const isModalVisible = (id) => {
    const el = document.getElementById(id);
    return Boolean(el && !el.inert && el.classList?.contains?.('open'));
  };
  let pollTick = 0;
  syncInventory().catch(() => {});
  setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    pollTick++;
    const fast = Boolean(
      (state.adminAuthenticated && isModalVisible('admin-dashboard-modal-backdrop'))
      || (state.activeCheckoutOrderId && isModalVisible('payment-modal-backdrop'))
    );
    if (fast || pollTick % 3 === 0) {
      syncInventory().catch(() => {});
    }
  }, 2000);
  let cloudTick = 0;
  const syncCloudState = ({ inventory = false, orders = false } = {}) => {
    if (inventory) syncInventory().catch(() => {});
    syncSettingsWithCloud().then((updated) => {
      if (updated && state.activeCheckoutOrderId) {
        const order = getOrder(state.activeCheckoutOrderId);
        if (order) renderCheckoutView(order);
      }
    }).catch(() => {});
    if (orders && hasInventoryAdminToken()) {
      syncOrdersWithCloud().catch(() => {});
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener?.('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncCloudState({ inventory: true, orders: true });
    });
  }

  // Initial sync and foreground settings sync; legacy orders sync on startup/focus/12s when admin is active
  syncCloudState({ orders: true });
  if (typeof window !== 'undefined') {
    setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      cloudTick++;
      syncCloudState({ orders: cloudTick % 3 === 0 });
    }, 4000);
    window.addEventListener('focus', () => syncCloudState({ inventory: true, orders: true }));
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
  window.downloadQRISImage = downloadQRISImage;
  window.toggleCustomCategoryInput = toggleCustomCategoryInput;
  window.addCustomProductCategory = addCustomProductCategory;
  window.renderCategoryTabs = renderCategoryTabs;
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
  window.toggleFooterPrivacy = toggleFooterPrivacy;
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
  window.toggleUniqueCodeSetting = toggleUniqueCodeSetting;
  window.dismissAdminAlert = dismissAdminAlert;
  window.openOrdersFromAlert = openOrdersFromAlert;
  window.checkWebhookStatus = checkWebhookStatus;
  window.retryAdminOrdersSync = retryAdminOrdersSync;
  window.syncFeaturedShowcase = syncFeaturedShowcase;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
