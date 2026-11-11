import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';

const names = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'INVENTORY_ADMIN_TOKEN'];
let env, originalFetch, api;
beforeEach(async () => {
  env = Object.fromEntries(names.map(k => [k, process.env[k]]));
  names.forEach(k => delete process.env[k]);
  originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('Unexpected network'); };
  api = await import('../api/inventory.js');
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  names.forEach(k => env[k] === undefined ? delete process.env[k] : process.env[k] = env[k]);
});
const draft = () => ({ action: 'reserve', id: 'ord_test', capability: 'a'.repeat(43), items: [{ productId: 'prod-01', variant: '', qty: 1 }], customer: { name: 'Buyer', phone: '081234567890', address: 'Jakarta address' }, shippingId: 'regular', paymentMethod: 'qris' });
async function request(method = 'POST', body = draft(), query = {}, token) {
  const res = { headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(n) { this.statusCode=n; return this; }, json(v) { this.body=v; return this; }, end() {} };
  await api.default({ method, body, query, headers: token ? { authorization: `Bearer ${token}` } : {} }, res);
  return res;
}
function kv() { process.env.KV_REST_API_URL='https://redis.example'; process.env.KV_REST_API_TOKEN='private-kv'; }
function mock(result) { const calls=[]; globalThis.fetch=async (url, options) => { calls.push({url,options,command:JSON.parse(options.body)}); return {ok:true,json:async()=>({result:JSON.stringify(result)})}; }; return calls; }

