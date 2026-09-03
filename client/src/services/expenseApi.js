import { apiFetch } from './api';
import {
  localDbGetExpenses,
  localDbSaveExpenses,
  localDbSaveExpense,
  localDbGetExpenseById,
  localDbDeleteExpense,
  localDbAddToSyncQueue,
  localDbGetSyncQueue,
  localDbSetKV,
  localDbGetKV,
} from './localDb';
import { syncManager } from './syncManager';

export const expenseApi = {
  // Fetch expenses with offline fallback & background cache update
  getExpenses: async ({ month, categoryId } = {}) => {
    // 1. Fetch local cached expenses first
    let localExpenses = [];
    try {
      localExpenses = await localDbGetExpenses();
    } catch (e) {
      console.warn('Failed to read local expenses:', e);
    }

    // Filter local expenses by month and category if specified
    const filterLocal = (list) => {
      return list.filter((exp) => {
        if (categoryId && categoryId !== 'all') {
          const expCatId = exp.categoryId?._id || exp.categoryId;
          if (expCatId !== categoryId) return false;
        }
        if (month) {
          const expMonth = new Date(exp.date || exp.createdAt).toISOString().slice(0, 7);
          if (expMonth !== month) return false;
        }
        return true;
      });
    };

    // 2. Try fetching latest from server
    try {
      const queryParams = new URLSearchParams();
      if (month) queryParams.append('month', month);
      if (categoryId && categoryId !== 'all') queryParams.append('categoryId', categoryId);

      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const serverExpenses = await apiFetch(`/expenses${queryStr}`);

      if (Array.isArray(serverExpenses)) {
        // Save server expenses into local IndexedDB
        await localDbSaveExpenses(serverExpenses);

        // Merge any still-pending offline creations that haven't synced yet
        const pendingQueue = await localDbGetSyncQueue();
        const pendingTempExpenses = localExpenses.filter((e) => e.syncStatus === 'pending');

        const merged = [...pendingTempExpenses, ...serverExpenses];
        return filterLocal(merged);
      }
    } catch (networkErr) {
      console.warn('Server offline or waking up. Returning local cached expenses:', networkErr.message);
    }

    // Server failed or cold starting -> return filtered local data
    return filterLocal(localExpenses);
  },

  getMonthlySummary: async (month) => {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const cacheKey = `summary_${targetMonth}`;

    // Try server first
    try {
      const queryStr = month ? `?month=${month}` : '';
      const summary = await apiFetch(`/expenses/summary/monthly${queryStr}`);
      if (summary) {
        localDbSetKV(cacheKey, summary);
        return summary;
      }
    } catch (err) {
      console.warn('Server unavailable for summary, calculating from local database:', err.message);
    }

    // Fallback 1: KV cache
    const cachedSummary = await localDbGetKV(cacheKey);
    if (cachedSummary) return cachedSummary;

    // Fallback 2: Calculate sum directly from local expenses
    try {
      const allLocal = await localDbGetExpenses();
      const monthExpenses = allLocal.filter((e) => {
        const expMonth = new Date(e.date || e.createdAt).toISOString().slice(0, 7);
        return expMonth === targetMonth;
      });
      const total = monthExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      return { month: targetMonth, total };
    } catch (e) {
      return { month: targetMonth, total: 0 };
    }
  },

  getExpenseById: async (id) => {
    // Try local DB first (handles instant navigation)
    const local = await localDbGetExpenseById(id);

    try {
      const serverData = await apiFetch(`/expenses/${id}`);
      if (serverData) {
        await localDbSaveExpense({ ...serverData, syncStatus: 'synced' });
        return serverData;
      }
    } catch (err) {
      if (local) return local;
      throw err;
    }

    return local;
  },

  // Save expense immediately locally, then sync to server or enqueue
  createExpense: async ({ amount, categoryId, categoryObj, date, description, receiptFile, receiptPreview }) => {
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const localExpense = {
      _id: tempId,
      amount: Number(amount),
      categoryId: categoryObj || { _id: categoryId, name: 'Expense', icon: '📦' },
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      description: description || '',
      receiptUrl: receiptPreview || null,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    // 1. Instantly save to local IndexedDB
    await localDbSaveExpense(localExpense);

    // Prepare sync queue item
    const queuePayload = {
      amount: Number(amount),
      categoryId,
      date,
      description,
      receiptDataUrl: receiptPreview || null,
      receiptName: receiptFile?.name || null,
    };

    // 2. Add to outbox queue
    const queueItem = await localDbAddToSyncQueue({
      type: 'CREATE',
      tempId,
      payload: queuePayload,
    });

    syncManager.updatePendingCount();

    // 3. Fire background sync attempt (will succeed if server is awake, or wait if Render is cold)
    syncManager.checkServerAndSync();

    return localExpense;
  },

  updateExpense: async (id, payload) => {
    // Optimistically update local database
    const existing = await localDbGetExpenseById(id);
    if (existing) {
      const updatedLocal = {
        ...existing,
        ...payload,
        syncStatus: 'pending',
      };
      await localDbSaveExpense(updatedLocal);
    }

    // Queue update
    await localDbAddToSyncQueue({
      type: 'UPDATE',
      id,
      payload,
    });

    syncManager.updatePendingCount();
    syncManager.checkServerAndSync();

    return existing;
  },

  deleteExpense: async (id) => {
    // Remove locally right away
    await localDbDeleteExpense(id);

    // Queue delete
    await localDbAddToSyncQueue({
      type: 'DELETE',
      id,
    });

    syncManager.updatePendingCount();
    syncManager.checkServerAndSync();

    return { message: 'Expense deleted' };
  },
};
