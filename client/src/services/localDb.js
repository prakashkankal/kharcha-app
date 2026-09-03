// localDb.js - IndexedDB wrapper for offline storage and queue management
const DB_NAME = 'kharcha_offline_db';
const DB_VERSION = 1;

let dbPromise = null;

export const openLocalDb = () => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Expenses store (mirrors server expenses + local offline additions)
      if (!db.objectStoreNames.contains('expenses')) {
        const expenseStore = db.createObjectStore('expenses', { keyPath: '_id' });
        expenseStore.createIndex('date', 'date', { unique: false });
        expenseStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      }

      // Outbox Sync Queue (pending operations to send to server)
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', {
          keyPath: 'queueId',
          autoIncrement: true,
        });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Cache store for key-value items like categories, monthly summaries
      if (!db.objectStoreNames.contains('kv_cache')) {
        db.createObjectStore('kv_cache', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });

  return dbPromise;
};

// Generic helper for transaction
const runTx = async (storeName, mode, callback) => {
  const db = await openLocalDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result = null;

    callback(store, (res) => {
      result = res;
    });

    tx.oncomplete = () => resolve(result);
    tx.onerror = (e) => reject(e.target.error);
    tx.onabort = (e) => reject(e.target.error);
  });
};

/* --- Expenses Store Helpers --- */

export const localDbSaveExpenses = async (expenses) => {
  if (!Array.isArray(expenses)) return;
  const db = await openLocalDb();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');

    for (const exp of expenses) {
      if (exp && exp._id) {
        store.put({
          ...exp,
          syncStatus: exp.syncStatus || 'synced',
        });
      }
    }

    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
};

export const localDbSaveExpense = async (expense) => {
  if (!expense || !expense._id) return;
  return runTx('expenses', 'readwrite', (store, setRes) => {
    store.put(expense);
    setRes(expense);
  });
};

export const localDbGetExpenses = async () => {
  return runTx('expenses', 'readonly', (store, setRes) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      // Sort newest first
      items.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
      setRes(items);
    };
  });
};

export const localDbGetExpenseById = async (id) => {
  return runTx('expenses', 'readonly', (store, setRes) => {
    const req = store.get(id);
    req.onsuccess = () => setRes(req.result || null);
  });
};

export const localDbDeleteExpense = async (id) => {
  return runTx('expenses', 'readwrite', (store, setRes) => {
    store.delete(id);
    setRes(true);
  });
};

/* --- Sync Queue Helpers --- */

export const localDbAddToSyncQueue = async (operation) => {
  // operation: { type: 'CREATE' | 'UPDATE' | 'DELETE', payload, tempId, createdAt: Date.now() }
  return runTx('sync_queue', 'readwrite', (store, setRes) => {
    const entry = {
      ...operation,
      createdAt: Date.now(),
      attempts: 0,
    };
    const req = store.add(entry);
    req.onsuccess = () => setRes({ ...entry, queueId: req.result });
  });
};

export const localDbGetSyncQueue = async () => {
  return runTx('sync_queue', 'readonly', (store, setRes) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => a.createdAt - b.createdAt);
      setRes(items);
    };
  });
};

export const localDbRemoveFromSyncQueue = async (queueId) => {
  return runTx('sync_queue', 'readwrite', (store, setRes) => {
    store.delete(queueId);
    setRes(true);
  });
};

export const localDbUpdateSyncQueueItem = async (item) => {
  return runTx('sync_queue', 'readwrite', (store, setRes) => {
    store.put(item);
    setRes(true);
  });
};

/* --- Key-Value Cache (Categories, Summaries) --- */

export const localDbSetKV = async (key, value) => {
  return runTx('kv_cache', 'readwrite', (store, setRes) => {
    store.put({ key, value, updatedAt: Date.now() });
    setRes(true);
  });
};

export const localDbGetKV = async (key) => {
  return runTx('kv_cache', 'readonly', (store, setRes) => {
    const req = store.get(key);
    req.onsuccess = () => setRes(req.result ? req.result.value : null);
  });
};

export const localDbClearAll = async () => {
  const db = await openLocalDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(['expenses', 'sync_queue', 'kv_cache'], 'readwrite');
    tx.objectStore('expenses').clear();
    tx.objectStore('sync_queue').clear();
    tx.objectStore('kv_cache').clear();
    tx.oncomplete = () => resolve(true);
  });
};
