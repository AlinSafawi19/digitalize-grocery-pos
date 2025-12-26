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

/**
 * External drive information
 */
export interface ExternalDriveInfo {
  driveLetter: string; // e.g., "D:"
  path: string; // e.g., "D:\"
  label: string; // Drive label/name
  type: 'removable' | 'network' | 'external';
  freeSpace: number; // Free space in bytes
  totalSize: number; // Total size in bytes
  isWritable: boolean;
}

/**
 * Get list of available external drives
 * Returns all removable drives (USB, external HDD) and network drives
 */
export async function getAvailableExternalDrives(): Promise<ExternalDriveInfo[]> {
  const drives: ExternalDriveInfo[] = [];
  
  try {
    if (process.platform === 'win32') {
      // Use PowerShell to get all removable and network drives
      const command = `powershell -Command "Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 -or $_.DriveType -eq 4 } | Select-Object DeviceID, VolumeName, DriveType, FreeSpace, Size | ConvertTo-Json"`;
      
      try {
        const { stdout } = await execAsync(command, { timeout: 10000 });
        const driveData = JSON.parse(stdout.trim());
        
        // Handle both single object and array
        const drivesArray = Array.isArray(driveData) ? driveData : [driveData];
        
        for (const drive of drivesArray) {
          if (!drive || !drive.DeviceID) continue;
          
          const driveLetter = drive.DeviceID; // e.g., "D:"
          const drivePath = drive.DeviceID + '\\';
          const label = drive.VolumeName || 'No Label';
          const driveType = drive.DriveType === 2 ? 'removable' : 'network';
          const freeSpace = parseInt(drive.FreeSpace || '0', 10);
          const totalSize = parseInt(drive.Size || '0', 10);
          
          // Check if drive is writable
          let isWritable = false;
          try {
            const testFile = path.join(drivePath, '.writable-test');
            await fs.writeFile(testFile, 'test');
            await fs.remove(testFile);
            isWritable = true;
          } catch {
            isWritable = false;
          }
          
          // Only include if it's actually external (not the app data drive)
          const appDataRoot = getRootPath(USER_DATA_PATH);
          if (driveLetter.toUpperCase() !== appDataRoot.toUpperCase()) {
            drives.push({
              driveLetter,
              path: drivePath,
              label,
              type: driveType,
              freeSpace,
              totalSize,
              isWritable,
            });
          }
        }
      } catch (execError) {
        logger.warn('Could not get external drives via PowerShell, using fallback method', execError);
        // Fallback: try to detect drives by checking common drive letters
        await getExternalDrivesFallback(drives);
      }
    } else {
      // For Linux/Mac, check mount points
      // This is a simplified implementation
      logger.warn('External drive detection for non-Windows platforms is not fully implemented');
    }
    
    logger.info('External drives detected', {
      count: drives.length,
      drives: drives.map(d => ({ letter: d.driveLetter, label: d.label, writable: d.isWritable })),
    });
    
    return drives;
  } catch (error) {
    logger.error('Error getting available external drives', error);
    return [];
  }
}

/**
 * Fallback method to detect external drives on Windows
 * Checks common drive letters (D-Z) for removable drives
 */
async function getExternalDrivesFallback(drives: ExternalDriveInfo[]): Promise<void> {
  const systemDrive = process.env.SystemDrive || 'C:';
  const systemDriveLetter = systemDrive.replace(':', '').toUpperCase();
  
  // Check drive letters from D to Z
  for (let i = 68; i <= 90; i++) { // D=68, Z=90
    const driveLetter = String.fromCharCode(i) + ':';
    const drivePath = driveLetter + '\\';
    
    // Skip system drive
    if (driveLetter.toUpperCase() === systemDrive.toUpperCase()) {
      continue;
    }
    
    try {
      // Check if drive exists and is accessible
      const stats = await fs.stat(drivePath);
      if (stats.isDirectory()) {
        // Try to determine if it's removable
        const isRemovable = await isRemovableDriveWindows(drivePath);
        
        if (isRemovable) {
          // Get drive info
          let label = 'No Label';
          let freeSpace = 0;
          let totalSize = 0;
          
          try {
            const command = `powershell -Command "Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DeviceID -eq '${driveLetter}' } | Select-Object VolumeName, FreeSpace, Size | ConvertTo-Json"`;
            const { stdout } = await execAsync(command, { timeout: 5000 });
            const driveData = JSON.parse(stdout.trim());
            if (driveData) {
              label = driveData.VolumeName || 'No Label';
              freeSpace = parseInt(driveData.FreeSpace || '0', 10);
              totalSize = parseInt(driveData.Size || '0', 10);
            }
          } catch {
            // Use defaults
          }
          
          // Check if writable
          let isWritable = false;
          try {
            const testFile = path.join(drivePath, '.writable-test');
            await fs.writeFile(testFile, 'test');
            await fs.remove(testFile);
            isWritable = true;
          } catch {
            isWritable = false;
          }
          
          drives.push({
            driveLetter,
            path: drivePath,
            label,
            type: 'removable',
            freeSpace,
            totalSize,
            isWritable,
          });
        }
      }
    } catch {
      // Drive doesn't exist or is not accessible, skip
      continue;
    }
  }
}

/**
 * Check if any external drive is available
 */
export async function hasExternalDriveAvailable(): Promise<boolean> {
  const drives = await getAvailableExternalDrives();
  return drives.length > 0 && drives.some(d => d.isWritable);
}

