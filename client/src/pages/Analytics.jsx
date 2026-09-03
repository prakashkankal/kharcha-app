import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { expenseApi } from '../services/expenseApi';
import { useCategory } from '../context/CategoryContext';
import { localDbGetExpenses } from '../services/localDb';

// --- Palette for pie chart slices ---
const PALETTE = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#84cc16',
];

// --- Helpers ---
const formatINR = (val) => `₹${Number(val).toLocaleString('en-IN')}`;

const getWeekRange = (offset = 0) => {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - day + offset * 7);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return { start: startOfWeek, end: endOfWeek };
};

const getMonthRange = (offset = 0) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const getYearRange = (offset = 0) => {
  const year = new Date().getFullYear() + offset;
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start, end };
};

const PERIOD_OPTIONS = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Custom tooltip
const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div class="bg-surface-container border border-outline-variant rounded-xl px-4 py-3 shadow-lg text-sm">
        <p class="text-on-surface-variant mb-1">{label}</p>
        <p class="text-primary font-bold text-base">{formatINR(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div class="bg-surface-container border border-outline-variant rounded-xl px-4 py-3 shadow-lg text-sm">
        <p class="text-on-surface font-medium">{payload[0].name}</p>
        <p class="text-primary font-bold">{formatINR(payload[0].value)}</p>
        <p class="text-on-surface-variant">{payload[0].payload.percent}%</p>
      </div>
    );
  }
  return null;
};

