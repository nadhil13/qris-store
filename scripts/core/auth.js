let adminToken = '';
export const hasInventoryAdminToken = () => Boolean(adminToken);
export function setInventoryAdminToken(token) { adminToken = typeof token === 'string' ? token : ''; }
export function inventoryAdminHeaders() {
  if (!adminToken) throw Error('Token admin backend diperlukan. Masuk kembali.');
  return { Authorization: `Bearer ${adminToken}` };
}
export function rejectUnauthorized(response) {
  if (response.status === 401) setInventoryAdminToken('');
}
