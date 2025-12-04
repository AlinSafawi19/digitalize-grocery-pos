import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { CashDrawerService } from '../services/cash-drawer/cash-drawer.service';

/**
 * Register cash drawer IPC handlers
 */
export function registerCashDrawerHandlers(): void {
  logger.info('Registering cash drawer IPC handlers...');

  /**
   * Open cash drawer handler
   * IPC: cashDrawer:open
   */
  ipcMain.handle(
    'cashDrawer:open',
    async (_event, printerName?: string) => {
      try {
        const result = await CashDrawerService.openCashDrawer(printerName);
        return result;
      } catch (error) {
        logger.error('Error in cashDrawer:open handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Check if auto-open is enabled
   * IPC: cashDrawer:isAutoOpenEnabled
   */
  ipcMain.handle('cashDrawer:isAutoOpenEnabled', async () => {
    try {
      const enabled = await CashDrawerService.isAutoOpenEnabled();
      return {
        success: true,
        enabled,
      };
    } catch (error) {
      logger.error('Error in cashDrawer:isAutoOpenEnabled handler', error);
      return {
        success: false,
        enabled: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  logger.info('Cash drawer IPC handlers registered');
}

