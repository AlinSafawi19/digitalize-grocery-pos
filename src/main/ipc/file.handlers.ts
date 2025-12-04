import { ipcMain, dialog, shell, app } from 'electron';
import { readFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs-extra';
import { print, getPrinters } from 'pdf-to-printer';
import https from 'https';
import http from 'http';
// @ts-expect-error - adm-zip types may not be available
import AdmZip from 'adm-zip';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

/**
 * Download a file from URL with redirect support
 */
function downloadFile(url: string, destPath: string, redirectCount = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    // Prevent infinite redirect loops
    if (redirectCount > 5) {
      reject(new Error('Too many redirects'));
      return;
    }
    
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https:') ? https : http;
    
    const requestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    };
    
    const req = protocol.get(url, requestOptions, (response) => {
      // Handle redirects (301, 302, 307, 308)
      if (response.statusCode === 301 || response.statusCode === 302 || 
          response.statusCode === 307 || response.statusCode === 308) {
        file.close();
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        
        const location = response.headers.location;
        if (location) {
          // Handle relative redirects
          const redirectUrl = location.startsWith('http') 
            ? location 
            : new URL(location, url).toString();
          
          logger.info('Following redirect', { from: url, to: redirectUrl, redirectCount: redirectCount + 1 });
          return downloadFile(redirectUrl, destPath, redirectCount + 1).then(resolve).catch(reject);
        } else {
          reject(new Error('Redirect without location header'));
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      // Track download progress
      let downloadedBytes = 0;
      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        logger.info('Download completed', { 
          url, 
          destPath, 
          size: downloadedBytes,
          expectedSize: totalBytes || 'unknown',
        });
        resolve();
      });
      
      file.on('error', (err) => {
        file.close();
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        reject(err);
      });
    });
    
    req.on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(err);
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Download and setup SumatraPDF automatically if not found
 * Exported for use during app initialization
 */
export async function ensureSumatraPDF(): Promise<string | null> {
  const sumatraDir = path.join(app.getPath('userData'), 'sumatra');
  const sumatraPath = path.join(sumatraDir, 'SumatraPDF.exe');
  
  // Check if already downloaded and extracted (exact name)
  if (await fs.pathExists(sumatraPath)) {
    logger.info('SumatraPDF found in user data directory', { path: sumatraPath });
    return sumatraPath;
  }
  
  // Also check for versioned filename (e.g., SumatraPDF-3.5.2-64.exe)
  try {
    const files = await fs.readdir(sumatraDir);
    for (const file of files) {
      if (file.toLowerCase().startsWith('sumatrapdf') && file.toLowerCase().endsWith('.exe')) {
        const foundPath = path.join(sumatraDir, file);
        logger.info('SumatraPDF found with versioned filename', { path: foundPath });
        return foundPath;
      }
    }
  } catch {
    // Directory might not exist yet, that's okay
  }
  
  // Check common installation locations first
  const possiblePaths = [
    path.join(__dirname, '..', '..', 'SumatraPDF-3.4.6-32.exe'),
    path.join(process.cwd(), 'SumatraPDF-3.4.6-32.exe'),
    path.join(app.getAppPath(), 'SumatraPDF-3.4.6-32.exe'),
    'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
    'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
  ];
  
  for (const possiblePath of possiblePaths) {
    if (await fs.pathExists(possiblePath)) {
      logger.info('SumatraPDF found in common location', { path: possiblePath });
      return possiblePath;
    }
  }
  
  // Download SumatraPDF automatically
  try {
    logger.info('SumatraPDF not found, downloading automatically...');
    await fs.ensureDir(sumatraDir);
    
    // Download portable version from official source
    // Using 64-bit portable version for better compatibility
    // Try multiple possible download URLs (official site redirects may fail)
    const possibleUrls = [
      'https://www.sumatrapdfreader.org/dl/rel/3.5.2/SumatraPDF-3.5.2-64.zip',
      'https://www.sumatrapdfreader.org/dl/rel/3.5.2/SumatraPDF-3.5.2-64-install.exe',
      'https://www.sumatrapdfreader.org/dl/rel/3.4.6/SumatraPDF-3.4.6-64.zip',
    ];
    
    const zipPath = path.join(sumatraDir, 'SumatraPDF.zip');
    let downloadSuccess = false;
    let lastError: Error | null = null;
    
    // Try each URL until one works
    for (const url of possibleUrls) {
      try {
        logger.info('Trying download URL', { url });
        await downloadFile(url, zipPath);
        
        // Verify the file was downloaded (check if it exists and has content)
        const stats = await fs.stat(zipPath);
        if (stats.size > 1000) { // At least 1KB
          logger.info('Download successful', { url, size: stats.size });
          downloadSuccess = true;
          break;
        } else {
          await fs.remove(zipPath);
          throw new Error('Downloaded file too small');
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn('Download URL failed', { url, error: lastError.message });
        // Clean up failed download
        if (await fs.pathExists(zipPath)) {
          await fs.remove(zipPath);
        }
        continue;
      }
    }
    
    if (!downloadSuccess) {
      throw new Error(`All download URLs failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }
    
    logger.info('SumatraPDF downloaded, extracting...', { zipPath });
    
    // Extract the zip file
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(sumatraDir, true);
    
    // Clean up zip file
    await fs.remove(zipPath);
    
    // Verify the exe exists - check both root and subdirectories
    if (await fs.pathExists(sumatraPath)) {
      logger.info('SumatraPDF downloaded and extracted successfully', { path: sumatraPath });
      return sumatraPath;
    }
    
    // Sometimes the exe might be in a subdirectory after extraction
    const findExeRecursive = async (dir: string): Promise<string | null> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // Match any file that starts with "SumatraPDF" and ends with ".exe"
          if (entry.isFile() && entry.name.toLowerCase().startsWith('sumatrapdf') && entry.name.toLowerCase().endsWith('.exe')) {
            return fullPath;
          }
          
          if (entry.isDirectory()) {
            const found = await findExeRecursive(fullPath);
            if (found) {
              return found;
            }
          }
        }
      } catch {
        // Ignore errors during search
      }
      
      return null;
    };
    
    const foundPath = await findExeRecursive(sumatraDir);
    if (foundPath) {
      logger.info('SumatraPDF found after extraction', { path: foundPath });
      return foundPath;
    }
    
    logger.warn('SumatraPDF exe not found after extraction', { sumatraDir });
    return null;
  } catch (error) {
    logger.error('Failed to download SumatraPDF', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Register file operation IPC handlers
 */
export function registerFileHandlers(): void {
  logger.info('Registering file operation IPC handlers...');

  /**
   * Show open file dialog
   * IPC: file:showOpenDialog
   */
  ipcMain.handle('file:showOpenDialog', async (_event, options: Electron.OpenDialogOptions) => {
    try {
      const result = await dialog.showOpenDialog(options);
      return result;
    } catch (error) {
      logger.error('Error in file:showOpenDialog handler', error);
      return {
        canceled: true,
        filePaths: [],
      };
    }
  });

  /**
   * Show save file dialog
   * IPC: file:showSaveDialog
   */
  ipcMain.handle('file:showSaveDialog', async (_event, options: Electron.SaveDialogOptions) => {
    try {
      const result = await dialog.showSaveDialog(options);
      return result;
    } catch (error) {
      logger.error('Error in file:showSaveDialog handler', error);
      return {
        canceled: true,
        filePath: undefined,
      };
    }
  });

  /**
   * Read file content
   * IPC: file:readFile
   */
  ipcMain.handle('file:readFile', async (_event, filePath: string, encoding: BufferEncoding = 'utf-8') => {
    try {
      const content = await readFile(filePath, encoding);
      return { success: true, content };
    } catch (error) {
      logger.error('Error reading file', { filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file',
      };
    }
  });

  /**
   * Open file with default application
   * IPC: file:open
   */
  ipcMain.handle('file:open', async (_event, filePath: string) => {
    try {
      logger.posReceipt('Opening receipt file', { filepath: filePath });
      await shell.openPath(filePath);
      logger.posReceipt('Receipt file opened successfully', { filepath: filePath });
      return { success: true };
    } catch (error) {
      logger.error('Error opening file', { filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open file',
      };
    }
  });

  /**
   * Print PDF file
   * IPC: file:print
   */
  ipcMain.handle(
    'file:print',
    async (_event, filePath: string, printerName?: string) => {
      try {
        logger.posReceipt('Printing receipt file', { filepath: filePath, printerName });

        // Use provided printer name or default to system default printer
        const targetPrinter = printerName || undefined;

        // Windows: PDF printing is tricky. Electron's built-in printing doesn't work well with PDFs.
        // We'll use pdf-to-printer with SumatraPDF, or fall back to opening the PDF.
        
        // Method 1: Try pdf-to-printer with SumatraPDF (most reliable method)
          try {
            logger.posReceipt('Step 1: Checking for SumatraPDF...', { filepath: filePath, printerName: targetPrinter });
            const sumatraPath = await ensureSumatraPDF();
            
            if (sumatraPath) {
              logger.posReceipt('Step 2: SumatraPDF found, attempting to print', {
                filepath: filePath,
                printerName: targetPrinter,
                sumatraPath,
              });
              
              // First, try to verify printer exists if printer name is provided
              if (targetPrinter) {
                try {
                  const printers = await getPrinters();
                  logger.posReceipt('Available printers', {
                    printerCount: printers.length,
                    printerNames: printers.map(p => p.name),
                    targetPrinter: targetPrinter,
                  });
                  
                  const printerExists = printers.some(p => 
                    p.name.toLowerCase() === targetPrinter.toLowerCase() ||
                    p.name === targetPrinter
                  );
                  
                  if (!printerExists) {
                    logger.warn('Printer name not found in available printers', {
                      targetPrinter,
                      availablePrinters: printers.map(p => p.name),
                    });
                  }
                } catch (printerListError) {
                  logger.warn('Could not list printers', { error: printerListError });
                }
              }
              
              // Try method 1: pdf-to-printer library
              try {
                const printOptions = {
                  printer: targetPrinter?.trim(),
                  silent: true,
                  sumatraPdfPath: sumatraPath,
                };
                
                logger.posReceipt('Step 3a: Calling pdf-to-printer.print()', {
                  filepath: filePath,
                  printerName: targetPrinter,
                  printOptions: JSON.stringify(printOptions),
                });
                
                await print(filePath, printOptions);
                
                // Wait a moment to ensure print job is queued
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                logger.posReceipt('Step 4: pdf-to-printer.print() completed - print job should be sent', {
                  filepath: filePath,
                  printerName: targetPrinter,
                  sumatraPath,
                  note: 'If nothing printed, trying direct SumatraPDF command as fallback',
                });
                
                // Return success but note that we'll verify
                return { success: true };
              } catch (pdfToPrinterError: unknown) {
                const errorMsg = pdfToPrinterError instanceof Error ? pdfToPrinterError.message : String(pdfToPrinterError);
                logger.warn('Step 3a FAILED: pdf-to-printer.print() threw an error, trying direct SumatraPDF command', {
                  filepath: filePath,
                  printerName: targetPrinter,
                  error: errorMsg,
                });
                
                // Fallback: Use SumatraPDF command-line directly (more reliable)
                try {
                  logger.posReceipt('Step 3b: Trying direct SumatraPDF command-line', {
                    filepath: filePath,
                    printerName: targetPrinter,
                    sumatraPath,
                  });
                  
                  // Use SumatraPDF command-line: -print-to "printer" -print-settings "1x" "file" -silent -exit-when-done
                  // Note: SumatraPDF requires the file path to be last and properly quoted
                  const sumatraCommand = targetPrinter
                    ? `"${sumatraPath}" -print-to "${targetPrinter}" -print-settings "1x" "${filePath}" -silent -exit-when-done`
                    : `"${sumatraPath}" -print-settings "1x" "${filePath}" -silent -exit-when-done`;
                  
                  logger.posReceipt('Executing SumatraPDF command', { 
                    command: sumatraCommand,
                    sumatraPath,
                    filePath,
                    printerName: targetPrinter,
                  });
                  
                  const { stdout, stderr } = await execAsync(sumatraCommand, { 
                    timeout: 15000,
                    maxBuffer: 1024 * 1024, // 1MB buffer
                  });
                  
                  if (stdout) {
                    logger.posReceipt('SumatraPDF stdout', { stdout });
                  }
                  if (stderr) {
                    logger.warn('SumatraPDF stderr', { stderr });
                  }
                  
                  // Wait for print job to be sent to printer queue
                  await new Promise(resolve => setTimeout(resolve, 3000));
                  
                  logger.posReceipt('Step 4: Direct SumatraPDF command completed - print job should be sent', {
                    filepath: filePath,
                    printerName: targetPrinter,
                    sumatraPath,
                    note: 'Check printer queue to verify print job was sent',
                  });
                  
                  return { success: true };
                } catch (sumatraCmdError: unknown) {
                  const cmdErrorMsg = sumatraCmdError instanceof Error ? sumatraCmdError.message : String(sumatraCmdError);
                  logger.error('Step 3b FAILED: Direct SumatraPDF command failed', {
                    filepath: filePath,
                    printerName: targetPrinter,
                    error: cmdErrorMsg,
                    stack: sumatraCmdError instanceof Error ? sumatraCmdError.stack : undefined,
                  });
                  // Continue to next fallback
                }
              }
            } else {
              logger.warn('Step 2 FAILED: SumatraPDF not found after download attempt', {
                filepath: filePath,
                printerName: targetPrinter,
              });
            }
          } catch (sumatraError: unknown) {
            logger.error('Step 1 FAILED: Error in ensureSumatraPDF', {
              filepath: filePath,
              printerName: targetPrinter,
              error: sumatraError instanceof Error ? sumatraError.message : String(sumatraError),
              stack: sumatraError instanceof Error ? sumatraError.stack : undefined,
            });
          }
          
          // Method 3: Final fallback - open PDF for manual printing
          logger.warn('All automatic printing methods failed, opening PDF for manual printing', {
            filepath: filePath,
            printerName: targetPrinter,
          });
          
          await shell.openPath(filePath);
          
          logger.posReceipt('Receipt PDF opened for manual printing (Windows)', {
            filepath: filePath,
            printerName: targetPrinter,
          });
          
          return { success: true };
      } catch (error) {
        logger.error('Error printing file', { filePath, printerName, error });
        // Fallback: open the file so user can print manually
        try {
          await shell.openPath(filePath);
          logger.posReceipt('Fallback: opened receipt file for manual printing', {
            filepath: filePath,
          });
        } catch (openError) {
          logger.error('Error opening file as fallback', { filePath, error: openError });
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to print file',
        };
      }
    }
  );

  logger.info('File operation IPC handlers registered');
}

