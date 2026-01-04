import * as cron from 'node-cron';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { BackupService } from './backup.service';
import { BackupLocationService, BackupLocation } from './backup-location.service';
import { NotificationService } from '../notifications/notification.service';
import { hasExternalDriveAvailable, validateExternalDrive } from '../../utils/drive.util';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Beirut';

export interface BackupScheduleConfig {
  id: number;
  name: string;
  scheduleType: string; // daily, weekly, monthly, custom
  scheduleConfig: string; // JSON string
  destinationPath: string; // Path on external drive
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastRunStatus: string | null; // success, failed, skipped
  lastRunError: string | null;
  createdById: number;
}

export interface ScheduleConfig {
  cronExpression?: string;
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  time?: string; // HH:mm format
}

/**
 * Backup Scheduler Service
 * Handles scheduled backup creation and execution
 */
export class BackupSchedulerService {
  private static scheduledTasks: Map<number, cron.ScheduledTask> = new Map();
  private static isRunning = false;

  /**
   * Start the scheduler service
   */
  static start(): void {
    if (this.isRunning) {
      logger.warn('Backup scheduler is already running');
      return;
    }

    logger.info('Starting backup scheduler service...');
    this.isRunning = true;

    // Load and schedule all active backup schedules
    this.loadAndScheduleBackups();

    logger.info('Backup scheduler service started');
  }

  /**
   * Stop the scheduler service
   */
  static stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping backup scheduler service...');

    // Stop all scheduled tasks
    this.scheduledTasks.forEach((task, id) => {
      task.stop();
      logger.info(`Stopped scheduled backup task: ${id}`);
    });

