import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  SystemMaintenanceService,
  MaintenanceResult,
  DatabaseStats,
} from '../services/system/system-maintenance.service';

/**
 * Register system maintenance IPC handlers
 */
export function registerSystemMaintenanceHandlers(): void {
  logger.info('Registering system maintenance IPC handlers...');

  /**
   * Get available maintenance operations
   * IPC: systemMaintenance:getAvailableOperations
   */
  ipcMain.handle('systemMaintenance:getAvailableOperations', async () => {
    try {
      const operations = SystemMaintenanceService.getAvailableOperations();
      return { success: true, operations };
    } catch (error) {
      logger.error('Error in systemMaintenance:getAvailableOperations handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get maintenance history
   * IPC: systemMaintenance:getHistory
   */
  ipcMain.handle('systemMaintenance:getHistory', async (_event, options: {
    page?: number;
    pageSize?: number;
    operationType?: string;
  }) => {
    try {
      const result = await SystemMaintenanceService.getMaintenanceHistory(options);
      return {
        success: true,
        operations: result.operations,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          totalItems: result.total,
          totalPages: result.totalPages,
          hasNextPage: result.page < result.totalPages,
          hasPreviousPage: result.page > 1,
        },
      };
    } catch (error) {
      logger.error('Error in systemMaintenance:getHistory handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get database statistics
   * IPC: systemMaintenance:getDatabaseStats
   */
  ipcMain.handle('systemMaintenance:getDatabaseStats', async () => {
    try {
      const stats = await SystemMaintenanceService.getDatabaseStats();
      return { success: true, stats };
    } catch (error) {
      logger.error('Error in systemMaintenance:getDatabaseStats handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Optimize database (VACUUM + ANALYZE)
   * IPC: systemMaintenance:optimizeDatabase
   */
  ipcMain.handle('systemMaintenance:optimizeDatabase', async (_event, userId: number) => {
    try {
      const result = await SystemMaintenanceService.optimizeDatabase(userId);
      return result;
    } catch (error) {
      logger.error('Error in systemMaintenance:optimizeDatabase handler', error);
      return {
        success: false,
        message: 'Database optimization failed',
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Vacuum database
   * IPC: systemMaintenance:vacuumDatabase
   */
  ipcMain.handle('systemMaintenance:vacuumDatabase', async (_event, userId: number) => {
    try {
      const result = await SystemMaintenanceService.vacuumDatabase(userId);
      return result;
    } catch (error) {
      logger.error('Error in systemMaintenance:vacuumDatabase handler', error);
      return {
        success: false,
        message: 'Database vacuum failed',
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Analyze database
   * IPC: systemMaintenance:analyzeDatabase
   */
  ipcMain.handle('systemMaintenance:analyzeDatabase', async (_event, userId: number) => {
    try {
      const result = await SystemMaintenanceService.analyzeDatabase(userId);
      return result;
    } catch (error) {
      logger.error('Error in systemMaintenance:analyzeDatabase handler', error);
      return {
        success: false,
        message: 'Database analysis failed',
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Cleanup old audit logs
   * IPC: systemMaintenance:cleanupOldAuditLogs
   */
  ipcMain.handle('systemMaintenance:cleanupOldAuditLogs', async (_event, userId: number, daysToKeep?: number) => {
    try {
      const result = await SystemMaintenanceService.cleanupOldAuditLogs(userId, daysToKeep);
      return result;
    } catch (error) {
      logger.error('Error in systemMaintenance:cleanupOldAuditLogs handler', error);
      return {
        success: false,
        message: 'Cleanup of old audit logs failed',
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Cleanup expired sessions
   * IPC: systemMaintenance:cleanupExpiredSessions
   */
  ipcMain.handle('systemMaintenance:cleanupExpiredSessions', async (_event, userId: number) => {
    try {
      const result = await SystemMaintenanceService.cleanupExpiredSessions(userId);
      return result;
    } catch (error) {
      logger.error('Error in systemMaintenance:cleanupExpiredSessions handler', error);
      return {
        success: false,
        message: 'Cleanup of expired sessions failed',
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });
}

