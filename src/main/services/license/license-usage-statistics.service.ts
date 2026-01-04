import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { licenseService } from './license.service';
import { LicenseData } from './licenseStorage';
import { getHardwareId, getMachineName } from './hardwareFingerprint';

/**
 * License usage statistics summary
 */
export interface LicenseUsageStatistics {
  // License Information
  licenseKey: string;
  locationName: string | null;
  locationAddress: string | null;
  activatedAt: Date | null;
  expiresAt: Date | null;
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
    firstActivation: Date | null;
    lastActivation: Date | null;
    activationCount: number;
  };
  
  // Validation Statistics
  validationStatistics: {
    totalValidations: number;
    successfulValidations: number;
    failedValidations: number;
    tamperDetectedCount: number;
    lastValidation: Date | null;
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
    lastTransfer: Date | null;
  };
  
  // Usage Timeline
  usageTimeline: Array<{
    date: Date;
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
  activatedAt: Date;
  lastValidation: Date | null;
  validationCount: number;
}

export class LicenseUsageStatisticsService {
  /**
   * Get comprehensive license usage statistics
   */
  async getUsageStatistics(): Promise<LicenseUsageStatistics | null> {
    try {
      // Get current license data
      const licenseData = await licenseService.getLicenseStatus();
      if (!licenseData) {
        return null;
      }

      const licenseKey = licenseData.licenseKey;
      const currentHardwareId = getHardwareId();
      const currentMachineName = getMachineName();

      // Calculate days remaining
      let daysRemaining: number | null = null;
      let isExpired = false;
      if (licenseData.expiresAt) {
        const now = Date.now();
        const expiresAt = licenseData.expiresAt;
        const diff = expiresAt - now;
        daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
        isExpired = diff < 0;
      }

      // Get validation statistics
      const validationStats = await this.getValidationStatistics(licenseKey);
      
      // Get transfer statistics
      const transferStats = await this.getTransferStatistics(licenseKey);
      
      // Get activation history
      const activationHistory = await this.getActivationHistory(licenseKey, licenseData);
      
      // Get usage timeline (last 30 days)
      const usageTimeline = await this.getUsageTimeline(licenseKey, 30);

      return {
        licenseKey,
        locationName: licenseData.locationName || null,
        locationAddress: licenseData.locationAddress || null,
        activatedAt: licenseData.activatedAt ? new Date(licenseData.activatedAt) : null,
        expiresAt: licenseData.expiresAt ? new Date(licenseData.expiresAt) : null,
        daysRemaining,
        isExpired,
        currentDevice: {
          hardwareId: currentHardwareId,
          machineName: currentMachineName,
        },
        activationHistory,
        validationStatistics: validationStats,
        transferStatistics: transferStats,
        usageTimeline,
      };
    } catch (error: unknown) {
      logger.error('Error getting license usage statistics', error);
      return null;
    }
  }

