import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { Prisma } from '@prisma/client';

export interface TransactionLogEntry {
  tableName: string;
  recordId?: number | null;
  operation: 'create' | 'update' | 'delete';
  userId?: number | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  recoveryPointId?: number | null;
}

/**
 * Transaction Log Service
 * Records all database changes for point-in-time recovery
 */
export class TransactionLogService {
  /**
   * Log a database operation
   */
  static async log(entry: TransactionLogEntry): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      await prisma.transactionLog.create({
        data: {
          tableName: entry.tableName,
          recordId: entry.recordId || null,
          operation: entry.operation,
          userId: entry.userId || null,
          oldData: entry.oldData ? JSON.stringify(entry.oldData) : null,
          newData: entry.newData ? JSON.stringify(entry.newData) : null,
          recoveryPointId: entry.recoveryPointId || null,
        },
      });
    } catch (error) {
      // Don't throw - transaction logging failures shouldn't break operations
      logger.error('Failed to log transaction', {
        error: error instanceof Error ? error.message : String(error),
        entry,
      });
    }
  }

  /**
   * Log multiple operations in a batch
   */
  static async logBatch(entries: TransactionLogEntry[]): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      await prisma.transactionLog.createMany({
        data: entries.map((entry) => ({
          tableName: entry.tableName,
          recordId: entry.recordId || null,
          operation: entry.operation,
          userId: entry.userId || null,
          oldData: entry.oldData ? JSON.stringify(entry.oldData) : null,
          newData: entry.newData ? JSON.stringify(entry.newData) : null,
          recoveryPointId: entry.recoveryPointId || null,
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      logger.error('Failed to log batch transactions', {
        error: error instanceof Error ? error.message : String(error),
        entryCount: entries.length,
      });
    }
  }

  /**
   * Get transaction logs for a specific time range
   */
  static async getLogs(options: {
    startDate?: Date;
    endDate?: Date;
    tableName?: string;
    operation?: 'create' | 'update' | 'delete';
    userId?: number;
    page?: number;
    pageSize?: number;
  }): Promise<{
    logs: Array<{
      id: number;
      tableName: string;
      recordId: number | null;
      operation: string;
      userId: number | null;
      oldData: Record<string, unknown> | null;
      newData: Record<string, unknown> | null;
      timestamp: Date;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const where: Prisma.TransactionLogWhereInput = {};

      if (options.startDate || options.endDate) {
        where.timestamp = {};
        if (options.startDate) {
          where.timestamp.gte = options.startDate;
        }
        if (options.endDate) {
          where.timestamp.lte = options.endDate;
        }
      }

      if (options.tableName) {
        where.tableName = options.tableName;
      }

      if (options.operation) {
        where.operation = options.operation;
      }

      if (options.userId) {
        where.userId = options.userId;
      }

      const [logs, total] = await Promise.all([
        prisma.transactionLog.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { timestamp: 'desc' },
        }),
        prisma.transactionLog.count({ where }),
      ]);

      return {
        logs: logs.map((log) => ({
          id: log.id,
          tableName: log.tableName,
          recordId: log.recordId,
          operation: log.operation,
          userId: log.userId,
          oldData: log.oldData ? JSON.parse(log.oldData) : null,
          newData: log.newData ? JSON.parse(log.newData) : null,
          timestamp: log.timestamp,
        })),
        total,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error('Error getting transaction logs', error);
      throw error;
    }
  }

  /**
   * Get transaction logs up to a specific point in time
   * Used for point-in-time recovery
   */
  static async getLogsUpTo(timestamp: Date): Promise<Array<{
    id: number;
    tableName: string;
    recordId: number | null;
    operation: string;
    oldData: Record<string, unknown> | null;
    newData: Record<string, unknown> | null;
    timestamp: Date;
  }>> {
    try {
      const prisma = databaseService.getClient();

      const logs = await prisma.transactionLog.findMany({
        where: {
          timestamp: {
            lte: timestamp,
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      return logs.map((log) => ({
        id: log.id,
        tableName: log.tableName,
        recordId: log.recordId,
        operation: log.operation,
        oldData: log.oldData ? JSON.parse(log.oldData) : null,
        newData: log.newData ? JSON.parse(log.newData) : null,
        timestamp: log.timestamp,
      }));
    } catch (error) {
      logger.error('Error getting transaction logs up to timestamp', error);
      throw error;
    }
  }

  /**
   * Clean up old transaction logs (keep only last N days)
   */
  static async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const prisma = databaseService.getClient();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.transactionLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
          recoveryPointId: null, // Don't delete logs that are part of recovery points
        },
      });

      logger.info('Cleaned up old transaction logs', {
        deletedCount: result.count,
        cutoffDate: cutoffDate.toISOString(),
      });

      return result.count;
    } catch (error) {
      logger.error('Error cleaning up old transaction logs', error);
      throw error;
    }
  }
}

