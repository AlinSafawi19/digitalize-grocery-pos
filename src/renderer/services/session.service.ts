// Types for session management
export interface SessionInfo {
  id: string;
  userId: number;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: Record<string, unknown> | null;
  isActive: boolean;
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
  terminatedAt: Date | null;
  username?: string;
}

export interface SessionConfig {
  defaultTimeoutMinutes: number;
  maxTimeoutMinutes: number;
  minTimeoutMinutes: number;
}

export interface SessionServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Session Service (Renderer)
 * Client-side service for session management operations
 */
export class SessionService {
  /**
   * Get session configuration
   */
  static async getConfig(): Promise<SessionConfig> {
    const result = await window.electron.ipcRenderer.invoke('session:getConfig') as SessionServiceResult<SessionConfig>;
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get session configuration');
    }
    return result.data;
  }

  /**
   * Get all active sessions for current user
   */
  static async getUserSessions(userId: number, includeInactive: boolean = false): Promise<SessionInfo[]> {
    const result = await window.electron.ipcRenderer.invoke('session:getUserSessions', userId, includeInactive) as SessionServiceResult<SessionInfo[]>;
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get user sessions');
    }
    return result.data;
  }

  /**
   * Get all active sessions (admin only)
   */
  static async getAllActiveSessions(): Promise<SessionInfo[]> {
    const result = await window.electron.ipcRenderer.invoke('session:getAllActiveSessions') as SessionServiceResult<SessionInfo[]>;
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get all active sessions');
    }
    return result.data;
  }

  /**
   * Get session by token
   */
  static async getSessionByToken(token: string): Promise<SessionInfo | null> {
    const result = await window.electron.ipcRenderer.invoke('session:getSessionByToken', token) as SessionServiceResult<SessionInfo>;
    if (!result.success) {
      return null;
    }
    return result.data || null;
  }

  /**
   * Terminate a session
   */
  static async terminateSession(sessionId: string, reason?: string): Promise<void> {
    const result = await window.electron.ipcRenderer.invoke('session:terminateSession', sessionId, reason) as SessionServiceResult<void>;
    if (!result.success) {
      throw new Error(result.error || 'Failed to terminate session');
    }
  }

  /**
   * Terminate all sessions for a user
   */
  static async terminateAllUserSessions(userId: number, excludeSessionId?: string): Promise<number> {
    const result = await window.electron.ipcRenderer.invoke('session:terminateAllUserSessions', userId, excludeSessionId) as SessionServiceResult<number>;
    if (!result.success || result.data === undefined) {
      throw new Error(result.error || 'Failed to terminate all user sessions');
    }
    return result.data;
  }

  /**
   * Extend session timeout
   */
  static async extendSession(sessionId: string, additionalMinutes: number): Promise<SessionInfo> {
    const result = await window.electron.ipcRenderer.invoke('session:extendSession', sessionId, additionalMinutes) as SessionServiceResult<SessionInfo>;
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to extend session');
    }
    return result.data;
  }

  /**
   * Cleanup expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    const result = await window.electron.ipcRenderer.invoke('session:cleanupExpiredSessions') as SessionServiceResult<number>;
    if (!result.success || result.data === undefined) {
      throw new Error(result.error || 'Failed to cleanup expired sessions');
    }
    return result.data;
  }
}

