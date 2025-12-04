import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  InventoryService,
  InventoryListOptions,
  AdjustStockInput,
  UpdateInventoryInput,
  StockMovementListOptions,
} from '../services/inventory/inventory.service';

/**
 * Register inventory management IPC handlers
 */
export function registerInventoryHandlers(): void {
  logger.info('Registering inventory management IPC handlers...');

  /**
   * Get inventory item by product ID handler
   * IPC: inventory:getByProductId
   */
  ipcMain.handle(
    'inventory:getByProductId',
    async (_event, productId: number) => {
      try {
        const inventory = await InventoryService.getByProductId(productId);
        return { success: true, inventory };
      } catch (error) {
        logger.error('Error in inventory:getByProductId handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get inventory list handler
   * IPC: inventory:getList
   */
  ipcMain.handle(
    'inventory:getList',
    async (_event, options: InventoryListOptions) => {
      try {
        const result = await InventoryService.getList(options);
        return result;
      } catch (error) {
        logger.error('Error in inventory:getList handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Initialize inventory for product handler
   * IPC: inventory:initialize
   */
  ipcMain.handle(
    'inventory:initialize',
    async (_event, productId: number, initialQuantity: number, reorderLevel: number) => {
      try {
        const inventory = await InventoryService.initializeInventory(productId, initialQuantity, reorderLevel);
        return { success: true, inventory };
      } catch (error) {
        logger.error('Error in inventory:initialize handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update inventory handler
   * IPC: inventory:update
   */
  ipcMain.handle(
    'inventory:update',
    async (_event, input: UpdateInventoryInput, requestedById: number) => {
      try {
        const result = await InventoryService.updateInventory(input, requestedById);
        return result;
      } catch (error) {
        logger.error('Error in inventory:update handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Adjust stock handler
   * IPC: inventory:adjustStock
   */
  ipcMain.handle(
    'inventory:adjustStock',
    async (_event, input: AdjustStockInput, requestedById: number) => {
      try {
        // Ensure userId is set
        const adjustedInput: AdjustStockInput = {
          ...input,
          userId: input.userId || requestedById,
        };

        const result = await InventoryService.adjustStock(adjustedInput, requestedById);
        return result;
      } catch (error) {
        logger.error('Error in inventory:adjustStock handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get stock movements handler
   * IPC: inventory:getStockMovements
   */
  ipcMain.handle(
    'inventory:getStockMovements',
    async (_event, options: StockMovementListOptions) => {
      try {
        const result = await InventoryService.getStockMovements(options);
        return result;
      } catch (error) {
        logger.error('Error in inventory:getStockMovements handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get low stock items handler
   * IPC: inventory:getLowStockItems
   */
  ipcMain.handle(
    'inventory:getLowStockItems',
    async (_event, options: Omit<InventoryListOptions, 'lowStockOnly' | 'outOfStockOnly'>) => {
      try {
        const result = await InventoryService.getLowStockItems(options);
        return result;
      } catch (error) {
        logger.error('Error in inventory:getLowStockItems handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get out of stock items handler
   * IPC: inventory:getOutOfStockItems
   */
  ipcMain.handle(
    'inventory:getOutOfStockItems',
    async (_event, options: Omit<InventoryListOptions, 'lowStockOnly' | 'outOfStockOnly'>) => {
      try {
        const result = await InventoryService.getOutOfStockItems(options);
        return result;
      } catch (error) {
        logger.error('Error in inventory:getOutOfStockItems handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get low stock count handler (for dashboard)
   * IPC: inventory:getLowStockCount
   */
  ipcMain.handle('inventory:getLowStockCount', async () => {
    try {
      const count = await InventoryService.getLowStockCount();
      return { success: true, count };
    } catch (error) {
      logger.error('Error in inventory:getLowStockCount handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        count: 0,
      };
    }
  });

  /**
   * Get out of stock count handler (for dashboard)
   * IPC: inventory:getOutOfStockCount
   */
  ipcMain.handle('inventory:getOutOfStockCount', async () => {
    try {
      const count = await InventoryService.getOutOfStockCount();
      return { success: true, count };
    } catch (error) {
      logger.error('Error in inventory:getOutOfStockCount handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        count: 0,
      };
    }
  });

  logger.info('Inventory management IPC handlers registered');
}

