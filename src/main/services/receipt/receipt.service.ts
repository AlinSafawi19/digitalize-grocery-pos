import PDFDocument from 'pdfkit';
import fs from 'fs-extra';
import path from 'path';
import { app } from 'electron';
import { logger } from '../../utils/logger';
import { RECEIPTS_DIR } from '../../utils/constants';
import { TransactionService, TransactionWithRelations } from '../transaction/transaction.service';
import { SettingsService } from '../settings/settings.service';
import { CurrencyService } from '../currency/currency.service';
import { tmpdir } from 'os';
import sharp from 'sharp';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Beirut';

export interface ReceiptOptions {
  transactionId: number;
  print?: boolean;
}

/**
 * Receipt Service
 * Handles receipt generation and printing
 */
export class ReceiptService {
  /**
   * Ensure receipts directory exists
   */
  private static async ensureReceiptsDir(): Promise<void> {
    try {
      await fs.ensureDir(RECEIPTS_DIR);
    } catch (error) {
      logger.error('Error creating receipts directory', error);
      throw error;
    }
  }

  /**
   * Format price in dual currency (USD and LBP)
   */
  private static formatDualCurrency(usdAmount: number, exchangeRate: number): string {
    const lbpAmount = Math.round(usdAmount * exchangeRate);
    return `$${usdAmount.toFixed(2)} (${lbpAmount.toLocaleString()} LBP)`;
  }

  /**
   * Format price in USD only
   */
  private static formatUSD(usdAmount: number): string {
    return `$${usdAmount.toFixed(2)}`;
  }

