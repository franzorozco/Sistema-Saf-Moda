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

export const saleService = {
  getInitData: (params = {}) =>
    apiClient.get(`${ENDPOINTS.POS.INIT}${buildQuery(params)}`),
  getInventory: (params = {}) =>
    apiClient.get(`${ENDPOINTS.POS.INVENTORY}${buildQuery(params)}`),
  createQuickCustomer: (payload) =>
    apiClient.post(ENDPOINTS.POS.QUICK_CUSTOMER, payload),
  getAll: (params = {}) =>
    apiClient.get(`${ENDPOINTS.POS.SALES}${buildQuery(params)}`),
  getById: (id) => apiClient.get(`${ENDPOINTS.POS.SALES}/${id}`),
  create: (payload) => apiClient.post(ENDPOINTS.POS.SALES, payload),

  getLayaways: (params = {}) =>
    apiClient.get(`${ENDPOINTS.POS.LAYAWAYS}${buildQuery(params)}`),
  createLayaway: (payload) => apiClient.post(ENDPOINTS.POS.LAYAWAYS, payload),
  addLayawayPayment: (id, payload) =>
    apiClient.post(`${ENDPOINTS.POS.LAYAWAYS}/${id}/payments`, payload),
  cancelLayaway: (id) =>
    apiClient.post(`${ENDPOINTS.POS.LAYAWAYS}/${id}/cancel`, {}),
};
