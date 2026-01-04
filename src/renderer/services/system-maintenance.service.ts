export interface MaintenanceOperation {
  type: string;
  name: string;
  description: string;
  estimatedDuration?: string;
}

export interface SystemMaintenance {
  id: number;
  operationType: string;
  status: string;
  startedAt: Date;
  completedAt?: Date | null;
  duration?: number | null;
  result?: string | null;
  error?: string | null;
  performedBy: number;
  createdAt: Date;
  updatedAt: Date;
  performer?: {
    id: number;
    username: string;
  };
}

export interface MaintenanceResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  duration?: number;
  error?: string;
}

export interface DatabaseStats {
  size: number;
  sizeFormatted: string;
  tableCount: number;
  totalRecords: number;
  lastVacuum?: Date;
  lastAnalyze?: Date;
}

export interface MaintenanceHistoryOptions {
  page?: number;
  pageSize?: number;
  operationType?: string;
}

/**
 * System Maintenance Service (Renderer)
 * Handles system maintenance API calls via IPC
 */
export class SystemMaintenanceService {
  /**
   * Get available maintenance operations
   */
  static async getAvailableOperations(): Promise<{ success: boolean; operations?: MaintenanceOperation[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('systemMaintenance:getAvailableOperations');
      return result as { success: boolean; operations?: MaintenanceOperation[]; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get maintenance history
   */
  static async getHistory(options: MaintenanceHistoryOptions): Promise<{
    success: boolean;
    operations?: SystemMaintenance[];
    pagination?: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('systemMaintenance:getHistory', options);
      return result as {
        success: boolean;
        operations?: SystemMaintenance[];
        pagination?: {
          page: number;
          pageSize: number;
          totalItems: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
        error?: string;
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get database statistics
   */
  static async getDatabaseStats(): Promise<{ success: boolean; stats?: DatabaseStats; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('systemMaintenance:getDatabaseStats');
      return result as { success: boolean; stats?: DatabaseStats; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Optimize database
   */
  static async optimizeDatabase(userId: number): Promise<MaintenanceResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('systemMaintenance:optimizeDatabase', userId);
      return result as MaintenanceResult;
    } catch (error) {
      return {
        success: false,
        message: 'Database optimization failed',
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Vacuum database
   */
  static async vacuumDatabase(userId: number): Promise<MaintenanceResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('systemMaintenance:vacuumDatabase', userId);
      return result as MaintenanceResult;
    } catch (error) {
      return {
        success: false,
        message: 'Database vacuum failed',
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Analyze database
   */
  static async analyzeDatabase(userId: number): Promise<MaintenanceResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('systemMaintenance:analyzeDatabase', userId);
      return result as MaintenanceResult;
    } catch (error) {
      return {
        success: false,
        message: 'Database analysis failed',
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Cleanup old audit logs
   */
  static async cleanupOldAuditLogs(userId: number, daysToKeep?: number): Promise<MaintenanceResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('systemMaintenance:cleanupOldAuditLogs', userId, daysToKeep);
      return result as MaintenanceResult;
    } catch (error) {
      return {
        success: false,
        message: 'Cleanup of old audit logs failed',
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Cleanup expired sessions
   */
  static async cleanupExpiredSessions(userId: number): Promise<MaintenanceResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('systemMaintenance:cleanupExpiredSessions', userId);
      return result as MaintenanceResult;
    } catch (error) {
      return {
        success: false,
        message: 'Cleanup of expired sessions failed',
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

