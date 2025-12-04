import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { ReceiptService } from '../services/receipt/receipt.service';

/**
 * Register receipt management IPC handlers
 */
export function registerReceiptHandlers(): void {
  logger.info('Registering receipt management IPC handlers...');

  /**
   * Generate receipt handler
   * IPC: receipt:generate
   */
  ipcMain.handle(
    'receipt:generate',
    async (_event, transactionId: number, requestedById: number) => {
      try {
        logger.posAction('Receipt generation request received', {
          requestedById,
          transactionId,
        });

        const filepath = await ReceiptService.generateReceipt(transactionId);
        logger.posAction('Receipt generation completed', {
          requestedById,
          transactionId,
          filepath,
        });
        return { success: true, filepath };
      } catch (error) {
        logger.error('Error in receipt:generate handler', {
          requestedById,
          transactionId,
          error,
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get receipt path handler
   * IPC: receipt:getPath
   */
  ipcMain.handle(
    'receipt:getPath',
    async (_event, transactionId: number, requestedById: number) => {
      try {
        logger.debug('Receipt path request', {
          requestedById,
          transactionId,
        });

        const filepath = await ReceiptService.getReceiptPath(transactionId);
        
        logger.debug('Receipt path retrieved', {
          requestedById,
          transactionId,
          filepath,
          found: filepath !== null,
        });

        return { success: true, filepath };
      } catch (error) {
        logger.error('Error in receipt:getPath handler', {
          requestedById,
          transactionId,
          error,
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete receipt handler
   * IPC: receipt:delete
   */
  ipcMain.handle(
    'receipt:delete',
    async (_event, transactionId: number) => {
      try {
        const deleted = await ReceiptService.deleteReceipt(transactionId);
        return { success: true, deleted };
      } catch (error) {
        logger.error('Error in receipt:delete handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );
}

