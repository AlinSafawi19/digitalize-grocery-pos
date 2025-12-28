import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  BackupLocationService,
  CreateBackupLocationInput,
  UpdateBackupLocationInput,
} from '../services/backup/backup-location.service';

/**
 * Register backup location IPC handlers
 */
export function registerBackupLocationHandlers(): void {
  logger.info('Registering backup location IPC handlers...');

  /**
   * Validate backup location handler
   * IPC: backupLocation:validate
   */
  ipcMain.handle(
    'backupLocation:validate',
    async (_event, type: string, path: string, config?: unknown) => {
      try {
        const result = await BackupLocationService.validateLocation(
          type as any,
          path,
          config as any
        );
        return {
          success: result.valid,
          data: result,
        };
      } catch (error) {
        logger.error('Error in backupLocation:validate handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Create backup location handler
   * IPC: backupLocation:create
   */
  ipcMain.handle(
    'backupLocation:create',
    async (_event, input: CreateBackupLocationInput) => {
      try {
        const location = await BackupLocationService.createLocation(input);
        return {
          success: true,
          data: location,
        };
      } catch (error) {
        logger.error('Error in backupLocation:create handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get location by ID handler
   * IPC: backupLocation:getById
   */
  ipcMain.handle(
    'backupLocation:getById',
    async (_event, id: number) => {
      try {
        const location = await BackupLocationService.getLocationById(id);
        return {
          success: true,
          data: location,
        };
      } catch (error) {
        logger.error('Error in backupLocation:getById handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get locations handler
   * IPC: backupLocation:getList
   */
  ipcMain.handle(
    'backupLocation:getList',
    async (
      _event,
      options?: {
        isActive?: boolean;
        type?: string;
        page?: number;
        pageSize?: number;
      }
    ) => {
      try {
        const result = await BackupLocationService.getLocations(options);
        return {
          success: true,
          data: result.locations,
          pagination: result.pagination,
        };
      } catch (error) {
        logger.error('Error in backupLocation:getList handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update location handler
   * IPC: backupLocation:update
   */
  ipcMain.handle(
    'backupLocation:update',
    async (_event, id: number, input: UpdateBackupLocationInput) => {
      try {
        const location = await BackupLocationService.updateLocation(id, input);
        return {
          success: true,
          data: location,
        };
      } catch (error) {
        logger.error('Error in backupLocation:update handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete location handler
   * IPC: backupLocation:delete
   */
  ipcMain.handle(
    'backupLocation:delete',
    async (_event, id: number) => {
      try {
        await BackupLocationService.deleteLocation(id);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in backupLocation:delete handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get schedule locations handler
   * IPC: backupLocation:getScheduleLocations
   */
  ipcMain.handle(
    'backupLocation:getScheduleLocations',
    async (_event, scheduleId: number) => {
      try {
        const locations = await BackupLocationService.getScheduleLocations(scheduleId);
        return {
          success: true,
          data: locations,
        };
      } catch (error) {
        logger.error('Error in backupLocation:getScheduleLocations handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  logger.info('Backup location IPC handlers registered');
}

