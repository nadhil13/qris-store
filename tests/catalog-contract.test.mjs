import assert from 'node:assert/strict';
import fs from 'node:fs';

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

console.log('PASS catalog-contract.test.mjs');
