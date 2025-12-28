import axios, { AxiosInstance } from 'axios';
import { LICENSE_SERVER_URL } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { licenseStorage, LicenseData } from './licenseStorage';
import { getHardwareId, getMachineName } from './hardwareFingerprint';
import { databaseService } from '../database/database.service';
import { licenseService } from './license.service';

/**
 * License transfer status
 */
export type LicenseTransferStatus = 'pending' | 'approved' | 'completed' | 'cancelled' | 'failed';

/**
 * Initiate license transfer input
 */
export interface InitiateLicenseTransferInput {
  licenseKey: string;
  notes?: string;
}

/**
 * Initiate license transfer result
 */
export interface InitiateLicenseTransferResult {
  success: boolean;
  message: string;
  transferId?: number;
  transferToken?: string;
}

/**
 * Complete license transfer input
 */
export interface CompleteLicenseTransferInput {
  transferToken: string;
  licenseKey: string;
}

/**
 * Complete license transfer result
 */
export interface CompleteLicenseTransferResult {
  success: boolean;
  message: string;
  expiresAt?: Date;
  gracePeriodEnd?: Date;
  token?: string;
  locationId?: number;
  locationName?: string;
  locationAddress?: string;
}

/**
 * License transfer record
 */
export interface LicenseTransferRecord {
  id: number;
  licenseKey: string;
  sourceHardwareId: string;
  sourceMachineName: string | null;
  targetHardwareId: string | null;
  targetMachineName: string | null;
  status: LicenseTransferStatus;
  transferToken: string | null;
  initiatedBy: number | null;
  completedBy: number | null;
  initiatedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  errorMessage: string | null;
  notes: string | null;
}

/**
 * License transfer list options
 */