  /**
   * Generate hardcoded receipt content
   */
  private static generateReceiptContent(
    storeInfo: { name: string; address: string; phone: string; logo?: string },
    transaction: TransactionWithRelations,
    exchangeRate: number,
    vatRate: number,
    paperWidth: number = 80,
    taxInclusive: boolean = false
  ): string {
    // Format date in Asia/Beirut timezone
    const date = moment.utc(transaction.createdAt).tz(TIMEZONE).format('MMM DD, YYYY HH:mm:ss');

    // Format items in a table format
    // Calculate max width based on paper width
    const availableWidth = Math.max(50, paperWidth - 30); // 15mm margin on each side
    const charsPerMm = 2.5; // Approximate characters per mm for monospace
    const maxLineWidth = Math.max(40, Math.floor(availableWidth / charsPerMm)); // Minimum 40 characters for table

    // Define column widths for table format
    const qtyWidth = 5;      // For quantity (e.g., "2.00")
    const priceWidth = 10;   // For unit price (e.g., "$10.00")
    const totalWidth = 10;   // For total (e.g., "$20.00")
    const spacing = 6;       // For separators/spacing between columns
    const descWidth = Math.max(10, maxLineWidth - qtyWidth - priceWidth - totalWidth - spacing); // Remaining space for description (minimum 10)

    let itemsText = '';

    // Ensure all widths are valid integers
    const safeDescWidth = Math.max(1, Math.floor(descWidth));
    const safeQtyWidth = Math.max(1, Math.floor(qtyWidth));
    const safePriceWidth = Math.max(1, Math.floor(priceWidth));
    const safeTotalWidth = Math.max(1, Math.floor(totalWidth));
    const safeMaxLineWidth = Math.max(1, Math.floor(maxLineWidth));

    // Table header
    const headerDesc = 'Description'.padEnd(safeDescWidth);
    const headerQty = 'Qty'.padStart(safeQtyWidth);
    const headerPrice = 'Price'.padStart(safePriceWidth);
    const headerTotal = 'Total'.padStart(safeTotalWidth);
    itemsText += `${headerDesc} ${headerQty} ${headerPrice} ${headerTotal}\n`;
    
    // Separator line
    itemsText += '-'.repeat(safeMaxLineWidth) + '\n';

    transaction.items.forEach((item) => {
      const product = item.product;
      const qty = item.quantity;
      // Fix Arabic text word order in description before formatting
      const description = this.fixArabicTextOrder(product?.name || '');
      const unitPrice = item.unitPrice;
      const total = item.total;
      
      // Check if this is a returned product (negative total)
      const isReturned = total < 0;
      
      // Format prices in USD only
      // For returned products, use brackets instead of negative sign
      const unitPriceFormatted = isReturned 
        ? `(${this.formatUSD(Math.abs(unitPrice))})`
        : this.formatUSD(unitPrice);
      const totalFormatted = isReturned 
        ? `(${this.formatUSD(Math.abs(total))})`
        : this.formatUSD(total);
      
      // Format quantity (handle decimals if needed)
      // For returned products, use absolute value
      const qtyFormatted = isReturned
        ? (Math.abs(qty) % 1 === 0 ? Math.abs(qty).toString() : Math.abs(qty).toFixed(2))
        : (qty % 1 === 0 ? qty.toString() : qty.toFixed(2));
      
      // Wrap description if too long
      const descLines: string[] = [];
      let remaining = description || ''; // Ensure description is not null/undefined
      while (remaining.length > 0) {
        if (remaining.length <= safeDescWidth) {
          descLines.push(remaining);
          break;
        }
        // Break at word boundary
        const breakPoint = remaining.lastIndexOf(' ', safeDescWidth);
        if (breakPoint > 0) {
          descLines.push(remaining.substring(0, breakPoint));
          remaining = remaining.substring(breakPoint + 1);
        } else {
          descLines.push(remaining.substring(0, safeDescWidth));
          remaining = remaining.substring(safeDescWidth);
        }
      }
      
      // Ensure we have at least one line
      if (descLines.length === 0) {
        descLines.push('');
      }
      
      // First row: description (first line), qty, price, total
      const firstDescLine = descLines[0].padEnd(safeDescWidth);
      const qtyStr = qtyFormatted.padStart(safeQtyWidth);
      const priceStr = unitPriceFormatted.padStart(safePriceWidth);
      const totalStr = totalFormatted.padStart(safeTotalWidth);
      itemsText += `${firstDescLine} ${qtyStr} ${priceStr} ${totalStr}\n`;
      
      // Additional description lines (if description wraps)
      for (let i = 1; i < descLines.length; i++) {
        const descLine = descLines[i].padEnd(safeDescWidth);
        itemsText += `${descLine}\n`;
      }
      
      // Add discount if applicable
      if (item.discount > 0) {
        const discountFormatted = this.formatUSD(item.discount);
        const discountText = `Less Discount: -${discountFormatted}`;
        const indent = Math.max(0, Math.floor(safeDescWidth - discountText.length));
        itemsText += ' '.repeat(Math.max(0, indent)) + discountText + '\n';
      }
    });

    // Format exchange rate and VAT rate
    const exchangeRateText = `Our exchange rate is ${exchangeRate.toLocaleString()} LBP for 1 USD`;
    const vatRateText = vatRate > 0 
      ? `VAT ${vatRate.toFixed(2)}% ${taxInclusive ? '(included in prices)' : '(added to prices)'}`
      : '';

    // Format subtotal, tax, and total - aligned with table columns
    // The totals should align with the "Total" column in the table
    // Format: Label on left, value aligned with Total column on right
    const formatTableAligned = (label: string, value: string): string => {
      // Calculate where the Total column starts
      const totalColumnStart = safeDescWidth + safeQtyWidth + safePriceWidth + 3; // Space for description, qty, price columns + spacing
      
      // Right-align the value within the Total column width
      const valuePadded = value.padStart(safeTotalWidth);
      
      // Place label at the start, then pad to align value with Total column
      const paddingNeeded = Math.max(1, totalColumnStart - label.length);
      const labelWithPadding = label + ' '.repeat(paddingNeeded);
      
      return labelWithPadding + valuePadded;
    };

    // Format all amounts in USD only (except total which shows both USD and LBP separately)
    const subtotalFormatted = this.formatUSD(transaction.subtotal);
    const taxFormatted = vatRate > 0 ? this.formatUSD(transaction.tax) : '';
    const discountFormatted = transaction.discount > 0 
      ? `-${this.formatUSD(transaction.discount)}`
      : '';

    // Format total separately: Total USD and Total LBP
    const totalUSD = this.formatUSD(transaction.total);
    const totalLBP = Math.round(transaction.total * exchangeRate).toLocaleString();

    const subtotalText = formatTableAligned('Subtotal:', subtotalFormatted);
    const taxText = vatRate > 0 ? formatTableAligned('Tax:', taxFormatted) : '';
    const totalUSDText = formatTableAligned('Total USD:', totalUSD);
    const totalLBPText = formatTableAligned('Total LBP:', `${totalLBP} LBP`);
    const discountText = transaction.discount > 0 
      ? formatTableAligned('Discount:', discountFormatted)
      : '';

    // Build hardcoded receipt format
    let receipt = '';
    
    // Store name (will be rendered larger in PDF)
    receipt += `${storeInfo.name || 'DigitalizePOS'}\n`;
    
    // Store address
    if (storeInfo.address) {
      receipt += `${storeInfo.address}\n`;
    }
    
    // Store phone
    if (storeInfo.phone) {
      receipt += `${storeInfo.phone}\n`;
    }
    
    receipt += '\n';
    receipt += '\n';
    receipt += '\n';

    // Receipt number and date
    receipt += `Receipt #${transaction.transactionNumber}\n`;
    receipt += `${date}\n`;
    
    receipt += '\n';
    receipt += '\n';
    receipt += '\n';

    // Items
    receipt += itemsText.trimEnd() + '\n';
    
    receipt += '\n';
    receipt += '\n';
    receipt += '\n';

    // Totals
    receipt += subtotalText + '\n';
    if (discountText) {
      receipt += discountText + '\n';
    }
    if (taxText) {
      receipt += taxText + '\n';
    }
    receipt += totalUSDText + '\n';
    receipt += totalLBPText + '\n';
    
    receipt += '\n';
    
    // Exchange rate and VAT rate
    receipt += `${exchangeRateText}\n`;
    if (vatRateText) {
      receipt += `${vatRateText}\n`;
    }
    
    receipt += '\n';
    
    // Footer
    receipt += 'Thank you for your purchase! We hope to see you again soon!\n';
    receipt += '\n';
    
    // Cashier
    if (transaction.cashier?.username) {
      receipt += `You have been assisted by ${transaction.cashier.username}\n`;
      receipt += '\n';
    }
    
    receipt += 'Powered by DigitalizePOS\n';
    receipt += 'www.digitalizepos.com';

    return receipt;
  }

