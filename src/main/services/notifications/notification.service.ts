import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { broadcastNotification } from '../../utils/notificationBroadcast';
import { Prisma } from '@prisma/client';

export type NotificationType =
  | 'low_stock'
  | 'expiry_warning'
  | 'system_error'
  | 'system_warning'
  | 'transaction'
  | 'backup_completion'
  | 'backup_failed'
  | 'user_activity'
  | 'price_change'
  | 'stock_adjustment'
  | 'purchase_order'
  | 'payment_due'
  | 'license_warning';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  userId?: number | null;
  priority?: NotificationPriority;
}

export interface NotificationListOptions {
  page?: number;
  pageSize?: number;
  userId?: number | null;
  type?: NotificationType;
  isRead?: boolean;
  priority?: NotificationPriority;
  startDate?: Date;
  endDate?: Date;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  userId: number | null;
  isRead: boolean;
  priority: string;
  createdAt: Date;
  user?: {
    id: number;
    username: string;
  } | null;
}

/**
 * Notification Service
 * Handles notification creation, retrieval, and management
 */
export class NotificationService {
  /**
   * Check if a notification is backup/restore-related
   * Backup/restore-related notifications should only be sent to the main user (ID = 1)
   */
  private static isBackupRelatedNotification(input: CreateNotificationInput): boolean {
    // Check notification type for backup-specific types
    if (input.type === 'backup_completion' || input.type === 'backup_failed') {
      return true;
    }

    // Check if title or message contains backup/restore-related keywords
    const backupKeywords = ['backup', 'restore', 'restoring', 'backing up', 'database backup', 'backup file'];
    const titleLower = input.title.toLowerCase();
    const messageLower = input.message.toLowerCase();
    
    return backupKeywords.some(keyword => 
      titleLower.includes(keyword) || messageLower.includes(keyword)
    );
  }

  /**
   * Check if a notification is license-related
   * License-related notifications should only be sent to the main user (ID = 1)
   */
  private static isLicenseRelatedNotification(input: CreateNotificationInput): boolean {
    // Explicitly exclude product expiry warnings (they are not license-related)
    if (input.type === 'expiry_warning') {
      return false;
    }

    // Check notification type for license-specific types
    // Note: We don't send license_expired notifications (only warnings before expiry)
    if (input.type === 'license_warning') {
      return true;
    }

    // Check if title or message contains license-related keywords
    // Must include license/subscription context, not just generic expiry words
    const titleLower = input.title.toLowerCase();
    const messageLower = input.message.toLowerCase();
    
    // Primary license keywords (must be present)
    const primaryKeywords = ['license', 'licence', 'subscription'];
    // Secondary keywords (must be combined with primary keywords for context)
    const secondaryKeywords = ['expired', 'expir', 'renew', 'activation', 'expiring'];
    
    // Check if primary keywords are present
    const hasPrimaryKeyword = primaryKeywords.some(keyword => 
      titleLower.includes(keyword) || messageLower.includes(keyword)
    );
    
    // If primary keyword is present, it's license-related
    if (hasPrimaryKeyword) {
      return true;
    }
    
    // If only secondary keywords are present, require more context
    // (e.g., "subscription expired" but not just "expired" alone)
    const hasSecondaryKeyword = secondaryKeywords.some(keyword => 
      titleLower.includes(keyword) || messageLower.includes(keyword)
    );
    
    // Only consider it license-related if both primary and secondary keywords are present
    // OR if the message clearly indicates license context (e.g., "subscription", "license key")
    return hasSecondaryKeyword && (
      titleLower.includes('subscription') || 
      titleLower.includes('license') || 
      titleLower.includes('licence') ||
      messageLower.includes('subscription') ||
      messageLower.includes('license') ||
      messageLower.includes('licence')
    );
  }

  /**
   * Get the main user ID (ID = 1)
   * This is the default user created during license activation
   */
  private static async getMainUserId(): Promise<number | null> {
    try {
      const prisma = databaseService.getClient();
      const mainUser = await prisma.user.findUnique({
        where: { id: 1 },
        select: { id: true },
      });
      return mainUser?.id || null;
    } catch (error) {
      logger.error('Error getting main user ID', error);
      return null;
    }
  }

