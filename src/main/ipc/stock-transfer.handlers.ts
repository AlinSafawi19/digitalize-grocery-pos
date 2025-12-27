import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  StockTransferService,
  CreateStockTransferInput,
  UpdateStockTransferInput,
  StockTransferListOptions,
} from '../services/stock-transfer/stock-transfer.service';

/**
 * Register stock transfer management IPC handlers
 */
export function registerStockTransferHandlers(): void {
  logger.info('Registering stock transfer management IPC handlers...');

  /**
   * Get stock transfer by ID handler
   * IPC: stockTransfer:getById
   */
  ipcMain.handle(
    'stockTransfer:getById',
    async (_event, id: number) => {
      try {
        const transfer = await StockTransferService.getById(id);
        if (!transfer) {
          return {
            success: false,
            error: 'Stock transfer not found',
          };
        }

        return { success: true, transfer };
      } catch (error) {
        logger.error('Error in stockTransfer:getById handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get stock transfers list handler
   * IPC: stockTransfer:getList
   */
  ipcMain.handle(
    'stockTransfer:getList',
    async (_event, options: StockTransferListOptions) => {
      try {
        const result = await StockTransferService.getList(options);
        return result;
      } catch (error) {
        logger.error('Error in stockTransfer:getList handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Create stock transfer handler
   * IPC: stockTransfer:create
   */
  ipcMain.handle(
    'stockTransfer:create',
    async (_event, input: CreateStockTransferInput, requestedById: number) => {
      try {
        const result = await StockTransferService.createTransfer(input, requestedById);
        return result;
      } catch (error) {
        logger.error('Error in stockTransfer:create handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update stock transfer handler
   * IPC: stockTransfer:update
   */
  ipcMain.handle(
    'stockTransfer:update',
    async (_event, id: number, input: UpdateStockTransferInput, updatedById: number) => {
      try {
        const result = await StockTransferService.updateTransfer(id, input, updatedById);
        return result;
      } catch (error) {
        logger.error('Error in stockTransfer:update handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Complete stock transfer handler
   * IPC: stockTransfer:complete
   */
  ipcMain.handle(
    'stockTransfer:complete',
    async (
      _event,
      id: number,
      receivedItems: Array<{ itemId: number; receivedQuantity: number }>,
      completedById: number
    ) => {
      try {
        const result = await StockTransferService.completeTransfer(
          id,
          receivedItems,
          completedById
        );
        return result;
      } catch (error) {
        logger.error('Error in stockTransfer:complete handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Cancel stock transfer handler
   * IPC: stockTransfer:cancel
   */
  ipcMain.handle(
    'stockTransfer:cancel',
    async (_event, id: number, cancelledById: number) => {
      try {
        const result = await StockTransferService.cancelTransfer(id, cancelledById);
        return result;
      } catch (error) {
        logger.error('Error in stockTransfer:cancel handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );
}

