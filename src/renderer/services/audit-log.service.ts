export interface AuditLog {
  id: number;
  userId: number;
  username: string;
  action: string;
  entity: string;
  entityId: number | null;
  details: string | null;
  timestamp: Date;
}

export interface AuditLogListOptions {
  page?: number;
  pageSize?: number;
  userId?: number;
  entity?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AuditLogListResponse {
  success: boolean;
  logs?: AuditLog[];
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

/**
 * Raw audit log from IPC (timestamp is a string)
 */
interface RawAuditLog {
  id: number;
  userId: number;
  username: string;
  action: string;
  entity: string;
  entityId: number | null;
  details: string | null;
  timestamp: string;
}

/**
 * Audit Log Service (Renderer)
 * Handles audit log API calls via IPC
 */
export class AuditLogService {
  /**
   * Get audit logs with filtering
   */
  static async getLogs(
    options: AuditLogListOptions
  ): Promise<AuditLogListResponse> {
    try {
      const result = await window.electron.ipcRenderer.invoke('audit-log:getLogs', options) as {
        success: boolean;
        logs?: RawAuditLog[];
        total?: number;
        page?: number;
        pageSize?: number;
        error?: string;
      };
      if (result.success && result.logs) {
        return {
          success: true,
          logs: result.logs.map((log: RawAuditLog) => ({
            ...log,
            timestamp: new Date(log.timestamp),
          })),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        };
      }
      return {
        success: false,
        error: result.error || 'Failed to get audit logs',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

