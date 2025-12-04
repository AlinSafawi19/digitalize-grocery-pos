import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { CurrencyService } from '../services/currency/currency.service';

/**
 * Register currency IPC handlers
 */
export function registerCurrencyHandlers(): void {
  logger.info('Registering currency IPC handlers...');

  /**
   * Get exchange rate handler
   * IPC: currency:getExchangeRate
   */
  ipcMain.handle('currency:getExchangeRate', async () => {
    try {
      const rate = await CurrencyService.getExchangeRate();
      return {
        success: true,
        rate,
      };
    } catch (error) {
      logger.error('Error in currency:getExchangeRate handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Set exchange rate handler
   * IPC: currency:setExchangeRate
   */
  ipcMain.handle(
    'currency:setExchangeRate',
    async (_event, rate: number, requestedById: number) => {
      try {
        // Validate exchange rate
        if (rate === undefined || rate === null || rate <= 0) {
          return {
            success: false,
            error: 'Exchange rate is required and must be greater than 0',
          };
        }

        await CurrencyService.setExchangeRate(rate, requestedById);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in currency:setExchangeRate handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get currency configuration handler
   * IPC: currency:getCurrencyConfig
   */
  ipcMain.handle('currency:getCurrencyConfig', async () => {
    try {
      const config = await CurrencyService.getCurrencyConfig();
      return {
        success: true,
        config,
      };
    } catch (error) {
      logger.error('Error in currency:getCurrencyConfig handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Convert USD to LBP handler
   * IPC: currency:convertUsdToLbp
   */
  ipcMain.handle('currency:convertUsdToLbp', async (_event, usdAmount: number) => {
    try {
      const lbpAmount = await CurrencyService.convertUsdToLbp(usdAmount);
      return {
        success: true,
        amount: lbpAmount,
      };
    } catch (error) {
      logger.error('Error in currency:convertUsdToLbp handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Convert LBP to USD handler
   * IPC: currency:convertLbpToUsd
   */
  ipcMain.handle('currency:convertLbpToUsd', async (_event, lbpAmount: number) => {
    try {
      const usdAmount = await CurrencyService.convertLbpToUsd(lbpAmount);
      return {
        success: true,
        amount: usdAmount,
      };
    } catch (error) {
      logger.error('Error in currency:convertLbpToUsd handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get dual currency amounts handler
   * IPC: currency:getDualCurrencyAmounts
   */
  ipcMain.handle(
    'currency:getDualCurrencyAmounts',
    async (_event, amount: number, currency: string) => {
      try {
        const amounts = await CurrencyService.getDualCurrencyAmounts(amount, currency);
        return {
          success: true,
          amounts,
        };
      } catch (error) {
        logger.error('Error in currency:getDualCurrencyAmounts handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Sum dual currency amounts handler
   * IPC: currency:sumDualCurrencyAmounts
   */
  ipcMain.handle(
    'currency:sumDualCurrencyAmounts',
    async (_event, amounts: Array<{ amount: number; currency: string }>) => {
      try {
        const totals = await CurrencyService.sumDualCurrencyAmounts(amounts);
        return {
          success: true,
          totals,
        };
      } catch (error) {
        logger.error('Error in currency:sumDualCurrencyAmounts handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  logger.info('Currency IPC handlers registered');
}

