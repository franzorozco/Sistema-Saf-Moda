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

export const employeeService = {
  // Empleados
  getMeta: () => apiClient.get(ENDPOINTS.ADMIN.EMPLOYEES_META),
  getAll: (params = {}) => apiClient.get(`${ENDPOINTS.ADMIN.EMPLOYEES}${buildQuery(params)}`),
  getById: (id) => apiClient.get(`${ENDPOINTS.ADMIN.EMPLOYEES}/${id}`),
  create: (payload) => apiClient.post(ENDPOINTS.ADMIN.EMPLOYEES, payload),
  update: (id, payload) => apiClient.put(`${ENDPOINTS.ADMIN.EMPLOYEES}/${id}`, payload),
  updateCommissionRate: (id, commissionRate) =>
    apiClient.put(`${ENDPOINTS.ADMIN.EMPLOYEES}/${id}/commission-rate`, {
      commission_rate: Number(commissionRate),
    }),
  softDelete: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.EMPLOYEES}/${id}`),
  restore: (id) => apiClient.post(`${ENDPOINTS.ADMIN.EMPLOYEES}/${id}/restore`, {}),
  forceDelete: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.EMPLOYEES}/${id}/force`),

  // Horarios / Turnos
  getShifts: (params = {}) =>
    apiClient.get(`${ENDPOINTS.ADMIN.EMPLOYEE_SHIFTS}${buildQuery(params)}`),
  createShift: (payload) => apiClient.post(ENDPOINTS.ADMIN.EMPLOYEE_SHIFTS, payload),
  createShiftsBatch: (payload) =>
    apiClient.post(`${ENDPOINTS.ADMIN.EMPLOYEE_SHIFTS}/batch`, payload),
  updateShift: (id, payload) =>
    apiClient.put(`${ENDPOINTS.ADMIN.EMPLOYEE_SHIFTS}/${id}`, payload),
  checkInShift: (id) =>
    apiClient.post(`${ENDPOINTS.ADMIN.EMPLOYEE_SHIFTS}/${id}/check-in`, {}),
  checkOutShift: (id) =>
    apiClient.post(`${ENDPOINTS.ADMIN.EMPLOYEE_SHIFTS}/${id}/check-out`, {}),
  deleteShift: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.EMPLOYEE_SHIFTS}/${id}`),

  // Comisiones por venta
  getCommissions: (params = {}) =>
    apiClient.get(`${ENDPOINTS.ADMIN.EMPLOYEE_COMMISSIONS}${buildQuery(params)}`),
  updateCommissionStatus: (id, status) =>
    apiClient.put(`${ENDPOINTS.ADMIN.EMPLOYEE_COMMISSIONS}/${id}/status`, { status }),
};
