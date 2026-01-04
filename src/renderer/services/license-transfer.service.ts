/**
 * License transfer status
 */
export type LicenseTransferStatus = 'pending' | 'approved' | 'completed' | 'cancelled' | 'failed';

/**
 * Initiate license transfer input
 */
export interface InitiateLicenseTransferInput {
  licenseKey: string;
  notes?: string;
}

/**
 * Initiate license transfer result
 */
export interface InitiateLicenseTransferResult {
  success: boolean;
  message: string;
  transferId?: number;
  transferToken?: string;
}

/**
 * Complete license transfer input
 */
export interface CompleteLicenseTransferInput {
  transferToken: string;
  licenseKey: string;
}

/**
 * Complete license transfer result
 */
export interface CompleteLicenseTransferResult {
  success: boolean;
  message: string;
  expiresAt?: string;
  gracePeriodEnd?: string;
  token?: string;
  locationId?: number;
  locationName?: string;
  locationAddress?: string;
}

/**
 * License transfer record
 */
export interface LicenseTransferRecord {
  id: number;
  licenseKey: string;
  sourceHardwareId: string;
  sourceMachineName: string | null;
  targetHardwareId: string | null;
  targetMachineName: string | null;
  status: LicenseTransferStatus;
  transferToken: string | null;
  initiatedBy: number | null;
  completedBy: number | null;
  initiatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  errorMessage: string | null;
  notes: string | null;
}

/**
 * License transfer list options
 */
export interface LicenseTransferListOptions {
  page?: number;
  pageSize?: number;
  status?: LicenseTransferStatus;
  licenseKey?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * License transfer list response
 */
export interface LicenseTransferListResponse {
  transfers: LicenseTransferRecord[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Frontend service for license transfer operations
 */
export class LicenseTransferService {
  /**
   * Initiate a license transfer from the current device
   */
  static async initiateTransfer(
    input: InitiateLicenseTransferInput,
    userId: number
  ): Promise<InitiateLicenseTransferResult> {
    return await window.electron.ipcRenderer.invoke('license:initiateTransfer', input, userId) as InitiateLicenseTransferResult;
  }

  /**
   * Complete a license transfer on the target device
   */
  static async completeTransfer(
    input: CompleteLicenseTransferInput,
    userId: number
  ): Promise<CompleteLicenseTransferResult> {
    return await window.electron.ipcRenderer.invoke('license:completeTransfer', input, userId) as CompleteLicenseTransferResult;
  }

  /**
   * Cancel a pending license transfer
   */
  static async cancelTransfer(
    transferId: number,
    userId: number,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    return await window.electron.ipcRenderer.invoke('license:cancelTransfer', transferId, userId, reason) as { success: boolean; message: string };
  }

  /**
   * Get license transfer history
   */
  static async getTransferHistory(
    options: LicenseTransferListOptions = {}
  ): Promise<LicenseTransferListResponse> {
    return await window.electron.ipcRenderer.invoke('license:getTransferHistory', options) as LicenseTransferListResponse;
  }

  /**
   * Get a single license transfer by ID
   */
  static async getTransferById(transferId: number): Promise<LicenseTransferRecord | null> {
    return await window.electron.ipcRenderer.invoke('license:getTransferById', transferId) as LicenseTransferRecord | null;
  }
}

