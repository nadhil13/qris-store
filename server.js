import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import settingsHandler from './api/settings.js';
import ordersHandler from './api/orders.js';
import inventoryHandler, { authorizeInventoryAdmin } from './api/inventory.js';
import qrisWebhookHandler from './api/qris-webhook.js';
import { createLocalInventoryEngine } from './api/lib/local-inventory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const MAX_BODY_BYTES = 64 * 1024;
const PUBLIC_FILES = new Set(['/index.html', '/manifest.json', '/sw.js']);
const PUBLIC_ROOTS = {
  scripts: new Set(['.js']),
  styles: new Set(['.css']),
  assets: new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.woff', '.woff2', '.ttf']),
  qris: new Set(['.png', '.jpg', '.jpeg', '.webp'])
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let exceeded = false;
    const tooLarge = () => Object.assign(new Error('Payload too large'), { statusCode: 413 });
    if (Number(req.headers['content-length']) > MAX_BODY_BYTES) {
      req.resume();
      reject(tooLarge());
      return;
    }
    req.on('data', chunk => {
      if (exceeded) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        exceeded = true;
        chunks.length = 0;
        reject(tooLarge());
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!exceeded) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
    req.on('aborted', () => reject(new Error('Request aborted')));
  });
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  res.end('404 Not Found');
}

function publicPath(pathname) {
  const parts = pathname.slice(1).split('/');
  if (!pathname.startsWith('/') || /[\\\\\u0000-\u001f\u007f%:]/.test(pathname)
    || parts.some(part => !part || part.startsWith('.'))) return null;
  if (!PUBLIC_FILES.has(pathname)
    && (!Object.hasOwn(PUBLIC_ROOTS, parts[0]) || !PUBLIC_ROOTS[parts[0]].has(path.extname(pathname)))) return null;
  const candidate = path.resolve(ROOT, ...parts);
  try {
    const realPath = fs.realpathSync(candidate);
    const relative = path.relative(ROOT, realPath);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
    if (!fs.statSync(realPath).isFile()) return null;
    return realPath;
  } catch {
    return null;
  }
}

function adaptServerless(req, res, body) {
  req.body = body;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
    return res;
  };
  return { req, res };
}

const localInventoryHandler = createLocalInventoryEngine();

function isKVConfigured() {
  return Boolean(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
    || (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

function isLocalDevWithoutKV() {
  return !isKVConfigured()
    && process.env.NODE_ENV !== 'production'
    && process.env.VERCEL_ENV !== 'production'
    && process.env.VERCEL_ENV !== 'preview';
}

export async function handleRequest(req, res) {
  try {
    let pathname;
    try {
      pathname = decodeURIComponent(req.url.split('?')[0]);
    } catch {
      notFound(res);
      return;
    }

    if (pathname === '/api/inventory' || pathname === '/api/inventory/') {
      adaptServerless(req, res, await parseBody(req));
      await (isLocalDevWithoutKV() ? localInventoryHandler(req, res) : inventoryHandler(req, res));
      return;
    }
    if (pathname === '/api/qris-webhook' || pathname === '/api/qris-webhook/') {
      adaptServerless(req, res, await parseBody(req));
      await qrisWebhookHandler(
        req,
        res,
        isLocalDevWithoutKV() ? { localExecutor: localInventoryHandler.execute } : undefined
      );
      return;
    }
    if (pathname === '/api/settings' || pathname === '/api/settings/') {
      const body = await parseBody(req);
      adaptServerless(req, res, body);
      await settingsHandler(req, res);
      return;
    }
    if (pathname === '/api/orders' || pathname === '/api/orders/') {
      const body = await parseBody(req);
      adaptServerless(req, res, body);
      if (req.method === 'GET') {
        const authStatus = authorizeInventoryAdmin(req);
        if (authStatus) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.status(authStatus).json({ ok: false, code: authStatus === 401 ? 'UNAUTHORIZED' : 'ADMIN_UNAVAILABLE' });
          return;
        }
      }
      await ordersHandler(req, res);
      return;
    }

    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    const safePath = publicPath(pathname);

    if (safePath) {
      const ext = path.extname(safePath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(safePath).pipe(res);
    } else {
      notFound(res);
    }
  } catch (err) {
    if (err.statusCode === 413) {
      res.writeHead(413, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: false, code: 'PAYLOAD_TOO_LARGE' }));
      return;
    }
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500 Internal Server Error');
  }
}

const server = http.createServer(handleRequest);

const isMainEntry = Boolean(process.argv[1]) && path.resolve(process.argv[1]).toLowerCase() === __filename.toLowerCase();
if (isMainEntry) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('Server Atelier Nusantara Berjalan!');
    console.log(`Buka Storefront  : http://localhost:${PORT}/`);
    console.log(`Buka Panel Admin : http://localhost:${PORT}/?admin=1`);
    if (isLocalDevWithoutKV()) {
      console.log('Mode lokal       : penyimpanan in-memory aktif tanpa Redis/KV');
    }
  });
}
