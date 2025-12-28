import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { LICENSE_SERVER_URL, APP_SECRET } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { getHardwareId } from './hardwareFingerprint';
import { databaseService } from '../database/database.service';
import { LicenseData } from './licenseStorage';

/**
 * Secure License Validation Service
 * Provides enhanced security for license validation with:
 * - Request signing for tamper detection
 * - Response verification
 * - Audit logging
 * - Tamper detection mechanisms
 */
export class SecureLicenseValidationService {
  private apiClient: AxiosInstance;
  private hardwareId: string;
  private signingKey: Buffer;

  constructor() {
    this.hardwareId = getHardwareId();
    
    // Derive signing key from hardware ID and app secret
    // This ensures each device has a unique signing key
    this.signingKey = crypto.pbkdf2Sync(
      APP_SECRET,
      this.hardwareId,
      100000,
      32,
      'sha256'
    );
    
    this.apiClient = axios.create({
      baseURL: LICENSE_SERVER_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generate a signature for request data
   * Uses HMAC-SHA256 with device-specific signing key
   */
  private signRequest(data: Record<string, unknown>): string {
    const dataString = JSON.stringify(data);
    const signature = crypto
      .createHmac('sha256', this.signingKey)
      .update(dataString)
      .digest('hex');
    return signature;
  }

  /**
   * Verify response signature from server
   * Returns true if signature is valid, false otherwise
   */
  private verifyResponse(data: Record<string, unknown>, signature: string): boolean {
    try {
      const dataString = JSON.stringify(data);
      const expectedSignature = crypto
        .createHmac('sha256', this.signingKey)
        .update(dataString)
        .digest('hex');
      
      // Use constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      logger.error('Error verifying response signature', error);
      return false;
    }
  }

  /**
   * Detect tampering in license data
   * Checks for inconsistencies that might indicate tampering
   */
  private detectTampering(licenseData: LicenseData | null, serverResponse: Record<string, unknown>): {
    tampered: boolean;
    reason?: string;
  } {
    if (!licenseData) {
      return { tampered: false }; // No data to check
    }

    // Check 1: Verify hardware ID matches
    if (licenseData.hardwareId !== this.hardwareId) {
      return {
        tampered: true,
        reason: 'Hardware ID mismatch - license data may have been copied to different device',
      };
    }

    // Check 2: Verify license key consistency
    const serverLicenseKey = serverResponse.licenseKey as string | undefined;
    if (serverLicenseKey && serverLicenseKey !== licenseData.licenseKey) {
      return {
        tampered: true,
        reason: 'License key mismatch between local and server data',
      };
    }

    // Check 3: Verify expiration date consistency (within reasonable bounds)
    const serverExpiresAt = serverResponse.expiresAt as string | undefined;
    if (serverExpiresAt) {
      const serverExpiry = new Date(serverExpiresAt).getTime();
      const localExpiry = licenseData.expiresAt;
      
      // Allow 1 day difference for timezone/server sync issues
      const diff = Math.abs(serverExpiry - localExpiry);
      const oneDay = 24 * 60 * 60 * 1000;
      
      if (diff > oneDay) {
        return {
          tampered: true,
          reason: 'Expiration date mismatch - possible tampering detected',
        };
      }
    }

    // Check 4: Verify validation token hasn't been tampered with
    // (This is a basic check - server should verify token validity)
    if (licenseData.validationToken && licenseData.validationToken.length < 10) {
      return {
        tampered: true,
        reason: 'Validation token appears invalid or tampered',
      };
    }

    return { tampered: false };
  }

  /**
   * Log validation attempt to audit log
   */
  private async logValidationAudit(input: {
    licenseKey: string;
    validationType: 'online' | 'offline' | 'cached';
    validationResult: 'valid' | 'invalid' | 'expired' | 'tampered' | 'error';
    requestSignature?: string;
    responseSignature?: string;
    serverResponse?: Record<string, unknown>;
    errorMessage?: string;
    tamperDetected: boolean;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      
      // Sanitize license key (only store first 8 chars + last 4 chars for security)
      const sanitizedKey = input.licenseKey.length > 12
        ? `${input.licenseKey.substring(0, 8)}...${input.licenseKey.substring(input.licenseKey.length - 4)}`
        : input.licenseKey.substring(0, 8) + '...';

      // Sanitize server response (remove sensitive data)
      const sanitizedResponse = input.serverResponse
        ? JSON.stringify({
            valid: input.serverResponse.valid,
            expiresAt: input.serverResponse.expiresAt,
            daysRemaining: input.serverResponse.daysRemaining,
            // Don't log sensitive fields like tokens, keys, etc.
          })
        : null;

      await prisma.licenseValidationAudit.create({
        data: {
          licenseKey: sanitizedKey,
          validationType: input.validationType,
          validationResult: input.validationResult,
          hardwareId: this.hardwareId.substring(0, 16) + '...', // Partial hash for security
          requestSignature: input.requestSignature?.substring(0, 32) + '...', // Partial signature
          responseSignature: input.responseSignature?.substring(0, 32) + '...', // Partial signature
          serverResponse: sanitizedResponse,
          errorMessage: input.errorMessage,
          tamperDetected: input.tamperDetected,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });
    } catch (error) {
      // Don't throw - audit logging failures shouldn't break validation
      logger.error('Failed to log validation audit', error);
    }
  }

  /**
   * Perform secure online license validation
   * Includes request signing, response verification, and tamper detection
   */
  async validateSecureOnline(licenseKey: string, licenseData: LicenseData | null): Promise<{
    valid: boolean;
    message: string;
    expiresAt?: Date;
    gracePeriodEnd?: Date;
    daysRemaining?: number;
    tamperDetected: boolean;
    tamperReason?: string;
  }> {
    const startTime = Date.now();
    let requestSignature: string | undefined;
    let responseSignature: string | undefined;
    let serverResponse: Record<string, unknown> | undefined;
    let errorMessage: string | undefined;
    let tamperDetected = false;
    let tamperReason: string | undefined;

    try {
      // Prepare request data
      const requestData = {
        licenseKey,
        hardwareId: this.hardwareId,
        timestamp: Date.now(),
      };

      // Sign the request
      requestSignature = this.signRequest(requestData);

      logger.info('Performing secure online license validation...', {
        licenseKey: licenseKey.substring(0, 8) + '...',
      });

      // Make request with signature
      const response = await this.apiClient.post('/api/license/validate-secure', {
        ...requestData,
        signature: requestSignature,
      });

      serverResponse = response.data;

      // Verify response signature if provided by server
      if (response.data.signature) {
        responseSignature = response.data.signature;
        const responseData = { ...response.data };
        delete responseData.signature; // Remove signature before verification
        
        const isValidSignature = this.verifyResponse(responseData, responseSignature);
        if (!isValidSignature) {
          logger.warn('Response signature verification failed - possible tampering');
          tamperDetected = true;
          tamperReason = 'Response signature verification failed';
        }
      }

      // Check for tampering in license data
      const tamperCheck = this.detectTampering(licenseData, serverResponse);
      if (tamperCheck.tampered) {
        tamperDetected = true;
        tamperReason = tamperCheck.reason;
        logger.warn('Tampering detected in license validation', { reason: tamperReason });
      }

      if (response.data.valid) {
        // Check if expiry info is present
        if (!response.data.expiresAt) {
          errorMessage = 'License validation returned valid but no expiry info';
          await this.logValidationAudit({
            licenseKey,
            validationType: 'online',
            validationResult: 'error',
            requestSignature,
            responseSignature,
            serverResponse,
            errorMessage,
            tamperDetected,
          });
          
          return {
            valid: false,
            message: 'License validation failed: expiry information is missing',
            tamperDetected,
            tamperReason,
          };
        }

        await this.logValidationAudit({
          licenseKey,
          validationType: 'online',
          validationResult: tamperDetected ? 'tampered' : 'valid',
          requestSignature,
          responseSignature,
          serverResponse,
          tamperDetected,
          ipAddress: response.config?.headers?.['x-forwarded-for'] as string || undefined,
          userAgent: response.config?.headers?.['user-agent'] as string || undefined,
        });

        return {
          valid: !tamperDetected, // Invalid if tampering detected
          message: tamperDetected
            ? `License validation failed: ${tamperReason}`
            : response.data.message || 'License is valid',
          expiresAt: response.data.expiresAt ? new Date(response.data.expiresAt) : undefined,
          gracePeriodEnd: response.data.gracePeriodEnd ? new Date(response.data.gracePeriodEnd) : undefined,
          daysRemaining: response.data.daysRemaining,
          tamperDetected,
          tamperReason,
        };
      } else {
        errorMessage = response.data.message || 'License validation failed';
        await this.logValidationAudit({
          licenseKey,
          validationType: 'online',
          validationResult: 'invalid',
          requestSignature,
          responseSignature,
          serverResponse,
          errorMessage,
          tamperDetected,
        });

        return {
          valid: false,
          message: errorMessage,
          tamperDetected,
          tamperReason,
        };
      }
    } catch (error: unknown) {
      const err = error as { code?: string; response?: { data?: { message?: string } }; message?: string };
      errorMessage = err.response?.data?.message || err.message || 'Failed to validate license';
      
      // Check if it's a network error
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        await this.logValidationAudit({
          licenseKey,
          validationType: 'online',
          validationResult: 'error',
          requestSignature,
          responseSignature,
          serverResponse,
          errorMessage: 'Network error: ' + errorMessage,
          tamperDetected,
        });

        return {
          valid: false,
          message: 'Cannot connect to license server. Please check your internet connection.',
          tamperDetected,
          tamperReason,
        };
      }

      await this.logValidationAudit({
        licenseKey,
        validationType: 'online',
        validationResult: 'error',
        requestSignature,
        serverResponse,
        errorMessage,
        tamperDetected,
      });

      return {
        valid: false,
        message: errorMessage,
        tamperDetected,
        tamperReason,
      };
    }
  }

  /**
   * Perform secure offline/cached license validation
   * Includes tamper detection on cached data
   */
  async validateSecureCached(licenseData: LicenseData): Promise<{
    valid: boolean;
    message: string;
    expiresAt?: Date;
    gracePeriodEnd?: Date;
    daysRemaining?: number;
    tamperDetected: boolean;
    tamperReason?: string;
  }> {
    try {
      // Check for tampering in cached data
      const tamperCheck = this.detectTampering(licenseData, {});
      if (tamperCheck.tampered) {
        await this.logValidationAudit({
          licenseKey: licenseData.licenseKey,
          validationType: 'cached',
          validationResult: 'tampered',
          tamperDetected: true,
          errorMessage: tamperCheck.reason,
        });

        return {
          valid: false,
          message: `License validation failed: ${tamperCheck.reason}`,
          tamperDetected: true,
          tamperReason: tamperCheck.reason,
        };
      }

      // Check if expiry info exists
      if (!licenseData.expiresAt) {
        await this.logValidationAudit({
          licenseKey: licenseData.licenseKey,
          validationType: 'cached',
          validationResult: 'error',
          tamperDetected: false,
          errorMessage: 'No expiry info in cached license data',
        });

        return {
          valid: false,
          message: 'License expiry information is missing. Please connect to the internet to validate.',
          tamperDetected: false,
        };
      }

      // Check if cached validation is still valid (max 14 days)
      const daysSinceValidation = (Date.now() - licenseData.lastValidation) / (1000 * 60 * 60 * 24);
      if (daysSinceValidation > 14) {
        await this.logValidationAudit({
          licenseKey: licenseData.licenseKey,
          validationType: 'cached',
          validationResult: 'expired',
          tamperDetected: false,
          errorMessage: 'Cached validation expired (more than 14 days old)',
        });

        return {
          valid: false,
          message: 'Cached license validation expired. Please connect to the internet to validate.',
          tamperDetected: false,
        };
      }

      // Check if license expired
      const now = Date.now();
      if (now > licenseData.expiresAt) {
        await this.logValidationAudit({
          licenseKey: licenseData.licenseKey,
          validationType: 'cached',
          validationResult: 'expired',
          tamperDetected: false,
        });

        return {
          valid: false,
          message: 'License has expired. Please renew your subscription.',
          expiresAt: new Date(licenseData.expiresAt),
          gracePeriodEnd: licenseData.gracePeriodEnd ? new Date(licenseData.gracePeriodEnd) : undefined,
          tamperDetected: false,
        };
      }

      // License is valid
      const daysRemaining = Math.ceil((licenseData.expiresAt - now) / (1000 * 60 * 60 * 24));
      
      await this.logValidationAudit({
        licenseKey: licenseData.licenseKey,
        validationType: 'cached',
        validationResult: 'valid',
        tamperDetected: false,
      });

      return {
        valid: true,
        message: 'License is valid (cached validation)',
        expiresAt: new Date(licenseData.expiresAt),
        gracePeriodEnd: licenseData.gracePeriodEnd ? new Date(licenseData.gracePeriodEnd) : undefined,
        daysRemaining,
        tamperDetected: false,
      };
    } catch (error) {
      logger.error('Secure cached license validation error', error);
      
      await this.logValidationAudit({
        licenseKey: licenseData.licenseKey,
        validationType: 'cached',
        validationResult: 'error',
        tamperDetected: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        valid: false,
        message: 'Failed to validate cached license',
        tamperDetected: false,
      };
    }
  }

  /**
   * Get validation audit logs
   */
  async getValidationAuditLogs(options: {
    page?: number;
    pageSize?: number;
    validationType?: 'online' | 'offline' | 'cached';
    validationResult?: 'valid' | 'invalid' | 'expired' | 'tampered' | 'error';
    tamperDetected?: boolean;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    logs: Array<{
      id: number;
      licenseKey: string;
      validationType: string;
      validationResult: string;
      tamperDetected: boolean;
      errorMessage: string | null;
      timestamp: Date;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const where: {
        validationType?: string;
        validationResult?: string;
        tamperDetected?: boolean;
        timestamp?: {
          gte?: Date;
          lte?: Date;
        };
      } = {};

      if (options.validationType) {
        where.validationType = options.validationType;
      }
      if (options.validationResult) {
        where.validationResult = options.validationResult;
      }
      if (options.tamperDetected !== undefined) {
        where.tamperDetected = options.tamperDetected;
      }
      if (options.startDate || options.endDate) {
        where.timestamp = {};
        if (options.startDate) {
          where.timestamp.gte = options.startDate;
        }
        if (options.endDate) {
          where.timestamp.lte = options.endDate;
        }
      }

      const [logs, total] = await Promise.all([
        prisma.licenseValidationAudit.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { timestamp: 'desc' },
          select: {
            id: true,
            licenseKey: true,
            validationType: true,
            validationResult: true,
            tamperDetected: true,
            errorMessage: true,
            timestamp: true,
          },
        }),
        prisma.licenseValidationAudit.count({ where }),
      ]);

      return {
        logs: logs.map((log) => ({
          id: log.id,
          licenseKey: log.licenseKey,
          validationType: log.validationType,
          validationResult: log.validationResult,
          tamperDetected: log.tamperDetected,
          errorMessage: log.errorMessage,
          timestamp: log.timestamp,
        })),
        total,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error('Error getting validation audit logs', error);
      throw error;
    }
  }
}

// Singleton instance
export const secureLicenseValidationService = new SecureLicenseValidationService();

