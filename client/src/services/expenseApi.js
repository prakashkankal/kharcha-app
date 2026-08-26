import { apiFetch } from './api';

export const expenseApi = {
  getExpenses: async ({ month, categoryId } = {}) => {
    const queryParams = new URLSearchParams();
    if (month) queryParams.append('month', month);
    if (categoryId) queryParams.append('categoryId', categoryId);

    const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return await apiFetch(`/expenses${queryStr}`);
  },

  getMonthlySummary: async (month) => {
    const queryStr = month ? `?month=${month}` : '';
    return await apiFetch(`/expenses/summary/monthly${queryStr}`);
  },

  getExpenseById: async (id) => {
    return await apiFetch(`/expenses/${id}`);
  },

  createExpense: async (formData) => {
    return await apiFetch('/expenses', {
      method: 'POST',
      body: formData,
    });
  },

  updateExpense: async (id, formData) => {
    return await apiFetch(`/expenses/${id}`, {
      method: 'PUT',
      body: formData,
    });
  },

  deleteExpense: async (id) => {
    return await apiFetch(`/expenses/${id}`, {
      method: 'DELETE',
    });
  },
};
