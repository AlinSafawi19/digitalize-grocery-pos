import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  SupplierService,
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierListOptions,
} from '../services/supplier/supplier.service';
import { PurchaseOrderListOptions } from '../services/purchase-order/purchase-order.service';

/**
 * Register supplier management IPC handlers
 */
export function registerSupplierHandlers(): void {
  logger.info('Registering supplier management IPC handlers...');

  /**
   * Get supplier by ID handler
   * IPC: supplier:getById
   */
  ipcMain.handle('supplier:getById', async (_event, supplierId: number) => {
    try {
      const supplier = await SupplierService.getById(supplierId);
      if (!supplier) {
        return {
          success: false,
          error: 'Supplier not found',
        };
      }

      return { success: true, supplier };
    } catch (error) {
      logger.error('Error in supplier:getById handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get suppliers list handler
   * IPC: supplier:getList
   */
  ipcMain.handle('supplier:getList', async (_event, options: SupplierListOptions) => {
    try {
      const result = await SupplierService.getList(options);
      return {
        success: true,
        suppliers: result.suppliers,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          totalItems: result.total,
          totalPages: result.totalPages,
          hasNextPage: result.page < result.totalPages,
          hasPreviousPage: result.page > 1,
        },
      };
    } catch (error) {
      logger.error('Error in supplier:getList handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get all suppliers handler
   * IPC: supplier:getAll
   */
  ipcMain.handle('supplier:getAll', async () => {
    try {
      const suppliers = await SupplierService.getAll();
      return { success: true, suppliers };
    } catch (error) {
      logger.error('Error in supplier:getAll handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Create supplier handler
   * IPC: supplier:create
   */
  ipcMain.handle('supplier:create', async (_event, input: CreateSupplierInput, requestedById: number) => {
    try {
      const supplier = await SupplierService.create(input, requestedById);
      return { success: true, supplier };
    } catch (error) {
      logger.error('Error in supplier:create handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Update supplier handler
   * IPC: supplier:update
   */
  ipcMain.handle('supplier:update', async (_event, supplierId: number, input: UpdateSupplierInput, requestedById: number) => {
    try {
      const supplier = await SupplierService.update(supplierId, input, requestedById);
      return { success: true, supplier };
    } catch (error) {
      logger.error('Error in supplier:update handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Delete supplier handler
   * IPC: supplier:delete
   */
  ipcMain.handle('supplier:delete', async (_event, supplierId: number, requestedById: number) => {
    try {
      await SupplierService.delete(supplierId, requestedById);
      return { success: true };
    } catch (error) {
      logger.error('Error in supplier:delete handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get purchase orders for supplier handler
   * IPC: supplier:getPurchaseOrders
   */
  ipcMain.handle(
    'supplier:getPurchaseOrders',
    async (_event, supplierId: number, options: PurchaseOrderListOptions) => {
      try {
        const result = await SupplierService.getPurchaseOrders(supplierId, options);
        return result;
      } catch (error) {
        logger.error('Error in supplier:getPurchaseOrders handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get supplier performance statistics handler
   * IPC: supplier:getPerformanceStats
   */
  ipcMain.handle(
    'supplier:getPerformanceStats',
    async (_event, supplierId: number) => {
      try {
        const stats = await SupplierService.getPerformanceStats(supplierId);
        return { success: true, stats };
      } catch (error) {
        logger.error('Error in supplier:getPerformanceStats handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get supplier payment history handler
   * IPC: supplier:getPaymentHistory
   */
  ipcMain.handle(
    'supplier:getPaymentHistory',
    async (
      _event,
      supplierId: number,
      options: {
        page?: number;
        pageSize?: number;
        startDate?: Date;
        endDate?: Date;
      }
    ) => {
      try {
        const result = await SupplierService.getPaymentHistory(supplierId, options);
        return {
          success: true,
          invoices: result.invoices,
          pagination: {
            page: result.page,
            pageSize: result.pageSize,
            totalItems: result.total,
            totalPages: result.totalPages,
            hasNextPage: result.page < result.totalPages,
            hasPreviousPage: result.page > 1,
          },
        };
      } catch (error) {
        logger.error('Error in supplier:getPaymentHistory handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );
}

