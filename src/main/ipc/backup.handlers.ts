import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  BackupService,
  CreateBackupOptions,
  BackupListOptions,
} from '../services/backup/backup.service';
import {
  getAvailableExternalDrives,
  hasExternalDriveAvailable,
} from '../utils/drive.util';

/**
 * Register backup IPC handlers
 */
export function registerBackupHandlers(): void {
  logger.info('Registering backup IPC handlers...');

  /**
   * Create backup handler
   * IPC: backup:createBackup
   * PERFORMANCE FIX: Uses async operation with progress updates via IPC events
   * This prevents UI blocking and provides user feedback during backup operations
   * 
   * NOTE: All backups now require an external drive. The destinationPath in options is required.
   */
  ipcMain.handle(
    'backup:createBackup',
    async (event, options: CreateBackupOptions, requestedById: number) => {
      try {
        // Send initial progress
        event.sender.send('backup:createBackup:progress', {
          progress: 0,
          message: 'Starting backup creation...',
        });

        const backupInfo = await BackupService.createBackup(options, requestedById);

        // Send completion progress
        event.sender.send('backup:createBackup:progress', {
          progress: 100,
          message: 'Backup created successfully',
        });

        return {
          success: true,
          backup: backupInfo,
        };
      } catch (error) {
        logger.error('Error in backup:createBackup handler', error);
        // Send error progress
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('backup:createBackup:progress', {
            progress: -1,
            message: `Backup failed: ${error instanceof Error ? error.message : 'An error occurred'}`,
          });
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get backups list handler
   * IPC: backup:getBackups
   */
  ipcMain.handle(
    'backup:getBackups',
    async (_event, options: BackupListOptions) => {
      try {
        const result = await BackupService.getBackups(options);
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        logger.error('Error in backup:getBackups handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get backup by ID handler
   * IPC: backup:getBackupById
   */
  ipcMain.handle(
    'backup:getBackupById',
    async (_event, id: string) => {
      try {
        const backup = await BackupService.getBackupById(id);
        return {
          success: true,
          backup: backup || null,
        };
      } catch (error) {
        logger.error('Error in backup:getBackupById handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Verify backup handler
   * IPC: backup:verifyBackup
   */
  ipcMain.handle(
    'backup:verifyBackup',
    async (_event, backupPath: string) => {
      try {
        const verification = await BackupService.verifyBackup(backupPath);
        return {
          success: true,
          ...verification,
        };
      } catch (error) {
        logger.error('Error in backup:verifyBackup handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Restore backup handler
   * IPC: backup:restoreBackup
   * PERFORMANCE FIX: Uses async operation with progress updates via IPC events
   * This prevents UI blocking during restore operations
   */
  ipcMain.handle(
    'backup:restoreBackup',
    async (event, backupPath: string, requestedById: number) => {
      try {
        // Send initial progress
        event.sender.send('backup:restoreBackup:progress', {
          progress: 0,
          message: 'Starting backup restore...',
        });

        await BackupService.restoreBackup(backupPath, requestedById);

        // Send completion progress
        event.sender.send('backup:restoreBackup:progress', {
          progress: 100,
          message: 'Backup restored successfully',
        });

        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in backup:restoreBackup handler', error);
        // Send error progress
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('backup:restoreBackup:progress', {
            progress: -1,
            message: `Restore failed: ${error instanceof Error ? error.message : 'An error occurred'}`,
          });
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete backup handler
   * IPC: backup:deleteBackup
   */
  ipcMain.handle(
    'backup:deleteBackup',
    async (_event, backupPath: string) => {
      try {
        await BackupService.deleteBackup(backupPath);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in backup:deleteBackup handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete old backups handler
   * IPC: backup:deleteOldBackups
   */
  ipcMain.handle(
    'backup:deleteOldBackups',
    async (_event, daysToKeep: number) => {
      try {
        const result = await BackupService.deleteOldBackups(daysToKeep);
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        logger.error('Error in backup:deleteOldBackups handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get backup statistics handler
   * IPC: backup:getBackupStats
   */
  ipcMain.handle(
    'backup:getBackupStats',
    async () => {
      try {
        const stats = await BackupService.getBackupStats();
        return {
          success: true,
          ...stats,
        };
      } catch (error) {
        logger.error('Error in backup:getBackupStats handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Create backup to external drive handler
   * IPC: backup:createBackupToExternal
   * NOTE: This is now the same as createBackup since all backups require external drive
   */
  ipcMain.handle(
    'backup:createBackupToExternal',
    async (event, destinationPath: string, options: Omit<CreateBackupOptions, 'destinationPath'>, requestedById: number) => {
      try {
        // Send initial progress
        event.sender.send('backup:createBackup:progress', {
          progress: 0,
          message: 'Starting backup creation...',
        });

        const backupInfo = await BackupService.createBackup(
          { ...options, destinationPath },
          requestedById
        );

        // Send completion progress
        event.sender.send('backup:createBackup:progress', {
          progress: 100,
          message: 'Backup created successfully',
        });

        return {
          success: true,
          backup: backupInfo,
        };
      } catch (error) {
        logger.error('Error in backup:createBackupToExternal handler', error);
        // Send error progress
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('backup:createBackup:progress', {
            progress: -1,
            message: `Backup failed: ${error instanceof Error ? error.message : 'An error occurred'}`,
          });
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get available external drives handler
   * IPC: backup:getAvailableExternalDrives
   */
  ipcMain.handle('backup:getAvailableExternalDrives', async () => {
    try {
      const drives = await getAvailableExternalDrives();
      return {
        success: true,
        drives,
      };
    } catch (error) {
      logger.error('Error in backup:getAvailableExternalDrives handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        drives: [],
      };
    }
  });

  /**
   * Check if external drive is available handler
   * IPC: backup:hasExternalDriveAvailable
   */
  ipcMain.handle('backup:hasExternalDriveAvailable', async () => {
    try {
      const hasDrive = await hasExternalDriveAvailable();
      return {
        success: true,
        hasDrive,
      };
    } catch (error) {
      logger.error('Error in backup:hasExternalDriveAvailable handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        hasDrive: false,
      };
    }
  });

  logger.info('Backup IPC handlers registered');
}

