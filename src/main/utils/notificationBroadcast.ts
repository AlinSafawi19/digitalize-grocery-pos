import { BrowserWindow } from 'electron';
import { logger } from './logger';
import { Notification } from '../services/notifications/notification.service';

/**
 * Broadcast notification to all renderer processes
 */
export function broadcastNotification(notification: Notification): void {
  try {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      window.webContents.send('notification:new', notification);
    });
    logger.debug('Notification broadcasted', { 
      notificationId: notification.id, 
      windowsCount: windows.length 
    });
  } catch (error) {
    logger.error('Error broadcasting notification', error);
  }
}

