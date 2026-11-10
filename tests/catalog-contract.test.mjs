import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../scripts/app.js', import.meta.url), 'utf8');
const htmlSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const app = fs.readFileSync(new URL('../scripts/app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(app, /export const PRODUCTS = \[/);
assert.match(app, /isAvailable/);
assert.match(app, /STORAGE_KEY_CUSTOM_PRODUCTS/);
assert.match(app, /BroadcastChannel/);
assert.match(app, /saveAdminStorefrontSetting/);
assert.match(app, /openProductEditForm/);
assert.match(html, /admin-storefront-whatsapp/);
assert.match(html, /admin-product-submit-label/);
assert.match(html, /checkoutViaWhatsApp/);

assert.match(appSource, /syncOrdersWithCloud\(\)/, 'app must pull cloud orders');
assert.match(appSource, /adminCancelOrder\('\$\{o\.id\}'\)/, 'admin table must expose cancellation');
assert.doesNotMatch(htmlSource, /id="merchant-config-modal-backdrop"/, 'legacy QRIS modal must be removed');

const productShape = {
  id: 'test-product',
  price: 50000,
  isAvailable: true
};
assert.equal(typeof productShape.price, 'number');
assert.equal(productShape.isAvailable, true);

const availableProducts = [
  productShape,
  { id: 'sold-out', price: 45000, isAvailable: false }
].filter((product) => product.isAvailable !== false);
assert.deepEqual(availableProducts.map((product) => product.id), ['test-product']);

console.log('PASS catalog-contract.test.mjs');
