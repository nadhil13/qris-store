import { createHash, timingSafeEqual } from 'node:crypto';
import { INVENTORY_SCRIPT } from './lib/inventory-script.js';
import { authorizeInventoryAdmin, INVENTORY_SEED_PRODUCTS } from './inventory.js';

const MAX_WEBHOOK_BODY = 16 * 1024;
const VALID_ID = /^[A-Za-z0-9_-]{3,80}$/;
const WEBHOOK_LOG_KEY = 'atelier_qris_webhook_logs';
const MAX_WEBHOOK_LOGS = 10;
const MEMORY_WEBHOOK_LOGS = [];
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
  // Support formatted Indonesian totals ("173.412" / "54.000,00") or comma-grouped ("54,000.00").
  const stripDecimals = withoutCurrency
    .replace(/,[0-9]{1,2}$/, '')
    .replace(/(?<=[0-9]{3})\.[0-9]{1,2}$/, '');
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
      payload.title,
      payload.text,
      payload.message,
      payload.notification,
      payload.body
    ].filter((part) => typeof part === 'string' && part.trim()).join(' ');
    if (textCandidate) return parseIndonesianAmount(textCandidate);
    return null;
  }

  if (typeof payload !== 'string') return null;
  const text = payload.replace(/[\u0000-\u001F]+/g, ' ').trim();
  if (!text) return null;

  const POSITIVE_CUES = /\b(?:diterima|terima|masuk|sebesar|nominal|sejumlah|senilai|pembayaran|transaksi|tagihan|dibayar|bayar|transfer)\b/gi;
  const NEGATIVE_CUES = /\b(?:saldo|sisa|cashback|promo|diskon|potongan|biaya|admin|fee|poin|bonus|hemat|voucher|kupon|maksimal|minimal|limit)\b/gi;

  const lastMatchOffset = (segment, regex) => {
    regex.lastIndex = 0;
    let lastEnd = -1;
    let m;
    while ((m = regex.exec(segment)) !== null) {
      lastEnd = m.index + m[0].length;
    }
    return lastEnd;
  };

  const scoreCandidate = (startIndex, kindWeight) => {
    const rawPrefix = text.slice(Math.max(0, startIndex - 64), startIndex);
    const clauseParts = rawPrefix.split(/[.!?\n,;:|]+/);
    const clausePrefix = clauseParts[clauseParts.length - 1] || rawPrefix;
    const lowerClause = clausePrefix.toLowerCase();
    const posIdx = lastMatchOffset(lowerClause, POSITIVE_CUES);
    const negIdx = lastMatchOffset(lowerClause, NEGATIVE_CUES);
    let score = kindWeight;
    if (negIdx > posIdx) {
      score -= 30;
    } else if (posIdx > negIdx) {
      score += 30;
    } else {
      const lowerBroad = rawPrefix.toLowerCase();
      const broadPos = lastMatchOffset(lowerBroad, POSITIVE_CUES);
      const broadNeg = lastMatchOffset(lowerBroad, NEGATIVE_CUES);
      if (broadNeg > broadPos) score -= 15;
      else if (broadPos > broadNeg) score += 15;
    }
    return score;
  };

  const candidates = [];
  const currencyRegex = /(?:Rp\.?|IDR)\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]+)(?:[.,][0-9]{1,2})?/gi;
  let match;
  while ((match = currencyRegex.exec(text)) !== null) {
    const amount = cleanAmountNumber(match[1]);
    if (amount) {
      candidates.push({ amount, score: scoreCandidate(match.index, 5), index: match.index });
    }
  }

  const keywordRegex = /(?:sebesar|nominal|sejumlah|senilai|total|diterima|terima|masuk|pembayaran|transaksi|tagihan)\s+(?:Rp\.?\s*)?([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,})(?:[.,][0-9]{1,2})?/gi;
  while ((match = keywordRegex.exec(text)) !== null) {
    const amount = cleanAmountNumber(match[1]);
    if (amount) {
      candidates.push({ amount, score: scoreCandidate(match.index, 2), index: match.index });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  return candidates[0].amount;
}

async function kvCommand(kv, command) {
  const response = await fetch(kv.url.replace(/\/$/, ''), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kv.token}`,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(4000),
    body: JSON.stringify(command)
  });
  if (!response.ok) throw new Error('KV HTTP failure');
  return response.json();
}

function sanitizeEvent(entry) {
  return {
    at: Number(entry.at) || Date.now(),
    status: Number(entry.status) || 0,
    code: String(entry.code || '').slice(0, 40),
    amount: Number.isInteger(entry.amount) && entry.amount > 0 ? entry.amount : null,
    orderId: String(entry.orderId || '').slice(0, 80),
    invoice: String(entry.invoice || '').slice(0, 64),
    snippet: String(entry.snippet || '').replace(/[\u0000-\u001F]+/g, ' ').trim().slice(0, 96)
  };
}

async function recordWebhookEvent(kv, entry, useMemory = false) {
  const safe = sanitizeEvent(entry);
  if (useMemory || !kv) {
    MEMORY_WEBHOOK_LOGS.unshift(safe);
    if (MEMORY_WEBHOOK_LOGS.length > MAX_WEBHOOK_LOGS) MEMORY_WEBHOOK_LOGS.length = MAX_WEBHOOK_LOGS;
    return;
  }
  try {
    await kvCommand(kv, [
      'EVAL',
      'redis.call("LPUSH", KEYS[1], ARGV[1]); redis.call("LTRIM", KEYS[1], 0, 9); redis.call("EXPIRE", KEYS[1], 604800); return 1',
      1,
      WEBHOOK_LOG_KEY,
      JSON.stringify(safe)
    ]);
  } catch { }
}

async function readWebhookEvents(kv, useMemory = false) {
  if (useMemory || !kv) return MEMORY_WEBHOOK_LOGS.slice(0, MAX_WEBHOOK_LOGS);
  try {
    const res = await kvCommand(kv, ['LRANGE', WEBHOOK_LOG_KEY, 0, MAX_WEBHOOK_LOGS - 1]);
    const list = Array.isArray(res?.result) ? res.result : [];
    return list.map((raw) => {
      try { return sanitizeEvent(typeof raw === 'string' ? JSON.parse(raw) : raw); }
      catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function readWebhookBody(req) {
  const desc = Object.getOwnPropertyDescriptor(req, 'body');
  if (desc && ('value' in desc || !req.readable)) {
    return req.body;
  }
  if (typeof req.on === 'function' && req.readable !== false) {
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      totalBytes += buf.length;
      if (totalBytes > MAX_WEBHOOK_BODY) {
        const err = new Error('Payload too large');
        err.status = 413;
        throw err;
      }
      chunks.push(buf);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    if (raw.length > 0) return raw;
  }
  return req.body;
}

function parseWebhookPayload(rawBody) {
  if (rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)) return rawBody;
  if (typeof rawBody !== 'string') return null;
  const trimmed = rawBody.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('{')) return { text: trimmed };
  try {
    return JSON.parse(trimmed);
  } catch {
    // Android notifications pushed via MacroDroid often insert raw newlines/tabs inside JSON strings.
    const sanitized = trimmed.replace(/[\u0000-\u001F]+/g, ' ');
    try {
      return JSON.parse(sanitized);
    } catch {
      if (parseIndonesianAmount(sanitized)) return { text: sanitized };
      return null;
    }
  }
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

  const kv = getKVConfig();
  const useMemoryLog = typeof localExecutor === 'function' || !kv;

  if (req.method === 'GET') {
    const secretConfigured = Boolean(normalizeSecret(process.env.QRIS_WEBHOOK_SECRET));
    const isAdmin = authorizeInventoryAdmin(req) === 0;
    const recentEvents = isAdmin ? await readWebhookEvents(kv, useMemoryLog) : undefined;
    return send(200, {
      ok: true,
      configured: secretConfigured,
      endpoint: '/api/qris-webhook',
      ...(isAdmin ? { recentEvents } : {})
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
    await recordWebhookEvent(kv, { status: 401, code: 'UNAUTHORIZED', snippet: 'Secret header tidak cocok' }, useMemoryLog);
    return send(401, { ok: false, code: 'UNAUTHORIZED' });
  }

  let body;
  try {
    const rawBody = await readWebhookBody(req);
    const rawSize = Buffer.byteLength(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody ?? ''));
    if (rawSize > MAX_WEBHOOK_BODY) {
      return send(413, { ok: false, code: 'PAYLOAD_TOO_LARGE' });
    }
    body = parseWebhookPayload(rawBody);
  } catch (err) {
    if (err?.status === 413) return send(413, { ok: false, code: 'PAYLOAD_TOO_LARGE' });
    body = null;
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    await recordWebhookEvent(kv, { status: 400, code: 'INVALID_REQUEST', snippet: 'Body bukan JSON valid atau kosong' }, useMemoryLog);
    return send(400, { ok: false, code: 'INVALID_REQUEST' });
  }

  const amount = parseIndonesianAmount(body);
  const idRaw = typeof body.orderId === 'string' ? body.orderId : (typeof body.id === 'string' ? body.id : '');
  const id = VALID_ID.test(idRaw.trim()) ? idRaw.trim() : '';
  const invoice = typeof body.invoice === 'string' ? body.invoice.trim().slice(0, 64) : '';
  const reference = typeof body.reference === 'string'
    ? body.reference.trim().slice(0, 120)
    : (typeof body.ref === 'string' ? body.ref.trim().slice(0, 120) : '');
  const textSnippet = [body.title, body.text, body.message, body.notification, body.body]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .replace(/[\u0000-\u001F]+/g, ' ')
    .trim()
    .slice(0, 180);
  const note = typeof body.note === 'string' && body.note.trim()
    ? body.note.trim().slice(0, 200)
    : (textSnippet ? `GoPay Merchant: ${textSnippet}` : 'Verifikasi otomatis GoPay Merchant');

  if (!id && !invoice && !(Number.isInteger(amount) && amount > 0)) {
    await recordWebhookEvent(kv, { status: 400, code: 'AMOUNT_NOT_FOUND', snippet: textSnippet || 'Teks tanpa nominal Rp' }, useMemoryLog);
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
      if (!kv) return send(503, { ok: false, code: 'STORAGE_UNAVAILABLE' });
      const envelope = await kvCommand(kv, ['EVAL', INVENTORY_SCRIPT, 2, 'atelier_inventory_v1', 'atelier_settings', JSON.stringify({ ...commandInput, seedProducts: INVENTORY_SEED_PRODUCTS })]);
      if (envelope.error || typeof envelope.result !== 'string') throw new Error('KV command failure');
      result = JSON.parse(envelope.result);
    }

    if (!result || typeof result !== 'object' || typeof result.ok !== 'boolean') {
      return send(503, { ok: false, code: 'STORAGE_UNAVAILABLE' });
    }
    if (!result.ok) {
      const { status, ...payload } = result;
      const httpStatus = Number.isInteger(status) ? status : 409;
      await recordWebhookEvent(kv, {
        status: httpStatus,
        code: payload.code || 'REJECTED',
        amount: commandInput.amount,
        snippet: textSnippet
      }, useMemoryLog);
      return send(httpStatus, payload);
    }
    await recordWebhookEvent(kv, {
      status: 200,
      code: 'CONFIRMED',
      amount: result.order?.totals?.total || commandInput.amount,
      orderId: result.order?.id || '',
      invoice: result.order?.invoice || '',
      snippet: textSnippet
    }, useMemoryLog);
    return send(200, result);
  } catch {
    return send(503, { ok: false, code: 'STORAGE_UNAVAILABLE' });
  }
}

