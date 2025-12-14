import { ipcMain } from 'electron';
import { licenseService, ActivateLicenseInput } from '../services/license/license.service';
import { credentialsStorage } from '../services/license/credentialsStorage';
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
      
      // Credentials are sent via WhatsApp only, not returned to UI
      // Do not fetch or return credentials
      
      // Serialize Date objects to ISO strings for IPC (Electron IPC can't serialize Date objects)
      const serializedResult = {
        ...result,
        expiresAt: result.expiresAt instanceof Date ? result.expiresAt.toISOString() : result.expiresAt,
        gracePeriodEnd: result.gracePeriodEnd instanceof Date ? result.gracePeriodEnd.toISOString() : result.gracePeriodEnd,
        // Ensure credentials are not returned
        userCredentials: undefined,
      };
      
      logger.info('Returning activation result', {
        success: serializedResult.success,
        credentialsSentViaWhatsApp: true,
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

  logger.info('License IPC handlers registered');
}

