import { apiClient } from '../../api/apiClient';
import { ENDPOINTS } from '../../api/endpoints';

export const homeService = {
  getIndex: () => apiClient.get(ENDPOINTS.HOME.INDEX),
};
