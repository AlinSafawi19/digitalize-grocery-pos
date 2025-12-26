import { logger } from '../../utils/logger';
import { SessionService } from './session.service';

/**
 * Session Cleanup Service
 * Periodically cleans up expired sessions
 */
export class SessionCleanupService {
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Start the session cleanup service
   */
  static start(): void {
    if (this.cleanupInterval) {
      logger.warn('Session cleanup service is already running');
      return;
    }

    // Run cleanup immediately on start
    this.cleanupExpiredSessions();

    // Then run cleanup periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.CLEANUP_INTERVAL_MS);

    logger.info('Session cleanup service started');
  }

  /**
   * Stop the session cleanup service
   */
  static stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Session cleanup service stopped');
    }
  }

  /**
   * Clean up expired sessions
   */
  private static async cleanupExpiredSessions(): Promise<void> {
    try {
      const count = await SessionService.cleanupExpiredSessions();
      if (count > 0) {
        logger.info(`Cleaned up ${count} expired session(s)`);
      }
    } catch (error) {
      logger.error('Error during session cleanup', error);
    }
  }
}

