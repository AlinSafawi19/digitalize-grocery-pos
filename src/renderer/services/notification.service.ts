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

export interface NotificationListResult {
  success: boolean;
  notifications?: Notification[];
  total?: number;
  page?: number;
  pageSize?: number;
  unreadCount?: number;
  error?: string;
}

export interface NotificationCountResult {
  success: boolean;
  unreadCount?: number;
  totalCount?: number;
  error?: string;
}

export interface NotificationResult {
  success: boolean;
  notification?: Notification;
  error?: string;
}

export interface MarkAllReadResult {
  success: boolean;
  count?: number;
  error?: string;
}

/**
 * Notification Service (Renderer)
 * Handles notification API calls via IPC
 */
export class NotificationService {
  /**
   * Get notifications with pagination and filtering
   */
  static async getNotifications(
    options: NotificationListOptions,
    requestedById: number
  ): Promise<NotificationListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'notifications:getNotifications',
        options,
        requestedById
      ) as NotificationListResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get notification count (unread and total)
   */
  static async getNotificationCount(
    userId: number | null | undefined,
    requestedById: number
  ): Promise<NotificationCountResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'notifications:getNotificationCount',
        userId,
        requestedById
      ) as NotificationCountResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Create a new notification
   */
  static async createNotification(
    input: CreateNotificationInput,
    createdBy: number
  ): Promise<NotificationResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'notifications:createNotification',
        input,
        createdBy
      ) as NotificationResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Mark notification as read
   */
  static async markNotificationRead(
    id: number,
    requestedById: number
  ): Promise<NotificationResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'notifications:markNotificationRead',
        id,
        requestedById
      ) as NotificationResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllNotificationsRead(
    userId: number | null | undefined,
    requestedById: number
  ): Promise<MarkAllReadResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'notifications:markAllNotificationsRead',
        userId,
        requestedById
      ) as MarkAllReadResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(
    id: number,
    requestedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'notifications:deleteNotification',
        id,
        requestedById
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

