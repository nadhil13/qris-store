import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let child;
let port;
let sibling;
before(async () => {
  sibling = await mkdtemp(path.join(path.dirname(root), `${path.basename(root)}-security-`));
  await writeFile(path.join(sibling, 'private.css'), 'private sibling fixture');
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const env = { ...process.env, PORT: String(port), NODE_ENV: 'development' };
  for (const name of ['VERCEL_ENV', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'INVENTORY_ADMIN_TOKEN']) delete env[name];
  child = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server readiness timeout')), 10000);
    child.once('error', reject);
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Server exited before readiness')); });
    child.stdout.once('data', () => { clearTimeout(timer); resolve(); });
  });
});
after(async () => {
  if (child && child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
  if (sibling) await rm(sibling, { recursive: true, force: true });
});
function request(url, { method = 'GET', body, chunked = false, headers = {}, targetPort = port } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: targetPort, path: url, method, headers: {
      ...(body && !chunked ? { 'Content-Length': Buffer.byteLength(body) } : {}), ...headers
    } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    if (body) {
      if (chunked) {
        for (let i = 0; i < body.length; i += 4096) req.write(body.slice(i, i + 4096));
      } else req.write(body);
    }
    req.end();
  });
}
for (const url of ['/.git/HEAD', '/api/settings.js', '/api/orders.js', '/api/inventory.js', '/api/lib/inventory-script.js', '/server.js', '/tests/orders-api.test.mjs', '/README.md', '/.env', '/scripts/../server.js']) {
  test(`private repository path is not public: ${url}`, async () => {
    assert.equal((await request(url)).status, 404);
  });
}
test('encoded Windows separators cannot escape to a sibling sharing the root prefix', async () => {
  const response = await request(`/..%5c${path.basename(sibling)}%5cprivate.css`);
  assert.equal(response.status, 404);
  assert.doesNotMatch(response.body, /private sibling fixture/);
});
for (const url of ['/missing%3Cimg%20src=x%20onerror=alert(1)%3E', '/%ZZ', '/assets/%00.svg', '/scripts/%2e%2e%5cserver.js', '/assets/%252e%252e%255cserver.js', '/constructor/file.js', '/toString/file.js']) {
  test(`invalid or missing paths return a non-reflective plain-text 404: ${url}`, async () => {
    const response = await request(url);
    assert.equal(response.status, 404);
    assert.match(response.headers['content-type'], /^text\/plain/);
    assert.equal(response.body, '404 Not Found');
  });
}
test('storefront, PWA cache entries, and QR image remain accessible', async () => {
  const sw = await readFile(path.join(root, 'sw.js'), 'utf8');
  const urls = [...sw.matchAll(/^  '\.([^']*)'/gm)].map(match => match[1] || '/');
  for (const url of [...urls, '/sw.js', '/qris/qris_dil.jpeg', '/scripts/app.js?v=test']) {
    assert.equal((await request(url)).status, 200, url);
  }
});
for (const endpoint of ['settings', 'orders', 'inventory']) {
  for (const chunked of [false, true]) {
    test(`${endpoint}: rejects ${chunked ? 'chunked' : 'declared'} bodies above 64 KiB before parsing`, async () => {
      const response = await request(`/api/${endpoint}`, { method: 'POST', body: 'x'.repeat(65537), chunked });
      assert.equal(response.status, 413);
      assert.equal(JSON.parse(response.body).code, 'PAYLOAD_TOO_LARGE');
      assert.equal(response.headers['cache-control'], 'no-store');
    });
  }
}
test('64 KiB UTF-8 settings body remains accepted in no-KV development', async () => {
  const body = JSON.stringify({ padding: 'é'.repeat(32761) });
  assert.equal(Buffer.byteLength(body), 65536);
  assert.equal((await request('/api/settings', { method: 'POST', body })).status, 200);
  const oversized = JSON.stringify({ padding: 'é'.repeat(32762) });
  assert.equal((await request('/api/settings', { method: 'POST', body: oversized })).status, 413);
});
test('preview child server enforces durable guards over HTTP without contacting KV', async () => {
  let storageCalls = 0;
  const storage = http.createServer((_req, res) => {
    storageCalls++;
    res.writeHead(500);
    res.end();
  });
  storage.listen(0, '127.0.0.1');
  await once(storage, 'listening');
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const targetPort = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const env = { ...process.env, PORT: String(targetPort), NODE_ENV: 'development', VERCEL_ENV: 'preview',
    KV_REST_API_URL: `http://127.0.0.1:${storage.address().port}`, KV_REST_API_TOKEN: 'test-only-token',
    INVENTORY_ADMIN_TOKEN: 'test-only-admin' };
  const preview = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Preview readiness timeout')), 10000);
      preview.once('error', reject);
      preview.once('exit', () => { clearTimeout(timer); reject(new Error('Preview exited early')); });
      preview.stdout.once('data', () => { clearTimeout(timer); resolve(); });
    });
    assert.equal((await request('/api/settings', { targetPort, method: 'POST', body: '{invalid' })).status, 401);
    assert.equal((await request('/api/orders', { targetPort })).status, 401);
    for (const headers of [{}, { authorization: 'Bearer test-only-admin' }]) {
      const response = await request('/api/orders', { targetPort, method: 'POST', body: '{invalid', headers });
      assert.equal(response.status, 409);
      assert.equal(JSON.parse(response.body).code, 'LEGACY_ORDER_WRITES_DISABLED');
    }
    assert.equal(storageCalls, 0);
  } finally {
    if (preview.exitCode === null) {
      const exited = once(preview, 'exit');
      preview.kill();
      await exited;
    }
    await new Promise(resolve => storage.close(resolve));
  }
});
