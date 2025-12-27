import { BarcodeFormat } from './barcode.service';

export interface EnhancedBarcodeValidationResult {
  valid: boolean;
  format?: BarcodeFormat;
  error?: string;
  checkDigit?: string;
  warnings?: string[];
  suggestions?: string[];
  confidence?: number;
  validationDetails?: {
    length?: number;
    expectedLength?: number;
    hasCheckDigit?: boolean;
    checkDigitValid?: boolean;
    patternMatch?: boolean;
    countryCode?: string;
  };
}

export interface ValidationOptions {
  strictMode?: boolean;
  allowPartial?: boolean;
  checkDuplicates?: boolean;
  context?: string;
  validatedBy?: number;
  saveHistory?: boolean;
}

export interface ValidationStatistics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  formatDistribution: Record<BarcodeFormat | 'unknown', number>;
  commonErrors: Array<{ error: string; count: number }>;
  validationRate: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface ValidationHistoryEntry {
  id: number;
  barcode: string;
  format: BarcodeFormat | null;
  valid: boolean;
  error?: string;
  warnings?: string[];
  validatedAt: Date;
  validatedBy?: number;
  context?: string;
}

/**
 * Enhanced Barcode Validation Service (Renderer)
 * Handles enhanced barcode validation operations via IPC
 */
export class BarcodeValidationEnhancedService {
  /**
   * Enhanced barcode validation
   */
  static async validate(
    barcode: string,
    options: ValidationOptions = {}
  ): Promise<{ success: boolean; result?: EnhancedBarcodeValidationResult; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcode-validation-enhanced:validate',
        barcode,
        options
      ) as { success: boolean; result?: EnhancedBarcodeValidationResult; error?: string };
      return result;
    } catch (error) {
      console.error('Error validating barcode (enhanced):', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Batch validate multiple barcodes
   */
  static async batchValidate(
    barcodes: string[],
    options: ValidationOptions = {}
  ): Promise<{ success: boolean; results?: EnhancedBarcodeValidationResult[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcode-validation-enhanced:batchValidate',
        barcodes,
        options
      ) as { success: boolean; results?: EnhancedBarcodeValidationResult[]; error?: string };
      return result;
    } catch (error) {
      console.error('Error batch validating barcodes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get validation statistics
   */
  static async getStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ success: boolean; statistics?: ValidationStatistics; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcode-validation-enhanced:getStatistics',
        startDate,
        endDate
      ) as { success: boolean; statistics?: ValidationStatistics; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting validation statistics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get validation history
   */
  static async getHistory(
    options: {
      barcode?: string;
      format?: string;
      valid?: boolean;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<{ success: boolean; history?: ValidationHistoryEntry[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcode-validation-enhanced:getHistory',
        options
      ) as { success: boolean; history?: ValidationHistoryEntry[]; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting validation history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Suggest corrections for invalid barcodes
   */
  static async suggestCorrections(
    barcode: string,
    validationResult: EnhancedBarcodeValidationResult
  ): Promise<{ success: boolean; suggestions?: string[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcode-validation-enhanced:suggestCorrections',
        barcode,
        validationResult
      ) as { success: boolean; suggestions?: string[]; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting correction suggestions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

