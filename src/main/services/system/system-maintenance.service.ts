import { SystemMaintenance, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';
import fs from 'fs-extra';
import { DATABASE_PATH } from '../../utils/constants';

export interface MaintenanceResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  duration?: number;
  error?: string;
}

export interface DatabaseStats {
  size: number;
  sizeFormatted: string;
  tableCount: number;
  totalRecords: number;
  lastVacuum?: Date;
  lastAnalyze?: Date;
}

export interface MaintenanceOperation {
  type: string;
  name: string;
  description: string;
  estimatedDuration?: string;
}

/**
 * System Maintenance Service
 * Handles database optimization, cleanup, and monitoring
 */
export class SystemMaintenanceService {
  /**
   * Get available maintenance operations
   */
  static getAvailableOperations(): MaintenanceOperation[] {
    return [
      {
        type: 'database_optimization',
        name: 'Database Optimization',
        description: 'Run VACUUM and ANALYZE to optimize database performance and reclaim space',
        estimatedDuration: '1-5 minutes',
      },
      {
        type: 'vacuum',
        name: 'Vacuum Database',
        description: 'Reclaim unused space and optimize database file size',
        estimatedDuration: '1-3 minutes',
      },
      {
        type: 'analyze',
        name: 'Analyze Database',
        description: 'Update query optimizer statistics for better performance',
        estimatedDuration: '30 seconds - 2 minutes',
      },
      {
        type: 'cleanup_old_audit_logs',
        name: 'Cleanup Old Audit Logs',
        description: 'Remove audit logs older than 90 days',
        estimatedDuration: '30 seconds - 2 minutes',
      },
      {
        type: 'cleanup_old_sessions',
        name: 'Cleanup Expired Sessions',
        description: 'Remove expired and inactive sessions',
        estimatedDuration: '10-30 seconds',
      },
      {
        type: 'get_database_stats',
        name: 'Get Database Statistics',
        description: 'View current database size, table counts, and statistics',
        estimatedDuration: '5-10 seconds',
      },
    ];
  }

