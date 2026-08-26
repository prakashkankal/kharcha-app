import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/authApi';
import { getAuthToken } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await authApi.getMe();
      setUser(data.user);
    } catch (error) {
      console.error('Failed to fetch authenticated user:', error.message);
      authApi.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (credentials) => {
    const data = await authApi.login(credentials);
    setUser(data.user);
    return data;
  };

  const register = async (userData) => {
    const data = await authApi.register(userData);
    if (data.user && !data.requireOtp) {
      setUser(data.user);
    }
    return data;
  };

  const verifyOtp = async (otpData) => {
    const data = await authApi.verifyOtp(otpData);
    if (data.user) {
      setUser(data.user);
    }
    return data;
  };

  const resendOtp = async (emailData) => {
    return await authApi.resendOtp(emailData);
  };

  const googleAuth = async (googleData) => {
    const data = await authApi.googleAuth(googleData);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser((prev) => ({ ...prev, ...updatedUser }));
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
