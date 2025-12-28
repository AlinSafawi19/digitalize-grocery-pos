import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { RecoveryPointService, CreateRecoveryPointInput } from '../services/recovery/recovery-point.service';
import { PointInTimeRecoveryService, RestoreToPointInTimeInput } from '../services/recovery/point-in-time-recovery.service';
import { TransactionLogService } from '../services/recovery/transaction-log.service';

/**
 * Register recovery-related IPC handlers
 */
export function registerRecoveryHandlers(): void {
  logger.info('Registering recovery IPC handlers...');

  /**
   * Create a recovery point
   * IPC: recovery:createRecoveryPoint
   */
  ipcMain.handle('recovery:createRecoveryPoint', async (_event, input: CreateRecoveryPointInput) => {
    try {
      logger.info('IPC: recovery:createRecoveryPoint', {
        name: input.name,
        createBackup: input.createBackup,
      });
      const recoveryPoint = await RecoveryPointService.createRecoveryPoint(input);
      return {
        success: true,
        recoveryPoint,
      };
    } catch (error) {
      logger.error('IPC: recovery:createRecoveryPoint error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create recovery point',
      };
    }
  });

  /**
   * Get recovery points
   * IPC: recovery:getRecoveryPoints
   */
  ipcMain.handle('recovery:getRecoveryPoints', async (_event, options: {
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
    isAutomatic?: boolean;
  }) => {
    try {
      logger.info('IPC: recovery:getRecoveryPoints');
      const result = await RecoveryPointService.getRecoveryPoints({
        ...options,
        startDate: options.startDate ? new Date(options.startDate) : undefined,
        endDate: options.endDate ? new Date(options.endDate) : undefined,
      });
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      logger.error('IPC: recovery:getRecoveryPoints error', error);
      return {
        success: false,
        recoveryPoints: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 20,
        error: error instanceof Error ? error.message : 'Failed to get recovery points',
      };
    }
  });

  /**
   * Get recovery point by ID
   * IPC: recovery:getRecoveryPointById
   */
  ipcMain.handle('recovery:getRecoveryPointById', async (_event, id: number) => {
    try {
      logger.info('IPC: recovery:getRecoveryPointById', { id });
      const recoveryPoint = await RecoveryPointService.getRecoveryPointById(id);
      return {
        success: true,
        recoveryPoint,
      };
    } catch (error) {
      logger.error('IPC: recovery:getRecoveryPointById error', error);
      return {
        success: false,
        recoveryPoint: null,
        error: error instanceof Error ? error.message : 'Failed to get recovery point',
      };
    }
  });

  /**
   * Delete recovery point
   * IPC: recovery:deleteRecoveryPoint
   */
  ipcMain.handle('recovery:deleteRecoveryPoint', async (_event, id: number) => {
    try {
      logger.info('IPC: recovery:deleteRecoveryPoint', { id });
      await RecoveryPointService.deleteRecoveryPoint(id);
      return {
        success: true,
      };
    } catch (error) {
      logger.error('IPC: recovery:deleteRecoveryPoint error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete recovery point',
      };
    }
  });

  /**
   * Verify backup integrity
   * IPC: recovery:verifyBackupIntegrity
   */
  ipcMain.handle('recovery:verifyBackupIntegrity', async (_event, recoveryPointId: number) => {
    try {
      logger.info('IPC: recovery:verifyBackupIntegrity', { recoveryPointId });
      const result = await RecoveryPointService.verifyBackupIntegrity(recoveryPointId);
      return result;
    } catch (error) {
      logger.error('IPC: recovery:verifyBackupIntegrity error', error);
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Failed to verify backup integrity',
      };
    }
  });

  /**
   * Restore to point in time
   * IPC: recovery:restoreToPointInTime
   */
  ipcMain.handle('recovery:restoreToPointInTime', async (_event, input: RestoreToPointInTimeInput) => {
    try {
      logger.info('IPC: recovery:restoreToPointInTime', {
        recoveryPointId: input.recoveryPointId,
        createBackupBeforeRestore: input.createBackupBeforeRestore,
      });
      const result = await PointInTimeRecoveryService.restoreToPointInTime(input);
      return result;
    } catch (error) {
      logger.error('IPC: recovery:restoreToPointInTime error', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to restore to point in time',
      };
    }
  });

  /**
   * Get transaction logs
   * IPC: recovery:getTransactionLogs
   */
  ipcMain.handle('recovery:getTransactionLogs', async (_event, options: {
    startDate?: string;
    endDate?: string;
    tableName?: string;
    operation?: 'create' | 'update' | 'delete';
    userId?: number;
    page?: number;
    pageSize?: number;
  }) => {
    try {
      logger.info('IPC: recovery:getTransactionLogs');
      const result = await TransactionLogService.getLogs({
        ...options,
        startDate: options.startDate ? new Date(options.startDate) : undefined,
        endDate: options.endDate ? new Date(options.endDate) : undefined,
      });
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      logger.error('IPC: recovery:getTransactionLogs error', error);
      return {
        success: false,
        logs: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 20,
        error: error instanceof Error ? error.message : 'Failed to get transaction logs',
      };
    }
  });

  /**
   * Cleanup old transaction logs
   * IPC: recovery:cleanupOldLogs
   */
  ipcMain.handle('recovery:cleanupOldLogs', async (_event, daysToKeep: number = 90) => {
    try {
      logger.info('IPC: recovery:cleanupOldLogs', { daysToKeep });
      const deletedCount = await TransactionLogService.cleanupOldLogs(daysToKeep);
      return {
        success: true,
        deletedCount,
      };
    } catch (error) {
      logger.error('IPC: recovery:cleanupOldLogs error', error);
      return {
        success: false,
        deletedCount: 0,
        error: error instanceof Error ? error.message : 'Failed to cleanup old logs',
      };
    }
  });

  logger.info('Recovery IPC handlers registered');
}

