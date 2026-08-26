import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/navigation/Navbar';
import { BottomNav } from '../components/navigation/BottomNav';

export const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div class="min-h-screen flex items-center justify-center bg-background">
        <div class="flex flex-col items-center gap-3">
          <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p class="font-body-lg text-on-surface-variant">Loading Kharcha...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div class="min-h-screen flex flex-col bg-background text-on-background pb-20 md:pb-8">
      <Navbar />
      <main class="flex-1 w-full max-w-[1024px] mx-auto px-container-margin md:px-0 pt-4 md:pt-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};
