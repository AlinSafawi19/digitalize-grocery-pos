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

export interface StoreInfo {
  name: string;
  address: string;
  phone: string;
  logo?: string; // Base64 encoded image data
}

export interface TaxConfig {
  defaultTaxRate: number;
  taxInclusive: boolean;
}

export interface PrinterSettings {
  paperWidth: number;
  autoPrint: boolean;
  printerName?: string;
}


export interface BusinessRules {
  roundingMethod: string;
  allowNegativeStock: boolean;
}

export interface NotificationSettings {
  soundEnabled: boolean;
  soundVolume: number;
  enabledTypes: string[];
  priorityFilter: string;
}

export interface CashDrawerSettings {
  autoOpen: boolean;
}

/**
 * Settings Service (Renderer)
 * Handles settings API calls via IPC
 */
export class SettingsService {
  /**
   * Get setting by key
   */
  static async getSetting(
    key: string,
    requestedById: number
  ): Promise<{ success: boolean; setting?: Setting | null; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:getSetting',
        key,
        requestedById
      ) as { success: boolean; setting?: Setting | null; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get setting value (typed)
   */
  static async getSettingValue<T = unknown>(
    key: string,
    defaultValue: T,
    requestedById: number
  ): Promise<{ success: boolean; value?: T; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:getSettingValue',
        key,
        defaultValue,
        requestedById
      ) as { success: boolean; value?: T; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get all settings
   */
  static async getAllSettings(
    options: SettingsListOptions,
    requestedById: number
  ): Promise<{
    success: boolean;
    settings?: Setting[];
    total?: number;
    page?: number;
    pageSize?: number;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:getAllSettings',
        options,
        requestedById
      ) as {
        success: boolean;
        settings?: Setting[];
        total?: number;
        page?: number;
        pageSize?: number;
        error?: string;
      };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Set setting (upsert)
   */
  static async setSetting(
    input: CreateSettingInput,
    requestedById: number
  ): Promise<{ success: boolean; setting?: Setting; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:setSetting',
        input,
        requestedById
      ) as { success: boolean; setting?: Setting; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update setting
   */
  static async updateSetting(
    key: string,
    input: UpdateSettingInput,
    requestedById: number
  ): Promise<{ success: boolean; setting?: Setting; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:updateSetting',
        key,
        input,
        requestedById
      ) as { success: boolean; setting?: Setting; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete setting
   */
  static async deleteSetting(
    key: string,
    requestedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:deleteSetting',
        key,
        requestedById
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get store information
   */
  static async getStoreInfo(
    requestedById: number
  ): Promise<{ success: boolean; storeInfo?: StoreInfo; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:getStoreInfo',
        requestedById
      ) as { success: boolean; storeInfo?: StoreInfo; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Set store information
   */
  static async setStoreInfo(
    info: {
      name?: string;
      address?: string;
      phone?: string;
      logo?: string;
    },
    requestedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:setStoreInfo',
        info,
        requestedById
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get tax configuration
   */
  static async getTaxConfig(
    requestedById: number
  ): Promise<{ success: boolean; taxConfig?: TaxConfig; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:getTaxConfig',
        requestedById
      ) as { success: boolean; taxConfig?: TaxConfig; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Set tax configuration
   */
  static async setTaxConfig(
    config: {
      defaultTaxRate?: number;
      taxInclusive?: boolean;
    },
    requestedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:setTaxConfig',
        config,
        requestedById
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get receipt template
   */
  static async getReceiptTemplate(
    requestedById: number
  ): Promise<{ success: boolean; template?: string; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:getReceiptTemplate',
        requestedById
      ) as { success: boolean; template?: string; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Set receipt template
   */
  static async setReceiptTemplate(
    template: string,
    requestedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:setReceiptTemplate',
        template,
        requestedById
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get printer settings
   */
  static async getPrinterSettings(
    requestedById: number
  ): Promise<{ success: boolean; printerSettings?: PrinterSettings; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:getPrinterSettings',
        requestedById
      ) as { success: boolean; printerSettings?: PrinterSettings; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Set printer settings
   */
  static async setPrinterSettings(
    settings: {
      paperWidth?: number;
      autoPrint?: boolean;
      printerName?: string;
    },
    requestedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:setPrinterSettings',
        settings,
        requestedById
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }


  /**
   * Get business rules
   */
  static async getBusinessRules(
    requestedById: number
  ): Promise<{ success: boolean; businessRules?: BusinessRules; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:getBusinessRules',
        requestedById
      ) as { success: boolean; businessRules?: BusinessRules; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Set business rules
   */
  static async setBusinessRules(
    rules: {
      roundingMethod?: string;
      allowNegativeStock?: boolean;
    },
    requestedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:setBusinessRules',
        rules,
        requestedById
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get notification settings
   */
  static async getNotificationSettings(
    requestedById: number
  ): Promise<{ success: boolean; notificationSettings?: NotificationSettings; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:getNotificationSettings',
        requestedById
      ) as { success: boolean; notificationSettings?: NotificationSettings; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Check if setup wizard is completed
   */
  static async isSetupCompleted(
    requestedById: number
  ): Promise<{ success: boolean; completed?: boolean; error?: string }> {
    try {
      const result = await this.getSettingValue<boolean>(
        'setup.completed',
        false,
        requestedById
      );
      return {
        success: true,
        completed: result.value || false,
      };
    } catch (error) {
      return {
        success: false,
        completed: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Set notification settings
   */
  static async setNotificationSettings(
    settings: {
      soundEnabled?: boolean;
      soundVolume?: number;
      enabledTypes?: string[];
      priorityFilter?: string;
    },
    requestedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:setNotificationSettings',
        settings,
        requestedById
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get cash drawer settings
   */
  static async getCashDrawerSettings(
    requestedById: number
  ): Promise<{ success: boolean; cashDrawerSettings?: CashDrawerSettings; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:getCashDrawerSettings',
        requestedById
      ) as { success: boolean; cashDrawerSettings?: CashDrawerSettings; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Set cash drawer settings
   */
  static async setCashDrawerSettings(
    settings: {
      autoOpen?: boolean;
    },
    requestedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'settings:setCashDrawerSettings',
        settings,
        requestedById
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

