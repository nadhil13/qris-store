import net from 'node:net';
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const incomplete = Symbol('incomplete');
function parse(buffer, offset = 0) {
  const end = buffer.indexOf('\r\n', offset);
  if (end < 0) return incomplete;
  const kind = String.fromCharCode(buffer[offset]);
  const value = buffer.toString('utf8', offset + 1, end);
  let next = end + 2;
  if (kind === '+' || kind === '-') return { value: kind === '-' ? new Error(value) : value, next };
  if (kind === ':') return { value: Number(value), next };
  const size = Number(value);
  if (!Number.isInteger(size) || size < -1) throw new Error('Invalid RESP length');
  if (size === -1) return { value: null, next };
  if (kind === '$') {
    if (buffer.length < next + size + 2) return incomplete;
    if (buffer.toString('ascii', next + size, next + size + 2) !== '\r\n') throw new Error('Invalid RESP bulk string');
    return { value: buffer.toString('utf8', next, next + size), next: next + size + 2 };
  }
  if (kind === '*') {
    const values = [];
    for (let i = 0; i < size; i++) {
      const item = parse(buffer, next);
      if (item === incomplete) return incomplete;
      values.push(item.value);
      next = item.next;
    }
    return { value: values, next };
  }
  throw new Error('Unsupported RESP response');
}

export function redisCommand(port, command, sockets = new Set()) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    sockets.add(socket);
    let buffer = Buffer.alloc(0);
    let settled = false;
    function finish(error, value) {
      if (settled) return;
      settled = true;
      sockets.delete(socket);
      socket.destroy();
      if (error) reject(error); else resolve(value);
    }
    socket.setTimeout(10000, () => finish(new Error('Redis command timed out')));
    socket.on('error', error => finish(error));
    socket.on('close', () => finish(new Error('Redis connection closed before response')));
    socket.on('connect', () => {
      const parts = [Buffer.from(`*${command.length}\r\n`)];
      for (const argument of command) {
        const bytes = Buffer.from(String(argument));
        parts.push(Buffer.from(`$${bytes.length}\r\n`), bytes, Buffer.from('\r\n'));
      }
      socket.write(Buffer.concat(parts));
    });
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        const result = parse(buffer);
        if (result !== incomplete) finish(result.value instanceof Error ? result.value : null, result.value);
      } catch (error) { finish(error); }
    });
  });
}

export async function startRedisRestBridge(redisPort) {
  const token = randomBytes(32).toString('hex');
  const expected = Buffer.from(`Bearer ${token}`);
  const sockets = new Set();
  const clients = new Set();
  const server = http.createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    const supplied = Buffer.from(req.headers.authorization || '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      req.resume();
      return reply(401, { error: 'Unauthorized' });
    }
    if (req.method !== 'POST' || req.url !== '/') {
      req.resume();
      return reply(405, { error: 'POST / required' });
    }
    try {
      let length = 0;
      const chunks = [];
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 8 * 1024 * 1024) return reply(413, { error: 'Request too large' });
        chunks.push(chunk);
      }
      const command = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!Array.isArray(command) || command.length === 0 || !command.every(v => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))) {
        return reply(400, { error: 'Expected Redis command array' });
      }
      try { reply(200, { result: await redisCommand(redisPort, command, sockets) }); }
      catch (error) { reply(200, { error: error.message }); }
    } catch { reply(400, { error: 'Invalid request' }); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 15000;
  server.on('connection', socket => {
    clients.add(socket);
    socket.on('close', () => clients.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}/`, token,
    async close() {
      const closed = new Promise(resolve => server.close(resolve));
      for (const socket of sockets) socket.destroy();
      for (const socket of clients) socket.destroy();
      await closed;
    }
  };
}
