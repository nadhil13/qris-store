// Shared order list so a buyer's phone and the admin's laptop see the same
// orders. Persists to Vercel KV / Upstash Redis when their env vars are set.
// Without them it falls back to process memory, which survives on a local
// `node server.js` but is lost whenever a Vercel function instance recycles.

const ORDERS_KEY = 'atelier_orders';
const MAX_ORDERS = 200;
const MAX_BODY_BYTES = 64 * 1024;

let ordersMemory = [];

const MERGE_ORDER_SCRIPT = `
local raw = redis.call('GET', KEYS[1]) or '[]'
local existing = cjson.decode(raw)
local incoming = cjson.decode(ARGV[1])
local limit = tonumber(ARGV[2])
if not string.match(raw, '^%s*%[') then
  return redis.error_reply('Orders must be a JSON array')
end
local fragments = {}
local depth, start = 0, 1
local quoted, escaped = false, false
for i = 1, #raw do
  local ch = string.sub(raw, i, i)
  if quoted then
    if escaped then escaped = false
    elseif ch == '\\\\' then escaped = true
    elseif ch == '"' then quoted = false end
  elseif ch == '"' then quoted = true
  elseif ch == '[' or ch == '{' then
    depth = depth + 1
    if depth == 1 then start = i + 1 end
  elseif ch == ']' or ch == '}' then
    depth = depth - 1
    if depth == 0 and string.match(string.sub(raw, start, i - 1), '%S') then
      table.insert(fragments, string.sub(raw, start, i - 1))
    end
  elseif ch == ',' and depth == 1 then
    table.insert(fragments, string.sub(raw, start, i - 1))
    start = i + 1
  end
end
local entries = {}
local found = false
local changed = 1
for i, order in ipairs(existing) do
  local entry = { order = order, raw = fragments[i], position = i }
  if not found and order.id == incoming.id then
    found = true
    if (tonumber(incoming.updatedAt) or 0) < (tonumber(order.updatedAt) or 0) then
      changed = 0
    else
      entry.order = incoming
      entry.raw = ARGV[1]
    end
  end
  table.insert(entries, entry)
end
if not found then
  table.insert(entries, { order = incoming, raw = ARGV[1], position = 0 })
  table.sort(entries, function(a, b)
    local at = tonumber(a.order.createdAt) or 0
    local bt = tonumber(b.order.createdAt) or 0
    if at == bt then return a.position < b.position end
    return at > bt
  end)
end
local result = {}
for i = 1, math.min(#entries, limit) do result[i] = entries[i].raw end
if changed == 1 or #entries > limit then
  redis.call('SET', KEYS[1], '[' .. table.concat(result, ',') .. ']')
end
return changed
`;

class OrderStorageError extends Error {}

function getKVClient() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
  }
  return null;
}

async function kvRequest(kv, path, options = {}) {
  try {
    const response = await fetch(`${kv.url.replace(/\/$/, '')}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${kv.token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(4000)
    });
    if (!response.ok) throw new Error('KV HTTP failure');
    const data = await response.json();
    if (!data || data.error || !Object.hasOwn(data, 'result')) throw new Error('KV command failure');
    return data.result;
  } catch {
    throw new OrderStorageError('Order storage unavailable');
  }
}

async function readOrders(kv) {
  if (!kv) return ordersMemory;
  const result = await kvRequest(kv, `/get/${ORDERS_KEY}`);
  if (result === null) return [];
  try {
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    if (!Array.isArray(parsed)) throw new Error('Invalid orders');
    return parsed;
  } catch {
    throw new OrderStorageError('Order storage unavailable');
  }
}

function isValidOrder(o) {
  return o
    && typeof o.id === 'string' && o.id.length <= 64
    && typeof o.status === 'string'
    && Array.isArray(o.items) && o.items.length <= 100
    && o.totals && typeof o.totals === 'object';
}

// Newer updatedAt wins, so a late "awaiting" write cannot undo "paid".
export function mergeOrder(list, incoming) {
  const index = list.findIndex((o) => o.id === incoming.id);
  if (index < 0) {
    return [incoming, ...list]
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .slice(0, MAX_ORDERS);
  }
  if (Number(incoming.updatedAt || 0) < Number(list[index].updatedAt || 0)) return list;
  const next = list.slice();
  next[index] = incoming;
  return next;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const kv = getKVClient();
  const storage = kv ? 'kv' : 'memory';

  if (req.method === 'GET') {
    try {
      const orders = await readOrders(kv);
      res.status(200).json({ ok: true, storage, orders });
    } catch {
      res.status(503).json({ ok: false, error: 'Order storage unavailable' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        if (body.length > MAX_BODY_BYTES) {
          res.status(413).json({ ok: false, error: 'Order payload too large' });
          return;
        }
        body = JSON.parse(body);
      }
      const order = body && body.order;
      if (!isValidOrder(order)) {
        res.status(400).json({ ok: false, error: 'Invalid order' });
        return;
      }
      if (kv) {
        const result = await kvRequest(kv, '', {
          method: 'POST',
          body: JSON.stringify(['EVAL', MERGE_ORDER_SCRIPT, 1, ORDERS_KEY, JSON.stringify(order), MAX_ORDERS])
        });
        if (result !== 0 && result !== 1) throw new OrderStorageError('Order storage unavailable');
      } else {
        ordersMemory = mergeOrder(ordersMemory, order);
      }
      res.status(200).json({ ok: true, storage, id: order.id });
    } catch (err) {
      res.status(err instanceof OrderStorageError ? 503 : 500).json({ ok: false, error: err.message });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
}
