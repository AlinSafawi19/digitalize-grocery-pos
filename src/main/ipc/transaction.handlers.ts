import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  TransactionService,
  CreateTransactionInput,
  PaymentInput,
  TransactionListOptions,
} from '../services/transaction/transaction.service';

/**
 * Register transaction management IPC handlers
 */
export function registerTransactionHandlers(): void {
  logger.info('Registering transaction management IPC handlers...');

  /**
   * Create transaction handler
   * IPC: transaction:create
   */
  ipcMain.handle(
    'transaction:create',
    async (_event, input: CreateTransactionInput, requestedById: number) => {
      try {
        logger.posAction('Transaction create request received', {
          requestedById,
          type: input.type,
          itemCount: input.items?.length || 0,
          cashierId: input.cashierId,
        });

        // Ensure cashierId matches the requesting user
        if (input.cashierId !== requestedById) {
            logger.warn('Transaction create denied: cannot create for other user', {
              requestedById,
              cashierId: input.cashierId,
            });
            return {
              success: false,
              error: 'You can only create transactions for yourself',
            };
        }

        const transaction = await TransactionService.create(input);
        logger.posAction('Transaction create completed', {
          requestedById,
          transactionId: transaction.id,
          transactionNumber: transaction.transactionNumber,
        });
        return { success: true, transaction };
      } catch (error) {
        logger.error('Error in transaction:create handler', {
          requestedById,
          error,
          input,
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Add payment to transaction handler
   * IPC: transaction:addPayment
   */
  ipcMain.handle(
    'transaction:addPayment',
    async (
      _event,
      transactionId: number,
      payment: PaymentInput,
      requestedById: number
    ) => {
      try {
        logger.posAction('Payment request received', {
          requestedById,
          transactionId,
          amount: payment.amount,
          received: payment.received,
        });

        const result = await TransactionService.addPayment(transactionId, payment);
        logger.posAction('Payment completed', {
          requestedById,
          transactionId,
          paymentId: result.payment.id,
          transactionStatus: result.transaction.status,
        });
        return { success: true, ...result };
      } catch (error) {
        logger.error('Error in transaction:addPayment handler', {
          requestedById,
          transactionId,
          payment,
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
   * Get transaction by ID handler
   * IPC: transaction:getById
   */
  ipcMain.handle(
    'transaction:getById',
    async (_event, transactionId: number) => {
      try {
        const transaction = await TransactionService.getById(transactionId);
        if (!transaction) {
          return {
            success: false,
            error: 'Transaction not found',
          };
        }

        return { success: true, transaction };
      } catch (error) {
        logger.error('Error in transaction:getById handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get transaction by transaction number handler
   * IPC: transaction:getByTransactionNumber
   */
  ipcMain.handle(
    'transaction:getByTransactionNumber',
    async (_event, transactionNumber: string) => {
      try {
        const transaction = await TransactionService.getByTransactionNumber(
          transactionNumber
        );
        if (!transaction) {
          return {
            success: false,
            error: 'Transaction not found',
          };
        }

        return { success: true, transaction };
      } catch (error) {
        logger.error('Error in transaction:getByTransactionNumber handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get transactions list handler
   * IPC: transaction:getList
   */
  ipcMain.handle(
    'transaction:getList',
    async (
      _event,
      options: TransactionListOptions,
      requestedById: number
    ) => {
      try {
        logger.debug('Transaction list request', {
          requestedById,
          page: options.page,
          pageSize: options.pageSize,
          search: options.search,
          status: options.status,
          type: options.type,
          cashierId: options.cashierId,
          dateRange: options.startDate && options.endDate ? {
            start: options.startDate,
            end: options.endDate,
          } : undefined,
        });

        const result = await TransactionService.getList(options);
        
        logger.debug('Transaction list retrieved', {
          requestedById,
          count: result.transactions.length,
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        });

        return { success: true, ...result };
      } catch (error) {
        logger.error('Error in transaction:getList handler', {
          requestedById,
          options,
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
   * Get transactions by date range handler
   * IPC: transaction:getByDateRange
   */
  ipcMain.handle(
    'transaction:getByDateRange',
    async (
      _event,
      startDate: Date,
      endDate: Date,
      options: Omit<TransactionListOptions, 'startDate' | 'endDate'>
    ) => {
      try {
        const result = await TransactionService.getByDateRange(
          startDate,
          endDate,
          options
        );
        return { success: true, ...result };
      } catch (error) {
        logger.error('Error in transaction:getByDateRange handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Void transaction handler
   * IPC: transaction:void
   */
  ipcMain.handle(
    'transaction:void',
    async (
      _event,
      transactionId: number,
      reason: string | undefined,
      requestedById: number
    ) => {
      try {
        logger.posAction('Transaction void request received', {
          requestedById,
          transactionId,
          reason: reason || 'No reason provided',
        });

        const transaction = await TransactionService.voidTransaction(
          transactionId,
          requestedById,
          reason
        );
        logger.posAction('Transaction void completed', {
          requestedById,
          transactionId,
          transactionNumber: transaction.transactionNumber,
        });
        return { success: true, transaction };
      } catch (error) {
        logger.error('Error in transaction:void handler', {
          requestedById,
          transactionId,
          reason,
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
   * Get transaction history handler (alias for getList)
   * IPC: transaction:getHistory
   */
  ipcMain.handle(
    'transaction:getHistory',
    async (
      _event,
      options: TransactionListOptions
    ) => {
      try {
        const result = await TransactionService.getList(options);
        return { success: true, ...result };
      } catch (error) {
        logger.error('Error in transaction:getHistory handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

}

