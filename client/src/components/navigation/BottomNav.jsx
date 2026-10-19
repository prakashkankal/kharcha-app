import { Icon } from '../Icon.jsx';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const BottomNav = () => {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav class="md:hidden fixed bottom-0 left-0 w-full bg-surface/95 backdrop-blur border-t border-outline-variant pb-safe grid grid-cols-2 items-center h-[76px] px-5 z-50 shadow-[0_-8px_24px_rgba(19,27,46,0.08)]">
      <Link
        to="/dashboard"
        class={`relative flex flex-col items-center justify-center h-full py-1 rounded-lg transition-all duration-150 active:scale-95 ${
          path === '/dashboard' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        {path === '/dashboard' && <span class="absolute top-0 w-16 h-1 rounded-full bg-primary" />}
        <Icon name="dashboard" className="text-[24px] mb-0.5" />
        <span class="font-label-caps text-[11px]">Dashboard</span>
      </Link>

      <Link
        to="/add-expense"
        aria-label="Add expense"
        class="absolute left-1/2 -translate-x-1/2 -top-5 flex flex-col items-center gap-1 text-on-surface-variant active:scale-95 transition-transform"
      >
        <span class="w-[68px] h-[68px] rounded-full bg-primary text-on-primary border-4 border-background shadow-lg flex items-center justify-center">
          <Icon name="add" className="text-[32px]" />
        </span>
        <span class="font-label-caps text-[11px]">Add Expense</span>
      </Link>

      <Link
        to="/analytics"
        class={`relative flex flex-col items-center justify-center h-full py-1 rounded-lg transition-all duration-150 active:scale-95 ${
          path === '/analytics' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'
        }`}
      >
        {path === '/analytics' && <span class="absolute top-0 w-16 h-1 rounded-full bg-primary" />}
        <Icon name="bar_chart" className="text-[24px] mb-0.5" />
        <span class="font-label-caps text-[11px]">Analytics</span>
      </Link>
    </nav>
  );
};
