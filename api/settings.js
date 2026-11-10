import { createHash, timingSafeEqual } from 'node:crypto';

const SETTINGS_KEY = 'atelier_settings';
const DEFAULT_QRIS = '00020101021126610014COM.GO-JEK.WWW01189360091430501410280210G0501410280303UMI51440014ID.CO.QRIS.WWW0215ID10265330868010303UMI5204899953033605802ID5925Toko Terpusat Belanja, Di6013JAKARTA BARAT61051182062070703A0163048201';

// Atomic Redis Lua script to merge settings and catalog domains independently without read-modify-write races.
const MERGE_SETTINGS_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
local existing = {}
if raw then
  local ok, decoded = pcall(cjson.decode, raw)
  if ok and type(decoded) == 'table' then
    existing = decoded
  end
end

local incoming = cjson.decode(ARGV[1])
local defaultQris = ARGV[2]
if type(existing.qris) ~= 'table' then existing.qris = nil end
if type(existing.store) ~= 'table' then existing.store = nil end

local existingUpdatedAt = tonumber(existing.updatedAt or (existing.qris and existing.qris.updatedAt) or 0) or 0
local existingCatalogUpdatedAt = tonumber(existing.catalogUpdatedAt or 0) or 0

local nextPayload = existing.payload or (existing.qris and existing.qris.payload) or defaultQris
local nextMerchant = existing.merchantName or (existing.qris and existing.qris.merchantName) or (existing.store and existing.store.name) or 'Atelier Nusantara'
local nextUpdatedAt = existingUpdatedAt
local nextStore = existing.store
local stale = false

if incoming.hasSettingsInput then
  local incVer = tonumber(incoming.settingsVersion or 0) or 0
  if existingUpdatedAt > incVer then
    stale = true
  else
    nextUpdatedAt = incVer
    if incoming.payload and incoming.payload ~= '' then
      nextPayload = incoming.payload
    end
    if incoming.hasStoreInput then
      nextStore = incoming.store
    elseif nextStore == nil then
      nextStore = { name = 'Atelier Nusantara' }
    end
    if incoming.merchantName and incoming.merchantName ~= '' then
      nextMerchant = incoming.merchantName
    elseif type(nextStore) == 'table' and nextStore.name and nextStore.name ~= '' then
      nextMerchant = nextStore.name
    end
  end
end

local nextCatalogUpdatedAt = existingCatalogUpdatedAt
local nextProducts = existing.products
local productsJson = existing.productsJson
if type(productsJson) ~= 'string' then
  if type(nextProducts) == 'table' then
    productsJson = next(nextProducts) == nil and '[]' or cjson.encode(nextProducts)
  else
    productsJson = 'null'
  end
end
local staleCatalog = false

if incoming.hasCatalogInput then
  local incCatVer = tonumber(incoming.catalogVersion or 0) or 0
  if existingCatalogUpdatedAt > incCatVer then
    staleCatalog = true
  elseif type(incoming.products) == 'table' then
    nextCatalogUpdatedAt = incCatVer
    nextProducts = incoming.products
    productsJson = incoming.productsJson
  end
end

local record = {
  payload = nextPayload,
  merchantName = nextMerchant,
  updatedAt = nextUpdatedAt,
  store = nextStore,
  catalogUpdatedAt = nextCatalogUpdatedAt,
  productsJson = productsJson
}

local function encodeRecord(value)
  local encoded = cjson.encode(value)
  return string.sub(encoded, 1, -2) .. ',"products":' .. productsJson .. '}'
end
redis.call('SET', KEYS[1], encodeRecord(record))
record.stale = stale
record.staleCatalog = staleCatalog
return encodeRecord(record)
`;

class SettingsStorageError extends Error {}

// Version 0 so a cold-start default never overrides a visitor's saved state.
let inMemorySettings = {
  payload: DEFAULT_QRIS,
  merchantName: 'Atelier Nusantara',
  updatedAt: 0,
  store: null,
  catalogUpdatedAt: 0,
  products: null
};

function getKVClient() {
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

async function kvRequest(kv, path, options = {}) {
  try {
    const res = await fetch(`${kv.url.replace(/\/$/, '')}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${kv.token}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) throw new Error('KV HTTP failure');
    const data = await res.json();
    if (!data || data.error || !Object.hasOwn(data, 'result')) {
      throw new Error('KV command failure');
    }
    return data.result;
  } catch {
    throw new SettingsStorageError('Settings storage unavailable');
  }
}

