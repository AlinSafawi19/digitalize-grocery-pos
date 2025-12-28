import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { TransactionLogService } from './transaction-log.service';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { BACKUP_DIR } from '../../utils/constants';

export interface CreateRecoveryPointInput {
  name?: string;
  description?: string;
  timestamp?: Date; // If not provided, uses current time
  createBackup?: boolean; // Whether to create a backup file for this recovery point
  userId?: number;
  isAutomatic?: boolean;
}

export interface RecoveryPoint {
  id: number;
  name: string | null;
  description: string | null;
  timestamp: Date;
  backupPath: string | null;
  checksum: string | null;
  createdBy: number | null;
  isAutomatic: boolean;
  transactionLogId: number | null;
}

/**
 * Recovery Point Service
 * Manages recovery points for point-in-time recovery
 */
export class RecoveryPointService {
  /**
   * Create a recovery point
   */
  static async createRecoveryPoint(input: CreateRecoveryPointInput): Promise<RecoveryPoint> {
    try {
      const prisma = databaseService.getClient();
      const timestamp = input.timestamp || new Date();

      // Get the last transaction log ID at this timestamp
      const logs = await TransactionLogService.getLogsUpTo(timestamp);
      const lastLogId = logs.length > 0 ? logs[logs.length - 1].id : null;

      let backupPath: string | null = null;
      let checksum: string | null = null;

      // Create backup if requested
      if (input.createBackup) {
        const backupResult = await this.createBackupForRecoveryPoint(timestamp);
        backupPath = backupResult.path;
        checksum = backupResult.checksum;
      }

      const recoveryPoint = await prisma.recoveryPoint.create({
        data: {
          name: input.name || null,
          description: input.description || null,
          timestamp,
          backupPath,
          checksum,
          createdBy: input.userId || null,
          isAutomatic: input.isAutomatic || false,
          transactionLogId: lastLogId,
        },
      });

      logger.info('Recovery point created', {
        id: recoveryPoint.id,
        timestamp: recoveryPoint.timestamp.toISOString(),
        hasBackup: !!backupPath,
      });

      return {
        id: recoveryPoint.id,
        name: recoveryPoint.name,
        description: recoveryPoint.description,
        timestamp: recoveryPoint.timestamp,
        backupPath: recoveryPoint.backupPath,
        checksum: recoveryPoint.checksum,
        createdBy: recoveryPoint.createdBy,
        isAutomatic: recoveryPoint.isAutomatic,
        transactionLogId: recoveryPoint.transactionLogId,
      };
    } catch (error) {
      logger.error('Failed to create recovery point', error);
      throw error;
    }
  }

  /**
   * Create a backup file for a recovery point
   */
  private static async createBackupForRecoveryPoint(timestamp: Date): Promise<{
    path: string;
    checksum: string;
  }> {
    try {
      // Get database path
      const dbPath = databaseService.getDatabasePath();
      
      if (!await fs.pathExists(dbPath)) {
        throw new Error('Database file does not exist');
      }

      // Create recovery point backup directory
      const recoveryBackupDir = path.join(BACKUP_DIR, 'recovery-points');
      await fs.ensureDir(recoveryBackupDir);

      // Generate backup filename with timestamp
      const timestampStr = timestamp.toISOString().replace(/[:.]/g, '-');
      const backupFileName = `recovery-point-${timestampStr}.db`;
      const backupPath = path.join(recoveryBackupDir, backupFileName);

      // Copy database file
      await fs.copyFile(dbPath, backupPath);

      // Calculate checksum
      const fileBuffer = await fs.readFile(backupPath);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      logger.info('Recovery point backup created', {
        backupPath,
        checksum: checksum.substring(0, 16) + '...',
      });

      return { path: backupPath, checksum };
    } catch (error) {
      logger.error('Failed to create recovery point backup', error);
      throw error;
    }
  }

