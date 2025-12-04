import path from 'path';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import { USER_DATA_PATH } from './constants';

const execAsync = promisify(exec);

/**
 * Check if a path is on an external/removable drive
 * External drive means a drive different from where the application data is stored
 * This includes USB drives, external hard disks, network drives, etc.
 */
export async function isExternalDrive(destinationPath: string): Promise<boolean> {
  try {
    const normalizedDestination = path.resolve(destinationPath);
    const normalizedAppData = path.resolve(USER_DATA_PATH);

    // Get the root drive/path for both
    const destinationRoot = getRootPath(normalizedDestination);
    const appDataRoot = getRootPath(normalizedAppData);

    // If roots are different, it's an external drive
    if (destinationRoot.toLowerCase() !== appDataRoot.toLowerCase()) {
      logger.info('Path is on external drive', {
        destination: normalizedDestination,
        destinationRoot,
        appDataRoot,
      });
      return true;
    }

    // Same root - check if it's a removable drive on Windows
    if (process.platform === 'win32') {
      return await isRemovableDriveWindows(destinationRoot);
    }

    // For Linux/Mac, if it's the same root as app data, it's not external
    logger.info('Path is on same drive as application data', {
      destination: normalizedDestination,
      root: destinationRoot,
    });
    return false;
  } catch (error) {
    logger.error('Error checking if path is external drive', error);
    // On error, be conservative and allow it (but log the error)
    return false;
  }
}

/**
 * Get the root path (drive letter on Windows, / on Unix)
 */
function getRootPath(filePath: string): string {
  if (process.platform === 'win32') {
    // On Windows, get the drive letter (e.g., "C:\")
    const match = filePath.match(/^([A-Z]:\\)/i);
    if (match) {
      return match[1].toUpperCase();
    }
    // UNC path (network drive)
    const uncMatch = filePath.match(/^(\\\\[^\\]+\\[^\\]+)/i);
    if (uncMatch) {
      return uncMatch[1].toUpperCase();
    }
    return path.parse(filePath).root;
  } else {
    // On Unix-like systems, get the mount point
    // For simplicity, we'll use the first path component
    const parts = filePath.split(path.sep).filter(p => p);
    if (parts.length > 0) {
      return path.sep + parts[0];
    }
    return path.sep;
  }
}

/**
 * Check if a drive is removable on Windows
 * Uses WMI to check drive type
 */
async function isRemovableDriveWindows(driveLetter: string): Promise<boolean> {
  try {
    // Extract drive letter (e.g., "C" from "C:\")
    const drive = driveLetter.replace(/[:/\\]/g, '').toUpperCase();
    
    // Use PowerShell to check drive type
    // DriveType 2 = Removable (USB, floppy, etc.)
    // DriveType 3 = Fixed (hard disk)
    // DriveType 4 = Network
    const command = `powershell -Command "Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DeviceID -eq '${drive}:' } | Select-Object -ExpandProperty DriveType"`;
    
    try {
      const { stdout } = await execAsync(command, { timeout: 5000 });
      const driveType = parseInt(stdout.trim(), 10);
      
      // DriveType 2 = Removable, DriveType 4 = Network (both considered external)
      const isRemovable = driveType === 2 || driveType === 4;
      
      logger.info('Windows drive type check', {
        drive,
        driveType,
        isRemovable,
      });
      
      return isRemovable;
    } catch (execError) {
      // If PowerShell command fails, fall back to checking if it's different from system drive
      logger.warn('Could not check Windows drive type via WMI, using fallback method', execError);
      
      // Get system drive (usually C:)
      const systemDrive = process.env.SystemDrive || 'C:';
      return drive !== systemDrive.toUpperCase();
    }
  } catch (error) {
    logger.error('Error checking removable drive on Windows', error);
    // Fallback: if it's not the system drive, consider it external
    const systemDrive = process.env.SystemDrive || 'C:';
    const drive = driveLetter.replace(/[:/\\]/g, '').toUpperCase();
    return drive !== systemDrive.toUpperCase();
  }
}

/**
 * Validate that a backup destination is on an external drive
 * Throws an error if the destination is not external
 */
export async function validateExternalDrive(destinationPath: string): Promise<void> {
  const isExternal = await isExternalDrive(destinationPath);
  
  if (!isExternal) {
    const errorMessage = 
      'Backup must be saved to an external drive (USB drive or external hard disk). ' +
      'The selected location is on the same drive as the application data. ' +
      'Please select a folder on a USB drive or external hard disk.';
    
    logger.warn('Backup destination validation failed', {
      destinationPath,
      reason: 'Not an external drive',
    });
    
    throw new Error(errorMessage);
  }
  
  // Also check if the path is writable
  try {
    await fs.ensureDir(destinationPath);
    const testFile = path.join(destinationPath, '.writable-test');
    await fs.writeFile(testFile, 'test');
    await fs.remove(testFile);
  } catch (error) {
    const errorMessage = 
      'Cannot write to the selected location. ' +
      'Please ensure the external drive is connected and you have write permissions.';
    
    logger.error('Backup destination is not writable', {
      destinationPath,
      error,
    });
    
    throw new Error(errorMessage);
  }
}

