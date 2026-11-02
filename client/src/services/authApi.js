import { apiFetch, setAuthToken, setRefreshToken } from './api';

const saveSessionTokens = ({ token, refreshToken }) => {
  if (token) setAuthToken(token);
  if (refreshToken) setRefreshToken(refreshToken);
};

export const authApi = {
  login: async (credentials) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    saveSessionTokens(data);
    return data;
  },

  register: async (userData) => {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    saveSessionTokens(data);
    return data;
  },

  googleAuth: async (googleData) => {
    const data = await apiFetch('/auth/google', {
      method: 'POST',
      body: JSON.stringify(googleData),
    });
    saveSessionTokens(data);
    return data;
  },

  verifyOtp: async (otpData) => {
    const data = await apiFetch('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(otpData),
    });
    saveSessionTokens(data);
    return data;
  },

  resendOtp: async (emailData) => {
    return await apiFetch('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify(emailData),
    });
  },

  forgotPassword: async (emailData) => {
    return await apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(emailData),
    });
  },

  resetPassword: async (resetData) => {
    return await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(resetData),
    });
  },

  getMe: async () => {
    return await apiFetch('/auth/me');
  },

  logout: () => {
    setAuthToken(null);
    setRefreshToken(null);
  },
};