export const Analytics = () => {
  const { categories } = useCategory();
  const [period, setPeriod] = useState('month');
  const [offset, setOffset] = useState(0);
  const [allExpenses, setAllExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all expenses once (use local db + server)
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Try server for last 12 months worth of data (no filter = all)
        const data = await expenseApi.getExpenses({});
        if (Array.isArray(data) && data.length > 0) {
          setAllExpenses(data);
        } else {
          // Fallback to local
          const local = await localDbGetExpenses();
          setAllExpenses(local || []);
        }
      } catch {
        const local = await localDbGetExpenses();
        setAllExpenses(local || []);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Re-fetch when sync event fires
  useEffect(() => {
    const handler = async () => {
      const data = await expenseApi.getExpenses({});
      if (Array.isArray(data)) setAllExpenses(data);
    };
    window.addEventListener('kharcha_sync_event', handler);
    return () => window.removeEventListener('kharcha_sync_event', handler);
  }, []);

  // Compute range label and date bounds
  const { start, end, rangeLabel } = useMemo(() => {
    if (period === 'week') {
      const { start, end } = getWeekRange(offset);
      const opts = { day: 'numeric', month: 'short' };
      const label = `${start.toLocaleDateString('en-IN', opts)} – ${end.toLocaleDateString('en-IN', opts)}`;
      return { start, end, rangeLabel: label };
    }
    if (period === 'month') {
      const { start, end } = getMonthRange(offset);
      const label = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return { start, end, rangeLabel: label };
    }
    // year
    const { start, end } = getYearRange(offset);
    return { start, end, rangeLabel: `${start.getFullYear()}` };
  }, [period, offset]);

  // Filter expenses to current range
  const filteredExpenses = useMemo(() => {
    return allExpenses.filter((e) => {
      const d = new Date(e.date || e.createdAt);
      return d >= start && d <= end;
    });
  }, [allExpenses, start, end]);

  const totalSpend = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [filteredExpenses]
  );

  const avgPerDay = useMemo(() => {
    const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
    return totalSpend / days;
  }, [totalSpend, start, end]);

  const highestExpense = useMemo(
    () => filteredExpenses.reduce((max, e) => Math.max(max, Number(e.amount) || 0), 0),
    [filteredExpenses]
  );

  // Bar chart data
  const barData = useMemo(() => {
    if (period === 'week') {
      const buckets = DAY_LABELS.map((label, i) => {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        const dateStr = day.toISOString().slice(0, 10);
        const total = filteredExpenses
          .filter((e) => new Date(e.date || e.createdAt).toISOString().slice(0, 10) === dateStr)
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        return { label, total };
      });
      return buckets;
    }
    if (period === 'month') {
      const daysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
      const firstDayOffset = new Date(start.getFullYear(), start.getMonth(), 1).getDay();
      const weekCount = Math.ceil((firstDayOffset + daysInMonth) / 7);
      return Array.from({ length: weekCount }, (_, weekIndex) => {
        const weekStartDay = weekIndex * 7 - firstDayOffset + 1;
        const weekEndDay = weekStartDay + 6;
        const total = filteredExpenses
          .filter((e) => {
            const expenseDate = new Date(e.date || e.createdAt);
            return expenseDate.getDate() >= Math.max(1, weekStartDay) && expenseDate.getDate() <= Math.min(daysInMonth, weekEndDay);
          })
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        return { label: `Week ${weekIndex + 1}`, total };
      });
    }
    // year — monthly buckets
    return MONTH_LABELS.map((label, i) => {
      const total = filteredExpenses
        .filter((e) => new Date(e.date || e.createdAt).getMonth() === i)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      return { label, total };
    });
  }, [period, filteredExpenses, start, end]);

  const weeklyYAxisMax = useMemo(() => {
    if (period !== 'week') return null;
    const highestDailySpend = Math.max(...barData.map((item) => item.total), 0);
    return Math.max(100, Math.ceil(highestDailySpend / 100) * 100);
  }, [period, barData]);

  const weeklyYAxisTicks = weeklyYAxisMax
    ? Array.from({ length: weeklyYAxisMax / 100 + 1 }, (_, index) => index * 100)
    : undefined;

  // Pie chart data (by category)
  const pieData = useMemo(() => {
    const catMap = {};
    filteredExpenses.forEach((e) => {
      const catId = e.categoryId?._id || e.categoryId || 'unknown';
      const catName = e.categoryId?.name || categories.find((c) => c._id === catId)?.name || 'Other';
      const catIcon = e.categoryId?.icon || categories.find((c) => c._id === catId)?.icon || '📦';
      if (!catMap[catId]) catMap[catId] = { name: `${catIcon} ${catName}`, value: 0 };
      catMap[catId].value += Number(e.amount) || 0;
    });
    const entries = Object.values(catMap).filter((d) => d.value > 0);
    const total = entries.reduce((s, d) => s + d.value, 0);
    return entries
      .sort((a, b) => b.value - a.value)
      .map((d) => ({ ...d, percent: total > 0 ? ((d.value / total) * 100).toFixed(1) : '0' }));
  }, [filteredExpenses, categories]);

  const canGoNext = offset < 0;

  return (
    <div class="w-full max-w-[1024px] mx-auto min-h-[calc(100vh-120px)] flex flex-col gap-6 pb-8">
      <title>Analytics – Kharcha</title>

      {/* Period Toggle */}
      <div class="flex gap-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-1.5">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => { setPeriod(opt.key); setOffset(0); }}
            class={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              period === opt.key
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Navigator */}
      <div class="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          class="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
          aria-label="Previous period"
        >
          <span class="material-symbols-outlined">chevron_left</span>
        </button>
        <p class="font-semibold text-on-surface text-base">{rangeLabel}</p>
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          disabled={!canGoNext}
          class={`p-2 rounded-full transition-colors ${canGoNext ? 'hover:bg-surface-container text-on-surface-variant' : 'text-outline opacity-40 cursor-not-allowed'}`}
          aria-label="Next period"
        >
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div class="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: formatINR(totalSpend), icon: 'account_balance_wallet', color: 'text-primary' },
          { label: 'Daily Avg', value: formatINR(Math.round(avgPerDay)), icon: 'trending_up', color: 'text-tertiary' },
          { label: 'Highest', value: formatINR(highestExpense), icon: 'arrow_upward', color: 'text-error' },
        ].map((card) => (
          <div
            key={card.label}
            class="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 md:p-4 flex flex-col gap-1.5 shadow-xs"
          >
            <div class={`flex items-center gap-1.5 ${card.color}`}>
              <span class="material-symbols-outlined text-[18px]">{card.icon}</span>
              <span class="text-xs font-medium">{card.label}</span>
            </div>
            <p class="font-bold text-on-surface text-[15px] md:text-[18px] leading-tight">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Swipeable chart cards */}
      <div class="flex flex-1 items-stretch overflow-x-auto snap-x snap-mandatory no-scrollbar gap-4 -mx-container-margin px-container-margin md:mx-0 md:px-0">
      {/* Bar Chart */}
      <div class="w-full min-h-full shrink-0 snap-start bg-surface-container-lowest border border-outline-variant rounded-xl p-3 md:p-4 shadow-xs flex flex-col">
        <h2 class="font-semibold text-on-surface mb-2 text-[15px]">
          {period === 'week' ? 'Daily Spending This Week' : period === 'month' ? 'Weekly Spending This Month' : 'Monthly Spending This Year'}
        </h2>
        {loading ? (
          <div class="flex items-center justify-center h-[200px]">
            <div class="w-7 h-7 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div class="flex flex-col items-center justify-center h-[200px] text-on-surface-variant gap-2">
            <span class="material-symbols-outlined text-[48px] text-outline">bar_chart</span>
            <p class="text-sm">No expenses in this period</p>
          </div>
        ) : (
          <div class="flex-1 min-h-[220px] -mx-3 -mb-3 md:-mx-4 md:-mb-4">
          <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 0, right: 2, left: -16, bottom: 8 }} barCategoryGap="30%">
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant, #6b7280)' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant, #6b7280)' }}
                    axisLine={false}
                    tickLine={false}
                    domain={period === 'week' ? [0, weeklyYAxisMax] : undefined}
                    ticks={period === 'week' ? weeklyYAxisTicks : undefined}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 8 }} />
                  <Bar dataKey="total" fill="#6366f1" radius={[5, 5, 0, 0]} maxBarSize={40} />
                </BarChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Pie Chart — Category Breakdown */}
      {pieData.length > 0 && (
        <div class="w-full min-h-full shrink-0 snap-start bg-surface-container-lowest border border-outline-variant rounded-xl p-3 md:p-4 shadow-xs flex flex-col">
          <h2 class="font-semibold text-on-surface mb-2 text-[15px]">Spending by Category</h2>
          <div class="flex-1 min-h-[220px] flex flex-col md:flex-row items-center gap-4">
            <div class="w-full h-full -mx-3 -mb-3 md:-mx-4 md:-mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            </div>
          </div>
          {/* Category Legend List */}
          <ul class="mt-2 space-y-2">
            {pieData.map((item, i) => (
              <li key={item.name} class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                  <span class="text-sm text-on-surface truncate">{item.name}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-xs text-on-surface-variant">{item.percent}%</span>
                  <span class="font-semibold text-sm text-on-surface">{formatINR(item.value)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Line Trend (only year view — cumulative monthly) */}
      {period === 'year' && filteredExpenses.length > 0 && (
        <div class="w-full min-h-full shrink-0 snap-start bg-surface-container-lowest border border-outline-variant rounded-xl p-3 md:p-4 shadow-xs flex flex-col">
          <h2 class="font-semibold text-on-surface mb-2 text-[15px]">Spending Trend</h2>
          <div class="flex-1 min-h-[200px] -mx-3 -mb-3 md:-mx-4 md:-mb-4">
          <ResponsiveContainer width="100%" height="100%">
                <LineChart data={barData} margin={{ top: 0, right: 2, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.15)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant, #6b7280)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant, #6b7280)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}
      </div>

      {/* No data at all */}
      {!loading && filteredExpenses.length === 0 && (
        <div class="flex flex-col items-center justify-center text-center py-12 text-on-surface-variant gap-3">
          <span class="material-symbols-outlined text-[52px] text-outline">insights</span>
          <p class="font-semibold text-on-surface">No data yet</p>
          <p class="text-sm">Add some expenses to see your analytics here.</p>
        </div>
      )}
    </div>
  );
};

export default Analytics;