  /**
   * Get validation statistics
   */
  private async getValidationStatistics(licenseKey: string): Promise<LicenseUsageStatistics['validationStatistics']> {
    try {
      const prisma = databaseService.getClient();
      
      // Get all validation audit logs for this license
      const allLogs = await prisma.licenseValidationAudit.findMany({
        where: {
          licenseKey: licenseKey,
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      const totalValidations = allLogs.length;
      const successfulValidations = allLogs.filter(log => log.validationResult === 'valid').length;
      const failedValidations = totalValidations - successfulValidations;
      const tamperDetectedCount = allLogs.filter(log => log.tamperDetected).length;
      const lastValidation = allLogs.length > 0 ? allLogs[0].timestamp : null;

      // Count by validation type
      const validationTypes = {
        online: allLogs.filter(log => log.validationType === 'online').length,
        offline: allLogs.filter(log => log.validationType === 'offline').length,
        cached: allLogs.filter(log => log.validationType === 'cached').length,
      };

      // Count by validation result
      const validationResults = {
        valid: allLogs.filter(log => log.validationResult === 'valid').length,
        invalid: allLogs.filter(log => log.validationResult === 'invalid').length,
        expired: allLogs.filter(log => log.validationResult === 'expired').length,
        tampered: allLogs.filter(log => log.validationResult === 'tampered').length,
        error: allLogs.filter(log => log.validationResult === 'error').length,
      };

      return {
        totalValidations,
        successfulValidations,
        failedValidations,
        tamperDetectedCount,
        lastValidation,
        validationTypes,
        validationResults,
      };
    } catch (error: unknown) {
      logger.error('Error getting validation statistics', error);
      return {
        totalValidations: 0,
        successfulValidations: 0,
        failedValidations: 0,
        tamperDetectedCount: 0,
        lastValidation: null,
        validationTypes: { online: 0, offline: 0, cached: 0 },
        validationResults: { valid: 0, invalid: 0, expired: 0, tampered: 0, error: 0 },
      };
    }
  }

  /**
   * Get transfer statistics
   */
  private async getTransferStatistics(licenseKey: string): Promise<LicenseUsageStatistics['transferStatistics']> {
    try {
      const prisma = databaseService.getClient();
      
      // Get all transfers for this license
      const allTransfers = await prisma.licenseTransfer.findMany({
        where: {
          licenseKey: licenseKey,
        },
        orderBy: {
          initiatedAt: 'desc',
        },
      });

      const totalTransfers = allTransfers.length;
      const completedTransfers = allTransfers.filter(t => t.status === 'completed').length;
      const pendingTransfers = allTransfers.filter(t => t.status === 'pending' || t.status === 'approved').length;
      const cancelledTransfers = allTransfers.filter(t => t.status === 'cancelled').length;
      const failedTransfers = allTransfers.filter(t => t.status === 'failed').length;
      const lastTransfer = allTransfers.length > 0 ? allTransfers[0].initiatedAt : null;

      return {
        totalTransfers,
        completedTransfers,
        pendingTransfers,
        cancelledTransfers,
        failedTransfers,
        lastTransfer,
      };
    } catch (error: unknown) {
      logger.error('Error getting transfer statistics', error);
      return {
        totalTransfers: 0,
        completedTransfers: 0,
        pendingTransfers: 0,
        cancelledTransfers: 0,
        failedTransfers: 0,
        lastTransfer: null,
      };
    }
  }

  /**
   * Get activation history
   */
  private async getActivationHistory(
    licenseKey: string,
    licenseData: LicenseData
  ): Promise<LicenseUsageStatistics['activationHistory']> {
    try {
      const prisma = databaseService.getClient();
      
      // Get transfers to count activations (each completed transfer is a new activation)
      const transfers = await prisma.licenseTransfer.findMany({
        where: {
          licenseKey: licenseKey,
          status: 'completed',
        },
        orderBy: {
          completedAt: 'asc',
        },
      });

      // Current activation is the first one (or the license data activation date)
      const firstActivation = licenseData.activatedAt ? new Date(licenseData.activatedAt) : null;
      const lastActivation = transfers.length > 0 && transfers[transfers.length - 1].completedAt
        ? transfers[transfers.length - 1].completedAt
        : firstActivation;

      // Total activations = 1 (initial) + completed transfers
      const activationCount = 1 + transfers.length;

      return {
        totalActivations: activationCount,
        firstActivation,
        lastActivation,
        activationCount,
      };
    } catch (error: unknown) {
      logger.error('Error getting activation history', error);
      return {
        totalActivations: 1,
        firstActivation: licenseData.activatedAt ? new Date(licenseData.activatedAt) : null,
        lastActivation: licenseData.activatedAt ? new Date(licenseData.activatedAt) : null,
        activationCount: 1,
      };
    }
  }

  /**
   * Get usage timeline (daily statistics for the last N days)
   */
  private async getUsageTimeline(
    licenseKey: string,
    days: number
  ): Promise<LicenseUsageStatistics['usageTimeline']> {
    try {
      const prisma = databaseService.getClient();
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Get validations in the date range
      const validations = await prisma.licenseValidationAudit.findMany({
        where: {
          licenseKey: licenseKey,
          timestamp: {
            gte: startDate,
          },
        },
        select: {
          timestamp: true,
        },
      });

      // Get transfers in the date range
      const transfers = await prisma.licenseTransfer.findMany({
        where: {
          licenseKey: licenseKey,
          initiatedAt: {
            gte: startDate,
          },
        },
        select: {
          initiatedAt: true,
        },
      });

      // Group by date
      const timelineMap = new Map<string, { validations: number; transfers: number }>();

      // Initialize all dates in range
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        timelineMap.set(dateKey, { validations: 0, transfers: 0 });
      }

      // Count validations by date
      validations.forEach(v => {
        const dateKey = new Date(v.timestamp).toISOString().split('T')[0];
        const entry = timelineMap.get(dateKey);
        if (entry) {
          entry.validations++;
        }
      });

      // Count transfers by date
      transfers.forEach(t => {
        const dateKey = new Date(t.initiatedAt).toISOString().split('T')[0];
        const entry = timelineMap.get(dateKey);
        if (entry) {
          entry.transfers++;
        }
      });

      // Convert to array
      const timeline: LicenseUsageStatistics['usageTimeline'] = Array.from(timelineMap.entries())
        .map(([dateKey, counts]) => ({
          date: new Date(dateKey),
          validations: counts.validations,
          transfers: counts.transfers,
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      return timeline;
    } catch (error: unknown) {
      logger.error('Error getting usage timeline', error);
      return [];
    }
  }

  /**
   * Get device activation records (all devices that have used this license)
   */
  async getDeviceActivationRecords(): Promise<DeviceActivationRecord[]> {
    try {
      const prisma = databaseService.getClient();
      
      // Get current license data
      const licenseData = await licenseService.getLicenseStatus();
      if (!licenseData) {
        return [];
      }

      const licenseKey = licenseData.licenseKey;
      const records: DeviceActivationRecord[] = [];

      // Add current device
      const currentHardwareId = getHardwareId();
      const currentMachineName = getMachineName();
      
      // Get validation count for current device
      const currentDeviceValidations = await prisma.licenseValidationAudit.findMany({
        where: {
          licenseKey: licenseKey,
          hardwareId: {
            contains: currentHardwareId.substring(0, 8), // Partial match for privacy
          },
        },
      });

      records.push({
        hardwareId: currentHardwareId,
        machineName: currentMachineName,
        activatedAt: licenseData.activatedAt ? new Date(licenseData.activatedAt) : new Date(),
        lastValidation: currentDeviceValidations.length > 0
          ? currentDeviceValidations[0].timestamp
          : null,
        validationCount: currentDeviceValidations.length,
      });

      // Get devices from transfers
      const transfers = await prisma.licenseTransfer.findMany({
        where: {
          licenseKey: licenseKey,
          status: 'completed',
        },
        select: {
          sourceHardwareId: true,
          sourceMachineName: true,
          targetHardwareId: true,
          targetMachineName: true,
          completedAt: true,
        },
      });

      // Add source and target devices from transfers
      const deviceMap = new Map<string, DeviceActivationRecord>();

      transfers.forEach(transfer => {
        if (transfer.sourceHardwareId && !deviceMap.has(transfer.sourceHardwareId)) {
          deviceMap.set(transfer.sourceHardwareId, {
            hardwareId: transfer.sourceHardwareId,
            machineName: transfer.sourceMachineName,
            activatedAt: transfer.completedAt || new Date(),
            lastValidation: null,
            validationCount: 0,
          });
        }

        if (transfer.targetHardwareId && !deviceMap.has(transfer.targetHardwareId)) {
          deviceMap.set(transfer.targetHardwareId, {
            hardwareId: transfer.targetHardwareId,
            machineName: transfer.targetMachineName,
            activatedAt: transfer.completedAt || new Date(),
            lastValidation: null,
            validationCount: 0,
          });
        }
      });

      // Add transfer devices to records (excluding current device)
      deviceMap.forEach(record => {
        if (record.hardwareId !== currentHardwareId) {
          records.push(record);
        }
      });

      return records.sort((a, b) => b.activatedAt.getTime() - a.activatedAt.getTime());
    } catch (error: unknown) {
      logger.error('Error getting device activation records', error);
      return [];
    }
  }
}

// Singleton instance
export const licenseUsageStatisticsService = new LicenseUsageStatisticsService();

