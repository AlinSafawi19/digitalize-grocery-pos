/**
 * Barcode Service (Renderer)
 * Handles barcode operations via IPC
 */

export type BarcodeFormat = 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CODE39' | 'ITF14' | 'MSI' | 'pharmacode' | 'codabar';

export interface BarcodeValidationResult {
  valid: boolean;
  format?: BarcodeFormat;
  error?: string;
  checkDigit?: string;
}

export class BarcodeService {
  /**
   * Detect barcode format
   */
  static async detectFormat(barcode: string): Promise<{ success: boolean; format?: BarcodeFormat | null; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcode:detectFormat',
        barcode
      ) as { success: boolean; format?: BarcodeFormat | null; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Validate barcode
   */
  static async validateBarcode(barcode: string): Promise<{ success: boolean; result?: BarcodeValidationResult; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcode:validate',
        barcode
      ) as { success: boolean; valid?: boolean; format?: BarcodeFormat; error?: string; checkDigit?: string };
      
      if (result.success) {
        return {
          success: true,
          result: {
            valid: result.valid ?? false,
            format: result.format,
            error: result.error,
            checkDigit: result.checkDigit,
          },
        };
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Generate barcode
   */
  static async generateBarcode(
    format: BarcodeFormat,
    baseValue: string
  ): Promise<{ success: boolean; barcode?: string; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcode:generate',
        format,
        baseValue
      ) as { success: boolean; barcode?: string; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Generate random barcode
   */
  static async generateRandomBarcode(
    format: BarcodeFormat
  ): Promise<{ success: boolean; barcode?: string; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcode:generateRandom',
        format
      ) as { success: boolean; barcode?: string; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get format display name
   */
  static async getFormatDisplayName(format: BarcodeFormat): Promise<{ success: boolean; displayName?: string; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcode:getFormatDisplayName',
        format
      ) as { success: boolean; displayName?: string; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get format description
   */
  static async getFormatDescription(format: BarcodeFormat): Promise<{ success: boolean; description?: string; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcode:getFormatDescription',
        format
      ) as { success: boolean; description?: string; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