  /**
   * Find font paths for both English and Arabic fonts
   * Returns font names and paths without registering (for use before document creation)
   */
  private static async findFontPaths(): Promise<{
    englishFont: string;
    arabicFont: string | null;
    englishFontPath: string | null;
    arabicFontPath: string | null;
  }> {
    const windowsFontDir = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'Fonts');
    
    // Font configurations: { name, regularPath, boldPath?, supportsArabic }
    const fontConfigs: Array<{
      name: string;
      regularPath: string;
      boldPath?: string;
      supportsArabic: boolean;
    }> = [];
    
    // Windows fonts - prioritize fonts that support both English and Arabic
    fontConfigs.push(
      {
        name: 'Arial Unicode MS',
        regularPath: path.join(windowsFontDir, 'ARIALUNI.TTF'),
        supportsArabic: true,
      },
      {
        name: 'Tahoma',
        regularPath: path.join(windowsFontDir, 'tahoma.ttf'),
        boldPath: path.join(windowsFontDir, 'tahomabd.ttf'),
        supportsArabic: true,
      },
      {
        name: 'Arial',
        regularPath: path.join(windowsFontDir, 'arial.ttf'),
        boldPath: path.join(windowsFontDir, 'arialbd.ttf'),
        supportsArabic: false,
      },
      {
        name: 'Segoe UI',
        regularPath: path.join(windowsFontDir, 'segoeui.ttf'),
        boldPath: path.join(windowsFontDir, 'segoeuib.ttf'),
        supportsArabic: true,
      }
    );
    
    // Try to find a font that supports both English and Arabic first
    for (const font of fontConfigs) {
      try {
        if (await fs.pathExists(font.regularPath)) {
          logger.posReceipt('Font found', {
            fontName: font.name,
            fontPath: font.regularPath,
            supportsArabic: font.supportsArabic,
            hasBold: !!font.boldPath,
          });
          
          // If this font supports Arabic, use it for both
          if (font.supportsArabic) {
            return {
              englishFont: font.name,
              arabicFont: font.name,
              englishFontPath: font.regularPath,
              arabicFontPath: font.regularPath,
            };
          }
        }
      } catch (error) {
        logger.debug('Failed to check font', { fontName: font.name, error });
        // Continue to next font
      }
    }
    
    // If no unified font found, find separate fonts
    let englishFont = 'Courier'; // Fallback
    let arabicFont: string | null = null;
    let englishFontPath: string | null = null;
    let arabicFontPath: string | null = null;
    
    // Find English font (Arial is clearer than Courier)
    for (const font of fontConfigs) {
      try {
        if (!font.supportsArabic && await fs.pathExists(font.regularPath)) {
          englishFont = font.name;
          englishFontPath = font.regularPath;
          logger.posReceipt('English font found', { fontName: font.name });
          break;
        }
      } catch (error) {
        logger.debug('Failed to check English font', { fontName: font.name, error });
      }
    }
    
    // Find Arabic font
    for (const font of fontConfigs) {
      try {
        if (font.supportsArabic && await fs.pathExists(font.regularPath)) {
          arabicFont = font.name;
          arabicFontPath = font.regularPath;
          logger.posReceipt('Arabic font found', { fontName: font.name });
          break;
        }
      } catch (error) {
        logger.debug('Failed to check Arabic font', { fontName: font.name, error });
      }
    }
    
    if (!arabicFont) {
      logger.warn('No Arabic-compatible font found, Arabic text may not render correctly');
    }
    
