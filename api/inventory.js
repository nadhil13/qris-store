import { createHash, timingSafeEqual } from 'node:crypto';
import { INVENTORY_SCRIPT } from './lib/inventory-script.js';
import { PRODUCTS as SEED_PRODUCTS } from '../scripts/core/catalog.js';
export { INVENTORY_SCRIPT };

export const INVENTORY_SEED_PRODUCTS = SEED_PRODUCTS.map((product) => ({
  id: product.id,
  name: product.name,
  price: product.price,
  stock: product.stock ?? null,
  category: product.category,
  requiresShipping: product.requiresShipping !== undefined ? Boolean(product.requiresShipping) : product.category !== 'digital',
  isAvailable: product.isAvailable !== false,
  image: product.image,
  variants: Array.isArray(product.variants) ? product.variants : []
}));

const MAX_BODY = 64 * 1024;
const idPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const capabilityPattern = /^[a-zA-Z0-9_-]{43,128}$/;
const validId = value => typeof value === 'string' && idPattern.test(value);
const validCapability = value => typeof value === 'string' && capabilityPattern.test(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const integer = (value, max = 1e9) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const text = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
export const INVENTORY_COMMERCE = {
  shipping: [
    { id: 'instant', name: 'Kurir instan', price: 15000, eta: '1-2 jam' },
    { id: 'regular', name: 'Kurir reguler', price: 10000, eta: '1-2 hari' },
    { id: 'pickup', name: 'Ambil di toko', price: 0, eta: 'Siap 30 menit' }
  ],
  packagingFee: 2000,
  vouchers: [{ code: 'RASAHEMAT', percent: 15, active: true }]
};

function invalid() { const error = new Error('Invalid inventory request'); error.status = 400; throw error; }
function exactKeys(value, keys) { if (!object(value) || Object.keys(value).some(k => !keys.includes(k))) invalid(); }
function normalize(body) {
  if (!object(body)) invalid();
  const { action } = body;
  if (action === 'reserve') {
    exactKeys(body, ['action','id','capability','items','customer','shippingId','voucherCode','paymentMethod']);
    if (!validId(body.id) || !validCapability(body.capability) || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) invalid();
    exactKeys(body.customer, ['name','phone','address']);
    if (!text(body.customer.name,100,true) || !text(body.customer.phone,24,true) || !/^\+?[0-9 ()-]{8,24}$/.test(body.customer.phone) || body.customer.phone.replace(/\D/g,'').length < 8 || !text(body.customer.address ?? '',500)) invalid();
    if (!text(body.shippingId,64,true) || !text(body.voucherCode ?? '',64) || !['qris','whatsapp'].includes(body.paymentMethod ?? 'qris')) invalid();
    const items = body.items.map(line => {
      exactKeys(line,['productId','variant','qty','note']);
      if (!validId(line.productId) || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99 || !text(line.variant ?? '',100) || !text(line.note ?? '',140)) invalid();
      return { productId:line.productId, variant:line.variant ?? '', qty:line.qty, note:(line.note ?? '').trim() };
    }).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
    const normalized = { action, id:body.id, items, customer:{ name:body.customer.name.trim(), phone:body.customer.phone.trim(), address:(body.customer.address ?? '').trim() }, shippingId:body.shippingId, voucherCode:(body.voucherCode ?? '').trim().toUpperCase(), paymentMethod:body.paymentMethod ?? 'qris' };
    return { ...normalized, capabilityHash:hash(body.capability), fingerprint:hash(JSON.stringify(normalized)), commerce: INVENTORY_COMMERCE };
  }
  if (['confirm','cancel','advance'].includes(action)) {
    exactKeys(body,['action','id','expectedStatus','reference','note']);
    if (!validId(body.id) || !text(body.reference ?? '',100) || !text(body.note ?? '',140)) invalid();
    if (action === 'advance' && !['paid','processing','ready'].includes(body.expectedStatus)) invalid();
    return { action, id:body.id, expectedStatus:body.expectedStatus, reference:body.reference ?? '', note:body.note ?? '' };
  }
  if (action === 'adjust') {
    exactKeys(body,['action','productId','stock','expectedRevision']);
    if (!validId(body.productId) || !(body.stock === null || integer(body.stock)) || !integer(body.expectedRevision,Number.MAX_SAFE_INTEGER)) invalid();
    return { action, productId:body.productId, stock:body.stock, expectedRevision:body.expectedRevision };
  }
  invalid();
}

// Dashboard-pasted env values often carry quotes, spaces or a trailing newline.
const normalizeSecret = value => String(value ?? '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();

export function authorizeInventoryAdmin(req) {
  const secret = normalizeSecret(process.env.INVENTORY_ADMIN_TOKEN);
  if (!secret) return 503;
  const header = req.headers?.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return 401;
  return timingSafeEqual(Buffer.from(hash(header.slice(7).trim())),Buffer.from(hash(secret))) ? 0 : 401;
}

export function parseInventoryInput(req) {
  if (req.method === 'GET') {
    const query = req.query || Object.fromEntries(new URL(req.url || '/','http://localhost').searchParams);
    const action = query.action || 'stock';
    if (!['stock','order','list'].includes(action)) invalid();
    if (action === 'list') {
      const status = authorizeInventoryAdmin(req);
      if (status) return { ok: false, status, body: { ok: false, code: status === 401 ? 'UNAUTHORIZED' : 'ADMIN_UNAVAILABLE' } };
    }
    if (action === 'order' && (!validId(query.id) || !validCapability(query.capability))) invalid();
    return { ok: true, input: { action, ...(action === 'order' ? { id: query.id, capabilityHash: hash(query.capability) } : {}) } };
  }
  let body = req.body;
  let serialized;
  try { serialized = typeof body === 'string' ? body : JSON.stringify(body); } catch { invalid(); }
  if (Buffer.byteLength(serialized || '') > MAX_BODY) return { ok: false, status: 413, body: { ok: false, code: 'PAYLOAD_TOO_LARGE' } };
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { invalid(); } }
  if (['confirm','cancel','advance','adjust'].includes(body?.action)) {
    const status = authorizeInventoryAdmin(req);
    if (status) return { ok: false, status, body: { ok: false, code: status === 401 ? 'UNAUTHORIZED' : 'ADMIN_UNAVAILABLE' } };
  }
  return { ok: true, input: normalize(body) };
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  const send = (status,body) => res.status(status).json(body);
  if (!['GET','POST','OPTIONS'].includes(req.method)) return send(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  if (req.method === 'OPTIONS') { res.setHeader('Allow','GET, POST, OPTIONS'); return res.status(204).end(); }
  try {
    const parsed = parseInventoryInput(req);
    if (!parsed.ok) return send(parsed.status, parsed.body);
    const { input } = parsed;
    const url=process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN ? process.env.KV_REST_API_URL : process.env.UPSTASH_REDIS_REST_URL;
    const token=process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN ? process.env.KV_REST_API_TOKEN : process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return send(503,{ok:false,code:'STORAGE_UNAVAILABLE'});
    const response=await fetch(url.replace(/\/$/,''),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(4000),body:JSON.stringify(['EVAL',INVENTORY_SCRIPT,2,'atelier_inventory_v1','atelier_settings',JSON.stringify({ ...input, seedProducts: INVENTORY_SEED_PRODUCTS })])});
    if (!response.ok) throw Error();
    const envelope=await response.json();
    if (envelope.error || typeof envelope.result!=='string') throw Error();
    const result=JSON.parse(envelope.result);
    if (!object(result) || typeof result.ok!=='boolean') throw Error();
    if (!result.ok && (!Number.isInteger(result.status) || result.status<400 || result.status>599 || !/^[A-Z_]+$/.test(result.code))) throw Error();
    const { status,...payload }=result;
    return send(result.ok?200:status,payload);
  } catch(error) {
    return send(error.status===400?400:503,{ok:false,code:error.status===400?'INVALID_REQUEST':'STORAGE_UNAVAILABLE'});
  }
}
