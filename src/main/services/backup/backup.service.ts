import { logger } from '../../utils/logger';
import { DATABASE_PATH } from '../../utils/constants';
import fs from 'fs-extra';
import path from 'path';
import { createHash } from 'crypto';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { NotificationService } from '../notifications/notification.service';
import { databaseService } from '../database/database.service';
import { validateExternalDrive } from '../../utils/drive.util';

export interface BackupInfo {
  id: string;
  filename: string;
  filePath: string;
  size: number;
  createdAt: Date;
  checksum: string;
}

export interface BackupListOptions {
  page?: number;
  pageSize?: number;
  startDate?: Date;
  endDate?: Date;
  backupDirectory?: string; // Optional: directory to search for backups (default: empty - backups are on external drives)
}

export interface CreateBackupOptions {
  description?: string;
  destinationPath: string; // REQUIRED: Destination path on external drive (backups must be on external drive)
  // Note: All backups are now always compressed
}

/**
 * Backup Service
 * Handles database backup and restore operations
 */
export class BackupService {
  // Note: Backup directory management removed - all backups now require external drive

  /**
   * Generate backup filename with timestamp
   * All backups are compressed, so extension is always .db.gz
   */
  private static generateBackupFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `digitalizePOS-backup-${timestamp}.db.gz`;
  }

  /**
   * Calculate file checksum (MD5)
   */
  private static async calculateChecksum(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const hashSum = createHash('md5');
      hashSum.update(fileBuffer);
      return hashSum.digest('hex');
    } catch (error) {
      logger.error('Error calculating checksum', error);
      throw error;
    }
  }

  /**
   * Get backup file info
   */
  private static async getBackupInfo(filePath: string): Promise<BackupInfo> {
    try {
      const stats = await fs.stat(filePath);
      const filename = path.basename(filePath);
      const checksum = await this.calculateChecksum(filePath);
      const createdAt = stats.birthtime;

      // Extract timestamp from filename or use file creation time
      // Handle both compressed (.db.gz) and uncompressed (.db) files
      const id = filename.replace(/\.(db\.gz|db)$/, '');

      return {
        id,
        filename,
        filePath,
        size: stats.size,
        createdAt,
        checksum,
      };
    } catch (error) {
      logger.error('Error getting backup info', error);
      throw error;
    }
  }

  /**
   * Create a manual backup
   * 
   * This function creates a complete compressed backup of the entire SQLite database file.
   * The backup includes all tables, data, indexes, and schema - everything in the database.
   * All backups are automatically compressed using gzip to save disk space.
   * 
   * IMPORTANT: All backups MUST be saved to an external drive (USB drive or external hard disk).
   * Backups cannot be saved to the computer's main hard disk.
   * 
   * @param options - Backup options (description, destination path - REQUIRED)
   * @param userId - Optional user ID for notifications
   * @returns BackupInfo with details about the created backup
   */
  static async createBackup(
    options: CreateBackupOptions,
    userId?: number
  ): Promise<BackupInfo> {
    try {
      // Validate that destination path is provided
      if (!options.destinationPath || !options.destinationPath.trim()) {
        throw new Error(
          'Backup destination path is required. ' +
          'Please select a folder on an external drive (USB drive or external hard disk).'
        );
      }

      // Validate that destination is on an external drive
      await validateExternalDrive(options.destinationPath);

      // Check if database file exists
      if (!(await fs.pathExists(DATABASE_PATH))) {
        throw new Error('Database file does not exist');
      }

      const filename = this.generateBackupFilename();
      
      // Use the provided destination path (must be on external drive)
      const backupPath = path.join(options.destinationPath, filename);

      // Ensure destination directory exists (on external drive)
      const destinationDir = options.destinationPath;
      await fs.ensureDir(destinationDir);

      // Backup and compress the entire database file
      // This creates a compressed copy of the complete SQLite database including all tables, data, indexes, and schema
      logger.info('Creating compressed full database backup', { source: DATABASE_PATH, destination: backupPath });
      
      // Compress the database file using gzip
      const readStream = fs.createReadStream(DATABASE_PATH);
      const writeStream = fs.createWriteStream(backupPath);
      const gzipStream = createGzip({ level: 6 }); // Level 6 provides good compression/speed balance
      
      await pipeline(readStream, gzipStream, writeStream);
      
      // Also backup SQLite WAL (Write-Ahead Logging) and SHM (Shared Memory) files if they exist
      // These files contain uncommitted transactions and are part of the complete database state
      const walPath = `${DATABASE_PATH}-wal`;
      const shmPath = `${DATABASE_PATH}-shm`;
      const backupWalPath = `${backupPath}-wal`;
      const backupShmPath = `${backupPath}-shm`;
      
      if (await fs.pathExists(walPath)) {
        logger.info('Backing up WAL file', { source: walPath, destination: backupWalPath });
        const walReadStream = fs.createReadStream(walPath);
        const walWriteStream = fs.createWriteStream(backupWalPath);
        const walGzipStream = createGzip({ level: 6 });
        await pipeline(walReadStream, walGzipStream, walWriteStream);
      }
      
      if (await fs.pathExists(shmPath)) {
        logger.info('Backing up SHM file', { source: shmPath, destination: backupShmPath });
        const shmReadStream = fs.createReadStream(shmPath);
        const shmWriteStream = fs.createWriteStream(backupShmPath);
        const shmGzipStream = createGzip({ level: 6 });
        await pipeline(shmReadStream, shmGzipStream, shmWriteStream);
      }

      const backupInfo = await this.getBackupInfo(backupPath);

      logger.info('Compressed backup created successfully', {
        filename: backupInfo.filename,
        size: backupInfo.size,
        checksum: backupInfo.checksum,
        originalSize: (await fs.stat(DATABASE_PATH)).size,
        compressionRatio: ((1 - backupInfo.size / (await fs.stat(DATABASE_PATH)).size) * 100).toFixed(1) + '%',
      });

      // Create notification
      if (userId) {
        await NotificationService.createBackupCompletionNotification(backupPath, userId);
      }

      return backupInfo;
    } catch (error) {
      logger.error('Error creating backup', error);

      // Create error notification
      if (userId) {
        await NotificationService.createBackupFailedNotification(
          error instanceof Error ? error.message : 'Unknown error',
          userId
        );
      }

      throw error;
    }
  }

  /**
   * Get list of backups
   * NOTE: Backups are now stored on external drives. Provide backupDirectory to search a specific location.
   */
  static async getBackups(
    options: BackupListOptions = {}
  ): Promise<{
    backups: BackupInfo[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const backupDirectory = options.backupDirectory;

      // If no backup directory provided, return empty (backups are on external drives)
      if (!backupDirectory) {
        logger.info('No backup directory provided - backups are stored on external drives');
        return {
          backups: [],
          total: 0,
          page,
          pageSize,
        };
      }

      // Ensure directory exists
      if (!(await fs.pathExists(backupDirectory))) {
        logger.warn('Backup directory does not exist', { backupDirectory });
        return {
          backups: [],
          total: 0,
          page,
          pageSize,
        };
      }

      // Read all files in backup directory
      // Support both compressed (.db.gz) and uncompressed (.db) for backward compatibility
      const files = await fs.readdir(backupDirectory);
      const backupFiles = files.filter((file) => 
        file.startsWith('digitalizePOS-backup-') && (file.endsWith('.db.gz') || file.endsWith('.db'))
      );

      // Get backup info for each file
      const backups: BackupInfo[] = [];
      for (const file of backupFiles) {
        try {
          const filePath = path.join(backupDirectory, file);
          const backupInfo = await this.getBackupInfo(filePath);

          // Apply date filters
          if (options.startDate && backupInfo.createdAt < options.startDate) {
            continue;
          }
          if (options.endDate && backupInfo.createdAt > options.endDate) {
            continue;
          }

          backups.push(backupInfo);
        } catch (error) {
          logger.warn(`Error reading backup file: ${file}`, error);
          // Continue with other files
        }
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Apply pagination
      const skip = (page - 1) * pageSize;
      const paginatedBackups = backups.slice(skip, skip + pageSize);

      return {
        backups: paginatedBackups,
        total: backups.length,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error('Error getting backups', error);
      throw error;
    }
  }

  /**
   * Get backup by ID
   * Supports both compressed (.db.gz) and uncompressed (.db) backups
   * NOTE: Backups are now stored on external drives. Provide backupDirectory to search a specific location.
   */
  static async getBackupById(id: string, backupDirectory?: string): Promise<BackupInfo | null> {
    try {
      // If no backup directory provided, return null (backups are on external drives)
      if (!backupDirectory) {
        logger.info('No backup directory provided - backups are stored on external drives');
        return null;
      }

      if (!(await fs.pathExists(backupDirectory))) {
        return null;
      }

      const files = await fs.readdir(backupDirectory);
      // Try compressed first, then uncompressed for backward compatibility
      const backupFile = files.find((file) => 
        file.startsWith(`digitalizePOS-backup-${id}`) && (file.endsWith('.db.gz') || file.endsWith('.db'))
      );

      if (!backupFile) {
        return null;
      }

      const filePath = path.join(backupDirectory, backupFile);
      return await this.getBackupInfo(filePath);
    } catch (error) {
      logger.error('Error getting backup by ID', error);
      throw error;
    }
  }

  /**
   * Verify backup integrity
   * Handles both compressed (.db.gz) and uncompressed (.db) backups
   */
  static async verifyBackup(backupPath: string): Promise<{
    valid: boolean;
    checksum: string;
    size: number;
  }> {
    try {
      if (!(await fs.pathExists(backupPath))) {
        return {
          valid: false,
          checksum: '',
          size: 0,
        };
      }

      const stats = await fs.stat(backupPath);
      const checksum = await this.calculateChecksum(backupPath);

      // Check if file is compressed
      const isCompressed = backupPath.endsWith('.gz');
      
      let isValid = false;
      
      if (isCompressed) {
        // For compressed files, decompress to a temporary location and check SQLite header
        try {
          const tempPath = `${backupPath}.temp`;
          const readStream = fs.createReadStream(backupPath);
          const writeStream = fs.createWriteStream(tempPath);
          const gunzipStream = createGunzip();
          
          await pipeline(readStream, gunzipStream, writeStream);
          
          // Read first 16 bytes to check SQLite header
          const fileBuffer = await fs.readFile(tempPath);
          const sqliteHeader = fileBuffer.slice(0, 16).toString('utf8');
          isValid = sqliteHeader.startsWith('SQLite format 3');
          
          // Clean up temporary file
          await fs.remove(tempPath);
        } catch (error) {
          logger.warn('Error decompressing backup for verification', error);
          isValid = false;
        }
      } else {
        // For uncompressed files, check SQLite header directly
        const fileBuffer = await fs.readFile(backupPath);
        const sqliteHeader = fileBuffer.slice(0, 16).toString('utf8');
        isValid = sqliteHeader.startsWith('SQLite format 3');
      }

      return {
        valid: isValid,
        checksum,
        size: stats.size,
      };
    } catch (error) {
      logger.error('Error verifying backup', error);
      return {
        valid: false,
        checksum: '',
        size: 0,
      };
    }
  }

  /**
   * Restore database from backup
   * 
   * This function restores the entire SQLite database from a backup file.
   * It completely replaces the current database with the backup, including all tables,
   * data, indexes, and schema. The current database is backed up before restoration.
   * 
   * IMPORTANT: This operation replaces the entire database. All current data will be
   * replaced with the data from the backup file. The application should be restarted
   * after restore to ensure the database connection is properly reinitialized.
   * 
   * @param backupPath - Path to the backup file to restore from
   * @param userId - Optional user ID for notifications
   */
  static async restoreBackup(backupPath: string, userId?: number): Promise<void> {
    try {
      // Verify backup first
      const verification = await this.verifyBackup(backupPath);
      if (!verification.valid) {
        throw new Error('Backup file is invalid or corrupted');
      }

      // Skip pre-restore backup since all backups now require external drive
      // The user should have already created a backup before attempting restore
      logger.info('Skipping pre-restore backup (all backups require external drive). User should have backup before restore.');

      // Close database connection to ensure no file locks
      logger.info('Closing database connection before restore');
      await databaseService.disconnect();

      // Wait a brief moment to ensure file handles are released
      await new Promise(resolve => setTimeout(resolve, 100));

      // Remove existing database files (main, WAL, SHM) to ensure clean restore
      if (await fs.pathExists(DATABASE_PATH)) {
        await fs.remove(DATABASE_PATH);
      }
      const walPath = `${DATABASE_PATH}-wal`;
      const shmPath = `${DATABASE_PATH}-shm`;
      if (await fs.pathExists(walPath)) {
        await fs.remove(walPath);
      }
      if (await fs.pathExists(shmPath)) {
        await fs.remove(shmPath);
      }

      // Restore the entire database file
      // This completely replaces the current database with the backup
      // Handle both compressed (.db.gz) and uncompressed (.db) backups
      const isCompressed = backupPath.endsWith('.gz');
      
      if (isCompressed) {
        logger.info('Decompressing and restoring database from compressed backup', { backupPath, destination: DATABASE_PATH });
        // Decompress the backup file
        const readStream = fs.createReadStream(backupPath);
        const writeStream = fs.createWriteStream(DATABASE_PATH);
        const gunzipStream = createGunzip();
        
        await pipeline(readStream, gunzipStream, writeStream);
      } else {
        logger.info('Restoring database from uncompressed backup', { backupPath, destination: DATABASE_PATH });
        // Copy uncompressed backup directly
        await fs.copyFile(backupPath, DATABASE_PATH);
      }
      
      // Restore WAL and SHM files if they exist in the backup
      // Check for both compressed and uncompressed versions
      const backupWalPath = `${backupPath}-wal`;
      const backupWalPathGz = `${backupPath}-wal.gz`;
      const backupShmPath = `${backupPath}-shm`;
      const backupShmPathGz = `${backupPath}-shm.gz`;
      
      // Restore WAL file (compressed or uncompressed)
      if (await fs.pathExists(backupWalPathGz)) {
        logger.info('Decompressing and restoring WAL file', { source: backupWalPathGz, destination: walPath });
        const walReadStream = fs.createReadStream(backupWalPathGz);
        const walWriteStream = fs.createWriteStream(walPath);
        const walGunzipStream = createGunzip();
        await pipeline(walReadStream, walGunzipStream, walWriteStream);
      } else if (await fs.pathExists(backupWalPath)) {
        logger.info('Restoring WAL file', { source: backupWalPath, destination: walPath });
        await fs.copyFile(backupWalPath, walPath);
      }
      
      // Restore SHM file (compressed or uncompressed)
      if (await fs.pathExists(backupShmPathGz)) {
        logger.info('Decompressing and restoring SHM file', { source: backupShmPathGz, destination: shmPath });
        const shmReadStream = fs.createReadStream(backupShmPathGz);
        const shmWriteStream = fs.createWriteStream(shmPath);
        const shmGunzipStream = createGunzip();
        await pipeline(shmReadStream, shmGunzipStream, shmWriteStream);
      } else if (await fs.pathExists(backupShmPath)) {
        logger.info('Restoring SHM file', { source: backupShmPath, destination: shmPath });
        await fs.copyFile(backupShmPath, shmPath);
      }

      // Reinitialize database connection with restored database
      logger.info('Reinitializing database connection with restored database');
      await databaseService.initialize();

      logger.info('Complete database restored successfully', { backupPath });

      // Create notification
      if (userId) {
        await NotificationService.createNotification({
          type: 'backup_completion',
          title: 'Database Restored',
          message: `Database has been restored from backup: ${path.basename(backupPath)}`,
          userId,
          priority: 'high',
        });
      }
    } catch (error) {
      logger.error('Error restoring backup', error);

      // Create error notification
      if (userId) {
        await NotificationService.createBackupFailedNotification(
          error instanceof Error ? error.message : 'Unknown error',
          userId
        );
      }

      throw error;
    }
  }

  /**
   * Delete backup
   */
  static async deleteBackup(backupPath: string): Promise<void> {
    try {
      if (!(await fs.pathExists(backupPath))) {
        throw new Error('Backup file does not exist');
      }

      await fs.remove(backupPath);

      logger.info('Backup deleted', { backupPath });
    } catch (error) {
      logger.error('Error deleting backup', error);
      throw error;
    }
  }

  /**
   * Delete old backups (retention policy)
   * NOTE: Backups are now stored on external drives. Provide backupDirectory to search a specific location.
   */
  static async deleteOldBackups(daysToKeep: number = 30, backupDirectory?: string): Promise<{ count: number }> {
    try {
      // If no backup directory provided, return 0 (backups are on external drives)
      if (!backupDirectory) {
        logger.info('No backup directory provided - backups are stored on external drives');
        return { count: 0 };
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.getBackups({ page: 1, pageSize: 1000, backupDirectory });
      let deletedCount = 0;

      for (const backup of result.backups) {
        if (backup.createdAt < cutoffDate) {
          try {
            await this.deleteBackup(backup.filePath);
            deletedCount++;
          } catch (error) {
            logger.warn(`Error deleting old backup: ${backup.filename}`, error);
          }
        }
      }

      logger.info('Old backups deleted', { count: deletedCount, daysToKeep, backupDirectory });

      return { count: deletedCount };
    } catch (error) {
      logger.error('Error deleting old backups', error);
      throw error;
    }
  }

  /**
   * Get backup statistics
   * NOTE: Backups are now stored on external drives. Provide backupDirectory to search a specific location.
   */
  static async getBackupStats(backupDirectory?: string): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  }> {
    try {
      // If no backup directory provided, return empty stats (backups are on external drives)
      if (!backupDirectory) {
        logger.info('No backup directory provided - backups are stored on external drives');
        return {
          totalBackups: 0,
          totalSize: 0,
          oldestBackup: null,
          newestBackup: null,
        };
      }

      const result = await this.getBackups({ page: 1, pageSize: 1000, backupDirectory });

      let totalSize = 0;
      let oldestDate: Date | null = null;
      let newestDate: Date | null = null;

      for (const backup of result.backups) {
        totalSize += backup.size;

        if (!oldestDate || backup.createdAt < oldestDate) {
          oldestDate = backup.createdAt;
        }
        if (!newestDate || backup.createdAt > newestDate) {
          newestDate = backup.createdAt;
        }
      }

      return {
        totalBackups: result.total,
        totalSize,
        oldestBackup: oldestDate,
        newestBackup: newestDate,
      };
    } catch (error) {
      logger.error('Error getting backup stats', error);
      throw error;
    }
  }
}

