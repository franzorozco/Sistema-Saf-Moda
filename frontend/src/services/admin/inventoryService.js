import { apiClient } from '../../api/apiClient';
import { ENDPOINTS } from '../../api/endpoints';

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, String(val));
    }
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export const inventoryService = {
  getMeta: () => apiClient.get(ENDPOINTS.ADMIN.INVENTORY_META),
  getProductVariants: (productId) =>
    apiClient.get(`${ENDPOINTS.ADMIN.INVENTORY}/products/${productId}/variants`),
  getProductsStock: (params = {}) =>
    apiClient.get(`${ENDPOINTS.ADMIN.INVENTORY}${buildQuery(params)}`),
  recordMovement: (payload) =>
    apiClient.post(ENDPOINTS.ADMIN.INVENTORY_MOVEMENT, payload),
  recordBatchEntry: (payload) =>
    apiClient.post(ENDPOINTS.ADMIN.INVENTORY_BATCH_ENTRY, payload),
  updateSettings: (payload) =>
    apiClient.put(ENDPOINTS.ADMIN.INVENTORY_SETTINGS, payload),
  getMovements: (params = {}) =>
    apiClient.get(`${ENDPOINTS.ADMIN.INVENTORY_MOVEMENTS}${buildQuery(params)}`),

  getCounts: (params = {}) =>
    apiClient.get(`${ENDPOINTS.ADMIN.INVENTORY_COUNTS}${buildQuery(params)}`),
  createCount: (payload) =>
    apiClient.post(ENDPOINTS.ADMIN.INVENTORY_COUNTS, payload),
  getCountDetail: (id) =>
    apiClient.get(`${ENDPOINTS.ADMIN.INVENTORY_COUNTS}/${id}`),
  updateCountItems: (id, payload) =>
    apiClient.put(`${ENDPOINTS.ADMIN.INVENTORY_COUNTS}/${id}/items`, payload),
  approveCount: (id, payload = {}) =>
    apiClient.post(`${ENDPOINTS.ADMIN.INVENTORY_COUNTS}/${id}/approve`, payload),
  cancelCount: (id, payload = {}) =>
    apiClient.post(`${ENDPOINTS.ADMIN.INVENTORY_COUNTS}/${id}/cancel`, payload),

  createBranch: (payload) => apiClient.post(ENDPOINTS.ADMIN.BRANCHES, payload),
  updateBranch: (id, payload) => apiClient.put(`${ENDPOINTS.ADMIN.BRANCHES}/${id}`, payload),

  getWarehouses: () => apiClient.get(ENDPOINTS.ADMIN.WAREHOUSES),
  createWarehouse: (payload) =>
    apiClient.post(ENDPOINTS.ADMIN.WAREHOUSES, payload),
  updateWarehouse: (id, payload) =>
    apiClient.put(`${ENDPOINTS.ADMIN.WAREHOUSES}/${id}`, payload),

  getTransfers: (params = {}) =>
    apiClient.get(`${ENDPOINTS.ADMIN.STOCK_TRANSFERS}${buildQuery(params)}`),
  createTransfer: (payload) =>
    apiClient.post(ENDPOINTS.ADMIN.STOCK_TRANSFERS, payload),
  shipTransfer: (id) =>
    apiClient.post(`${ENDPOINTS.ADMIN.STOCK_TRANSFERS}/${id}/ship`, {}),
  receiveTransfer: (id, payload = {}) =>
    apiClient.post(`${ENDPOINTS.ADMIN.STOCK_TRANSFERS}/${id}/receive`, payload),
  cancelTransfer: (id) =>
    apiClient.post(`${ENDPOINTS.ADMIN.STOCK_TRANSFERS}/${id}/cancel`, {}),
};
