import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { PermissionService } from '../services/permission/permission.service';

/**
 * Register permission management IPC handlers
 */
export function registerPermissionHandlers(): void {
  logger.info('Registering permission management IPC handlers...');

  /**
   * Get all permissions handler
   * IPC: permission:getAll
   */
  ipcMain.handle('permission:getAll', async () => {
    try {
      const permissions = await PermissionService.getAllPermissions();
      return { success: true, permissions };
    } catch (error) {
      logger.error('Error in permission:getAll handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get permissions by category handler
   * IPC: permission:getByCategory
   */
  ipcMain.handle('permission:getByCategory', async (_event, category: string) => {
    try {
      const permissions = await PermissionService.getPermissionsByCategory(category);
      return { success: true, permissions };
    } catch (error) {
      logger.error('Error in permission:getByCategory handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get user permissions handler
   * IPC: permission:getUserPermissions
   */
  ipcMain.handle('permission:getUserPermissions', async (_event, userId: number) => {
    try {
      const permissions = await PermissionService.getUserPermissions(userId);
      return { success: true, permissions };
    } catch (error) {
      logger.error('Error in permission:getUserPermissions handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Check if user has permission handler
   * IPC: permission:userHasPermission
   */
  ipcMain.handle('permission:userHasPermission', async (_event, userId: number, permissionCode: string) => {
    try {
      const hasPermission = await PermissionService.userHasPermission(userId, permissionCode);
      return { success: true, hasPermission };
    } catch (error) {
      logger.error('Error in permission:userHasPermission handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Check if user has any of the specified permissions handler
   * IPC: permission:userHasAnyPermission
   */
  ipcMain.handle('permission:userHasAnyPermission', async (_event, userId: number, permissionCodes: string[]) => {
    try {
      const hasPermission = await PermissionService.userHasAnyPermission(userId, permissionCodes);
      return { success: true, hasPermission };
    } catch (error) {
      logger.error('Error in permission:userHasAnyPermission handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Assign permissions to user handler
   * IPC: permission:assignToUser
   */
  ipcMain.handle('permission:assignToUser', async (_event, userId: number, permissionIds: number[]) => {
    try {
      await PermissionService.assignPermissionsToUser(userId, permissionIds);
      return { success: true };
    } catch (error) {
      logger.error('Error in permission:assignToUser handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Add permission to user handler
   * IPC: permission:addToUser
   */
  ipcMain.handle('permission:addToUser', async (_event, userId: number, permissionId: number) => {
    try {
      await PermissionService.addPermissionToUser(userId, permissionId);
      return { success: true };
    } catch (error) {
      logger.error('Error in permission:addToUser handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Remove permission from user handler
   * IPC: permission:removeFromUser
   */
  ipcMain.handle('permission:removeFromUser', async (_event, userId: number, permissionId: number) => {
    try {
      await PermissionService.removePermissionFromUser(userId, permissionId);
      return { success: true };
    } catch (error) {
      logger.error('Error in permission:removeFromUser handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Remove all permissions from user handler
   * IPC: permission:removeAllFromUser
   */
  ipcMain.handle('permission:removeAllFromUser', async (_event, userId: number) => {
    try {
      await PermissionService.removeAllPermissionsFromUser(userId);
      return { success: true };
    } catch (error) {
      logger.error('Error in permission:removeAllFromUser handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Initialize default permissions handler
   * IPC: permission:initializeDefaults
   */
  ipcMain.handle('permission:initializeDefaults', async () => {
    try {
      await PermissionService.initializeDefaultPermissions();
      return { success: true };
    } catch (error) {
      logger.error('Error in permission:initializeDefaults handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });
}

