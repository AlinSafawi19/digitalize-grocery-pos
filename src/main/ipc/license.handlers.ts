import { ipcMain } from 'electron';
import { licenseService, ActivateLicenseInput } from '../services/license/license.service';
import { credentialsStorage } from '../services/license/credentialsStorage';
import { secureLicenseValidationService } from '../services/license/secure-license-validation.service';
import { licenseTransferService, InitiateLicenseTransferInput, CompleteLicenseTransferInput } from '../services/license/license-transfer.service';
import { logger } from '../utils/logger';

/**
 * Register license-related IPC handlers
 */
export function registerLicenseHandlers(): void {
  logger.info('Registering license IPC handlers...');

  /**
   * Activate license
   * IPC: license:activate
   */
  ipcMain.handle('license:activate', async (_event, input: ActivateLicenseInput) => {
    try {
      logger.info('IPC: license:activate', { 
        licenseKey: input.licenseKey?.substring(0, 8) + '...'
      });
      const result = await licenseService.activateLicense(input);
      
      // Serialize Date objects to ISO strings for IPC (Electron IPC can't serialize Date objects)
      const serializedResult = {
        ...result,
        expiresAt: result.expiresAt instanceof Date ? result.expiresAt.toISOString() : result.expiresAt,
        gracePeriodEnd: result.gracePeriodEnd instanceof Date ? result.gracePeriodEnd.toISOString() : result.gracePeriodEnd,
      };
      
      logger.info('Returning activation result', {
        success: serializedResult.success,
        hasUserCredentials: !!serializedResult.userCredentials,
      });
      
      return serializedResult;
    } catch (error) {
      logger.error('IPC: license:activate error', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to activate license',
      };
    }
  });

  /**
   * Validate license
   * IPC: license:validate
   */
  ipcMain.handle('license:validate', async (_event, licenseKey?: string) => {
    try {
      logger.info('IPC: license:validate');
      const result = await licenseService.validateLicense(licenseKey);
      return result;
    } catch (error) {
      logger.error('IPC: license:validate error', error);
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Failed to validate license',
      };
    }
  });

  /**
   * Get license status
   * IPC: license:getStatus
   */
  ipcMain.handle('license:getStatus', async () => {
    try {
      logger.info('IPC: license:getStatus');
      const status = await licenseService.getLicenseStatus();
      return status;
    } catch (error) {
      logger.error('IPC: license:getStatus error', error);
      return null;
    }
  });

  /**
   * Check if license is activated
   * IPC: license:isActivated
   */
  ipcMain.handle('license:isActivated', async () => {
    try {
      const isActivated = await licenseService.isActivated();
      return isActivated;
    } catch (error) {
      logger.error('IPC: license:isActivated error', error);
      return false;
    }
  });

  /**
   * Check if license is expired
   * IPC: license:isExpired
   */
  ipcMain.handle('license:isExpired', async () => {
    try {
      const isExpired = await licenseService.isExpired();
      return isExpired;
    } catch (error) {
      logger.error('IPC: license:isExpired error', error);
      return true; // Default to expired on error
    }
  });

  /**
   * Check if license is valid (works across devices)
   * IPC: license:isValid
   */
  ipcMain.handle('license:isValid', async () => {
    try {
      const isValid = await licenseService.isValid();
      return isValid;
    } catch (error) {
      logger.error('IPC: license:isValid error', error);
      return false;
    }
  });

  /**
   * Get saved credentials (if they were saved during activation)
   * IPC: license:getCredentials
   */
  ipcMain.handle('license:getCredentials', async () => {
    try {
      logger.info('IPC: license:getCredentials');
      
      // Check if credentials file exists first
      const credentialsExist = await credentialsStorage.exists();
      if (!credentialsExist) {
        logger.info('Credentials file does not exist');
        return {
          success: false,
          message: 'No saved credentials found. Credentials are only saved when creating the first user during license activation. If users already existed in the system, credentials were not saved.',
        };
      }
      
      const credentials = await credentialsStorage.load();
      if (credentials) {
        // Return only username and password (exclude metadata)
        return {
          success: true,
          credentials: {
            username: credentials.username,
            password: credentials.password,
          },
        };
      }
      
      // If file exists but load returned null, there was a decryption error
      logger.warn('Credentials file exists but could not be loaded (decryption error?)');
      return {
        success: false,
        message: 'Saved credentials file found but could not be decrypted. This may happen if the hardware configuration has changed significantly.',
      };
    } catch (error) {
      logger.error('IPC: license:getCredentials error', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve credentials',
      };
    }
  });

  /**
   * Get payment history
   * IPC: license:getPaymentHistory
   */
  ipcMain.handle('license:getPaymentHistory', async () => {
    try {
      logger.info('IPC: license:getPaymentHistory');
      const payments = await licenseService.getPaymentHistory();
      return payments;
    } catch (error) {
      logger.error('IPC: license:getPaymentHistory error', error);
      return [];
    }
  });

  /**
   * Get subscription information including next payment fee
   * IPC: license:getSubscriptionInfo
   */
  ipcMain.handle('license:getSubscriptionInfo', async () => {
    try {
      logger.info('IPC: license:getSubscriptionInfo');
      const subscriptionInfo = await licenseService.getSubscriptionInfo();
      return subscriptionInfo;
    } catch (error) {
      logger.error('IPC: license:getSubscriptionInfo error', error);
      return {
        nextPaymentFee: null,
        nextPaymentDate: null,
        currentSubscription: null,
      };
    }
  });

  /**
   * Get validation audit logs
   * IPC: license:getValidationAuditLogs
   */
  ipcMain.handle('license:getValidationAuditLogs', async (_event, options: {
    page?: number;
    pageSize?: number;
    validationType?: 'online' | 'offline' | 'cached';
    validationResult?: 'valid' | 'invalid' | 'expired' | 'tampered' | 'error';
    tamperDetected?: boolean;
    startDate?: string;
    endDate?: string;
  }) => {
    try {
      logger.info('IPC: license:getValidationAuditLogs');
      const auditLogs = await secureLicenseValidationService.getValidationAuditLogs({
        ...options,
        startDate: options.startDate ? new Date(options.startDate) : undefined,
        endDate: options.endDate ? new Date(options.endDate) : undefined,
      });
      return auditLogs;
    } catch (error) {
      logger.error('IPC: license:getValidationAuditLogs error', error);
      return {
        logs: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 20,
      };
    }
  });

  /**
   * Initiate license transfer
   * IPC: license:initiateTransfer
   */
  ipcMain.handle('license:initiateTransfer', async (_event, input: InitiateLicenseTransferInput, userId: number) => {
    try {
      logger.info('IPC: license:initiateTransfer', {
        licenseKey: input.licenseKey?.substring(0, 8) + '...',
        userId,
      });
      const result = await licenseTransferService.initiateTransfer(input, userId);
      return result;
    } catch (error) {
      logger.error('IPC: license:initiateTransfer error', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to initiate license transfer',
      };
    }
  });

  /**
   * Complete license transfer
   * IPC: license:completeTransfer
   */
  ipcMain.handle('license:completeTransfer', async (_event, input: CompleteLicenseTransferInput, userId: number) => {
    try {
      logger.info('IPC: license:completeTransfer', {
        transferToken: input.transferToken?.substring(0, 8) + '...',
        licenseKey: input.licenseKey?.substring(0, 8) + '...',
        userId,
      });
      const result = await licenseTransferService.completeTransfer(input, userId);
      
      // Serialize Date objects to ISO strings for IPC
      const serializedResult = {
        ...result,
        expiresAt: result.expiresAt instanceof Date ? result.expiresAt.toISOString() : result.expiresAt,
        gracePeriodEnd: result.gracePeriodEnd instanceof Date ? result.gracePeriodEnd.toISOString() : result.gracePeriodEnd,
      };
      
      return serializedResult;
    } catch (error) {
      logger.error('IPC: license:completeTransfer error', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to complete license transfer',
      };
    }
  });

  /**
   * Cancel license transfer
   * IPC: license:cancelTransfer
   */
  ipcMain.handle('license:cancelTransfer', async (_event, transferId: number, userId: number, reason?: string) => {
    try {
      logger.info('IPC: license:cancelTransfer', { transferId, userId, reason });
      const result = await licenseTransferService.cancelTransfer(transferId, userId, reason);
      return result;
    } catch (error) {
      logger.error('IPC: license:cancelTransfer error', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to cancel license transfer',
      };
    }
  });

  /**
   * Get license transfer history
   * IPC: license:getTransferHistory
   */
  ipcMain.handle('license:getTransferHistory', async (_event, options: {
    page?: number;
    pageSize?: number;
    status?: 'pending' | 'approved' | 'completed' | 'cancelled' | 'failed';
    licenseKey?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    try {
      logger.info('IPC: license:getTransferHistory', { options });
      const result = await licenseTransferService.getTransferHistory({
        ...options,
        startDate: options.startDate ? new Date(options.startDate) : undefined,
        endDate: options.endDate ? new Date(options.endDate) : undefined,
      });
      
      // Serialize Date objects to ISO strings for IPC
      return {
        ...result,
        transfers: result.transfers.map(t => ({
          ...t,
          initiatedAt: t.initiatedAt instanceof Date ? t.initiatedAt.toISOString() : t.initiatedAt,
          completedAt: t.completedAt instanceof Date ? t.completedAt.toISOString() : t.completedAt,
          cancelledAt: t.cancelledAt instanceof Date ? t.cancelledAt.toISOString() : t.cancelledAt,
        })),
      };
    } catch (error) {
      logger.error('IPC: license:getTransferHistory error', error);
      return {
        transfers: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 20,
      };
    }
  });

  /**
   * Get license transfer by ID
   * IPC: license:getTransferById
   */
  ipcMain.handle('license:getTransferById', async (_event, transferId: number) => {
    try {
      logger.info('IPC: license:getTransferById', { transferId });
      const transfer = await licenseTransferService.getTransferById(transferId);
      
      if (!transfer) {
        return null;
      }
      
      // Serialize Date objects to ISO strings for IPC
      return {
        ...transfer,
        initiatedAt: transfer.initiatedAt instanceof Date ? transfer.initiatedAt.toISOString() : transfer.initiatedAt,
        completedAt: transfer.completedAt instanceof Date ? transfer.completedAt.toISOString() : transfer.completedAt,
        cancelledAt: transfer.cancelledAt instanceof Date ? transfer.cancelledAt.toISOString() : transfer.cancelledAt,
      };
    } catch (error) {
      logger.error('IPC: license:getTransferById error', error);
      return null;
    }
  });

  logger.info('License IPC handlers registered');
}

