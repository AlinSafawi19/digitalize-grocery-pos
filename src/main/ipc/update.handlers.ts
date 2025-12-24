import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { UpdateService } from '../services/update/update.service';

/**
 * Register update-related IPC handlers
 */
export function registerUpdateHandlers(): void {
  /**
   * Check for updates manually
   * IPC: update:check
   */
  ipcMain.handle('update:check', async () => {
    try {
      const result = await UpdateService.checkForUpdates();
      return result;
    } catch (error) {
      logger.error('Error in update:check handler', error);
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Download the available update
   * IPC: update:download
   */
  ipcMain.handle('update:download', async () => {
    try {
      const result = await UpdateService.downloadUpdate();
      return result;
    } catch (error) {
      logger.error('Error in update:download handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Install the downloaded update and restart
   * IPC: update:install
   */
  ipcMain.handle('update:install', async () => {
    try {
      await UpdateService.installUpdate();
      return { success: true };
    } catch (error) {
      logger.error('Error in update:install handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Get current app version
   * IPC: update:getVersion
   */
  ipcMain.handle('update:getVersion', async () => {
    try {
      const version = UpdateService.getCurrentVersion();
      return { version };
    } catch (error) {
      logger.error('Error in update:getVersion handler', error);
      return {
        version: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  logger.info('Update IPC handlers registered');
}