  /**
   * Create a new notification
   * PERFORMANCE FIX: Executes asynchronously in background to avoid blocking operations
   * Returns immediately (resolves promise immediately), actual creation happens in background
   * Can be called with or without await - both work the same (non-blocking)
   */
  static createNotification(
    input: CreateNotificationInput
  ): Promise<Notification> {
    // Return immediately resolved promise (non-blocking)
    // Execute actual notification creation in background
    Promise.resolve().then(async () => {
      try {
        const prisma = databaseService.getClient();

        // If this is a license or backup-related notification, only send to main user (ID = 1)
        // All other notifications are shared between all users of the same license (userId = null)
        let targetUserId: number | null = null;
        const isLicenseRelated = this.isLicenseRelatedNotification(input);
        const isBackupRelated = this.isBackupRelatedNotification(input);
        
        if (isLicenseRelated || isBackupRelated) {
          const mainUserId = await this.getMainUserId();
          if (mainUserId) {
            targetUserId = mainUserId;
            const notificationType = isLicenseRelated ? 'license' : 'backup';
            logger.info(`${notificationType}-related notification routed to main user only`, {
              originalUserId: input.userId,
              targetUserId: mainUserId,
              type: input.type,
              title: input.title,
            });
          } else {
            const notificationType = isLicenseRelated ? 'license' : 'backup';
            logger.warn(`Main user not found, ${notificationType} notification will not be created`);
            // Don't throw - just log and return
            return;
          }
        }
        // For all other notifications, targetUserId remains null (system-wide/shared)

        const notification = await prisma.notification.create({
          data: {
            type: input.type,
            title: input.title,
            message: input.message,
            userId: targetUserId || null,
            priority: input.priority || 'normal',
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        });

        logger.info('Notification created', {
        id: notification.id,
        type: notification.type,
        userId: notification.userId,
      });

      const notificationData = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        userId: notification.userId,
        isRead: notification.isRead,
        priority: notification.priority,
        createdAt: notification.createdAt,
        user: notification.user,
      };

        // Broadcast notification to all renderer processes for real-time updates
        broadcastNotification(notificationData);

        // Trigger cron check to update counts immediately (use dynamic import to avoid circular dependency)
        import('./notification-count-cron.service').then(({ NotificationCountCronService }) => {
          NotificationCountCronService.triggerCheck().catch((error) => {
            logger.error('Error triggering notification count check:', error);
          });
        });
      } catch (error) {
        // Don't throw error for notification failures
        // Just log to console/logger
        logger.error('Error creating notification', error);
      }
    }).catch((error) => {
      // Catch any errors in the promise chain
      logger.error('Error in notification promise chain', error);
    });

    // Return immediately resolved promise with minimal notification data (non-blocking)
    // The actual notification will be created in the background
    return Promise.resolve({
      id: 0, // Placeholder - actual ID will be set in background
      type: input.type,
      title: input.title,
      message: input.message,
      userId: null,
      isRead: false,
      priority: input.priority || 'normal',
      createdAt: new Date(),
      user: null,
    } as Notification);
  }

