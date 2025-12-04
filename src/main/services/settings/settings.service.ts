import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';
import { Prisma } from '@prisma/client';

export type SettingType = 'string' | 'number' | 'boolean' | 'json';

export interface Setting {
  id: number;
  key: string;
  value: string;
  type: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSettingInput {
  key: string;
  value: string;
  type?: SettingType;
  description?: string | null;
}

export interface UpdateSettingInput {
  value?: string;
  type?: SettingType;
  description?: string | null;
}

export interface SettingsListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
}

/**
 * Settings Service
 * Handles system settings management
 */
export class SettingsService {
  /**
   * Check if a user is the main user (ID = 1)
   * Main user is the primary user created during license activation
   * Only the main user can modify settings that apply to all users
   */
  private static isMainUser(userId?: number): boolean {
    return userId === 1;
  }

  /**
   * Validate that only main user can modify settings
   * Throws error if user is not the main user
   */
  private static validateMainUserAccess(userId?: number): void {
    if (!this.isMainUser(userId)) {
      throw new Error('Only the main user can modify settings. Settings are shared across all users of the license.');
    }
  }

  /**
   * Get a setting by key
   */
  static async getSetting(key: string): Promise<Setting | null> {
    try {
      const prisma = databaseService.getClient();
      const setting = await prisma.setting.findUnique({
        where: { key },
      });

      return setting;
    } catch (error) {
      logger.error('Error getting setting', error);
      throw error;
    }
  }

