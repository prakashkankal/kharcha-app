import { apiFetch } from './api';

export const profileApi = {
  getProfile: async () => {
    return await apiFetch('/profile');
  },

  updateProfile: async (payload) => {
    let body;
    if (payload instanceof FormData) {
      body = payload;
    } else {
      body = JSON.stringify(payload);
    }

    return await apiFetch('/profile', {
      method: 'PUT',
      body,
    });
  },
};
