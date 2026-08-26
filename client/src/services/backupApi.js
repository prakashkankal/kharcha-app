import { apiFetch } from './api';

export const backupApi = {
  exportData: async () => {
    return await apiFetch('/backup/export');
  },

  importData: async (data) => {
    return await apiFetch('/backup/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  clearAllData: async () => {
    return await apiFetch('/backup/clear-all', {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    });
  },
};