export interface LicenseTransferListOptions {
  page?: number;
  pageSize?: number;
  status?: LicenseTransferStatus;
  licenseKey?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * License transfer list response
 */
export interface LicenseTransferListResponse {
  transfers: LicenseTransferRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export class LicenseTransferService {
  private apiClient: AxiosInstance;
  private hardwareId: string;
  private machineName: string;

  constructor() {
    this.hardwareId = getHardwareId();
    this.machineName = getMachineName();
    
    this.apiClient = axios.create({
      baseURL: LICENSE_SERVER_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generate a unique transfer token
   */
  private generateTransferToken(): string {
    // Generate a random token (32 characters, alphanumeric)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Initiate a license transfer from the current device
   */
  async initiateTransfer(input: InitiateLicenseTransferInput, userId: number): Promise<InitiateLicenseTransferResult> {
    try {
      // Validate required fields
      if (!input.licenseKey || input.licenseKey.trim() === '') {
        return {
          success: false,
          message: 'License key is required',
        };
      }

      // Check if license is activated on this device
      const licenseData = await licenseService.getLicenseStatus();
      if (!licenseData) {
        return {
          success: false,
          message: 'No license is currently activated on this device',
        };
      }

      // Verify the license key matches the activated license
      const normalizedActivatedKey = licenseData.licenseKey.trim().toUpperCase().replace(/-/g, '');
      const normalizedInputKey = input.licenseKey.trim().toUpperCase().replace(/-/g, '');
      
      if (normalizedActivatedKey !== normalizedInputKey) {
        return {
          success: false,
          message: 'The provided license key does not match the currently activated license',
        };
      }

      logger.info('Initiating license transfer...', {
        licenseKey: input.licenseKey.substring(0, 8) + '...',
        sourceHardwareId: this.hardwareId.substring(0, 8) + '...',
      });

      // Request deactivation from license server
      try {
        const deactivateResponse = await this.apiClient.post('/api/license/deactivate', {
          licenseKey: input.licenseKey,
          hardwareId: this.hardwareId,
          reason: 'license_transfer',
        });

        if (!deactivateResponse.data.success) {
          logger.warn('License server deactivation failed', {
            message: deactivateResponse.data.message,
          });
          return {
            success: false,
            message: deactivateResponse.data.message || 'Failed to deactivate license on server',
          };
        }

        logger.info('License deactivated on server successfully');
      } catch (error: unknown) {
        const err = error as { code?: string; response?: { data?: { message?: string } }; message?: string };
        logger.error('Error deactivating license on server', {
          error: err.message,
          code: err.code,
        });

        // If it's a connection error, we can still proceed with local transfer record
        // but the transfer won't be complete until server is accessible
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
          logger.warn('Cannot connect to license server - creating transfer record locally only');
          // Continue with local transfer record creation
        } else {
          return {
            success: false,
            message: err.response?.data?.message || err.message || 'Failed to deactivate license on server',
          };
        }
      }

      // Generate transfer token
      const transferToken = this.generateTransferToken();

      // Create transfer record in database
      const prisma = databaseService.getClient();
      const transfer = await prisma.licenseTransfer.create({
        data: {
          licenseKey: input.licenseKey,
          sourceHardwareId: this.hardwareId,
          sourceMachineName: this.machineName,
          status: 'pending',
          transferToken,
          initiatedBy: userId,
          notes: input.notes || null,
        },
      });

      // Clear local license data (deactivate on this device)
      await licenseStorage.delete();
      logger.info('Local license data cleared');

      logger.info('License transfer initiated successfully', {
        transferId: transfer.id,
        transferToken: transferToken.substring(0, 8) + '...',
      });

      return {
        success: true,
        message: 'License transfer initiated successfully. Use the transfer token to activate the license on the target device.',
        transferId: transfer.id,
        transferToken,
      };
    } catch (error: unknown) {
      logger.error('Error initiating license transfer', error);
      const err = error as { message?: string };
      return {
        success: false,
        message: err.message || 'Failed to initiate license transfer',
      };
    }
  }

  /**
   * Complete a license transfer on the target device
   */
  async completeTransfer(input: CompleteLicenseTransferInput, userId: number): Promise<CompleteLicenseTransferResult> {
    try {
      // Validate required fields
      if (!input.transferToken || input.transferToken.trim() === '') {
        return {
          success: false,
          message: 'Transfer token is required',
        };
      }

      if (!input.licenseKey || input.licenseKey.trim() === '') {
        return {
          success: false,
          message: 'License key is required',
        };
      }

      logger.info('Completing license transfer...', {
        licenseKey: input.licenseKey.substring(0, 8) + '...',
        transferToken: input.transferToken.substring(0, 8) + '...',
        targetHardwareId: this.hardwareId.substring(0, 8) + '...',
      });

      // Find the transfer record
      const prisma = databaseService.getClient();
      const transfer = await prisma.licenseTransfer.findFirst({
        where: {
          transferToken: input.transferToken,
          licenseKey: input.licenseKey,
          status: {
            in: ['pending', 'approved'],
          },
        },
      });

      if (!transfer) {
        return {
          success: false,
          message: 'Invalid transfer token or license key. The transfer may have been cancelled or already completed.',
        };
      }

      // Check if transfer has expired (e.g., older than 7 days)
      const transferAge = Date.now() - new Date(transfer.initiatedAt).getTime();
      const maxTransferAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (transferAge > maxTransferAge) {
        // Mark transfer as failed
        await prisma.licenseTransfer.update({
          where: { id: transfer.id },
          data: {
            status: 'failed',
            errorMessage: 'Transfer token expired (older than 7 days)',
          },
        });

        return {
          success: false,
          message: 'Transfer token has expired. Please initiate a new transfer.',
        };
      }

      // Activate license on this device using the license service
      const activationResult = await licenseService.activateLicense({
        licenseKey: input.licenseKey,
      });

      if (!activationResult.success) {
        // Mark transfer as failed
        await prisma.licenseTransfer.update({
          where: { id: transfer.id },
          data: {
            status: 'failed',
            errorMessage: activationResult.message || 'License activation failed',
          },
        });

        return {
          success: false,
          message: activationResult.message || 'Failed to activate license on target device',
        };
      }

      // Update transfer record as completed
      await prisma.licenseTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'completed',
          targetHardwareId: this.hardwareId,
          targetMachineName: this.machineName,
          completedBy: userId,
          completedAt: new Date(),
        },
      });

      logger.info('License transfer completed successfully', {
        transferId: transfer.id,
      });

      return {
        success: true,
        message: 'License transfer completed successfully',
        expiresAt: activationResult.expiresAt,
        gracePeriodEnd: activationResult.gracePeriodEnd,
        token: activationResult.token,
        locationId: activationResult.locationId,
        locationName: activationResult.locationName,
        locationAddress: activationResult.locationAddress,
      };
    } catch (error: unknown) {
      logger.error('Error completing license transfer', error);
      const err = error as { message?: string };
      return {
        success: false,
        message: err.message || 'Failed to complete license transfer',
      };
    }
  }

  /**
   * Cancel a pending license transfer
   */
  async cancelTransfer(transferId: number, userId: number, reason?: string): Promise<{ success: boolean; message: string }> {
    try {
      const prisma = databaseService.getClient();
      
      // Find the transfer
      const transfer = await prisma.licenseTransfer.findUnique({
        where: { id: transferId },
      });

      if (!transfer) {
        return {
          success: false,
          message: 'Transfer not found',
        };
      }

      if (transfer.status !== 'pending' && transfer.status !== 'approved') {
        return {
          success: false,
          message: `Cannot cancel transfer with status: ${transfer.status}`,
        };
      }

      // Update transfer status
      await prisma.licenseTransfer.update({
        where: { id: transferId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: reason || null,
        },
      });

      logger.info('License transfer cancelled', {
        transferId,
        reason,
      });

      return {
        success: true,
        message: 'License transfer cancelled successfully',
      };
    } catch (error: unknown) {
      logger.error('Error cancelling license transfer', error);
      const err = error as { message?: string };
      return {
        success: false,
        message: err.message || 'Failed to cancel license transfer',
      };
    }
  }

  /**
   * Get license transfer history
   */
  async getTransferHistory(options: LicenseTransferListOptions = {}): Promise<LicenseTransferListResponse> {
    try {
      const prisma = databaseService.getClient();
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const skip = (page - 1) * pageSize;

      // Build where clause
      const where: any = {};
      
      if (options.status) {
        where.status = options.status;
      }
      
      if (options.licenseKey) {
        where.licenseKey = options.licenseKey;
      }
      
      if (options.startDate || options.endDate) {
        where.initiatedAt = {};
        if (options.startDate) {
          where.initiatedAt.gte = options.startDate;
        }
        if (options.endDate) {
          where.initiatedAt.lte = options.endDate;
        }
      }

      // Get total count
      const total = await prisma.licenseTransfer.count({ where });

      // Get transfers
      const transfers = await prisma.licenseTransfer.findMany({
        where,
        orderBy: {
          initiatedAt: 'desc',
        },
        skip,
        take: pageSize,
      });

      return {
        transfers: transfers.map(t => ({
          id: t.id,
          licenseKey: t.licenseKey,
          sourceHardwareId: t.sourceHardwareId,
          sourceMachineName: t.sourceMachineName,
          targetHardwareId: t.targetHardwareId,
          targetMachineName: t.targetMachineName,
          status: t.status as LicenseTransferStatus,
          transferToken: t.transferToken,
          initiatedBy: t.initiatedBy,
          completedBy: t.completedBy,
          initiatedAt: t.initiatedAt,
          completedAt: t.completedAt,
          cancelledAt: t.cancelledAt,
          cancellationReason: t.cancellationReason,
          errorMessage: t.errorMessage,
          notes: t.notes,
        })),
        total,
        page,
        pageSize,
      };
    } catch (error: unknown) {
      logger.error('Error getting license transfer history', error);
      return {
        transfers: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 20,
      };
    }
  }

  /**
   * Get a single license transfer by ID
   */
  async getTransferById(transferId: number): Promise<LicenseTransferRecord | null> {
    try {
      const prisma = databaseService.getClient();
      const transfer = await prisma.licenseTransfer.findUnique({
        where: { id: transferId },
      });

      if (!transfer) {
        return null;
      }

      return {
        id: transfer.id,
        licenseKey: transfer.licenseKey,
        sourceHardwareId: transfer.sourceHardwareId,
        sourceMachineName: transfer.sourceMachineName,
        targetHardwareId: transfer.targetHardwareId,
        targetMachineName: transfer.targetMachineName,
        status: transfer.status as LicenseTransferStatus,
        transferToken: transfer.transferToken,
        initiatedBy: transfer.initiatedBy,
        completedBy: transfer.completedBy,
        initiatedAt: transfer.initiatedAt,
        completedAt: transfer.completedAt,
        cancelledAt: transfer.cancelledAt,
        cancellationReason: transfer.cancellationReason,
        errorMessage: transfer.errorMessage,
        notes: transfer.notes,
      };
    } catch (error: unknown) {
      logger.error('Error getting license transfer by ID', error);
      return null;
    }
  }
}

// Singleton instance
export const licenseTransferService = new LicenseTransferService();

