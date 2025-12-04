import * as cron from 'node-cron';
import { logger } from '../../utils/logger';
import { NotificationService } from './notification.service';
import { BrowserWindow } from 'electron';

/**
 * Notification Count Cron Service
 * Periodically checks notification counts and notifies renderer processes
 */
export class NotificationCountCronService {
  private static cronTask: cron.ScheduledTask | null = null;
  private static isRunning = false;
  private static lastCounts: Map<number, { unreadCount: number; totalCount: number }> = new Map();

  /**
   * Start the notification count cron service
   * Runs every 30 seconds to check for notification count changes
   */
  static start(): void {
    if (this.isRunning) {
      logger.warn('Notification count cron service is already running');
      return;
    }

    logger.info('Starting notification count cron service...');
    this.isRunning = true;

    // Run every 30 seconds: '*/30 * * * * *' (every 30 seconds)
    // Alternative: every 1 minute: '0 * * * * *' (at 0 seconds of every minute)
    this.cronTask = cron.schedule('*/30 * * * * *', async () => {
      try {
        await this.checkNotificationCounts();
      } catch (error) {
        logger.error('Error in notification count cron job:', error);
      }
    });

    logger.info('Notification count cron service started (runs every 30 seconds)');
  }

  /**
   * Stop the notification count cron service
   */
  static stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping notification count cron service...');

    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }

    this.isRunning = false;
    this.lastCounts.clear();
    logger.info('Notification count cron service stopped');
  }

  /**
   * Check notification counts for all active users and notify if changed
   */
  private static async checkNotificationCounts(): Promise<void> {
    try {
      // Get all browser windows (renderer processes)
      const windows = BrowserWindow.getAllWindows();
      if (windows.length === 0) {
        return; // No windows open, skip check
      }

      // Get all users from the database to check their notification counts
      const { databaseService } = await import('../database/database.service');
      const prisma = databaseService.getClient();
      
      const users = await prisma.user.findMany({
        select: { id: true },
      });

      // Check counts for each user
      for (const user of users) {
        try {
          const counts = await NotificationService.getNotificationCount(user.id);
          const lastCount = this.lastCounts.get(user.id);

          // If count changed, notify renderer processes
          if (!lastCount || 
              lastCount.unreadCount !== counts.unreadCount || 
              lastCount.totalCount !== counts.totalCount) {
            
            // Store new count
            this.lastCounts.set(user.id, {
              unreadCount: counts.unreadCount,
              totalCount: counts.totalCount,
            });

            // Notify all renderer processes about the count change
            windows.forEach((window) => {
              window.webContents.send('notification:countUpdated', {
                userId: user.id,
                unreadCount: counts.unreadCount,
                totalCount: counts.totalCount,
              });
            });

            logger.debug(`Notification count updated for user ${user.id}: ${counts.unreadCount} unread, ${counts.totalCount} total`);
          }
        } catch (error) {
          logger.error(`Error checking notification count for user ${user.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in checkNotificationCounts:', error);
    }
  }

  /**
   * Manually trigger a count check (useful when notifications are created/updated)
   */
  static async triggerCheck(): Promise<void> {
    if (this.isRunning) {
      await this.checkNotificationCounts();
    }
  }
}

