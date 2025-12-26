export interface BackupInfo {
  id: string;
  filename: string;
  filePath: string;
  size: number;
  createdAt: Date;
  checksum: string;
}

export interface CreateBackupOptions {
  description?: string;
  destinationPath: string; // REQUIRED: Destination path on external drive (backups must be on external drive)
  // Note: All backups are now always compressed
}

export interface ExternalDriveInfo {
  driveLetter: string; // e.g., "D:"
  path: string; // e.g., "D:\"
  label: string; // Drive label/name
  type: 'removable' | 'network' | 'external';
  freeSpace: number; // Free space in bytes
  totalSize: number; // Total size in bytes
  isWritable: boolean;
}

export interface BackupListOptions {
  page?: number;
  pageSize?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface BackupStats {
  totalBackups: number;
  totalSize: number;
  oldestBackup: Date | null;
  newestBackup: Date | null;
}

/**
 * Backup Service (Renderer)
 * Handles backup API calls via IPC
 */
export class BackupService {
  /**
   * Create a backup
   */
  static async createBackup(
    options: CreateBackupOptions,
    requestedById: number
  ): Promise<{ success: boolean; backup?: BackupInfo; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup:createBackup',
        options,
        requestedById
      ) as { success: boolean; backup?: BackupInfo; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Create backup to external drive (custom destination)
   * NOTE: This is now the same as createBackup since all backups require external drive
   */
  static async createBackupToExternal(
    destinationPath: string,
    options: Omit<CreateBackupOptions, 'destinationPath'>,
    requestedById: number
  ): Promise<{ success: boolean; backup?: BackupInfo; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup:createBackupToExternal',
        destinationPath,
        options,
        requestedById
      ) as { success: boolean; backup?: BackupInfo; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get available external drives
   */
  static async getAvailableExternalDrives(): Promise<{
    success: boolean;
    drives?: ExternalDriveInfo[];
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup:getAvailableExternalDrives'
      ) as { success: boolean; drives?: ExternalDriveInfo[]; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        drives: [],
      };
    }
  }

  /**
   * Check if external drive is available
   */
  static async hasExternalDriveAvailable(): Promise<{
    success: boolean;
    hasDrive?: boolean;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup:hasExternalDriveAvailable'
      ) as { success: boolean; hasDrive?: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        hasDrive: false,
      };
    }
  }

  /**
   * Get list of backups
   */
  static async getBackups(
    options: BackupListOptions,
    requestedById: number
  ): Promise<{
    success: boolean;
    backups?: BackupInfo[];
    total?: number;
    page?: number;
    pageSize?: number;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup:getBackups',
        options,
        requestedById
      ) as {
        success: boolean;
        backups?: BackupInfo[];
        total?: number;
        page?: number;
        pageSize?: number;
        error?: string;
      };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get backup by ID
   */
  static async getBackupById(
    id: string,
    requestedById: number
  ): Promise<{ success: boolean; backup?: BackupInfo | null; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup:getBackupById',
        id,
        requestedById
      ) as { success: boolean; backup?: BackupInfo | null; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Verify backup
   */
  static async verifyBackup(
    backupPath: string,
    requestedById: number
  ): Promise<{
    success: boolean;
    valid?: boolean;
    checksum?: string;
    size?: number;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup:verifyBackup',
        backupPath,
        requestedById
      ) as {
        success: boolean;
        valid?: boolean;
        checksum?: string;
        size?: number;
        error?: string;
      };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Restore backup
   */
  static async restoreBackup(
    backupPath: string,
    requestedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup:restoreBackup',
        backupPath,
        requestedById
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete backup
   */
  static async deleteBackup(
    backupPath: string,
    requestedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup:deleteBackup',
        backupPath,
        requestedById
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete old backups
   */
  static async deleteOldBackups(
    daysToKeep: number,
    requestedById: number
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup:deleteOldBackups',
        daysToKeep,
        requestedById
      ) as { success: boolean; count?: number; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get backup statistics
   */
  static async getBackupStats(
    requestedById: number
  ): Promise<{ success: boolean; stats?: BackupStats; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup:getBackupStats',
        requestedById
      ) as {
        success: boolean;
        totalBackups?: number;
        totalSize?: number;
        oldestBackup?: Date | string | null;
        newestBackup?: Date | string | null;
        error?: string;
      };
      return {
        success: result.success,
        stats: result.success
          ? {
              totalBackups: result.totalBackups!,
              totalSize: result.totalSize!,
              oldestBackup: result.oldestBackup ? new Date(result.oldestBackup) : null,
              newestBackup: result.newestBackup ? new Date(result.newestBackup) : null,
            }
          : undefined,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

