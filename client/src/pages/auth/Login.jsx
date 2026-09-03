import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';

export const Login = () => {
  const navigate = useNavigate();
  const { login, googleAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      navigate('/add-expense', { replace: true });
    } catch (err) {
      if (err.message && err.message.includes('not verified')) {
        navigate(`/verify-otp?email=${encodeURIComponent(email)}`, { replace: true });
      } else {
        setError(err.message || 'Email or password is incorrect.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (tokenResponse) => {
    setError('');
    setLoading(true);
    try {
      // Fetch user profile from Google using the access token
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      });
      const googleUser = await res.json();
      await googleAuth({
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
        profileImage: googleUser.picture,
        accessToken: tokenResponse.access_token,
      });
      navigate('/add-expense', { replace: true });
    } catch (err) {
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in was cancelled or failed. Please try again.');
  };

  const googleLogin = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/drive.file',
    onSuccess: handleGoogleSuccess,
    onError: handleGoogleError,
  });

  return (
    <div class="min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8 bg-background">
      <main class="w-full max-w-[400px] flex flex-col gap-6">
        {/* Header Section */}
        <header class="text-center flex flex-col gap-2">
          <div class="flex justify-center items-center gap-2">
            <img src="/logo.png" alt="Kharcha Logo" class="w-10 h-10 rounded-xl object-cover shadow-sm" />
            <h1 class="font-display text-[32px] text-primary font-bold tracking-tight">Kharcha</h1>
          </div>
          <p class="font-body-lg text-body-lg text-on-surface-variant">Simple expense tracking.</p>
        </header>

        {/* Error Alert */}
        {error && (
          <div class="bg-error-container text-on-error-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2 border border-error/20">
            <span class="material-symbols-outlined text-[20px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form Section */}
        <form
          onSubmit={handleSubmit}
          aria-label="Login Form"
          class="flex flex-col gap-5 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm"
        >
          <div class="flex flex-col gap-4">
            {/* Email Input */}
            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="email">
                Email
              </label>
              <div class="flex items-center border border-outline-variant rounded-lg bg-surface-container-lowest h-12 px-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <span class="material-symbols-outlined text-outline mr-3">mail</span>
                <input
                  id="email"
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

            {/* Password Input */}
            <div class="flex flex-col gap-1.5">
              <div class="flex justify-between items-center">
                <label class="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="password">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  class="font-body-sm text-body-sm text-primary hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <div class="flex items-center border border-outline-variant rounded-lg bg-surface-container-lowest h-12 px-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <span class="material-symbols-outlined text-outline mr-3">lock</span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  class="w-full bg-transparent border-none p-0 focus:ring-0 font-body-lg text-on-surface placeholder:text-outline outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  class="ml-2 text-outline hover:text-on-surface focus:outline-none"
                  aria-label="Toggle password visibility"
                >
                  <span class="material-symbols-outlined">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Login Submit Button */}
          <button
            type="submit"
            disabled={loading}
            class="h-12 w-full bg-primary text-on-primary font-title-md text-title-md rounded-lg flex items-center justify-center hover:bg-primary-container active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
          >
            {loading ? (
              <div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Login'
            )}
          </button>
        </form>

        {/* Divider */}
        <div class="flex items-center gap-4">
          <div class="flex-1 h-[1px] bg-outline-variant"></div>
          <span class="font-label-caps text-label-caps text-on-surface-variant">OR</span>
          <div class="flex-1 h-[1px] bg-outline-variant"></div>
        </div>

        {/* Social Login */}
        <button
          type="button"
          onClick={() => googleLogin()}
          disabled={loading}
          class="h-12 w-full bg-surface-container-lowest text-on-surface font-title-md text-title-md rounded-lg border border-outline-variant flex items-center justify-center gap-3 hover:bg-surface-container-low active:scale-[0.98] transition-all duration-200"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            ></path>
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            ></path>
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            ></path>
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            ></path>
          </svg>
          Continue with Google
        </button>

        {/* Footer Link */}
        <div class="text-center mt-2">
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Don't have an account?{' '}
            <Link to="/signup" class="text-primary font-medium hover:underline">
              Create Account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};
