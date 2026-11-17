import { apiClient } from '../../api/apiClient';
import { ENDPOINTS } from '../../api/endpoints';

export const productService = {
  getAll: () => apiClient.get(ENDPOINTS.ADMIN.PRODUCTS),
  getById: (id) => apiClient.get(`${ENDPOINTS.ADMIN.PRODUCTS}/${id}`),
  create: (payload) => apiClient.post(ENDPOINTS.ADMIN.PRODUCTS, payload),
  update: (id, payload) => apiClient.put(`${ENDPOINTS.ADMIN.PRODUCTS}/${id}`, payload),
  remove: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.PRODUCTS}/${id}`),
};
