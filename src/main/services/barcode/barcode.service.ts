/**
 * Barcode Service
 * Handles barcode generation, validation, and format detection
 */

export type BarcodeFormat = 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CODE39' | 'ITF14' | 'MSI' | 'pharmacode' | 'codabar';

export interface BarcodeValidationResult {
  valid: boolean;
  format?: BarcodeFormat;
  error?: string;
  checkDigit?: string;
}

export interface BarcodeGenerationOptions {
  format?: BarcodeFormat;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
}

/**
 * Barcode Service
 * Provides barcode generation and validation functionality
 */
export class BarcodeService {
  /**
   * Detect barcode format from barcode string
   */
  static detectFormat(barcode: string): BarcodeFormat | null {
    const cleaned = barcode.replace(/\D/g, ''); // Remove non-digits
    const length = cleaned.length;

    // EAN-13: 13 digits
    if (length === 13) {
      return 'EAN13';
    }

    // EAN-8: 8 digits
    if (length === 8) {
      return 'EAN8';
    }

    // UPC-A: 12 digits
    if (length === 12) {
      return 'UPC';
    }

    // CODE128: Variable length, alphanumeric
    if (/^[!-~]+$/.test(barcode) && length >= 1) {
      return 'CODE128';
    }

    // CODE39: Alphanumeric with specific characters
    if (/^[0-9A-Z\-. $/+%]+$/.test(barcode) && length >= 1) {
      return 'CODE39';
    }

    // ITF-14: 14 digits
    if (length === 14) {
      return 'ITF14';
    }

    // MSI: Variable length, numeric
    if (/^\d+$/.test(cleaned) && length >= 4) {
      return 'MSI';
    }

    return null;
  }

