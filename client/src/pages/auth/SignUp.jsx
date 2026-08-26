import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';

export const SignUp = () => {
  const navigate = useNavigate();
  const { register, googleAuth } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      const res = await register({ name, email, password });
      if (res && res.requireOtp) {
        navigate(`/verify-otp?email=${encodeURIComponent(email)}`, { replace: true });
      } else {
        navigate('/add-expense', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (tokenResponse) => {
    setError('');
    setLoading(true);
    try {
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
      setError(err.message || 'Google Sign Up failed');
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
      <main class="w-full max-w-[400px] bg-surface-container-lowest border border-outline-variant rounded-xl p-6 md:p-8 shadow-sm flex flex-col">
        <header class="text-center mb-6">
          <div class="flex justify-center items-center gap-2 mb-2">
            <span class="material-symbols-outlined text-primary text-[32px]">account_balance_wallet</span>
            <h1 class="font-display text-[28px] text-primary font-bold tracking-tight">Kharcha</h1>
          </div>
          <p class="font-body-lg text-body-lg text-on-surface-variant">Simple expense tracking.</p>
        </header>

        {error && (
          <div class="mb-4 bg-error-container text-on-error-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2 border border-error/20">
            <span class="material-symbols-outlined text-[20px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} class="flex flex-col gap-4">
          <div class="flex flex-col gap-1 relative">
            <label class="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              class="h-12 bg-surface-container-lowest border border-outline-variant rounded-lg px-4 font-body-lg text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
          </div>

          <div class="flex flex-col gap-1 relative">
            <label class="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              class="h-12 bg-surface-container-lowest border border-outline-variant rounded-lg px-4 font-body-lg text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
          </div>

          <div class="flex flex-col gap-1 relative">
            <label class="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="password">
              Password
            </label>
            <div class="relative flex items-center">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                class="h-12 w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-4 pr-11 font-body-lg text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                class="absolute right-3 p-1 text-on-surface-variant hover:text-on-surface transition-colors rounded-full"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <span class="material-symbols-outlined text-[20px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <span class="font-body-sm text-[12px] text-outline mt-0.5">At least 8 characters</span>
          </div>

          <div class="flex flex-col gap-1 relative">
            <label class="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="confirm-password">
              Confirm Password
            </label>
            <div class="relative flex items-center">
              <input
                id="confirm-password"
                name="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                class="h-12 w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-4 pr-11 font-body-lg text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                class="absolute right-3 p-1 text-on-surface-variant hover:text-on-surface transition-colors rounded-full"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                <span class="material-symbols-outlined text-[20px]">
                  {showConfirmPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            class="h-12 mt-2 w-full bg-primary text-on-primary font-title-md text-title-md rounded-lg hover:bg-primary-container transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
          >
            {loading ? (
              <div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div class="flex items-center my-6">
          <hr class="flex-grow border-t border-outline-variant" />
          <span class="mx-4 font-label-caps text-label-caps text-outline uppercase">OR</span>
          <hr class="flex-grow border-t border-outline-variant" />
        </div>

        <button
          type="button"
          onClick={() => googleLogin()}
          disabled={loading}
          class="h-12 w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-title-md text-title-md rounded-lg hover:bg-surface-container-low transition-colors duration-200 flex items-center justify-center gap-3"
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

        <div class="mt-6 text-center">
          <p class="font-body-lg text-body-lg text-on-surface-variant">
            Already have an account?{' '}
            <Link to="/login" class="text-primary font-medium hover:underline">
              Login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};
