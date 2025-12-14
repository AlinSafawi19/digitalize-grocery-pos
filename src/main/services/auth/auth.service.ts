import bcrypt from 'bcryptjs';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface UserSession {
  id: number;
  username: string;
  phone: string | null;
  isActive: boolean;
}

export interface LoginResult {
  success: boolean;
  user?: UserSession;
  error?: string;
}

/**
 * Authentication Service
 * Handles user authentication, session management, and authorization
 */
export class AuthService {
  // In-memory session storage (for desktop app, this is sufficient)
  // In production, you might want to use encrypted storage
  private static activeSessions: Map<number, { userId: number; lastActivity: Date }> = new Map();

  /**
   * Authenticate user with username and password
   */
  static async login(credentials: LoginCredentials): Promise<LoginResult> {
    try {
      // Validate required fields
      if (!credentials.username || credentials.username.trim() === '') {
        return {
          success: false,
          error: 'Username is required',
        };
      }

      if (!credentials.password || credentials.password.trim() === '') {
        return {
          success: false,
          error: 'Password is required',
        };
      }

      const prisma = databaseService.getClient();

      // Find user by username
      const user = await prisma.user.findUnique({
        where: { username: credentials.username },
      });

      if (!user) {
        logger.warn('Login attempt with invalid username', { username: credentials.username });
        return {
          success: false,
          error: 'Invalid username or password',
        };
      }

      // Check if user is active
      if (!user.isActive) {
        logger.warn('Login attempt for inactive user', { userId: user.id, username: user.username });
        return {
          success: false,
          error: 'Account is disabled. Please contact administrator.',
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

      if (!isPasswordValid) {
        logger.warn('Login attempt with invalid password', { userId: user.id, username: user.username });
        return {
          success: false,
          error: 'Invalid username or password',
        };
      }

      // Create session
      this.activeSessions.set(user.id, {
        userId: user.id,
        lastActivity: new Date(),
      });

      // Log successful login
      await AuditLogService.log({
        userId: user.id,
        action: 'login',
        entity: 'user',
        entityId: user.id,
        details: JSON.stringify({ username: user.username, rememberMe: credentials.rememberMe || false }),
      });

      logger.info('User logged in successfully', {
        userId: user.id,
        username: user.username,
      });

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          isActive: user.isActive,
        },
      };
    } catch (error) {
      logger.error('Error during login', error);
      return {
        success: false,
        error: 'An error occurred during login. Please try again.',
      };
    }
  }

  /**
   * Logout user and clear session
   */
  static async logout(userId: number): Promise<void> {
    try {
      // Log logout action
      await AuditLogService.log({
        userId,
        action: 'logout',
        entity: 'user',
        entityId: userId,
      });

      // Remove session
      this.activeSessions.delete(userId);

      logger.info('User logged out', { userId });
    } catch (error) {
      logger.error('Error during logout', error);
      throw error;
    }
  }

  /**
   * Get current user session
   */
  static async getCurrentUser(userId: number): Promise<UserSession | null> {
    try {
      const prisma = databaseService.getClient();

      // Check if session exists
      if (!this.activeSessions.has(userId)) {
        return null;
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          phone: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        // Remove invalid session
        this.activeSessions.delete(userId);
        return null;
      }

      // Update last activity
      const session = this.activeSessions.get(userId);
      if (session) {
        session.lastActivity = new Date();
      }

      return {
        id: user.id,
        username: user.username,
        phone: user.phone,
        isActive: user.isActive,
      };
    } catch (error) {
      logger.error('Error getting current user', error);
      return null;
    }
  }

  /**
   * Validate user session
   */
  static async validateSession(userId: number): Promise<boolean> {
    try {
      // Check if session exists
      if (!this.activeSessions.has(userId)) {
        return false;
      }

      // Check if user still exists and is active
      const prisma = databaseService.getClient();
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isActive: true },
      });

      if (!user || !user.isActive) {
        this.activeSessions.delete(userId);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating session', error);
      return false;
    }
  }

  /**
   * Clear inactive sessions (cleanup method)
   */
  static clearInactiveSessions(maxInactivityMinutes: number = 30): void {
    const now = new Date();
    const sessionsToRemove: number[] = [];

    this.activeSessions.forEach((session, userId) => {
      const inactivityMinutes = (now.getTime() - session.lastActivity.getTime()) / (1000 * 60);
      if (inactivityMinutes > maxInactivityMinutes) {
        sessionsToRemove.push(userId);
      }
    });

    sessionsToRemove.forEach((userId) => {
      this.activeSessions.delete(userId);
      logger.info('Cleared inactive session', { userId });
    });
  }
}

