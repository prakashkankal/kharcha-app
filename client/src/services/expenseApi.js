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
  localDbGetSplitParticipants,
  localDbUpdateParticipant,
  localDbGetDashboardCache,
  localDbRecalculateDashboardCache,
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
      const serverExpenses = await apiFetch(`/expenses${queryStr}`, { timeoutMs: 3500 });

      if (Array.isArray(serverExpenses)) {
        // Save server expenses into local IndexedDB
        await localDbSaveExpenses(serverExpenses);

        // Merge any still-pending offline creations that haven't synced yet
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
      const summary = await apiFetch(`/expenses/summary/monthly${queryStr}`, { timeoutMs: 3000 });
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
      const serverData = await apiFetch(`/expenses/${id}`, { timeoutMs: 3500 });
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

  // Get cached dashboard summary from localDB (instant, no network)
  getDashboardCached: async () => {
    try {
      const cached = await localDbGetDashboardCache();
      return cached || null;
    } catch {
      return null;
    }
  },

  // Recalculate dashboard totals from local expense data
  recalculateDashboardCache: async () => {
    return localDbRecalculateDashboardCache();
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
    isSplit = false,
    participants = [],
  }) => {
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare participants with local IDs if split
    const localParticipants = isSplit
      ? participants.map((p, idx) => ({
          _id: p._id || `part_${tempId}_${idx}`,
          expenseId: tempId,
          personName: p.personName,
          participantUserId: p.participantUserId || null,
          isCurrentUser: Boolean(p.isCurrentUser),
          shareAmount: Number(p.shareAmount),
          shareAmountPaise: Math.round(Number(p.shareAmount) * 100),
          amountPaidBack: Number(p.amountPaidBack || 0),
          amountPaidBackPaise: Math.round(Number(p.amountPaidBack || 0) * 100),
          paymentStatus: p.paymentStatus || 'PENDING',
          paymentHistory: p.paymentHistory || [],
        }))
      : [];

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
      isSplit: Boolean(isSplit),
      participants: localParticipants,
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
      isSplit: Boolean(isSplit),
      participants: localParticipants,
      receiptDataUrl: receiptPreview || null,
      receiptName: receiptFile?.name || null,
    };

    // 2. Add to outbox queue
    await localDbAddToSyncQueue({
      type: 'CREATE',
      tempId,
      payload: queuePayload,
    });

    syncManager.updatePendingCount();

    // 3. Fire background sync attempt
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

    // If not in local DB, try fetching from server
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

    // Optimistically update local DB
    let updatedExpense = existing;
    if (existing && existing._id) {
      const serverPayload = updatePayload;

      let parsedParts = existing.participants;
      if (serverPayload.participants) {
        parsedParts = typeof serverPayload.participants === 'string'
          ? JSON.parse(serverPayload.participants)
          : serverPayload.participants;
      }

      const updatedLocal = {
        ...existing,
        ...serverPayload,
        ...(categoryObj ? { categoryId: categoryObj } : {}),
        ...(serverPayload.amount !== undefined
          ? { amount: Number(serverPayload.amount), amountPaise: Math.round(Number(serverPayload.amount) * 100) }
          : {}),
        ...(serverPayload.removeReceipt ? { receiptUrl: null } : {}),
        ...(serverPayload.receiptDataUrl ? { receiptUrl: serverPayload.receiptDataUrl } : {}),
        ...(serverPayload.isSplit !== undefined ? { isSplit: serverPayload.isSplit === true || serverPayload.isSplit === 'true' } : {}),
        ...(parsedParts ? { participants: parsedParts } : {}),
        _id: existing._id,
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

  // Get pending receivables
  getPendingReceivables: async () => {
    // 1. Try server first
    try {
      const data = await apiFetch('/expenses/split/pending-receivables', { timeoutMs: 3500 });
      if (data && Array.isArray(data.receivables)) {
        localDbSetKV('pending_receivables_cache', data);
        return data;
      }
    } catch (err) {
      console.warn('Server offline for pending receivables, falling back to local DB:', err.message);
    }

    // 2. Check KV cache
    const cached = await localDbGetKV('pending_receivables_cache');
    if (cached) return cached;

    // 3. Fallback calculate from local IndexedDB
    try {
      const allExpenses = await localDbGetExpenses();
      const allParticipants = await localDbGetSplitParticipants();

      const expenseMap = new Map();
      allExpenses.forEach((e) => expenseMap.set(String(e._id), e));

      const validReceivables = [];
      let totalOutstandingPaise = 0;

      for (const p of allParticipants) {
        if (p.isCurrentUser) continue;
        const exp = expenseMap.get(String(p.expenseId));
        if (!exp) continue;

        const sharePaise = p.shareAmountPaise || Math.round(Number(p.shareAmount) * 100);
        const paidPaise = p.amountPaidBackPaise || Math.round(Number(p.amountPaidBack || 0) * 100);
        const outstandingPaise = sharePaise - paidPaise;

        if (outstandingPaise > 0) {
          totalOutstandingPaise += outstandingPaise;
          validReceivables.push({
            ...p,
            expenseId: exp,
            outstandingAmount: outstandingPaise / 100,
            outstandingAmountPaise: outstandingPaise,
          });
        }
      }

      return {
        totalReceivable: totalOutstandingPaise / 100,
        totalReceivablePaise: totalOutstandingPaise,
        receivables: validReceivables,
      };
    } catch (e) {
      return { totalReceivable: 0, totalReceivablePaise: 0, receivables: [] };
    }
  },

  // Record participant payment
  recordParticipantPayment: async (participantId, amount, notes = '') => {
    // Optimistically update local participant if found
    try {
      const allParticipants = await localDbGetSplitParticipants();
      const p = allParticipants.find((item) => String(item._id) === String(participantId));
      if (p) {
        const sharePaise = p.shareAmountPaise || Math.round(Number(p.shareAmount) * 100);
        const currentPaidPaise = p.amountPaidBackPaise || Math.round(Number(p.amountPaidBack || 0) * 100);
        const payAmount = amount !== undefined ? Number(amount) : (sharePaise - currentPaidPaise) / 100;
        const payPaise = Math.round(payAmount * 100);

        const newPaidPaise = currentPaidPaise + payPaise;
        p.amountPaidBackPaise = newPaidPaise;
        p.amountPaidBack = newPaidPaise / 100;
        p.paymentStatus = (newPaidPaise >= sharePaise) ? 'RECEIVED' : 'PARTIALLY_PAID';
        if (!Array.isArray(p.paymentHistory)) p.paymentHistory = [];
        p.paymentHistory.push({
          amount: payAmount,
          amountPaise: payPaise,
          date: new Date().toISOString(),
          notes,
        });
        await localDbUpdateParticipant(p);
      }
    } catch (e) {
      console.warn('Optimistic local participant update error:', e);
    }

    // Try server call
    try {
      const res = await apiFetch(`/expenses/split/participants/${participantId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ amount, notes }),
      });
      return res;
    } catch (err) {
      // If server is offline, add to sync queue
      await localDbAddToSyncQueue({
        type: 'RECORD_PAYMENT',
        participantId,
        payload: { amount, notes },
      });
      syncManager.updatePendingCount();
      syncManager.checkServerAndSync();
      return {
        message: 'Payment recorded offline and will sync when connected',
      };
    }
  },
};
