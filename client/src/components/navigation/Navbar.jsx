import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SyncStatusBadge } from '../SyncStatusBadge';
import { useAuth } from '../../context/AuthContext';

export const Navbar = () => {
  const location = useLocation();
  const path = location.pathname;
  const { user } = useAuth();

  const isProfileActive =
    path.startsWith('/profile') || path.startsWith('/categories') || path.startsWith('/settings');

  return (
    <header class="w-full bg-surface border-b border-outline-variant sticky top-0 z-40 shadow-xs">
      <div class="w-full max-w-[1024px] mx-auto flex items-center justify-between px-container-margin h-14">
        <div class="flex items-center gap-3">
          <Link to="/add-expense" class="flex items-center gap-2">
            <img src="/logo.png" alt="Kharcha Logo" class="w-8 h-8 rounded-lg object-cover shadow-xs" />
            <h1 class="font-title-md text-title-md text-primary font-bold tracking-tight">Kharcha</h1>
          </Link>
          <SyncStatusBadge />
        </div>

        {/* Desktop Top Navigation */}
        <nav class="hidden md:flex gap-6 items-center">
          <Link
            to="/add-expense"
            class={`font-title-md text-title-md flex items-center gap-2 pb-1 transition-colors duration-200 ${
              path === '/add-expense' || path === '/'
                ? 'text-primary font-bold border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span class={`material-symbols-outlined ${path === '/add-expense' || path === '/' ? 'icon-fill' : ''}`}>
              add_circle
            </span>
            Add Expense
          </Link>

          <Link
            to="/dashboard"
            class={`font-title-md text-title-md flex items-center gap-2 pb-1 transition-colors duration-200 ${
              path === '/dashboard'
                ? 'text-primary font-bold border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span class={`material-symbols-outlined ${path === '/dashboard' ? 'icon-fill' : ''}`}>
              dashboard
            </span>
            Dashboard
          </Link>

          <Link
            to="/analytics"
            class={`font-title-md text-title-md flex items-center gap-2 pb-1 transition-colors duration-200 ${
              path === '/analytics'
                ? 'text-primary font-bold border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span class={`material-symbols-outlined ${path === '/analytics' ? 'icon-fill' : ''}`}>
              bar_chart
            </span>
            Analytics
          </Link>

          <Link
            to="/profile"
            class={`font-title-md text-title-md flex items-center gap-2 pb-1 transition-colors duration-200 ${
              path.startsWith('/profile') || path.startsWith('/categories') || path.startsWith('/settings')
                ? 'text-primary font-bold border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span class={`material-symbols-outlined ${path.startsWith('/profile') ? 'icon-fill' : ''}`}>
              person
            </span>
            Profile
          </Link>
        </nav>

        {/* Profile Avatar — visible on all screen sizes, top-right */}
        <Link
          to="/profile"
          title="Profile"
          class={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-200 shrink-0 ${
            isProfileActive
              ? 'border-primary bg-primary/10 text-primary shadow-md'
              : 'border-outline-variant bg-surface-container text-on-surface-variant hover:border-primary hover:text-primary hover:shadow-sm'
          }`}
        >
          {user?.name ? (
            <span class="font-bold text-sm select-none leading-none">
              {user.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <span class="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isProfileActive ? "'FILL' 1" : "'FILL' 0" }}>
              person
            </span>
          )}
        </Link>
      </div>
    </header>
  );
};
