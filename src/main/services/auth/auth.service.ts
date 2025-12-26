import bcrypt from 'bcryptjs';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';
import { SessionService, CreateSessionOptions } from '../session/session.service';

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
  sessionToken?: string;
  error?: string;
}

/**
 * Authentication Service
 * Handles user authentication, session management, and authorization
 */
export class AuthService {

  /**
   * Authenticate user with username and password
   */
  static async login(credentials: LoginCredentials, sessionOptions?: Omit<CreateSessionOptions, 'userId'>): Promise<LoginResult> {
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

      // Create session using SessionService
      const session = await SessionService.createSession({
        userId: user.id,
        ipAddress: sessionOptions?.ipAddress,
        userAgent: sessionOptions?.userAgent,
        deviceInfo: sessionOptions?.deviceInfo,
        timeoutMinutes: credentials.rememberMe ? 1440 : 30, // 24 hours if remember me, else 30 minutes
      });

      // Log successful login
      await AuditLogService.log({
        userId: user.id,
        action: 'login',
        entity: 'user',
        entityId: user.id,
        details: JSON.stringify({ 
          username: user.username, 
          rememberMe: credentials.rememberMe || false,
          sessionId: session.id,
        }),
      });

      logger.info('User logged in successfully', {
        userId: user.id,
        username: user.username,
        sessionId: session.id,
      });

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          isActive: user.isActive,
        },
        sessionToken: session.token,
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
  static async logout(userId: number, sessionToken?: string): Promise<void> {
    try {
      // Terminate session if token provided
      if (sessionToken) {
        const session = await SessionService.getSessionByToken(sessionToken);
        if (session && session.userId === userId) {
          await SessionService.terminateSession(session.id, 'User logout');
        }
      } else {
        // Terminate all user sessions
        await SessionService.terminateAllUserSessions(userId);
      }

      // Log logout action
      await AuditLogService.log({
        userId,
        action: 'logout',
        entity: 'user',
        entityId: userId,
        details: JSON.stringify({ sessionToken: sessionToken || 'all_sessions' }),
      });

      logger.info('User logged out', { userId, sessionToken: sessionToken || 'all_sessions' });
    } catch (error) {
      logger.error('Error during logout', error);
      throw error;
    }
  }

  /**
   * Get current user session
   */
  static async getCurrentUser(sessionToken: string): Promise<UserSession | null> {
    try {
      // Get session by token
      const session = await SessionService.getSessionByToken(sessionToken);
      if (!session) {
        return null;
      }

      // Validate session
      const isValid = await SessionService.validateSession(session.id);
      if (!isValid) {
        return null;
      }

      // Get user from database
      const prisma = databaseService.getClient();
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          username: true,
          phone: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        // Terminate invalid session
        await SessionService.terminateSession(session.id, 'User inactive');
        return null;
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
   * Validate user session by token
   */
  static async validateSession(sessionToken: string): Promise<boolean> {
    try {
      const session = await SessionService.getSessionByToken(sessionToken);
      if (!session) {
        return false;
      }

      return await SessionService.validateSession(session.id);
    } catch (error) {
      logger.error('Error validating session', error);
      return false;
    }
  }
}

