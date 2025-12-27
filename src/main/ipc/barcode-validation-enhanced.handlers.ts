import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  BarcodeValidationEnhancedService,
  ValidationOptions,
} from '../services/barcode/barcode-validation-enhanced.service';

/**
 * Register enhanced barcode validation IPC handlers
 */
export function registerBarcodeValidationEnhancedHandlers(): void {
  logger.info('Registering enhanced barcode validation IPC handlers...');

  /**
   * Enhanced barcode validation handler
   * IPC: barcode-validation-enhanced:validate
   */
  ipcMain.handle(
    'barcode-validation-enhanced:validate',
    async (_event, barcode: string, options: ValidationOptions) => {
      try {
        const result = await BarcodeValidationEnhancedService.validateBarcodeEnhanced(
          barcode,
          options
        );
        return {
          success: true,
          result,
        };
      } catch (error) {
        logger.error('Error in barcode-validation-enhanced:validate handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Batch validate handler
   * IPC: barcode-validation-enhanced:batchValidate
   */
  ipcMain.handle(
    'barcode-validation-enhanced:batchValidate',
    async (_event, barcodes: string[], options: ValidationOptions) => {
      try {
        const results = await BarcodeValidationEnhancedService.batchValidate(
          barcodes,
          options
        );
        return {
          success: true,
          results,
        };
      } catch (error) {
        logger.error('Error in barcode-validation-enhanced:batchValidate handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get validation statistics handler
   * IPC: barcode-validation-enhanced:getStatistics
   */
  ipcMain.handle(
    'barcode-validation-enhanced:getStatistics',
    async (_event, startDate?: Date, endDate?: Date) => {
      try {
        const statistics = await BarcodeValidationEnhancedService.getValidationStatistics(
          startDate,
          endDate
        );
        return {
          success: true,
          statistics,
        };
      } catch (error) {
        logger.error('Error in barcode-validation-enhanced:getStatistics handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get validation history handler
   * IPC: barcode-validation-enhanced:getHistory
   */
  ipcMain.handle(
    'barcode-validation-enhanced:getHistory',
    async (
      _event,
      options: {
        barcode?: string;
        format?: string;
        valid?: boolean;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
      }
    ) => {
      try {
        const history = await BarcodeValidationEnhancedService.getValidationHistory(options);
        return {
          success: true,
          history,
        };
      } catch (error) {
        logger.error('Error in barcode-validation-enhanced:getHistory handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Suggest corrections handler
   * IPC: barcode-validation-enhanced:suggestCorrections
   */
  ipcMain.handle(
    'barcode-validation-enhanced:suggestCorrections',
    async (_event, barcode: string, validationResult: any) => {
      try {
        const suggestions = BarcodeValidationEnhancedService.suggestCorrections(
          barcode,
          validationResult
        );
        return {
          success: true,
          suggestions,
        };
      } catch (error) {
        logger.error('Error in barcode-validation-enhanced:suggestCorrections handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );
}

