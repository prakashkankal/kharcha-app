// localDb.js - IndexedDB wrapper for offline storage and queue management
const DB_NAME = 'kharcha_offline_db';
const DB_VERSION = 2;

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
        expenseStore.createIndex('isSplit', 'isSplit', { unique: false });
      }

      // Split participants store for offline access and instant receivables calculations
      if (!db.objectStoreNames.contains('split_participants')) {
        const participantStore = db.createObjectStore('split_participants', { keyPath: '_id' });
        participantStore.createIndex('expenseId', 'expenseId', { unique: false });
        participantStore.createIndex('paymentStatus', 'paymentStatus', { unique: false });
        participantStore.createIndex('isCurrentUser', 'isCurrentUser', { unique: false });
      }

      // Outbox Sync Queue (pending operations to send to server)
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', {
          keyPath: 'queueId',
          autoIncrement: true,
        });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Cache store for key-value items like user info, categories, monthly summaries, pending receivables
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
    const tx = db.transaction(['expenses', 'split_participants'], 'readwrite');
    const store = tx.objectStore('expenses');
    const partStore = tx.objectStore('split_participants');

    for (const exp of expenses) {
      if (exp && exp._id) {
        store.put({
          ...exp,
          syncStatus: exp.syncStatus || 'synced',
        });
        if (Array.isArray(exp.participants)) {
          for (const p of exp.participants) {
            if (p && p._id) {
              partStore.put({
                ...p,
                expenseId: exp._id,
              });
            }
          }
        }
      }
    }

    tx.oncomplete = () => {
      localDbRecalculateDashboardCache().catch(() => {});
      resolve(true);
    };
    tx.onerror = (e) => reject(e.target.error);
  });
};

export const localDbSaveExpense = async (expense) => {
  if (!expense || !expense._id) return;
  const db = await openLocalDb();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['expenses', 'split_participants'], 'readwrite');
    const store = tx.objectStore('expenses');
    const partStore = tx.objectStore('split_participants');

    store.put(expense);
    if (Array.isArray(expense.participants)) {
      for (const p of expense.participants) {
        if (p && p._id) {
          partStore.put({
            ...p,
            expenseId: expense._id,
          });
        }
      }
    }

    tx.oncomplete = () => {
      localDbRecalculateDashboardCache().catch(() => {});
      resolve(true);
    };
    tx.onerror = (e) => reject(e.target.error);
  });
};

export const localDbGetExpenses = async () => {
  const db = await openLocalDb();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['expenses', 'split_participants'], 'readonly');
    const expenseStore = tx.objectStore('expenses');
    const partStore = tx.objectStore('split_participants');

    const expReq = expenseStore.getAll();
    const partReq = partStore.getAll();

    tx.oncomplete = () => {
      const expenses = expReq.result || [];
      const participants = partReq.result || [];

      const partsByExp = {};
      for (const p of participants) {
        if (!partsByExp[p.expenseId]) partsByExp[p.expenseId] = [];
        partsByExp[p.expenseId].push(p);
      }

      const merged = expenses.map((e) => ({
        ...e,
        participants: e.isSplit ? (partsByExp[e._id] || e.participants || []) : [],
      }));

      // Sort by date desc
      merged.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
      resolve(merged);
    };

    tx.onerror = (e) => reject(e.target.error);
  });
};

export const localDbGetExpenseById = async (id) => {
  const db = await openLocalDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['expenses', 'split_participants'], 'readonly');
    const expenseStore = tx.objectStore('expenses');
    const partStore = tx.objectStore('split_participants');

    const expReq = expenseStore.get(id);
    const partReq = partStore.getAll();

    tx.oncomplete = () => {
      const expense = expReq.result;
      if (!expense) {
        resolve(null);
        return;
      }
      const participants = (partReq.result || []).filter((p) => String(p.expenseId) === String(id));
      resolve({
        ...expense,
        participants: expense.isSplit ? (participants.length > 0 ? participants : (expense.participants || [])) : [],
      });
    };

    tx.onerror = (e) => reject(e.target.error);
  });
};

export const localDbDeleteExpense = async (id) => {
  const db = await openLocalDb();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['expenses', 'split_participants'], 'readwrite');
    const expenseStore = tx.objectStore('expenses');
    const partStore = tx.objectStore('split_participants');

    expenseStore.delete(id);

    // Delete participants associated with this expense
    const partReq = partStore.getAll();
    partReq.onsuccess = () => {
      const parts = partReq.result || [];
      for (const p of parts) {
        if (String(p.expenseId) === String(id)) {
          partStore.delete(p._id);
        }
      }
    };

    tx.oncomplete = () => {
      localDbRecalculateDashboardCache().catch(() => {});
      resolve(true);
    };
    tx.onerror = (e) => reject(e.target.error);
  });
};

