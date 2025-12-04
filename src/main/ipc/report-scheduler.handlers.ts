import { ipcMain, app, shell } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { logger } from '../utils/logger';
import { databaseService } from '../services/database/database.service';
import { ReportSchedulerService, ScheduleConfig, DateRangeConfig } from '../services/reports/report-scheduler.service';
import { Prisma } from '@prisma/client';

/**
 * Register report scheduler IPC handlers
 */
export function registerReportSchedulerHandlers(): void {
  logger.info('Registering report scheduler IPC handlers...');

  /**
   * Get all scheduled reports
   * IPC: reports:getScheduledReports
   */
  ipcMain.handle(
    'reports:getScheduledReports',
    async (
      _event,
      requestedById: number,
      options?: { page?: number; pageSize?: number }
    ) => {
      try {
        const prisma = databaseService.getClient();
        const { page = 1, pageSize = 20 } = options || {};

        const where = {
          createdById: requestedById,
        };

        // Get total count
        const total = await prisma.scheduledReport.count({ where });

        // Get paginated results
        const skip = (page - 1) * pageSize;
        const scheduledReports = await prisma.scheduledReport.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        });

        const totalPages = Math.ceil(total / pageSize);

        return {
          success: true,
          data: scheduledReports.map((report) => ({
            id: report.id,
            name: report.name,
            reportType: report.reportType,
            scheduleType: report.scheduleType,
            scheduleConfig: JSON.parse(report.scheduleConfig),
            dateRangeType: report.dateRangeType,
            dateRangeConfig: report.dateRangeConfig ? JSON.parse(report.dateRangeConfig) : null,
            exportFormat: report.exportFormat,
            exportPath: report.exportPath,
            isActive: report.isActive,
            lastRunAt: report.lastRunAt,
            nextRunAt: report.nextRunAt,
            createdById: report.createdById,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
          })),
          pagination: {
            total,
            page,
            pageSize,
            totalPages,
          },
        };
      } catch (error) {
        logger.error('Error in reports:getScheduledReports handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Create a new scheduled report
   * IPC: reports:createScheduledReport
   */
  ipcMain.handle(
    'reports:createScheduledReport',
    async (
      _event,
      scheduledReport: {
        name: string;
        reportType: string;
        scheduleType: string;
        scheduleConfig: ScheduleConfig | unknown;
        dateRangeType: string;
        dateRangeConfig: DateRangeConfig | unknown;
        exportFormat: string;
        exportPath?: string;
      },
      requestedById: number
    ) => {
      try {
        const prisma = databaseService.getClient();

        // Validate required fields
        if (!scheduledReport.name || scheduledReport.name.trim() === '') {
          return {
            success: false,
            error: 'Report name is required',
          };
        }

        const scheduleConfig = scheduledReport.scheduleConfig as ScheduleConfig;
        if (!scheduleConfig?.time || scheduleConfig.time.trim() === '') {
          return {
            success: false,
            error: 'Time is required',
          };
        }

        // Validate fixed date range if applicable
        if (scheduledReport.dateRangeType === 'fixed') {
          const dateRangeConfig = scheduledReport.dateRangeConfig as DateRangeConfig;
          if (!dateRangeConfig?.startDate || dateRangeConfig.startDate.trim() === '') {
            return {
              success: false,
              error: 'Start date is required for fixed date range',
            };
          }

          if (!dateRangeConfig?.endDate || dateRangeConfig.endDate.trim() === '') {
            return {
              success: false,
              error: 'End date is required for fixed date range',
            };
          }

          // Validate date range
          if (
            dateRangeConfig.startDate &&
            dateRangeConfig.endDate &&
            new Date(dateRangeConfig.startDate) > new Date(dateRangeConfig.endDate)
          ) {
            return {
              success: false,
              error: 'End date must be after start date',
            };
          }
        }

        // Create scheduled report
        const newReport = await prisma.scheduledReport.create({
          data: {
            name: scheduledReport.name,
            reportType: scheduledReport.reportType,
            scheduleType: scheduledReport.scheduleType,
            scheduleConfig: JSON.stringify(scheduledReport.scheduleConfig),
            dateRangeType: scheduledReport.dateRangeType,
            dateRangeConfig: scheduledReport.dateRangeConfig
              ? JSON.stringify(scheduledReport.dateRangeConfig)
              : null,
            exportFormat: scheduledReport.exportFormat,
            exportPath: scheduledReport.exportPath || null,
            isActive: true,
            createdById: requestedById,
            nextRunAt: ReportSchedulerService.calculateNextRun({
              id: 0,
              name: scheduledReport.name,
              reportType: scheduledReport.reportType,
              scheduleType: scheduledReport.scheduleType,
              scheduleConfig: JSON.stringify(scheduledReport.scheduleConfig),
              dateRangeType: scheduledReport.dateRangeType,
              dateRangeConfig: scheduledReport.dateRangeConfig
                ? JSON.stringify(scheduledReport.dateRangeConfig)
                : null,
              exportFormat: scheduledReport.exportFormat,
              exportPath: scheduledReport.exportPath || null,
              isActive: true,
              nextRunAt: null,
              createdById: requestedById,
            }),
          },
        });

        // Schedule the report
        ReportSchedulerService.scheduleReport({
          id: newReport.id,
          name: newReport.name,
          reportType: newReport.reportType,
          scheduleType: newReport.scheduleType,
          scheduleConfig: newReport.scheduleConfig,
          dateRangeType: newReport.dateRangeType,
          dateRangeConfig: newReport.dateRangeConfig,
          exportFormat: newReport.exportFormat,
          exportPath: newReport.exportPath,
          isActive: newReport.isActive,
          nextRunAt: newReport.nextRunAt,
          createdById: newReport.createdById,
        });

        return {
          success: true,
          data: {
            id: newReport.id,
            name: newReport.name,
            reportType: newReport.reportType,
            scheduleType: newReport.scheduleType,
            scheduleConfig: JSON.parse(newReport.scheduleConfig),
            dateRangeType: newReport.dateRangeType,
            dateRangeConfig: newReport.dateRangeConfig ? JSON.parse(newReport.dateRangeConfig) : null,
            exportFormat: newReport.exportFormat,
            exportPath: newReport.exportPath,
            isActive: newReport.isActive,
            lastRunAt: newReport.lastRunAt,
            nextRunAt: newReport.nextRunAt,
            createdById: newReport.createdById,
            createdAt: newReport.createdAt,
            updatedAt: newReport.updatedAt,
          },
        };
      } catch (error) {
        logger.error('Error in reports:createScheduledReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update a scheduled report
   * IPC: reports:updateScheduledReport
   */
  ipcMain.handle(
    'reports:updateScheduledReport',
    async (
      _event,
      reportId: number,
      updates: {
        name?: string;
        scheduleType?: string;
        scheduleConfig?: ScheduleConfig | unknown;
        dateRangeType?: string;
        dateRangeConfig?: DateRangeConfig | unknown;
        exportFormat?: string;
        exportPath?: string;
        isActive?: boolean;
      },
      requestedById: number
    ) => {
      try {
        const prisma = databaseService.getClient();

        // Check if report exists and belongs to user
        const existingReport = await prisma.scheduledReport.findUnique({
          where: { id: reportId },
        });

        if (!existingReport) {
          return {
            success: false,
            error: 'Scheduled report not found',
          };
        }

        if (existingReport.createdById !== requestedById) {
          return {
            success: false,
            error: 'Unauthorized: You can only update your own scheduled reports',
          };
        }

        // Prepare update data
        const updateData: Prisma.ScheduledReportUpdateInput = {};
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.scheduleType !== undefined) updateData.scheduleType = updates.scheduleType;
        if (updates.scheduleConfig !== undefined)
          updateData.scheduleConfig = JSON.stringify(updates.scheduleConfig);
        if (updates.dateRangeType !== undefined) updateData.dateRangeType = updates.dateRangeType;
        if (updates.dateRangeConfig !== undefined)
          updateData.dateRangeConfig = updates.dateRangeConfig
            ? JSON.stringify(updates.dateRangeConfig)
            : null;
        if (updates.exportFormat !== undefined) updateData.exportFormat = updates.exportFormat;
        if (updates.exportPath !== undefined) updateData.exportPath = updates.exportPath || null;
        if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

        // Recalculate next run if schedule changed
        if (updates.scheduleType || updates.scheduleConfig || updates.isActive !== undefined) {
          const scheduleConfig =
            updates.scheduleConfig || JSON.parse(existingReport.scheduleConfig);
          const scheduleType = updates.scheduleType || existingReport.scheduleType;
          const isActive = updates.isActive !== undefined ? updates.isActive : existingReport.isActive;

          if (isActive) {
            updateData.nextRunAt = ReportSchedulerService.calculateNextRun({
              id: reportId,
              name: existingReport.name,
              reportType: existingReport.reportType,
              scheduleType,
              scheduleConfig: JSON.stringify(scheduleConfig),
              dateRangeType: existingReport.dateRangeType,
              dateRangeConfig: existingReport.dateRangeConfig,
              exportFormat: existingReport.exportFormat,
              exportPath: existingReport.exportPath,
              isActive,
              nextRunAt: null,
              createdById: existingReport.createdById,
            });
          }
        }

        // Update report
        const updatedReport = await prisma.scheduledReport.update({
          where: { id: reportId },
          data: updateData,
        });

        // Reschedule the report
        ReportSchedulerService.unscheduleReport(reportId);
        if (updatedReport.isActive) {
          ReportSchedulerService.scheduleReport({
            id: updatedReport.id,
            name: updatedReport.name,
            reportType: updatedReport.reportType,
            scheduleType: updatedReport.scheduleType,
            scheduleConfig: updatedReport.scheduleConfig,
            dateRangeType: updatedReport.dateRangeType,
            dateRangeConfig: updatedReport.dateRangeConfig,
            exportFormat: updatedReport.exportFormat,
            exportPath: updatedReport.exportPath,
            isActive: updatedReport.isActive,
            nextRunAt: updatedReport.nextRunAt,
            createdById: updatedReport.createdById,
          });
        }

        return {
          success: true,
          data: {
            id: updatedReport.id,
            name: updatedReport.name,
            reportType: updatedReport.reportType,
            scheduleType: updatedReport.scheduleType,
            scheduleConfig: JSON.parse(updatedReport.scheduleConfig),
            dateRangeType: updatedReport.dateRangeType,
            dateRangeConfig: updatedReport.dateRangeConfig
              ? JSON.parse(updatedReport.dateRangeConfig)
              : null,
            exportFormat: updatedReport.exportFormat,
            exportPath: updatedReport.exportPath,
            isActive: updatedReport.isActive,
            lastRunAt: updatedReport.lastRunAt,
            nextRunAt: updatedReport.nextRunAt,
            createdById: updatedReport.createdById,
            createdAt: updatedReport.createdAt,
            updatedAt: updatedReport.updatedAt,
          },
        };
      } catch (error) {
        logger.error('Error in reports:updateScheduledReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete a scheduled report
   * IPC: reports:deleteScheduledReport
   */
  ipcMain.handle(
    'reports:deleteScheduledReport',
    async (_event, reportId: number, requestedById: number) => {
      try {
        const prisma = databaseService.getClient();

        // Check if report exists and belongs to user
        const existingReport = await prisma.scheduledReport.findUnique({
          where: { id: reportId },
        });

        if (!existingReport) {
          return {
            success: false,
            error: 'Scheduled report not found',
          };
        }

        if (existingReport.createdById !== requestedById) {
          return {
            success: false,
            error: 'Unauthorized: You can only delete your own scheduled reports',
          };
        }

        // Unschedule the report
        ReportSchedulerService.unscheduleReport(reportId);

        // Delete report
        await prisma.scheduledReport.delete({
          where: { id: reportId },
        });

        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in reports:deleteScheduledReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Execute a scheduled report immediately (manual trigger)
   * IPC: reports:executeScheduledReport
   */
  ipcMain.handle(
    'reports:executeScheduledReport',
    async (_event, reportId: number, requestedById: number) => {
      try {
        const prisma = databaseService.getClient();

        const report = await prisma.scheduledReport.findUnique({
          where: { id: reportId },
        });

        if (!report) {
          return {
            success: false,
            error: 'Scheduled report not found',
          };
        }

        if (report.createdById !== requestedById) {
          return {
            success: false,
            error: 'Unauthorized: You can only execute your own scheduled reports',
          };
        }

        // Execute the report
        await ReportSchedulerService.executeScheduledReport({
          id: report.id,
          name: report.name,
          reportType: report.reportType,
          scheduleType: report.scheduleType,
          scheduleConfig: report.scheduleConfig,
          dateRangeType: report.dateRangeType,
          dateRangeConfig: report.dateRangeConfig,
          exportFormat: report.exportFormat,
          exportPath: report.exportPath,
          isActive: report.isActive,
          nextRunAt: report.nextRunAt,
          createdById: report.createdById,
        });

        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in reports:executeScheduledReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get reports folder path
   * IPC: reports:getReportsFolderPath
   */
  ipcMain.handle('reports:getReportsFolderPath', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const reportsDir = join(userDataPath, 'scheduled-reports');
      return {
        success: true,
        path: reportsDir,
      };
    } catch (error) {
      logger.error('Error getting reports folder path', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Open reports folder in file explorer
   * IPC: reports:openReportsFolder
   */
  ipcMain.handle('reports:openReportsFolder', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const reportsDir = join(userDataPath, 'scheduled-reports');
      
      // Create directory if it doesn't exist
      if (!existsSync(reportsDir)) {
        mkdirSync(reportsDir, { recursive: true });
      }
      
      // Open folder in file explorer
      await shell.openPath(reportsDir);
      return {
        success: true,
      };
    } catch (error) {
      logger.error('Error opening reports folder', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Open exported reports folder in file explorer
   * IPC: reports:openExportedReportsFolder
   */
  ipcMain.handle('reports:openExportedReportsFolder', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const exportedReportsDir = join(userDataPath, 'exported reports');
      
      // Create directory if it doesn't exist
      if (!existsSync(exportedReportsDir)) {
        mkdirSync(exportedReportsDir, { recursive: true });
      }
      
      // Open folder in file explorer
      await shell.openPath(exportedReportsDir);
      return {
        success: true,
      };
    } catch (error) {
      logger.error('Error opening exported reports folder', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Save exported report file to exported reports folder
   * IPC: reports:saveExportedReport
   */
  ipcMain.handle('reports:saveExportedReport', async (_event, filename: string, content: Buffer | string, fileType: 'csv' | 'xlsx' | 'pdf') => {
    try {
      const userDataPath = app.getPath('userData');
      const exportedReportsDir = join(userDataPath, 'exported reports');
      
      // Create directory if it doesn't exist
      if (!existsSync(exportedReportsDir)) {
        mkdirSync(exportedReportsDir, { recursive: true });
      }
      
      // Determine file extension
      const extension = fileType === 'csv' ? '.csv' : fileType === 'xlsx' ? '.xlsx' : '.pdf';
      const filePath = join(exportedReportsDir, `${filename}${extension}`);
      
      // Write file
      if (typeof content === 'string') {
        await writeFile(filePath, content, 'utf-8');
      } else {
        await writeFile(filePath, content);
      }
      
      logger.info(`Exported report saved to: ${filePath}`);
      return {
        success: true,
        path: filePath,
      };
    } catch (error) {
      logger.error('Error saving exported report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  logger.info('Report scheduler IPC handlers registered');
}

