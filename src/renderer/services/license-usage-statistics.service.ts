/**
 * License usage statistics summary
 */
export interface LicenseUsageStatistics {
  // License Information
  licenseKey: string;
  locationName: string | null;
  locationAddress: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  isExpired: boolean;
  
  // Device Information
  currentDevice: {
    hardwareId: string;
    machineName: string;
  } | null;
  
  // Activation History
  activationHistory: {
    totalActivations: number;
    firstActivation: string | null;
    lastActivation: string | null;
    activationCount: number;
  };
  
  // Validation Statistics
  validationStatistics: {
    totalValidations: number;
    successfulValidations: number;
    failedValidations: number;
    tamperDetectedCount: number;
    lastValidation: string | null;
    validationTypes: {
      online: number;
      offline: number;
      cached: number;
    };
    validationResults: {
      valid: number;
      invalid: number;
      expired: number;
      tampered: number;
      error: number;
    };
  };
  
  // Transfer Statistics
  transferStatistics: {
    totalTransfers: number;
    completedTransfers: number;
    pendingTransfers: number;
    cancelledTransfers: number;
    failedTransfers: number;
    lastTransfer: string | null;
  };
  
  // Usage Timeline
  usageTimeline: Array<{
    date: string;
    validations: number;
    transfers: number;
  }>;
}

/**
 * Device activation record
 */
export interface DeviceActivationRecord {
  hardwareId: string;
  machineName: string | null;
  activatedAt: string;
  lastValidation: string | null;
  validationCount: number;
}

/**
 * Frontend service for license usage statistics
 */
export class LicenseUsageStatisticsService {
  /**
   * Get comprehensive license usage statistics
   */
  static async getUsageStatistics(): Promise<LicenseUsageStatistics | null> {
    return await window.electron.ipcRenderer.invoke('license:getUsageStatistics') as LicenseUsageStatistics | null;
  }

  /**
   * Get device activation records
   */
  static async getDeviceActivationRecords(): Promise<DeviceActivationRecord[]> {
    return await window.electron.ipcRenderer.invoke('license:getDeviceActivationRecords') as DeviceActivationRecord[];
  }
}

