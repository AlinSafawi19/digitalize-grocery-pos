import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { Prisma } from '@prisma/client';

export interface AuditLogInput {
  userId: number;
  action: string;
  entity: string;
  entityId?: number | null;
  details?: string | null;
}

/**
 * Audit Log Service
 * Handles audit logging for user actions
 */
export class AuditLogService {
  /**
   * Log an audit event
   * PERFORMANCE FIX: Executes asynchronously in background to avoid blocking operations
   * Returns immediately (resolves promise immediately), actual logging happens in background
   * Can be called with or without await - both work the same (non-blocking)
   */
  static log(input: AuditLogInput): Promise<void> {
    // Return immediately resolved promise (non-blocking)
    // Execute actual logging in background
    Promise.resolve().then(async () => {
      try {
        const prisma = databaseService.getClient();

        await prisma.auditLog.create({
          data: {
            userId: input.userId,
            action: input.action,
            entity: input.entity,
            entityId: input.entityId || null,
            details: input.details || null,
          },
        });
      } catch (error) {
        // Don't throw error for audit logging failures
        // Just log to console/logger
        logger.error('Error creating audit log', error);
      }
    }).catch((error) => {
      // Catch any errors in the promise chain
      logger.error('Error in audit log promise chain', error);
    });

    // Return immediately resolved promise (non-blocking)
    return Promise.resolve();
  }

  /**
   * Get audit logs with pagination
   */
  static async getLogs(options: {
    page?: number;
    pageSize?: number;
    userId?: number;
    entity?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    logs: Array<{
      id: number;
      userId: number;
      username: string;
      action: string;
      entity: string;
      entityId: number | null;
      details: string | null;
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

      const where: Prisma.AuditLogWhereInput = {};
      if (options.userId) {
        where.userId = options.userId;
      }
      if (options.entity) {
        where.entity = options.entity;
      }
      if (options.action) {
        where.action = options.action;
      }
      if (options.startDate || options.endDate) {
        where.timestamp = {};
        if (options.startDate) {
          where.timestamp.gte = options.startDate;
        }
        if (options.endDate) {
          where.timestamp.lte = options.endDate;
        }
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { timestamp: 'desc' },
          include: {
            user: {
              select: {
                username: true,
              },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      return {
        logs: logs.map((log) => ({
          id: log.id,
          userId: log.userId,
          username: log.user.username,
          action: log.action,
          entity: log.entity,
          entityId: log.entityId,
          details: log.details,
          timestamp: log.timestamp,
        })),
        total,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error('Error getting audit logs', error);
      throw error;
    }
  }
}

