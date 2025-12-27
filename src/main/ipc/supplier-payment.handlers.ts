import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  SupplierPaymentService,
  CreateSupplierPaymentInput,
  UpdateSupplierPaymentInput,
  SupplierPaymentListOptions,
} from '../services/supplier/supplier-payment.service';

/**
 * Register supplier payment IPC handlers
 */
export function registerSupplierPaymentHandlers(): void {
  logger.info('Registering supplier payment IPC handlers...');

  /**
   * Create supplier payment handler
   * IPC: supplier-payment:create
   */
  ipcMain.handle(
    'supplier-payment:create',
    async (_event, input: CreateSupplierPaymentInput, recordedById: number) => {
      try {
        const payment = await SupplierPaymentService.createPayment(input, recordedById);
        return {
          success: true,
          payment,
        };
      } catch (error) {
        logger.error('Error in supplier-payment:create handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get payment by ID handler
   * IPC: supplier-payment:getById
   */
  ipcMain.handle('supplier-payment:getById', async (_event, id: number) => {
    try {
      const payment = await SupplierPaymentService.getById(id);
      if (!payment) {
        return {
          success: false,
          error: 'Payment not found',
        };
      }
      return {
        success: true,
        payment,
      };
    } catch (error) {
      logger.error('Error in supplier-payment:getById handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get payments list handler
   * IPC: supplier-payment:getList
   */
  ipcMain.handle(
    'supplier-payment:getList',
    async (_event, options: SupplierPaymentListOptions) => {
      try {
        const result = await SupplierPaymentService.getList(options);
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        logger.error('Error in supplier-payment:getList handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update payment handler
   * IPC: supplier-payment:update
   */
  ipcMain.handle(
    'supplier-payment:update',
    async (_event, id: number, input: UpdateSupplierPaymentInput, userId: number) => {
      try {
        const payment = await SupplierPaymentService.updatePayment(id, input, userId);
        return {
          success: true,
          payment,
        };
      } catch (error) {
        logger.error('Error in supplier-payment:update handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete payment handler
   * IPC: supplier-payment:delete
   */
  ipcMain.handle('supplier-payment:delete', async (_event, id: number, userId: number) => {
    try {
      await SupplierPaymentService.deletePayment(id, userId);
      return {
        success: true,
      };
    } catch (error) {
      logger.error('Error in supplier-payment:delete handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get supplier balance handler
   * IPC: supplier-payment:getSupplierBalance
   */
  ipcMain.handle('supplier-payment:getSupplierBalance', async (_event, supplierId: number) => {
    try {
      const balance = await SupplierPaymentService.getSupplierBalance(supplierId);
      return {
        success: true,
        balance,
      };
    } catch (error) {
      logger.error('Error in supplier-payment:getSupplierBalance handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get all supplier balances handler
   * IPC: supplier-payment:getAllSupplierBalances
   */
  ipcMain.handle('supplier-payment:getAllSupplierBalances', async () => {
    try {
      const balances = await SupplierPaymentService.getAllSupplierBalances();
      return {
        success: true,
        balances,
      };
    } catch (error) {
      logger.error('Error in supplier-payment:getAllSupplierBalances handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get payment reminders handler
   * IPC: supplier-payment:getPaymentReminders
   */
  ipcMain.handle(
    'supplier-payment:getPaymentReminders',
    async (_event, daysOverdue?: number) => {
      try {
        const reminders = await SupplierPaymentService.getPaymentReminders(daysOverdue);
        return {
          success: true,
          reminders,
        };
      } catch (error) {
        logger.error('Error in supplier-payment:getPaymentReminders handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get invoice payments handler
   * IPC: supplier-payment:getInvoicePayments
   */
  ipcMain.handle('supplier-payment:getInvoicePayments', async (_event, invoiceId: number) => {
    try {
      const payments = await SupplierPaymentService.getInvoicePayments(invoiceId);
      return {
        success: true,
        payments,
      };
    } catch (error) {
      logger.error('Error in supplier-payment:getInvoicePayments handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });
}

