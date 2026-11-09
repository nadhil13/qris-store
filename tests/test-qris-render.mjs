import assert from 'node:assert/strict';
import { convertStaticToDynamicQRIS, renderQRCodeSVG, renderQRCodeCanvas } from '../scripts/qris.js';

const raw = '00020101021126610014COM.GO-JEK.WWW01189360091438279124610210G8279124610303UMI51440014ID.CO.QRIS.WWW0215ID10264865583680303UMI5204899953033605802ID5925NI NYOMAN SUTRIANI, Digit6008DENPASAR61058011762070703A0163044D86';
const dyn = convertStaticToDynamicQRIS(raw, 80000, 'AN261109F7EB');
assert.ok(dyn.startsWith('000201010212'), 'Is dynamic QRIS payload');

const svg = renderQRCodeSVG(dyn, { size: 236 });
assert.ok(svg.startsWith('<svg'), 'SVG tag starts properly');
assert.ok(svg.includes('viewBox="0 0 65 65"'), 'viewBox has proper dimensions');
assert.ok(svg.includes('fill="#000000"'), 'Has black QR modules');
assert.ok(svg.includes('width="236"'), 'Has 236 width');
assert.ok(svg.length > 5000, 'Has full module path');

console.log('PASS test-qris-render.mjs! Dynamic QRIS length:', dyn.length, 'SVG length:', svg.length);
