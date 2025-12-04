import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { OperationQueueService } from '../services/sync/operation-queue.service';

/**
 * Register sync management IPC handlers
 */
export function registerSyncHandlers(): void {
  logger.info('Registering sync management IPC handlers...');

  /**
   * Get pending sync operations count
   * IPC: sync:getPendingCount
   */
  ipcMain.handle('sync:getPendingCount', async () => {
    try {
      const count = await OperationQueueService.getPendingCount();
      return {
        success: true,
        count,
      };
    } catch (error) {
      logger.error('Error in sync:getPendingCount handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        count: 0,
      };
    }
  });

  /**
   * Get pending sync operations
   * IPC: sync:getPendingOperations
   */
  ipcMain.handle('sync:getPendingOperations', async () => {
    try {
      const operations = await OperationQueueService.getPendingOperations();
      return {
        success: true,
        operations,
      };
    } catch (error) {
      logger.error('Error in sync:getPendingOperations handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        operations: [],
      };
    }
  });

  /**
   * Manually trigger queue processing
   * IPC: sync:processQueue
   */
  ipcMain.handle('sync:processQueue', async () => {
    try {
      await OperationQueueService.processQueue();
      return {
        success: true,
      };
    } catch (error) {
      logger.error('Error in sync:processQueue handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });
}

