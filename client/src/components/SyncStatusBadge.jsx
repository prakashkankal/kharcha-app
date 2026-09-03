import React, { useState, useEffect } from 'react';
import { syncManager } from '../services/syncManager';

export const SyncStatusBadge = () => {
  const [syncState, setSyncState] = useState(syncManager.getState());

  useEffect(() => {
    return syncManager.subscribe(setSyncState);
  }, []);

  const handleManualSync = () => {
    syncManager.checkServerAndSync();
  };

  // If online and 0 pending items, show subtle synced indicator or nothing on small screen
  if (!syncState.isSyncing && syncState.pendingCount === 0 && syncState.isServerOnline) {
    return (
      <div
        onClick={handleManualSync}
        class="hidden sm:flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary font-medium px-2 py-0.5 rounded-full bg-primary/5 cursor-pointer transition-colors"
        title="Server connected & all data synced"
      >
        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        <span>Synced</span>
      </div>
    );
  }

  // If currently syncing
  if (syncState.isSyncing) {
    return (
      <div class="flex items-center gap-1.5 text-[11px] text-primary font-medium px-2.5 py-1 rounded-full bg-primary/10 animate-pulse">
        <span class="material-symbols-outlined text-[13px] animate-spin">sync</span>
        <span>Syncing...</span>
      </div>
    );
  }

  // If items are pending (Render sleeping or offline)
  if (syncState.pendingCount > 0) {
    return (
      <button
        type="button"
        onClick={handleManualSync}
        class="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300/60 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer shadow-2xs"
        title="Tap to sync now with server"
      >
        <span class="material-symbols-outlined text-[13px]">cloud_upload</span>
        <span>{syncState.pendingCount} Saved locally</span>
      </button>
    );
  }

  return null;
};
