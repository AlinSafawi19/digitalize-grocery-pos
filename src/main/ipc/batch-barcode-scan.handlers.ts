import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  BatchBarcodeScanService,
  BatchScanOptions,
} from '../services/barcode/batch-barcode-scan.service';

/**
 * Register batch barcode scan IPC handlers
 */
export function registerBatchBarcodeScanHandlers(): void {
  logger.info('Registering batch barcode scan IPC handlers...');

  /**
   * Start batch scan handler
   * IPC: batch-barcode-scan:startBatch
   */
  ipcMain.handle(
    'batch-barcode-scan:startBatch',
    async (_event, options: BatchScanOptions) => {
      try {
        const batchId = BatchBarcodeScanService.startBatchScan(options);
        return {
          success: true,
          batchId,
        };
      } catch (error) {
        logger.error('Error in batch-barcode-scan:startBatch handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Scan barcode handler
   * IPC: batch-barcode-scan:scanBarcode
   */
  ipcMain.handle(
    'batch-barcode-scan:scanBarcode',
    async (
      _event,
      batchId: string,
      barcode: string,
      options: BatchScanOptions,
      userId: number
    ) => {
      try {
        const item = await BatchBarcodeScanService.scanBarcode(
          batchId,
          barcode,
          options,
          userId
        );
        return {
          success: true,
          item,
        };
      } catch (error) {
        logger.error('Error in batch-barcode-scan:scanBarcode handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update item quantity handler
   * IPC: batch-barcode-scan:updateItemQuantity
   */
  ipcMain.handle(
    'batch-barcode-scan:updateItemQuantity',
    async (_event, batchId: string, barcode: string, quantity: number) => {
      try {
        const success = BatchBarcodeScanService.updateItemQuantity(
          batchId,
          barcode,
          quantity
        );
        return {
          success,
        };
      } catch (error) {
        logger.error('Error in batch-barcode-scan:updateItemQuantity handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Remove item handler
   * IPC: batch-barcode-scan:removeItem
   */
  ipcMain.handle(
    'batch-barcode-scan:removeItem',
    async (_event, batchId: string, barcode: string) => {
      try {
        const success = BatchBarcodeScanService.removeItem(batchId, barcode);
        return {
          success,
        };
      } catch (error) {
        logger.error('Error in batch-barcode-scan:removeItem handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get batch result handler
   * IPC: batch-barcode-scan:getBatchResult
   */
  ipcMain.handle(
    'batch-barcode-scan:getBatchResult',
    async (_event, batchId: string) => {
      try {
        const result = BatchBarcodeScanService.getBatchResult(batchId);
        if (!result) {
          return {
            success: false,
            error: 'Batch scan session not found',
          };
        }
        return {
          success: true,
          result,
        };
      } catch (error) {
        logger.error('Error in batch-barcode-scan:getBatchResult handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Complete batch handler
   * IPC: batch-barcode-scan:completeBatch
   */
  ipcMain.handle(
    'batch-barcode-scan:completeBatch',
    async (_event, batchId: string) => {
      try {
        const result = BatchBarcodeScanService.completeBatch(batchId);
        if (!result) {
          return {
            success: false,
            error: 'Batch scan session not found',
          };
        }
        return {
          success: true,
          result,
        };
      } catch (error) {
        logger.error('Error in batch-barcode-scan:completeBatch handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Cancel batch handler
   * IPC: batch-barcode-scan:cancelBatch
   */
  ipcMain.handle(
    'batch-barcode-scan:cancelBatch',
    async (_event, batchId: string) => {
      try {
        const success = BatchBarcodeScanService.cancelBatch(batchId);
        return {
          success,
        };
      } catch (error) {
        logger.error('Error in batch-barcode-scan:cancelBatch handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Export to CSV handler
   * IPC: batch-barcode-scan:exportToCSV
   */
  ipcMain.handle(
    'batch-barcode-scan:exportToCSV',
    async (_event, batchId: string) => {
      try {
        const csv = BatchBarcodeScanService.exportToCSV(batchId);
        if (!csv) {
          return {
            success: false,
            error: 'Batch scan session not found',
          };
        }
        return {
          success: true,
          csv,
        };
      } catch (error) {
        logger.error('Error in batch-barcode-scan:exportToCSV handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );
}

