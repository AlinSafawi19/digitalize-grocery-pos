import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { Prisma } from '@prisma/client';
import { validateExternalDrive } from '../../utils/drive.util';
import fs from 'fs-extra';
import path from 'path';

export type BackupLocationType = 'external_drive' | 'local' | 'network' | 'cloud';

export interface BackupLocationConfig {
  // For external_drive: { driveLetter: string }
  // For local: { basePath: string }
  // For network: { host: string, share: string, username?: string, password?: string }
  // For cloud: { provider: string, credentials: any }
  [key: string]: unknown;
}

export interface CreateBackupLocationInput {
  name: string;
  type: BackupLocationType;
  path: string;
  config?: BackupLocationConfig;
  isActive?: boolean;
  priority?: number;
  maxBackups?: number;
  createdBy: number;
}

export interface UpdateBackupLocationInput {
  name?: string;
  type?: BackupLocationType;
  path?: string;
  config?: BackupLocationConfig;
  isActive?: boolean;
  priority?: number;
  maxBackups?: number;
}

export interface BackupLocation {
  id: number;
  name: string;
  type: BackupLocationType;
  path: string;
  config: string | null;
  isActive: boolean;
  priority: number;
  maxBackups: number | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number;
  creator?: {
    id: number;
    username: string;
  } | null;
}

/**
 * Backup Location Service
 * Handles backup location management and validation
 */
