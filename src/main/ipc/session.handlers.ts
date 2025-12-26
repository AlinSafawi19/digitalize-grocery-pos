import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { SessionService } from '../services/session/session.service';

/**
 * Register session management IPC handlers
 */
export function registerSessionHandlers(): void {
  logger.info('Registering session management IPC handlers...');

  /**
   * Get session configuration
   * IPC: session:getConfig
   */
  ipcMain.handle('session:getConfig', async () => {
    try {
      const config = SessionService.getConfig();
      return { success: true, config };
    } catch (error) {
      logger.error('Error in session:getConfig handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get all active sessions for current user
   * IPC: session:getUserSessions
   */
  ipcMain.handle('session:getUserSessions', async (_event, userId: number, includeInactive: boolean = false) => {
    try {
      const sessions = await SessionService.getUserSessions(userId, includeInactive);
      return { success: true, sessions };
    } catch (error) {
      logger.error('Error in session:getUserSessions handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get all active sessions (admin only)
   * IPC: session:getAllActiveSessions
   */
  ipcMain.handle('session:getAllActiveSessions', async () => {
    try {
      const sessions = await SessionService.getAllActiveSessions();
      return { success: true, sessions };
    } catch (error) {
      logger.error('Error in session:getAllActiveSessions handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get session by token
   * IPC: session:getSessionByToken
   */
  ipcMain.handle('session:getSessionByToken', async (_event, token: string) => {
    try {
      const session = await SessionService.getSessionByToken(token);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }
      return { success: true, session };
    } catch (error) {
      logger.error('Error in session:getSessionByToken handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Terminate a session
   * IPC: session:terminateSession
   */
  ipcMain.handle('session:terminateSession', async (_event, sessionId: string, reason?: string) => {
    try {
      await SessionService.terminateSession(sessionId, reason);
      return { success: true };
    } catch (error) {
      logger.error('Error in session:terminateSession handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Terminate all sessions for a user
   * IPC: session:terminateAllUserSessions
   */
  ipcMain.handle('session:terminateAllUserSessions', async (_event, userId: number, excludeSessionId?: string) => {
    try {
      const count = await SessionService.terminateAllUserSessions(userId, excludeSessionId);
      return { success: true, count };
    } catch (error) {
      logger.error('Error in session:terminateAllUserSessions handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Extend session timeout
   * IPC: session:extendSession
   */
  ipcMain.handle('session:extendSession', async (_event, sessionId: string, additionalMinutes: number) => {
    try {
      const session = await SessionService.extendSession(sessionId, additionalMinutes);
      if (!session) {
        return { success: false, error: 'Session not found or inactive' };
      }
      return { success: true, session };
    } catch (error) {
      logger.error('Error in session:extendSession handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Cleanup expired sessions
   * IPC: session:cleanupExpiredSessions
   */
  ipcMain.handle('session:cleanupExpiredSessions', async () => {
    try {
      const count = await SessionService.cleanupExpiredSessions();
      return { success: true, count };
    } catch (error) {
      logger.error('Error in session:cleanupExpiredSessions handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  logger.info('Session management IPC handlers registered');
}

