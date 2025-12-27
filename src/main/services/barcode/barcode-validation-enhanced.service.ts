import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { BarcodeService, BarcodeFormat, BarcodeValidationResult } from './barcode.service';

export interface EnhancedBarcodeValidationResult extends BarcodeValidationResult {
  warnings?: string[];
  suggestions?: string[];
  confidence?: number; // 0-100, confidence in validation
  validationDetails?: {
    length?: number;
    expectedLength?: number;
    hasCheckDigit?: boolean;
    checkDigitValid?: boolean;
    patternMatch?: boolean;
    countryCode?: string; // For EAN-13/UPC
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
  validatedBy?: number; // User ID
  context?: string; // e.g., 'product_form', 'batch_scan', 'import'
}

export interface ValidationStatistics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  formatDistribution: Record<BarcodeFormat | 'unknown', number>;
  commonErrors: Array<{ error: string; count: number }>;
  validationRate: number; // Success rate percentage
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface ValidationOptions {
  strictMode?: boolean; // Stricter validation rules
  allowPartial?: boolean; // Allow partial matches
  checkDuplicates?: boolean; // Check for duplicate barcodes in database
  context?: string; // Validation context
  validatedBy?: number; // User ID
  saveHistory?: boolean; // Save to validation history
}

/**
 * Enhanced Barcode Validation Service
 * Provides advanced validation features including history, statistics, and enhanced error messages
 */
export class BarcodeValidationEnhancedService {
  /**
   * Enhanced barcode validation with detailed feedback
   */
  static async validateBarcodeEnhanced(
    barcode: string,
    options: ValidationOptions = {}
  ): Promise<EnhancedBarcodeValidationResult> {
    const {
      strictMode = false,
      allowPartial = false,
      checkDuplicates = false,
      context,
      validatedBy,
      saveHistory = true,
    } = options;

    // Start with basic validation
    const basicResult = BarcodeService.validateBarcode(barcode);
    const enhancedResult: EnhancedBarcodeValidationResult = {
      ...basicResult,
      warnings: [],
      suggestions: [],
      confidence: 100,
      validationDetails: {},
    };

    // Enhanced validation checks
    if (!basicResult.valid) {
      enhancedResult.confidence = 0;
      
      // Provide suggestions based on error type
      if (basicResult.error?.includes('check digit')) {
        enhancedResult.suggestions?.push(
          'The check digit is incorrect. Would you like to auto-correct it?'
        );
        if (basicResult.checkDigit) {
          enhancedResult.suggestions?.push(
            `Try replacing the last digit with: ${basicResult.checkDigit}`
          );
        }
      } else if (basicResult.error?.includes('length')) {
        const cleaned = barcode.replace(/\D/g, '');
        if (basicResult.format) {
          const expectedLengths: Record<BarcodeFormat, number> = {
            EAN13: 13,
            EAN8: 8,
            UPC: 12,
            CODE128: 0, // Variable
            CODE39: 0, // Variable
            ITF14: 14,
            MSI: 0, // Variable
            pharmacode: 0, // Variable
            codabar: 0, // Variable
          };
          const expected = expectedLengths[basicResult.format];
          if (expected > 0) {
            enhancedResult.validationDetails = {
              length: cleaned.length,
              expectedLength: expected,
            };
            if (cleaned.length < expected) {
              enhancedResult.suggestions?.push(
                `Barcode is too short. Expected ${expected} digits, got ${cleaned.length}. Add ${expected - cleaned.length} more digit(s).`
              );
            } else {
              enhancedResult.suggestions?.push(
                `Barcode is too long. Expected ${expected} digits, got ${cleaned.length}. Remove ${cleaned.length - expected} digit(s).`
              );
            }
          }
        }
      } else if (basicResult.error?.includes('format')) {
        enhancedResult.suggestions?.push(
          'The barcode format could not be detected. Common formats: EAN-13 (13 digits), UPC-A (12 digits), CODE128 (alphanumeric)'
        );
      }
    } else {
      // Additional checks for valid barcodes
      enhancedResult.validationDetails = {
        length: barcode.replace(/\D/g, '').length,
        hasCheckDigit: ['EAN13', 'EAN8', 'UPC', 'ITF14'].includes(basicResult.format || ''),
        checkDigitValid: true,
        patternMatch: true,
      };

      // Extract country code for EAN-13/UPC
      if (basicResult.format === 'EAN13' || basicResult.format === 'UPC') {
        const cleaned = barcode.replace(/\D/g, '');
        const countryCode = cleaned.substring(0, basicResult.format === 'EAN13' ? 3 : 1);
        enhancedResult.validationDetails.countryCode = countryCode;
      }

      // Check for duplicate barcodes if requested
      if (checkDuplicates) {
        try {
          const prisma = databaseService.getClient();
          const existingProduct = await prisma.product.findFirst({
            where: { barcode: barcode.trim() },
            select: { id: true, name: true },
          });

          if (existingProduct) {
            enhancedResult.warnings?.push(
              `This barcode is already in use by product: ${existingProduct.name} (ID: ${existingProduct.id})`
            );
            enhancedResult.confidence = Math.min(enhancedResult.confidence || 100, 80);
          }
        } catch (error) {
          logger.error('Error checking for duplicate barcode', { barcode, error });
        }
      }

      // Strict mode additional checks
      if (strictMode) {
        // Check for suspicious patterns
        const cleaned = barcode.replace(/\D/g, '');
        if (cleaned.match(/^0+$/)) {
          enhancedResult.warnings?.push('Barcode contains only zeros - this may be invalid');
          enhancedResult.confidence = Math.min(enhancedResult.confidence || 100, 70);
        }
        
        // Check for repeated patterns
        if (cleaned.match(/(\d)\1{5,}/)) {
          enhancedResult.warnings?.push('Barcode contains suspicious repeated digits');
          enhancedResult.confidence = Math.min(enhancedResult.confidence || 100, 75);
        }
      }
    }

    // Save to validation history if requested
    if (saveHistory) {
      try {
        await this.saveValidationHistory({
          barcode: barcode.trim(),
          format: basicResult.format || null,
          valid: basicResult.valid,
          error: basicResult.error,
          warnings: enhancedResult.warnings,
          context,
          validatedBy,
        });
      } catch (error) {
        logger.error('Error saving validation history', { barcode, error });
      }
    }

    return enhancedResult;
  }

