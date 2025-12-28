export interface RecoveryPoint {
  id: number;
  name: string | null;
  description: string | null;
  timestamp: Date;
  backupPath: string | null;
  checksum: string | null;
  createdBy: number | null;
  isAutomatic: boolean;
  transactionLogId: number | null;
}

export interface CreateRecoveryPointInput {
  name?: string;
  description?: string;
  timestamp?: Date;
  createBackup?: boolean;
  userId?: number;
  isAutomatic?: boolean;
}

export interface RestoreToPointInTimeInput {
  recoveryPointId: number;
  createBackupBeforeRestore?: boolean;
  userId?: number;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  backupPath?: string;
  restoredTimestamp?: Date;
  recordsRestored?: number;
}

/**
 * Raw recovery point from IPC (timestamp is a string)
 */
interface RawRecoveryPoint {
  id: number;
  name: string | null;
  description: string | null;
  timestamp: string;
  backupPath: string | null;
  checksum: string | null;
  createdBy: number | null;
  isAutomatic: boolean;
  transactionLogId: number | null;
}

/**
 * Recovery Service (Renderer)
 * Handles recovery operations via IPC
 */
export class RecoveryService {
  /**
   * Create a recovery point
   */
  static async createRecoveryPoint(input: CreateRecoveryPointInput): Promise<{
    success: boolean;
    recoveryPoint?: RecoveryPoint;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('recovery:createRecoveryPoint', {
        ...input,
        timestamp: input.timestamp?.toISOString(),
      }) as {
        success: boolean;
        recoveryPoint?: RawRecoveryPoint;
        error?: string;
      };

      if (result.success && result.recoveryPoint) {
        return {
          success: true,
          recoveryPoint: {
            ...result.recoveryPoint,
            timestamp: new Date(result.recoveryPoint.timestamp),
          },
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to create recovery point',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get recovery points
   */
  static async getRecoveryPoints(options: {
    page?: number;
    pageSize?: number;
    startDate?: Date;
    endDate?: Date;
    isAutomatic?: boolean;
  }): Promise<{
    success: boolean;
    recoveryPoints?: RecoveryPoint[];
    total?: number;
    page?: number;
    pageSize?: number;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('recovery:getRecoveryPoints', {
        ...options,
        startDate: options.startDate?.toISOString(),
        endDate: options.endDate?.toISOString(),
      }) as {
        success: boolean;
        recoveryPoints?: RawRecoveryPoint[];
        total?: number;
        page?: number;
        pageSize?: number;
        error?: string;
      };

      if (result.success && result.recoveryPoints) {
        return {
          success: true,
          recoveryPoints: result.recoveryPoints.map((rp) => ({
            ...rp,
            timestamp: new Date(rp.timestamp),
          })),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        };
      }

      return {
        success: false,
        recoveryPoints: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 20,
        error: result.error || 'Failed to get recovery points',
      };
    } catch (error) {
      return {
        success: false,
        recoveryPoints: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 20,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete recovery point
   */
  static async deleteRecoveryPoint(id: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('recovery:deleteRecoveryPoint', id) as {
        success: boolean;
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
   * Verify backup integrity
   */
  static async verifyBackupIntegrity(recoveryPointId: number): Promise<{
    valid: boolean;
    message: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('recovery:verifyBackupIntegrity', recoveryPointId) as {
        valid: boolean;
        message: string;
      };
      return result;
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Failed to verify backup integrity',
      };
    }
  }

  /**
   * Restore to point in time
   */
  static async restoreToPointInTime(input: RestoreToPointInTimeInput): Promise<RestoreResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('recovery:restoreToPointInTime', input) as RestoreResult;
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to restore to point in time',
      };
    }
  }
}