    return { englishFont, arabicFont, englishFontPath, arabicFontPath };
  }

  /**
   * Check if text contains Arabic characters
   */
  private static containsArabic(text: string): boolean {
    // Arabic Unicode range: U+0600 to U+06FF
    const arabicRegex = /[\u0600-\u06FF]/;
    return arabicRegex.test(text);
  }

  /**
   * Fix Arabic text word order for RTL rendering in LTR context
   * PDFKit renders text LTR, so when Arabic text like "قنينه مياه" is rendered,
   * it appears as "مياه قنينه" (words reversed). We reverse the word order
   * so it displays correctly as "قنينه مياه"
   */
  private static fixArabicTextOrder(text: string): string {
    // Only process if text contains Arabic
    if (!this.containsArabic(text)) {
      return text;
    }

    // Check if the line is primarily Arabic (more Arabic chars than Latin)
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
    const isPrimarilyArabic = arabicChars > 0 && arabicChars >= latinChars;

    // If primarily Arabic, reverse word order to correct the visual display
    if (isPrimarilyArabic) {
      // Simple approach: split by spaces, reverse words, rejoin
      // This handles the case where "قنينه مياه" is being displayed as "مياه قنينه"
      const words = text.split(/\s+/);
      // Reverse the word array
      words.reverse();
      // Rejoin with single spaces
      return words.join(' ');
    }

    // For mixed content, reverse only Arabic word segments
    // Split by whitespace while preserving spaces
    const tokens = text.split(/(\s+)/);
    const result: string[] = [];
    let arabicWords: string[] = [];
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      if (/\s/.test(token)) {
        // This is whitespace - flush any accumulated Arabic words (reversed)
        if (arabicWords.length > 0) {
          result.push(...arabicWords.reverse());
          arabicWords = [];
        }
        result.push(token);
      } else if (this.containsArabic(token)) {
        // Arabic word - accumulate it
        arabicWords.push(token);
      } else {
        // Non-Arabic word - flush Arabic words first (reversed), then add this word
        if (arabicWords.length > 0) {
          result.push(...arabicWords.reverse());
          arabicWords = [];
        }
        result.push(token);
      }
    }
    
    // Flush any remaining Arabic words
    if (arabicWords.length > 0) {
      result.push(...arabicWords.reverse());
    }
    
    return result.join('');
  }

  /**
   * Ensure PDFKit font data directory exists and has font files
   */
  private static async ensureFontDataDir(): Promise<void> {
    try {
      // PDFKit looks for font files in a 'data' directory relative to where the code is running
      // In development with Electron, this is typically dist-electron/data
      // We need to copy fonts to where PDFKit expects them
      
      // Determine the base path - PDFKit looks relative to __dirname or process.cwd()
      // In Electron dev mode, __dirname is typically dist-electron/main/services/receipt
      // So we need to go up to dist-electron
      let basePath: string;
      if (__dirname.includes('dist-electron')) {
        // We're in dist-electron/main/services/receipt, go up to dist-electron
        basePath = path.resolve(__dirname, '..', '..', '..');
      } else {
        // Development or other scenario, use process.cwd()
        basePath = process.cwd();
      }
      
      const fontDataDir = path.join(basePath, 'data');
      
      logger.posReceipt('Ensuring font data directory', { 
        __dirname, 
        basePath, 
        fontDataDir,
      });
      
      // Try multiple possible locations for source font files
      const possibleSourcePaths = [
        path.join(process.cwd(), 'node_modules', 'pdfkit', 'js', 'data'),
        path.join(app.getAppPath(), 'node_modules', 'pdfkit', 'js', 'data'),
        path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'pdfkit', 'js', 'data'),
        path.join(basePath, '..', 'node_modules', 'pdfkit', 'js', 'data'),
      ];
      
      let sourceFontPath: string | null = null;
      for (const possiblePath of possibleSourcePaths) {
        const testFile = path.join(possiblePath, 'Courier.afm');
        if (await fs.pathExists(testFile)) {
          sourceFontPath = possiblePath;
          logger.posReceipt('Found font source directory', { sourceFontPath });
          break;
        }
      }
      
      const distFontPath = path.join(fontDataDir, 'Courier.afm');
      
      // If font files don't exist in destination, copy from source
      if (!(await fs.pathExists(distFontPath))) {
        if (sourceFontPath) {
          await fs.ensureDir(fontDataDir);
          // Copy essential font files
          const fontFiles = ['Courier.afm', 'Courier-Bold.afm', 'Courier-Oblique.afm', 'Courier-BoldOblique.afm'];
          for (const fontFile of fontFiles) {
            const src = path.join(sourceFontPath, fontFile);
            const dest = path.join(fontDataDir, fontFile);
            if (await fs.pathExists(src)) {
              await fs.copy(src, dest);
              logger.posReceipt('Copied font file', { from: src, to: dest });
            }
          }
          logger.posReceipt('PDFKit font files copied to data directory', { fontDataDir });
        } else {
          logger.error('PDFKit font files not found in any expected location', { 
            basePath,
            fontDataDir,
            possibleSourcePaths,
          });
          throw new Error('PDFKit font files not found. Cannot generate receipt.');
        }
      } else {
        logger.posReceipt('PDFKit font files already exist', { fontDataDir });
      }
    } catch (error) {
      logger.error('Failed to ensure font data directory', { error });
      throw error; // Re-throw to fail receipt generation
    }
  }

  /**
   * Generate receipt PDF for a transaction
   */
  static async generateReceipt(transactionId: number): Promise<string> {
    const startTime = Date.now();
    try {
      // Ensure font data is available before creating PDF
      await this.ensureFontDataDir();
      
      logger.posReceipt('Receipt generation started', { transactionId });

      // Get transaction with all relations
      const transaction = await TransactionService.getById(transactionId);
      if (!transaction) {
        logger.error('Receipt generation failed: transaction not found', { transactionId });
        throw new Error('Transaction not found');
      }

      logger.posReceipt('Transaction loaded for receipt', {
        transactionId,
        transactionNumber: transaction.transactionNumber,
        itemCount: transaction.items.length,
        total: transaction.total,
      });

      // Get settings
      const [printerSettings, storeInfo, taxConfig, exchangeRate] = await Promise.all([
        SettingsService.getPrinterSettings(),
        SettingsService.getStoreInfo(),
        SettingsService.getTaxConfig(),
        CurrencyService.getExchangeRate(),
      ]);

      const paperWidth = printerSettings.paperWidth || 80;
      logger.posReceipt('Settings loaded for receipt', {
        paperWidth,
        storeName: storeInfo.name,
        hasLogo: !!storeInfo.logo,
        logoLength: storeInfo.logo?.length || 0,
        logoPreview: storeInfo.logo ? storeInfo.logo.substring(0, 100) : 'none',
      });
      
      // Debug: Check if logo exists - also log to console for debugging
      if (!storeInfo.logo || storeInfo.logo.trim().length === 0) {
        logger.warn('No logo found in store info', {
          transactionId,
          storeInfoKeys: Object.keys(storeInfo),
          storeInfoLogo: storeInfo.logo,
          logoType: typeof storeInfo.logo,
          logoValue: storeInfo.logo,
        });
      } else {
        logger.posReceipt('Logo found in store info', {
          transactionId,
          logoLength: storeInfo.logo.length,
          logoStartsWith: storeInfo.logo.substring(0, 50),
        });
      }

      await this.ensureReceiptsDir();

      // Format date for filename - use ISO format and replace invalid characters
      const dateStr = new Date(transaction.createdAt)
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .substring(0, 19); // Remove milliseconds and timezone
      
      const filename = `receipt-${transaction.transactionNumber}-${dateStr}.pdf`;
      const filepath = path.join(RECEIPTS_DIR, filename);

      // Convert mm to points (1mm = 2.83465 points)
      const pageWidth = paperWidth * 2.83465;
      
      // Generate hardcoded receipt content
      const renderedTemplate = this.generateReceiptContent(
        storeInfo,
        transaction,
        exchangeRate,
        taxConfig.defaultTaxRate,
        paperWidth,
        taxConfig.taxInclusive || false
      );
      
      // Log receipt content for debugging
      logger.posReceipt('Generated receipt content preview', {
        transactionId,
        templateLength: renderedTemplate.length,
        lineCount: renderedTemplate.split('\n').length,
        firstFewLines: renderedTemplate.split('\n').slice(0, 5).join(' | '),
      });
      
      // Calculate precise content height
      // Account for different font sizes: store name (14), totals (12), regular (9)
      const templateLines = renderedTemplate.split('\n');
      const storeNameForHeight = storeInfo.name || 'DigitalizePOS';
      
      let estimatedContentHeight = 0;
      const logoHeight = storeInfo.logo ? 80 : 0; // Logo height in points
      estimatedContentHeight += logoHeight;
      if (logoHeight > 0) {
        estimatedContentHeight += 1; // Very minimal spacing after logo
      }
      
      // Calculate height for each line based on font size
      templateLines.forEach((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine === '') {
          estimatedContentHeight += 0.6; // Very minimal spacing for empty lines
        } else {
          // Determine font size for this line
          let lineHeight = 12; // Default for font size 9
          if (trimmedLine === storeNameForHeight) {
            lineHeight = 16.8; // Font size 14: 14 * 1.2 line height
          } else if (trimmedLine.startsWith('Total USD:') || trimmedLine.startsWith('Total LBP:')) {
            lineHeight = 14.4; // Font size 12: 12 * 1.2 line height
          }
          estimatedContentHeight += lineHeight;
          estimatedContentHeight += 0.3; // Very minimal spacing between lines
        }
      });
      
      // Add absolute minimal margins (top and bottom)
      const topMargin = 1;
      const bottomMargin = 1;
      estimatedContentHeight += topMargin + bottomMargin;
      
      // Use calculated height with absolute minimal safety margin (only 1% to account for rounding)
      const minHeight = 20 * 2.83465; // 20mm minimum (absolute minimum for safety)
      const maxHeight = 297 * 2.83465; // A4 max (in case content is very long)
      const calculatedHeight = Math.max(minHeight, Math.min(maxHeight, estimatedContentHeight * 1.01));
      
      logger.posReceipt('Page height calculation', {
        transactionId,
        templateLines: templateLines.length,
        estimatedContentHeight,
        calculatedHeight,
        calculatedHeightMm: calculatedHeight / 2.83465,
        minHeightMm: minHeight / 2.83465,
      });

      // Check if receipt content contains Arabic text
      const hasArabic = this.containsArabic(renderedTemplate);
      
      // Find available fonts first (we'll get the font paths)
      const fontInfo = await this.findFontPaths();
      const englishFont = fontInfo.englishFont;
      const arabicFontName = fontInfo.arabicFont;
      const englishFontPath = fontInfo.englishFontPath;
      const arabicFontPath = fontInfo.arabicFontPath;

      // Create PDF document with settings-based paper width and calculated height
      // Use 'Courier' in constructor (built-in font) to prevent PDFKit from trying to load font files
      // We'll register and switch to custom fonts after document creation
      // Absolute minimal margins for receipt printing - especially top margin to avoid whitespace
      const doc = new PDFDocument({
        size: [pageWidth, calculatedHeight],
        margins: {
          top: 1,    // Absolute minimal top margin for receipt printing
          bottom: 1, // Absolute minimal bottom margin
          left: 10,  // Small left margin
          right: 10, // Small right margin
        },
        font: 'Courier', // Use built-in font in constructor to avoid file path errors
      });
      
      // Register the fonts in the document
      if (englishFontPath && englishFont !== 'Courier') {
        try {
          doc.registerFont(englishFont, englishFontPath);
          logger.posReceipt('English font registered in document', { fontName: englishFont, fontPath: englishFontPath });
        } catch (error) {
          logger.error('Failed to register English font in document', { fontName: englishFont, fontPath: englishFontPath, error });
          // Fall back to Courier if registration fails
          logger.warn('Falling back to Courier font due to registration failure');
        }
      }
      
      if (arabicFontPath && arabicFontName && arabicFontName !== englishFont) {
        try {
          doc.registerFont(arabicFontName, arabicFontPath);
          logger.posReceipt('Arabic font registered in document', { fontName: arabicFontName, fontPath: arabicFontPath });
        } catch (error) {
          logger.error('Failed to register Arabic font in document', { fontName: arabicFontName, fontPath: arabicFontPath, error });
        }
      }
      
      if (hasArabic && arabicFontName) {
        logger.posReceipt('Arabic text detected, fonts configured', {
          englishFont,
          arabicFont: arabicFontName,
          transactionId,
        });
      } else {
        logger.posReceipt('Fonts configured', {
          englishFont,
          transactionId,
        });
      }

      // Pipe to file
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Start at the top margin (no extra spacing)
      doc.y = doc.page.margins.top;

      // Add logo to PDF if available (always add if logo exists, not just if placeholder is in template)
      let tempLogoPath: string | null = null;
      const logoValue = storeInfo.logo;
      const hasValidLogo = logoValue && typeof logoValue === 'string' && logoValue.trim().length > 0;
      
      // Log to both console and logger for debugging
      const logoCheckInfo = {
        hasLogo: !!logoValue,
        logoType: typeof logoValue,
        logoLength: logoValue?.length || 0,
        hasValidLogo,
        logoPreview: logoValue ? logoValue.substring(0, 50) : 'none',
      };
      logger.posReceipt('Logo check for receipt', {
        transactionId,
        ...logoCheckInfo,
      });
      
      if (hasValidLogo && logoValue) {
        try {
          logger.posReceipt('Adding logo to receipt', {
            transactionId,
            hasLogo: !!logoValue,
            logoLength: logoValue.length,
            logoPreview: logoValue.substring(0, 100),
            logoType: typeof logoValue,
          });
          
          // Convert base64 to buffer
          // Handle different base64 formats: data:image/png;base64, or data:image/jpeg;base64, or just base64 string
          let base64Data: string = logoValue;
          let imageFormat = 'png'; // Default format
          
          // Extract format and base64 data
          if (base64Data.includes(',')) {
            const parts = base64Data.split(',');
            const extractedData = parts[1];
            if (extractedData) {
              base64Data = extractedData;
            }
            // Extract format from data URI
            const dataUriMatch = parts[0].match(/data:image\/(\w+);base64/);
            if (dataUriMatch && dataUriMatch[1]) {
              imageFormat = dataUriMatch[1].toLowerCase();
            }
          } else if (base64Data.startsWith('data:')) {
            // Extract base64 part from data URI
            const dataUriMatch = base64Data.match(/data:image\/(\w+);base64,(.+)/);
            if (dataUriMatch && dataUriMatch[2]) {
              imageFormat = dataUriMatch[1].toLowerCase();
              base64Data = dataUriMatch[2];
            } else {
              base64Data = base64Data.replace(/^data:image\/\w+;base64,/, '');
            }
          }
          
          logger.posReceipt('Logo format detected', {
            transactionId,
            imageFormat,
            base64Length: base64Data.length,
          });
          
          let imageBuffer = Buffer.from(base64Data, 'base64');
          
          // Validate buffer
          if (!imageBuffer || imageBuffer.length === 0) {
            throw new Error('Invalid image buffer: empty or invalid base64 data');
          }
          
          // Check buffer header to verify it's a valid image
          const header = imageBuffer.slice(0, 4).toString('hex');
          logger.posReceipt('Logo buffer created', {
            transactionId,
            bufferSize: imageBuffer.length,
            bufferHeader: header,
          });
          
          // Convert image to PNG format using sharp with high quality settings
          // PDFKit works best with PNG format, and sharp ensures proper conversion
          try {
            logger.posReceipt('Converting image to PNG using sharp with high quality', {
              transactionId,
              originalFormat: imageFormat,
            });
            
            // Use sharp to convert to PNG with maximum quality settings
            // Resize to larger dimensions first, then let PDFKit scale down for better clarity
            const convertedBuffer = await sharp(imageBuffer)
              .resize(400, 300, { // Resize to 2x the display size for better quality (retina-like)
                fit: 'inside',
                withoutEnlargement: false, // Allow enlarging if needed
                kernel: 'lanczos3', // High-quality resampling algorithm (best quality)
              })
              .png({ 
                quality: 100, // Maximum quality
                compressionLevel: 1, // Lower compression = better quality (1 is best quality, 9 is smallest)
                palette: false, // Use true color, not palette
              })
              .sharpen(1, 1, 2) // Apply sharpening for better clarity (sigma, flat, jagged)
              .toBuffer();
            
            imageBuffer = Buffer.from(convertedBuffer);
            
            logger.posReceipt('Image converted to PNG with high quality and sharpening', {
              transactionId,
              newBufferSize: imageBuffer.length,
            });
            imageFormat = 'png'; // Update format to PNG
          } catch (sharpError) {
            logger.warn('Failed to convert image with sharp, using original', {
              transactionId,
              error: sharpError instanceof Error ? sharpError.message : String(sharpError),
            });
            // Continue with original buffer if sharp conversion fails
          }
          
          // Save to temporary file (PDFKit works better with file paths)
          const tempDir = tmpdir();
          tempLogoPath = path.join(tempDir, `receipt-logo-${transactionId}-${Date.now()}.${imageFormat}`);
          await fs.writeFile(tempLogoPath, imageBuffer);
          
          logger.posReceipt('Logo saved to temp file', {
            transactionId,
            tempPath: tempLogoPath,
            fileSize: imageBuffer.length,
          });
          
          // Add logo at the top, centered
          // Calculate available width (page width minus margins)
          const leftMargin = doc.page.margins.left;
          const rightMargin = doc.page.margins.right;
          const availableWidth = pageWidth - leftMargin - rightMargin;
          // Increase logo size for better clarity
          const logoMaxWidth = Math.min(120, availableWidth); // Increased from 100 to 120
          const logoMaxHeight = 80; // Increased from 60 to 80 points for better clarity
          
          // Calculate X position to center the logo
          // We'll position it at the top margin Y position
          const logoY = doc.page.margins.top;
          const logoX = leftMargin + (availableWidth - logoMaxWidth) / 2;
          
          // Verify temp file exists before trying to use it
          const fileExists = await fs.pathExists(tempLogoPath);
          if (!fileExists) {
            throw new Error(`Temp logo file does not exist: ${tempLogoPath}`);
          }
          
          const fileStats = await fs.stat(tempLogoPath);
          logger.posReceipt('Temp logo file verified', {
            transactionId,
            tempLogoPath,
            fileSize: fileStats.size,
            fileExists,
          });
          
          // Use buffer directly like the report service does (more reliable than file path)
          // PDFKit can handle buffers directly for PNG and JPEG
          logger.posReceipt('Adding logo using buffer directly', {
            transactionId,
            logoX,
            logoY,
            logoMaxWidth,
            logoMaxHeight,
            bufferSize: imageBuffer.length,
            imageFormat,
            bufferHeader: header,
          });
          
          // Use buffer directly - this matches how the report service does it
          doc.image(imageBuffer, logoX, logoY, {
            fit: [logoMaxWidth, logoMaxHeight],
          });
          
          logger.posReceipt('Logo image added successfully using buffer', {
            transactionId,
            logoX,
            logoY,
            logoMaxWidth,
            logoMaxHeight,
          });
          
          // Update Y position after logo (logo height + spacing)
          doc.y = logoY + logoMaxHeight + 1; // Absolute minimal spacing after logo
          
          logger.posReceipt('Logo added to receipt successfully', {
            transactionId,
            logoX,
            logoY,
            logoMaxWidth,
            logoMaxHeight,
            newYPosition: doc.y,
          });
        } catch (error) {
          logger.error('Failed to add logo to receipt', {
            transactionId,
            error: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            logoLength: storeInfo.logo?.length,
            tempLogoPath,
          });
          // Continue without logo - don't fail receipt generation
          // Reset Y position to top margin if logo failed
          doc.y = doc.page.margins.top;
        } finally {
          // Clean up temporary file
          if (tempLogoPath) {
            try {
              await fs.remove(tempLogoPath);
              logger.posReceipt('Temp logo file cleaned up', { transactionId, tempLogoPath });
            } catch (cleanupError) {
              logger.warn('Failed to cleanup temp logo file', {
                transactionId,
                tempLogoPath,
                error: cleanupError,
              });
            }
          }
        }
      } else {
        logger.posReceipt('No logo to add to receipt', {
          transactionId,
          hasLogo: !!storeInfo.logo,
        });
      }

      // Split template into lines and render faithfully
      const lines = renderedTemplate.split('\n');
      
      logger.posReceipt('Rendering receipt lines', {
        transactionId,
        totalLines: lines.length,
        nonEmptyLines: lines.filter(l => l.trim() !== '').length,
        pageWidth,
        calculatedHeight,
      });
      
      // Set initial font - use the configured English font if registered, otherwise fall back to Courier
      // Only use custom font if it was successfully registered (fontPath exists)
      const effectiveEnglishFont = (englishFontPath && englishFont !== 'Courier') ? englishFont : 'Courier';
      doc.font(effectiveEnglishFont).fontSize(9);
      
      // Store info for comparison (to detect store name, address, and phone lines for centering)
      const storeName = storeInfo.name || 'DigitalizePOS';
      const storeAddress = storeInfo.address || '';
      const storePhone = storeInfo.phone || '';
      
      // Footer messages to center
      const thankYouMessage = 'Thank you for your purchase! We hope to see you again soon!';
      const poweredByMessage = 'Powered by DigitalizePOS';
      const websiteMessage = 'www.digitalizepos.com';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isLastLine = i === lines.length - 1;
        
        // Check if we're still within page bounds
        if (doc.y > calculatedHeight - doc.page.margins.bottom - 20) {
          logger.warn('Content exceeds page height, stopping rendering', {
            transactionId,
            currentY: doc.y,
            pageHeight: calculatedHeight,
            lineIndex: i,
          });
          break;
        }
        
        if (line.trim() === '') {
          // Only add minimal spacing for empty lines if not at the end
          if (!isLastLine) {
            doc.moveDown(0.05);
          }
          continue;
        }

        // Check if line contains divider or separator
        if (line.trim() === '---' || line.trim() === '___') {
          const currentY = doc.y;
          const leftMargin = doc.page.margins.left;
          const rightMargin = doc.page.margins.right;
          doc.moveTo(leftMargin, currentY).lineTo(pageWidth - rightMargin, currentY).stroke();
          doc.moveDown(0.1);
        } else {
          // Check if this line should be centered
          const trimmedLine = line.trim();
          const isStoreNameLine = trimmedLine === storeName;
          const isStoreAddressLine = storeAddress && trimmedLine === storeAddress;
          const isStorePhoneLine = storePhone && trimmedLine === storePhone;
          const isExchangeRateLine = trimmedLine.startsWith('Our exchange rate is');
          const isVATRateLine = trimmedLine.startsWith('VAT ');
          const isThankYouLine = trimmedLine === thankYouMessage;
          const isCashierLine = trimmedLine.startsWith('You have been assisted by');
          const isPoweredByLine = trimmedLine === poweredByMessage;
          const isWebsiteLine = trimmedLine === websiteMessage;
          const isTotalUSDLine = trimmedLine.startsWith('Total USD:');
          const isTotalLBPLine = trimmedLine.startsWith('Total LBP:');
          const shouldCenter = isStoreNameLine || isStoreAddressLine || isStorePhoneLine || 
                              isExchangeRateLine || isVATRateLine || isThankYouLine || isCashierLine || isPoweredByLine || isWebsiteLine;
          
          // Switch font based on whether line contains Arabic
          // Use Arabic font for lines with Arabic (if registered), otherwise use English font
          if (arabicFontPath && arabicFontName && this.containsArabic(line)) {
            doc.font(arabicFontName);
          } else {
            // Use the configured English font (clearer than Courier) or fall back to Courier
            doc.font(effectiveEnglishFont);
          }
          
          // Make store name and totals bigger
          if (isStoreNameLine) {
            doc.fontSize(14); // Larger size for store name
          } else if (isTotalUSDLine || isTotalLBPLine) {
            doc.fontSize(12); // Larger size for Total USD and Total LBP
          } else {
            doc.fontSize(9); // Regular size for other text
          }
          
          // Render line - use text() method that automatically advances Y position
          // Center store info, exchange/VAT rate messages, thank you message, and powered by message; left-align everything else
          doc.text(line, {
            width: pageWidth - doc.page.margins.left - doc.page.margins.right,
            align: shouldCenter ? 'center' : 'left',
          });
          
          // Reset font size after store name or totals
          if (isStoreNameLine || isTotalUSDLine || isTotalLBPLine) {
            doc.fontSize(9);
          }
          
          // Move down for next line (text() already advances Y, but we add absolute minimal spacing)
          if (!isLastLine) {
            doc.moveDown(0.025);
          }
        }
      }
      
      logger.posReceipt('Receipt rendering completed', {
        transactionId,
        finalY: doc.y,
        pageHeight: calculatedHeight,
        contentHeight: doc.y - doc.page.margins.top,
      });

      // Finalize PDF
      doc.end();

      // Wait for stream to finish
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', async () => {
          const duration = Date.now() - startTime;
          logger.posReceipt('Receipt generated successfully', {
            filepath,
            transactionId,
            transactionNumber: transaction.transactionNumber,
            filename,
            itemCount: transaction.items.length,
            total: transaction.total,
            generationTimeMs: duration,
          });
          
          // Clean up temporary logo file after PDF is generated
          if (tempLogoPath) {
            try {
              await fs.remove(tempLogoPath);
              logger.posReceipt('Temp logo file cleaned up', { transactionId, tempLogoPath });
            } catch (cleanupError) {
              logger.warn('Failed to cleanup temp logo file', {
                transactionId,
                tempLogoPath,
                error: cleanupError,
              });
            }
          }
          
          resolve();
        });
        stream.on('error', async (err) => {
          logger.error('Receipt PDF stream error', {
            transactionId,
            transactionNumber: transaction.transactionNumber,
            error: err,
          });
          
          // Clean up temporary logo file on error too
          if (tempLogoPath) {
            try {
              await fs.remove(tempLogoPath);
            } catch (cleanupError) {
              logger.warn('Failed to cleanup temp logo file on error', {
                transactionId,
                tempLogoPath,
                error: cleanupError,
              });
            }
          }
          
          reject(err);
        });
      });

      return filepath;
    } catch (error) {
      logger.error('Error generating receipt', {
        transactionId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get receipt file path for a transaction
   */
  static async getReceiptPath(transactionId: number): Promise<string | null> {
    try {
      logger.debug('Getting receipt path', { transactionId });

      const transaction = await TransactionService.getById(transactionId);
      if (!transaction) {
        logger.warn('Receipt path not found: transaction not found', { transactionId });
        return null;
      }

      await this.ensureReceiptsDir();

      // Search for receipt file
      const files = await fs.readdir(RECEIPTS_DIR);
      const receiptFile = files.find((file) =>
        file.includes(transaction.transactionNumber)
      );

      if (receiptFile) {
        const receiptPath = path.join(RECEIPTS_DIR, receiptFile);
        logger.debug('Receipt path found', {
          transactionId,
          transactionNumber: transaction.transactionNumber,
          receiptPath,
        });
        return receiptPath;
      }

      logger.debug('Receipt file not found', {
        transactionId,
        transactionNumber: transaction.transactionNumber,
      });
      return null;
    } catch (error) {
      logger.error('Error getting receipt path', {
        transactionId,
        error,
      });
      return null;
    }
  }

  /**
   * Delete receipt file
   */
  static async deleteReceipt(transactionId: number): Promise<boolean> {
    try {
      logger.posReceipt('Receipt deletion started', { transactionId });

      const receiptPath = await this.getReceiptPath(transactionId);
      if (receiptPath) {
        await fs.remove(receiptPath);
        logger.posReceipt('Receipt deleted successfully', {
          receiptPath,
          transactionId,
        });
        return true;
      }

      logger.warn('Receipt deletion: file not found', { transactionId });
      return false;
    } catch (error) {
      logger.error('Error deleting receipt', {
        transactionId,
        error,
      });
      return false;
    }
  }
}


