import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { AuditLogService } from '../services/audit/audit-log.service';

/**
 * Register audit log IPC handlers
 */
export function registerAuditLogHandlers(): void {
  /**
   * Get audit logs with filtering
   */
  ipcMain.handle('audit-log:getLogs', async (_event, options: {
    page?: number;
    pageSize?: number;
    userId?: number;
    entity?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }) => {
    try {
      const result = await AuditLogService.getLogs(options);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      logger.error('Error getting audit logs', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get audit logs',
      };
    }
  });
}

