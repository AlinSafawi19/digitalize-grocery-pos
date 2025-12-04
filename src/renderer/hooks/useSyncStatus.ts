import { useState, useEffect, useCallback } from 'react';
import { SyncService, SyncStatus } from '../services/sync.service';

/**
 * Hook to track sync status and pending operations
 */
export function useSyncStatus(updateInterval: number = 10000) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pendingCount: 0,
    hasPendingOperations: false,
    operations: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSyncStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await SyncService.getSyncStatus();
      setSyncStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get sync status');
      console.error('Error refreshing sync status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    refreshSyncStatus();

    // Set up periodic updates
    const interval = setInterval(() => {
      refreshSyncStatus();
    }, updateInterval);

    return () => clearInterval(interval);
  }, [refreshSyncStatus, updateInterval]);

  const processQueue = useCallback(async () => {
    try {
      const success = await SyncService.processQueue();
      if (success) {
        // Refresh status after processing
        await refreshSyncStatus();
      }
      return success;
    } catch (err) {
      console.error('Error processing queue:', err);
      return false;
    }
  }, [refreshSyncStatus]);

  return {
    syncStatus,
    loading,
    error,
    refreshSyncStatus,
    processQueue,
  };
}

