import { CategoryIcon, Icon } from '../components/Icon.jsx';
import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  const selectedMonthDate = new Date(`${selectedMonthQuery}-01T00:00:00Z`);
  const todayKey = new Date().toISOString().slice(0, 10);
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

  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Re-fetch quietly when a background sync finishes
  useEffect(() => {
    const handleSyncEvent = () => {
      fetchDashboardData(false);
    };
    window.addEventListener('kharcha_sync_event', handleSyncEvent);
    return () => window.removeEventListener('kharcha_sync_event', handleSyncEvent);
  }, [fetchDashboardData]);

  // Helper to group expenses by formatted date string
  const groupExpensesByDate = (expenseList) => {
    const groups = {};
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date(`${todayStr}T00:00:00Z`);
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    expenseList.forEach((item) => {
      const itemDateStr = new Date(item.date).toISOString().slice(0, 10);
      let label = new Date(item.date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
      });

      if (itemDateStr === todayStr) {
        label = `Today - ${label}`;
      } else if (itemDateStr === yesterdayStr) {
        label = `Yesterday - ${label}`;
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(item);
    });

    return groups;
  };

  const getMonthDayCount = (monthQuery) => {
    const [year, month] = monthQuery.split('-').map(Number);
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  };
  const getCalendarWeeks = (monthQuery) => {
    const [year, month] = monthQuery.split('-').map(Number);
    const firstDate = new Date(Date.UTC(year, month - 1, 1));
    const lastDate = new Date(Date.UTC(year, month - 1, getMonthDayCount(monthQuery)));
    const firstSunday = new Date(Date.UTC(year, month - 1, 1 - firstDate.getUTCDay()));
    const lastSaturday = new Date(Date.UTC(year, month - 1, lastDate.getUTCDate() + (6 - lastDate.getUTCDay())));
    const weeks = [];
    for (let weekStart = firstSunday; weekStart <= lastSaturday; weekStart = new Date(weekStart.getTime() + 7 * 86400000)) {
      const weekDays = Array.from({ length: 7 }, (_, index) =>
        new Date(weekStart.getTime() + index * 86400000).toISOString().slice(0, 10)
      );
      weeks.push({ start: weekDays[0], days: weekDays });
    }
    return weeks;
  };
  const calendarWeeks = getCalendarWeeks(selectedMonthQuery);
  const selectedWeekIndex = Math.max(
    0,
    calendarWeeks.findIndex((week) => week.start === selectedWeekStartKey)
  );
  const selectedWeek = calendarWeeks[selectedWeekIndex] || calendarWeeks[0];
  const selectedWeekNumber = selectedWeekIndex + 1;
  const selectedWeekDayKeys = selectedWeek.days;
  const selectedWeekStart = selectedWeek.start;
  const selectedWeekEnd = selectedWeek.days[6];
  const monthlyBudget = Number(user?.settings?.monthlyBudget) || 0;
  const weeklyBudget = monthlyBudget > 0 ? monthlyBudget / calendarWeeks.length : 0;
  const getExpenseDateKey = (expense) => new Date(expense.date || expense.createdAt).toISOString().slice(0, 10);
  const selectedMonthExpenses = currentPeriodExpenses.filter((expense) => {
    return getExpenseDateKey(expense).slice(0, 7) === selectedMonthQuery;
  });
  const getWeekDayKeys = (weekNumber) => {
    const week = calendarWeeks[weekNumber - 1];
    return week ? week.days : [];
  };
  const sumExpenses = (expenseList) => getSpendingTotal(expenseList);
  const getMonthTotal = (monthQuery) =>
    sumExpenses(currentPeriodExpenses.filter((expense) => getExpenseDateKey(expense).slice(0, 7) === monthQuery));
  const getWeekTotal = (week) =>
    sumExpenses(
      currentPeriodExpenses.filter((expense) => {
        const dateKey = getExpenseDateKey(expense);
        return dateKey.slice(0, 7) === selectedMonthQuery && dateKey >= week.days[0] && dateKey <= week.days[6];
      })
    );
  const getDayTotal = (dayKey) =>
    sumExpenses(currentPeriodExpenses.filter((expense) => getExpenseDateKey(expense) === dayKey));
  const currentMonthTotal = sumExpenses(selectedMonthExpenses);
  const currentWeekTotal = sumExpenses(
    currentPeriodExpenses.filter((expense) => {
      const dateKey = getExpenseDateKey(expense);
      return dateKey.slice(0, 7) === selectedMonthQuery && dateKey >= selectedWeekStart && dateKey <= selectedWeekEnd;
    })
  );
  const currentDayTotal = sumExpenses(
    currentPeriodExpenses.filter((expense) => getExpenseDateKey(expense) === selectedDayKey)
  );
  const activityExpenses = expenses.filter((expense) => getExpenseDateKey(expense) === selectedDayKey);
  const groupedExpenses = groupExpensesByDate(activityExpenses);
  const pickerTitle = activePicker === 'month' ? 'Select month' : activePicker === 'week' ? 'Select week' : 'Select day';
  const closePicker = () => setActivePicker(null);
  const selectMonth = (monthQuery) => {
    const firstWeek = getCalendarWeeks(monthQuery)[0];
    setSelectedMonthQuery(monthQuery);
    setSelectedWeekStartKey(firstWeek.start);
    setSelectedDayKey(`${monthQuery}-01`);
    closePicker();
  };
  const selectWeek = (weekNumber) => {
    const week = calendarWeeks[weekNumber - 1];
    const weekDays = week.days;
    setSelectedWeekStartKey(week.start);
    setSelectedDayKey(weekDays[0]);
    closePicker();
  };
  const selectDay = (dayKey) => {
    setSelectedDayKey(dayKey);
    closePicker();
  };
  const weeklyBudgetPercent = weeklyBudget > 0 ? Math.min(100, (currentWeekTotal / weeklyBudget) * 100) : 0;
  const monthlyBudgetPercent = monthlyBudget > 0 ? Math.min(100, (currentMonthTotal / monthlyBudget) * 100) : 0;
  const monthlyBudgetRemaining = monthlyBudget > 0 ? Math.max(0, monthlyBudget - currentMonthTotal) : 0;

  const handleReceiptCapture = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Receipt file size must be less than 5MB');
      return;
    }
    try {
      const receiptPreview = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not load receipt image'));
        reader.readAsDataURL(file);
      });
      navigate('/add-expense', { state: { receiptFile: file, receiptPreview } });
    } catch (captureError) {
      setError(captureError.message || 'Could not load receipt image');
    }
  };

  return (
    <div class="w-full max-w-[1024px] mx-auto space-y-6 pb-10">
      <section class="grid grid-cols-2 gap-3 md:gap-5">
        <button
          type="button"
          onClick={() => setActivePicker('week')}
          class="text-left bg-surface-container-lowest border border-secondary/15 rounded-[24px] p-3 md:p-6 flex flex-col gap-3 min-w-0 hover:bg-surface-container-low transition-colors shadow-sm"
        >
          <div class="flex items-center gap-2 md:gap-3 min-w-0">
            <span class="w-10 h-10 md:w-14 md:h-14 rounded-full bg-secondary-container/40 text-secondary flex items-center justify-center shrink-0">
              <Icon name="calendar_month" className="text-[23px] md:text-[26px]" />
            </span>
            <span class="flex flex-1 items-center justify-between min-w-0">
              <span class="min-w-0">
                <span class="block font-title-md text-[17px] md:text-xl font-bold text-on-surface truncate">Week {selectedWeekNumber}</span>
                <span class="block text-sm md:text-base text-on-surface-variant">Budget</span>
              </span>
              <Icon name="chevron_right" className="text-on-surface-variant" />
            </span>
          </div>
          <p class="font-numeric-display text-[25px] md:text-[32px] text-on-surface font-bold truncate">
            ₹{currentWeekTotal.toLocaleString('en-IN')}
            {weeklyBudget > 0 && <span class="text-base md:text-xl font-medium text-on-surface-variant"> / ₹{weeklyBudget.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>}
          </p>
          {weeklyBudget > 0 && (
            <>
              <div class="h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                <div class="h-full rounded-full bg-secondary" style={{ width: `${weeklyBudgetPercent}%` }} />
              </div>
              <p class="text-base md:text-lg font-semibold text-secondary">{Math.max(0, Math.round(100 - weeklyBudgetPercent))}% left</p>
            </>
          )}
          {!weeklyBudget && (
            <p class="text-sm text-on-surface-variant">Weekly spending</p>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActivePicker('month')}
          class="text-left bg-surface-container-lowest border border-primary/15 rounded-[24px] p-3 md:p-6 flex flex-col gap-3 min-w-0 hover:bg-surface-container-low transition-colors shadow-sm"
        >
          <div class="flex items-center gap-2 md:gap-3 min-w-0">
            <span class="w-10 h-10 md:w-14 md:h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon name="bar_chart" className="text-[23px] md:text-[26px]" />
            </span>
            <span class="flex flex-1 items-center justify-between gap-1 min-w-0">
              <span class="min-w-0">
                <span class="block font-title-md text-[13px] sm:text-[15px] md:text-xl font-bold text-on-surface truncate">
                  {selectedMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
                </span>
                <span class="block text-sm md:text-base text-on-surface-variant">Monthly Spend</span>
              </span>
              {monthlyBudget > 0 && (
                <span class={`hidden sm:inline-flex rounded-2xl px-2 py-1 text-xs md:text-sm font-medium text-center shrink-0 ${currentMonthTotal <= monthlyBudget ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'}`}>
                  {currentMonthTotal <= monthlyBudget ? 'On Track' : 'Over Budget'}
                  <Icon name="trending_up" className="text-sm align-middle ml-0.5" />
                </span>
              )}
            </span>
          </div>
          <p class={`font-numeric-display text-[25px] md:text-[32px] font-bold truncate ${monthlyBudget > 0 && currentMonthTotal > monthlyBudget ? 'text-error' : 'text-primary'}`}>
            ₹{currentMonthTotal.toLocaleString('en-IN')}
            {monthlyBudget > 0 && <span class="text-base md:text-xl font-medium text-on-surface-variant"> / ₹{monthlyBudget.toLocaleString('en-IN')}</span>}
          </p>
          {monthlyBudget > 0 ? (
            <>
              <div class="h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                <div class={`h-full rounded-full ${currentMonthTotal > monthlyBudget ? 'bg-error' : 'bg-primary'}`} style={{ width: `${monthlyBudgetPercent}%` }} />
              </div>
              <p class="text-sm md:text-base text-on-surface-variant">₹{monthlyBudgetRemaining.toLocaleString('en-IN')} balance</p>
            </>
          ) : (
            <p class="text-sm text-on-surface-variant">Monthly spending</p>
          )}
        </button>
      </section>

      <section class="rounded-[24px] bg-gradient-to-r from-[#0644c5] to-[#0874ed] text-white px-5 md:px-8 py-5 md:py-7 flex items-center justify-between gap-3 shadow-md overflow-hidden">
        <div class="min-w-0 relative z-10">
          <p class="text-sm md:text-base font-semibold tracking-wide flex items-center gap-3">
            TODAY'S SPENDS <span class="w-2.5 h-2.5 rounded-full bg-secondary-container"></span>
          </p>
          <button type="button" onClick={() => setActivePicker('day')} class="text-left text-base md:text-lg opacity-90 mt-1">
            {new Date(`${selectedDayKey}T00:00:00Z`).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </button>
          {selectedDayKey !== todayKey && (
            <button
              type="button"
              onClick={() => setSelectedDayKey(todayKey)}
              class="block text-left text-sm font-semibold text-secondary-container hover:underline"
            >
              Back to today
            </button>
          )}
          <p class="text-sm md:text-base font-semibold text-secondary-container mt-2">
            {currentDayTotal > 0 ? 'Keep tracking your spending today.' : 'Zero spends so far today!'}
          </p>
        </div>
        <div class="shrink-0 flex items-center justify-end gap-2 text-secondary-container">
          <span class="hidden sm:flex relative w-16 h-16 md:w-20 md:h-20 rounded-[20px] bg-white/15 items-center justify-center rotate-[-8deg]">
            <Icon name="account_balance_wallet" className="text-[48px] md:text-[60px]" />
            <span class="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-secondary-container text-primary flex items-center justify-center text-lg font-bold">₹</span>
          </span>
          <p class="font-numeric-display text-[30px] md:text-[44px] leading-none font-bold whitespace-nowrap">
            ₹{currentDayTotal.toLocaleString('en-IN')}
          </p>
        </div>
      </section>

      {activePicker && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4" onClick={closePicker}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-picker-title"
            class="w-full max-w-[400px] max-h-[80vh] overflow-y-auto bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="flex items-center justify-between mb-4">
              <h2 id="dashboard-picker-title" class="font-title-md text-title-md text-on-surface font-semibold">{pickerTitle}</h2>
              <button type="button" onClick={closePicker} aria-label="Close picker" class="p-2 rounded-full hover:bg-surface-container-low text-on-surface-variant">
                <Icon name="close" className="" />
              </button>
            </div>

            {activePicker === 'month' && (
              <div class="grid grid-cols-2 gap-2">
                {Array.from({ length: 12 }, (_, index) => {
                  const monthQuery = `${selectedMonthQuery.slice(0, 4)}-${String(index + 1).padStart(2, '0')}`;
                  const monthDate = new Date(`${monthQuery}-01T00:00:00Z`);
                  return (
                    <button
                      key={monthQuery}
                      type="button"
                      onClick={() => selectMonth(monthQuery)}
                      class={`rounded-lg border px-3 py-3 text-left transition-colors ${
                        selectedMonthQuery === monthQuery
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high border-outline-variant'
                      }`}
                    >
                      <span class="block font-title-md text-title-md font-semibold">
                        {monthDate.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })}
                      </span>
                      <span class="block font-numeric-display text-[18px] font-bold mt-1">
                        ₹{getMonthTotal(monthQuery).toLocaleString('en-IN')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {activePicker === 'week' && (
              <div class="grid grid-cols-2 gap-2">
                {Array.from({ length: calendarWeeks.length }, (_, index) => index + 1).map((weekNumber) => {
                  const weekDays = getWeekDayKeys(weekNumber);
                  return (
                    <button
                      key={weekNumber}
                      type="button"
                      onClick={() => selectWeek(weekNumber)}
                      class={`rounded-lg border px-3 py-3 text-left transition-colors ${
                        selectedWeekNumber === weekNumber
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high border-outline-variant'
                      }`}
                    >
                      <span class="block font-title-md text-title-md font-semibold">Week {weekNumber}</span>
                      <span class="block font-body-sm text-body-sm opacity-80">
                        {new Date(`${weekDays[0]}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                        {' - '}
                        {new Date(`${weekDays[weekDays.length - 1]}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                      </span>
                      <span class="block font-numeric-display text-[18px] font-bold mt-1">
                        ₹{getWeekTotal(calendarWeeks[weekNumber - 1]).toLocaleString('en-IN')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {activePicker === 'day' && (
              <div class="grid grid-cols-2 gap-2">
                {selectedWeekDayKeys.map((dayKey) => (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => selectDay(dayKey)}
                    class={`rounded-lg border px-3 py-3 text-left transition-colors ${
                      selectedDayKey === dayKey
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high border-outline-variant'
                    }`}
                  >
                    <span class="block font-title-md text-title-md font-semibold">
                      {new Date(`${dayKey}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
                    </span>
                    <span class="block font-body-sm text-body-sm opacity-80">
                      {new Date(`${dayKey}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}
                    </span>
                    <span class="block font-numeric-display text-[18px] font-bold mt-1">
                      ₹{getDayTotal(dayKey).toLocaleString('en-IN')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Filter Chips */}
      <div class="flex items-center justify-between">
        <h2 class="font-title-md text-title-md text-on-surface font-semibold">Category Filter</h2>
        <button
          type="button"
          onClick={() => navigate('/categories')}
          class="flex items-center gap-1 text-sm md:text-base font-medium text-primary hover:underline"
        >
          See All <Icon name="chevron_right" className="text-[20px]" />
        </button>
      </div>
      <nav aria-label="Expense Categories" class="flex overflow-x-auto no-scrollbar gap-2 py-1 -mx-container-margin px-container-margin md:mx-0 md:px-0">
        <button
          type="button"
          onClick={() => setSelectedCategoryFilter('all')}
          class={`whitespace-nowrap px-4 py-2 rounded-full font-body-sm text-body-sm transition-colors min-h-[40px] flex items-center shadow-xs ${
            selectedCategoryFilter === 'all'
              ? 'bg-primary text-on-primary font-semibold'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border border-outline-variant'
          }`}
        >
          <Icon name="apps" className="text-[20px]" />
          All
        </button>
        {categories.map((cat) => {
          const isActive = selectedCategoryFilter === cat._id;
          return (
            <button
              key={cat._id}
              type="button"
              onClick={() => setSelectedCategoryFilter(cat._id)}
              class={`whitespace-nowrap px-4 py-2 rounded-full font-body-sm text-body-sm transition-colors min-h-[40px] flex items-center gap-1.5 border ${
                isActive
                  ? 'bg-primary text-on-primary font-semibold border-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border-outline-variant'
              }`}
            >
              <CategoryIcon name={cat.icon} />
              <span>{cat.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Error Alert */}
      {error && (
        <div class="bg-error-container text-on-error-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2">
          <Icon name="error" className="text-[20px]" />
          <span>{error}</span>
        </div>
      )}

      <div class="flex items-center justify-between gap-3 pt-1">
        <h2 class="font-title-md text-title-md font-semibold text-on-surface">Recent Activity</h2>
        <button
          type="button"
          onClick={() => setActivePicker('month')}
          class="flex items-center gap-2 rounded-full px-3 py-2 text-sm md:text-base text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors"
        >
          <Icon name="calendar_month" className="text-[20px]" />
          {selectedMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          <Icon name="keyboard_arrow_down" className="text-[20px]" />
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div class="py-12 text-center text-on-surface-variant flex flex-col items-center gap-2">
          <div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p class="font-body-sm">Loading expenses...</p>
        </div>
      ) : activityExpenses.length === 0 ? (
        /* Empty State Card */
        <div class="flex flex-col items-center justify-center text-center w-full min-h-[360px] my-2 bg-surface-container-lowest border-2 border-dashed border-outline-variant/60 rounded-[24px] px-5 py-8 md:px-10 md:py-12 shadow-xs">
          <div class="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-5 text-primary shrink-0">
            <Icon name="receipt_long" className="text-[52px]" />
          </div>
          <h2 class="font-display text-[24px] md:text-[28px] font-bold text-on-surface mb-2 w-full">
            No transactions yet
          </h2>
          <p class="font-body-lg text-on-surface-variant mb-6 max-w-[420px]">
            Add an expense or scan a receipt to start tracking your spends.
          </p>
          <button
            type="button"
            onClick={() => navigate('/add-expense')}
            class="w-full max-w-[464px] min-h-[60px] bg-primary hover:bg-primary-container text-on-primary font-title-md text-lg rounded-2xl flex items-center justify-center gap-3 shadow-sm transition-transform active:scale-[0.98]"
          >
            <Icon name="add" className="text-[28px]" />
            Add Expense
          </button>
          <button
            type="button"
            onClick={() => receiptInputRef.current?.click()}
            class="w-full max-w-[464px] min-h-[58px] mt-3 bg-primary/5 hover:bg-primary/10 border border-primary/20 text-primary font-title-md text-lg rounded-2xl flex items-center justify-center gap-3 transition-colors"
          >
            <Icon name="photo_camera" className="text-[26px]" />
            Scan Receipt
          </button>
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
        /* Date Grouped Expense List */
        <section class="space-y-6">
          {Object.entries(groupedExpenses).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <h3 class="font-body-sm text-body-sm text-on-surface-variant mb-2 px-2 uppercase font-medium tracking-wide">
                {dateLabel}
              </h3>
              <ul class="bg-surface-container-lowest rounded-xl border border-outline-variant divide-y divide-outline-variant overflow-hidden shadow-xs">
                {items.map((expense) => (
                  <li
                    key={expense._id}
                    onClick={() => navigate(`/expense/${expense._id}`)}
                    class="flex items-center justify-between p-4 min-h-[56px] hover:bg-surface-container-low transition-colors cursor-pointer active:bg-surface-container-highest"
                  >
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-xl shrink-0">
                        <CategoryIcon name={expense.categoryId?.icon} />
                      </div>
                      <div class="overflow-hidden">
                        <p class="font-body-lg text-on-surface font-medium truncate">
                          {getTransactionType(expense) === 'income'
                            ? 'Income'
                            : getTransactionType(expense) === 'transfer'
                              ? 'Wallet transfer'
                              : expense.categoryId?.name || 'Expense'}
                        </p>
                        {expense.description ? (
                          <p class="font-body-sm text-on-surface-variant truncate">{expense.description}</p>
                        ) : (
                          <p class="font-body-sm text-outline italic">No description</p>
                        )}

                      </div>
                    </div>
                    <div class="text-right shrink-0">
                      <p class="font-numeric-display text-[20px] font-semibold text-on-surface">
                        {getTransactionType(expense) === 'income' ? '+' : getTransactionType(expense) === 'transfer' ? <Icon name="swap_horiz" /> : '-'}
                        ₹{expense.amount.toLocaleString('en-IN')}
                      </p>
                      <div class="flex items-center justify-end gap-1.5 mt-0.5">
                        {expense.paymentStatus && expense.paymentStatus !== 'success' && (
                          <span class="text-[10px] bg-tertiary-container text-on-tertiary-container px-1.5 py-0.5 rounded font-medium capitalize">
                            {expense.paymentStatus}
                          </span>
                        )}
                        {expense.syncStatus === 'pending' && (
                          <span
                            class="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"
                            title="Saved locally on device. Will upload once server is reachable."
                          >
                            <Icon name="cloud_upload" className="text-[11px] animate-pulse" />
                            Local
                          </span>
                        )}
                        {expense.receiptUrl && (
                          <span class="text-[11px] text-primary flex items-center justify-end gap-0.5">
                            <Icon name="attach_file" className="text-[13px]" />
                            Receipt
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};
