import { apiFetch } from './api';
import {
  localDbGetExpenses,
  localDbSaveExpenses,
  localDbSaveExpense,
  localDbGetExpenseById,
  localDbDeleteExpense,
  localDbAddToSyncQueue,
  localDbGetSyncQueue,
  localDbRemoveFromSyncQueue,
  localDbSetKV,
  localDbGetKV,
  localDbUpdateSyncQueueItem,
} from './localDb';
import { syncManager } from './syncManager';
import { getSpendingTotal } from './transactionUtils';

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
      const total = getSpendingTotal(monthExpenses);
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
  createExpense: async ({
    amount,
    categoryId,
    categoryObj,
    date,
    description,
    receiptFile,
    receiptPreview,
    transactionType = 'expense',
    paymentMethod = 'cash',
    paymentStatus = 'success',
    fromWallet,
    toWallet,
    merchantName,
    merchantUpiId,
    externalTransactionReference,
    selectedPaymentApp,
  }) => {
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const localExpense = {
      _id: tempId,
      amount: Number(amount),
      amountPaise: Math.round(Number(amount) * 100),
      transactionType,
      paymentMethod,
      paymentStatus,
      fromWallet,
      toWallet,
      merchantName: merchantName || '',
      merchantUpiId: merchantUpiId || '',
      externalTransactionReference: externalTransactionReference || '',
      selectedPaymentApp: selectedPaymentApp || '',
      categoryId: categoryObj || { _id: categoryId, name: 'Expense', icon: 'package' },
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
      transactionType,
      paymentMethod,
      paymentStatus,
      fromWallet,
      toWallet,
      merchantName,
      merchantUpiId,
      externalTransactionReference,
      selectedPaymentApp,
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

  updateExpense: async (id, payload, categoryObj) => {
    const updatePayload = payload instanceof FormData
      ? Object.fromEntries(payload.entries())
      : { ...payload };

    if (typeof File !== 'undefined' && updatePayload.receipt instanceof File) {
      const receiptFile = updatePayload.receipt;
      updatePayload.receiptDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not read receipt image'));
        reader.readAsDataURL(receiptFile);
      });
      updatePayload.receiptName = receiptFile.name;
      delete updatePayload.receipt;
    }

    // Try to find existing record in local DB first
    let existing = await localDbGetExpenseById(id);

    // If not in local DB, try fetching from server so we have a base record
    if (!existing) {
      try {
        const serverData = await apiFetch(`/expenses/${id}`);
        if (serverData && serverData._id) {
          existing = { ...serverData, syncStatus: 'synced' };
          await localDbSaveExpense(existing);
        }
      } catch (e) {
        console.warn('Could not fetch expense from server for optimistic update:', e);
      }
    }

    // Optimistically update local DB only if we have a valid record with _id
    let updatedExpense = existing;
    if (existing && existing._id) {
      const serverPayload = updatePayload;
      const updatedLocal = {
        ...existing,
        ...serverPayload,
        ...(categoryObj ? { categoryId: categoryObj } : {}),
        ...(serverPayload.amount !== undefined
          ? { amount: Number(serverPayload.amount), amountPaise: Math.round(Number(serverPayload.amount) * 100) }
          : {}),
        ...(serverPayload.removeReceipt ? { receiptUrl: null } : {}),
        ...(serverPayload.receiptDataUrl ? { receiptUrl: serverPayload.receiptDataUrl } : {}),
        _id: existing._id, // ensure _id is always present (keyPath required)
        syncStatus: 'pending',
      };
      await localDbSaveExpense(updatedLocal);
      updatedExpense = updatedLocal;
    }

    const pendingCreate = typeof id === 'string' && id.startsWith('offline_')
      ? ((await localDbGetSyncQueue()) || []).find((item) => item.type === 'CREATE' && item.tempId === id)
      : null;
    if (pendingCreate) {
      pendingCreate.payload = {
        ...pendingCreate.payload,
        ...updatePayload,
        ...(updatePayload.removeReceipt ? { receiptDataUrl: null, receiptName: null } : {}),
      };
      await localDbUpdateSyncQueueItem(pendingCreate);
    } else {
      await localDbAddToSyncQueue({
        type: 'UPDATE',
        id,
        payload: updatePayload,
      });
    }

    syncManager.updatePendingCount();
    syncManager.checkServerAndSync();

    return updatedExpense;
  },

  deleteExpense: async (id) => {
    // Remove locally right away
    await localDbDeleteExpense(id);

    const pendingCreate = typeof id === 'string' && id.startsWith('offline_')
      ? ((await localDbGetSyncQueue()) || []).find((item) => item.type === 'CREATE' && item.tempId === id)
      : null;
    if (pendingCreate) {
      await localDbRemoveFromSyncQueue(pendingCreate.queueId);
    } else {
      await localDbAddToSyncQueue({
        type: 'DELETE',
        id,
      });
    }

    syncManager.updatePendingCount();
    syncManager.checkServerAndSync();

    return { message: 'Expense deleted' };
  },
};
