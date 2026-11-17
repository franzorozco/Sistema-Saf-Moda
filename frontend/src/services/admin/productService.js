import { apiClient } from '../../api/apiClient';
import { ENDPOINTS } from '../../api/endpoints';

export const productService = {
  getAll: () => apiClient.get(ENDPOINTS.ADMIN.PRODUCTS),
  getById: (id) => apiClient.get(`${ENDPOINTS.ADMIN.PRODUCTS}/${id}`),
  create: (payload) => apiClient.post(ENDPOINTS.ADMIN.PRODUCTS, payload),
  update: (id, payload) => apiClient.put(`${ENDPOINTS.ADMIN.PRODUCTS}/${id}`, payload),
  remove: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.PRODUCTS}/${id}`),
  getVariants: (productId) => apiClient.get(`${ENDPOINTS.ADMIN.PRODUCTS}/${productId}/variants`),
  createVariant: (productId, payload) =>
    apiClient.post(`${ENDPOINTS.ADMIN.PRODUCTS}/${productId}/variants`, payload),
  createVariantsBatch: (productId, payload) =>
    apiClient.post(`${ENDPOINTS.ADMIN.PRODUCTS}/${productId}/variants/batch`, payload),
  updateVariant: (variantId, payload) =>
    apiClient.put(`${ENDPOINTS.ADMIN.PRODUCT_VARIANTS}/${variantId}`, payload),
  deleteVariant: (variantId) =>
    apiClient.delete(`${ENDPOINTS.ADMIN.PRODUCT_VARIANTS}/${variantId}`),
  getImages: (productId) => apiClient.get(`${ENDPOINTS.ADMIN.PRODUCTS}/${productId}/images`),
  uploadImage: (productId, formData) =>
    apiClient.postForm(`${ENDPOINTS.ADMIN.PRODUCTS}/${productId}/images`, formData),
  setPrimaryImage: (imageId) =>
    apiClient.put(`${ENDPOINTS.ADMIN.PRODUCT_IMAGE_ITEM}/${imageId}/primary`, {}),
  deleteImage: (imageId) =>
    apiClient.delete(`${ENDPOINTS.ADMIN.PRODUCT_IMAGE_ITEM}/${imageId}`),
};
