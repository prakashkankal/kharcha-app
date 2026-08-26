import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCategory } from '../context/CategoryContext';
import { expenseApi } from '../services/expenseApi';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { categories } = useCategory();

  // Current selected month in YYYY-MM format
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  const [expenses, setExpenses] = useState([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const formattedMonthQuery = `${currentMonthDate.getFullYear()}-${String(
    currentMonthDate.getMonth() + 1
  ).padStart(2, '0')}`;

  const formattedMonthDisplay = currentMonthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const handlePrevMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const categoryIdParam = selectedCategoryFilter !== 'all' ? selectedCategoryFilter : undefined;
      const [expensesData, summaryData] = await Promise.all([
        expenseApi.getExpenses({ month: formattedMonthQuery, categoryId: categoryIdParam }),
        expenseApi.getMonthlySummary(formattedMonthQuery),
      ]);

      setExpenses(expensesData);
      setMonthlyTotal(summaryData.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [formattedMonthQuery, selectedCategoryFilter]);

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

  const groupedExpenses = groupExpensesByDate(expenses);

  return (
    <div class="w-full max-w-[1024px] mx-auto space-y-6 pb-6">
      {/* Monthly Summary Card */}
      <section class="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 md:p-6 shadow-xs">
        <div class="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous Month"
            class="p-2 rounded-full hover:bg-surface-container-low transition-colors flex items-center justify-center text-on-surface-variant"
          >
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <h2 class="font-title-md text-title-md text-on-surface font-semibold">{formattedMonthDisplay}</h2>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next Month"
            class="p-2 rounded-full hover:bg-surface-container-low transition-colors flex items-center justify-center text-on-surface-variant"
          >
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

        <div class="text-center py-2">
          <p class="font-body-sm text-body-sm text-on-surface-variant mb-1">Current Month Expense</p>
          <p class="font-numeric-display text-[32px] md:text-[36px] text-primary font-bold">
            ₹{monthlyTotal.toLocaleString('en-IN')}
          </p>
        </div>
      </section>

      {/* Main Action Button */}
      <button
        type="button"
        onClick={() => navigate('/add-expense')}
        class="w-full bg-primary hover:bg-primary-container text-on-primary rounded-xl py-3.5 px-4 flex items-center justify-center gap-2 transition-all duration-150 active:scale-98 shadow-sm font-title-md text-title-md min-h-[48px]"
      >
        <span class="material-symbols-outlined icon-fill">add</span>
        Add Expense
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
      ) : expenses.length === 0 ? (
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
                      {expense.receiptUrl && (
                        <span class="text-[11px] text-primary flex items-center justify-end gap-0.5">
                          <span class="material-symbols-outlined text-[13px]">attach_file</span>
                          Receipt
                        </span>
                      )}
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