  /**
   * Get maintenance history
   */
  static async getMaintenanceHistory(options: {
    page?: number;
    pageSize?: number;
    operationType?: string;
  } = {}): Promise<{
    operations: SystemMaintenance[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const { page = 1, pageSize = 20, operationType } = options;
      const skip = (page - 1) * pageSize;

      const where: Prisma.SystemMaintenanceWhereInput = {};
      if (operationType) {
        where.operationType = operationType;
      }

      const [operations, total] = await Promise.all([
        prisma.systemMaintenance.findMany({
          where,
          orderBy: { startedAt: 'desc' },
          skip,
          take: pageSize,
          include: {
            performer: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        }),
        prisma.systemMaintenance.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        operations,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting maintenance history', { options, error });
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  static async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      const prisma = databaseService.getClient();
      
      // Get database file size
      let size = 0;
      let sizeFormatted = '0 B';
      try {
        if (await fs.pathExists(DATABASE_PATH)) {
          const stats = await fs.stat(DATABASE_PATH);
          size = stats.size;
          sizeFormatted = this.formatFileSize(size);
        }
      } catch (error) {
        logger.warn('Error getting database file size', { error });
      }

      // Get table count and total records
      const tables = await prisma.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'
      `;
      const tableCount = tables.length;

      // Get total record count across all tables
      let totalRecords = 0;
      try {
        const recordCounts = await Promise.all(
          tables.map(async (table) => {
            try {
              const result = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
                `SELECT COUNT(*) as count FROM "${table.name}"`
              );
              return result[0]?.count || 0;
            } catch {
              return 0;
            }
          })
        );
        totalRecords = recordCounts.reduce((sum, count) => sum + count, 0);
      } catch (error) {
        logger.warn('Error counting records', { error });
      }

      // Get last maintenance dates
      const lastVacuum = await prisma.systemMaintenance.findFirst({
        where: { operationType: 'vacuum', status: 'completed' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      });

      const lastAnalyze = await prisma.systemMaintenance.findFirst({
        where: { operationType: 'analyze', status: 'completed' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      });

      return {
        size,
        sizeFormatted,
        tableCount,
        totalRecords,
        lastVacuum: lastVacuum?.completedAt || undefined,
        lastAnalyze: lastAnalyze?.completedAt || undefined,
      };
    } catch (error) {
      logger.error('Error getting database statistics', { error });
      throw error;
    }
  }

  /**
   * Run database optimization (VACUUM + ANALYZE)
   */
  static async optimizeDatabase(userId: number): Promise<MaintenanceResult> {
    const startTime = Date.now();
    let maintenanceRecord: SystemMaintenance | null = null;

    try {
      const prisma = databaseService.getClient();

      // Create maintenance record
      maintenanceRecord = await prisma.systemMaintenance.create({
        data: {
          operationType: 'database_optimization',
          status: 'running',
          performedBy: userId,
        },
      });

      // Run VACUUM
      await prisma.$executeRawUnsafe('VACUUM');
      logger.info('Database VACUUM completed');

      // Run ANALYZE
      await prisma.$executeRawUnsafe('ANALYZE');
      logger.info('Database ANALYZE completed');

      const duration = Date.now() - startTime;
      const stats = await this.getDatabaseStats();

      // Update maintenance record
      await prisma.systemMaintenance.update({
        where: { id: maintenanceRecord.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          duration,
          result: JSON.stringify({
            message: 'Database optimization completed successfully',
            stats,
          }),
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'system_maintenance',
        entity: 'database',
        entityId: 0,
        details: JSON.stringify({ operation: 'database_optimization', duration }),
      });

      return {
        success: true,
        message: 'Database optimization completed successfully',
        details: { stats },
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (maintenanceRecord) {
        try {
          const prisma = databaseService.getClient();
          await prisma.systemMaintenance.update({
            where: { id: maintenanceRecord.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              duration,
              error: errorMessage,
            },
          });
        } catch (updateError) {
          logger.error('Error updating maintenance record', { updateError });
        }
      }

      logger.error('Error optimizing database', { error });
      return {
        success: false,
        message: 'Database optimization failed',
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Run VACUUM
   */
  static async vacuumDatabase(userId: number): Promise<MaintenanceResult> {
    const startTime = Date.now();
    let maintenanceRecord: SystemMaintenance | null = null;

    try {
      const prisma = databaseService.getClient();

      maintenanceRecord = await prisma.systemMaintenance.create({
        data: {
          operationType: 'vacuum',
          status: 'running',
          performedBy: userId,
        },
      });

      await prisma.$executeRawUnsafe('VACUUM');
      const duration = Date.now() - startTime;
      const stats = await this.getDatabaseStats();

      await prisma.systemMaintenance.update({
        where: { id: maintenanceRecord.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          duration,
          result: JSON.stringify({ message: 'VACUUM completed', stats }),
        },
      });

      await AuditLogService.log({
        userId,
        action: 'system_maintenance',
        entity: 'database',
        entityId: 0,
        details: JSON.stringify({ operation: 'vacuum', duration }),
      });

      return {
        success: true,
        message: 'Database vacuum completed successfully',
        details: { stats },
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (maintenanceRecord) {
        try {
          const prisma = databaseService.getClient();
          await prisma.systemMaintenance.update({
            where: { id: maintenanceRecord.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              duration,
              error: errorMessage,
            },
          });
        } catch (updateError) {
          logger.error('Error updating maintenance record', { updateError });
        }
      }

      logger.error('Error vacuuming database', { error });
      return {
        success: false,
        message: 'Database vacuum failed',
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Run ANALYZE
   */
  static async analyzeDatabase(userId: number): Promise<MaintenanceResult> {
    const startTime = Date.now();
    let maintenanceRecord: SystemMaintenance | null = null;

    try {
      const prisma = databaseService.getClient();

      maintenanceRecord = await prisma.systemMaintenance.create({
        data: {
          operationType: 'analyze',
          status: 'running',
          performedBy: userId,
        },
      });

      await prisma.$executeRawUnsafe('ANALYZE');
      const duration = Date.now() - startTime;

      await prisma.systemMaintenance.update({
        where: { id: maintenanceRecord.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          duration,
          result: JSON.stringify({ message: 'ANALYZE completed' }),
        },
      });

      await AuditLogService.log({
        userId,
        action: 'system_maintenance',
        entity: 'database',
        entityId: 0,
        details: JSON.stringify({ operation: 'analyze', duration }),
      });

      return {
        success: true,
        message: 'Database analysis completed successfully',
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (maintenanceRecord) {
        try {
          const prisma = databaseService.getClient();
          await prisma.systemMaintenance.update({
            where: { id: maintenanceRecord.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              duration,
              error: errorMessage,
            },
          });
        } catch (updateError) {
          logger.error('Error updating maintenance record', { updateError });
        }
      }

      logger.error('Error analyzing database', { error });
      return {
        success: false,
        message: 'Database analysis failed',
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Cleanup old audit logs
   */
  static async cleanupOldAuditLogs(userId: number, daysToKeep: number = 90): Promise<MaintenanceResult> {
    const startTime = Date.now();
    let maintenanceRecord: SystemMaintenance | null = null;

    try {
      const prisma = databaseService.getClient();

      maintenanceRecord = await prisma.systemMaintenance.create({
        data: {
          operationType: 'cleanup_old_audit_logs',
          status: 'running',
          performedBy: userId,
        },
      });

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      const duration = Date.now() - startTime;
      const deletedCount = result.count;

      await prisma.systemMaintenance.update({
        where: { id: maintenanceRecord.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          duration,
          result: JSON.stringify({
            message: `Deleted ${deletedCount} old audit logs`,
            deletedCount,
            cutoffDate: cutoffDate.toISOString(),
          }),
        },
      });

      await AuditLogService.log({
        userId,
        action: 'system_maintenance',
        entity: 'audit_log',
        entityId: 0,
        details: JSON.stringify({ operation: 'cleanup_old_audit_logs', deletedCount, duration }),
      });

      return {
        success: true,
        message: `Cleaned up ${deletedCount} old audit logs`,
        details: { deletedCount, cutoffDate: cutoffDate.toISOString() },
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (maintenanceRecord) {
        try {
          const prisma = databaseService.getClient();
          await prisma.systemMaintenance.update({
            where: { id: maintenanceRecord.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              duration,
              error: errorMessage,
            },
          });
        } catch (updateError) {
          logger.error('Error updating maintenance record', { updateError });
        }
      }

      logger.error('Error cleaning up old audit logs', { error });
      return {
        success: false,
        message: 'Cleanup of old audit logs failed',
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Cleanup expired sessions
   */
  static async cleanupExpiredSessions(userId: number): Promise<MaintenanceResult> {
    const startTime = Date.now();
    let maintenanceRecord: SystemMaintenance | null = null;

    try {
      const prisma = databaseService.getClient();

      maintenanceRecord = await prisma.systemMaintenance.create({
        data: {
          operationType: 'cleanup_old_sessions',
          status: 'running',
          performedBy: userId,
        },
      });

      const now = new Date();
      const result = await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      const duration = Date.now() - startTime;
      const deletedCount = result.count;

      await prisma.systemMaintenance.update({
        where: { id: maintenanceRecord.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          duration,
          result: JSON.stringify({
            message: `Deleted ${deletedCount} expired sessions`,
            deletedCount,
          }),
        },
      });

      await AuditLogService.log({
        userId,
        action: 'system_maintenance',
        entity: 'session',
        entityId: 0,
        details: JSON.stringify({ operation: 'cleanup_old_sessions', deletedCount, duration }),
      });

      return {
        success: true,
        message: `Cleaned up ${deletedCount} expired sessions`,
        details: { deletedCount },
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (maintenanceRecord) {
        try {
          const prisma = databaseService.getClient();
          await prisma.systemMaintenance.update({
            where: { id: maintenanceRecord.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              duration,
              error: errorMessage,
            },
          });
        } catch (updateError) {
          logger.error('Error updating maintenance record', { updateError });
        }
      }

      logger.error('Error cleaning up expired sessions', { error });
      return {
        success: false,
        message: 'Cleanup of expired sessions failed',
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Format file size
   */
  private static formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

