/**
 * Backup Location Service (Frontend)
 * Handles backup location operations via IPC
 */

export type BackupLocationType = 'external_drive' | 'local' | 'network' | 'cloud';

export interface BackupLocationConfig {
  [key: string]: unknown;
}

export interface CreateBackupLocationInput {
  name: string;
  type: BackupLocationType;
  path: string;
  config?: BackupLocationConfig;
  isActive?: boolean;
  priority?: number;
  maxBackups?: number;
  createdBy: number;
}

export interface UpdateBackupLocationInput {
  name?: string;
  type?: BackupLocationType;
  path?: string;
  config?: BackupLocationConfig;
  isActive?: boolean;
  priority?: number;
  maxBackups?: number;
}

export interface BackupLocation {
  id: number;
  name: string;
  type: BackupLocationType;
  path: string;
  config: string | null;
  isActive: boolean;
  priority: number;
  maxBackups: number | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number;
  creator?: {
    id: number;
    username: string;
  } | null;
}

export interface LocationValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
}

export class BackupLocationService {
  /**
   * Validate location
   */
  static async validateLocation(
    type: BackupLocationType,
    path: string,
    config?: BackupLocationConfig
  ): Promise<{
    success: boolean;
    data?: LocationValidationResult;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backupLocation:validate',
        type,
        path,
        config
      ) as {
        success: boolean;
        data?: LocationValidationResult;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error validating backup location', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate location',
      };
    }
  }

  /**
   * Create location
   */
  static async createLocation(input: CreateBackupLocationInput): Promise<{
    success: boolean;
    data?: BackupLocation;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backupLocation:create',
        input
      ) as {
        success: boolean;
        data?: BackupLocation;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error creating backup location', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create location',
      };
    }
  }

  /**
   * Get location by ID
   */
  static async getLocationById(id: number): Promise<{
    success: boolean;
    data?: BackupLocation;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backupLocation:getById',
        id
      ) as {
        success: boolean;
        data?: BackupLocation;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting backup location', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get location',
      };
    }
  }

  /**
   * Get locations
   */
  static async getLocations(options?: {
    isActive?: boolean;
    type?: BackupLocationType;
    page?: number;
    pageSize?: number;
  }): Promise<{
    success: boolean;
    data?: BackupLocation[];
    pagination?: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backupLocation:getList',
        options
      ) as {
        success: boolean;
        data?: BackupLocation[];
        pagination?: {
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
        };
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting backup locations', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get locations',
      };
    }
  }

  /**
   * Update location
   */
  static async updateLocation(
    id: number,
    input: UpdateBackupLocationInput
  ): Promise<{
    success: boolean;
    data?: BackupLocation;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backupLocation:update',
        id,
        input
      ) as {
        success: boolean;
        data?: BackupLocation;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error updating backup location', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update location',
      };
    }
  }

  /**
   * Delete location
   */
  static async deleteLocation(id: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backupLocation:delete',
        id
      ) as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error deleting backup location', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete location',
      };
    }
  }

  /**
   * Get schedule locations
   */
  static async getScheduleLocations(scheduleId: number): Promise<{
    success: boolean;
    data?: BackupLocation[];
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backupLocation:getScheduleLocations',
        scheduleId
      ) as {
        success: boolean;
        data?: BackupLocation[];
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting schedule locations', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get schedule locations',
      };
    }
  }

  /**
   * Parse config from JSON string
   */
  static parseConfig(config: string | null): BackupLocationConfig | undefined {
    if (!config) return undefined;
    try {
      return JSON.parse(config) as BackupLocationConfig;
    } catch {
      return undefined;
    }
  }

  /**
   * Get location type display name
   */
  static getLocationTypeDisplayName(type: BackupLocationType): string {
    const names: Record<BackupLocationType, string> = {
      external_drive: 'External Drive',
      local: 'Local Path',
      network: 'Network Share',
      cloud: 'Cloud Storage',
    };
    return names[type] || type;
  }
}

