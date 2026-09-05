import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategory } from '../context/CategoryContext';
import { useAuth } from '../context/AuthContext';
import { expenseApi } from '../services/expenseApi';

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

  const selectedMonthDate = new Date(`${selectedMonthQuery}-01T00:00:00Z`);
  const selectedMonthName = selectedMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMonthQuery = todayKey.slice(0, 7);
  const selectedDate = new Date(`${selectedDayKey}T00:00:00Z`);
  const selectedDateDisplay = selectedDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const fetchDashboardData = async (isInitial = false) => {
    if (isInitial && expenses.length === 0) {
      setLoading(true);
    }
    setError('');
    try {
      const categoryIdParam = selectedCategoryFilter !== 'all' ? selectedCategoryFilter : undefined;
      const expensesData = await expenseApi.getExpenses({ categoryId: categoryIdParam });

      setExpenses(expensesData || []);
      setCurrentPeriodExpenses(expensesData || []);
    } catch (err) {
      console.warn('Dashboard data fetch warning:', err.message);
      if (expenses.length === 0) {
        setError(err.message || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(true);
  }, [selectedMonthQuery, selectedCategoryFilter]);

  // Re-fetch quietly when a background sync finishes
  useEffect(() => {
    const handleSyncEvent = () => {
      fetchDashboardData(false);
    };
    window.addEventListener('kharcha_sync_event', handleSyncEvent);
    return () => window.removeEventListener('kharcha_sync_event', handleSyncEvent);
  }, [selectedMonthQuery, selectedCategoryFilter]);

  // Helper to group expenses by formatted date string
  const groupExpensesByDate = (expenseList) => {
    const groups = {};
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

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
  const sumExpenses = (expenseList) => expenseList.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
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
  const selectedDayExpenses = expenses.filter((expense) => getExpenseDateKey(expense) === selectedDayKey);
  const groupedExpenses = groupExpensesByDate(selectedDayExpenses);
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
  const returnToToday = () => {
    const today = new Date();
    const todayWeekStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()))
      .toISOString()
      .slice(0, 10);
    setSelectedMonthQuery(todayMonthQuery);
    setSelectedWeekStartKey(todayWeekStart);
    setSelectedDayKey(todayKey);
  };
  const isTodaySelected = selectedDayKey === todayKey;

  return (
    <div class="w-full max-w-[1024px] mx-auto space-y-6 pb-6">
      <section class="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setActivePicker('week')}
          class="text-left bg-secondary-container/40 border border-secondary/20 rounded-full px-4 py-3 flex items-center justify-between gap-3 min-w-0 hover:bg-secondary-container/60 transition-colors"
        >
          <div class="min-w-0">
            <p class="font-label-caps text-label-caps text-on-surface-variant uppercase truncate">
              Week {selectedWeekNumber}
            </p>
            <p class="font-numeric-display text-[22px] text-on-surface font-bold truncate">
              ₹{currentWeekTotal.toLocaleString('en-IN')}
              {weeklyBudget > 0 && <span class="text-sm font-normal text-on-surface-variant"> / ₹{weeklyBudget.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>}
            </p>
          </div>
          <span class="material-symbols-outlined text-secondary shrink-0">date_range</span>
        </button>
        <button
          type="button"
          onClick={() => setActivePicker('month')}
          class="text-left bg-primary/10 border border-primary/20 rounded-full px-4 py-3 flex items-center justify-between gap-3 min-w-0 hover:bg-primary/15 transition-colors"
        >
          <div class="min-w-0">
            <p class="font-label-caps text-label-caps text-on-surface-variant uppercase truncate">{selectedMonthName}</p>
            <p class="font-numeric-display text-[22px] text-primary font-bold truncate">
              ₹{currentMonthTotal.toLocaleString('en-IN')}
              {monthlyBudget > 0 && <span class="text-sm font-normal text-on-surface-variant"> / ₹{monthlyBudget.toLocaleString('en-IN')}</span>}
            </p>
          </div>
          <span class="material-symbols-outlined text-primary shrink-0">calendar_month</span>
        </button>
      </section>

      <button
        type="button"
        onClick={() => setActivePicker('day')}
        class="w-full text-left bg-tertiary-container/10 border border-tertiary/20 rounded-full px-5 py-3 flex items-center justify-between gap-4 hover:bg-tertiary-container/20 transition-colors"
      >
        <div>
          <p class="font-label-caps text-label-caps text-on-surface-variant uppercase">
            {isTodaySelected ? 'Today' : selectedDateDisplay}
          </p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            {isTodaySelected ? selectedDateDisplay : 'Selected day spending'}
          </p>
        </div>
        <p class="font-numeric-display text-[26px] text-tertiary font-bold shrink-0">
          ₹{currentDayTotal.toLocaleString('en-IN')}
        </p>
      </button>

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
                <span class="material-symbols-outlined">close</span>
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

      {/* Main Action Button */}
      <button
        type="button"
        onClick={isTodaySelected ? () => navigate('/add-expense') : returnToToday}
        class="w-full bg-primary hover:bg-primary-container text-on-primary rounded-xl py-3.5 px-4 flex items-center justify-center gap-2 transition-all duration-150 active:scale-98 shadow-sm font-title-md text-title-md min-h-[48px]"
      >
        <span class="material-symbols-outlined icon-fill">{isTodaySelected ? 'add' : 'today'}</span>
        {isTodaySelected ? 'Add Expense' : 'Back to Today'}
      </button>

      {/* Category Filter Chips */}
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
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Error Alert */}
      {error && (
        <div class="bg-error-container text-on-error-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2">
          <span class="material-symbols-outlined text-[20px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div class="py-12 text-center text-on-surface-variant flex flex-col items-center gap-2">
          <div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p class="font-body-sm">Loading expenses...</p>
        </div>
      ) : selectedDayExpenses.length === 0 ? (
        /* Empty State Card */
        <div class="flex flex-col items-center justify-center text-center w-full my-8 bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-xs">
          <div class="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-4 text-primary shrink-0">
            <span class="material-symbols-outlined text-[44px]">receipt_long</span>
          </div>
          <h2 class="font-display text-[24px] font-bold text-on-surface mb-2 w-full">No expenses yet</h2>
          <p class="font-body-lg text-on-surface-variant mb-6 w-full">Add your first expense to start tracking.</p>
          <button
            type="button"
            onClick={() => navigate('/add-expense')}
            class="bg-primary text-on-primary font-title-md py-3 px-6 rounded-lg w-full flex items-center justify-center gap-2 transition-transform active:scale-95 hover:bg-primary-container"
          >
            <span class="material-symbols-outlined icon-fill text-[20px]">add</span>
            Add Expense
          </button>
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
                        {expense.categoryId?.icon || '📦'}
                      </div>
                      <div class="overflow-hidden">
                        <p class="font-body-lg text-on-surface font-medium truncate">
                          {expense.categoryId?.name || 'Expense'}
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
                        -₹{expense.amount.toLocaleString('en-IN')}
                      </p>
                      <div class="flex items-center justify-end gap-1.5 mt-0.5">
                        {expense.syncStatus === 'pending' && (
                          <span
                            class="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"
                            title="Saved locally on device. Will upload once server is reachable."
                          >
                            <span class="material-symbols-outlined text-[11px] animate-pulse">cloud_upload</span>
                            Local
                          </span>
                        )}
                        {expense.receiptUrl && (
                          <span class="text-[11px] text-primary flex items-center justify-end gap-0.5">
                            <span class="material-symbols-outlined text-[13px]">attach_file</span>
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
