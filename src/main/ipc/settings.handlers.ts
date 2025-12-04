import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  SettingsService,
  CreateSettingInput,
  UpdateSettingInput,
  SettingsListOptions,
} from '../services/settings/settings.service';

/**
 * Register settings IPC handlers
 */
export function registerSettingsHandlers(): void {
  logger.info('Registering settings IPC handlers...');

  /**
   * Get setting by key handler
   * IPC: settings:getSetting
   * Note: All users can read settings. Settings are shared across all users of the license.
   */
  ipcMain.handle(
    'settings:getSetting',
    async (_event, key: string) => {
      try {
        const setting = await SettingsService.getSetting(key);
        return {
          success: true,
          setting: setting || null,
        };
      } catch (error) {
        logger.error('Error in settings:getSetting handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get setting value (typed) handler
   * IPC: settings:getSettingValue
   */
  ipcMain.handle(
    'settings:getSettingValue',
    async (_event, key: string, defaultValue: unknown) => {
      try {
        const value = await SettingsService.getSettingValue(key, defaultValue);
        return {
          success: true,
          value,
        };
      } catch (error) {
        logger.error('Error in settings:getSettingValue handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get all settings handler
   * IPC: settings:getAllSettings
   */
  ipcMain.handle(
    'settings:getAllSettings',
    async (_event, options: SettingsListOptions) => {
      try {
        const result = await SettingsService.getAllSettings(options);
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        logger.error('Error in settings:getAllSettings handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Set setting (upsert) handler
   * IPC: settings:setSetting
   * Note: Only the main user (ID = 1) can modify settings. Settings are shared across all users.
   */
  ipcMain.handle(
    'settings:setSetting',
    async (_event, input: CreateSettingInput, requestedById: number) => {
      try {
        const setting = await SettingsService.setSetting(input, requestedById);
        return {
          success: true,
          setting,
        };
      } catch (error) {
        logger.error('Error in settings:setSetting handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update setting handler
   * IPC: settings:updateSetting
   * Note: Only the main user (ID = 1) can modify settings. Settings are shared across all users.
   */
  ipcMain.handle(
    'settings:updateSetting',
    async (_event, key: string, input: UpdateSettingInput, requestedById: number) => {
      try {
        const setting = await SettingsService.updateSetting(key, input, requestedById);
        return {
          success: true,
          setting,
        };
      } catch (error) {
        logger.error('Error in settings:updateSetting handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete setting handler
   * IPC: settings:deleteSetting
   * Note: Only the main user (ID = 1) can modify settings. Settings are shared across all users.
   */
  ipcMain.handle(
    'settings:deleteSetting',
    async (_event, key: string, requestedById: number) => {
      try {
        await SettingsService.deleteSetting(key, requestedById);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in settings:deleteSetting handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get store info handler
   * IPC: settings:getStoreInfo
   * Note: All users can read settings. Settings are shared across all users of the license.
   */
  ipcMain.handle(
    'settings:getStoreInfo',
    async () => {
      try {
        const storeInfo = await SettingsService.getStoreInfo();
        return {
          success: true,
          storeInfo,
        };
      } catch (error) {
        logger.error('Error in settings:getStoreInfo handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Set store info handler
   * IPC: settings:setStoreInfo
   * Note: Only the main user (ID = 1) can modify settings. Settings are shared across all users.
   */
  ipcMain.handle(
    'settings:setStoreInfo',
    async (
      _event,
      info: {
        name?: string;
        address?: string;
        phone?: string;
        logo?: string;
      },
      requestedById: number
    ) => {
      try {
        // Validate store name if provided
        if (info.name !== undefined && (!info.name || info.name.trim() === '')) {
          return {
            success: false,
            error: 'Store name is required',
          };
        }

        await SettingsService.setStoreInfo(info, requestedById);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in settings:setStoreInfo handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get tax config handler
   * IPC: settings:getTaxConfig
   */
  ipcMain.handle(
    'settings:getTaxConfig',
    async () => {
      try {
        const taxConfig = await SettingsService.getTaxConfig();
        return {
          success: true,
          taxConfig,
        };
      } catch (error) {
        logger.error('Error in settings:getTaxConfig handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Set tax config handler
   * IPC: settings:setTaxConfig
   * Note: Only the main user (ID = 1) can modify settings. Settings are shared across all users.
   */
  ipcMain.handle(
    'settings:setTaxConfig',
    async (
      _event,
      config: {
        defaultTaxRate?: number;
        taxInclusive?: boolean;
      },
      requestedById: number
    ) => {
      try {
        // Validate tax rate if provided
        if (config.defaultTaxRate !== undefined) {
          if (config.defaultTaxRate === null || config.defaultTaxRate < 0 || config.defaultTaxRate > 100) {
            return {
              success: false,
              error: 'Default tax rate is required and must be between 0 and 100',
            };
          }
        }

        await SettingsService.setTaxConfig(config, requestedById);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in settings:setTaxConfig handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get receipt template handler
   * IPC: settings:getReceiptTemplate
   */
  ipcMain.handle(
    'settings:getReceiptTemplate',
    async () => {
      try {
        const template = await SettingsService.getReceiptTemplate();
        return {
          success: true,
          template,
        };
      } catch (error) {
        logger.error('Error in settings:getReceiptTemplate handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Set receipt template handler
   * IPC: settings:setReceiptTemplate
   * Note: Only the main user (ID = 1) can modify settings. Settings are shared across all users.
   */
  ipcMain.handle(
    'settings:setReceiptTemplate',
    async (_event, template: string, requestedById: number) => {
      try {
        await SettingsService.setReceiptTemplate(template, requestedById);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in settings:setReceiptTemplate handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get printer settings handler
   * IPC: settings:getPrinterSettings
   */
  ipcMain.handle(
    'settings:getPrinterSettings',
    async () => {
      try {
        const printerSettings = await SettingsService.getPrinterSettings();
        return {
          success: true,
          printerSettings,
        };
      } catch (error) {
        logger.error('Error in settings:getPrinterSettings handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Set printer settings handler
   * IPC: settings:setPrinterSettings
   * Note: Only the main user (ID = 1) can modify settings. Settings are shared across all users.
   */
  ipcMain.handle(
    'settings:setPrinterSettings',
    async (
      _event,
      settings: {
        paperWidth?: number;
        autoPrint?: boolean;
        printerName?: string;
      },
      requestedById: number
    ) => {
      try {
        await SettingsService.setPrinterSettings(settings, requestedById);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in settings:setPrinterSettings handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );


  /**
   * Get business rules handler
   * IPC: settings:getBusinessRules
   */
  ipcMain.handle(
    'settings:getBusinessRules',
    async () => {
      try {
        const businessRules = await SettingsService.getBusinessRules();
        return {
          success: true,
          businessRules,
        };
      } catch (error) {
        logger.error('Error in settings:getBusinessRules handler', error);
        // Return defaults instead of failing - this ensures the app can still function
        return {
          success: true,
          businessRules: {
            roundingMethod: 'round',
            allowNegativeStock: false,
          },
        };
      }
    }
  );

  /**
   * Set business rules handler
   * IPC: settings:setBusinessRules
   * Note: Only the main user (ID = 1) can modify settings. Settings are shared across all users.
   */
  ipcMain.handle(
    'settings:setBusinessRules',
    async (
      _event,
      rules: {
        roundingMethod?: string;
        minTransactionAmount?: number;
        allowNegativeStock?: boolean;
      },
      requestedById: number
    ) => {
      try {
        await SettingsService.setBusinessRules(rules, requestedById);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in settings:setBusinessRules handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );
  
  /**
   * Get notification settings handler
   * IPC: settings:getNotificationSettings
   */
  ipcMain.handle(
    'settings:getNotificationSettings',
    async () => {
      try {
        const notificationSettings = await SettingsService.getNotificationSettings();
        return {
          success: true,
          notificationSettings,
        };
      } catch (error) {
        logger.error('Error in settings:getNotificationSettings handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Set notification settings handler
   * IPC: settings:setNotificationSettings
   * Note: Only the main user (ID = 1) can modify settings. Settings are shared across all users.
   */
  ipcMain.handle(
    'settings:setNotificationSettings',
    async (
      _event,
      settings: {
        soundEnabled?: boolean;
        soundVolume?: number;
        enabledTypes?: string[];
        priorityFilter?: string;
      },
      requestedById: number
    ) => {
      try {
        await SettingsService.setNotificationSettings(settings, requestedById);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in settings:setNotificationSettings handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get cash drawer settings handler
   * IPC: settings:getCashDrawerSettings
   */
  ipcMain.handle(
    'settings:getCashDrawerSettings',
    async () => {
      try {
        const cashDrawerSettings = await SettingsService.getCashDrawerSettings();
        return {
          success: true,
          cashDrawerSettings,
        };
      } catch (error) {
        logger.error('Error in settings:getCashDrawerSettings handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Set cash drawer settings handler
   * IPC: settings:setCashDrawerSettings
   * Note: Only the main user (ID = 1) can modify settings. Settings are shared across all users.
   */
  ipcMain.handle(
    'settings:setCashDrawerSettings',
    async (
      _event,
      settings: {
        autoOpen?: boolean;
      },
      requestedById: number
    ) => {
      try {
        await SettingsService.setCashDrawerSettings(settings, requestedById);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in settings:setCashDrawerSettings handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  logger.info('Settings IPC handlers registered');
}

