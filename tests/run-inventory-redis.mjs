import { spawn } from 'node:child_process';
import net from 'node:net';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { redisCommand, startRedisRestBridge } from './helpers/redis-rest-bridge.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const executable = process.env.INVENTORY_TEST_REDIS_SERVER || path.join(tmpdir(), 'atelier-redis-test', 'redis-server.exe');
const children = new Set();
let bridge, directory;
function launch(command, args, options = {}) {
  const child = spawn(command, args, { cwd: root, windowsHide: true, ...options });
  children.add(child);
  child.done = new Promise(resolve => {
    child.once('error', error => resolve({ error }));
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  return child;
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  let timer;
  try {
    await Promise.race([
      child.done,
      new Promise(resolve => { timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000); })
    ]);
    await child.done;
  } finally { clearTimeout(timer); }
}
const interrupt = () => { for (const child of children) child.kill(); };
process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);
try {
  await access(executable);
  directory = await mkdtemp(path.join(tmpdir(), 'inventory-redis-'));
  const port = await freePort();
  const redis = launch(executable, [
    '--bind', '127.0.0.1', '--port', String(port), '--protected-mode', 'yes',
    '--save', '', '--appendonly', 'no', '--dir', directory
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Redis startup timed out')), 10000);
    let output = '';
    const ready = chunk => {
      output = (output + chunk.toString()).slice(-8192);
      if (/ready to accept connections/i.test(output)) { clearTimeout(timer); resolve(); }
    };
    redis.stdout.on('data', ready);
    redis.stderr.on('data', ready);
    redis.done.then(() => { clearTimeout(timer); reject(new Error('Redis exited before integration completed')); });
  });
  const info = await redisCommand(port, ['INFO', 'server']);
  console.log(`Real Redis ${info.match(/^redis_version:(.+)$/m)?.[1].trim() || 'unknown'}; isolated loopback runtime, persistence disabled.`);
  bridge = await startRedisRestBridge(port);
  const child = launch(process.execPath, ['--test', 'tests/inventory-api.test.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, INVENTORY_TEST_REDIS_URL: bridge.url, INVENTORY_TEST_REDIS_TOKEN: bridge.token }
  });
  const result = await Promise.race([
    child.done,
    redis.done.then(() => ({ error: new Error('Redis exited during tests') }))
  ]);
  if (result.error) throw result.error;
  process.exitCode = result.code ?? 1;
} catch (error) {
  console.error(`Inventory Redis integration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  try {
    if (bridge) await bridge.close();
  } finally {
    await Promise.all([...children].map(stop));
    if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 3 });
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    console.log('Integration cleanup complete: child processes stopped and temporary directory removed.');
  }
}