function normalizeStoredRecord(raw) {
  const base = raw && typeof raw === 'object' ? raw : {};
  const updatedAt = Number(base.updatedAt || base.qris?.updatedAt || 0);
  const catalogUpdatedAt = Number(base.catalogUpdatedAt || 0);
  const products = Array.isArray(base.products) ? base.products : null;
  return {
    payload: base.payload || base.qris?.payload || DEFAULT_QRIS,
    merchantName: base.merchantName || base.qris?.merchantName || base.store?.name || 'Atelier Nusantara',
    updatedAt,
    store: base.store || null,
    catalogUpdatedAt,
    products
  };
}

async function readFromCloud(kv) {
  if (!kv) {
    return normalizeStoredRecord(inMemorySettings);
  }
  const result = await kvRequest(kv, `/get/${SETTINGS_KEY}`);
  if (result === null) {
    return normalizeStoredRecord(null);
  }
  try {
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    return normalizeStoredRecord(parsed);
  } catch {
    throw new SettingsStorageError('Settings storage unavailable');
  }
}

export function mergeSharedState(existingRaw, incomingRaw) {
  const existing = normalizeStoredRecord(existingRaw);
  const incoming = incomingRaw && typeof incomingRaw === 'object' ? incomingRaw : {};

  const hasSettingsInput = Boolean(
    incoming.updatedAt !== undefined
    || incoming.payload !== undefined
    || incoming.qris !== undefined
    || incoming.store !== undefined
    || incoming.merchantName !== undefined
  );
  const hasCatalogInput = Boolean(
    incoming.catalogUpdatedAt !== undefined
    || Array.isArray(incoming.products)
  );

  let nextPayload = existing.payload;
  let nextMerchant = existing.merchantName;
  let nextUpdatedAt = existing.updatedAt;
  let nextStore = existing.store;
  let stale = false;

  if (hasSettingsInput) {
    const incomingSettingsVersion = Number(incoming.updatedAt ?? incoming.qris?.updatedAt ?? 0) || Date.now();
    if (existing.updatedAt > incomingSettingsVersion) {
      stale = true;
    } else {
      nextUpdatedAt = incomingSettingsVersion;
      nextPayload = incoming.payload || incoming.qris?.payload || existing.payload || DEFAULT_QRIS;
      nextStore = incoming.store !== undefined ? incoming.store : (existing.store || { name: 'Atelier Nusantara' });
      nextMerchant = incoming.merchantName || incoming.qris?.merchantName || nextStore?.name || existing.merchantName || 'Atelier Nusantara';
    }
  }

  let nextCatalogUpdatedAt = existing.catalogUpdatedAt;
  let nextProducts = existing.products;
  let staleCatalog = false;

  if (hasCatalogInput) {
    const incomingCatalogVersion = Number(incoming.catalogUpdatedAt || 0) || Date.now();
    if (existing.catalogUpdatedAt > incomingCatalogVersion) {
      staleCatalog = true;
    } else if (Array.isArray(incoming.products)) {
      nextCatalogUpdatedAt = incomingCatalogVersion;
      nextProducts = incoming.products;
    }
  }

  return {
    payload: nextPayload,
    merchantName: nextMerchant,
    updatedAt: nextUpdatedAt,
    store: nextStore,
    catalogUpdatedAt: nextCatalogUpdatedAt,
    products: nextProducts,
    stale,
    staleCatalog
  };
}