  /**
   * Calculate EAN-13 check digit
   */
  private static calculateEAN13CheckDigit(barcode: string): string {
    const digits = barcode.replace(/\D/g, '').slice(0, 12);
    if (digits.length !== 12) {
      throw new Error('EAN-13 requires 12 digits before check digit');
    }

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(digits[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit.toString();
  }

  /**
   * Calculate EAN-8 check digit
   */
  private static calculateEAN8CheckDigit(barcode: string): string {
    const digits = barcode.replace(/\D/g, '').slice(0, 7);
    if (digits.length !== 7) {
      throw new Error('EAN-8 requires 7 digits before check digit');
    }

    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const digit = parseInt(digits[i], 10);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit.toString();
  }

  /**
   * Calculate UPC-A check digit
   */
  private static calculateUPCCheckDigit(barcode: string): string {
    const digits = barcode.replace(/\D/g, '').slice(0, 11);
    if (digits.length !== 11) {
      throw new Error('UPC-A requires 11 digits before check digit');
    }

    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(digits[i], 10);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit.toString();
  }

  /**
   * Validate barcode format and check digit
   */
  static validateBarcode(barcode: string): BarcodeValidationResult {
    if (!barcode || barcode.trim() === '') {
      return {
        valid: false,
        error: 'Barcode cannot be empty',
      };
    }

    const cleaned = barcode.replace(/\D/g, '');
    const format = this.detectFormat(barcode);

    if (!format) {
      return {
        valid: false,
        error: 'Unknown barcode format',
      };
    }

    // Validate format-specific requirements
    switch (format) {
      case 'EAN13': {
        if (cleaned.length !== 13) {
          return {
            valid: false,
            format,
            error: 'EAN-13 must be exactly 13 digits',
          };
        }
        // Validate check digit
        const ean13CheckDigit = this.calculateEAN13CheckDigit(cleaned.slice(0, 12));
        if (cleaned[12] !== ean13CheckDigit) {
          return {
            valid: false,
            format,
            checkDigit: ean13CheckDigit,
            error: `Invalid EAN-13 check digit. Expected: ${ean13CheckDigit}`,
          };
        }
        break;
      }

      case 'EAN8': {
        if (cleaned.length !== 8) {
          return {
            valid: false,
            format,
            error: 'EAN-8 must be exactly 8 digits',
          };
        }
        // Validate check digit
        const ean8CheckDigit = this.calculateEAN8CheckDigit(cleaned.slice(0, 7));
        if (cleaned[7] !== ean8CheckDigit) {
          return {
            valid: false,
            format,
            checkDigit: ean8CheckDigit,
            error: `Invalid EAN-8 check digit. Expected: ${ean8CheckDigit}`,
          };
        }
        break;
      }

      case 'UPC': {
        if (cleaned.length !== 12) {
          return {
            valid: false,
            format,
            error: 'UPC-A must be exactly 12 digits',
          };
        }
        // Validate check digit
        const upcCheckDigit = this.calculateUPCCheckDigit(cleaned.slice(0, 11));
        if (cleaned[11] !== upcCheckDigit) {
          return {
            valid: false,
            format,
            checkDigit: upcCheckDigit,
            error: `Invalid UPC-A check digit. Expected: ${upcCheckDigit}`,
          };
        }
        break;
      }

      case 'CODE128':
        if (barcode.length < 1) {
          return {
            valid: false,
            format,
            error: 'CODE128 must have at least 1 character',
          };
        }
        break;

      case 'CODE39':
        if (barcode.length < 1) {
          return {
            valid: false,
            format,
            error: 'CODE39 must have at least 1 character',
          };
        }
        break;

      case 'ITF14':
        if (cleaned.length !== 14) {
          return {
            valid: false,
            format,
            error: 'ITF-14 must be exactly 14 digits',
          };
        }
        break;

      default:
        // For other formats, basic validation
        if (cleaned.length < 1) {
          return {
            valid: false,
            format,
            error: 'Barcode must have at least 1 character',
          };
        }
    }

    return {
      valid: true,
      format,
    };
  }

  /**
   * Generate a barcode (returns the barcode string with correct check digit)
   * For formats that require check digits, this will calculate and append it
   */
  static generateBarcode(format: BarcodeFormat, baseValue: string): string {
    const cleaned = baseValue.replace(/\D/g, '');

    switch (format) {
      case 'EAN13': {
        if (cleaned.length !== 12) {
          throw new Error('EAN-13 requires 12 digits (without check digit)');
        }
        const ean13CheckDigit = this.calculateEAN13CheckDigit(cleaned);
        return cleaned + ean13CheckDigit;
      }

      case 'EAN8': {
        if (cleaned.length !== 7) {
          throw new Error('EAN-8 requires 7 digits (without check digit)');
        }
        const ean8CheckDigit = this.calculateEAN8CheckDigit(cleaned);
        return cleaned + ean8CheckDigit;
      }

      case 'UPC': {
        if (cleaned.length !== 11) {
          throw new Error('UPC-A requires 11 digits (without check digit)');
        }
        const upcCheckDigit = this.calculateUPCCheckDigit(cleaned);
        return cleaned + upcCheckDigit;
      }

      case 'CODE128':
      case 'CODE39':
        // For these formats, use the value as-is
        return baseValue;

      case 'ITF14': {
        if (cleaned.length !== 13) {
          throw new Error('ITF-14 requires 13 digits (without check digit)');
        }
        // ITF-14 uses same check digit calculation as EAN-13
        const itf14CheckDigit = this.calculateEAN13CheckDigit(cleaned);
        return cleaned + itf14CheckDigit;
      }

      default:
        // For other formats, return as-is
        return baseValue;
    }
  }

  /**
   * Generate a random barcode in the specified format
   */
  static generateRandomBarcode(format: BarcodeFormat): string {
    switch (format) {
      case 'EAN13': {
        // Generate 12 random digits (check digit will be calculated)
        const ean13Base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
        return this.generateBarcode('EAN13', ean13Base);
      }

      case 'EAN8': {
        // Generate 7 random digits (check digit will be calculated)
        const ean8Base = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join('');
        return this.generateBarcode('EAN8', ean8Base);
      }

      case 'UPC': {
        // Generate 11 random digits (check digit will be calculated)
        const upcBase = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('');
        return this.generateBarcode('UPC', upcBase);
      }

      case 'CODE128': {
        // Generate random alphanumeric string
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const length = Math.floor(Math.random() * 10) + 5; // 5-14 characters
        return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      }

      case 'CODE39': {
        // Generate random CODE39 string
        const code39Chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';
        const code39Length = Math.floor(Math.random() * 10) + 5; // 5-14 characters
        return Array.from({ length: code39Length }, () => code39Chars[Math.floor(Math.random() * code39Chars.length)]).join('');
      }

      case 'ITF14': {
        // Generate 13 random digits (check digit will be calculated)
        const itf14Base = Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join('');
        return this.generateBarcode('ITF14', itf14Base);
      }

      default: {
        // For other formats, generate numeric string
        const defaultLength = Math.floor(Math.random() * 10) + 5;
        return Array.from({ length: defaultLength }, () => Math.floor(Math.random() * 10)).join('');
      }
    }
  }

  /**
   * Get format display name
   */
  static getFormatDisplayName(format: BarcodeFormat): string {
    const names: Record<BarcodeFormat, string> = {
      EAN13: 'EAN-13',
      EAN8: 'EAN-8',
      UPC: 'UPC-A',
      CODE128: 'CODE 128',
      CODE39: 'CODE 39',
      ITF14: 'ITF-14',
      MSI: 'MSI',
      pharmacode: 'Pharmacode',
      codabar: 'Codabar',
    };
    return names[format] || format;
  }

  /**
   * Get format description
   */
  static getFormatDescription(format: BarcodeFormat): string {
    const descriptions: Record<BarcodeFormat, string> = {
      EAN13: 'European Article Number - 13 digits (most common retail format)',
      EAN8: 'European Article Number - 8 digits (compact format)',
      UPC: 'Universal Product Code - 12 digits (North American standard)',
      CODE128: 'Code 128 - Variable length alphanumeric',
      CODE39: 'Code 39 - Variable length alphanumeric with special characters',
      ITF14: 'Interleaved 2 of 5 - 14 digits (shipping containers)',
      MSI: 'MSI - Variable length numeric',
      pharmacode: 'Pharmacode - Pharmaceutical packaging',
      codabar: 'Codabar - Variable length numeric with start/stop characters',
    };
    return descriptions[format] || format;
  }
}

