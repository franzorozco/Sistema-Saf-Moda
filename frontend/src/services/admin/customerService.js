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

export const customerService = {
  getMeta: () => apiClient.get(ENDPOINTS.ADMIN.CUSTOMERS_META),
  getAll: (params = {}) => apiClient.get(`${ENDPOINTS.ADMIN.CUSTOMERS}${buildQuery(params)}`),
  getDetail: (id) => apiClient.get(`${ENDPOINTS.ADMIN.CUSTOMERS}/${id}`),
  create: (payload) => apiClient.post(ENDPOINTS.ADMIN.CUSTOMERS, payload),
  update: (id, payload) => apiClient.put(`${ENDPOINTS.ADMIN.CUSTOMERS}/${id}`, payload),
  adjustLoyalty: (id, payload) =>
    apiClient.post(`${ENDPOINTS.ADMIN.CUSTOMERS}/${id}/loyalty`, payload),
  adjustStoreCredit: (id, payload) =>
    apiClient.post(`${ENDPOINTS.ADMIN.CUSTOMERS}/${id}/store-credit`, payload),
  createAddress: (id, payload) =>
    apiClient.post(`${ENDPOINTS.ADMIN.CUSTOMERS}/${id}/addresses`, payload),
  deleteAddress: (addressId) =>
    apiClient.delete(`${ENDPOINTS.ADMIN.CUSTOMER_ADDRESSES}/${addressId}`),
  softDelete: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.CUSTOMERS}/${id}`),
  restore: (id) => apiClient.post(`${ENDPOINTS.ADMIN.CUSTOMERS}/${id}/restore`, {}),
  forceDelete: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.CUSTOMERS}/${id}/force`),
};
