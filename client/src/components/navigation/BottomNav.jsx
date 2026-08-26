import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const BottomNav = () => {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav class="md:hidden fixed bottom-0 left-0 w-full bg-surface border-t border-outline-variant pb-safe flex justify-around items-center h-16 px-2 z-50 shadow-sm">
      {/* Add Expense (Default Main Screen) */}
      <Link
        to="/add-expense"
        class={`flex flex-col items-center justify-center flex-1 h-full py-1 rounded-lg transition-all duration-150 active:scale-95 ${
          path === '/add-expense' || path === '/'
            ? 'text-primary font-bold'
            : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        <span
          class={`material-symbols-outlined text-[24px] mb-0.5 ${
            path === '/add-expense' || path === '/' ? 'icon-fill' : ''
          }`}
        >
          add_circle
        </span>
        <span class="font-label-caps text-[11px]">Add Expense</span>
      </Link>

      {/* Dashboard */}
      <Link
        to="/dashboard"
        class={`flex flex-col items-center justify-center flex-1 h-full py-1 rounded-lg transition-all duration-150 active:scale-95 ${
          path === '/dashboard' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        <span class={`material-symbols-outlined text-[24px] mb-0.5 ${path === '/dashboard' ? 'icon-fill' : ''}`}>
          dashboard
        </span>
        <span class="font-label-caps text-[11px]">Dashboard</span>
      </Link>

      {/* Profile */}
      <Link
        to="/profile"
        class={`flex flex-col items-center justify-center flex-1 h-full py-1 rounded-lg transition-all duration-150 active:scale-95 ${
          path.startsWith('/profile') || path.startsWith('/categories') || path.startsWith('/settings')
            ? 'text-primary font-bold'
            : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        <span
          class={`material-symbols-outlined text-[24px] mb-0.5 ${
            path.startsWith('/profile') || path.startsWith('/categories') ? 'icon-fill' : ''
          }`}
        >
          person
        </span>
        <span class="font-label-caps text-[11px]">Profile</span>
      </Link>
    </nav>
  );
};
