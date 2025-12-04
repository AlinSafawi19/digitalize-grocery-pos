import { databaseService } from '../database/database.service';
import { logger } from '../../utils/logger';
import { QueuedOperation } from '@prisma/client';

export type OperationType = 'incrementUserCount' | 'decrementUserCount' | 'syncUserCount';

export interface QueuedOperationData {
  userId?: number;
  actualUserCount?: number;
  [key: string]: unknown;
}

/**
 * Operation Queue Service
 * Handles queuing and processing of operations that need to sync with license server
 * Supports offline operations with automatic retry
 */
export class OperationQueueService {
  private static readonly MAX_RETRIES = 5;
  private static readonly RETRY_DELAY_MS = 5000; // 5 seconds
  private static processingQueue = false;

  /**
   * Queue an operation for later sync
   */
  static async queueOperation(
    type: OperationType,
    data: QueuedOperationData
  ): Promise<number> {
    try {
      const prisma = databaseService.getClient();

      // Check if similar operation already exists (prevent duplicates)
      const existing = await prisma.queuedOperation.findFirst({
        where: {
          type,
          status: {
            in: ['pending', 'processing'],
          },
        },
      });

      // Check if data matches (simple check for userId)
      if (existing && data.userId) {
        try {
          const existingData = JSON.parse(existing.data) as QueuedOperationData;
          if (existingData.userId === data.userId) {
            logger.info('Similar operation already queued, skipping', {
              type,
              existingId: existing.id,
            });
            return existing.id;
          }
        } catch {
          // If parsing fails, continue with new operation
        }
      }

      const operation = await prisma.queuedOperation.create({
        data: {
          type,
          data: JSON.stringify(data),
          status: 'pending',
          retryCount: 0,
        },
      });

      logger.info('Operation queued', {
        id: operation.id,
        type,
        data,
      });

      // Trigger queue processing (non-blocking)
      this.processQueue().catch((error) => {
        logger.error('Error processing queue after queueing', error);
      });

      return operation.id;
    } catch (error) {
      logger.error('Error queueing operation', { type, data, error });
      throw error;
    }
  }

  /**
   * Process all pending operations in the queue
   */
  static async processQueue(): Promise<void> {
    if (this.processingQueue) {
      logger.debug('Queue processing already in progress, skipping');
      return;
    }

    this.processingQueue = true;

    try {
      const prisma = databaseService.getClient();

      // Get all pending operations
      const operations = await prisma.queuedOperation.findMany({
        where: {
          status: 'pending',
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 10,
      });

      if (operations.length === 0) {
        logger.debug('No pending operations to process');
        return;
      }

      logger.info(`Processing ${operations.length} queued operations`);

      for (const operation of operations) {
        try {
          // Mark as processing
          await prisma.queuedOperation.update({
            where: { id: operation.id },
            data: { status: 'processing' },
          });

          // Process the operation
          const success = await this.executeOperation(operation);

          if (success) {
            // Mark as completed
            await prisma.queuedOperation.update({
              where: { id: operation.id },
              data: { status: 'completed' },
            });
            logger.info('Operation completed', { id: operation.id, type: operation.type });
          } else {
            // Increment retry count
            const newRetryCount = operation.retryCount + 1;

            if (newRetryCount >= this.MAX_RETRIES) {
              // Mark as failed after max retries
              await prisma.queuedOperation.update({
                where: { id: operation.id },
                data: {
                  status: 'failed',
                  retryCount: newRetryCount,
                },
              });
              logger.warn('Operation failed after max retries', {
                id: operation.id,
                type: operation.type,
                retryCount: newRetryCount,
              });
            } else {
              // Reset to pending for retry
              await prisma.queuedOperation.update({
                where: { id: operation.id },
                data: {
                  status: 'pending',
                  retryCount: newRetryCount,
                },
              });
              logger.info('Operation will be retried', {
                id: operation.id,
                type: operation.type,
                retryCount: newRetryCount,
              });
            }
          }
        } catch (error) {
          logger.error('Error processing operation', {
            id: operation.id,
            type: operation.type,
            error,
          });

          // Mark as failed
          const errorMessage = error instanceof Error ? error.message : String(error);
          await prisma.queuedOperation.update({
            where: { id: operation.id },
            data: {
              status: 'failed',
              error: errorMessage,
            },
          }).catch(() => {
            // Ignore update errors
          });
        }

        // Small delay between operations
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      logger.error('Error processing queue', error);
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Execute a queued operation
   */
  private static async executeOperation(operation: QueuedOperation): Promise<boolean> {
    try {
      const { licenseService } = await import('../license/license.service');

      switch (operation.type as OperationType) {
        case 'incrementUserCount': {
          const incrementResult = await licenseService.incrementUserCount();
          return incrementResult.success;
        }

        case 'decrementUserCount': {
          const decrementResult = await licenseService.decrementUserCount();
          return decrementResult.success;
        }

        case 'syncUserCount': {
          const syncResult = await licenseService.syncUserCount();
          return syncResult.success;
        }

        default:
          logger.warn('Unknown operation type', { type: operation.type });
          return false;
      }
    } catch (error) {
      logger.error('Error executing operation', {
        type: operation.type,
        error,
      });
      return false;
    }
  }

  /**
   * Get pending operations count
   */
  static async getPendingCount(): Promise<number> {
    try {
      const prisma = databaseService.getClient();
      return await prisma.queuedOperation.count({
        where: {
          status: 'pending',
        },
      });
    } catch (error) {
      logger.error('Error getting pending operations count', error);
      return 0;
    }
  }

  /**
   * Get all pending operations
   */
  static async getPendingOperations(): Promise<QueuedOperation[]> {
    try {
      const prisma = databaseService.getClient();
      return await prisma.queuedOperation.findMany({
        where: {
          status: 'pending',
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    } catch (error) {
      logger.error('Error getting pending operations', error);
      return [];
    }
  }

  /**
   * Clear completed operations older than specified days
   */
  static async clearOldOperations(daysOld: number = 7): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      await prisma.queuedOperation.deleteMany({
        where: {
          status: {
            in: ['completed', 'failed'],
          },
          updatedAt: {
            lt: cutoffDate,
          },
        },
      });

      logger.info('Cleared old operations', { daysOld });
    } catch (error) {
      logger.error('Error clearing old operations', error);
    }
  }

  /**
   * Start periodic queue processing
   */
  static startPeriodicProcessing(intervalMs: number = 60000): void {
    // Process queue immediately
    this.processQueue().catch((error) => {
      logger.error('Error in initial queue processing', error);
    });

    // Then process periodically
    setInterval(() => {
      this.processQueue().catch((error) => {
        logger.error('Error in periodic queue processing', error);
      });
    }, intervalMs);

    logger.info('Periodic queue processing started', { intervalMs });
  }
}