export class BackupLocationService {
  /**
   * Validate a backup location based on its type
   */
  static async validateLocation(
    type: BackupLocationType,
    locationPath: string,
    config?: BackupLocationConfig
  ): Promise<{ valid: boolean; error?: string; message?: string }> {
    try {
      switch (type) {
        case 'external_drive':
          // Validate external drive
          try {
            await validateExternalDrive(locationPath);
            // Check if path exists and is writable
            await fs.ensureDir(locationPath);
            const testFile = path.join(locationPath, '.backup-test');
            await fs.writeFile(testFile, 'test');
            await fs.remove(testFile);
            return { valid: true, message: 'External drive is valid and writable' };
          } catch (error) {
            return {
              valid: false,
              error: error instanceof Error && error.message.includes('external drive') ? 'INVALID_DRIVE' : 'PATH_NOT_WRITABLE',
              message: error instanceof Error ? error.message : `Path ${locationPath} is not valid or writable`,
            };
          }

        case 'local':
          // Validate local path
          try {
            await fs.ensureDir(locationPath);
            const testFile = path.join(locationPath, '.backup-test');
            await fs.writeFile(testFile, 'test');
            await fs.remove(testFile);
          } catch (error) {
            return {
              valid: false,
              error: 'PATH_NOT_WRITABLE',
              message: `Local path ${locationPath} is not writable`,
            };
          }
          return { valid: true, message: 'Local path is valid and writable' };

        case 'network':
          // Network path validation (basic check)
          if (!locationPath.startsWith('\\\\')) {
            return {
              valid: false,
              error: 'INVALID_NETWORK_PATH',
              message: 'Network path must start with \\\\',
            };
          }
          // Note: Full network validation would require testing connection
          return { valid: true, message: 'Network path format is valid' };

        case 'cloud':
          // Cloud validation would require provider-specific checks
          // For now, just validate that config is provided
          if (!config || !config.provider) {
            return {
              valid: false,
              error: 'MISSING_CLOUD_CONFIG',
              message: 'Cloud location requires provider configuration',
            };
          }
          return { valid: true, message: 'Cloud configuration is valid' };

        default:
          return {
            valid: false,
            error: 'UNKNOWN_TYPE',
            message: `Unknown location type: ${type}`,
          };
      }
    } catch (error) {
      logger.error('Error validating backup location', error);
      return {
        valid: false,
        error: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Create a new backup location
   */
  static async createLocation(input: CreateBackupLocationInput): Promise<BackupLocation> {
    try {
      const prisma = databaseService.getClient();

      // Validate location before creating
      const validation = await this.validateLocation(input.type, input.path, input.config);
      if (!validation.valid) {
        throw new Error(validation.message || 'Location validation failed');
      }

      const location = await prisma.backupLocation.create({
        data: {
          name: input.name,
          type: input.type,
          path: input.path,
          config: input.config ? JSON.stringify(input.config) : null,
          isActive: input.isActive ?? true,
          priority: input.priority ?? 0,
          maxBackups: input.maxBackups ?? null,
          createdBy: input.createdBy,
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      logger.info(`Backup location created: ${location.name} (ID: ${location.id})`);
      return this.mapToLocation(location);
    } catch (error) {
      logger.error('Error creating backup location', error);
      throw error;
    }
  }

  /**
   * Get location by ID
   */
  static async getLocationById(id: number): Promise<BackupLocation | null> {
    try {
      const prisma = databaseService.getClient();

      const location = await prisma.backupLocation.findUnique({
        where: { id },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return location ? this.mapToLocation(location) : null;
    } catch (error) {
      logger.error(`Error getting backup location ${id}`, error);
      throw error;
    }
  }

  /**
   * Get all locations
   */
  static async getLocations(options?: {
    isActive?: boolean;
    type?: BackupLocationType;
    page?: number;
    pageSize?: number;
  }): Promise<{
    locations: BackupLocation[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }> {
    try {
      const prisma = databaseService.getClient();
      const page = options?.page || 1;
      const pageSize = options?.pageSize || 50;

      const where: Prisma.BackupLocationWhereInput = {};

      if (options?.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (options?.type) {
        where.type = options.type;
      }

      const [locations, total] = await Promise.all([
        prisma.backupLocation.findMany({
          where,
          include: {
            creator: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: [
            { priority: 'asc' },
            { createdAt: 'desc' },
          ],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.backupLocation.count({ where }),
      ]);

      return {
        locations: locations.map((l: any) => this.mapToLocation(l)),
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      logger.error('Error getting backup locations', error);
      throw error;
    }
  }

  /**
   * Update location
   */
  static async updateLocation(
    id: number,
    input: UpdateBackupLocationInput
  ): Promise<BackupLocation> {
    try {
      const prisma = databaseService.getClient();

      // If type or path is being updated, validate
      if (input.type || input.path) {
        const current = await prisma.backupLocation.findUnique({ where: { id } });
        if (!current) {
          throw new Error('Location not found');
        }

        const type = input.type || (current.type as BackupLocationType);
        const path = input.path || current.path;
        const config = input.config || (current.config ? JSON.parse(current.config) : undefined);

        const validation = await this.validateLocation(type, path, config);
        if (!validation.valid) {
          throw new Error(validation.message || 'Location validation failed');
        }
      }

      const updateData: Prisma.BackupLocationUpdateInput = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.type !== undefined) updateData.type = input.type;
      if (input.path !== undefined) updateData.path = input.path;
      if (input.config !== undefined) updateData.config = JSON.stringify(input.config);
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.maxBackups !== undefined) updateData.maxBackups = input.maxBackups;

      const location = await prisma.backupLocation.update({
        where: { id },
        data: updateData,
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      logger.info(`Backup location updated: ${location.name} (ID: ${location.id})`);
      return this.mapToLocation(location);
    } catch (error) {
      logger.error(`Error updating backup location ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete location
   */
  static async deleteLocation(id: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      // Check if location is used by any schedules
      const schedules = await prisma.backupScheduleLocation.findFirst({
        where: { backupLocationId: id },
      });

      if (schedules) {
        throw new Error('Cannot delete location: it is used by one or more backup schedules');
      }

      await prisma.backupLocation.delete({
        where: { id },
      });

      logger.info(`Backup location deleted: ID ${id}`);
    } catch (error) {
      logger.error(`Error deleting backup location ${id}`, error);
      throw error;
    }
  }

  /**
   * Get locations for a backup schedule (ordered by rotation order)
   */
  static async getScheduleLocations(scheduleId: number): Promise<BackupLocation[]> {
    try {
      const prisma = databaseService.getClient();

      const scheduleLocations = await prisma.backupScheduleLocation.findMany({
        where: { backupScheduleId: scheduleId },
        include: {
          backupLocation: {
            include: {
              creator: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
        orderBy: { order: 'asc' },
      });

      return scheduleLocations
        .map(sl => this.mapToLocation(sl.backupLocation))
        .filter(loc => loc.isActive);
    } catch (error) {
      logger.error(`Error getting schedule locations for schedule ${scheduleId}`, error);
      throw error;
    }
  }

  /**
   * Get next location for rotation (round-robin)
   */
  static async getNextRotationLocation(scheduleId: number): Promise<BackupLocation | null> {
    try {
      const locations = await this.getScheduleLocations(scheduleId);
      if (locations.length === 0) {
        return null;
      }

      // Get the schedule to check last run info
      const prisma = databaseService.getClient();
      const schedule = await prisma.backupSchedule.findUnique({
        where: { id: scheduleId },
        include: {
          backupLocations: {
            orderBy: { order: 'asc' },
            include: {
              backupLocation: true,
            },
          },
        },
      });

      if (!schedule || !schedule.backupLocations || schedule.backupLocations.length === 0) {
        return locations[0] || null;
      }

      // Simple round-robin: use the location order from the junction table
      // Get the last location's order and rotate to the next one
      const lastJunction = schedule.backupLocations[schedule.backupLocations.length - 1];
      const lastOrder = lastJunction?.order ?? 0;
      const nextOrder = (lastOrder + 1) % schedule.backupLocations.length;
      
      // Find the location with the next order
      const nextJunction = schedule.backupLocations.find((j: { order: number }) => j.order === nextOrder);
      if (nextJunction) {
        return this.mapToLocation(nextJunction.backupLocation);
      }
      
      // Fallback to first location
      return locations[0] || null;
    } catch (error) {
      logger.error(`Error getting next rotation location for schedule ${scheduleId}`, error);
      return null;
    }
  }

  /**
   * Map Prisma model to BackupLocation interface
   */
  private static mapToLocation(location: {
    id: number;
    name: string;
    type: string;
    path: string;
    config: string | null;
    isActive: boolean;
    priority: number;
    maxBackups: number | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: number;
    creator?: { id: number; username: string } | null;
  }): BackupLocation {
    return {
      id: location.id,
      name: location.name,
      type: location.type as BackupLocationType,
      path: location.path,
      config: location.config,
      isActive: location.isActive,
      priority: location.priority,
      maxBackups: location.maxBackups,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
      createdBy: location.createdBy,
      creator: location.creator || null,
    };
  }
}

