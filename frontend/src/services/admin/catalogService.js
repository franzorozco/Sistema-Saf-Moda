import { apiClient } from '../../api/apiClient';
import { ENDPOINTS } from '../../api/endpoints';

export const catalogService = {
  // Categorías
  getCategories: () => apiClient.get(ENDPOINTS.ADMIN.CATEGORIES),
  createCategory: (payload) => apiClient.post(ENDPOINTS.ADMIN.CATEGORIES, payload),
  updateCategory: (id, payload) => apiClient.put(`${ENDPOINTS.ADMIN.CATEGORIES}/${id}`, payload),
  deleteCategory: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.CATEGORIES}/${id}`),

  // Departamentos
  getDepartments: () => apiClient.get(ENDPOINTS.ADMIN.DEPARTMENTS),
  createDepartment: (payload) => apiClient.post(ENDPOINTS.ADMIN.DEPARTMENTS, payload),
  updateDepartment: (id, payload) => apiClient.put(`${ENDPOINTS.ADMIN.DEPARTMENTS}/${id}`, payload),
  deleteDepartment: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.DEPARTMENTS}/${id}`),

  // Marcas
  getBrands: () => apiClient.get(ENDPOINTS.ADMIN.BRANDS),
  createBrand: (payload) => apiClient.post(ENDPOINTS.ADMIN.BRANDS, payload),
  updateBrand: (id, payload) => apiClient.put(`${ENDPOINTS.ADMIN.BRANDS}/${id}`, payload),
  deleteBrand: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.BRANDS}/${id}`),

  // Colecciones / Temporadas
  getSeasons: () => apiClient.get(ENDPOINTS.ADMIN.SEASONS),
  createSeason: (payload) => apiClient.post(ENDPOINTS.ADMIN.SEASONS, payload),
  updateSeason: (id, payload) => apiClient.put(`${ENDPOINTS.ADMIN.SEASONS}/${id}`, payload),
  deleteSeason: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.SEASONS}/${id}`),

  // Atributos y Valores
  getAttributes: () => apiClient.get(ENDPOINTS.ADMIN.ATTRIBUTES),
  createAttribute: (payload) => apiClient.post(ENDPOINTS.ADMIN.ATTRIBUTES, payload),
  updateAttribute: (id, payload) => apiClient.put(`${ENDPOINTS.ADMIN.ATTRIBUTES}/${id}`, payload),
  deleteAttribute: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.ATTRIBUTES}/${id}`),
  createAttributeValue: (attributeId, payload) =>
    apiClient.post(`${ENDPOINTS.ADMIN.ATTRIBUTES}/${attributeId}/values`, payload),
  deleteAttributeValue: (valueId) =>
    apiClient.delete(`${ENDPOINTS.ADMIN.ATTRIBUTE_VALUES}/${valueId}`),

  // Guías de tallas
  getSizeGuides: () => apiClient.get(ENDPOINTS.ADMIN.SIZE_GUIDES),
  createSizeGuide: (payload) => apiClient.post(ENDPOINTS.ADMIN.SIZE_GUIDES, payload),
  deleteSizeGuide: (id) => apiClient.delete(`${ENDPOINTS.ADMIN.SIZE_GUIDES}/${id}`),
  createSizeGuideItem: (guideId, payload) =>
    apiClient.post(`${ENDPOINTS.ADMIN.SIZE_GUIDES}/${guideId}/items`, payload),
  deleteSizeGuideItem: (itemId) =>
    apiClient.delete(`${ENDPOINTS.ADMIN.SIZE_GUIDE_ITEMS}/${itemId}`),
};
