import assert from 'node:assert/strict';
import { calculateCRC16, convertStaticToDynamicQRIS, generateDynamicQRISPayload, parseEMVCoQRIS } from '../scripts/qris.js';

const staticPayload = generateDynamicQRISPayload({
  merchantName: 'Atelier Nusantara',
  merchantCity: 'Jakarta',
  amount: 1,
  invoiceNumber: 'SEED-01'
}).replace('010212', '010211');

assert.equal(parseEMVCoQRIS(staticPayload)['01'], '11');

const dynamicPayload = convertStaticToDynamicQRIS(staticPayload, 78000, 'INV-TEST/01');
const parsedDynamic = parseEMVCoQRIS(dynamicPayload);
assert.equal(parsedDynamic['01'], '12');
assert.equal(parsedDynamic['54'], '78000');
assert.match(parsedDynamic['62'], /INVTEST01/);
assert.equal(dynamicPayload.slice(-4), calculateCRC16(dynamicPayload.slice(0, -4)));

assert.throws(
  () => convertStaticToDynamicQRIS('invalid', 1000, 'INV01'),
  /Format string QRIS statis tidak valid/
);

console.log('PASS qris.test.mjs');
