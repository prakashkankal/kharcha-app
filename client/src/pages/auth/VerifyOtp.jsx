import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const VerifyOtp = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyOtp, resendOtp } = useAuth();

  const emailParam = searchParams.get('email') || '';
  const [email] = useState(emailParam);

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);

  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
  ];

  useEffect(() => {
    if (!email) {
      navigate('/signup', { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input field
    if (value && index < 5) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(pastedData)) return;

    const digits = pastedData.split('');
    setOtp(digits);
    inputRefs[5].current.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      setError('Please enter all 6 digits of the OTP code');
      return;
    }

    setLoading(true);
    try {
      await verifyOtp({ email, otp: otpCode });
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err.message || 'OTP verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfoMsg('');
    setResendLoading(true);

    try {
      const res = await resendOtp({ email });
      setInfoMsg(res.message || 'A new 6-digit OTP code has been sent to your email.');
      setTimer(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs[0].current.focus();
    } catch (err) {
      setError(err.message || 'Failed to resend OTP code.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div class="min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8 bg-background">
      <main class="w-full max-w-[420px] bg-surface-container-lowest border border-outline-variant rounded-xl p-6 md:p-8 shadow-sm flex flex-col gap-6">
        {/* Header */}
        <header class="text-center flex flex-col gap-2">
          <div class="flex justify-center items-center gap-2 mb-1">
            <img src="/logo.png" alt="Kharcha Logo" class="w-10 h-10 rounded-xl object-cover shadow-sm" />
            <h1 class="font-display text-[28px] text-primary font-bold tracking-tight">Kharcha</h1>
          </div>
          <h2 class="font-headline-lg-mobile text-[22px] font-bold text-on-surface">Verify Email OTP</h2>
          <p class="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
            We sent a 6-digit verification code to <span class="font-semibold text-on-surface">{email}</span>.
          </p>
        </header>

        {/* Error Alert */}
        {error && (
          <div class="bg-error-container text-on-error-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2 border border-error/20">
            <span class="material-symbols-outlined text-[20px] shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Info Alert */}
        {infoMsg && (
          <div class="bg-secondary-container text-on-secondary-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2 border border-secondary/20">
            <span class="material-symbols-outlined text-[20px] shrink-0">check_circle</span>
            <span>{infoMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} class="flex flex-col gap-6">
          {/* OTP Digit Inputs */}
          <div class="flex justify-between items-center gap-2" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                class="w-12 h-14 text-center font-display text-[24px] font-bold bg-surface-bright border border-outline-variant rounded-lg text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none transition-all"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || otp.join('').length < 6}
            class="h-12 w-full bg-primary text-on-primary font-title-md text-title-md rounded-lg hover:bg-primary-container transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
          >
            {loading ? (
              <div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Verify & Create Account'
            )}
          </button>
        </form>

        <div class="flex flex-col items-center gap-3 text-center">
          <p class="font-body-sm text-on-surface-variant">
            Didn't receive the OTP code?{' '}
            {timer > 0 ? (
              <span class="text-outline font-medium">Resend in {timer}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                class="text-primary font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
              >
                {resendLoading ? 'Sending...' : 'Resend OTP'}
              </button>
            )}
          </p>

          <div class="mt-2">
            <Link to="/signup" class="font-body-sm text-outline hover:text-on-surface flex items-center gap-1 transition-colors">
              <span class="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Sign Up
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