    this.scheduledTasks.clear();
    this.isRunning = false;
    logger.info('Backup scheduler service stopped');
  }

  /**
   * Load all active backup schedules and schedule them
   */
  static async loadAndScheduleBackups(): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      const backupSchedules = await prisma.backupSchedule.findMany({
        where: {
          isActive: true,
        },
      });

      logger.info(`Loading ${backupSchedules.length} active backup schedules`);

      for (const schedule of backupSchedules) {
        try {
          this.scheduleBackup(schedule);
        } catch (error) {
          logger.error(`Failed to schedule backup ${schedule.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error loading backup schedules:', error);
    }
  }

  /**
   * Schedule a backup
   */
  static scheduleBackup(schedule: BackupScheduleConfig): void {
    // Stop existing task if any
    const existingTask = this.scheduledTasks.get(schedule.id);
    if (existingTask) {
      existingTask.stop();
    }

    if (!schedule.isActive) {
      return;
    }

    // Parse schedule config
    const scheduleConfig: ScheduleConfig = JSON.parse(schedule.scheduleConfig || '{}');
    const cronExpression = this.buildCronExpression(schedule.scheduleType, scheduleConfig);

    if (!cronExpression) {
      logger.warn(`Invalid schedule configuration for backup schedule ${schedule.id}`);
      return;
    }

    // Create cron task
    const task = cron.schedule(cronExpression, async () => {
      try {
        logger.info(`Executing scheduled backup: ${schedule.name} (ID: ${schedule.id})`);
        await this.executeScheduledBackup(schedule);
      } catch (error) {
        logger.error(`Error executing scheduled backup ${schedule.id}:`, error);
      }
    });

    this.scheduledTasks.set(schedule.id, task);
    logger.info(`Scheduled backup ${schedule.id} (${schedule.name}) with cron: ${cronExpression}`);
  }

  /**
   * Build cron expression from schedule type and config
   * Converts Beirut time to server's local timezone for cron scheduling
   * node-cron runs in the server's local timezone, so we need to convert
   */
  private static buildCronExpression(
    scheduleType: string,
    config: ScheduleConfig
  ): string | null {
    const time = config.time || '02:00'; // Default to 2:00 AM (Beirut time)
    const [beirutHours, beirutMinutes] = time.split(':').map(Number);

    // Convert Beirut time to server's local timezone for cron scheduling
    // Create a moment in Beirut timezone with today's date and the specified time
    const beirutMoment = moment.tz(TIMEZONE).hour(beirutHours).minute(beirutMinutes).second(0).millisecond(0);
    
    // Convert to server's local timezone (node-cron uses server's local time)
    // Get the local time equivalent
    const localMoment = beirutMoment.local();
    const localHours = localMoment.hour();
    const localMinutes = localMoment.minute();

    switch (scheduleType) {
      case 'daily':
        // Every day at specified time (in server local time, converted from Beirut time)
        return `${localMinutes} ${localHours} * * *`;

      case 'weekly': {
        // Every week on specified day at specified time
        const dayOfWeek = config.dayOfWeek !== undefined ? config.dayOfWeek : 1; // Default Monday (Beirut time)
        
        // Calculate the local day of week
        // Create a moment for the specified day of week in Beirut timezone
        const beirutWeeklyMoment = moment.tz(TIMEZONE).day(dayOfWeek).hour(beirutHours).minute(beirutMinutes).second(0).millisecond(0);
        const localWeeklyMoment = beirutWeeklyMoment.local();
        const localWeeklyDayOfWeek = localWeeklyMoment.day();
        const localWeeklyHours = localWeeklyMoment.hour();
        const localWeeklyMinutes = localWeeklyMoment.minute();
        
        return `${localWeeklyMinutes} ${localWeeklyHours} * * ${localWeeklyDayOfWeek}`;
      }

      case 'monthly': {
        // Every month on specified day at specified time
        const dayOfMonth = config.dayOfMonth !== undefined ? config.dayOfMonth : 1; // Default 1st (Beirut time)
        
        // For monthly, use the Beirut day of month
        // The local day might differ if time conversion crosses midnight, but we'll use Beirut day
        // This ensures the backup runs on the correct day from the user's perspective
        return `${localMinutes} ${localHours} ${dayOfMonth} * *`;
      }

      case 'custom':
        // Use provided cron expression (assumed to be in server timezone)
        return config.cronExpression || null;

      default:
        return null;
    }
  }

  /**
   * Execute a scheduled backup
   * Supports multiple backup locations with rotation
   */
  static async executeScheduledBackup(schedule: BackupScheduleConfig): Promise<void> {
    const prisma = databaseService.getClient();
    const startTime = Date.now();

    try {
      // Get backup locations for this schedule (if any)
      const locations = await BackupLocationService.getScheduleLocations(schedule.id);
      
      // Determine backup destination(s)
      let backupDestinations: Array<{ path: string; location?: BackupLocation }> = [];
      
      if (locations.length > 0) {
        // Use multiple locations with rotation
        // Get next location for rotation
        const nextLocation = await BackupLocationService.getNextRotationLocation(schedule.id);
        
        if (nextLocation) {
          backupDestinations = [{ path: nextLocation.path, location: nextLocation }];
        } else {
          // Fallback: try all locations in priority order
          backupDestinations = locations.map(loc => ({ path: loc.path, location: loc }));
        }
      } else {
        // Fallback to legacy destinationPath (backward compatibility)
        if (schedule.destinationPath) {
          backupDestinations = [{ path: schedule.destinationPath }];
        } else {
          throw new Error('No backup locations configured and no destination path specified');
        }
      }

      // Try each destination until one succeeds
      let backupSucceeded = false;
      let lastError: Error | null = null;

      for (const destination of backupDestinations) {
        try {
          // Validate location if it's a configured location
          if (destination.location) {
            const validation = await BackupLocationService.validateLocation(
              destination.location.type,
              destination.location.path,
              destination.location.config ? JSON.parse(destination.location.config) : undefined
            );
            
            if (!validation.valid) {
              logger.warn(`Skipping location ${destination.location.name}: ${validation.message}`);
              lastError = new Error(validation.message || 'Location validation failed');
              continue;
            }
          } else {
            // Legacy: validate external drive for destinationPath
            const hasDrive = await hasExternalDriveAvailable();
            if (!hasDrive) {
              logger.warn(`Scheduled backup ${schedule.id} skipped: No external drive available`);
              
              // Update schedule with skip status
              await prisma.backupSchedule.update({
                where: { id: schedule.id },
                data: {
                  lastRunAt: new Date(),
                  lastRunStatus: 'skipped',
                  lastRunError: 'No external drive available. Please connect an external drive and the backup will run on the next scheduled time.',
                  nextRunAt: this.calculateNextRun(schedule),
                },
              });

              // Create notification for skipped backup
              try {
                await NotificationService.createNotification({
                  type: 'backup_failed',
                  title: 'Scheduled Backup Skipped',
                  message: `Scheduled backup "${schedule.name}" was skipped because no external drive is connected. Please connect an external drive for backups to run automatically.`,
                  userId: schedule.createdById,
                  priority: 'normal',
                });
              } catch (notificationError) {
                logger.error('Failed to create notification for skipped backup', notificationError);
              }

              return;
            }

            // Validate that destination path is still on an external drive
            try {
              await validateExternalDrive(destination.path);
            } catch (validationError) {
              logger.warn(`Destination path validation failed: ${validationError instanceof Error ? validationError.message : 'Invalid path'}`);
              lastError = validationError instanceof Error ? validationError : new Error('Invalid destination path');
              continue;
            }
          }

          // Create the backup
          logger.info(`Creating scheduled backup: ${schedule.name} to ${destination.path}`);
          const backupInfo = await BackupService.createBackup(
            {
              description: `Scheduled backup: ${schedule.name}${destination.location ? ` (Location: ${destination.location.name})` : ''}`,
              destinationPath: destination.path,
            },
            schedule.createdById
          );

          backupSucceeded = true;
          const duration = Date.now() - startTime;

          // Update schedule with success status
          await prisma.backupSchedule.update({
            where: { id: schedule.id },
            data: {
              lastRunAt: new Date(),
              lastRunStatus: 'success',
              lastRunError: null,
              nextRunAt: this.calculateNextRun(schedule),
            },
          });

          logger.info(`Scheduled backup ${schedule.id} executed successfully. Created: ${backupInfo.filename} (${duration}ms)`);

          // Create notification for successful backup
          try {
            await NotificationService.createNotification({
              type: 'backup_completion',
              title: 'Scheduled Backup Completed',
              message: `Scheduled backup "${schedule.name}" completed successfully. Backup saved to: ${destination.path}${destination.location ? ` (${destination.location.name})` : ''}`,
              userId: schedule.createdById,
              priority: 'normal',
            });
          } catch (notificationError) {
            logger.error('Failed to create notification for scheduled backup', notificationError);
          }

          break; // Success, exit loop
        } catch (error) {
          logger.warn(`Failed to create backup to ${destination.path}:`, error);
          lastError = error instanceof Error ? error : new Error('Unknown error');
          // Continue to next destination
        }
      }

      // If all destinations failed
      if (!backupSucceeded) {
        const errorMessage = lastError?.message || 'All backup locations failed';
        throw new Error(errorMessage);
      }
    } catch (error) {
      logger.error(`Error executing scheduled backup ${schedule.id}:`, error);

      // Update schedule with failed status
      try {
        await prisma.backupSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: new Date(),
            lastRunStatus: 'failed',
            lastRunError: error instanceof Error ? error.message : 'Unknown error',
            nextRunAt: this.calculateNextRun(schedule),
          },
        });
      } catch (updateError) {
        logger.error('Failed to update backup schedule after error', updateError);
      }

      // Create notification for failed backup
      try {
        await NotificationService.createNotification({
          type: 'backup_failed',
          title: 'Scheduled Backup Failed',
          message: `Scheduled backup "${schedule.name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId: schedule.createdById,
          priority: 'high',
        });
      } catch (notificationError) {
        logger.error('Failed to create error notification for scheduled backup', notificationError);
      }
    }
  }

  /**
   * Calculate next run time for a schedule
   */
  static calculateNextRun(schedule: BackupScheduleConfig): Date {
    const scheduleConfig: ScheduleConfig = JSON.parse(schedule.scheduleConfig || '{}');
    const now = moment.tz(TIMEZONE);

    switch (schedule.scheduleType) {
      case 'daily': {
        const time = scheduleConfig.time || '02:00';
        const [hours, minutes] = time.split(':').map(Number);
        const nextRun = moment.tz(TIMEZONE).hour(hours).minute(minutes).second(0).millisecond(0);
        
        // If time has passed today, schedule for tomorrow
        if (nextRun.isBefore(now)) {
          nextRun.add(1, 'day');
        }
        
        return nextRun.toDate();
      }

      case 'weekly': {
        const dayOfWeek = scheduleConfig.dayOfWeek !== undefined ? scheduleConfig.dayOfWeek : 1;
        const weeklyTime = scheduleConfig.time || '02:00';
        const [hours, minutes] = weeklyTime.split(':').map(Number);
        
        const nextRun = moment.tz(TIMEZONE).day(dayOfWeek).hour(hours).minute(minutes).second(0).millisecond(0);
        
        // If this week's occurrence has passed, schedule for next week
        if (nextRun.isBefore(now)) {
          nextRun.add(1, 'week');
        }
        
        return nextRun.toDate();
      }

      case 'monthly': {
        const dayOfMonth = scheduleConfig.dayOfMonth !== undefined ? scheduleConfig.dayOfMonth : 1;
        const monthlyTime = scheduleConfig.time || '02:00';
        const [hours, minutes] = monthlyTime.split(':').map(Number);
        
        const nextRun = moment.tz(TIMEZONE).date(dayOfMonth).hour(hours).minute(minutes).second(0).millisecond(0);
        
        // If this month's occurrence has passed, schedule for next month
        if (nextRun.isBefore(now)) {
          nextRun.add(1, 'month');
        }
        
        return nextRun.toDate();
      }

      case 'custom': {
        // For custom cron, calculate next run based on cron expression
        // This is a simplified version - for production, use a proper cron parser
        const cronExpression = scheduleConfig.cronExpression;
        if (cronExpression) {
          // Use moment to add 1 day as fallback (proper cron parsing would be better)
          return moment.tz(TIMEZONE).add(1, 'day').toDate();
        }
        return moment.tz(TIMEZONE).add(1, 'day').toDate();
      }

      default:
        return moment.tz(TIMEZONE).add(1, 'day').toDate();
    }
  }

  /**
   * Unschedule a backup
   */
  static unscheduleBackup(scheduleId: number): void {
    const task = this.scheduledTasks.get(scheduleId);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(scheduleId);
      logger.info(`Unscheduled backup ${scheduleId}`);
    }
  }

  /**
   * Reload and reschedule all backups
   */
  static async reloadSchedules(): Promise<void> {
    logger.info('Reloading backup schedules...');
    this.stop();
    await this.loadAndScheduleBackups();
    this.start();
  }
}