  /**
   * Get notifications with pagination and filtering
   */
  static async getNotifications(
    options: NotificationListOptions = {}
  ): Promise<{
    notifications: Notification[];
    total: number;
    page: number;
    pageSize: number;
    unreadCount: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const where: Prisma.NotificationWhereInput = {};

      if (options.userId !== undefined) {
        if (options.userId === null) {
          // Get notifications for all users (system-wide)
          where.userId = null;
        } else {
          // Get notifications for specific user or system-wide (null userId)
          where.OR = [
            { userId: options.userId },
            { userId: null }, // System-wide notifications
          ];
        }
      }

      if (options.type) {
        where.type = options.type;
      }

      if (options.isRead !== undefined) {
        where.isRead = options.isRead;
      }

      if (options.priority) {
        where.priority = options.priority;
      }

      if (options.startDate || options.endDate) {
        where.createdAt = {};
        if (options.startDate) {
          where.createdAt.gte = options.startDate;
        }
        if (options.endDate) {
          where.createdAt.lte = options.endDate;
        }
      }

      // Build unread count query (same filters but only unread)
      const unreadWhere = {
        ...where,
        isRead: false,
      };

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [
            { priority: 'desc' }, // urgent, high, normal, low
            { createdAt: 'desc' },
          ],
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: unreadWhere }),
      ]);

      return {
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          userId: n.userId,
          isRead: n.isRead,
          priority: n.priority,
          createdAt: n.createdAt,
          user: n.user,
        })),
        total,
        page,
        pageSize,
        unreadCount,
      };
    } catch (error) {
      logger.error('Error getting notifications', error);
      throw error;
    }
  }

  /**
   * Get notification count (unread notifications)
   */
  static async getNotificationCount(
    userId?: number | null
  ): Promise<{
    unreadCount: number;
    totalCount: number;
  }> {
    try {
      const prisma = databaseService.getClient();

      const where: Prisma.NotificationWhereInput = {};

      if (userId !== undefined) {
        if (userId === null) {
          // Count system-wide notifications
          where.userId = null;
        } else {
          // Count notifications for specific user or system-wide
          where.OR = [
            { userId },
            { userId: null }, // System-wide notifications
          ];
        }
      }

      const [unreadCount, totalCount] = await Promise.all([
        prisma.notification.count({
          where: {
            ...where,
            isRead: false,
          },
        }),
        prisma.notification.count({ where }),
      ]);

      return {
        unreadCount,
        totalCount,
      };
    } catch (error) {
      logger.error('Error getting notification count', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  static async markNotificationRead(
    id: number,
    userId?: number
  ): Promise<Notification> {
    try {
      const prisma = databaseService.getClient();

      // Verify notification exists and belongs to user (if userId provided)
      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      // If userId provided, verify it's for this user or system-wide
      if (userId !== undefined && notification.userId !== null && notification.userId !== userId) {
        throw new Error('Notification does not belong to user');
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      logger.info('Notification marked as read', {
        id: updated.id,
        userId: updated.userId,
      });

      // Trigger cron check to update counts immediately (use dynamic import to avoid circular dependency)
      import('./notification-count-cron.service').then(({ NotificationCountCronService }) => {
        NotificationCountCronService.triggerCheck().catch((error) => {
          logger.error('Error triggering notification count check:', error);
        });
      });

      return {
        id: updated.id,
        type: updated.type,
        title: updated.title,
        message: updated.message,
        userId: updated.userId,
        isRead: updated.isRead,
        priority: updated.priority,
        createdAt: updated.createdAt,
        user: updated.user,
      };
    } catch (error) {
      logger.error('Error marking notification as read', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllNotificationsRead(
    userId?: number | null
  ): Promise<{ count: number }> {
    try {
      const prisma = databaseService.getClient();

      const where: Prisma.NotificationWhereInput = {
        isRead: false,
      };

      if (userId !== undefined) {
        if (userId === null) {
          // Mark system-wide notifications as read
          where.userId = null;
        } else {
          // Mark user-specific and system-wide notifications as read
          where.OR = [
            { userId },
            { userId: null }, // System-wide notifications
          ];
        }
      }

      const result = await prisma.notification.updateMany({
        where,
        data: { isRead: true },
      });

      logger.info('All notifications marked as read', {
        count: result.count,
        userId,
      });

      // Trigger cron check to update counts immediately (use dynamic import to avoid circular dependency)
      import('./notification-count-cron.service').then(({ NotificationCountCronService }) => {
        NotificationCountCronService.triggerCheck().catch((error) => {
          logger.error('Error triggering notification count check:', error);
        });
      });

      return { count: result.count };
    } catch (error) {
      logger.error('Error marking all notifications as read', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(
    id: number,
    userId?: number
  ): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      // Verify notification exists and belongs to user (if userId provided)
      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      // If userId provided, verify it's for this user or system-wide
      if (userId !== undefined && notification.userId !== null && notification.userId !== userId) {
        throw new Error('Notification does not belong to user');
      }

      await prisma.notification.delete({
        where: { id },
      });

      logger.info('Notification deleted', {
        id,
        userId: notification.userId,
      });

      // Trigger cron check to update counts immediately (use dynamic import to avoid circular dependency)
      import('./notification-count-cron.service').then(({ NotificationCountCronService }) => {
        NotificationCountCronService.triggerCheck().catch((error) => {
          logger.error('Error triggering notification count check:', error);
        });
      });
    } catch (error) {
      logger.error('Error deleting notification', error);
      throw error;
    }
  }

  /**
   * Delete old notifications (retention policy)
   * Deletes notifications older than specified days
   */
  static async deleteOldNotifications(
    daysToKeep: number = 30
  ): Promise<{ count: number }> {
    try {
      const prisma = databaseService.getClient();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          isRead: true, // Only delete read notifications
        },
      });

      logger.info('Old notifications deleted', {
        count: result.count,
        daysToKeep,
      });

      return { count: result.count };
    } catch (error) {
      logger.error('Error deleting old notifications', error);
      throw error;
    }
  }

  /**
   * Create low stock notification
   */
  static async createLowStockNotification(
    productId: number,
    productName: string,
    currentQuantity: number,
    reorderLevel: number,
    userId?: number | null
  ): Promise<Notification> {
    return this.createNotification({
      type: 'low_stock',
      title: 'Low Stock Alert',
      message: `Product "${productName}" is running low. Current stock: ${currentQuantity}, Reorder level: ${reorderLevel}`,
      userId,
      priority: 'high',
    });
  }

  /**
   * Create expiry warning notification
   */
  static async createExpiryWarningNotification(
    productId: number,
    productName: string,
    daysUntilExpiry: number,
    userId?: number | null
  ): Promise<Notification> {
    return this.createNotification({
      type: 'expiry_warning',
      title: 'Expiry Warning',
      message: `Product "${productName}" will expire in ${daysUntilExpiry} day(s)`,
      userId,
      priority: 'high',
    });
  }

  /**
   * Create backup completion notification
   */
  static async createBackupCompletionNotification(
    backupPath: string,
    userId?: number | null
  ): Promise<Notification> {
    return this.createNotification({
      type: 'backup_completion',
      title: 'Backup Completed',
      message: `Database backup completed successfully. Location: ${backupPath}`,
      userId,
      priority: 'normal',
    });
  }

  /**
   * Create backup failed notification
   */
  static async createBackupFailedNotification(
    error: string,
    userId?: number | null
  ): Promise<Notification> {
    return this.createNotification({
      type: 'backup_failed',
      title: 'Backup Failed',
      message: `Database backup failed: ${error}`,
      userId,
      priority: 'high',
    });
  }

  /**
   * Create system error notification
   */
  static async createSystemErrorNotification(
    error: string,
    userId?: number | null
  ): Promise<Notification> {
    return this.createNotification({
      type: 'system_error',
      title: 'System Error',
      message: error,
      userId,
      priority: 'urgent',
    });
  }

  /**
   * Create price change notification
   */
  static async createPriceChangeNotification(
    productId: number,
    productName: string,
    oldPrice: number,
    newPrice: number,
    changedBy: number,
    userId?: number | null
  ): Promise<Notification> {
    return this.createNotification({
      type: 'price_change',
      title: 'Price Changed',
      message: `Product "${productName}" price changed from ${oldPrice} to ${newPrice}`,
      userId,
      priority: 'normal',
    });
  }

  /**
   * Create license warning notification (e.g., license expiring soon)
   * This notification will automatically be routed to the main user (ID = 1) only
   * Note: We do not send license expired notifications because notifications won't be displayed
   * when the license is expired. Only warnings before expiry are sent.
   */
  static async createLicenseWarningNotification(
    message: string,
    daysRemaining?: number
  ): Promise<Notification> {
    const title = daysRemaining !== undefined 
      ? `License Expiring Soon (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining)`
      : 'License Warning';
    
    return this.createNotification({
      type: 'license_warning',
      title,
      message,
      userId: undefined, // Will be automatically set to main user (ID = 1)
      priority: 'high',
    });
  }

  /**
   * Create system warning notification
   */
  static async createSystemWarningNotification(
    title: string,
    message: string,
    priority: NotificationPriority = 'normal',
    userId?: number | null
  ): Promise<Notification> {
    return this.createNotification({
      type: 'system_warning',
      title,
      message,
      userId,
      priority,
    });
  }

  /**
   * Create transaction notification
   */
  static async createTransactionNotification(
    transactionNumber: string,
    transactionType: string,
    total: number,
    userId?: number | null
  ): Promise<Notification> {
    const typeLabel = transactionType === 'sale' ? 'Sale' : 'Return';
    return this.createNotification({
      type: 'transaction',
      title: `${typeLabel} Transaction Completed`,
      message: `Transaction ${transactionNumber} completed. Total: ${total.toFixed(2)}`,
      userId,
      priority: 'normal',
    });
  }

  /**
   * Create stock adjustment notification
   */
  static async createStockAdjustmentNotification(
    productId: number,
    productName: string,
    adjustmentType: string,
    quantity: number,
    reason: string | null,
    userId?: number | null
  ): Promise<Notification> {
    const adjustmentLabel = quantity >= 0 ? 'added' : 'removed';
    const quantityLabel = Math.abs(quantity);
    return this.createNotification({
      type: 'stock_adjustment',
      title: 'Stock Adjustment',
      message: `${quantityLabel} units ${adjustmentLabel} for "${productName}"${reason ? `: ${reason}` : ''}`,
      userId,
      priority: 'normal',
    });
  }

  /**
   * Create purchase order notification
   */
  static async createPurchaseOrderNotification(
    orderNumber: string,
    status: string,
    supplierName: string,
    total: number,
    userId?: number | null
  ): Promise<Notification> {
    const statusLabels: Record<string, string> = {
      draft: 'Created',
      pending: 'Submitted',
      partially_received: 'Partially Received',
      received: 'Received',
      cancelled: 'Cancelled',
    };
    const statusLabel = statusLabels[status] || status;
    return this.createNotification({
      type: 'purchase_order',
      title: `Purchase Order ${statusLabel}`,
      message: `Purchase Order ${orderNumber} for ${supplierName} - Total: ${total.toFixed(2)}`,
      userId,
      priority: status === 'cancelled' ? 'high' : 'normal',
    });
  }
}

