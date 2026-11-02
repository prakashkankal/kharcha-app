import { CategoryIcon, Icon } from '../components/Icon.jsx';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategory } from '../context/CategoryContext';
import { useAuth } from '../context/AuthContext';
import { expenseApi } from '../services/expenseApi';
import { getSpendingTotal, getTransactionType } from '../services/transactionUtils';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { categories } = useCategory();
  const { user } = useAuth();

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedMonthQuery, setSelectedMonthQuery] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedWeekStartKey, setSelectedWeekStartKey] = useState(() => {
    const today = new Date();
    const dayOffset = today.getDay();
    return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset))
      .toISOString()
      .slice(0, 10);
  });
  const [selectedDayKey, setSelectedDayKey] = useState(() => new Date().toISOString().slice(0, 10));
  const [activePicker, setActivePicker] = useState(null);

  const [expenses, setExpenses] = useState([]);
  const [currentPeriodExpenses, setCurrentPeriodExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasExpensesRef = useRef(false);
  const receiptInputRef = useRef(null);
  // Whether we've shown initial data from local cache (avoids flash)
  const hydratedFromCache = useRef(false);

  // Pending Receivables state
  const [receivablesData, setReceivablesData] = useState({ totalReceivable: 0, receivables: [] });
  const [loadingReceivables, setLoadingReceivables] = useState(false);
  const [selectedReceivableForPayment, setSelectedReceivableForPayment] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentNotesInput, setPaymentNotesInput] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentDialogError, setPaymentDialogError] = useState('');

  const selectedMonthDate = new Date(`${selectedMonthQuery}-01T00:00:00Z`);
  const todayKey = new Date().toISOString().slice(0, 10);

  const fetchReceivables = useCallback(async () => {
    setLoadingReceivables(true);
    try {
      const data = await expenseApi.getPendingReceivables();
      setReceivablesData(data || { totalReceivable: 0, receivables: [] });
    } catch (e) {
      console.warn('Failed to fetch pending receivables:', e);
    } finally {
      setLoadingReceivables(false);
    }
  }, []);

  const fetchDashboardData = useCallback(async (isInitial = false) => {
    if (isInitial && !hasExpensesRef.current) {
      setLoading(true);
    }
    setError('');
    try {
      const categoryIdParam = selectedCategoryFilter !== 'all' ? selectedCategoryFilter : undefined;
      const expensesData = await expenseApi.getExpenses({ categoryId: categoryIdParam });

      hasExpensesRef.current = expensesData?.length > 0;
      setExpenses(expensesData || []);
      setCurrentPeriodExpenses(expensesData || []);
    } catch (err) {
      console.warn('Dashboard data fetch warning:', err.message);
      if (!hasExpensesRef.current) {
        setError(err.message || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryFilter]);

  // On mount: hydrate from local IndexedDB cache first (instant), then fetch from server
  useEffect(() => {
    const hydrateFromLocal = async () => {
      if (hydratedFromCache.current) return;
      try {
        const cached = await expenseApi.getDashboardCached();
        if (cached && Array.isArray(cached.recentExpenses) && cached.recentExpenses.length > 0) {
          hydratedFromCache.current = true;
          hasExpensesRef.current = true;
          setExpenses(cached.recentExpenses);
          setCurrentPeriodExpenses(cached.recentExpenses);
          // Don't show loading spinner since we have cached data
          setLoading(false);
        }
      } catch {
        // Ignore - will fall through to network fetch
      }
    };

    hydrateFromLocal();
    fetchDashboardData(true);
    fetchReceivables();
  }, [fetchDashboardData, fetchReceivables]);

  // Re-fetch quietly when a background sync finishes
  useEffect(() => {
    const handleSyncEvent = () => {
      fetchDashboardData(false);
      fetchReceivables();
    };
    window.addEventListener('kharcha_sync_event', handleSyncEvent);
    return () => window.removeEventListener('kharcha_sync_event', handleSyncEvent);
  }, [fetchDashboardData, fetchReceivables]);

  // Handle Mark as Received or Open Payment Dialog
  const handleOpenPaymentDialog = (receivable) => {
    setSelectedReceivableForPayment(receivable);
    setPaymentAmountInput(receivable.outstandingAmount.toString());
    setPaymentNotesInput('');
    setPaymentDialogError('');
  };

  const handleClosePaymentDialog = () => {
    if (recordingPayment) return;
    setSelectedReceivableForPayment(null);
    setPaymentAmountInput('');
    setPaymentNotesInput('');
    setPaymentDialogError('');
  };

  const handleConfirmPayment = async (e) => {
    if (e) e.preventDefault();
    if (!selectedReceivableForPayment) return;

    setPaymentDialogError('');
    const amt = parseFloat(paymentAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setPaymentDialogError('Please enter a valid amount greater than 0');
      return;
    }

    if (amt > selectedReceivableForPayment.outstandingAmount) {
      setPaymentDialogError(`Amount cannot exceed outstanding balance ₹${selectedReceivableForPayment.outstandingAmount.toFixed(2)}`);
      return;
    }

    setRecordingPayment(true);
    try {
      await expenseApi.recordParticipantPayment(
        selectedReceivableForPayment._id,
        amt,
        paymentNotesInput
      );
      handleClosePaymentDialog();
      await fetchReceivables();
      await fetchDashboardData(false);
    } catch (err) {
      setPaymentDialogError(err.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  const getMonthDayCount = (monthQuery) => {
    const [y, m] = monthQuery.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  };

  const getCalendarWeeks = (monthQuery) => {
    const [y, m] = monthQuery.split('-').map(Number);
    const dayCount = getMonthDayCount(monthQuery);
    const weeks = [];
    let currentWeek = [];

    for (let day = 1; day <= dayCount; day++) {
      const date = new Date(Date.UTC(y, m - 1, day));
      const dayKey = date.toISOString().slice(0, 10);
      currentWeek.push(dayKey);

      if (date.getUTCDay() === 6 || day === dayCount) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    return weeks;
  };

  const calendarWeeks = getCalendarWeeks(selectedMonthQuery);

  const getDayTotal = (dayKey) => {
    const filtered = expenses.filter(
      (e) => new Date(e.date).toISOString().slice(0, 10) === dayKey
    );
    return getSpendingTotal(filtered);
  };

  const getWeekTotal = (weekDays = []) => {
    const filtered = expenses.filter((e) => {
      const expDay = new Date(e.date).toISOString().slice(0, 10);
      return weekDays.includes(expDay);
    });
    return getSpendingTotal(filtered);
  };

  const getMonthTotal = (monthQuery) => {
    const filtered = expenses.filter(
      (e) => new Date(e.date).toISOString().slice(0, 7) === monthQuery
    );
    return getSpendingTotal(filtered);
  };

  const selectDay = (dayKey) => {
    setSelectedDayKey(dayKey);
    setActivePicker(null);
  };

  const selectWeek = (weekDays) => {
    setSelectedWeekStartKey(weekDays[0]);
    setSelectedDayKey(weekDays[0]);
    setActivePicker(null);
  };

  const selectMonth = (monthQuery) => {
    setSelectedMonthQuery(monthQuery);
    const weeks = getCalendarWeeks(monthQuery);
    if (weeks.length > 0) {
      setSelectedWeekStartKey(weeks[0][0]);
      setSelectedDayKey(weeks[0][0]);
    }
    setActivePicker(null);
  };

  const handleReceiptCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      navigate('/add-expense', { state: { receiptFile: file } });
    }
  };

  // Filter expenses for current month query in activity section
  const activityExpenses = currentPeriodExpenses.filter(
    (e) => new Date(e.date).toISOString().slice(0, 7) === selectedMonthQuery
  );

  const selectedWeekIndex = Math.max(
    0,
    calendarWeeks.findIndex((week) => week.includes(selectedDayKey))
  );
  const currentWeekDays = calendarWeeks[selectedWeekIndex] || calendarWeeks[0] || [];

  const selectedMonthName = selectedMonthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const monthlyBudget = Number(user?.settings?.monthlyBudget) || 0;

  const currentWeekTotal = getWeekTotal(currentWeekDays);
  const currentMonthTotal = getMonthTotal(selectedMonthQuery);
  const currentDayTotal = getDayTotal(selectedDayKey);

  // Build a lookup: expenseId -> array of pending receivable participants
  const receivablesByExpenseId = React.useMemo(() => {
    const map = {};
    for (const r of receivablesData.receivables) {
      const eid = typeof r.expenseId === 'object' ? r.expenseId._id : r.expenseId;
      if (!eid) continue;
      if (!map[eid]) map[eid] = [];
      map[eid].push(r);
    }
    return map;
  }, [receivablesData.receivables]);

  // Helper for subtitle in transaction row (e.g. "Today", "Yesterday", "27 Oct")
  const getTransactionSubtitle = (expense) => {
    const itemDate = new Date(expense.date);
    const itemKey = itemDate.toISOString().slice(0, 10);
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yesterdayKeyStr = yest.toISOString().slice(0, 10);

    let dateText = itemDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (itemKey === todayKey) dateText = 'Today';
    else if (itemKey === yesterdayKeyStr) dateText = 'Yesterday';

    return dateText;
  };

  // Theme helper for pastel category icon squares
  const getCategoryTheme = (expense) => {
    const iconName = String(expense.categoryId?.icon || '').toLowerCase();
    const catName = String(expense.categoryId?.name || '').toLowerCase();

    if (catName.includes('food') || iconName.includes('utensil') || iconName.includes('food') || iconName.includes('coffee')) {
      return {
        bg: 'bg-[#FFEDD5]',
        text: 'text-[#EA580C]',
        icon: 'utensils',
      };
    }
    if (catName.includes('travel') || iconName.includes('car') || iconName.includes('bus') || iconName.includes('plane')) {
      return {
        bg: 'bg-[#DCFCE7]',
        text: 'text-[#16A34A]',
        icon: 'car',
      };
    }
    if (catName.includes('shop') || iconName.includes('shopping') || iconName.includes('bag')) {
      return {
        bg: 'bg-[#E0E7FF]',
        text: 'text-[#4F46E5]',
        icon: 'shopping',
      };
    }
    if (catName.includes('entertain') || iconName.includes('movie') || iconName.includes('game')) {
      return {
        bg: 'bg-[#FCE7F3]',
        text: 'text-[#DB2777]',
        icon: 'movies',
      };
    }
    if (catName.includes('bill') || catName.includes('util') || iconName.includes('lightbulb')) {
      return {
        bg: 'bg-[#FEF3C7]',
        text: 'text-[#D97706]',
        icon: 'lightbulb',
      };
    }
    return {
      bg: 'bg-[#F1F5F9]',
      text: 'text-[#475569]',
      icon: expense.categoryId?.icon || 'package',
    };
  };

  return (
    <div class="relative w-full max-w-[1024px] mx-auto pb-safe space-y-6">
      {/* Soft ambient glow in top-right */}
      <div class="absolute -top-12 -right-8 w-64 h-64 bg-purple-200/35 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* 1. Hero Month Card */}
      <div class="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#2D0B6B] via-[#3B0764] to-[#1E1050] text-white p-6 shadow-xl shadow-purple-950/20">
        <div class="absolute -top-12 -right-12 w-44 h-44 bg-purple-400/10 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header Row inside Hero Card */}
        <div class="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setActivePicker('month')}
            class="flex items-center gap-1.5 text-white/90 hover:text-white font-medium text-sm transition-colors cursor-pointer group"
          >
            <span>{selectedMonthName}</span>
            <Icon name="chevron_down" className="text-[18px] group-hover:translate-y-0.5 transition-transform" />
          </button>

          <span class="bg-white/15 backdrop-blur-xs text-white/90 text-xs px-3 py-1 rounded-full font-medium">
            Month
          </span>
        </div>

        {/* Amount & Bar Chart Graphic Row */}
        <div class="flex items-end justify-between mt-3">
          <div>
            <h2 class="text-[34px] md:text-[38px] font-extrabold tracking-tight font-numeric-display leading-none">
              ₹{currentMonthTotal.toLocaleString('en-IN')}
            </h2>

            {/* Spending Progress Bar */}
            <div class="mt-4 w-44 md:w-56 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                class="h-full bg-white rounded-full transition-all duration-500"
                style={{
                  width: `${
                    monthlyBudget > 0
                      ? Math.min(100, Math.max(12, (currentMonthTotal / monthlyBudget) * 100))
                      : 65
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Mini stylized decorative vertical bars */}
          <div class="flex items-end gap-1.5 pr-1 opacity-80 pointer-events-none">
            <div class="w-3.5 h-6 bg-white/35 rounded-full" />
            <div class="w-3.5 h-11 bg-white/60 rounded-full" />
            <div class="w-3.5 h-16 bg-white/90 rounded-full" />
          </div>
        </div>
      </div>

      {/* 2. Sub-cards Row: This Week & Today */}
      <section class="grid grid-cols-2 gap-3.5 md:gap-4">
        {/* This Week Card */}
        <button
          type="button"
          onClick={() => setActivePicker('week')}
          class="bg-[#F0F5FF] border border-[#E0EAFF] rounded-[24px] p-4 flex items-center gap-3.5 hover:bg-[#EBF2FF] transition-all cursor-pointer shadow-2xs group text-left"
        >
          <div class="w-12 h-12 rounded-[18px] bg-[#DBEAFE] flex items-center justify-center text-[#2563EB] shrink-0 group-hover:scale-105 transition-transform">
            <Icon name="calendar_month" className="text-[22px]" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium text-slate-500 truncate">This Week</p>
            <p class="text-[20px] md:text-[22px] font-bold text-slate-900 truncate font-numeric-display mt-0.5">
              ₹{currentWeekTotal.toLocaleString('en-IN')}
            </p>
          </div>
        </button>

        {/* Today Card */}
        <button
          type="button"
          onClick={() => setActivePicker('day')}
          class="bg-[#FFF8F0] border border-[#FFE8D6] rounded-[24px] p-4 flex items-center gap-3.5 hover:bg-[#FFF3E8] transition-all cursor-pointer shadow-2xs group text-left"
        >
          <div class="w-12 h-12 rounded-[18px] bg-[#FFEDD5] flex items-center justify-center text-[#EA580C] shrink-0 group-hover:scale-105 transition-transform">
            <Icon name="sun" className="text-[22px]" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium text-slate-500 truncate">Today</p>
            <p class="text-[20px] md:text-[22px] font-bold text-slate-900 truncate font-numeric-display mt-0.5">
              ₹{currentDayTotal.toLocaleString('en-IN')}
            </p>
          </div>
        </button>
      </section>

      {/* 3. Categories */}
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-[#0F172A]">Categories</h2>
          <button
            type="button"
            onClick={() => navigate('/categories')}
            class="flex items-center gap-0.5 text-sm font-semibold text-[#6D28D9] hover:underline cursor-pointer"
          >
            See All <Icon name="chevron_right" className="text-[18px]" />
          </button>
        </div>

        <nav aria-label="Expense Categories" class="flex overflow-x-auto no-scrollbar gap-2.5 py-1 -mx-container-margin px-container-margin md:mx-0 md:px-0">
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter('all')}
            class={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-xs ${
              selectedCategoryFilter === 'all'
                ? 'bg-[#43189E] text-white shadow-purple-900/15'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
            }`}
          >
            <Icon name="apps" className="text-[18px]" />
            All
          </button>

          {categories.map((cat) => {
            const isActive = selectedCategoryFilter === cat._id;
            return (
              <button
                key={cat._id}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat._id)}
                class={`whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 shrink-0 cursor-pointer border shadow-2xs ${
                  isActive
                    ? 'bg-[#43189E] text-white border-[#43189E] font-semibold'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200/80'
                }`}
              >
                <CategoryIcon name={cat.icon} className="text-[17px]" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Error Alert */}
      {error && (
        <div class="bg-error-container text-on-error-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2">
          <Icon name="error" className="text-[20px]" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. Recent Section */}
      <div class="space-y-3 pt-1">
        <h2 class="text-lg font-bold text-[#0F172A]">Recent</h2>

        {/* Loading Skeleton */}
        {loading ? (
          <div class="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
            <div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p class="text-sm">Loading expenses...</p>
          </div>
        ) : activityExpenses.length === 0 ? (
          /* Empty State Card */
          <div class="flex flex-col items-center justify-center text-center w-full min-h-[300px] my-2 bg-white border border-slate-100 rounded-[28px] p-8 shadow-xs">
            <div class="w-16 h-16 bg-[#EDE9FE] text-[#6D28D9] rounded-2xl flex items-center justify-center mb-4 shrink-0">
              <Icon name="receipt_long" className="text-[32px]" />
            </div>
            <h3 class="text-xl font-bold text-slate-900 mb-1">No transactions yet</h3>
            <p class="text-sm text-slate-500 mb-5 max-w-[320px]">
              Add an expense or scan a receipt to start tracking your spends.
            </p>
            <div class="flex flex-col sm:flex-row gap-3 w-full max-w-[360px]">
              <button
                type="button"
                onClick={() => navigate('/add-expense')}
                class="flex-1 h-12 bg-[#43189E] hover:bg-[#381386] text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
              >
                <Icon name="add" className="text-[20px]" /> Add Expense
              </button>
              <button
                type="button"
                onClick={() => receiptInputRef.current?.click()}
                class="flex-1 h-12 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Icon name="photo_camera" className="text-[20px]" /> Scan Receipt
              </button>
            </div>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleReceiptCapture}
              class="hidden"
              aria-label="Capture or choose a receipt image"
            />
          </div>
        ) : (
          /* Individual floating transaction cards */
          <div class="space-y-3">
            {activityExpenses.map((expense) => {
              const theme = getCategoryTheme(expense);
              const subtitle = getTransactionSubtitle(expense);
              const isIncome = getTransactionType(expense) === 'income';
              const isTransfer = getTransactionType(expense) === 'transfer';
              const pendingReceivables = receivablesByExpenseId[expense._id] || [];

              return (
                <div
                  key={expense._id}
                  onClick={() => navigate(`/expense/${expense._id}`)}
                  class="bg-white border border-slate-100 rounded-[22px] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all cursor-pointer flex items-center justify-between"
                >
                  {/* Left: Icon and Title/Date */}
                  <div class="flex items-center gap-3.5 min-w-0">
                    <div class={`w-12 h-12 rounded-[18px] ${theme.bg} ${theme.text} flex items-center justify-center shrink-0`}>
                      <Icon name={theme.icon} className="text-[22px]" />
                    </div>
                    <div class="min-w-0">
                      <p class="font-bold text-[#0F172A] text-base leading-tight truncate">
                        {expense.categoryId?.name || expense.description || 'Expense'}
                      </p>
                      <p class="text-xs text-slate-400 font-medium mt-1 truncate">
                        {subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Right: Amount and Badges */}
                  <div class="text-right shrink-0 flex flex-col items-end">
                    <p class="font-numeric-display text-[19px] md:text-[20px] font-bold text-[#0F172A]">
                      {isIncome ? '+' : isTransfer ? '' : '-'}₹{expense.amount.toLocaleString('en-IN')}
                    </p>

                    {/* Pending Receivable Pill (like in image) */}
                    {expense.isSplit && pendingReceivables.length > 0 ? (
                      <div class="flex flex-col items-end gap-1 mt-1">
                        {pendingReceivables.map((r) => (
                          <button
                            key={r._id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPaymentDialog(r);
                            }}
                            class="bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium hover:bg-[#FDE68A] transition-colors cursor-pointer"
                            title={`₹${r.outstandingAmount.toLocaleString('en-IN')} pending from ${r.personName} — click to mark as received`}
                          >
                            <Icon name="people" className="text-[13px]" />
                            <span>₹{r.outstandingAmount.toLocaleString('en-IN')} from {r.personName}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div class="flex items-center gap-1 mt-1">
                        {expense.isSplit && (
                          <span class="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <Icon name="group" className="text-[11px]" />
                            Split
                          </span>
                        )}
                        {expense.receiptUrl && (
                          <span class="text-[11px] text-[#43189E] flex items-center gap-0.5">
                            <Icon name="attach_file" className="text-[13px]" />
                            Receipt
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation & Partial Payment Modal Dialog */}
      {selectedReceivableForPayment && (
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 w-full max-w-[420px] shadow-xl space-y-4">
            <div class="flex items-center justify-between border-b pb-3 border-outline-variant">
              <h3 class="font-title-md text-lg font-bold text-on-surface flex items-center gap-2">
                <Icon name="payments" className="text-primary text-[22px]" />
                Record Received Payment
              </h3>
              <button
                type="button"
                onClick={handleClosePaymentDialog}
                disabled={recordingPayment}
                class="text-on-surface-variant hover:text-on-surface p-1 rounded-full cursor-pointer"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            {paymentDialogError && (
              <div class="bg-error-container text-on-error-container px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                <Icon name="error" className="text-[16px]" />
                <span>{paymentDialogError}</span>
              </div>
            )}

            <div class="space-y-2 text-sm bg-surface-container-low p-3.5 rounded-xl border border-outline-variant">
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Participant:</span>
                <span class="font-bold text-on-surface">{selectedReceivableForPayment.personName}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Associated Expense:</span>
                <span class="font-medium text-on-surface">{selectedReceivableForPayment.expenseId?.description || 'Expense'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Full Share Amount:</span>
                <span class="font-medium text-on-surface">₹{selectedReceivableForPayment.shareAmount.toFixed(2)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Already Received:</span>
                <span class="font-medium text-on-surface">₹{(selectedReceivableForPayment.amountPaidBack || 0).toFixed(2)}</span>
              </div>
              <div class="flex justify-between border-t border-outline-variant/60 pt-1.5 font-bold">
                <span class="text-on-surface">Outstanding Balance:</span>
                <span class="text-primary text-base">₹{selectedReceivableForPayment.outstandingAmount.toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmPayment} class="space-y-3">
              <div>
                <label class="block font-label-caps text-xs text-on-surface-variant uppercase mb-1">
                  Amount Received (₹)
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedReceivableForPayment.outstandingAmount}
                    required
                    value={paymentAmountInput}
                    onChange={(e) => setPaymentAmountInput(e.target.value)}
                    class="w-full h-11 pl-8 pr-3 rounded-lg border border-outline-variant bg-surface-bright text-on-surface font-bold text-base focus:border-primary outline-none"
                  />
                </div>
                <div class="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentAmountInput(selectedReceivableForPayment.outstandingAmount.toString())}
                    class="text-xs text-primary underline hover:opacity-80 cursor-pointer"
                  >
                    Full remaining (₹{selectedReceivableForPayment.outstandingAmount.toFixed(2)})
                  </button>
                  {selectedReceivableForPayment.outstandingAmount > 100 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmountInput((selectedReceivableForPayment.outstandingAmount / 2).toFixed(2))}
                      class="text-xs text-on-surface-variant underline hover:text-primary cursor-pointer"
                    >
                      50% (₹{(selectedReceivableForPayment.outstandingAmount / 2).toFixed(2)})
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label class="block font-label-caps text-xs text-on-surface-variant uppercase mb-1">
                  Notes / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via GPay"
                  value={paymentNotesInput}
                  onChange={(e) => setPaymentNotesInput(e.target.value)}
                  class="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface-bright text-on-surface text-sm outline-none focus:border-primary"
                />
              </div>

              <div class="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleClosePaymentDialog}
                  disabled={recordingPayment}
                  class="flex-1 h-11 border border-outline-variant text-on-surface rounded-xl font-title-md text-sm hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  class="flex-1 h-11 bg-primary text-on-primary rounded-xl font-title-md text-sm hover:bg-primary-container transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {recordingPayment ? (
                    <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Icon name="check_circle" className="text-[18px]" />
                      Confirm Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Date Range Navigation Picker Dialog */}
      {activePicker && (
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 w-full max-w-[420px] shadow-2xl space-y-4">
            <div class="flex items-center justify-between border-b pb-3 border-outline-variant">
              <h3 class="font-title-md text-base font-bold text-on-surface capitalize flex items-center gap-2">
                <Icon
                  name={
                    activePicker === 'month'
                      ? 'calendar_month'
                      : activePicker === 'week'
                        ? 'date_range'
                        : 'today'
                  }
                  className="text-primary text-[20px]"
                />
                Select {activePicker}
              </h3>
              <button
                type="button"
                onClick={() => setActivePicker(null)}
                class="text-on-surface-variant hover:text-on-surface p-1 rounded-full cursor-pointer"
                aria-label="Close"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            {activePicker === 'month' && (
              <div class="grid grid-cols-3 gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((monthIndex) => {
                  const [y] = selectedMonthQuery.split('-').map(Number);
                  const mKey = `${y}-${String(monthIndex + 1).padStart(2, '0')}`;
                  const monthName = new Date(Date.UTC(y, monthIndex, 1)).toLocaleDateString('en-US', {
                    month: 'short',
                    timeZone: 'UTC',
                  });

                  return (
                    <button
                      key={mKey}
                      type="button"
                      onClick={() => selectMonth(mKey)}
                      class={`p-3 rounded-xl border text-center transition-colors cursor-pointer ${
                        selectedMonthQuery === mKey
                          ? 'bg-primary text-on-primary border-primary font-bold shadow-xs'
                          : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high border-outline-variant/60'
                      }`}
                    >
                      <span class="block text-sm font-semibold">{monthName}</span>
                      <span
                        class={`block text-[11px] font-bold mt-1 ${
                          selectedMonthQuery === mKey ? 'text-on-primary/90' : 'text-on-surface-variant'
                        }`}
                      >
                        ₹{getMonthTotal(mKey).toLocaleString('en-IN')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {activePicker === 'week' && (
              <div class="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
                {calendarWeeks.map((weekDays, index) => {
                  const weekNum = index + 1;
                  const isSel = selectedWeekIndex === index;
                  const wTotal = getWeekTotal(weekDays);
                  const startStr = new Date(`${weekDays[0]}T00:00:00Z`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  });
                  const endStr = new Date(`${weekDays[weekDays.length - 1]}T00:00:00Z`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  });

                  return (
                    <button
                      key={weekNum}
                      type="button"
                      onClick={() => selectWeek(weekDays)}
                      class={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        isSel
                          ? 'bg-primary text-on-primary border-primary font-bold shadow-xs'
                          : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high border-outline-variant/60'
                      }`}
                    >
                      <span class="block font-title-md text-sm font-semibold">Week {weekNum}</span>
                      <span
                        class={`block text-[11px] mt-0.5 ${
                          isSel ? 'text-on-primary/80' : 'text-on-surface-variant'
                        }`}
                      >
                        {startStr} - {endStr}
                      </span>
                      <span class="block font-numeric-display text-sm font-bold mt-1">
                        ₹{wTotal.toLocaleString('en-IN')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {activePicker === 'day' && (
              <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {calendarWeeks.map((weekDays, wIdx) => (
                  <div key={wIdx}>
                    <p class="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 px-1">
                      Week {wIdx + 1}
                    </p>
                    <div class="grid grid-cols-2 gap-2">
                      {weekDays.map((dayKey) => {
                        const dDate = new Date(`${dayKey}T00:00:00Z`);
                        const isSel = selectedDayKey === dayKey;
                        const dTotal = getDayTotal(dayKey);

                        return (
                          <button
                            key={dayKey}
                            type="button"
                            onClick={() => selectDay(dayKey)}
                            class={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                              isSel
                                ? 'bg-primary text-on-primary border-primary font-bold shadow-xs'
                                : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high border-outline-variant/60'
                            }`}
                          >
                            <div class="flex items-center justify-between">
                              <span class="text-xs font-semibold">
                                {dDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
                              </span>
                              <span
                                class={`text-[11px] ${
                                  isSel ? 'text-on-primary/80' : 'text-on-surface-variant'
                                }`}
                              >
                                {dDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                              </span>
                            </div>
                            <span class="block text-sm font-bold mt-1">
                              ₹{dTotal.toLocaleString('en-IN')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
