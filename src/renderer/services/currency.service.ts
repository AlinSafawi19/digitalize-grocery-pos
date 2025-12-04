export interface CurrencyConfig {
  usdToLbp: number;
  lastUpdated?: Date;
  updatedBy?: number;
}

export interface CurrencyAmounts {
  usd: number;
  lbp: number;
}

/**
 * Currency Service (Frontend)
 * Wraps IPC calls for currency operations
 */
export class CurrencyService {
  /**
   * Get current exchange rate (USD to LBP)
   */
  static async getExchangeRate(): Promise<number> {
    try {
      const result = await window.electron.ipcRenderer.invoke('currency:getExchangeRate') as { success: boolean; rate?: number; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to get exchange rate');
      }
      return result.rate!;
    } catch (error) {
      console.error('Error getting exchange rate:', error);
      throw error;
    }
  }

  /**
   * Set exchange rate (USD to LBP)
   */
  static async setExchangeRate(rate: number, userId: number): Promise<void> {
    try {
      const result = await window.electron.ipcRenderer.invoke('currency:setExchangeRate', rate, userId) as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to set exchange rate');
      }
    } catch (error) {
      console.error('Error setting exchange rate:', error);
      throw error;
    }
  }

  /**
   * Get currency configuration
   */
  static async getCurrencyConfig(): Promise<CurrencyConfig> {
    try {
      const result = await window.electron.ipcRenderer.invoke('currency:getCurrencyConfig') as { success: boolean; config?: CurrencyConfig; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to get currency config');
      }
      return result.config!;
    } catch (error) {
      console.error('Error getting currency config:', error);
      throw error;
    }
  }

  /**
   * Convert USD to LBP
   */
  static async convertUsdToLbp(usdAmount: number): Promise<number> {
    try {
      const result = await window.electron.ipcRenderer.invoke('currency:convertUsdToLbp', usdAmount) as { success: boolean; amount?: number; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to convert USD to LBP');
      }
      return result.amount!;
    } catch (error) {
      console.error('Error converting USD to LBP:', error);
      throw error;
    }
  }

  /**
   * Convert LBP to USD
   */
  static async convertLbpToUsd(lbpAmount: number): Promise<number> {
    try {
      const result = await window.electron.ipcRenderer.invoke('currency:convertLbpToUsd', lbpAmount) as { success: boolean; amount?: number; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to convert LBP to USD');
      }
      return result.amount!;
    } catch (error) {
      console.error('Error converting LBP to USD:', error);
      throw error;
    }
  }

  /**
   * Get dual currency amounts for a given amount in a specific currency
   */
  static async getDualCurrencyAmounts(
    amount: number,
    currency: string
  ): Promise<CurrencyAmounts> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'currency:getDualCurrencyAmounts',
        amount,
        currency
      ) as { success: boolean; amounts?: CurrencyAmounts; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to get dual currency amounts');
      }
      return result.amounts!;
    } catch (error) {
      console.error('Error getting dual currency amounts:', error);
      throw error;
    }
  }

  /**
   * Sum amounts in different currencies
   */
  static async sumDualCurrencyAmounts(
    amounts: Array<{ amount: number; currency: string }>
  ): Promise<CurrencyAmounts> {
    try {
      const result = await window.electron.ipcRenderer.invoke('currency:sumDualCurrencyAmounts', amounts) as { success: boolean; totals?: CurrencyAmounts; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to sum dual currency amounts');
      }
      return result.totals!;
    } catch (error) {
      console.error('Error summing dual currency amounts:', error);
      throw error;
    }
  }
}

