// QRIS (EMVCo MPM) helpers: TLV parsing, CRC16/CCITT-FALSE, validation and
// static-to-dynamic conversion. Rendering uses the vendored qrcode-generator.
import qrcodeEngine from './vendor/qrcode.esm.js';

export const DEMO_STATIC_QRIS = '00020101021126610014COM.GO-JEK.WWW01189360091430501410280210G0501410280303UMI51440014ID.CO.QRIS.WWW0215ID10265330868010303UMI5204899953033605802ID5925Toko Terpusat Belanja, Di6013JAKARTA BARAT61051182062070703A0163048201';

export function cleanQRISPayload(input) {
  return String(input || '').replace(/[\r\n\t]/g, '').trim();
}

export function calculateCRC16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Ordered TLV list. Stops at the first malformed entry and reports it.
export function parseTLV(input) {
  const items = [];
  let i = 0;
  const str = String(input || '');
  while (i < str.length) {
    if (i + 4 > str.length) return { items, error: `Data terpotong di posisi ${i}` };
    const tag = str.substring(i, i + 2);
    const lenText = str.substring(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenText)) return { items, error: `Tag tidak valid di posisi ${i}` };
    const len = Number(lenText);
    if (i + 4 + len > str.length) return { items, error: `Panjang tag ${tag} melebihi data` };
    items.push({ tag, value: str.substring(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return { items, error: null };
}

export function buildTLV(items) {
  return items.map(({ tag, value }) => `${tag}${String(value.length).padStart(2, '0')}${value}`).join('');
}

// Flat dictionary of top-level tags (CRC tag 63 excluded). Kept for compatibility.
export function parseEMVCoQRIS(qrisString) {
  if (!qrisString) return {};
  const clean = cleanQRISPayload(qrisString).replace(/6304[A-Fa-f0-9]{4}$/i, '');
  const { items } = parseTLV(clean);
  return Object.fromEntries(items.map((it) => [it.tag, it.value]));
}

export function verifyCRC(qrisString) {
  const str = cleanQRISPayload(qrisString);
  if (!/6304[A-Fa-f0-9]{4}$/i.test(str)) return false;
  return calculateCRC16(str.slice(0, -4)) === str.slice(-4).toUpperCase();
}

function subTag(value, tag) {
  const { items } = parseTLV(value || '');
  const found = items.find((it) => it.tag === tag);
  return found ? found.value : '';
}

export function describeQRIS(qrisString) {
  const tags = parseEMVCoQRIS(qrisString);
  let acquirer = '';
  let nmid = '';
  for (let t = 26; t <= 51; t++) {
    const key = String(t);
    if (!tags[key]) continue;
    const gui = subTag(tags[key], '00');
    if (gui === 'ID.CO.QRIS.WWW') nmid = subTag(tags[key], '02') || nmid;
    else if (!acquirer) acquirer = gui;
  }
  return {
    merchantName: (tags['59'] || '').trim(),
    city: (tags['60'] || '').trim(),
    postalCode: tags['61'] || '',
    nmid,
    acquirer,
    isStatic: tags['01'] === '11',
    isDynamic: tags['01'] === '12',
    amount: tags['54'] ? Number(tags['54']) : null,
    currency: tags['53'] || '',
    country: tags['58'] || ''
  };
}

export function validateQRIS(qrisString) {
  const str = cleanQRISPayload(qrisString);
  const errors = [];
  const warnings = [];
  if (!str) return { ok: false, errors: ['String QRIS kosong.'], warnings, info: null, payload: str };
  if (!str.startsWith('000201')) errors.push('Bukan payload EMVCo: harus diawali 000201.');
  const { error } = parseTLV(str);
  if (error) errors.push(`Struktur TLV rusak: ${error}.`);
  if (!verifyCRC(str)) errors.push('Checksum CRC tidak cocok. Pastikan string disalin utuh tanpa terpotong.');
  const info = describeQRIS(str);
  if (!info.merchantName) errors.push('Nama merchant (tag 59) tidak ditemukan.');
  if (info.currency && info.currency !== '360') errors.push('Mata uang bukan Rupiah (tag 53 harus 360).');
  if (!info.nmid) warnings.push('NMID QRIS (tag 51) tidak ditemukan. Beberapa aplikasi mungkin menolak.');
  if (info.isDynamic) warnings.push('Ini QRIS dinamis. Nominal akan ditimpa sesuai tagihan, tetapi sebaiknya pakai QRIS statis asli dari poster toko.');
  return { ok: errors.length === 0, errors, warnings, info, payload: str };
}

// Converts a static merchant QRIS into a dynamic one with a fixed amount and
// bill number. Tag order is preserved; CRC is recomputed.
export function convertStaticToDynamicQRIS(rawStaticString, amount, invoiceNumber) {
  const raw = cleanQRISPayload(rawStaticString);
  if (raw.length < 30) throw new Error('Format string QRIS statis tidak valid.');
  const body = raw.replace(/6304[A-Fa-f0-9]{4}$/i, '');
  const { items, error } = parseTLV(body);
  if (error) throw new Error(`Format string QRIS statis tidak valid: ${error}`);

  const cleanInvoice = String(invoiceNumber || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20) || 'INV01';
  const amountText = String(Math.max(1, Math.round(Number(amount) || 0)));

  let list = items.filter((it) => it.tag !== '63' && it.tag !== '54');
  list = list.map((it) => (it.tag === '01' ? { tag: '01', value: '12' } : it));
  if (!list.some((it) => it.tag === '01')) list.splice(1, 0, { tag: '01', value: '12' });

  const at53 = list.findIndex((it) => it.tag === '53');
  list.splice(at53 >= 0 ? at53 + 1 : list.length, 0, { tag: '54', value: amountText });

  const existing62 = list.find((it) => it.tag === '62');
  const subs = existing62 ? parseTLV(existing62.value).items.filter((s) => s.tag !== '01') : [];
  const value62 = buildTLV([{ tag: '01', value: cleanInvoice }, ...subs]);
  if (existing62) existing62.value = value62;
  else list.push({ tag: '62', value: value62 });

  const withPrefix = `${buildTLV(list)}6304`;
  return withPrefix + calculateCRC16(withPrefix);
}

export function generateDynamicQRISPayload({ merchantName, merchantCity, amount, invoiceNumber, nmid = 'ID1020023456789' }) {
  const items = [
    { tag: '00', value: '01' },
    { tag: '01', value: '12' },
    { tag: '26', value: buildTLV([{ tag: '00', value: 'ID.CO.QRIS.WWW' }, { tag: '01', value: nmid }, { tag: '02', value: '01' }]) },
    { tag: '52', value: '5812' },
    { tag: '53', value: '360' },
    { tag: '54', value: String(Math.round(amount)) },
    { tag: '58', value: 'ID' },
    { tag: '59', value: merchantName.substring(0, 25).toUpperCase() },
    { tag: '60', value: merchantCity.substring(0, 15).toUpperCase() },
    { tag: '61', value: '12950' },
    { tag: '62', value: buildTLV([{ tag: '01', value: String(invoiceNumber || 'INV01').replace(/[^A-Za-z0-9]/g, '').slice(0, 16) || 'INV01' }, { tag: '07', value: 'A01' }]) }
  ];
  const withPrefix = `${buildTLV(items)}6304`;
  return withPrefix + calculateCRC16(withPrefix);
}

function getQRGenerator() {
  if (typeof qrcodeEngine === 'function') return qrcodeEngine;
  if (typeof window !== 'undefined' && window.qrcode) return window.qrcode;
  if (typeof globalThis !== 'undefined' && globalThis.qrcode) return globalThis.qrcode;
  return null;
}

// Returns the module matrix so callers can draw to SVG or canvas.
export function qrMatrix(text) {
  const gen = getQRGenerator();
  if (!gen) return null;
  for (const level of ['M', 'L']) {
    try {
      const qr = gen(0, level);
      qr.addData(text);
      qr.make();
      const count = qr.getModuleCount();
      const rows = [];
      for (let r = 0; r < count; r++) {
        const row = [];
        for (let c = 0; c < count; c++) row.push(qr.isDark(r, c));
        rows.push(row);
      }
      return rows;
    } catch (err) {
      // retry with lower error correction for long payloads
    }
  }
  return null;
}

export function renderQRCodeSVG(text, { label = 'Kode QRIS', margin = 2, size = 236 } = {}) {
  const matrix = qrMatrix(text);
  if (!matrix) {
    return `<div class="qr-fallback" role="img" aria-label="${label}" style="padding:16px; font-size:0.8rem; text-align:center; color:#374151;">Modul QR belum termuat. Silakan muat ulang halaman.</div>`;
  }
  const count = matrix.length + margin * 2;
  let path = '';
  matrix.forEach((row, r) => {
    row.forEach((dark, c) => {
      if (dark) path += `M${c + margin} ${r + margin}h1v1h-1z`;
    });
  });
  return `<svg class="qr-svg" width="${size}" height="${size}" viewBox="0 0 ${count} ${count}" style="width:100%; height:100%; max-width:${size}px; max-height:${size}px; aspect-ratio:1/1; display:block; margin:0 auto;" role="img" aria-label="${label}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="${count}" height="${count}" fill="#FFFFFF"/><path d="${path}" fill="#000000"/></svg>`;
}

export function renderQRCodeCanvas(canvasEl, text, { size = 236, margin = 2 } = {}) {
  const gen = getQRGenerator();
  if (!gen || !canvasEl) return false;
  for (const level of ['M', 'L']) {
    try {
      const qr = gen(0, level);
      qr.addData(text);
      qr.make();
      const count = qr.getModuleCount();
      const totalCount = count + margin * 2;
      canvasEl.width = size;
      canvasEl.height = size;
      const ctx = canvasEl.getContext('2d');
      if (!ctx) return false;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#000000';
      const cell = size / totalCount;
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect(Math.round((c + margin) * cell), Math.round((r + margin) * cell), Math.ceil(cell), Math.ceil(cell));
          }
        }
      }
      return true;
    } catch {
      // retry
    }
  }
  return false;
}

export async function scanQRISFromImageFile(file) {
  if (!file) throw new Error('File gambar tidak ditemukan.');

  const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal membaca gambar.'));
    img.src = src;
  });

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);

    // 1. Native BarcodeDetector if available in browser
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const detected = await detector.detect(img);
        if (detected && detected.length > 0 && detected[0].rawValue) {
          return cleanQRISPayload(detected[0].rawValue);
        }
      } catch (err) {
        console.warn('BarcodeDetector error, using jsQR fallback:', err);
      }
    }

    // 2. jsQR fallback
    const canvas = document.createElement('canvas');
    const maxDim = 1200;
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D tidak didukung.');

    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    const getJsQR = () => {
      if (typeof window !== 'undefined' && typeof window.jsQR === 'function') return window.jsQR;
      if (typeof globalThis !== 'undefined' && typeof globalThis.jsQR === 'function') return globalThis.jsQR;
      return null;
    };

    const jsQR = getJsQR();
    if (jsQR) {
      const code = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
      if (code && code.data) {
        return cleanQRISPayload(code.data);
      }
    } else {
      throw new Error('Modul pembaca QR (jsQR) belum termuat. Pastikan jsqr.js dimuat.');
    }

    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
