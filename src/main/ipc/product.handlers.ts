import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  ProductService,
  CreateProductInput,
  UpdateProductInput,
  ProductListOptions,
} from '../services/product/product.service';

/**
 * Register product management IPC handlers
 */
export function registerProductHandlers(): void {
  logger.info('Registering product management IPC handlers...');

  /**
   * Get product by ID handler
   * IPC: product:getById
   */
  ipcMain.handle('product:getById', async (_event, productId: number) => {
    try {
      const product = await ProductService.getById(productId);
      if (!product) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      return { success: true, product };
    } catch (error) {
      logger.error('Error in product:getById handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get product by code handler
   * IPC: product:getByCode
   */
  ipcMain.handle('product:getByCode', async (_event, code: string) => {
    try {
      const product = await ProductService.getByCode(code);
      if (!product) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      return { success: true, product };
    } catch (error) {
      logger.error('Error in product:getByCode handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get product by barcode handler
   * IPC: product:getByBarcode
   */
  ipcMain.handle('product:getByBarcode', async (_event, barcode: string) => {
    try {
 const product = await ProductService.getByBarcode(barcode);
      if (!product) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      return { success: true, product };
    } catch (error) {
      logger.error('Error in product:getByBarcode handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get products list handler
   * IPC: product:getList
   */
  ipcMain.handle('product:getList', async (_event, options: ProductListOptions) => {
    try {
      const result = await ProductService.getList(options);
      return { success: true, ...result };
    } catch (error) {
      logger.error('Error in product:getList handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Search products handler
   * IPC: product:search
   */
  ipcMain.handle('product:search', async (_event, query: string, limit: number) => {
    try {
      const products = await ProductService.search(query, limit);
      return { success: true, products };
    } catch (error) {
      logger.error('Error in product:search handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get products by category handler
   * IPC: product:getByCategory
   */
  ipcMain.handle('product:getByCategory', async (_event, categoryId: number, options: ProductListOptions) => {
    try {
      const result = await ProductService.getByCategory(categoryId, options);
      return { success: true, ...result };
    } catch (error) {
      logger.error('Error in product:getByCategory handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Create product handler
   * IPC: product:create
   */
  ipcMain.handle('product:create', async (_event, input: CreateProductInput, requestedById: number) => {
    try {
      const product = await ProductService.create(input, requestedById);
      return { success: true, product };
    } catch (error) {
      logger.error('Error in product:create handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Update product handler
   * IPC: product:update
   */
  ipcMain.handle('product:update', async (_event, productId: number, input: UpdateProductInput, requestedById: number) => {
    try {
      const product = await ProductService.update(productId, input, requestedById);
      return { success: true, product };
    } catch (error) {
      logger.error('Error in product:update handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Delete product handler
   * IPC: product:delete
   */
  ipcMain.handle('product:delete', async (_event, productId: number, requestedById: number) => {
    try {
      await ProductService.delete(productId, requestedById);
      return { success: true };
    } catch (error) {
      logger.error('Error in product:delete handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get all products for export handler
   * IPC: product:getAllForExport
   */
  ipcMain.handle('product:getAllForExport', async () => {
    try {
      const products = await ProductService.getAllForExport();
      return { success: true, products };
    } catch (error) {
      logger.error('Error in product:getAllForExport handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Bulk create products handler
   * IPC: product:bulkCreate
   * PERFORMANCE FIX: Uses async operation with progress updates via IPC events
   * This prevents UI blocking and provides user feedback during long operations
   */
  ipcMain.handle('product:bulkCreate', async (event, products: CreateProductInput[], requestedById: number) => {
    try {
      // Send initial progress
      event.sender.send('product:bulkCreate:progress', {
        progress: 0,
        message: `Starting bulk import of ${products.length} products...`,
      });

      // Wrap the bulk create to send progress updates
      // Note: ProductService.bulkCreate already processes in chunks, but we can add progress tracking
      const result = await ProductService.bulkCreate(products, requestedById);

      // Send completion progress
      event.sender.send('product:bulkCreate:progress', {
        progress: 100,
        message: `Import completed: ${result.success} succeeded, ${result.failed} failed`,
      });

      return {
        success: true,
        successCount: result.success,
        failedCount: result.failed,
        errors: result.errors,
      };
    } catch (error) {
      logger.error('Error in product:bulkCreate handler', error);
      // Send error progress
      if (event.sender && !event.sender.isDestroyed()) {
        event.sender.send('product:bulkCreate:progress', {
          progress: -1,
          message: `Import failed: ${error instanceof Error ? error.message : 'An error occurred'}`,
        });
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Bulk delete products handler
   * IPC: product:bulkDelete
   * PERFORMANCE FIX: Batch delete multiple products in a single IPC call
   * This reduces IPC overhead from N calls to 1 call
   */
  ipcMain.handle('product:bulkDelete', async (_event, productIds: number[], userId: number) => {
    try {
      const result = await ProductService.bulkDelete(productIds, userId);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      logger.error('Error in product:bulkDelete handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });
}

