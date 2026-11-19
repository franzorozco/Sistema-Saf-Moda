import { apiClient } from '../../api/apiClient';
import { ENDPOINTS } from '../../api/endpoints';

export const userService = {
  getMeta: () => apiClient.get(ENDPOINTS.ADMIN.USERS_META),

  getAll: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, String(val));
      }
    });
    const qs = query.toString();
    return apiClient.get(qs ? `${ENDPOINTS.ADMIN.USERS}?${qs}` : ENDPOINTS.ADMIN.USERS);
  },

  getById: (id) => apiClient.get(`${ENDPOINTS.ADMIN.USERS}/${id}`),
  create: (payload) => apiClient.post(ENDPOINTS.ADMIN.USERS, payload),
  update: (id, payload) => apiClient.put(`${ENDPOINTS.ADMIN.USERS}/${id}`, payload),
  syncRoles: (id, roles) => apiClient.put(`${ENDPOINTS.ADMIN.USERS}/${id}/roles`, { roles }),
  updateStatus: (id, status) => apiClient.put(`${ENDPOINTS.ADMIN.USERS}/${id}/status`, { status }),
  softDelete: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.USERS}/${id}`),
  restore: (id) => apiClient.post(`${ENDPOINTS.ADMIN.USERS}/${id}/restore`, {}),
  forceDelete: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.USERS}/${id}/force`),
  createJobPosition: (payload) => apiClient.post(ENDPOINTS.ADMIN.JOB_POSITIONS, payload),
};