  /**
   * Get setting value (typed)
   */
  static async getSettingValue<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    try {
      const setting = await this.getSetting(key);
      if (!setting) {
        return defaultValue as T;
      }

      return this.parseSettingValue(setting.value, setting.type as SettingType) as T;
    } catch (error) {
      logger.error('Error getting setting value', error);
      return defaultValue as T;
    }
  }

  /**
   * Get multiple settings by keys
   */
  static async getSettings(keys: string[]): Promise<Setting[]> {
    try {
      const prisma = databaseService.getClient();
      const settings = await prisma.setting.findMany({
        where: {
          key: {
            in: keys,
          },
        },
      });

      return settings;
    } catch (error) {
      logger.error('Error getting settings', error);
      throw error;
    }
  }

  /**
   * Get all settings with pagination
   */
  static async getAllSettings(
    options: SettingsListOptions = {}
  ): Promise<{
    settings: Setting[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const page = options.page || 1;
      const pageSize = options.pageSize || 100;
      const skip = (page - 1) * pageSize;

      const where: Prisma.SettingWhereInput = {};
      if (options.search) {
        where.OR = [
          { key: { contains: options.search } },
          { description: { contains: options.search } },
        ];
      }

      const [settings, total] = await Promise.all([
        prisma.setting.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { key: 'asc' },
        }),
        prisma.setting.count({ where }),
      ]);

      return {
        settings,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error('Error getting all settings', error);
      throw error;
    }
  }

  /**
   * Create or update a setting (upsert)
   * Only the main user (ID = 1) can modify settings
   */
  static async setSetting(
    input: CreateSettingInput,
    userId?: number
  ): Promise<Setting> {
    try {
      // Validate that only main user can modify settings
      this.validateMainUserAccess(userId);

      const prisma = databaseService.getClient();

      // Validate value based on type
      const validatedValue = this.validateSettingValue(
        input.value,
        input.type || 'string'
      );

      const setting = await prisma.setting.upsert({
        where: { key: input.key },
        update: {
          value: validatedValue,
          type: input.type || 'string',
          description: input.description || null,
        },
        create: {
          key: input.key,
          value: validatedValue,
          type: input.type || 'string',
          description: input.description || null,
        },
      });

      // Log audit
      if (userId) {
        await AuditLogService.log({
          userId,
          action: 'update',
          entity: 'setting',
          entityId: setting.id,
          details: JSON.stringify({ key: setting.key, value: setting.value }),
        });
      }

      logger.info('Setting saved', {
        key: setting.key,
        type: setting.type,
      });

      return setting;
    } catch (error) {
      logger.error('Error setting setting', error);
      throw error;
    }
  }

  /**
   * Update a setting
   * Only the main user (ID = 1) can modify settings
   */
  static async updateSetting(
    key: string,
    input: UpdateSettingInput,
    userId?: number
  ): Promise<Setting> {
    try {
      // Validate that only main user can modify settings
      this.validateMainUserAccess(userId);

      const prisma = databaseService.getClient();

      // Get existing setting to preserve type if not provided
      const existing = await prisma.setting.findUnique({
        where: { key },
      });

      if (!existing) {
        throw new Error(`Setting with key "${key}" not found`);
      }

      const type = input.type || (existing.type as SettingType);
      const validatedValue = input.value
        ? this.validateSettingValue(input.value, type)
        : existing.value;

      const setting = await prisma.setting.update({
        where: { key },
        data: {
          value: validatedValue,
          type: input.type || existing.type,
          description: input.description !== undefined ? input.description : existing.description,
        },
      });

      // Log audit
      if (userId) {
        await AuditLogService.log({
          userId,
          action: 'update',
          entity: 'setting',
          entityId: setting.id,
          details: JSON.stringify({ key: setting.key, value: setting.value }),
        });
      }

      logger.info('Setting updated', {
        key: setting.key,
        type: setting.type,
      });

      return setting;
    } catch (error) {
      logger.error('Error updating setting', error);
      throw error;
    }
  }

  /**
   * Delete a setting
   * Only the main user (ID = 1) can modify settings
   */
  static async deleteSetting(key: string, userId?: number): Promise<void> {
    try {
      // Validate that only main user can modify settings
      this.validateMainUserAccess(userId);

      const prisma = databaseService.getClient();

      const setting = await prisma.setting.findUnique({
        where: { key },
      });

      if (!setting) {
        throw new Error(`Setting with key "${key}" not found`);
      }

      await prisma.setting.delete({
        where: { key },
      });

      // Log audit
      if (userId) {
        await AuditLogService.log({
          userId,
          action: 'delete',
          entity: 'setting',
          entityId: setting.id,
          details: JSON.stringify({ key: setting.key }),
        });
      }

      logger.info('Setting deleted', { key });
    } catch (error) {
      logger.error('Error deleting setting', error);
      throw error;
    }
  }

  /**
   * Parse setting value based on type
   */
  static parseSettingValue(value: string, type: SettingType): unknown {
    try {
      switch (type) {
        case 'number':
          return parseFloat(value);
        case 'boolean':
          return value === 'true' || value === '1';
        case 'json':
          return JSON.parse(value);
        case 'string':
        default:
          return value;
      }
    } catch (error) {
      logger.error('Error parsing setting value', error);
      return value;
    }
  }

  /**
   * Validate and format setting value based on type
   */
  static validateSettingValue(value: string, type: SettingType): string {
    try {
      switch (type) {
        case 'number': {
          const num = parseFloat(value);
          if (isNaN(num)) {
            throw new Error(`Invalid number value: ${value}`);
          }
          return value;
        }
        case 'boolean':
          if (value !== 'true' && value !== 'false' && value !== '1' && value !== '0') {
            throw new Error(`Invalid boolean value: ${value}`);
          }
          return value === 'true' || value === '1' ? 'true' : 'false';
        case 'json':
          // Validate JSON
          JSON.parse(value);
          return value;
        case 'string':
        default:
          return value;
      }
    } catch (error) {
      logger.error('Error validating setting value', error);
      throw error;
    }
  }

  /**
   * Get store information settings
   */
  static async getStoreInfo(): Promise<{
    name: string;
    address: string;
    phone: string;
    logo?: string;
  }> {
    const [name, address, phone, logo] = await Promise.all([
      this.getSettingValue<string>('store.name', ''),
      this.getSettingValue<string>('store.address', ''),
      this.getSettingValue<string>('store.phone', ''),
      this.getSettingValue<string>('store.logo', ''),
    ]);

    return { 
      name, 
      address, 
      phone,
      logo: logo || undefined,
    };
  }

  /**
   * Set store information
   * Only the main user (ID = 1) can modify settings
   */
  static async setStoreInfo(
    info: {
      name?: string;
      address?: string;
      phone?: string;
      logo?: string;
    },
    userId?: number
  ): Promise<void> {
    // Validate that only main user can modify settings
    this.validateMainUserAccess(userId);

    const promises: Promise<Setting>[] = [];

    if (info.name !== undefined) {
      promises.push(
        this.setSetting({ key: 'store.name', value: info.name, type: 'string' }, userId)
      );
    }
    if (info.address !== undefined) {
      promises.push(
        this.setSetting({ key: 'store.address', value: info.address, type: 'string' }, userId)
      );
    }
    if (info.phone !== undefined) {
      promises.push(
        this.setSetting({ key: 'store.phone', value: info.phone, type: 'string' }, userId)
      );
    }
    if (info.logo !== undefined) {
      promises.push(
        this.setSetting({ key: 'store.logo', value: info.logo, type: 'string' }, userId)
      );
    }

    await Promise.all(promises);
  }

  /**
   * Get tax configuration
   */
  static async getTaxConfig(): Promise<{
    defaultTaxRate: number;
    taxInclusive: boolean;
  }> {
    const [defaultTaxRate, taxInclusive] = await Promise.all([
      this.getSettingValue<number>('tax.defaultRate', 0),
      this.getSettingValue<boolean>('tax.inclusive', false),
    ]);

    return { defaultTaxRate, taxInclusive };
  }

  /**
   * Set tax configuration
   * Only the main user (ID = 1) can modify settings
   */
  static async setTaxConfig(
    config: {
      defaultTaxRate?: number;
      taxInclusive?: boolean;
    },
    userId?: number
  ): Promise<void> {
    // Validate that only main user can modify settings
    this.validateMainUserAccess(userId);

    const promises: Promise<Setting>[] = [];

    if (config.defaultTaxRate !== undefined) {
      promises.push(
        this.setSetting(
          { key: 'tax.defaultRate', value: config.defaultTaxRate.toString(), type: 'number' },
          userId
        )
      );
    }
    if (config.taxInclusive !== undefined) {
      promises.push(
        this.setSetting(
          { key: 'tax.inclusive', value: config.taxInclusive.toString(), type: 'boolean' },
          userId
        )
      );
    }

    await Promise.all(promises);
  }

  /**
   * Get receipt template
   */
  static async getReceiptTemplate(): Promise<string> {
    return this.getSettingValue<string>(
      'receipt.template',
      '{{storeLogo}}\n{{storeName}}\n{{storeAddress}}\n{{storePhone}}\n\nReceipt #{{transactionNumber}}\nDate: {{date}}\nCashier: {{cashier}}\n\n{{items}}\n\nSubtotal: {{subtotal}}\n{{discount}}\nTax: {{tax}}\nTotal: {{total}}\n\n{{payment}}\n\n{{exchangeRate}}\n{{vatRate}}\n\nThank you for your purchase!\nWe hope to see you again soon!\n\nPowered by DigitalizePOS'
    );
  }

  /**
   * Set receipt template
   * Only the main user (ID = 1) can modify settings
   */
  static async setReceiptTemplate(template: string, userId?: number): Promise<void> {
    // Validate that only main user can modify settings
    this.validateMainUserAccess(userId);

    await this.setSetting(
      { key: 'receipt.template', value: template, type: 'string' },
      userId
    );
  }

  /**
   * Get printer settings
   */
  static async getPrinterSettings(): Promise<{
    paperWidth: number;
    autoPrint: boolean;
    printerName?: string;
  }> {
    const [paperWidth, autoPrint, printerName] = await Promise.all([
      this.getSettingValue<number>('printer.paperWidth', 80),
      this.getSettingValue<boolean>('printer.autoPrint', true),
      this.getSettingValue<string>('printer.name', ''),
    ]);

    return { 
      paperWidth, 
      autoPrint,
      printerName: printerName || undefined,
    };
  }

  /**
   * Set printer settings
   * Only the main user (ID = 1) can modify settings
   */
  static async setPrinterSettings(
    settings: {
      paperWidth?: number;
      autoPrint?: boolean;
      printerName?: string;
    },
    userId?: number
  ): Promise<void> {
    // Validate that only main user can modify settings
    this.validateMainUserAccess(userId);

    const promises: Promise<Setting>[] = [];

    if (settings.paperWidth !== undefined) {
      promises.push(
        this.setSetting(
          { key: 'printer.paperWidth', value: settings.paperWidth.toString(), type: 'number' },
          userId
        )
      );
    }
    if (settings.autoPrint !== undefined) {
      promises.push(
        this.setSetting(
          { key: 'printer.autoPrint', value: settings.autoPrint.toString(), type: 'boolean' },
          userId
        )
      );
    }
    if (settings.printerName !== undefined) {
      promises.push(
        this.setSetting(
          { key: 'printer.name', value: settings.printerName || '', type: 'string' },
          userId
        )
      );
    }

    await Promise.all(promises);
  }

  /**
   * Get cash drawer settings
   */
  static async getCashDrawerSettings(): Promise<{
    autoOpen: boolean;
  }> {
    const autoOpen = await this.getSettingValue<boolean>('cashDrawer.autoOpen', false);

    return { autoOpen };
  }

  /**
   * Set cash drawer settings
   * Only the main user (ID = 1) can modify settings
   */
  static async setCashDrawerSettings(
    settings: {
      autoOpen?: boolean;
    },
    userId?: number
  ): Promise<void> {
    // Validate that only main user can modify settings
    this.validateMainUserAccess(userId);

    const promises: Promise<Setting>[] = [];

    if (settings.autoOpen !== undefined) {
      promises.push(
        this.setSetting(
          { key: 'cashDrawer.autoOpen', value: settings.autoOpen.toString(), type: 'boolean' },
          userId
        )
      );
    }

    await Promise.all(promises);
  }

  /**
   * Get business rules
   * If settings don't exist, initializes them automatically (for first-time setup)
   */
  static async getBusinessRules(): Promise<{
    roundingMethod: string;
    allowNegativeStock: boolean;
  }> {
    try {
      // Check if settings exist by trying to get a known setting
      const testSetting = await this.getSetting('business.roundingMethod');
      
      // If settings don't exist, initialize them (this can happen if initialization failed during user creation)
      if (!testSetting) {
        logger.info('Business rules settings not found, initializing default settings...');
        // Get the first user (ID = 1) to initialize settings
        const { UserService } = await import('../user/user.service');
        const firstUser = await UserService.getUserById(1);
        if (firstUser) {
          try {
            await this.initializeDefaultSettings(firstUser.id);
            logger.info('Default settings initialized successfully');
          } catch (initError) {
            logger.error('Failed to initialize default settings in getBusinessRules', initError);
            // Continue with defaults even if initialization fails
          }
        }
      }
      
    const [roundingMethod, allowNegativeStock] = await Promise.all([
      this.getSettingValue<string>('business.roundingMethod', 'round'),
      this.getSettingValue<boolean>('business.allowNegativeStock', false),
    ]);

    return { roundingMethod, allowNegativeStock };
    } catch (error) {
      logger.error('Error getting business rules, returning defaults', error);
      // Return defaults even if there's an error
      return {
        roundingMethod: 'round',
        allowNegativeStock: false,
      };
    }
  }

  /**
   * Set business rules
   * Only the main user (ID = 1) can modify settings
   */
  static async setBusinessRules(
    rules: {
      roundingMethod?: string;
      allowNegativeStock?: boolean;
    },
    userId?: number
  ): Promise<void> {
    // Validate that only main user can modify settings
    this.validateMainUserAccess(userId);

    const promises: Promise<Setting>[] = [];

    if (rules.roundingMethod !== undefined) {
      promises.push(
        this.setSetting(
          { key: 'business.roundingMethod', value: rules.roundingMethod, type: 'string' },
          userId
        )
      );
    }
    if (rules.allowNegativeStock !== undefined) {
      promises.push(
        this.setSetting(
          {
            key: 'business.allowNegativeStock',
            value: rules.allowNegativeStock.toString(),
            type: 'boolean',
          },
          userId
        )
      );
    }

    await Promise.all(promises);
  }

  /**
   * Get notification settings
   */
  static async getNotificationSettings(): Promise<{
    soundEnabled: boolean;
    soundVolume: number;
    enabledTypes: string[];
    priorityFilter: string;
  }> {
    const [soundEnabled, soundVolume, enabledTypesJson, priorityFilter] = await Promise.all([
      this.getSettingValue<boolean>('notifications.soundEnabled', true),
      this.getSettingValue<number>('notifications.soundVolume', 0.5),
      this.getSettingValue<string>('notifications.enabledTypes', '[]'),
      this.getSettingValue<string>('notifications.priorityFilter', 'all'),
    ]);

    let enabledTypes: string[] = [];
    try {
      enabledTypes = JSON.parse(enabledTypesJson);
    } catch {
      enabledTypes = [];
    }

    return { soundEnabled, soundVolume, enabledTypes, priorityFilter };
  }

  /**
   * Set notification settings
   * Only the main user (ID = 1) can modify settings
   */
  static async setNotificationSettings(
    settings: {
      soundEnabled?: boolean;
      soundVolume?: number;
      enabledTypes?: string[];
      priorityFilter?: string;
    },
    userId?: number
  ): Promise<void> {
    // Validate that only main user can modify settings
    this.validateMainUserAccess(userId);

    const promises: Promise<Setting>[] = [];

    if (settings.soundEnabled !== undefined) {
      promises.push(
        this.setSetting(
          { key: 'notifications.soundEnabled', value: settings.soundEnabled.toString(), type: 'boolean' },
          userId
        )
      );
    }
    if (settings.soundVolume !== undefined) {
      promises.push(
        this.setSetting(
          { key: 'notifications.soundVolume', value: settings.soundVolume.toString(), type: 'number' },
          userId
        )
      );
    }
    if (settings.enabledTypes !== undefined) {
      promises.push(
        this.setSetting(
          { key: 'notifications.enabledTypes', value: JSON.stringify(settings.enabledTypes), type: 'json' },
          userId
        )
      );
    }
    if (settings.priorityFilter !== undefined) {
      promises.push(
        this.setSetting(
          { key: 'notifications.priorityFilter', value: settings.priorityFilter, type: 'string' },
          userId
        )
      );
    }

    await Promise.all(promises);
  }

  /**
   * Initialize default settings for a new account
   * This should be called when creating the first user
   * @param userId User ID for audit logging
   */
  static async initializeDefaultSettings(userId: number): Promise<void> {
    try {
      logger.info('Initializing default settings', { userId });

      // Get license information to use as defaults for store information
      let storeName = '';
      let storeAddress = '';
      try {
        const { licenseService } = await import('../license/license.service');
        const licenseData = await licenseService.getLicenseStatus();
        if (licenseData) {
          storeName = licenseData.locationName || '';
          storeAddress = licenseData.locationAddress || '';
          logger.info('Using license information for default store settings', {
            storeName,
            storeAddress,
          });
        }
      } catch (licenseError) {
        // Log but don't fail if license data is not available
        logger.warn('Could not load license data for default settings', licenseError);
      }

      const defaultSettings: Array<{
        key: string;
        value: string;
        type: SettingType;
        description?: string;
      }> = [
        // Store Information
        { key: 'store.name', value: storeName, type: 'string', description: 'Store name' },
        { key: 'store.address', value: storeAddress, type: 'string', description: 'Store address' },
        { key: 'store.phone', value: '', type: 'string', description: 'Store phone number' },

        // Tax Configuration
        { key: 'tax.defaultRate', value: '0', type: 'number', description: 'Default tax rate percentage' },
        { key: 'tax.inclusive', value: 'false', type: 'boolean', description: 'Whether tax is included in prices' },

        // Receipt Template
        {
          key: 'receipt.template',
          value: '{{storeLogo}}\n{{storeName}}\n{{storeAddress}}\n{{storePhone}}\n\nReceipt #{{transactionNumber}}\nDate: {{date}}\nCashier: {{cashier}}\n\n{{items}}\n\nSubtotal: {{subtotal}}\n{{discount}}\nTax: {{tax}}\nTotal: {{total}}\n\n{{payment}}\n\n{{exchangeRate}}\n{{vatRate}}\n\nThank you for your purchase!\nWe hope to see you again soon!\n\nPowered by DigitalizePOS',
          type: 'string',
          description: 'Receipt template',
        },

        // Printer Settings
        { key: 'printer.paperWidth', value: '80', type: 'number', description: 'Printer paper width in mm' },
        { key: 'printer.autoPrint', value: 'true', type: 'boolean', description: 'Automatically print receipts' },
        { key: 'printer.name', value: '', type: 'string', description: 'Printer name (leave empty for default printer)' },

        // Cash Drawer Settings
        { key: 'cashDrawer.autoOpen', value: 'false', type: 'boolean', description: 'Automatically open cash drawer when transaction completes' },

        // Barcode Scanner Settings
        { key: 'barcode.enabled', value: 'true', type: 'boolean', description: 'Enable barcode scanner' },
        { key: 'barcode.beepOnScan', value: 'false', type: 'boolean', description: 'Beep sound on barcode scan' },

        // Business Rules
        { key: 'business.roundingMethod', value: 'round', type: 'string', description: 'Price rounding method' },
        { key: 'business.allowNegativeStock', value: 'false', type: 'boolean', description: 'Allow negative stock levels' },

        // Notification Settings
        { key: 'notifications.soundEnabled', value: 'true', type: 'boolean', description: 'Enable notification sounds' },
        { key: 'notifications.soundVolume', value: '0.5', type: 'number', description: 'Notification sound volume (0-1)' },
        { key: 'notifications.enabledTypes', value: '[]', type: 'json', description: 'Enabled notification types' },
        { key: 'notifications.priorityFilter', value: 'all', type: 'string', description: 'Notification priority filter' },

        // Currency Settings
        { key: 'currency.usdToLbp', value: '89000', type: 'number', description: 'USD to LBP exchange rate (1 USD = X LBP)' },
      ];

      // Create all default settings in parallel
      // Pass userId (main user) to allow settings creation during initialization
      const promises = defaultSettings.map((setting) =>
        this.setSetting(
          {
            key: setting.key,
            value: setting.value,
            type: setting.type,
            description: setting.description,
          },
          userId // Pass userId for main user validation
        )
      );

      await Promise.all(promises);

      logger.info('Default settings initialized successfully', {
        userId,
        count: defaultSettings.length,
      });
    } catch (error) {
      logger.error('Error initializing default settings', error);
      throw error;
    }
  }
}

