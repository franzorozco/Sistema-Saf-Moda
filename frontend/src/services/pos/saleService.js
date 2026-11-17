import { apiClient } from '../../api/apiClient';
import { ENDPOINTS } from '../../api/endpoints';

export const saleService = {
  getInitData: () => apiClient.get(ENDPOINTS.POS.INIT),
  getAll: () => apiClient.get(ENDPOINTS.POS.SALES),
  getById: (id) => apiClient.get(`${ENDPOINTS.POS.SALES}/${id}`),
  create: (payload) => apiClient.post(ENDPOINTS.POS.SALES, payload),
};
