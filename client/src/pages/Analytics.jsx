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
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { Icon } from '../components/Icon.jsx';
import { expenseApi } from '../services/expenseApi';
import { useCategory } from '../context/CategoryContext';
import { localDbGetExpenses } from '../services/localDb';
import { getSpendingTotal, getTransactionType, isConfirmedTransaction } from '../services/transactionUtils';

// --- Palette for pie chart slices matching new purple / slate theme ---
const PALETTE = [
  '#43189E', // Deep Indigo/Purple
  '#7C3AED', // Vivid Violet
  '#2563EB', // Blue
  '#0D9488', // Teal
  '#EA580C', // Orange
  '#E11D48', // Rose
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#64748B', // Slate
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

// Modern dark floating tooltips
const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl px-3.5 py-2.5 shadow-xl border border-slate-800 text-xs">
        <p className="text-slate-400 font-medium mb-0.5">{label}</p>
        <p className="font-extrabold text-white text-sm font-numeric-display">{formatINR(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl px-3.5 py-2.5 shadow-xl border border-slate-800 text-xs">
        <p className="font-semibold text-white">{payload[0].name}</p>
        <p className="font-extrabold text-purple-300 text-sm font-numeric-display mt-0.5">{formatINR(payload[0].value)}</p>
        <p className="text-slate-400 text-[11px] mt-0.5">{payload[0].payload.percent}% of total</p>
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
        const data = await expenseApi.getExpenses({});
        if (Array.isArray(data) && data.length > 0) {
          setAllExpenses(data);
        } else {
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
    const { start, end } = getYearRange(offset);
    return { start, end, rangeLabel: `${start.getFullYear()}` };
  }, [period, offset]);

  const filteredTransactions = useMemo(() => {
    return allExpenses.filter((e) => {
      const d = new Date(e.date || e.createdAt);
      return d >= start && d <= end;
    });
  }, [allExpenses, start, end]);

  const filteredExpenses = useMemo(
    () => filteredTransactions.filter((e) => getTransactionType(e) === 'expense' && isConfirmedTransaction(e)),
    [filteredTransactions]
  );

  const totalSpend = useMemo(
    () => getSpendingTotal(filteredExpenses),
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
            return (
              expenseDate.getDate() >= Math.max(1, weekStartDay) &&
              expenseDate.getDate() <= Math.min(daysInMonth, weekEndDay)
            );
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
      if (!catMap[catId]) catMap[catId] = { name: catName, value: 0 };
      catMap[catId].value += Number(e.amount) || 0;
    });
    const entries = Object.values(catMap).filter((d) => d.value > 0);
    const total = entries.reduce((s, d) => s + d.value, 0);
    return entries
      .sort((a, b) => b.value - a.value)
      .map((d) => ({ ...d, percent: total > 0 ? ((d.value / total) * 100).toFixed(1) : '0' }));
  }, [filteredExpenses, categories]);

  const canGoNext = offset < 0;

  const handleExportCsv = () => {
    const escapeCsv = (value) => {
      const text = String(value ?? '');
      const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replaceAll('"', '""')}"`;
    };
    const rows = [
      ['Date', 'Type', 'Amount INR', 'Category', 'Payment method', 'Status', 'Merchant', 'UPI ID', 'Description'],
      ...filteredTransactions.map((expense) => [
        new Date(expense.date || expense.createdAt).toISOString(),
        getTransactionType(expense),
        expense.amount,
        expense.categoryId?.name || 'Other',
        expense.paymentMethod || 'other',
        expense.paymentStatus || 'success',
        expense.merchantName || '',
        expense.merchantUpiId || '',
        expense.description || '',
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `kharcha-transactions-${rangeLabel}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="relative w-full max-w-[1024px] mx-auto min-h-[calc(100vh-120px)] flex flex-col gap-6 pb-28 md:pb-12">
      <title>Analytics – Kharcha</title>

      {/* Ambient background glow in top-right */}
      <div className="absolute -top-12 -right-8 w-64 h-64 bg-purple-200/35 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* 1. Period Switcher Bar */}
      <div className="flex bg-white/90 backdrop-blur-md border border-slate-100 p-1.5 rounded-full shadow-2xs">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => {
              setPeriod(opt.key);
              setOffset(0);
            }}
            className={`flex-1 py-2 rounded-full text-xs md:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              period === opt.key
                ? 'bg-[#43189E] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 2. Navigator & Export CSV Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            className="w-9 h-9 rounded-full bg-white border border-slate-100 shadow-2xs flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
            aria-label="Previous period"
          >
            <Icon name="chevron_left" className="text-[18px]" />
          </button>
          <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">
            {rangeLabel}
          </h2>
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            disabled={!canGoNext}
            className={`w-9 h-9 rounded-full bg-white border border-slate-100 shadow-2xs flex items-center justify-center transition-all ${
              canGoNext
                ? 'text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer'
                : 'text-slate-300 opacity-40 cursor-not-allowed'
            }`}
            aria-label="Next period"
          >
            <Icon name="chevron_right" className="text-[18px]" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredTransactions.length === 0}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-purple-200 text-[#43189E] hover:bg-purple-50 text-xs font-semibold shadow-2xs disabled:opacity-40 transition-all cursor-pointer"
        >
          <Icon name="download" className="text-[16px]" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* 3. Hero Card: Total Spending (Deep Purple Gradient) */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#2D0B6B] via-[#3B0764] to-[#1E1050] text-white p-6 shadow-xl shadow-purple-950/20">
        <div className="absolute -top-12 -right-12 w-44 h-44 bg-purple-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <span className="text-white/80 font-medium text-xs tracking-wider uppercase">
            Total Spending
          </span>
          <span className="bg-white/15 backdrop-blur-xs text-white/90 text-xs px-3 py-1 rounded-full font-medium capitalize">
            {period} View
          </span>
        </div>

        <div className="flex items-end justify-between mt-2">
          <div>
            <h3 className="text-[34px] md:text-[38px] font-extrabold tracking-tight font-numeric-display leading-none">
              {formatINR(totalSpend)}
            </h3>
            <p className="text-white/70 text-xs mt-2.5">
              {filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'} in this period
            </p>
          </div>

          {/* Decorative mini vertical bars */}
          <div className="flex items-end gap-1.5 pr-1 opacity-80 pointer-events-none">
            <div className="w-3 h-6 bg-white/35 rounded-full" />
            <div className="w-3 h-10 bg-white/60 rounded-full" />
            <div className="w-3 h-14 bg-white/90 rounded-full" />
          </div>
        </div>
      </div>

      {/* 4. Sub-cards Row: Daily Average & Highest Expense */}
      <div className="grid grid-cols-2 gap-3.5 md:gap-4">
        {/* Daily Average Card */}
        <div className="bg-[#F0F5FF] border border-[#E0EAFF] rounded-[24px] p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-12 h-12 rounded-[18px] bg-[#DBEAFE] flex items-center justify-center text-[#2563EB] shrink-0">
            <Icon name="trending_up" className="text-[22px]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 truncate">Daily Average</p>
            <p className="text-[19px] md:text-[21px] font-bold text-slate-900 truncate font-numeric-display mt-0.5">
              {formatINR(Math.round(avgPerDay))}
            </p>
          </div>
        </div>

        {/* Highest Expense Card */}
        <div className="bg-[#FFF8F0] border border-[#FFE8D6] rounded-[24px] p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-12 h-12 rounded-[18px] bg-[#FFEDD5] flex items-center justify-center text-[#EA580C] shrink-0">
            <Icon name="arrow_upward" className="text-[22px]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 truncate">Highest Expense</p>
            <p className="text-[19px] md:text-[21px] font-bold text-slate-900 truncate font-numeric-display mt-0.5">
              {formatINR(highestExpense)}
            </p>
          </div>
        </div>
      </div>

      {/* 5. Charts Container */}
      <div className="space-y-6">
        {/* Bar Chart Card */}
        <div className="bg-white border border-slate-100 rounded-[26px] p-5 md:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-slate-900 text-[16px] tracking-tight">
              {period === 'week'
                ? 'Daily Spending'
                : period === 'month'
                ? 'Weekly Spending'
                : 'Monthly Spending'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {period === 'week'
                ? 'Breakdown across each day of the week'
                : period === 'month'
                ? 'Breakdown across weeks this month'
                : 'Breakdown across all 12 months'}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-[220px]">
              <div className="w-8 h-8 border-3 border-[#43189E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-slate-400 gap-2">
              <Icon name="bar_chart" className="text-[44px] text-slate-300" />
              <p className="text-sm font-medium">No expenses in this period</p>
            </div>
          ) : (
            <div className="w-full h-[240px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 4 }} barCategoryGap="28%">
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#43189E" />
                      <stop offset="100%" stopColor="#7C3AED" />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    domain={period === 'week' ? [0, weeklyYAxisMax] : undefined}
                    ticks={period === 'week' ? weeklyYAxisTicks : undefined}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <Tooltip
                    content={<CustomBarTooltip />}
                    cursor={{ fill: 'rgba(67, 24, 158, 0.05)', radius: 8 }}
                  />
                  <Bar
                    dataKey="total"
                    fill="url(#barGradient)"
                    radius={[8, 8, 2, 2]}
                    maxBarSize={38}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Category Breakdown (Donut + Legend) */}
        {pieData.length > 0 && (
          <div className="bg-white border border-slate-100 rounded-[26px] p-5 md:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-[16px] tracking-tight">Spending by Category</h3>
              <p className="text-xs text-slate-400 mt-0.5">Where your money went during this period</p>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Donut Chart */}
              <div className="w-full md:w-1/2 h-[220px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={92}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category Breakdown List */}
              <div className="w-full md:w-1/2 space-y-2.5">
                {pieData.map((item, i) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-2.5 rounded-[16px] bg-slate-50/70 border border-slate-100/80 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                      />
                      <span className="text-sm font-semibold text-slate-800 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200/60 shadow-2xs">
                        {item.percent}%
                      </span>
                      <span className="font-bold text-sm text-slate-900 font-numeric-display">
                        {formatINR(item.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Year Spending Trend (Only in Year View) */}
        {period === 'year' && filteredExpenses.length > 0 && (
          <div className="bg-white border border-slate-100 rounded-[26px] p-5 md:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col">
            <div className="mb-4">
              <h3 className="font-bold text-slate-900 text-[16px] tracking-tight">Annual Spending Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">Month-by-month trajectory throughout the year</p>
            </div>
            <div className="w-full h-[220px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#43189E"
                    strokeWidth={3}
                    dot={{ fill: '#43189E', r: 4, stroke: '#FFFFFF', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#43189E', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Empty State when no expenses at all */}
        {!loading && filteredExpenses.length === 0 && (
          <div className="bg-white border border-slate-100 rounded-[26px] p-8 flex flex-col items-center justify-center text-center shadow-[0_2px_12px_rgba(0,0,0,0.03)] gap-3">
            <div className="w-16 h-16 rounded-[22px] bg-[#EDE9FE] text-[#6D28D9] flex items-center justify-center">
              <Icon name="insights" className="text-[32px]" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-base">No expense data found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[260px]">
                Add some expenses in this period to view your analytics and charts.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
