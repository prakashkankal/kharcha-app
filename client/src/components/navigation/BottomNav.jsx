import { Icon } from '../Icon.jsx';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const BottomNav = () => {
  const location = useLocation();
  const path = location.pathname;

  const isHome = path === '/dashboard' || path === '/';
  const isAddExpense = path === '/add-expense';
  const isAnalytics = path === '/analytics';

  return (
    <nav class="md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-100/80 pb-safe grid grid-cols-3 items-center h-[76px] px-6 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      {/* Home Tab */}
      <div class="flex justify-center">
        <Link
          to="/dashboard"
          class={`flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all duration-150 ${
            isHome
              ? 'bg-[#EDE9FE] text-[#6D28D9] font-bold'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Icon name="home" className="text-[20px]" />
          <span class="text-[11px] mt-0.5 font-semibold">Home</span>
        </Link>
      </div>

      {/* Floating Center Add Expense Button */}
      <div class="flex flex-col items-center relative -top-3.5">
        <Link
          to="/add-expense"
          aria-label="Add expense"
          class="w-14 h-14 rounded-full bg-[#43189E] hover:bg-[#381386] text-white shadow-lg shadow-purple-600/35 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Icon name="add" className="text-[28px]" />
        </Link>
        <span class={`text-[11px] mt-1 transition-colors ${isAddExpense ? 'text-[#43189E] font-bold' : 'text-slate-600 font-medium'}`}>
          Add Expense
        </span>
      </div>

      {/* Analytics Tab */}
      <div class="flex justify-center">
        <Link
          to="/analytics"
          class={`flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all duration-150 ${
            isAnalytics
              ? 'bg-[#EDE9FE] text-[#6D28D9] font-bold'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Icon name="bar_chart" className="text-[20px]" />
          <span class="text-[11px] mt-0.5 font-semibold">Analytics</span>
        </Link>
      </div>
    </nav>
  );
};
