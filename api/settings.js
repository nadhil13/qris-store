// Serverless endpoint for global settings persistence across all visitors on Vercel
// Backed by persistent cloud storage with fallback to Upstash Redis / Vercel KV if configured

const CLOUD_STORAGE_URL = 'https://api.restful-api.dev/objects/ff808181a09d98f701a1beb3e79f6bc2';

const DEFAULT_QRIS = '00020101021126610014COM.GO-JEK.WWW01189360091430501410280210G0501410280303UMI51440014ID.CO.QRIS.WWW0215ID10265330868010303UMI5204899953033605802ID5925Toko Terpusat Belanja, Di6013JAKARTA BARAT61051182062070703A0163048201';

// Version 0 so a cold-start default never overrides a visitor's saved QRIS.
let inMemorySettings = {
  payload: DEFAULT_QRIS,
  merchantName: 'Atelier Nusantara',
  updatedAt: 0
};

async function getKVClient() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return {
      type: 'vercel-kv',
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN
    };
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      type: 'upstash',
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    };
  }
  return null;
}

async function readFromCloud() {
  const kv = await getKVClient();
  if (kv) {
    try {
      const res = await fetch(`${kv.url}/get/atelier_settings`, {
        headers: { Authorization: `Bearer ${kv.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.result) {
          const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('KV read error:', e.message);
    }
  }

  // Fallback to cloud REST store
  try {
    const res = await fetch(CLOUD_STORAGE_URL, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('Cloud storage read error:', err.message);
  }

  return inMemorySettings;
}

async function writeToCloud(settings) {
  // The admin's browser stamps the version; keeping it lets every client
  // compare against the same clock. Reject writes older than what is stored.
  const incomingVersion = Number(settings.updatedAt || settings.qris?.updatedAt || 0) || Date.now();
  const existing = await readFromCloud();
  if (existing && Number(existing.updatedAt || 0) > incomingVersion) {
    return { ...existing, stale: true };
  }

  const payloadToSave = {
    payload: settings.payload || settings.qris?.payload || DEFAULT_QRIS,
    merchantName: settings.merchantName || settings.store?.name || 'Atelier Nusantara',
    updatedAt: incomingVersion,
    store: settings.store || { name: 'Atelier Nusantara' }
  };

  inMemorySettings = payloadToSave;

  const kv = await getKVClient();
  if (kv) {
    try {
      await fetch(`${kv.url}/set/atelier_settings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kv.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payloadToSave)
      });
    } catch (e) {
      console.warn('KV write error:', e.message);
    }
  }

  // Also write to persistent cloud REST store
  try {
    await fetch(CLOUD_STORAGE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'qris_store_settings',
        data: payloadToSave
      }),
      signal: AbortSignal.timeout(4000)
    });
  } catch (err) {
    console.warn('Cloud storage write error:', err.message);
  }

  return payloadToSave;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      const data = await readFromCloud();
      const version = Number(data.updatedAt || 0);
      res.status(200).json({
        ok: true,
        source: 'cloud',
        settings: {
          updatedAt: version,
          qris: {
            payload: data.payload || DEFAULT_QRIS,
            merchantName: data.merchantName || 'Atelier Nusantara',
            updatedAt: version
          },
          store: data.store || null
        }
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, settings: { qris: { payload: DEFAULT_QRIS } } });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      const saved = await writeToCloud(body || {});
      res.status(200).json({
        ok: true,
        stale: Boolean(saved.stale),
        message: saved.stale ? 'A newer version is already stored.' : 'Settings saved globally for all visitors.',
        settings: {
          updatedAt: saved.updatedAt,
          qris: {
            payload: saved.payload,
            merchantName: saved.merchantName,
            updatedAt: saved.updatedAt
          },
          store: saved.store
        }
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
}
