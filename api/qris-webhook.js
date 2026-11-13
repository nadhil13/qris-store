import { createHash, timingSafeEqual } from 'node:crypto';
import { INVENTORY_SCRIPT } from './lib/inventory-script.js';

const MAX_WEBHOOK_BODY = 16 * 1024;
const VALID_ID = /^[A-Za-z0-9_-]{3,80}$/;
const normalizeSecret = (value) => String(value ?? '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
const digest = (value) => createHash('sha256').update(String(value)).digest();

function cleanAmountNumber(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutCurrency = trimmed.replace(/^(?:Rp\.?|IDR)\s*/i, '').trim();
  // Support formatted Indonesian totals ("173.412" / "54.000,00") or comma-grouped ("54,000").
  const stripDecimals = withoutCurrency.replace(/,[0-9]{1,2}$/, '');
  const normalized = stripDecimals.includes('.')
    ? stripDecimals.replace(/\./g, '')
    : stripDecimals.replace(/,/g, '');
  if (!/^[0-9]{3,12}$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseIndonesianAmount(payload) {
  if (payload == null) return null;
  if (typeof payload === 'number') return cleanAmountNumber(payload);

  if (typeof payload === 'object') {
    for (const key of ['amount', 'nominal', 'total', 'gross_amount', 'value']) {
      if (payload[key] !== undefined && payload[key] !== null) {
        const direct = cleanAmountNumber(payload[key]);
        if (direct) return direct;
      }
    }
    const textCandidate = [
      payload.text,
      payload.message,
      payload.notification,
      payload.body,
      payload.title
    ].filter((part) => typeof part === 'string' && part.trim()).join(' ');
    if (textCandidate) return parseIndonesianAmount(textCandidate);
    return null;
  }

  if (typeof payload !== 'string') return null;
  const text = payload.trim();
  if (!text) return null;

  const currencyMatch = text.match(/(?:Rp\.?|IDR)\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]+)(?:,[0-9]{1,2})?/i);
  if (currencyMatch) {
    return cleanAmountNumber(currencyMatch[1]);
  }

  const keywordMatch = text.match(/(?:sebesar|nominal|sejumlah|senilai|total)\s+(?:Rp\.?\s*)?([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,})(?:,[0-9]{1,2})?/i);
  if (keywordMatch) {
    return cleanAmountNumber(keywordMatch[1]);
  }

  return null;
}

export function authorizeWebhook(req) {
  const secret = normalizeSecret(process.env.QRIS_WEBHOOK_SECRET);
  if (!secret) return 503;

  const authHeader = req.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const candidate = authHeader.slice(7).trim();
    if (candidate && timingSafeEqual(digest(candidate), digest(secret))) return 0;
    return 401;
  }

  const altHeader = req.headers?.['x-webhook-secret'];
  if (typeof altHeader === 'string') {
    const candidate = altHeader.trim();
    if (candidate && timingSafeEqual(digest(candidate), digest(secret))) return 0;
    return 401;
  }

  return 401;
}

function getKVConfig() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return {
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN
    };
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    };
  }
  return null;
}

export default async function handler(req, res, { localExecutor } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Secret');

  const send = (status, body) => res.status(status).json(body);

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const secretConfigured = Boolean(normalizeSecret(process.env.QRIS_WEBHOOK_SECRET));
    return send(200, {
      ok: true,
      configured: secretConfigured,
      endpoint: '/api/qris-webhook'
    });
  }

  if (req.method !== 'POST') {
    return send(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const authStatus = authorizeWebhook(req);
  if (authStatus === 503) {
    return send(503, { ok: false, code: 'WEBHOOK_NOT_CONFIGURED' });
  }
  if (authStatus !== 0) {
    return send(401, { ok: false, code: 'UNAUTHORIZED' });
  }

  let body;
  try {
    body = req.body;
    const rawSize = Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body ?? ''));
    if (rawSize > MAX_WEBHOOK_BODY) {
      return send(413, { ok: false, code: 'PAYLOAD_TOO_LARGE' });
    }
    if (typeof body === 'string') {
      const trimmed = body.trim();
      if (!trimmed) return send(400, { ok: false, code: 'INVALID_REQUEST' });
      body = trimmed.startsWith('{') ? JSON.parse(trimmed) : { text: trimmed };
    }
  } catch {
    return send(400, { ok: false, code: 'INVALID_REQUEST' });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return send(400, { ok: false, code: 'INVALID_REQUEST' });
  }

  const amount = parseIndonesianAmount(body);
  const idRaw = typeof body.orderId === 'string' ? body.orderId : (typeof body.id === 'string' ? body.id : '');
  const id = VALID_ID.test(idRaw.trim()) ? idRaw.trim() : '';
  const invoice = typeof body.invoice === 'string' ? body.invoice.trim().slice(0, 64) : '';
  const reference = typeof body.reference === 'string'
    ? body.reference.trim().slice(0, 120)
    : (typeof body.ref === 'string' ? body.ref.trim().slice(0, 120) : '');
  const textSnippet = typeof body.text === 'string'
    ? body.text.trim().slice(0, 180)
    : (typeof body.message === 'string' ? body.message.trim().slice(0, 180) : '');
  const note = typeof body.note === 'string' && body.note.trim()
    ? body.note.trim().slice(0, 200)
    : (textSnippet ? `GoPay Merchant: ${textSnippet}` : 'Verifikasi otomatis GoPay Merchant');

  if (!id && !invoice && !(Number.isInteger(amount) && amount > 0)) {
    return send(400, { ok: false, code: 'AMOUNT_NOT_FOUND' });
  }

  const commandInput = {
    action: 'webhook_confirm',
    id,
    invoice,
    amount: Number.isInteger(amount) && amount > 0 ? amount : 0,
    reference,
    confirmedBy: 'gopay_merchant_webhook',
    note
  };

  try {
    let result;
    if (typeof localExecutor === 'function') {
      result = localExecutor(commandInput);
    } else {
      const kv = getKVConfig();
      if (!kv) return send(503, { ok: false, code: 'STORAGE_UNAVAILABLE' });
      const response = await fetch(kv.url.replace(/\/$/, ''), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kv.token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify(['EVAL', INVENTORY_SCRIPT, 2, 'atelier_inventory_v1', 'atelier_settings', JSON.stringify(commandInput)])
      });
      if (!response.ok) throw new Error('KV HTTP failure');
      const envelope = await response.json();
      if (envelope.error || typeof envelope.result !== 'string') throw new Error('KV command failure');
      result = JSON.parse(envelope.result);
    }

    if (!result || typeof result !== 'object' || typeof result.ok !== 'boolean') {
      return send(503, { ok: false, code: 'STORAGE_UNAVAILABLE' });
    }
    if (!result.ok) {
      const { status, ...payload } = result;
      return send(Number.isInteger(status) ? status : 409, payload);
    }
    return send(200, result);
  } catch {
    return send(503, { ok: false, code: 'STORAGE_UNAVAILABLE' });
  }
}