  /**
   * Get all recovery points
   */
  static async getRecoveryPoints(options: {
    page?: number;
    pageSize?: number;
    startDate?: Date;
    endDate?: Date;
    isAutomatic?: boolean;
  }): Promise<{
    recoveryPoints: RecoveryPoint[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const where: {
        timestamp?: {
          gte?: Date;
          lte?: Date;
        };
        isAutomatic?: boolean;
      } = {};

      if (options.startDate || options.endDate) {
        where.timestamp = {};
        if (options.startDate) {
          where.timestamp.gte = options.startDate;
        }
        if (options.endDate) {
          where.timestamp.lte = options.endDate;
        }
      }

      if (options.isAutomatic !== undefined) {
        where.isAutomatic = options.isAutomatic;
      }

      const [recoveryPoints, total] = await Promise.all([
        prisma.recoveryPoint.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { timestamp: 'desc' },
        }),
        prisma.recoveryPoint.count({ where }),
      ]);

      return {
        recoveryPoints: recoveryPoints.map((rp) => ({
          id: rp.id,
          name: rp.name,
          description: rp.description,
          timestamp: rp.timestamp,
          backupPath: rp.backupPath,
          checksum: rp.checksum,
          createdBy: rp.createdBy,
          isAutomatic: rp.isAutomatic,
          transactionLogId: rp.transactionLogId,
        })),
        total,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error('Error getting recovery points', error);
      throw error;
    }
  }

  /**
   * Get a recovery point by ID
   */
  static async getRecoveryPointById(id: number): Promise<RecoveryPoint | null> {
    try {
      const prisma = databaseService.getClient();

      const recoveryPoint = await prisma.recoveryPoint.findUnique({
        where: { id },
      });

      if (!recoveryPoint) {
        return null;
      }

      return {
        id: recoveryPoint.id,
        name: recoveryPoint.name,
        description: recoveryPoint.description,
        timestamp: recoveryPoint.timestamp,
        backupPath: recoveryPoint.backupPath,
        checksum: recoveryPoint.checksum,
        createdBy: recoveryPoint.createdBy,
        isAutomatic: recoveryPoint.isAutomatic,
        transactionLogId: recoveryPoint.transactionLogId,
      };
    } catch (error) {
      logger.error('Error getting recovery point by ID', error);
      throw error;
    }
  }

  /**
   * Delete a recovery point
   */
  static async deleteRecoveryPoint(id: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      // Get recovery point to check for backup file
      const recoveryPoint = await prisma.recoveryPoint.findUnique({
        where: { id },
      });

      if (!recoveryPoint) {
        throw new Error('Recovery point not found');
      }

      // Delete backup file if it exists
      if (recoveryPoint.backupPath && await fs.pathExists(recoveryPoint.backupPath)) {
        await fs.remove(recoveryPoint.backupPath);
        logger.info('Deleted recovery point backup file', {
          backupPath: recoveryPoint.backupPath,
        });
      }

      // Delete recovery point record
      await prisma.recoveryPoint.delete({
        where: { id },
      });

      logger.info('Recovery point deleted', { id });
    } catch (error) {
      logger.error('Error deleting recovery point', error);
      throw error;
    }
  }

  /**
   * Verify backup file integrity
   */
  static async verifyBackupIntegrity(recoveryPointId: number): Promise<{
    valid: boolean;
    message: string;
  }> {
    try {
      const recoveryPoint = await this.getRecoveryPointById(recoveryPointId);

      if (!recoveryPoint) {
        return {
          valid: false,
          message: 'Recovery point not found',
        };
      }

      if (!recoveryPoint.backupPath || !recoveryPoint.checksum) {
        return {
          valid: false,
          message: 'Recovery point does not have a backup file',
        };
      }

      // Check if backup file exists
      if (!await fs.pathExists(recoveryPoint.backupPath)) {
        return {
          valid: false,
          message: 'Backup file does not exist',
        };
      }

      // Calculate current checksum
      const fileBuffer = await fs.readFile(recoveryPoint.backupPath);
      const currentChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Compare checksums
      if (currentChecksum !== recoveryPoint.checksum) {
        return {
          valid: false,
          message: 'Backup file checksum mismatch - file may be corrupted',
        };
      }

      return {
        valid: true,
        message: 'Backup file integrity verified',
      };
    } catch (error) {
      logger.error('Error verifying backup integrity', error);
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Failed to verify backup integrity',
      };
    }
  }
}

