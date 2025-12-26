import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { databaseService } from '../services/database/database.service';
import {
  BackupSchedulerService,
  BackupScheduleConfig,
  ScheduleConfig,
} from '../services/backup/backup-scheduler.service';
import { validateExternalDrive } from '../utils/drive.util';

export interface CreateBackupScheduleInput {
  name: string;
  scheduleType: string; // daily, weekly, monthly, custom
  scheduleConfig: ScheduleConfig;
  destinationPath: string; // Path on external drive
  isActive?: boolean;
}

export interface UpdateBackupScheduleInput {
  name?: string;
  scheduleType?: string;
  scheduleConfig?: ScheduleConfig;
  destinationPath?: string;
  isActive?: boolean;
}

/**
 * Register backup scheduler IPC handlers
 */
export function registerBackupSchedulerHandlers(): void {
  logger.info('Registering backup scheduler IPC handlers...');

  /**
   * Get all backup schedules
   * IPC: backup-scheduler:getSchedules
   */
  ipcMain.handle('backup-scheduler:getSchedules', async (_event, userId: number) => {
    try {
      const prisma = databaseService.getClient();
      const schedules = await prisma.backupSchedule.findMany({
        where: {
          createdById: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        success: true,
        schedules,
      };
    } catch (error) {
      logger.error('Error in backup-scheduler:getSchedules handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        schedules: [],
      };
    }
  });

  /**
   * Get backup schedule by ID
   * IPC: backup-scheduler:getScheduleById
   */
  ipcMain.handle('backup-scheduler:getScheduleById', async (_event, scheduleId: number) => {
    try {
      const prisma = databaseService.getClient();
      const schedule = await prisma.backupSchedule.findUnique({
        where: { id: scheduleId },
      });

      return {
        success: true,
        schedule: schedule || null,
      };
    } catch (error) {
      logger.error('Error in backup-scheduler:getScheduleById handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        schedule: null,
      };
    }
  });

  /**
   * Create backup schedule
   * IPC: backup-scheduler:createSchedule
   */
  ipcMain.handle(
    'backup-scheduler:createSchedule',
    async (_event, input: CreateBackupScheduleInput, userId: number) => {
      try {
        // Validate external drive
        await validateExternalDrive(input.destinationPath);

        const prisma = databaseService.getClient();
        const scheduleConfig = JSON.stringify(input.scheduleConfig);

        // Calculate next run time
        const nextRunAt = BackupSchedulerService.calculateNextRun({
          id: 0, // Temporary ID for calculation
          name: input.name,
          scheduleType: input.scheduleType,
          scheduleConfig: scheduleConfig,
          destinationPath: input.destinationPath,
          isActive: input.isActive !== false,
          lastRunAt: null,
          nextRunAt: null,
          lastRunStatus: null,
          lastRunError: null,
          createdById: userId,
        });

        const schedule = await prisma.backupSchedule.create({
          data: {
            name: input.name,
            scheduleType: input.scheduleType,
            scheduleConfig: scheduleConfig,
            destinationPath: input.destinationPath,
            isActive: input.isActive !== false,
            nextRunAt,
            createdById: userId,
          },
        });

        // Schedule the backup if active
        if (schedule.isActive) {
          BackupSchedulerService.scheduleBackup({
            id: schedule.id,
            name: schedule.name,
            scheduleType: schedule.scheduleType,
            scheduleConfig: schedule.scheduleConfig,
            destinationPath: schedule.destinationPath,
            isActive: schedule.isActive,
            lastRunAt: schedule.lastRunAt,
            nextRunAt: schedule.nextRunAt,
            lastRunStatus: schedule.lastRunStatus,
            lastRunError: schedule.lastRunError,
            createdById: schedule.createdById,
          });
        }

        return {
          success: true,
          schedule,
        };
      } catch (error) {
        logger.error('Error in backup-scheduler:createSchedule handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update backup schedule
   * IPC: backup-scheduler:updateSchedule
   */
  ipcMain.handle(
    'backup-scheduler:updateSchedule',
    async (_event, scheduleId: number, input: UpdateBackupScheduleInput) => {
      try {
        const prisma = databaseService.getClient();
        const existingSchedule = await prisma.backupSchedule.findUnique({
          where: { id: scheduleId },
        });

        if (!existingSchedule) {
          return {
            success: false,
            error: 'Backup schedule not found',
          };
        }

        // If destination path is being updated, validate it
        if (input.destinationPath && input.destinationPath !== existingSchedule.destinationPath) {
          await validateExternalDrive(input.destinationPath);
        }

        // Build update data
        const updateData: any = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.scheduleType !== undefined) updateData.scheduleType = input.scheduleType;
        if (input.scheduleConfig !== undefined) {
          updateData.scheduleConfig = JSON.stringify(input.scheduleConfig);
        }
        if (input.destinationPath !== undefined) updateData.destinationPath = input.destinationPath;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;

        // Recalculate next run if schedule changed
        if (input.scheduleType || input.scheduleConfig || input.isActive !== undefined) {
          const scheduleConfig = input.scheduleConfig
            ? JSON.stringify(input.scheduleConfig)
            : existingSchedule.scheduleConfig;
          const scheduleType = input.scheduleType || existingSchedule.scheduleType;

          const nextRunAt = BackupSchedulerService.calculateNextRun({
            id: scheduleId,
            name: input.name || existingSchedule.name,
            scheduleType,
            scheduleConfig,
            destinationPath: input.destinationPath || existingSchedule.destinationPath,
            isActive: input.isActive !== undefined ? input.isActive : existingSchedule.isActive,
            lastRunAt: existingSchedule.lastRunAt,
            nextRunAt: existingSchedule.nextRunAt,
            lastRunStatus: existingSchedule.lastRunStatus,
            lastRunError: existingSchedule.lastRunError,
            createdById: existingSchedule.createdById,
          });

          updateData.nextRunAt = nextRunAt;
        }

        const schedule = await prisma.backupSchedule.update({
          where: { id: scheduleId },
          data: updateData,
        });

        // Reschedule the backup
        BackupSchedulerService.unscheduleBackup(scheduleId);
        if (schedule.isActive) {
          BackupSchedulerService.scheduleBackup({
            id: schedule.id,
            name: schedule.name,
            scheduleType: schedule.scheduleType,
            scheduleConfig: schedule.scheduleConfig,
            destinationPath: schedule.destinationPath,
            isActive: schedule.isActive,
            lastRunAt: schedule.lastRunAt,
            nextRunAt: schedule.nextRunAt,
            lastRunStatus: schedule.lastRunStatus,
            lastRunError: schedule.lastRunError,
            createdById: schedule.createdById,
          });
        }

        return {
          success: true,
          schedule,
        };
      } catch (error) {
        logger.error('Error in backup-scheduler:updateSchedule handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete backup schedule
   * IPC: backup-scheduler:deleteSchedule
   */
  ipcMain.handle('backup-scheduler:deleteSchedule', async (_event, scheduleId: number) => {
    try {
      const prisma = databaseService.getClient();

      // Unschedule the backup
      BackupSchedulerService.unscheduleBackup(scheduleId);

      // Delete from database
      await prisma.backupSchedule.delete({
        where: { id: scheduleId },
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Error in backup-scheduler:deleteSchedule handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Toggle backup schedule active status
   * IPC: backup-scheduler:toggleSchedule
   */
  ipcMain.handle('backup-scheduler:toggleSchedule', async (_event, scheduleId: number) => {
    try {
      const prisma = databaseService.getClient();
      const schedule = await prisma.backupSchedule.findUnique({
        where: { id: scheduleId },
      });

      if (!schedule) {
        return {
          success: false,
          error: 'Backup schedule not found',
        };
      }

      const newActiveStatus = !schedule.isActive;

      const updatedSchedule = await prisma.backupSchedule.update({
        where: { id: scheduleId },
        data: {
          isActive: newActiveStatus,
          nextRunAt: BackupSchedulerService.calculateNextRun({
            ...schedule,
            isActive: newActiveStatus,
          }),
        },
      });

      // Reschedule the backup
      BackupSchedulerService.unscheduleBackup(scheduleId);
      if (updatedSchedule.isActive) {
        BackupSchedulerService.scheduleBackup({
          id: updatedSchedule.id,
          name: updatedSchedule.name,
          scheduleType: updatedSchedule.scheduleType,
          scheduleConfig: updatedSchedule.scheduleConfig,
          destinationPath: updatedSchedule.destinationPath,
          isActive: updatedSchedule.isActive,
          lastRunAt: updatedSchedule.lastRunAt,
          nextRunAt: updatedSchedule.nextRunAt,
          lastRunStatus: updatedSchedule.lastRunStatus,
          lastRunError: updatedSchedule.lastRunError,
          createdById: updatedSchedule.createdById,
        });
      }

      return {
        success: true,
        schedule: updatedSchedule,
      };
    } catch (error) {
      logger.error('Error in backup-scheduler:toggleSchedule handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Manually trigger a scheduled backup
   * IPC: backup-scheduler:triggerBackup
   */
  ipcMain.handle('backup-scheduler:triggerBackup', async (_event, scheduleId: number) => {
    try {
      const prisma = databaseService.getClient();
      const schedule = await prisma.backupSchedule.findUnique({
        where: { id: scheduleId },
      });

      if (!schedule) {
        return {
          success: false,
          error: 'Backup schedule not found',
        };
      }

      // Execute the backup immediately
      await BackupSchedulerService.executeScheduledBackup({
        id: schedule.id,
        name: schedule.name,
        scheduleType: schedule.scheduleType,
        scheduleConfig: schedule.scheduleConfig,
        destinationPath: schedule.destinationPath,
        isActive: schedule.isActive,
        lastRunAt: schedule.lastRunAt,
        nextRunAt: schedule.nextRunAt,
        lastRunStatus: schedule.lastRunStatus,
        lastRunError: schedule.lastRunError,
        createdById: schedule.createdById,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Error in backup-scheduler:triggerBackup handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  logger.info('Backup scheduler IPC handlers registered');
}

