import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Navbar = () => {
  const location = useLocation();
  const path = location.pathname;

  return (
    <header class="w-full bg-surface border-b border-outline-variant sticky top-0 z-40 shadow-xs">
      <div class="w-full max-w-[1024px] mx-auto flex items-center justify-between px-container-margin h-14">
        <Link to="/add-expense" class="flex items-center gap-2">
          <img src="/logo.png" alt="Kharcha Logo" class="w-8 h-8 rounded-lg object-cover shadow-xs" />
          <h1 class="font-title-md text-title-md text-primary font-bold tracking-tight">Kharcha</h1>
        </Link>

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
      </div>
    </header>
  );
};
