import { randomBytes } from 'crypto';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';

export interface CreateSessionOptions {
  userId: number;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, unknown>;
  timeoutMinutes?: number; // Session timeout in minutes
}

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

/**
 * Session Service
 * Manages user sessions with database persistence, timeout handling, and security features
 */
export class SessionService {
  // Default session timeout: 30 minutes
  private static readonly DEFAULT_TIMEOUT_MINUTES = 30;
  private static readonly MAX_TIMEOUT_MINUTES = 1440; // 24 hours
  private static readonly MIN_TIMEOUT_MINUTES = 5; // 5 minutes

  /**
   * Get session configuration
   */
  static getConfig(): SessionConfig {
    return {
      defaultTimeoutMinutes: this.DEFAULT_TIMEOUT_MINUTES,
      maxTimeoutMinutes: this.MAX_TIMEOUT_MINUTES,
      minTimeoutMinutes: this.MIN_TIMEOUT_MINUTES,
    };
  }

  /**
   * Create a new session for a user
   */
  static async createSession(options: CreateSessionOptions): Promise<SessionInfo> {
    try {
      const prisma = databaseService.getClient();

      // Generate secure session token
      const token = this.generateSessionToken();

      // Calculate expiration time
      const timeoutMinutes = options.timeoutMinutes || this.DEFAULT_TIMEOUT_MINUTES;
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + timeoutMinutes);

      // Create session in database
      const session = await prisma.session.create({
        data: {
          userId: options.userId,
          token,
          ipAddress: options.ipAddress || null,
          userAgent: options.userAgent || null,
          deviceInfo: options.deviceInfo ? JSON.stringify(options.deviceInfo) : null,
          expiresAt,
          lastActivity: new Date(),
        },
        include: {
          user: {
            select: {
              username: true,
            },
          },
        },
      });

      logger.info('Session created', {
        sessionId: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
      });

      return this.mapSessionToInfo(session);
    } catch (error) {
      logger.error('Error creating session', error);
      throw error;
    }
  }

  /**
   * Get session by token
   */
  static async getSessionByToken(token: string): Promise<SessionInfo | null> {
    try {
      const prisma = databaseService.getClient();

      const session = await prisma.session.findUnique({
        where: { token },
        include: {
          user: {
            select: {
              username: true,
            },
          },
        },
      });

      if (!session) {
        return null;
      }

      // Check if session is expired
      if (new Date() > session.expiresAt) {
        await this.terminateSession(session.id, 'Session expired');
        return null;
      }

      // Check if session is active
      if (!session.isActive) {
        return null;
      }

      return this.mapSessionToInfo(session);
    } catch (error) {
      logger.error('Error getting session by token', error);
      return null;
    }
  }

  /**
   * Get session by ID
   */
  static async getSessionById(sessionId: string): Promise<SessionInfo | null> {
    try {
      const prisma = databaseService.getClient();

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          user: {
            select: {
              username: true,
            },
          },
        },
      });

      if (!session) {
        return null;
      }

      return this.mapSessionToInfo(session);
    } catch (error) {
      logger.error('Error getting session by ID', error);
      return null;
    }
  }

  /**
   * Update session last activity
   */
  static async updateLastActivity(sessionId: string): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      await prisma.session.update({
        where: { id: sessionId },
        data: {
          lastActivity: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error updating session last activity', error);
    }
  }

  /**
   * Validate session (check if active and not expired)
   */
  static async validateSession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSessionById(sessionId);
      if (!session) {
        return false;
      }

      // Check if session is active
      if (!session.isActive) {
        return false;
      }

      // Check if session is expired
      if (new Date() > session.expiresAt) {
        await this.terminateSession(sessionId, 'Session expired');
        return false;
      }

      // Update last activity
      await this.updateLastActivity(sessionId);

      return true;
    } catch (error) {
      logger.error('Error validating session', error);
      return false;
    }
  }

  /**
   * Terminate a session
   */
  static async terminateSession(sessionId: string, reason?: string): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      });

      if (!session) {
        return;
      }

      await prisma.session.update({
        where: { id: sessionId },
        data: {
          isActive: false,
          terminatedAt: new Date(),
        },
      });

      // Log session termination
      await AuditLogService.log({
        userId: session.userId,
        action: 'session_terminated',
        entity: 'session',
        entityId: parseInt(sessionId),
        details: JSON.stringify({ reason: reason || 'Manual termination', sessionId }),
      });

      logger.info('Session terminated', {
        sessionId,
        userId: session.userId,
        reason: reason || 'Manual termination',
      });
    } catch (error) {
      logger.error('Error terminating session', error);
      throw error;
    }
  }

  /**
   * Terminate all sessions for a user
   */
  static async terminateAllUserSessions(userId: number, excludeSessionId?: string): Promise<number> {
    try {
      const prisma = databaseService.getClient();

      const result = await prisma.session.updateMany({
        where: {
          userId,
          isActive: true,
          ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
        },
        data: {
          isActive: false,
          terminatedAt: new Date(),
        },
      });

      // Log termination of all sessions
      await AuditLogService.log({
        userId,
        action: 'all_sessions_terminated',
        entity: 'session',
        details: JSON.stringify({ count: result.count, excludeSessionId }),
      });

      logger.info('All user sessions terminated', {
        userId,
        count: result.count,
        excludeSessionId,
      });

      return result.count;
    } catch (error) {
      logger.error('Error terminating all user sessions', error);
      throw error;
    }
  }

  /**
   * Get all active sessions for a user
   */
  static async getUserSessions(userId: number, includeInactive: boolean = false): Promise<SessionInfo[]> {
    try {
      const prisma = databaseService.getClient();

      const sessions = await prisma.session.findMany({
        where: {
          userId,
          ...(includeInactive ? {} : { isActive: true }),
        },
        include: {
          user: {
            select: {
              username: true,
            },
          },
        },
        orderBy: {
          lastActivity: 'desc',
        },
      });

      return sessions.map(session => this.mapSessionToInfo(session));
    } catch (error) {
      logger.error('Error getting user sessions', error);
      return [];
    }
  }

  /**
   * Get all active sessions (for admin)
   */
  static async getAllActiveSessions(): Promise<SessionInfo[]> {
    try {
      const prisma = databaseService.getClient();

      const sessions = await prisma.session.findMany({
        where: {
          isActive: true,
        },
        include: {
          user: {
            select: {
              username: true,
            },
          },
        },
        orderBy: {
          lastActivity: 'desc',
        },
      });

      return sessions.map(session => this.mapSessionToInfo(session));
    } catch (error) {
      logger.error('Error getting all active sessions', error);
      return [];
    }
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const prisma = databaseService.getClient();

      const now = new Date();
      const result = await prisma.session.updateMany({
        where: {
          isActive: true,
          expiresAt: {
            lt: now,
          },
        },
        data: {
          isActive: false,
          terminatedAt: now,
        },
      });

      if (result.count > 0) {
        logger.info('Cleaned up expired sessions', { count: result.count });
      }

      return result.count;
    } catch (error) {
      logger.error('Error cleaning up expired sessions', error);
      return 0;
    }
  }

  /**
   * Extend session timeout
   */
  static async extendSession(sessionId: string, additionalMinutes: number): Promise<SessionInfo | null> {
    try {
      const prisma = databaseService.getClient();

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session || !session.isActive) {
        return null;
      }

      // Calculate new expiration time
      const newExpiresAt = new Date(session.expiresAt);
      newExpiresAt.setMinutes(newExpiresAt.getMinutes() + additionalMinutes);

      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: {
          expiresAt: newExpiresAt,
        },
        include: {
          user: {
            select: {
              username: true,
            },
          },
        },
      });

      logger.info('Session extended', {
        sessionId,
        newExpiresAt,
      });

      return this.mapSessionToInfo(updated);
    } catch (error) {
      logger.error('Error extending session', error);
      return null;
    }
  }

  /**
   * Generate secure session token
   */
  private static generateSessionToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Map database session to SessionInfo
   */
  private static mapSessionToInfo(session: any): SessionInfo {
    return {
      id: session.id,
      userId: session.userId,
      token: session.token,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceInfo: session.deviceInfo ? JSON.parse(session.deviceInfo) : null,
      isActive: session.isActive,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      terminatedAt: session.terminatedAt,
      username: session.user?.username,
    };
  }
}

