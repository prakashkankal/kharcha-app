import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/authApi';
import { getAuthToken } from '../services/api';
import { syncManager } from '../services/syncManager';

const AuthContext = createContext();

const LOCAL_USER_KEY = 'kharcha_cached_user';

export const AuthProvider = ({ children }) => {
  // Read initial user synchronously from localStorage so UI opens in 0ms without waiting
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem(LOCAL_USER_KEY);
      const token = getAuthToken();
      if (token && cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse cached user:', e);
    }
    return null;
  });

  // If we already have a cached user and token, loading is false immediately
  const [loading, setLoading] = useState(() => {
    const token = getAuthToken();
    const cached = localStorage.getItem(LOCAL_USER_KEY);
    return token && cached ? false : false;
  });

  const persistUser = (userData) => {
    setUser(userData);
    if (userData) {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(userData));
    } else {
      localStorage.removeItem(LOCAL_USER_KEY);
    }
  };

  const fetchCurrentUser = async () => {
    const token = getAuthToken();
    if (!token) {
      persistUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await authApi.getMe();
      persistUser(data.user);
    } catch (error) {
      console.warn('Silent user refresh failed (server may be starting up):', error.message);
      // ONLY log out if the server explicitly tells us the token is invalid (401/403)
      if (error.message && (error.message.includes('401') || error.message.includes('token') || error.message.includes('Unauthorized'))) {
        authApi.logout();
        persistUser(null);
      }
      // If it's a network/timeout error (Render waking up), KEEP cached user active!
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Start background sync manager
    syncManager.init();
    fetchCurrentUser();
  }, []);

  const login = async (credentials) => {
    const data = await authApi.login(credentials);
    persistUser(data.user);
    syncManager.checkServerAndSync();
    return data;
  };

  const register = async (userData) => {
    const data = await authApi.register(userData);
    if (data.user && !data.requireOtp) {
      persistUser(data.user);
      syncManager.checkServerAndSync();
    }
    return data;
  };

  const verifyOtp = async (otpData) => {
    const data = await authApi.verifyOtp(otpData);
    if (data.user) {
      persistUser(data.user);
      syncManager.checkServerAndSync();
    }
    return data;
  };

  const resendOtp = async (emailData) => {
    return await authApi.resendOtp(emailData);
  };

  const googleAuth = async (googleData) => {
    const data = await authApi.googleAuth(googleData);
    persistUser(data.user);
    syncManager.checkServerAndSync();
    return data;
  };

  const logout = () => {
    authApi.logout();
    persistUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser((prev) => {
      const nextUser = { ...prev, ...updatedUser };
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(nextUser));
      return nextUser;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        verifyOtp,
        resendOtp,
        googleAuth,
        logout,
        updateUser,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
