import React from 'react';
import { Link } from 'react-router-dom';

export const LandingPage = () => {
  return (
    <div class="min-h-screen bg-background text-on-background flex flex-col justify-between selection:bg-primary/20">
      {/* Top Navbar */}
      <header class="w-full border-b border-outline-variant bg-surface-container-lowest/80 backdrop-blur-md sticky top-0 z-50">
        <div class="max-w-[1120px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="/logo.png" alt="Kharcha App Logo" class="w-9 h-9 rounded-xl object-cover shadow-sm" />
            <span class="font-display text-[22px] font-bold text-primary tracking-tight">Kharcha App</span>
          </div>

          <div class="flex items-center gap-3">
            <Link
              to="/login"
              class="px-4 py-2 text-on-surface-variant font-title-md hover:text-primary transition-colors text-sm"
            >
              Log In
            </Link>
            <Link
              to="/signup"
              class="px-5 py-2.5 bg-primary text-on-primary font-title-md rounded-full hover:bg-primary-container active:scale-95 transition-all shadow-xs text-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main class="flex-1 max-w-[1120px] w-full mx-auto px-4 md:px-8 py-12 md:py-20 flex flex-col items-center text-center">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
          <span class="material-symbols-outlined text-[16px]">account_balance_wallet</span>
          <span>Simple, Smart & Secure Expense Tracking</span>
        </div>

        <h1 class="font-display text-[36px] sm:text-[48px] md:text-[56px] font-extrabold text-on-surface leading-[1.15] max-w-[800px] mb-6">
          Take full control of your daily expenses with <span class="text-primary">Kharcha App</span>
        </h1>

        <p class="font-body-lg text-[16px] md:text-[18px] text-on-surface-variant max-w-[640px] mb-8 leading-relaxed">
          Kharcha App helps you effortlessly track your daily spending, organize custom categories, reorder items by frequency, and automatically back up receipt images to Google Drive.
        </p>

        <div class="flex flex-col sm:flex-row gap-4 w-full max-w-[360px] justify-center mb-16">
          <Link
            to="/signup"
            class="h-12 px-8 bg-primary text-on-primary font-title-md rounded-full hover:bg-primary-container active:scale-98 transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span>Create Free Account</span>
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
          <Link
            to="/login"
            class="h-12 px-8 bg-surface-container-lowest border border-outline-variant text-on-surface font-title-md rounded-full hover:bg-surface-container-low transition-colors flex items-center justify-center"
          >
            Sign In
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <section class="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left mt-4">
          <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-3">
            <div class="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-[26px]">receipt_long</span>
            </div>
            <h3 class="font-title-md text-[18px] font-bold text-on-surface">Receipt Archiving</h3>
            <p class="font-body-sm text-on-surface-variant leading-normal">
              Attach receipt photos to any expense record and keep them safely backed up in your personal Google Drive account.
            </p>
          </div>

          <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-3">
            <div class="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-[26px]">category</span>
            </div>
            <h3 class="font-title-md text-[18px] font-bold text-on-surface">Custom Categories</h3>
            <p class="font-body-sm text-on-surface-variant leading-normal">
              Create, edit, and reorder categories by your personal spending frequency for 1-tap logging.
            </p>
          </div>

          <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-xs flex flex-col gap-3">
            <div class="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-[26px]">analytics</span>
            </div>
            <h3 class="font-title-md text-[18px] font-bold text-on-surface">Monthly Insights</h3>
            <p class="font-body-sm text-on-surface-variant leading-normal">
              Monitor monthly totals, browse grouped date expense lists, and filter spending instantly.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer class="w-full border-t border-outline-variant py-8 bg-surface-container-lowest">
        <div class="max-w-[1120px] mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant">
          <div class="flex items-center gap-2">
            <img src="/logo.png" alt="Kharcha App" class="w-5 h-5 rounded object-cover" />
            <span class="font-semibold text-on-surface">Kharcha App</span>
            <span>© {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div class="flex items-center gap-6">
            <Link to="/login" class="hover:text-primary transition-colors">Sign In</Link>
            <Link to="/signup" class="hover:text-primary transition-colors">Create Account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