/* --- Split Participants Helpers --- */

export const localDbSaveParticipants = async (participants = []) => {
  if (!Array.isArray(participants)) return;
  return runTx('split_participants', 'readwrite', (store, setRes) => {
    for (const p of participants) {
      if (p && p._id) {
        store.put(p);
      }
    }
    setRes(true);
  });
};

export const localDbUpdateParticipant = async (participant) => {
  if (!participant || !participant._id) return;
  return runTx('split_participants', 'readwrite', (store, setRes) => {
    store.put(participant);
    setRes(participant);
  });
};

export const localDbGetSplitParticipants = async () => {
  return runTx('split_participants', 'readonly', (store, setRes) => {
    const req = store.getAll();
    req.onsuccess = () => setRes(req.result || []);
  });
};

/* --- Outbox Sync Queue Helpers --- */

export const localDbAddToSyncQueue = async (item) => {
  return runTx('sync_queue', 'readwrite', (store, setRes) => {
    const entry = {
      ...item,
      createdAt: Date.now(),
    };
    const req = store.add(entry);
    req.onsuccess = (e) => {
      setRes({ ...entry, queueId: e.target.result });
    };
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

/* --- Key-Value Cache (User Info, Categories, Summaries) --- */

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

/* --- User Info Cache in LocalDB --- */

export const localDbSaveUserInfo = async (user) => {
  if (!user) {
    await localDbSetKV('user_info', null);
    try {
      localStorage.removeItem('kharcha_cached_user');
    } catch {}
    return;
  }
  await localDbSetKV('user_info', user);
  try {
    localStorage.setItem('kharcha_cached_user', JSON.stringify(user));
  } catch {}
};

export const localDbGetUserInfo = async () => {
  try {
    const user = await localDbGetKV('user_info');
    if (user) return user;
    const localCached = localStorage.getItem('kharcha_cached_user');
    return localCached ? JSON.parse(localCached) : null;
  } catch {
    return null;
  }
};

/* --- Dashboard Summary & Totals Cache --- */

export const localDbSaveDashboardCache = async (data) => {
  if (!data) return;
  return localDbSetKV('dashboard_summary', {
    ...data,
    cachedAt: Date.now(),
  });
};

export const localDbGetDashboardCache = async () => {
  return localDbGetKV('dashboard_summary');
};

export const localDbRecalculateDashboardCache = async () => {
  try {
    const allExpenses = await localDbGetExpenses();
    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7);
    const todayKey = now.toISOString().slice(0, 10);
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const confirmedExpenses = allExpenses.filter(
      (e) => (e.transactionType || 'expense') === 'expense' && e.paymentStatus !== 'failed'
    );

    const monthExpenses = confirmedExpenses.filter((e) => {
      const d = new Date(e.date || e.createdAt);
      return d.toISOString().slice(0, 7) === monthKey;
    });

    const weekExpenses = confirmedExpenses.filter((e) => {
      const d = new Date(e.date || e.createdAt);
      return d >= startOfWeek && d <= endOfWeek;
    });

    const todayExpenses = confirmedExpenses.filter((e) => {
      const d = new Date(e.date || e.createdAt);
      return d.toISOString().slice(0, 10) === todayKey;
    });

    const sumAmount = (list) =>
      list.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const monthlyTotal = sumAmount(monthExpenses);
    const weeklyTotal = sumAmount(weekExpenses);
    const dailyTotal = sumAmount(todayExpenses);

    const summary = {
      monthKey,
      todayKey,
      monthlyTotal,
      weeklyTotal,
      dailyTotal,
      recentExpenses: allExpenses.slice(0, 40),
      updatedAt: Date.now(),
    };

    await localDbSaveDashboardCache(summary);
    return summary;
  } catch (err) {
    console.warn('Failed to recalculate local dashboard cache:', err);
    return null;
  }
};

export const localDbClearAll = async () => {
  const db = await openLocalDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(['expenses', 'split_participants', 'sync_queue', 'kv_cache'], 'readwrite');
    tx.objectStore('expenses').clear();
    tx.objectStore('split_participants').clear();
    tx.objectStore('sync_queue').clear();
    tx.objectStore('kv_cache').clear();
    tx.oncomplete = () => resolve(true);
  });
};