  /**
   * Save validation history entry
   */
  private static async saveValidationHistory(entry: Omit<ValidationHistoryEntry, 'id' | 'validatedAt'>): Promise<void> {
    try {
      // For now, we'll log it. In the future, this could be stored in a database table
      logger.info('Barcode validation', {
        barcode: entry.barcode,
        format: entry.format,
        valid: entry.valid,
        error: entry.error,
        warnings: entry.warnings,
        context: entry.context,
        validatedBy: entry.validatedBy,
      });
    } catch (error) {
      logger.error('Error saving validation history', { entry, error });
    }
  }

  /**
   * Get validation statistics
   */
  static async getValidationStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<ValidationStatistics> {
    // For now, return mock statistics
    // In the future, this would query a validation history table
    const now = new Date();
    const start = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const end = endDate || now;

    return {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      formatDistribution: {},
      commonErrors: [],
      validationRate: 0,
      period: {
        startDate: start,
        endDate: end,
      },
    };
  }

  /**
   * Get validation history
   */
  static async getValidationHistory(
    options: {
      barcode?: string;
      format?: BarcodeFormat;
      valid?: boolean;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<ValidationHistoryEntry[]> {
    // For now, return empty array
    // In the future, this would query a validation history table
    return [];
  }

  /**
   * Batch validate multiple barcodes
   */
  static async batchValidate(
    barcodes: string[],
    options: ValidationOptions = {}
  ): Promise<EnhancedBarcodeValidationResult[]> {
    const results: EnhancedBarcodeValidationResult[] = [];

    for (const barcode of barcodes) {
      const result = await this.validateBarcodeEnhanced(barcode, {
        ...options,
        saveHistory: false, // Don't save history for each individual item in batch
      });
      results.push(result);
    }

    // Save batch validation summary to history
    if (options.saveHistory) {
      const validCount = results.filter((r) => r.valid).length;
      const invalidCount = results.length - validCount;
      logger.info('Batch barcode validation completed', {
        total: results.length,
        valid: validCount,
        invalid: invalidCount,
        context: options.context || 'batch_validation',
        validatedBy: options.validatedBy,
      });
    }

    return results;
  }

  /**
   * Suggest corrections for invalid barcodes
   */
  static suggestCorrections(barcode: string, validationResult: EnhancedBarcodeValidationResult): string[] {
    const suggestions: string[] = [];

    if (!validationResult.valid && validationResult.format) {
      const cleaned = barcode.replace(/\D/g, '');
      
      if (validationResult.error?.includes('check digit') && validationResult.checkDigit) {
        // Suggest corrected barcode with proper check digit
        const corrected = cleaned.slice(0, -1) + validationResult.checkDigit;
        suggestions.push(corrected);
      }

      if (validationResult.validationDetails?.expectedLength && validationResult.validationDetails?.length) {
        const expected = validationResult.validationDetails.expectedLength;
        const current = validationResult.validationDetails.length;
        
        if (current < expected) {
          // Suggest padding with zeros
          const padded = cleaned.padEnd(expected, '0');
          if (validationResult.format === 'EAN13' || validationResult.format === 'EAN8' || validationResult.format === 'UPC') {
            // Recalculate check digit for padded barcode
            try {
              const corrected = BarcodeService.generateBarcode(
                validationResult.format,
                padded.slice(0, -1)
              );
              suggestions.push(corrected);
            } catch (error) {
              // Ignore errors
            }
          } else {
            suggestions.push(padded);
          }
        } else if (current > expected) {
          // Suggest truncating
          const truncated = cleaned.slice(0, expected);
          if (validationResult.format === 'EAN13' || validationResult.format === 'EAN8' || validationResult.format === 'UPC') {
            try {
              const corrected = BarcodeService.generateBarcode(
                validationResult.format,
                truncated.slice(0, -1)
              );
              suggestions.push(corrected);
            } catch (error) {
              // Ignore errors
            }
          } else {
            suggestions.push(truncated);
          }
        }
      }
    }

    return suggestions;
  }
}

