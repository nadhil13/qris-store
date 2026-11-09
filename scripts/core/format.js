const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function formatIDR(amount) {
  return idr.format(Math.round(Number(amount) || 0)).replace(/\u00a0/g, ' ');
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function formatDateTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function timeAgo(ts, now = Date.now()) {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'baru saja';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  return `${day} hari lalu`;
}

// Indonesian mobile numbers: accepts 08xx, +628xx, 628xx. Returns 628xx or ''.
export function normalizePhone(input) {
  const digits = String(input || '').replace(/[^\d]/g, '');
  if (digits.startsWith('62')) return digits.length >= 10 ? digits : '';
  if (digits.startsWith('0')) return digits.length >= 10 ? `62${digits.slice(1)}` : '';
  if (digits.startsWith('8')) return digits.length >= 9 ? `62${digits}` : '';
  return '';
}

export function uid(prefix = '') {
  const rand = (globalThis.crypto && globalThis.crypto.randomUUID)
    ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}${rand}`;
}
