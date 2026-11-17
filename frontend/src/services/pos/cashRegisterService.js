import { apiClient } from '../../api/apiClient';
import { ENDPOINTS } from '../../api/endpoints';

export const cashRegisterService = {
  getCurrent: () => apiClient.get(ENDPOINTS.POS.CASH_REGISTER_CURRENT),
  open: (payload) => apiClient.post(ENDPOINTS.POS.CASH_REGISTER_OPEN, payload),
  close: (payload) => apiClient.post(ENDPOINTS.POS.CASH_REGISTER_CLOSE, payload),
};
