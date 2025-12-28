import { TransactionLogService, TransactionLogEntry } from './transaction-log.service';
import { logger } from '../../utils/logger';

/**
 * Transaction Log Helper
 * Provides utilities for logging database operations
 */
export class TransactionLogHelper {
  /**
   * Wrap a database operation with transaction logging
   * This helper makes it easy to add logging to service methods
   */
  static async withLogging<T>(
    operation: () => Promise<T>,
    logEntry: Omit<TransactionLogEntry, 'oldData' | 'newData'> & {
      getOldData?: () => Promise<Record<string, unknown> | null>;
      getNewData?: (result: T) => Record<string, unknown> | null;
    }
  ): Promise<T> {
    let oldData: Record<string, unknown> | null = null;
    
    // Get old data if operation is update/delete
    if (logEntry.operation === 'update' || logEntry.operation === 'delete') {
      if (logEntry.getOldData) {
        try {
          oldData = await logEntry.getOldData();
        } catch (error) {
          logger.warn('Failed to get old data for transaction log', error);
        }
      }
    }

    // Execute the operation
    const result = await operation();

    // Get new data if operation is create/update
    let newData: Record<string, unknown> | null = null;
    if (logEntry.operation === 'create' || logEntry.operation === 'update') {
      if (logEntry.getNewData) {
        try {
          newData = logEntry.getNewData(result);
        } catch (error) {
          logger.warn('Failed to get new data for transaction log', error);
        }
      }
    }

    // Log the transaction asynchronously (don't block)
    Promise.resolve().then(async () => {
      try {
        await TransactionLogService.log({
          tableName: logEntry.tableName,
          recordId: logEntry.recordId,
          operation: logEntry.operation,
          userId: logEntry.userId,
          oldData,
          newData,
          recoveryPointId: logEntry.recoveryPointId,
        });
      } catch (error) {
        logger.error('Failed to log transaction', error);
      }
    });

    return result;
  }

  /**
   * Log a transaction manually (for operations that can't use withLogging)
   */
  static async log(entry: TransactionLogEntry): Promise<void> {
    await TransactionLogService.log(entry);
  }
}

