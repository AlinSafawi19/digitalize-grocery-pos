export interface LicenseValidationAuditLog {
  id: number;
  licenseKey: string;
  validationType: 'online' | 'offline' | 'cached';
  validationResult: 'valid' | 'invalid' | 'expired' | 'tampered' | 'error';
  tamperDetected: boolean;
  errorMessage: string | null;
  timestamp: Date;
}

export interface LicenseValidationAuditLogListOptions {
  page?: number;
  pageSize?: number;
  validationType?: 'online' | 'offline' | 'cached';
  validationResult?: 'valid' | 'invalid' | 'expired' | 'tampered' | 'error';
  tamperDetected?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface LicenseValidationAuditLogListResponse {
  logs: LicenseValidationAuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Raw validation audit log from IPC (timestamp is a string)
 */
interface RawLicenseValidationAuditLog {
  id: number;
  licenseKey: string;
  validationType: string;
  validationResult: string;
  tamperDetected: boolean;
  errorMessage: string | null;
  timestamp: string;
}

/**
 * License Validation Audit Service (Renderer)
 * Handles license validation audit log API calls via IPC
 */
export class LicenseValidationAuditService {
  /**
   * Get validation audit logs with filtering
   */
  static async getLogs(
    options: LicenseValidationAuditLogListOptions
  ): Promise<LicenseValidationAuditLogListResponse> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'license:getValidationAuditLogs',
        {
          ...options,
          startDate: options.startDate?.toISOString(),
          endDate: options.endDate?.toISOString(),
        }
      ) as {
        logs?: RawLicenseValidationAuditLog[];
        total?: number;
        page?: number;
        pageSize?: number;
      };

      if (result.logs) {
        return {
          logs: result.logs.map((log: RawLicenseValidationAuditLog) => ({
            ...log,
            validationType: log.validationType as 'online' | 'offline' | 'cached',
            validationResult: log.validationResult as 'valid' | 'invalid' | 'expired' | 'tampered' | 'error',
            timestamp: new Date(log.timestamp),
          })),
          total: result.total || 0,
          page: result.page || 1,
          pageSize: result.pageSize || 20,
        };
      }

      return {
        logs: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 20,
      };
    } catch (error) {
      console.error('Error getting validation audit logs:', error);
      return {
        logs: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 20,
      };
    }
  }
}

