// syncManager.js - Background synchronization engine for Render cold starts
import {
  localDbGetSyncQueue,
  localDbRemoveFromSyncQueue,
  localDbSaveExpense,
  localDbSaveExpenses,
  localDbDeleteExpense,
  localDbGetExpenses,
} from './localDb';
import { apiFetch, getAuthToken } from './api';

const SYNC_EVENT = 'kharcha_sync_event';

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.isServerOnline = false;
    this.pendingCount = 0;
    this.listeners = new Set();
    this.checkInterval = null;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  // Event listener subscription
  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  getState() {
    return {
      isSyncing: this.isSyncing,
      isServerOnline: this.isServerOnline,
      pendingCount: this.pendingCount,
    };
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        console.error('SyncManager subscriber error:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: state }));
    }
  }

  async init() {
    await this.updatePendingCount();
    this.startHealthPolling();
    // Immediate attempt if token exists
    if (getAuthToken()) {
      this.checkServerAndSync();
    }
  }

  async updatePendingCount() {
    try {
      const queue = await localDbGetSyncQueue();
      this.pendingCount = queue.length;
      this.notify();
    } catch (e) {
      console.warn('Failed to read sync queue count:', e);
    }
  }

  startHealthPolling() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    // Poll every 12 seconds when there are pending items or server is offline, otherwise every 45 seconds
    this.checkInterval = setInterval(() => {
      if (navigator.onLine && getAuthToken()) {
        this.checkServerAndSync();
      }
    }, this.pendingCount > 0 || !this.isServerOnline ? 12000 : 45000);
  }

  handleNetworkChange(online) {
    if (online) {
      this.checkServerAndSync();
    } else {
      this.isServerOnline = false;
      this.notify();
    }
  }

  // Ping /api/health to see if Render is awake
  async pingServer() {
    if (!navigator.onLine) return false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 sec timeout

      const res = await apiFetch('/health', {
        signal: controller.signal,
      }).catch(async () => {
        // Fallback to /api/health
        return await apiFetch('/api/health', { signal: controller.signal });
      });

      clearTimeout(timeoutId);
      return res && (res.status === 'OK' || res.status === 'ok');
    } catch (err) {
      return false;
    }
  }

  async checkServerAndSync() {
    if (this.isSyncing) return;

    const token = getAuthToken();
    if (!token) return;

    const online = await this.pingServer();
    this.isServerOnline = online;
    this.notify();

    if (online) {
      await this.processQueue();
    }
  }

  // Replay queued offline items to the server
  async processQueue() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.notify();

    try {
      const queue = await localDbGetSyncQueue();
      this.pendingCount = queue.length;
      this.notify();

      for (const item of queue) {
        try {
          if (item.type === 'CREATE') {
            await this.syncCreateExpense(item);
          } else if (item.type === 'UPDATE') {
            await this.syncUpdateExpense(item);
          } else if (item.type === 'DELETE') {
            await this.syncDeleteExpense(item);
          }

          // Successfully processed, remove from queue
          await localDbRemoveFromSyncQueue(item.queueId);
          await this.updatePendingCount();
        } catch (itemErr) {
          console.warn(`Failed to sync item ${item.queueId}:`, itemErr);
          // If server error or offline, break and wait for next interval
          if (itemErr.name === 'AbortError' || !navigator.onLine || itemErr.message?.includes('Failed to fetch')) {
            this.isServerOnline = false;
            break;
          }
          // If 400 validation error that can't be resolved, remove it to avoid blocking queue
          if (itemErr.message && (itemErr.message.includes('Invalid') || itemErr.message.includes('required'))) {
            await localDbRemoveFromSyncQueue(item.queueId);
          }
        }
      }
    } finally {
      this.isSyncing = false;
      await this.updatePendingCount();
      this.notify();
    }
  }

  async syncCreateExpense(item) {
    const { tempId, payload } = item;
    const formData = new FormData();
    formData.append('amount', payload.amount);
    formData.append('categoryId', payload.categoryId);
    formData.append('date', payload.date);
    if (payload.description) formData.append('description', payload.description);

    // If receipt was captured as base64 dataUrl offline, convert to Blob
    if (payload.receiptDataUrl && payload.receiptName) {
      const res = await fetch(payload.receiptDataUrl);
      const blob = await res.blob();
      formData.append('receipt', blob, payload.receiptName);
    }

    const createdOnServer = await apiFetch('/expenses', {
      method: 'POST',
      body: formData,
    });

    // Replace the local temporary expense record with the real server record
    if (tempId && createdOnServer && createdOnServer._id) {
      await localDbDeleteExpense(tempId);
      await localDbSaveExpense({
        ...createdOnServer,
        syncStatus: 'synced',
      });
    }
  }

  async syncUpdateExpense(item) {
    const { id, payload } = item;
    const formData = new FormData();
    if (payload.amount !== undefined) formData.append('amount', payload.amount);
    if (payload.categoryId) formData.append('categoryId', payload.categoryId);
    if (payload.date) formData.append('date', payload.date);
    if (payload.description !== undefined) formData.append('description', payload.description);
    if (payload.removeReceipt) formData.append('removeReceipt', 'true');

    if (payload.receiptDataUrl && payload.receiptName) {
      const res = await fetch(payload.receiptDataUrl);
      const blob = await res.blob();
      formData.append('receipt', blob, payload.receiptName);
    }

    const updated = await apiFetch(`/expenses/${id}`, {
      method: 'PUT',
      body: formData,
    });

    if (updated && updated._id) {
      await localDbSaveExpense({
        ...updated,
        syncStatus: 'synced',
      });
    }
  }

  async syncDeleteExpense(item) {
    const { id } = item;
    try {
      await apiFetch(`/expenses/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      // If already not found on server, that is fine
      if (!err.message?.includes('not found')) {
        throw err;
      }
    }
    await localDbDeleteExpense(id);
  }
}

export const syncManager = new SyncManager();
