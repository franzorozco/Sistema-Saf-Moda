import { apiClient } from '../../api/apiClient';
import { ENDPOINTS } from '../../api/endpoints';

export const dashboardService = {
  getSummary: () => apiClient.get(ENDPOINTS.ADMIN.DASHBOARD),
};
