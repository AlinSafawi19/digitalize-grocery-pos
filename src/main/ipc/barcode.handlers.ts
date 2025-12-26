import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { BarcodeService, BarcodeFormat } from '../services/barcode/barcode.service';

/**
 * Register barcode management IPC handlers
 */
export function registerBarcodeHandlers(): void {
  logger.info('Registering barcode management IPC handlers...');

  /**
   * Detect barcode format
   * IPC: barcode:detectFormat
   */
  ipcMain.handle('barcode:detectFormat', async (_event, barcode: string) => {
    try {
      const format = BarcodeService.detectFormat(barcode);
      return { success: true, format };
    } catch (error) {
      logger.error('Error detecting barcode format', { barcode, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Validate barcode
   * IPC: barcode:validate
   */
  ipcMain.handle('barcode:validate', async (_event, barcode: string) => {
    try {
      const result = BarcodeService.validateBarcode(barcode);
      return { success: true, ...result };
    } catch (error) {
      logger.error('Error validating barcode', { barcode, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Generate barcode
   * IPC: barcode:generate
   */
  ipcMain.handle('barcode:generate', async (_event, format: BarcodeFormat, baseValue: string) => {
    try {
      const barcode = BarcodeService.generateBarcode(format, baseValue);
      return { success: true, barcode };
    } catch (error) {
      logger.error('Error generating barcode', { format, baseValue, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Generate random barcode
   * IPC: barcode:generateRandom
   */
  ipcMain.handle('barcode:generateRandom', async (_event, format: BarcodeFormat) => {
    try {
      const barcode = BarcodeService.generateRandomBarcode(format);
      return { success: true, barcode };
    } catch (error) {
      logger.error('Error generating random barcode', { format, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get format display name
   * IPC: barcode:getFormatDisplayName
   */
  ipcMain.handle('barcode:getFormatDisplayName', async (_event, format: BarcodeFormat) => {
    try {
      const displayName = BarcodeService.getFormatDisplayName(format);
      return { success: true, displayName };
    } catch (error) {
      logger.error('Error getting format display name', { format, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get format description
   * IPC: barcode:getFormatDescription
   */
  ipcMain.handle('barcode:getFormatDescription', async (_event, format: BarcodeFormat) => {
    try {
      const description = BarcodeService.getFormatDescription(format);
      return { success: true, description };
    } catch (error) {
      logger.error('Error getting format description', { format, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });
}

