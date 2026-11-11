let adminToken = '';
let adminSessionVersion = 0;
export const getAdminSessionVersion = () => adminSessionVersion;
export const hasInventoryAdminToken = () => Boolean(adminToken);
const logoutListeners = new Set();
export const onAdminLogout = fn => { logoutListeners.add(fn); return () => logoutListeners.delete(fn); };
export function setInventoryAdminToken(token) {
  adminSessionVersion++;
  adminToken = typeof token === 'string' ? token : '';
  if (!adminToken) logoutListeners.forEach(fn => fn());
}
export function inventoryAdminHeaders() {
  if (!adminToken) throw Error('Token admin backend diperlukan. Masuk kembali.');
  return { Authorization: `Bearer ${adminToken}` };
}
export function rejectUnauthorized(response) {
  if (response.status === 401) setInventoryAdminToken('');
}
