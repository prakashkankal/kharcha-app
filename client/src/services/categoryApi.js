import { apiFetch } from './api';

export const categoryApi = {
  getCategories: async () => {
    return await apiFetch('/categories');
  },

  createCategory: async (categoryData) => {
    return await apiFetch('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  },

  updateCategory: async (id, categoryData) => {
    return await apiFetch(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  },

  reorderCategories: async (orderedIds) => {
    return await apiFetch('/categories/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    });
  },

  deleteCategory: async (id, targetCategoryId = null) => {
    return await apiFetch(`/categories/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ targetCategoryId }),
    });
  },
};