async function writeToCloud(kv, incomingRaw) {
  const incoming = incomingRaw && typeof incomingRaw === 'object' ? incomingRaw : {};
  if (kv) {
    const hasSettingsInput = Boolean(
      incoming.updatedAt !== undefined
      || incoming.payload !== undefined
      || incoming.qris !== undefined
      || incoming.store !== undefined
      || incoming.merchantName !== undefined
    );
    const hasCatalogInput = Boolean(
      incoming.catalogUpdatedAt !== undefined
      || Array.isArray(incoming.products)
    );
    const evalPayload = {
      hasSettingsInput,
      settingsVersion: hasSettingsInput ? (Number(incoming.updatedAt ?? incoming.qris?.updatedAt ?? 0) || Date.now()) : 0,
      payload: incoming.payload || incoming.qris?.payload || '',
      merchantName: incoming.merchantName || incoming.qris?.merchantName || '',
      hasStoreInput: incoming.store !== undefined,
      store: incoming.store !== undefined ? incoming.store : null,
      productsJson: JSON.stringify(Array.isArray(incoming.products) ? incoming.products : null),
      hasCatalogInput,
      catalogVersion: hasCatalogInput ? (Number(incoming.catalogUpdatedAt || 0) || Date.now()) : 0,
      products: Array.isArray(incoming.products) ? incoming.products : null
    };
    const rawResult = await kvRequest(kv, '', {
      method: 'POST',
      body: JSON.stringify(['EVAL', MERGE_SETTINGS_SCRIPT, 1, SETTINGS_KEY, JSON.stringify(evalPayload), DEFAULT_QRIS])
    });
    const parsed = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.payload !== 'string'
      || !Number.isFinite(parsed.updatedAt) || !Number.isFinite(parsed.catalogUpdatedAt)
      || (parsed.products !== null && !Array.isArray(parsed.products))) {
      throw new SettingsStorageError('Invalid settings storage response');
    }
    const normalized = normalizeStoredRecord(parsed);
    return {
      ...normalized,
      stale: Boolean(parsed?.stale),
      staleCatalog: Boolean(parsed?.staleCatalog)
    };
  }

  const existing = await readFromCloud(null);
  const merged = mergeSharedState(existing, incoming);
  inMemorySettings = {
    payload: merged.payload,
    merchantName: merged.merchantName,
    updatedAt: merged.updatedAt,
    store: merged.store,
    catalogUpdatedAt: merged.catalogUpdatedAt,
    products: merged.products
  };
  return merged;
}

function formatSettingsResponse(data) {
  const version = Number(data.updatedAt || 0);
  const catalogVersion = Number(data.catalogUpdatedAt || 0);
  return {
    updatedAt: version,
    qris: {
      payload: data.payload || DEFAULT_QRIS,
      merchantName: data.merchantName || 'Atelier Nusantara',
      updatedAt: version
    },
    store: data.store || null,
    catalogUpdatedAt: catalogVersion,
    products: Array.isArray(data.products) ? data.products : null
  };
}

function authorizeAdmin(req) {
  const secret = process.env.INVENTORY_ADMIN_TOKEN;
  if (!secret) return 503;
  const header = req.headers?.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return 401;
  const digest = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret)) ? 0 : 401;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const kv = getKVClient();
  const storage = kv ? 'kv' : 'memory';
  const production = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if (production && (req.method === 'GET' || req.method === 'POST')) {
    if (!kv) {
      res.status(503).json({ ok: false, code: 'STORAGE_UNAVAILABLE', error: 'Settings storage unavailable' });
      return;
    }
    if (req.method === 'POST') {
      const status = authorizeAdmin(req);
      if (status) {
        res.status(status).json({ ok: false, code: status === 401 ? 'UNAUTHORIZED' : 'ADMIN_UNAVAILABLE' });
        return;
      }
    }
  }

  if (req.method === 'GET') {
    try {
      const data = await readFromCloud(kv);
      res.status(200).json({
        ok: true,
        storage,
        source: 'cloud',
        settings: formatSettingsResponse(data)
      });
    } catch (err) {
      res.status(err instanceof SettingsStorageError ? 503 : 500).json({
        ok: false,
        error: err.message
      });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      const saved = await writeToCloud(kv, body || {});
      res.status(200).json({
        ok: true,
        storage,
        stale: Boolean(saved.stale),
        staleCatalog: Boolean(saved.staleCatalog),
        message: saved.stale || saved.staleCatalog
          ? 'A newer version is already stored.'
          : 'Settings saved globally for all visitors.',
        settings: formatSettingsResponse(saved)
      });
    } catch (err) {
      res.status(err instanceof SettingsStorageError ? 503 : 500).json({
        ok: false,
        error: err.message
      });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
}
