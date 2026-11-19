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

export const purchaseService = {
  // Proveedores
  getSuppliers: (params = {}) =>
    apiClient.get(`${ENDPOINTS.ADMIN.SUPPLIERS}${buildQuery(params)}`),
  getSupplierDetail: (id) =>
    apiClient.get(`${ENDPOINTS.ADMIN.SUPPLIERS}/${id}`),
  createSupplier: (formDataOrPayload) =>
    formDataOrPayload instanceof FormData
      ? apiClient.postForm(ENDPOINTS.ADMIN.SUPPLIERS, formDataOrPayload)
      : apiClient.post(ENDPOINTS.ADMIN.SUPPLIERS, formDataOrPayload),
  updateSupplier: (id, formDataOrPayload) =>
    formDataOrPayload instanceof FormData
      ? apiClient.postForm(`${ENDPOINTS.ADMIN.SUPPLIERS}/${id}`, formDataOrPayload)
      : apiClient.put(`${ENDPOINTS.ADMIN.SUPPLIERS}/${id}`, formDataOrPayload),
  softDeleteSupplier: (id) =>
    apiClient.delete(`${ENDPOINTS.ADMIN.SUPPLIERS}/${id}`),
  restoreSupplier: (id) =>
    apiClient.post(`${ENDPOINTS.ADMIN.SUPPLIERS}/${id}/restore`, {}),
  forceDeleteSupplier: (id) =>
    apiClient.delete(`${ENDPOINTS.ADMIN.SUPPLIERS}/${id}/force`),

  // Compras y Órdenes de Compra
  getMeta: () => apiClient.get(ENDPOINTS.ADMIN.PURCHASES_META),
  getOrders: (params = {}) =>
    apiClient.get(`${ENDPOINTS.ADMIN.PURCHASES}${buildQuery(params)}`),
  getOrderDetail: (id) =>
    apiClient.get(`${ENDPOINTS.ADMIN.PURCHASES}/${id}`),
  createOrder: (payload) =>
    apiClient.post(ENDPOINTS.ADMIN.PURCHASES, payload),
  updateOrder: (id, payload) =>
    apiClient.put(`${ENDPOINTS.ADMIN.PURCHASES}/${id}`, payload),
  markOrdered: (id) =>
    apiClient.post(`${ENDPOINTS.ADMIN.PURCHASES}/${id}/order`, {}),
  receiveOrder: (id, payload = {}) =>
    apiClient.post(`${ENDPOINTS.ADMIN.PURCHASES}/${id}/receive`, payload),
  cancelOrder: (id) =>
    apiClient.post(`${ENDPOINTS.ADMIN.PURCHASES}/${id}/cancel`, {}),
  linkItemToVariant: (itemId, payload) =>
    apiClient.post(`${ENDPOINTS.ADMIN.PURCHASE_ITEMS}/${itemId}/link-variant`, payload),

  // Fotografías y Adjuntos (R2)
  uploadAttachment: (orderId, formData) =>
    apiClient.postForm(`${ENDPOINTS.ADMIN.PURCHASES}/${orderId}/attachments`, formData),
  deleteAttachment: (attachmentId) =>
    apiClient.delete(`${ENDPOINTS.ADMIN.PURCHASE_ATTACHMENTS}/${attachmentId}`),

  // Historial de Precios y Consultas
  getPriceHistory: (params = {}) =>
    apiClient.get(`${ENDPOINTS.ADMIN.PURCHASES_PRICE_HISTORY}${buildQuery(params)}`),
  lookupLastPrice: (params = {}) =>
    apiClient.get(`${ENDPOINTS.ADMIN.PURCHASES_LAST_PRICE}${buildQuery(params)}`),
  createManualPriceRecord: (formDataOrPayload) =>
    formDataOrPayload instanceof FormData
      ? apiClient.postForm(ENDPOINTS.ADMIN.PURCHASES_PRICE_HISTORY, formDataOrPayload)
      : apiClient.post(ENDPOINTS.ADMIN.PURCHASES_PRICE_HISTORY, formDataOrPayload),
};
