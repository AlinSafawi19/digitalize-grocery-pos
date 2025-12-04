import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  NotificationService,
  CreateNotificationInput,
  NotificationListOptions,
} from '../services/notifications/notification.service';

/**
 * Register notification IPC handlers
 */
export function registerNotificationHandlers(): void {
  logger.info('Registering notification IPC handlers...');

  /**
   * Get notifications handler
   * IPC: notifications:getNotifications
   */
  ipcMain.handle(
    'notifications:getNotifications',
    async (_event, options: NotificationListOptions, requestedById: number) => {
      try {
        // Users can view their own notifications
        // If userId is not specified in options, default to requestedById
        const notificationOptions: NotificationListOptions = {
          ...options,
          userId: options.userId !== undefined ? options.userId : requestedById,
        };

        const result = await NotificationService.getNotifications(notificationOptions);
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        logger.error('Error in notifications:getNotifications handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get notification count handler
   * IPC: notifications:getNotificationCount
   */
  ipcMain.handle(
    'notifications:getNotificationCount',
    async (_event, userId: number | null | undefined, requestedById: number) => {
      try {
        // If userId not provided, use requestedById
        const targetUserId = userId !== undefined ? userId : requestedById;
        const result = await NotificationService.getNotificationCount(targetUserId);
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        logger.error('Error in notifications:getNotificationCount handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Create notification handler
   * IPC: notifications:createNotification
   * Note: Most notifications are created automatically by the system
   * This handler is for manual notification creation if needed
   */
  ipcMain.handle(
    'notifications:createNotification',
    async (_event, input: CreateNotificationInput, createdBy: number) => {
      try {
        // If userId not specified, default to createdBy
        const notificationInput: CreateNotificationInput = {
          ...input,
          userId: input.userId !== undefined ? input.userId : createdBy,
        };

        const notification = await NotificationService.createNotification(notificationInput);
        return {
          success: true,
          notification,
        };
      } catch (error) {
        logger.error('Error in notifications:createNotification handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Mark notification as read handler
   * IPC: notifications:markNotificationRead
   */
  ipcMain.handle(
    'notifications:markNotificationRead',
    async (_event, id: number, requestedById: number) => {
      try {
        const notification = await NotificationService.markNotificationRead(id, requestedById);
        return {
          success: true,
          notification,
        };
      } catch (error) {
        logger.error('Error in notifications:markNotificationRead handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Mark all notifications as read handler
   * IPC: notifications:markAllNotificationsRead
   */
  ipcMain.handle(
    'notifications:markAllNotificationsRead',
    async (_event, userId: number | null | undefined, requestedById: number) => {
      try {
        // If userId not provided, use requestedById
        const targetUserId = userId !== undefined ? userId : requestedById;
        const result = await NotificationService.markAllNotificationsRead(targetUserId);
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        logger.error('Error in notifications:markAllNotificationsRead handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete notification handler
   * IPC: notifications:deleteNotification
   */
  ipcMain.handle(
    'notifications:deleteNotification',
    async (_event, id: number, requestedById: number) => {
      try {
        await NotificationService.deleteNotification(id, requestedById);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in notifications:deleteNotification handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  logger.info('Notification IPC handlers registered');
}

