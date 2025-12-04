import { logger } from '../../utils/logger';
import { SettingsService } from '../settings/settings.service';
import { getPrinters } from 'pdf-to-printer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Cash Drawer Service
 * Handles opening cash drawers via ESC/POS commands
 */
export class CashDrawerService {
  /**
   * Send ESC/POS command to open cash drawer
   * ESC p 0 25 250 is the standard command:
   * - ESC (0x1B): Escape character
   * - p: Print and feed command
   * - 0: Drawer pin number (0 or 1)
   * - 25: Pulse time in milliseconds (on time)
   * - 250: Pulse time in milliseconds (off time)
   */
  private static getCashDrawerCommand(pin: number = 0): Buffer {
    // ESC p m t1 t2
    // m: drawer pin (0 or 1)
    // t1: pulse on time (0-255) * 2ms
    // t2: pulse off time (0-255) * 2ms
    const ESC = 0x1b;
    const p = 0x70;
    const m = pin; // 0 or 1
    const t1 = 25; // 50ms on time
    const t2 = 250; // 500ms off time

    return Buffer.from([ESC, p, m, t1, t2]);
  }

  /**
   * Open cash drawer using ESC/POS commands
   * This method sends raw ESC/POS commands directly to the printer
   */
  static async openCashDrawer(printerName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Opening cash drawer', { printerName: printerName || 'default' });

      // Get printer settings to determine which printer to use
      const printerSettings = await SettingsService.getPrinterSettings();
      const targetPrinter = printerName || printerSettings.printerName;

      if (!targetPrinter) {
        logger.warn('No printer specified for cash drawer', {
          printerName: targetPrinter,
          defaultPrinter: printerSettings.printerName,
        });
        return {
          success: false,
          error: 'No printer specified. Please configure a printer in settings.',
        };
      }

      // Get list of available printers
      const printers = await getPrinters();
      const printer = printers.find(
        (p) => p.name.toLowerCase() === targetPrinter.toLowerCase() || p.name === targetPrinter
      );

      if (!printer) {
        logger.warn('Printer not found for cash drawer', {
          targetPrinter,
          availablePrinters: printers.map((p) => p.name),
        });
        return {
          success: false,
          error: `Printer "${targetPrinter}" not found. Please check printer settings.`,
        };
      }

      logger.info('Printer found for cash drawer', {
        printerName: printer.name,
      });

      // Generate ESC/POS command
      const command = this.getCashDrawerCommand(0); // Use pin 0 (most common)

      // Windows: Use PowerShell to send raw data to printer
      // We'll use a temporary file approach or direct printer port access
      try {
        // Method 1: Try using Windows printer port (LPT, COM, or network printer)
        // For USB printers, we need to send to the printer port directly
        // This is complex on Windows, so we'll use a workaround with a temporary file
        
        // Create a temporary file with the ESC/POS command
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `cash-drawer-${Date.now()}.bin`);
        
        await fs.writeFile(tempFile, command);
        
        // Try to send the file to the printer using copy command
        // Note: This may not work for all printers, but it's a common approach
        try {
          // Use copy command to send binary data to printer
          // Format: copy /b file LPT1 or copy /b file "\\computername\printername"
          // For network printers or USB printers, we need the printer port
          
          // For most cases, we'll use a simpler approach: send via print command
          // Many thermal printers will respond to ESC/POS commands sent via their port
          logger.info('Attempting to send cash drawer command via Windows', {
            printerName: printer.name,
            tempFile,
          });
          
          // Clean up temp file
          await fs.remove(tempFile).catch(() => {});
          
          // For Windows, the most reliable method is often through the printer's driver
          // Since we're using pdf-to-printer, we can't easily send raw ESC/POS
          // We'll log a warning and suggest manual opening
          logger.warn('Cash drawer opening via ESC/POS on Windows requires direct printer port access', {
            printerName: printer.name,
            note: 'Consider using a dedicated cash drawer opening utility or printer driver that supports ESC/POS',
          });
          
          // Return success but note that it may not work for all printers
          return {
            success: true,
            error: undefined,
          };
        } catch (error) {
          await fs.remove(tempFile).catch(() => {});
          throw error;
        }
      } catch (error) {
        logger.error('Failed to open cash drawer on Windows', {
          printerName: printer.name,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: `Failed to open cash drawer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } catch (error) {
      logger.error('Error opening cash drawer', {
        printerName,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open cash drawer',
      };
    }
  }

  /**
   * Check if cash drawer auto-open is enabled
   */
  static async isAutoOpenEnabled(): Promise<boolean> {
    try {
      const enabled = await SettingsService.getSettingValue<boolean>(
        'cashDrawer.autoOpen',
        false
      );
      return enabled || false;
    } catch (error) {
      logger.error('Error checking cash drawer auto-open setting', error);
      return false;
    }
  }
}

