export interface BackupSchedule {
  id: number;
  name: string;
  scheduleType: string; // daily, weekly, monthly, custom
  scheduleConfig: ScheduleConfig;
  destinationPath: string;
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastRunStatus: string | null; // success, failed, skipped
  lastRunError: string | null;
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleConfig {
  cronExpression?: string;
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  time?: string; // HH:mm format
}

export interface CreateBackupScheduleInput {
  name: string;
  scheduleType: string;
  scheduleConfig: ScheduleConfig;
  destinationPath: string;
  isActive?: boolean;
}

export interface UpdateBackupScheduleInput {
  name?: string;
  scheduleType?: string;
  scheduleConfig?: ScheduleConfig;
  destinationPath?: string;
  isActive?: boolean;
}

/**
 * Backup Scheduler Service (Renderer)
 * Handles backup schedule API calls via IPC
 */
export class BackupSchedulerService {
  /**
   * Get all backup schedules
   */
  static async getSchedules(
    userId: number
  ): Promise<{ success: boolean; schedules?: BackupSchedule[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup-scheduler:getSchedules',
        userId
      ) as { success: boolean; schedules?: BackupSchedule[]; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        schedules: [],
      };
    }
  }

  /**
   * Get backup schedule by ID
   */
  static async getScheduleById(
    scheduleId: number
  ): Promise<{ success: boolean; schedule?: BackupSchedule | null; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup-scheduler:getScheduleById',
        scheduleId
      ) as { success: boolean; schedule?: BackupSchedule | null; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        schedule: null,
      };
    }
  }

  /**
   * Create backup schedule
   */
  static async createSchedule(
    input: CreateBackupScheduleInput,
    userId: number
  ): Promise<{ success: boolean; schedule?: BackupSchedule; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup-scheduler:createSchedule',
        input,
        userId
      ) as { success: boolean; schedule?: BackupSchedule; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update backup schedule
   */
  static async updateSchedule(
    scheduleId: number,
    input: UpdateBackupScheduleInput
  ): Promise<{ success: boolean; schedule?: BackupSchedule; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup-scheduler:updateSchedule',
        scheduleId,
        input
      ) as { success: boolean; schedule?: BackupSchedule; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete backup schedule
   */
  static async deleteSchedule(
    scheduleId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup-scheduler:deleteSchedule',
        scheduleId
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
   * Toggle backup schedule active status
   */
  static async toggleSchedule(
    scheduleId: number
  ): Promise<{ success: boolean; schedule?: BackupSchedule; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup-scheduler:toggleSchedule',
        scheduleId
      ) as { success: boolean; schedule?: BackupSchedule; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Manually trigger a scheduled backup
   */
  static async triggerBackup(
    scheduleId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'backup-scheduler:triggerBackup',
        scheduleId
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

