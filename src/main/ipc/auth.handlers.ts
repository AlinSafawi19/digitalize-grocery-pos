import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { AuthService, LoginCredentials } from '../services/auth/auth.service';

/**
 * Register authentication IPC handlers
 */
export function registerAuthHandlers(): void {
  logger.info('Registering authentication IPC handlers...');

  /**
   * Login handler
   * IPC: auth:login
   */
  ipcMain.handle('auth:login', async (_event, credentials: LoginCredentials) => {
    try {
      const result = await AuthService.login(credentials);
      return result;
    } catch (error) {
      logger.error('Error in auth:login handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred during login',
      };
    }
  });

  /**
   * Logout handler
   * IPC: auth:logout
   */
  ipcMain.handle('auth:logout', async (_event, userId: number) => {
    try {
      await AuthService.logout(userId);
      return { success: true };
    } catch (error) {
      logger.error('Error in auth:logout handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred during logout',
      };
    }
  });

  /**
   * Get current user handler
   * IPC: auth:getCurrentUser
   */
  ipcMain.handle('auth:getCurrentUser', async (_event, userId: number) => {
    try {
      const user = await AuthService.getCurrentUser(userId);
      if (!user) {
        return { success: false, error: 'User not found or session expired' };
      }
      return { success: true, user };
    } catch (error) {
      logger.error('Error in auth:getCurrentUser handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Validate session handler
   * IPC: auth:validateSession
   */
  ipcMain.handle('auth:validateSession', async (_event, userId: number) => {
    try {
      const isValid = await AuthService.validateSession(userId);
      return { success: true, isValid };
    } catch (error) {
      logger.error('Error in auth:validateSession handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  logger.info('Authentication IPC handlers registered');
}