test('fails closed without durable storage', async () => { assert.equal((await request()).statusCode,503); });
test('rejects malformed JSON, totals, invalid quantities, missing capabilities and customer schema', async () => {
  for (const body of ['{', {...draft(),totals:{total:1}}, {...draft(),items:[{productId:'x',qty:1.5}]}, {...draft(),capability:''}, {...draft(),customer:{name:'',phone:'x'}}, {...draft(),paymentMethod:'cash'}]) assert.equal((await request('POST',body)).statusCode,400);
  assert.equal((await request('POST','x'.repeat(65537))).statusCode,413);
});
test('admin operations require configured constant-time bearer authorization', async () => {
  kv();
  for (const action of ['confirm','cancel','advance','adjust']) assert.equal((await request('POST',{action,id:'ord_test'})).statusCode,503);
  process.env.INVENTORY_ADMIN_TOKEN='admin-test';
  for (const action of ['confirm','cancel','advance','adjust']) assert.equal((await request('POST',{action,id:'ord_test'})).statusCode,401);
  assert.equal((await request('GET',null,{action:'list'})).statusCode,401);
});
test('GET never lists customer orders publicly; lookup requires a capability', async () => {
  kv();
  assert.equal((await request('GET',null,{action:'order',id:'ord_test'})).statusCode,400);
  const calls=mock({ok:true,stock:{revision:0,products:{}}});
  assert.equal((await request('GET',null,{})).statusCode,200);
  assert.equal(JSON.parse(calls[0].command[5]).action,'stock');
});
test('reserve submits one atomic script with hashed capability and normalized immutable fingerprint', async () => {
  kv(); const calls=mock({ok:true,order:{id:'ord_test'},stock:{revision:1,products:{}}});
  const response=await request(); assert.equal(response.statusCode,200);
  const cmd=calls[0].command;
  assert.deepEqual(cmd.slice(0,1),['EVAL']); assert.equal(cmd[1],api.INVENTORY_SCRIPT);
  assert.deepEqual(cmd.slice(2,5),[2,'atelier_inventory_v1','atelier_settings']);
  const payload=JSON.parse(cmd[5]); assert.equal(payload.capability,undefined); assert.match(payload.capabilityHash,/^[a-f0-9]{64}$/); assert.match(payload.fingerprint,/^[a-f0-9]{64}$/);
  assert.equal(payload.items[0].note,''); assert.equal(payload.commerce.packagingFee,2000);
  assert.equal(payload.commerce.shipping.find(s=>s.id==='regular').price,10000);
  assert.equal(payload.commerce.vouchers[0].percent,15);
  await request(); assert.equal(JSON.parse(calls[1].command[5]).fingerprint,payload.fingerprint);
  assert.equal(calls.length,2); assert.ok(calls[0].options.signal instanceof AbortSignal);
});
test('accepts schema-name and numeric-looking reservation and product IDs without a reserved-name blacklist', async () => {
  kv();
  const calls = mock({ok:true});
  for (const id of ['items', 'timeline', 'orders', 'stock', 'holds', 'quantities', '1', '01', '0', '123']) {
    const response = await request('POST', {...draft(), id, items:[{productId:id,qty:1}]});
    assert.equal(response.statusCode,200);
    const payload = JSON.parse(calls.at(-1).command[5]);
    assert.equal(payload.id,id);
    assert.equal(payload.items[0].productId,id);
  }
});
test('maps explicit script errors and hides transport errors and credentials', async () => {
  kv(); mock({ok:false,code:'OUT_OF_STOCK',status:409}); assert.equal((await request()).statusCode,409);
  globalThis.fetch=async()=>{ throw Error('private-kv admin-test'); };
  const res=await request(); assert.equal(res.statusCode,503); assert.ok(!JSON.stringify(res.body).includes('private-kv'));
  globalThis.fetch=async()=>({ok:true,json:async()=>({error:'secret'})}); assert.equal((await request()).statusCode,503);
});
test('stock adjustments require nonnegative absolute stock and expectedRevision CAS', async () => {
  kv(); process.env.INVENTORY_ADMIN_TOKEN='admin-test';
  for (const body of [{action:'adjust',productId:'prod-01',stock:2},{action:'adjust',productId:'prod-01',stock:-1,expectedRevision:0}]) assert.equal((await request('POST',body,{},'admin-test')).statusCode,400);
  const calls=mock({ok:true,stock:{revision:1,products:{}}});
  assert.equal((await request('POST',{action:'adjust',productId:'prod-01',stock:2,expectedRevision:0},{},'admin-test')).statusCode,200);
  assert.equal(JSON.parse(calls[0].command[5]).expectedRevision,0);
});
test('exported script uses server TIME, separate holds, bounded reclamation and one final SET', () => {
  assert.match(api.INVENTORY_SCRIPT,/redis.call\('TIME'\)/);
  assert.match(api.INVENTORY_SCRIPT,/holds/);
  assert.match(api.INVENTORY_SCRIPT,/RECLAIM_LIMIT/);
  assert.equal((api.INVENTORY_SCRIPT.match(/redis.call\('SET'/g)||[]).length,1);
});

test('real Redis: canonical totals, concurrency, retries, expiry, transitions, CAS and empty arrays', {
  skip: !(process.env.INVENTORY_TEST_REDIS_URL && process.env.INVENTORY_TEST_REDIS_TOKEN)
}, async () => {
  const prefix = `inventory-test:{${crypto.randomUUID()}}`;
  const keys = [`${prefix}:state`,`${prefix}:settings`];
  async function command(...cmd) {
    const response=await originalFetch(process.env.INVENTORY_TEST_REDIS_URL,{method:'POST',headers:{Authorization:`Bearer ${process.env.INVENTORY_TEST_REDIS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(cmd),signal:AbortSignal.timeout(10000)});
    assert.equal(response.ok,true,'Redis HTTP command failed');
    const data=await response.json(); assert.equal(Boolean(data.error),false,'Redis command failed'); return data.result;
  }
  let payload;
  kv(); const calls=mock({ok:true}); await request(); payload=JSON.parse(calls[0].command[5]);
  const run = async input => JSON.parse(await command('EVAL',api.INVENTORY_SCRIPT,2,...keys,JSON.stringify(input)));
  const seed = {products:[{id:'prod-01',name:'Canonical',price:10000,stock:2,category:'makanan',variants:[{label:'Small',delta:0},{label:'Large',delta:2000}]}]};
  try {
    await command('SET',keys[1],JSON.stringify(seed));
    assert.equal((await run({...payload,items:[{productId:'prod-01',variant:'Small',qty:2,note:''},{productId:'prod-01',variant:'Large',qty:1,note:''}]})).code,'OUT_OF_STOCK');
    assert.equal((await run({...payload,items:[{productId:'prod-01',variant:'Missing',qty:1,note:''}]})).code,'INVALID_VARIANT');
    assert.equal((await run({...payload,voucherCode:'INVALID'})).code,'INVALID_VOUCHER');
    assert.equal((await run({...payload,shippingId:'free'})).code,'INVALID_SHIPPING');
    const requestA={...payload,items:[{productId:'prod-01',variant:'Large',qty:2,note:''}],voucherCode:'RASAHEMAT'};
    const requestB={...requestA,id:'ord_other',fingerprint:'b'.repeat(64)};
    const buyers=await Promise.all([run(requestA),run(requestB)]);
    assert.equal(buyers.filter(r=>r.ok).length,1);
    assert.equal(buyers.find(r=>!r.ok).code,'OUT_OF_STOCK');
    const winner=buyers[0].ok?requestA:requestB;
    const reserved=buyers.find(r=>r.ok);
    assert.equal(reserved.order.totals.total,32400);
    assert.equal(reserved.order.expiresAt-reserved.order.createdAt,600000);
    assert.equal(reserved.stock.products['prod-01'],0);
    await command('SET',keys[1],JSON.stringify({...seed,products:seed.products.map(p=>({...p,stock:999}))}));
    assert.equal((await run({action:'stock'})).stock.products['prod-01'],0);
    assert.equal((await run(winner)).stock.products['prod-01'],0);
    assert.equal((await run({...winner,fingerprint:'c'.repeat(64)})).code,'IDEMPOTENCY_CONFLICT');
    assert.equal((await run({action:'confirm',id:winner.id,reference:'checked'})).order.status,'paid');
    assert.equal((await run({action:'confirm',id:winner.id,reference:'retry'})).stock.products['prod-01'],0);
    assert.equal((await run({action:'advance',id:winner.id,expectedStatus:'paid'})).order.status,'processing');
    assert.equal((await run({action:'advance',id:winner.id,expectedStatus:'paid'})).order.status,'processing');
    assert.equal((await run({action:'cancel',id:winner.id,note:''})).stock.products['prod-01'],2);
    assert.equal((await run({action:'cancel',id:winner.id,note:''})).stock.products['prod-01'],2);
    const stock=await run({action:'stock'});
    assert.equal((await run({action:'adjust',productId:'prod-01',stock:5,expectedRevision:0})).code,'REVISION_CONFLICT');
    assert.equal((await run({action:'adjust',productId:'prod-01',stock:5,expectedRevision:stock.stock.revision})).stock.products['prod-01'],5);
    const pending={...requestA,id:'ord_expire'};
    await run(pending);
    const state=JSON.parse(await command('GET',keys[0]));
    state.holds[pending.id].expiresAt=0; state.orders[pending.id].order.expiresAt=0;
    await command('SET',keys[0],JSON.stringify(state));
    assert.equal((await run({action:'confirm',id:pending.id,reference:''})).code,'INVALID_TRANSITION');
    assert.equal((await run({action:'stock'})).stock.products['prod-01'],5);
    assert.equal((await run({action:'order',id:pending.id,capabilityHash:'wrong'})).code,'ORDER_NOT_FOUND');
    await command('DEL',keys[0]); await command('SET',keys[1],JSON.stringify({products:[]}));
    assert.deepEqual((await run({action:'list'})).orders,[]);
    await command('SET',keys[1],JSON.stringify(seed));
    assert.equal((await run(requestA)).code,'STOCK_NOT_INITIALIZED');
  } finally { await command('DEL',...keys); }
});
