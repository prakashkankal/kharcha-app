import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../services/authApi';

export const ForgotPassword = () => {
  const navigate = useNavigate();

  // Stage 1: enter email, Stage 2: enter OTP & new password
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Request OTP for password reset
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const data = await authApi.forgotPassword({ email });
      setSuccessMsg(data.message || 'OTP sent! Please check your email inbox.');
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to send reset OTP. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  // Submit OTP and new password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      const data = await authApi.resetPassword({
        email,
        otp: otp.trim(),
        newPassword,
      });

      setSuccessMsg(data.message || 'Password successfully reset! Redirecting to login...');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please check your OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const data = await authApi.forgotPassword({ email });
      setSuccessMsg(data.message || 'New OTP sent to your email.');
    } catch (err) {
      setError(err.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center p-4 bg-background">
      <main class="w-full max-w-[420px] bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 md:p-8 shadow-sm flex flex-col">
        {/* Header */}
        <header class="text-center mb-6">
          <div class="flex justify-center items-center gap-2 mb-2">
            <img src="/logo.png" alt="Kharcha Logo" class="w-10 h-10 rounded-xl object-cover shadow-xs" />
            <h1 class="font-display text-[28px] text-primary font-bold tracking-tight">Kharcha</h1>
          </div>
          <h2 class="font-headline-lg-mobile text-[22px] font-bold text-on-surface">
            {step === 1 ? 'Forgot Password?' : 'Reset Password'}
          </h2>
          <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">
            {step === 1
              ? 'Enter your registered email address and we will send you a 6-digit OTP code.'
              : `Enter the OTP sent to ${email} and choose a new password.`}
          </p>
        </header>

        {/* Feedback Messages */}
        {error && (
          <div class="mb-4 bg-error-container text-on-error-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2 border border-error/20">
            <span class="material-symbols-outlined text-[20px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div class="mb-4 bg-secondary-container text-on-secondary-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2 border border-secondary/20">
            <span class="material-symbols-outlined text-[20px]">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Step 1: Request OTP Form */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="reset-email">
                Email Address
              </label>
              <div class="flex items-center border border-outline-variant rounded-lg bg-surface-container-lowest h-12 px-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <span class="material-symbols-outlined text-outline mr-3">mail</span>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  class="w-full bg-transparent border-none p-0 focus:ring-0 font-body-lg text-on-surface placeholder:text-outline outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              class="w-full bg-primary hover:bg-primary-container text-on-primary font-title-md py-3 rounded-lg transition-all active:scale-[0.98] shadow-xs flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
            >
              {loading ? (
                <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Send Reset OTP</span>
                  <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 2: Enter OTP & New Password Form */}
        {step === 2 && (
          <form onSubmit={handleResetPassword} class="flex flex-col gap-4">
            {/* OTP Field */}
            <div class="flex flex-col gap-1.5">
              <div class="flex justify-between items-center">
                <label class="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="reset-otp">
                  6-Digit OTP Code
                </label>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  class="font-body-sm text-[12px] text-primary hover:underline"
                >
                  Resend OTP
                </button>
              </div>
              <div class="flex items-center border border-outline-variant rounded-lg bg-surface-container-lowest h-12 px-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <span class="material-symbols-outlined text-outline mr-3">key</span>
                <input
                  id="reset-otp"
                  name="otp"
                  type="text"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  class="w-full bg-transparent border-none p-0 focus:ring-0 font-display text-[20px] tracking-widest text-on-surface placeholder:text-outline outline-none"
                />
              </div>
            </div>

            {/* New Password */}
            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="new-password">
                New Password
              </label>
              <div class="flex items-center border border-outline-variant rounded-lg bg-surface-container-lowest h-12 px-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <span class="material-symbols-outlined text-outline mr-3">lock</span>
                <input
                  id="new-password"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Min 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  class="w-full bg-transparent border-none p-0 focus:ring-0 font-body-lg text-on-surface placeholder:text-outline outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  class="ml-2 text-outline hover:text-on-surface focus:outline-none"
                >
                  <span class="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="confirm-password">
                Confirm New Password
              </label>
              <div class="flex items-center border border-outline-variant rounded-lg bg-surface-container-lowest h-12 px-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <span class="material-symbols-outlined text-outline mr-3">lock_reset</span>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  class="w-full bg-transparent border-none p-0 focus:ring-0 font-body-lg text-on-surface placeholder:text-outline outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              class="w-full bg-primary hover:bg-primary-container text-on-primary font-title-md py-3 rounded-lg transition-all active:scale-[0.98] shadow-xs flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
            >
              {loading ? (
                <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Reset Password</span>
                  <span class="material-symbols-outlined text-[20px]">check</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              class="text-xs text-on-surface-variant hover:text-primary text-center mt-1"
            >
              ← Use a different email
            </button>
          </form>
        )}

        {/* Back to Login Footer */}
        <footer class="mt-6 pt-4 border-t border-outline-variant text-center">
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Remembered your password?{' '}
            <Link to="/login" class="text-primary font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
};
