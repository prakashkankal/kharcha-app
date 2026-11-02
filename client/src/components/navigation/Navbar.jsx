import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '../Icon';
import { SyncStatusBadge } from '../SyncStatusBadge';
import { useAuth } from '../../context/AuthContext';

export const Navbar = () => {
  const location = useLocation();
  const path = location.pathname;
  const { user } = useAuth();

  const isProfileActive =
    path.startsWith('/profile') || path.startsWith('/categories') || path.startsWith('/settings');

  return (
    <header class="w-full bg-[#FAF8FF]/80 backdrop-blur-md sticky top-0 z-40">
      <div class="w-full max-w-[1024px] mx-auto flex items-center justify-between px-container-margin h-[70px] md:h-16">
        <div class="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-[#0F172A] text-sky-400 flex items-center justify-center shadow-xs">
              <Icon name="account_balance_wallet" className="text-[22px]" />
            </div>
            <h1 class="text-[24px] text-[#0F172A] font-extrabold tracking-tight">Kharcha</h1>
          </Link>
        </div>
        <div class="hidden md:block"><SyncStatusBadge /></div>

        {/* Desktop Top Navigation */}
        <nav class="hidden md:flex gap-6 items-center">
          <Link
            to="/add-expense"
            class={`font-title-md text-title-md flex items-center gap-2 pb-1 transition-colors duration-200 ${
              path === '/add-expense'
                ? 'text-[#43189E] font-bold border-b-2 border-[#43189E]'
                : 'text-slate-500 hover:text-[#43189E]'
            }`}
          >
            <Icon name="add_circle" />
            Add Expense
          </Link>

          <Link
            to="/dashboard"
            class={`font-title-md text-title-md flex items-center gap-2 pb-1 transition-colors duration-200 ${
              path === '/dashboard' || path === '/'
                ? 'text-[#43189E] font-bold border-b-2 border-[#43189E]'
                : 'text-slate-500 hover:text-[#43189E]'
            }`}
          >
            <Icon name="dashboard" />
            Dashboard
          </Link>

          <Link
            to="/analytics"
            class={`font-title-md text-title-md flex items-center gap-2 pb-1 transition-colors duration-200 ${
              path === '/analytics'
                ? 'text-[#43189E] font-bold border-b-2 border-[#43189E]'
                : 'text-slate-500 hover:text-[#43189E]'
            }`}
          >
            <Icon name="bar_chart" />
            Analytics
          </Link>

          <Link
            to="/profile"
            class={`font-title-md text-title-md flex items-center gap-2 pb-1 transition-colors duration-200 ${
              isProfileActive
                ? 'text-[#43189E] font-bold border-b-2 border-[#43189E]'
                : 'text-slate-500 hover:text-[#43189E]'
            }`}
          >
            <Icon name="person" />
            Profile
          </Link>
        </nav>

        {/* Profile Avatar — visible on all screen sizes, top-right */}
        <Link
          to="/profile"
          title="Profile"
          class="flex items-center justify-center w-10 h-10 rounded-full bg-[#EDE9FE] text-[#6D28D9] font-bold text-base shadow-xs border border-purple-200/80 hover:opacity-90 transition-opacity shrink-0"
        >
          {user?.name ? (
            <span class="select-none leading-none">
              {user.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <span class="select-none leading-none">P</span>
          )}
        </Link>
      </div>
    </header>
  );
};
