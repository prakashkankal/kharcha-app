import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/auth/Login';
import { SignUp } from './pages/auth/SignUp';
import { VerifyOtp } from './pages/auth/VerifyOtp';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { AddExpense } from './pages/AddExpense';
import { Dashboard } from './pages/Dashboard';
import { ExpenseDetails } from './pages/ExpenseDetails';
import { Profile } from './pages/Profile';
import { Categories } from './pages/Categories';
import { Analytics } from './pages/Analytics';
import { Onboarding } from './pages/Onboarding';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { InstallPwaPrompt } from './components/InstallPwaPrompt';

export function App() {
  return (
    <>
      <Routes>
        {/* Public Unauthenticated Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected Authenticated Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/add-expense" element={<AddExpense />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/expense/:id" element={<ExpenseDetails />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/categories" element={<Categories />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/add-expense" replace />} />
      </Routes>

      {/* PWA Mobile Install Banner */}
      <InstallPwaPrompt />
    </>
  );
}

export default App;
