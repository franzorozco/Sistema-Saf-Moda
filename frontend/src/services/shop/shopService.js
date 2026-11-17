import { apiClient } from '../../api/apiClient';
import { ENDPOINTS } from '../../api/endpoints';

export const shopService = {
  getIndex: () => apiClient.get(ENDPOINTS.SHOP.INDEX),
};
