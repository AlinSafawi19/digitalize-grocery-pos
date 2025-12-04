/**
 * Sync Service (Renderer)
 * Handles sync status and queue management via IPC
 */
export interface QueuedOperation {
  id: number;
  type: string;
  data: string;
  status: string;
  retryCount: number;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncStatus {
  pendingCount: number;
  hasPendingOperations: boolean;
  operations: QueuedOperation[];
}

export class SyncService {
  /**
   * Get pending sync operations count
   */
  static async getPendingCount(): Promise<number> {
    try {
      const result = await window.electron.ipcRenderer.invoke('sync:getPendingCount') as {
        success: boolean;
        count?: number;
        error?: string;
      };

      if (result.success && result.count !== undefined) {
        return result.count;
      }

      return 0;
    } catch (error) {
      console.error('Error getting pending sync count:', error);
      return 0;
    }
  }

  /**
   * Get all pending sync operations
   */
  static async getPendingOperations(): Promise<QueuedOperation[]> {
    try {
      const result = await window.electron.ipcRenderer.invoke('sync:getPendingOperations') as {
        success: boolean;
        operations?: QueuedOperation[];
        error?: string;
      };

      if (result.success && result.operations) {
        return result.operations;
      }

      return [];
    } catch (error) {
      console.error('Error getting pending sync operations:', error);
      return [];
    }
  }

  /**
   * Get sync status
   */
  static async getSyncStatus(): Promise<SyncStatus> {
    try {
      const [pendingCount, operations] = await Promise.all([
        this.getPendingCount(),
        this.getPendingOperations(),
      ]);

      return {
        pendingCount,
        hasPendingOperations: pendingCount > 0,
        operations,
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        pendingCount: 0,
        hasPendingOperations: false,
        operations: [],
      };
    }
  }

  /**
   * Manually trigger queue processing
   */
  static async processQueue(): Promise<boolean> {
    try {
      const result = await window.electron.ipcRenderer.invoke('sync:processQueue') as {
        success: boolean;
        error?: string;
      };

      return result.success;
    } catch (error) {
      console.error('Error processing sync queue:', error);
      return false;
    }
  }
}

