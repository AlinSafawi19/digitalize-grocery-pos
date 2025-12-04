import * as cron from 'node-cron';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { 
  ReportService, 
  SalesReportData, 
  InventoryReportData, 
  FinancialReportData,
  ProductPerformanceReport,
  PurchaseOrderReportData,
  SupplierPerformanceReport
} from './report.service';
import { NotificationService } from '../notifications/notification.service';
import { SettingsService } from '../settings/settings.service';
import { join, basename } from 'path';
import { app } from 'electron';
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import { writeFile } from 'fs/promises';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

interface PaginationInfo {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ScheduledReportConfig {
  id: number;
  name: string;
  reportType: string;
  scheduleType: string; // daily, weekly, monthly, custom
  scheduleConfig: string; // JSON string
  dateRangeType: string; // fixed, relative
  dateRangeConfig: string | null; // JSON string
  exportFormat: string; // csv, excel, pdf
  exportPath: string | null;
  isActive: boolean;
  nextRunAt: Date | null;
  createdById: number;
}

export interface ScheduleConfig {
  cronExpression?: string;
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  time?: string; // HH:mm format
}

export interface DateRangeConfig {
  type: 'fixed' | 'relative';
  startDate?: string; // ISO string for fixed
  endDate?: string; // ISO string for fixed
  relativeType?: 'last7days' | 'last30days' | 'last90days' | 'thisMonth' | 'lastMonth' | 'thisYear';
}

/**
 * Report Scheduler Service
 * Handles scheduled report generation and execution
 */
export class ReportSchedulerService {
  private static scheduledTasks: Map<number, cron.ScheduledTask> = new Map();
  private static isRunning = false;

  /**
   * Start the scheduler service
   */
  static start(): void {
    if (this.isRunning) {
      logger.warn('Report scheduler is already running');
      return;
    }

    logger.info('Starting report scheduler service...');
    this.isRunning = true;

    // Load and schedule all active reports
    this.loadAndScheduleReports();

    logger.info('Report scheduler service started');
  }

  /**
   * Stop the scheduler service
   */
  static stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping report scheduler service...');

    // Stop all scheduled tasks
    this.scheduledTasks.forEach((task, id) => {
      task.stop();
      logger.info(`Stopped scheduled report task: ${id}`);
    });

    this.scheduledTasks.clear();
    this.isRunning = false;
    logger.info('Report scheduler service stopped');
  }

  /**
   * Load all active scheduled reports and schedule them
   */
  static async loadAndScheduleReports(): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      const scheduledReports = await prisma.scheduledReport.findMany({
        where: {
          isActive: true,
        },
      });

      logger.info(`Loading ${scheduledReports.length} active scheduled reports`);

      for (const report of scheduledReports) {
        try {
          this.scheduleReport(report);
        } catch (error) {
          logger.error(`Failed to schedule report ${report.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error loading scheduled reports:', error);
    }
  }

  /**
   * Schedule a report
   */
  static scheduleReport(report: ScheduledReportConfig): void {
    // Stop existing task if any
    const existingTask = this.scheduledTasks.get(report.id);
    if (existingTask) {
      existingTask.stop();
    }

    if (!report.isActive) {
      return;
    }

    // Parse schedule config
    const scheduleConfig: ScheduleConfig = JSON.parse(report.scheduleConfig || '{}');
    const cronExpression = this.buildCronExpression(report.scheduleType, scheduleConfig);

    if (!cronExpression) {
      logger.warn(`Invalid schedule configuration for report ${report.id}`);
      return;
    }

    // Create cron task
    const task = cron.schedule(cronExpression, async () => {
      try {
        logger.info(`Executing scheduled report: ${report.name} (ID: ${report.id})`);
        await this.executeScheduledReport(report);
      } catch (error) {
        logger.error(`Error executing scheduled report ${report.id}:`, error);
      }
    });

    this.scheduledTasks.set(report.id, task);
    logger.info(`Scheduled report ${report.id} (${report.name}) with cron: ${cronExpression}`);
  }

  /**
   * Build cron expression from schedule type and config
   */
  private static buildCronExpression(
    scheduleType: string,
    config: ScheduleConfig
  ): string | null {
    const time = config.time || '09:00'; // Default to 9:00 AM
    const [hours, minutes] = time.split(':').map(Number);

    switch (scheduleType) {
      case 'daily':
        // Every day at specified time
        return `${minutes} ${hours} * * *`;

      case 'weekly': {
        // Every week on specified day at specified time
        const dayOfWeek = config.dayOfWeek !== undefined ? config.dayOfWeek : 1; // Default Monday
        return `${minutes} ${hours} * * ${dayOfWeek}`;
      }

      case 'monthly': {
        // Every month on specified day at specified time
        const dayOfMonth = config.dayOfMonth !== undefined ? config.dayOfMonth : 1; // Default 1st
        return `${minutes} ${hours} ${dayOfMonth} * *`;
      }

      case 'custom':
        // Use provided cron expression
        return config.cronExpression || null;

      default:
        return null;
    }
  }

  /**
   * Execute a scheduled report
   */
  static async executeScheduledReport(report: ScheduledReportConfig): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      // Calculate date range
      const dateRange = this.calculateDateRange(report.dateRangeType, report.dateRangeConfig);

      // Generate report based on type
      let reportData: SalesReportData | InventoryReportData | FinancialReportData | { products: ProductPerformanceReport[]; pagination: PaginationInfo } | PurchaseOrderReportData | { suppliers: SupplierPerformanceReport[]; pagination: PaginationInfo } | unknown;
      switch (report.reportType) {
        case 'sales':
          reportData = await ReportService.getSalesReport(
            {
              ...dateRange,
              groupBy: 'day',
            },
            false // Don't use cache for scheduled reports
          );
          break;

        case 'inventory':
          reportData = await ReportService.getInventoryReport({}, false);
          break;

        case 'financial':
          reportData = await ReportService.getFinancialReport(
            dateRange.startDate,
            dateRange.endDate
          );
          break;

        case 'product':
          reportData = await ReportService.getProductPerformanceReport({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            page: 1,
            pageSize: 1000, // Get all products for scheduled reports
          });
          break;

        case 'purchase':
          reportData = await ReportService.getPurchaseOrderReport({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            ordersByStatusPage: 1,
            ordersByStatusPageSize: 1000,
            ordersPage: 1,
            ordersPageSize: 1000, // Get all orders for scheduled reports
          });
          break;

        case 'supplier':
          reportData = await ReportService.getSupplierPerformanceReport({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            page: 1,
            pageSize: 1000, // Get all suppliers for scheduled reports
          });
          break;

        default:
          logger.warn(`Unknown report type: ${report.reportType}`);
          return;
      }

      // Export report
      let exportPath: string;
      try {
        exportPath = await this.exportReport(report, reportData, dateRange);
      } catch (exportError) {
        // If PDF export fails, fallback to CSV
        if (report.exportFormat === 'pdf') {
          logger.warn(`PDF export failed for report ${report.id}, falling back to CSV`, exportError);
          const csvReport = { ...report, exportFormat: 'csv' };
          exportPath = await this.exportReport(csvReport, reportData, dateRange);
        } else {
          throw exportError;
        }
      }

      // Update last run time
      await prisma.scheduledReport.update({
        where: { id: report.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt: this.calculateNextRun(report),
        },
      });

      logger.info(`Scheduled report ${report.id} executed successfully. Exported to: ${exportPath}`);

      // Notify user that the report was generated successfully
      // Store file path in message with a special marker for parsing
      try {
        await NotificationService.createNotification({
          type: 'user_activity',
          title: 'Scheduled Report Generated',
          message: `Report "${report.name}" has been generated and exported to: ${basename(exportPath)}|REPORT_PATH:${exportPath}`,
          userId: report.createdById,
          priority: 'normal',
        });
      } catch (notificationError) {
        // Don't fail the report execution if notification fails
        logger.error('Failed to create notification for scheduled report', notificationError);
      }
    } catch (error) {
      logger.error(`Error executing scheduled report ${report.id}:`, error);

      // Notify user that the report execution failed
      try {
        await NotificationService.createNotification({
          type: 'system_error',
          title: 'Scheduled Report Failed',
          message: `Report "${report.name}" failed to generate: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId: report.createdById,
          priority: 'high',
        });
      } catch (notificationError) {
        // Don't fail if notification creation fails
        logger.error('Failed to create error notification for scheduled report', notificationError);
      }
    }
  }

  /**
   * Calculate date range based on configuration
   */
  private static calculateDateRange(
    dateRangeType: string,
    dateRangeConfig: string | null
  ): { startDate: Date; endDate: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (dateRangeType === 'fixed' && dateRangeConfig) {
      const config: DateRangeConfig = JSON.parse(dateRangeConfig);
      return {
        startDate: config.startDate ? new Date(config.startDate) : today,
        endDate: config.endDate ? new Date(config.endDate) : today,
      };
    }

    // Default to relative: last 30 days
    const config: DateRangeConfig = dateRangeConfig
      ? JSON.parse(dateRangeConfig)
      : { type: 'relative', relativeType: 'last30days' };

    const relativeType = config.relativeType || 'last30days';
    let startDate = new Date(today);

    switch (relativeType) {
      case 'last7days':
        startDate.setDate(today.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(today.getDate() - 30);
        break;
      case 'last90days':
        startDate.setDate(today.getDate() - 90);
        break;
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastMonth': {
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
        return { startDate, endDate: lastDay };
      }
      case 'thisYear':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        startDate.setDate(today.getDate() - 30);
    }

    return { startDate, endDate: today };
  }

  /**
   * Export report to file
   */
  private static async exportReport(
    report: ScheduledReportConfig,
    reportData: SalesReportData | InventoryReportData | FinancialReportData | { products: ProductPerformanceReport[]; pagination: PaginationInfo } | PurchaseOrderReportData | { suppliers: SupplierPerformanceReport[]; pagination: PaginationInfo } | unknown,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<string> {
    // Get export directory
    const userDataPath = app.getPath('userData');
    const reportsDir = join(userDataPath, 'scheduled-reports');

    // Create directory if it doesn't exist
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${report.name.replace(/[^a-z0-9]/gi, '_')}_${timestamp}`;

    let filePath: string;

    switch (report.exportFormat) {
      case 'csv': {
        filePath = join(reportsDir, `${filename}.csv`);
        const csvContent = this.generateCSV(reportData, report.reportType, dateRange);
        await writeFile(filePath, csvContent, 'utf-8');
        logger.info(`CSV report exported to: ${filePath}`);
        break;
      }

      case 'excel':
        filePath = join(reportsDir, `${filename}.xlsx`);
        await this.generateExcel(reportData, report.reportType, dateRange, filePath);
        logger.info(`Excel report exported to: ${filePath}`);
        break;

      case 'pdf':
        filePath = join(reportsDir, `${filename}.pdf`);
        await this.generatePDF(reportData, report.reportType, dateRange, report.name, filePath);
        logger.info(`PDF report exported to: ${filePath}`);
        break;

      default:
        filePath = join(reportsDir, `${filename}.txt`);
        await writeFile(filePath, JSON.stringify(reportData, null, 2), 'utf-8');
        logger.info(`Text report exported to: ${filePath}`);
    }

    return filePath;
  }

  /**
   * Generate CSV content with all report data
   */
  private static generateCSV(data: SalesReportData | InventoryReportData | FinancialReportData | { products: ProductPerformanceReport[]; pagination: PaginationInfo } | PurchaseOrderReportData | { suppliers: SupplierPerformanceReport[]; pagination: PaginationInfo } | unknown, reportType: string, dateRange: { startDate: Date; endDate: Date }): string {
    const lines: string[] = [];
    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Add header
    lines.push(`Report: ${reportType.toUpperCase()} Report`);
    lines.push(`Date Range: ${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');

    if (reportType === 'sales') {
      // Summary section
      const salesData = data as SalesReportData;
      lines.push('SUMMARY');
      lines.push('Metric,Value');
      lines.push(`Total Sales,${(salesData.totalSales || 0).toFixed(2)}`);
      lines.push(`Total Transactions,${salesData.totalTransactions || 0}`);
      lines.push(`Total Items,${salesData.totalItems || 0}`);
      lines.push(`Total Discount,${(salesData.totalDiscount || 0).toFixed(2)}`);
      lines.push(`Total Tax,${(salesData.totalTax || 0).toFixed(2)}`);
      lines.push(`Average Transaction Value,${(salesData.averageTransactionValue || 0).toFixed(2)}`);
      lines.push('');

      // Breakdown by period
      if (salesData.breakdown && salesData.breakdown.length > 0) {
        lines.push('BREAKDOWN BY PERIOD');
        lines.push('Period,Sales,Transactions');
        salesData.breakdown.forEach((item) => {
          lines.push(`${escapeCSV(item.period)},${(item.sales || 0).toFixed(2)},${item.transactions || 0}`);
        });
        lines.push('');
      }

      // Top Products
      if (salesData.topProducts && salesData.topProducts.length > 0) {
        lines.push('TOP PRODUCTS');
        lines.push('Product Name,Quantity,Revenue');
        salesData.topProducts.forEach((product) => {
          lines.push(`${escapeCSV(product.productName)},${product.quantity || 0},${(product.revenue || 0).toFixed(2)}`);
        });
        lines.push('');
      }

      // Sales by Cashier
      if (salesData.salesByCashier && salesData.salesByCashier.length > 0) {
        lines.push('SALES BY CASHIER');
        lines.push('Cashier Name,Transactions,Sales');
        salesData.salesByCashier.forEach((cashier) => {
          lines.push(`${escapeCSV(cashier.cashierName)},${cashier.transactions || 0},${(cashier.sales || 0).toFixed(2)}`);
        });
      }
    } else if (reportType === 'inventory') {
      // Summary section
      const inventoryData = data as InventoryReportData;
      lines.push('SUMMARY');
      lines.push('Metric,Value');
      lines.push(`Total Products,${inventoryData.totalProducts || 0}`);
      lines.push(`Total Stock Value,${(inventoryData.totalStockValue || 0).toFixed(2)}`);
      lines.push(`Low Stock Items,${inventoryData.lowStockItems || 0}`);
      lines.push(`Out of Stock Items,${inventoryData.outOfStockItems || 0}`);
      lines.push('');

      // Inventory items
      if (inventoryData.items && inventoryData.items.length > 0) {
        lines.push('INVENTORY ITEMS');
        lines.push('Product Code,Product Name,Category,Quantity,Stock Value');
        inventoryData.items.forEach((item) => {
          lines.push(
            `${escapeCSV(item.productCode || '')},${escapeCSV(item.productName || '')},${escapeCSV(item.categoryName || 'N/A')},${item.quantity || 0},${((item.stockValue || 0)).toFixed(2)}`
          );
        });
      }
    } else if (reportType === 'financial') {
      // Financial summary
      const financialData = data as FinancialReportData;
      lines.push('FINANCIAL SUMMARY');
      lines.push('Metric,Value');
      lines.push(`Revenue,${(financialData.revenue || 0).toFixed(2)}`);
      lines.push(`Cost of Goods Sold,${(financialData.costOfGoodsSold || 0).toFixed(2)}`);
      lines.push(`Gross Profit,${(financialData.grossProfit || 0).toFixed(2)}`);
      lines.push(`Gross Profit Margin,${(financialData.grossProfitMargin || 0).toFixed(2)}%`);
      lines.push(`Total Discounts,${(financialData.totalDiscounts || 0).toFixed(2)}`);
      lines.push(`Total Tax,${(financialData.totalTax || 0).toFixed(2)}`);
      lines.push(`Net Profit,${(financialData.netProfit || 0).toFixed(2)}`);
      lines.push(`Net Profit Margin,${(financialData.netProfitMargin || 0).toFixed(2)}%`);
    } else if (reportType === 'product') {
      const productData = data as { products: ProductPerformanceReport[]; pagination: PaginationInfo };
      lines.push('PRODUCT PERFORMANCE REPORT');
      lines.push('');
      if (productData.products && productData.products.length > 0) {
        lines.push('PRODUCTS');
        lines.push('Product Code,Product Name,Category,Quantity Sold,Revenue,Average Price,Cost,Profit,Profit Margin %,First Sale,Last Sale');
        productData.products.forEach((product) => {
          lines.push(
            `${escapeCSV(product.productCode)},${escapeCSV(product.productName)},${escapeCSV(product.categoryName || 'N/A')},${product.totalQuantitySold || 0},${(product.totalRevenue || 0).toFixed(2)},${(product.averagePrice || 0).toFixed(2)},${(product.totalCost || 0).toFixed(2)},${(product.profit || 0).toFixed(2)},${(product.profitMargin || 0).toFixed(2)},${product.firstSaleDate ? new Date(product.firstSaleDate).toLocaleDateString() : 'N/A'},${product.lastSaleDate ? new Date(product.lastSaleDate).toLocaleDateString() : 'N/A'}`
          );
        });
        lines.push('');
        lines.push(`Total Products,${productData.pagination?.total || productData.products.length}`);
      }
    } else if (reportType === 'purchase') {
      const purchaseData = data as PurchaseOrderReportData;
      lines.push('PURCHASE ORDER REPORT');
      lines.push('');
      lines.push('SUMMARY');
      lines.push('Metric,Value');
      lines.push(`Total Orders,${purchaseData.totalOrders || 0}`);
      lines.push(`Total Value,${(purchaseData.totalValue || 0).toFixed(2)}`);
      lines.push('');
      
      if (purchaseData.ordersByStatus && purchaseData.ordersByStatus.length > 0) {
        lines.push('ORDERS BY STATUS');
        lines.push('Status,Count,Value');
        purchaseData.ordersByStatus.forEach((status) => {
          lines.push(`${escapeCSV(status.status)},${status.count || 0},${(status.value || 0).toFixed(2)}`);
        });
        lines.push('');
      }

      if (purchaseData.orders && purchaseData.orders.length > 0) {
        lines.push('ORDERS');
        lines.push('Order Number,Supplier,Order Date,Expected Date,Received Date,Status,Total');
        purchaseData.orders.forEach((order) => {
          lines.push(
            `${escapeCSV(order.orderNumber)},${escapeCSV(order.supplierName)},${new Date(order.orderDate).toLocaleDateString()},${order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : 'N/A'},${order.receivedDate ? new Date(order.receivedDate).toLocaleDateString() : 'N/A'},${escapeCSV(order.status)},${(order.total || 0).toFixed(2)}`
          );
        });
      }
    } else if (reportType === 'supplier') {
      const supplierData = data as { suppliers: SupplierPerformanceReport[]; pagination: PaginationInfo };
      lines.push('SUPPLIER PERFORMANCE REPORT');
      lines.push('');
      if (supplierData.suppliers && supplierData.suppliers.length > 0) {
        lines.push('SUPPLIERS');
        lines.push('Supplier Name,Total Orders,Total Value,Average Order Value,Orders Received,Orders Pending,Total Paid,Total Outstanding,Last Order Date');
        supplierData.suppliers.forEach((supplier) => {
          lines.push(
            `${escapeCSV(supplier.supplierName)},${supplier.totalOrders || 0},${(supplier.totalValue || 0).toFixed(2)},${(supplier.averageOrderValue || 0).toFixed(2)},${supplier.ordersReceived || 0},${supplier.ordersPending || 0},${(supplier.totalPaid || 0).toFixed(2)},${(supplier.totalOutstanding || 0).toFixed(2)},${supplier.lastOrderDate ? new Date(supplier.lastOrderDate).toLocaleDateString() : 'N/A'}`
          );
        });
        lines.push('');
        lines.push(`Total Suppliers,${supplierData.pagination?.total || supplierData.suppliers.length}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate Excel file with all report data
   */
  private static async generateExcel(
    data: SalesReportData | InventoryReportData | FinancialReportData | { products: ProductPerformanceReport[]; pagination: PaginationInfo } | PurchaseOrderReportData | { suppliers: SupplierPerformanceReport[]; pagination: PaginationInfo } | unknown,
    reportType: string,
    dateRange: { startDate: Date; endDate: Date },
    filePath: string
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    // Add header
    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').value = `${reportType.toUpperCase()} Report`;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.getCell('A2').value = `Date Range: ${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`;
    worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleString()}`;
    worksheet.addRow([]);

    let currentRow = 5;

    if (reportType === 'sales') {
      // Summary
      worksheet.getCell(`A${currentRow}`).value = 'SUMMARY';
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      worksheet.addRow(['Metric', 'Value']);
      worksheet.getRow(currentRow).font = { bold: true };
      currentRow++;
      const salesData = data as SalesReportData;
      worksheet.addRow(['Total Sales', (salesData.totalSales || 0).toFixed(2)]);
      currentRow++;
      worksheet.addRow(['Total Transactions', salesData.totalTransactions || 0]);
      currentRow++;
      worksheet.addRow(['Total Items', salesData.totalItems || 0]);
      currentRow++;
      worksheet.addRow(['Total Discount', (salesData.totalDiscount || 0).toFixed(2)]);
      currentRow++;
      worksheet.addRow(['Total Tax', (salesData.totalTax || 0).toFixed(2)]);
      currentRow++;
      worksheet.addRow(['Average Transaction Value', (salesData.averageTransactionValue || 0).toFixed(2)]);
      currentRow += 2;

      // Breakdown
      if (salesData.breakdown && salesData.breakdown.length > 0) {
        worksheet.getCell(`A${currentRow}`).value = 'BREAKDOWN BY PERIOD';
        worksheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow++;
        worksheet.addRow(['Period', 'Sales', 'Transactions']);
        worksheet.getRow(currentRow).font = { bold: true };
        currentRow++;
        salesData.breakdown.forEach((item) => {
          worksheet.addRow([item.period, (item.sales || 0).toFixed(2), item.transactions || 0]);
          currentRow++;
        });
        currentRow++;
      }

      // Top Products
      if (salesData.topProducts && salesData.topProducts.length > 0) {
        worksheet.getCell(`A${currentRow}`).value = 'TOP PRODUCTS';
        worksheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow++;
        worksheet.addRow(['Product Name', 'Quantity', 'Revenue']);
        worksheet.getRow(currentRow).font = { bold: true };
        currentRow++;
        salesData.topProducts.forEach((product) => {
          worksheet.addRow([product.productName, product.quantity || 0, (product.revenue || 0).toFixed(2)]);
          currentRow++;
        });
      }
    } else if (reportType === 'inventory') {
      const inventoryData = data as InventoryReportData;
      worksheet.getCell(`A${currentRow}`).value = 'SUMMARY';
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      worksheet.addRow(['Metric', 'Value']);
      worksheet.getRow(currentRow).font = { bold: true };
      currentRow++;
      worksheet.addRow(['Total Products', inventoryData.totalProducts || 0]);
      currentRow++;
      worksheet.addRow(['Total Stock Value', (inventoryData.totalStockValue || 0).toFixed(2)]);
      currentRow++;
      worksheet.addRow(['Low Stock Items', inventoryData.lowStockItems || 0]);
      currentRow++;
      worksheet.addRow(['Out of Stock Items', inventoryData.outOfStockItems || 0]);
      currentRow += 2;

      if ((data as InventoryReportData).items && (data as InventoryReportData).items!.length > 0) {
        worksheet.getCell(`A${currentRow}`).value = 'INVENTORY ITEMS';
        worksheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow++;
        worksheet.addRow(['Product Code', 'Product Name', 'Category', 'Quantity', 'Stock Value']);
        worksheet.getRow(currentRow).font = { bold: true };
        currentRow++;
        (data as InventoryReportData).items!.forEach((item) => {
          worksheet.addRow([
            item.productCode || '',
            item.productName || '',
            item.categoryName || 'N/A',
            item.quantity || 0,
            (item.stockValue || 0).toFixed(2),
          ]);
          currentRow++;
        });
      }
    } else if (reportType === 'financial') {
      const financialData = data as FinancialReportData;
      worksheet.getCell(`A${currentRow}`).value = 'FINANCIAL SUMMARY';
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      worksheet.addRow(['Metric', 'Value']);
      worksheet.getRow(currentRow).font = { bold: true };
      currentRow++;
      worksheet.addRow(['Revenue', (financialData.revenue || 0).toFixed(2)]);
      currentRow++;
      worksheet.addRow(['Cost of Goods Sold', (financialData.costOfGoodsSold || 0).toFixed(2)]);
      currentRow++;
      worksheet.addRow(['Gross Profit', (financialData.grossProfit || 0).toFixed(2)]);
      currentRow++;
      worksheet.addRow(['Gross Profit Margin', `${(financialData.grossProfitMargin || 0).toFixed(2)}%`]);
      currentRow++;
      worksheet.addRow(['Total Discounts', (financialData.totalDiscounts || 0).toFixed(2)]);
      currentRow++;
      worksheet.addRow(['Total Tax', (financialData.totalTax || 0).toFixed(2)]);
      currentRow++;
      worksheet.addRow(['Net Profit', (financialData.netProfit || 0).toFixed(2)]);
      currentRow++;
      worksheet.addRow(['Net Profit Margin', `${(financialData.netProfitMargin || 0).toFixed(2)}%`]);
    } else if (reportType === 'product') {
      const productData = data as { products: ProductPerformanceReport[]; pagination: PaginationInfo };
      worksheet.getCell(`A${currentRow}`).value = 'PRODUCT PERFORMANCE REPORT';
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow += 2;
      
      if (productData.products && productData.products.length > 0) {
        worksheet.addRow(['Product Code', 'Product Name', 'Category', 'Quantity Sold', 'Revenue', 'Average Price', 'Cost', 'Profit', 'Profit Margin %', 'First Sale', 'Last Sale']);
        worksheet.getRow(currentRow).font = { bold: true };
        currentRow++;
        productData.products.forEach((product) => {
          worksheet.addRow([
            product.productCode,
            product.productName,
            product.categoryName || 'N/A',
            product.totalQuantitySold || 0,
            (product.totalRevenue || 0).toFixed(2),
            (product.averagePrice || 0).toFixed(2),
            (product.totalCost || 0).toFixed(2),
            (product.profit || 0).toFixed(2),
            `${(product.profitMargin || 0).toFixed(2)}%`,
            product.firstSaleDate ? new Date(product.firstSaleDate).toLocaleDateString() : 'N/A',
            product.lastSaleDate ? new Date(product.lastSaleDate).toLocaleDateString() : 'N/A',
          ]);
          currentRow++;
        });
        currentRow++;
        worksheet.addRow(['Total Products', productData.pagination?.total || productData.products.length]);
      }
    } else if (reportType === 'purchase') {
      const purchaseData = data as PurchaseOrderReportData;
      worksheet.getCell(`A${currentRow}`).value = 'SUMMARY';
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
      worksheet.addRow(['Metric', 'Value']);
      worksheet.getRow(currentRow).font = { bold: true };
      currentRow++;
      worksheet.addRow(['Total Orders', purchaseData.totalOrders || 0]);
      currentRow++;
      worksheet.addRow(['Total Value', (purchaseData.totalValue || 0).toFixed(2)]);
      currentRow += 2;

      if (purchaseData.ordersByStatus && purchaseData.ordersByStatus.length > 0) {
        worksheet.getCell(`A${currentRow}`).value = 'ORDERS BY STATUS';
        worksheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow++;
        worksheet.addRow(['Status', 'Count', 'Value']);
        worksheet.getRow(currentRow).font = { bold: true };
        currentRow++;
        purchaseData.ordersByStatus.forEach((status) => {
          worksheet.addRow([status.status, status.count || 0, (status.value || 0).toFixed(2)]);
          currentRow++;
        });
        currentRow++;
      }

      if (purchaseData.orders && purchaseData.orders.length > 0) {
        worksheet.getCell(`A${currentRow}`).value = 'ORDERS';
        worksheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow++;
        worksheet.addRow(['Order Number', 'Supplier', 'Order Date', 'Expected Date', 'Received Date', 'Status', 'Total']);
        worksheet.getRow(currentRow).font = { bold: true };
        currentRow++;
        purchaseData.orders.forEach((order) => {
          worksheet.addRow([
            order.orderNumber,
            order.supplierName,
            new Date(order.orderDate).toLocaleDateString(),
            order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : 'N/A',
            order.receivedDate ? new Date(order.receivedDate).toLocaleDateString() : 'N/A',
            order.status,
            (order.total || 0).toFixed(2),
          ]);
          currentRow++;
        });
      }
    } else if (reportType === 'supplier') {
      const supplierData = data as { suppliers: SupplierPerformanceReport[]; pagination: PaginationInfo };
      worksheet.getCell(`A${currentRow}`).value = 'SUPPLIER PERFORMANCE REPORT';
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow += 2;
      
      if (supplierData.suppliers && supplierData.suppliers.length > 0) {
        worksheet.addRow(['Supplier Name', 'Total Orders', 'Total Value', 'Average Order Value', 'Orders Received', 'Orders Pending', 'Total Paid', 'Total Outstanding', 'Last Order Date']);
        worksheet.getRow(currentRow).font = { bold: true };
        currentRow++;
        supplierData.suppliers.forEach((supplier) => {
          worksheet.addRow([
            supplier.supplierName,
            supplier.totalOrders || 0,
            (supplier.totalValue || 0).toFixed(2),
            (supplier.averageOrderValue || 0).toFixed(2),
            supplier.ordersReceived || 0,
            supplier.ordersPending || 0,
            (supplier.totalPaid || 0).toFixed(2),
            (supplier.totalOutstanding || 0).toFixed(2),
            supplier.lastOrderDate ? new Date(supplier.lastOrderDate).toLocaleDateString() : 'N/A',
          ]);
          currentRow++;
        });
        currentRow++;
        worksheet.addRow(['Total Suppliers', supplierData.pagination?.total || supplierData.suppliers.length]);
      }
    }

    // Auto-size columns
    worksheet.columns.forEach((column) => {
      if (column.eachCell) {
        let maxLength = 0;
        column.eachCell({ includeEmpty: false }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      }
    });

    await workbook.xlsx.writeFile(filePath);
  }

  /**
   * Generate PDF file with all report data
   */
  private static async generatePDF(
    data: SalesReportData | InventoryReportData | FinancialReportData | { products: ProductPerformanceReport[]; pagination: PaginationInfo } | PurchaseOrderReportData | { suppliers: SupplierPerformanceReport[]; pagination: PaginationInfo } | unknown,
    reportType: string,
    dateRange: { startDate: Date; endDate: Date },
    reportName: string,
    filePath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          // Get store information
          const storeInfo = await SettingsService.getStoreInfo();
        
        const doc = new PDFDocument({ 
          margin: 50,
          // Use standard fonts that don't require external files
          autoFirstPage: true
        });
        const stream = createWriteStream(filePath);
        doc.pipe(stream);

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const margin = 50;
        const headerHeight = 100;
        let yPos = headerHeight;

        // Professional color scheme
        const primaryColor = '#1a237e';
        const secondaryColor = '#f5f5f5';
        const textColor = '#212121';
        const lightGray = '#e0e0e0';

        // Draw header background
        doc.rect(0, 0, pageWidth, headerHeight)
          .fillColor(primaryColor)
          .fill();

        // Add store logo if available
        if (storeInfo.logo) {
          try {
            const base64Data = storeInfo.logo.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            // Calculate logo dimensions (max 60px height, maintain aspect ratio)
            const maxLogoHeight = 60;
            const logoWidth = Math.min(150, maxLogoHeight * 2); // Max width 150
            
            doc.image(imageBuffer, margin, 20, {
              fit: [logoWidth, maxLogoHeight],
            });
          } catch (error) {
            logger.warn('Failed to add logo to PDF report', { error });
          }
        }

        // Store information (right-aligned in header)
        doc.fillColor('#ffffff') // White text
          .fontSize(16)
          .font('Helvetica-Bold');
        
        let storeInfoY = 25;
        if (storeInfo.name) {
          doc.text(storeInfo.name, pageWidth - margin, storeInfoY, {
            align: 'right',
            width: pageWidth - 2 * margin - 160, // Leave space for logo
          });
          storeInfoY += 10;
        }
        
        doc.fontSize(10)
          .font('Helvetica');
        
        if (storeInfo.address) {
          doc.text(storeInfo.address, pageWidth - margin, storeInfoY, {
            align: 'right',
            width: pageWidth - 2 * margin - 160,
          });
          storeInfoY += 8;
        }
        
        if (storeInfo.phone) {
          doc.text(`Phone: ${storeInfo.phone}`, pageWidth - margin, storeInfoY, {
            align: 'right',
            width: pageWidth - 2 * margin - 160,
          });
        }

        // Report title (centered, below header)
        yPos = headerHeight + 25;
        doc.fillColor(textColor)
          .fontSize(22)
          .font('Helvetica-Bold')
          .text(`${reportType.toUpperCase()} REPORT`, margin, yPos, {
            align: 'center',
            width: pageWidth - 2 * margin,
          });

        // Report metadata
        yPos += 15;
        doc.fontSize(11)
          .font('Helvetica')
          .fillColor('#666666')
          .text(`Report: ${reportName}`, margin, yPos, {
            align: 'center',
            width: pageWidth - 2 * margin,
          });

        yPos += 10;
        doc.text(
          `Date Range: ${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`,
          margin,
          yPos,
          {
            align: 'center',
            width: pageWidth - 2 * margin,
          }
        );

        yPos += 10;
        doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos, {
          align: 'center',
          width: pageWidth - 2 * margin,
        });

        yPos += 25;

        if (reportType === 'sales') {
          const salesData = data as SalesReportData;
          
          // Section header with background
          doc.rect(margin, yPos, pageWidth - 2 * margin, 15)
            .fillColor(secondaryColor)
            .fill()
            .strokeColor(lightGray)
            .lineWidth(0.5)
            .stroke();
          
          doc.fillColor(textColor)
            .fontSize(14)
            .font('Helvetica-Bold')
            .text('SUMMARY', margin + 5, yPos + 5);
          yPos += 20;

          doc.fontSize(11)
            .font('Helvetica');
          
          const summaryItems = [
            { label: 'Total Sales', value: `$${(salesData.totalSales || 0).toFixed(2)}` },
            { label: 'Total Transactions', value: (salesData.totalTransactions || 0).toString() },
            { label: 'Total Items', value: (salesData.totalItems || 0).toString() },
            { label: 'Total Discount', value: `$${(salesData.totalDiscount || 0).toFixed(2)}` },
            { label: 'Total Tax', value: `$${(salesData.totalTax || 0).toFixed(2)}` },
            { label: 'Average Transaction Value', value: `$${(salesData.averageTransactionValue || 0).toFixed(2)}` },
          ];

          summaryItems.forEach((item) => {
            if (yPos > pageHeight - 50) {
              doc.addPage();
              yPos = margin;
            }
            doc.fillColor(textColor)
              .text(`${item.label}:`, margin + 10, yPos)
              .font('Helvetica-Bold')
              .text(item.value, margin + 150, yPos);
            yPos += 12;
          });
          yPos += 10;

          if (salesData.breakdown && salesData.breakdown.length > 0) {
            if (yPos > pageHeight - 80) {
              doc.addPage();
              yPos = margin;
            }
            
            doc.rect(margin, yPos, pageWidth - 2 * margin, 15)
              .fillColor(secondaryColor)
              .fill()
              .strokeColor(lightGray)
              .lineWidth(0.5)
              .stroke();
            
            doc.fillColor(textColor)
              .fontSize(14)
              .font('Helvetica-Bold')
              .text('BREAKDOWN BY PERIOD', margin + 5, yPos + 5);
            yPos += 20;

            doc.fontSize(10)
              .font('Helvetica');
            salesData.breakdown.forEach((item) => {
              if (yPos > pageHeight - 30) {
                doc.addPage();
                yPos = margin;
              }
              doc.text(`${item.period}: Sales $${(item.sales || 0).toFixed(2)}, Transactions ${item.transactions || 0}`, margin + 10, yPos);
              yPos += 12;
            });
            yPos += 10;
          }

          if (salesData.topProducts && salesData.topProducts.length > 0) {
            if (yPos > pageHeight - 80) {
              doc.addPage();
              yPos = margin;
            }
            
            doc.rect(margin, yPos, pageWidth - 2 * margin, 15)
              .fillColor(secondaryColor)
              .fill()
              .strokeColor(lightGray)
              .lineWidth(0.5)
              .stroke();
            
            doc.fillColor(textColor)
              .fontSize(14)
              .font('Helvetica-Bold')
              .text('TOP PRODUCTS', margin + 5, yPos + 5);
            yPos += 20;

            doc.fontSize(10)
              .font('Helvetica');
            salesData.topProducts.forEach((product) => {
              if (yPos > pageHeight - 30) {
                doc.addPage();
                yPos = margin;
              }
              doc.text(`${product.productName}: Quantity ${product.quantity || 0}, Revenue $${(product.revenue || 0).toFixed(2)}`, margin + 10, yPos);
              yPos += 12;
            });
            yPos += 10;
          }

          if (salesData.salesByCashier && salesData.salesByCashier.length > 0) {
            if (yPos > pageHeight - 80) {
              doc.addPage();
              yPos = margin;
            }
            
            doc.rect(margin, yPos, pageWidth - 2 * margin, 15)
              .fillColor(secondaryColor)
              .fill()
              .strokeColor(lightGray)
              .lineWidth(0.5)
              .stroke();
            
            doc.fillColor(textColor)
              .fontSize(14)
              .font('Helvetica-Bold')
              .text('SALES BY CASHIER', margin + 5, yPos + 5);
            yPos += 20;

            doc.fontSize(10)
              .font('Helvetica');
            salesData.salesByCashier.forEach((cashier) => {
              if (yPos > pageHeight - 30) {
                doc.addPage();
                yPos = margin;
              }
              doc.text(`${cashier.cashierName}: ${cashier.transactions || 0} transactions, Sales $${(cashier.sales || 0).toFixed(2)}`, margin + 10, yPos);
              yPos += 12;
            });
          }
        } else if (reportType === 'inventory') {
          const inventoryData = data as InventoryReportData;
          
          // Section header with background
          doc.rect(margin, yPos, pageWidth - 2 * margin, 15)
            .fillColor(secondaryColor)
            .fill()
            .strokeColor(lightGray)
            .lineWidth(0.5)
            .stroke();
          
          doc.fillColor(textColor)
            .fontSize(14)
            .font('Helvetica-Bold')
            .text('SUMMARY', margin + 5, yPos + 5);
          yPos += 20;

          doc.fontSize(11)
            .font('Helvetica');
          
          const inventorySummaryItems = [
            { label: 'Total Products', value: (inventoryData.totalProducts || 0).toString() },
            { label: 'Total Stock Value', value: `$${(inventoryData.totalStockValue || 0).toFixed(2)}` },
            { label: 'Low Stock Items', value: (inventoryData.lowStockItems || 0).toString() },
            { label: 'Out of Stock Items', value: (inventoryData.outOfStockItems || 0).toString() },
          ];

          inventorySummaryItems.forEach((item) => {
            if (yPos > pageHeight - 50) {
              doc.addPage();
              yPos = margin;
            }
            doc.fillColor(textColor)
              .font('Helvetica')
              .text(`${item.label}:`, margin + 10, yPos)
              .font('Helvetica-Bold')
              .text(item.value, margin + 150, yPos);
            yPos += 12;
          });
          yPos += 10;

          if (inventoryData.items && inventoryData.items.length > 0) {
            if (yPos > pageHeight - 80) {
              doc.addPage();
              yPos = margin;
            }
            
            doc.rect(margin, yPos, pageWidth - 2 * margin, 15)
              .fillColor(secondaryColor)
              .fill()
              .strokeColor(lightGray)
              .lineWidth(0.5)
              .stroke();
            
            doc.fillColor(textColor)
              .fontSize(14)
              .font('Helvetica-Bold')
              .text('INVENTORY ITEMS', margin + 5, yPos + 5);
            yPos += 20;

            doc.fontSize(10)
              .font('Helvetica');
            inventoryData.items.forEach((item) => {
              if (yPos > pageHeight - 30) {
                doc.addPage();
                yPos = margin;
              }
              doc.text(
                `${item.productName || item.productCode || 'N/A'}: Quantity ${item.quantity || 0}, Value $${((item.stockValue || 0)).toFixed(2)}`,
                margin + 10,
                yPos
              );
              yPos += 12;
            });
          }
        } else if (reportType === 'financial') {
          const financialData = data as FinancialReportData;
          
          // Section header with background
          doc.rect(margin, yPos, pageWidth - 2 * margin, 15)
            .fillColor(secondaryColor)
            .fill()
            .strokeColor(lightGray)
            .lineWidth(0.5)
            .stroke();
          
          doc.fillColor(textColor)
            .fontSize(14)
            .font('Helvetica-Bold')
            .text('FINANCIAL SUMMARY', margin + 5, yPos + 5);
          yPos += 20;

          doc.fontSize(11)
            .font('Helvetica');
          
          const financialItems = [
            { label: 'Revenue', value: `$${(financialData.revenue || 0).toFixed(2)}` },
            { label: 'Cost of Goods Sold', value: `$${(financialData.costOfGoodsSold || 0).toFixed(2)}` },
            { label: 'Gross Profit', value: `$${(financialData.grossProfit || 0).toFixed(2)}` },
            { label: 'Gross Profit Margin', value: `${(financialData.grossProfitMargin || 0).toFixed(2)}%` },
            { label: 'Total Discounts', value: `$${(financialData.totalDiscounts || 0).toFixed(2)}` },
            { label: 'Total Tax', value: `$${(financialData.totalTax || 0).toFixed(2)}` },
            { label: 'Net Profit', value: `$${(financialData.netProfit || 0).toFixed(2)}` },
            { label: 'Net Profit Margin', value: `${(financialData.netProfitMargin || 0).toFixed(2)}%` },
          ];

          financialItems.forEach((item) => {
            if (yPos > pageHeight - 50) {
              doc.addPage();
              yPos = margin;
            }
            doc.fillColor(textColor)
              .font('Helvetica')
              .text(`${item.label}:`, margin + 10, yPos)
              .font('Helvetica-Bold')
              .text(item.value, margin + 150, yPos);
            yPos += 12;
          });
        } else if (reportType === 'product') {
          const productData = data as { products: ProductPerformanceReport[]; pagination: PaginationInfo };
          doc.fontSize(14).text('PRODUCT PERFORMANCE REPORT');
          doc.moveDown();
          
          if (productData.products && productData.products.length > 0) {
            doc.fontSize(10);
            productData.products.forEach((product) => {
              doc.text(`${product.productName} (${product.productCode})`);
              doc.text(`  Category: ${product.categoryName || 'N/A'}`);
              doc.text(`  Quantity Sold: ${product.totalQuantitySold || 0}`);
              doc.text(`  Revenue: ${(product.totalRevenue || 0).toFixed(2)}`);
              doc.text(`  Average Price: ${(product.averagePrice || 0).toFixed(2)}`);
              doc.text(`  Cost: ${(product.totalCost || 0).toFixed(2)}`);
              doc.text(`  Profit: ${(product.profit || 0).toFixed(2)}`);
              doc.text(`  Profit Margin: ${(product.profitMargin || 0).toFixed(2)}%`);
              doc.text(`  First Sale: ${product.firstSaleDate ? new Date(product.firstSaleDate).toLocaleDateString() : 'N/A'}`);
              doc.text(`  Last Sale: ${product.lastSaleDate ? new Date(product.lastSaleDate).toLocaleDateString() : 'N/A'}`);
              doc.moveDown(0.5);
            });
            doc.moveDown();
            doc.text(`Total Products: ${productData.pagination?.total || productData.products.length}`);
          }
        } else if (reportType === 'purchase') {
          const purchaseData = data as PurchaseOrderReportData;
          doc.fontSize(14).text('PURCHASE ORDER REPORT');
          doc.moveDown(0.5);
          doc.fontSize(10);
          doc.text(`Total Orders: ${purchaseData.totalOrders || 0}`);
          doc.text(`Total Value: ${(purchaseData.totalValue || 0).toFixed(2)}`);
          doc.moveDown();

          if (purchaseData.ordersByStatus && purchaseData.ordersByStatus.length > 0) {
            doc.fontSize(14).text('ORDERS BY STATUS');
            doc.moveDown(0.5);
            doc.fontSize(10);
            purchaseData.ordersByStatus.forEach((status) => {
              doc.text(`${status.status}: ${status.count || 0} orders, Value: ${(status.value || 0).toFixed(2)}`);
            });
            doc.moveDown();
          }

          if (purchaseData.orders && purchaseData.orders.length > 0) {
            doc.fontSize(14).text('ORDERS');
            doc.moveDown(0.5);
            doc.fontSize(10);
            purchaseData.orders.forEach((order) => {
              doc.text(`Order ${order.orderNumber} - ${order.supplierName}`);
              doc.text(`  Order Date: ${new Date(order.orderDate).toLocaleDateString()}`);
              doc.text(`  Expected Date: ${order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : 'N/A'}`);
              doc.text(`  Received Date: ${order.receivedDate ? new Date(order.receivedDate).toLocaleDateString() : 'N/A'}`);
              doc.text(`  Status: ${order.status}`);
              doc.text(`  Total: ${(order.total || 0).toFixed(2)}`);
              doc.moveDown(0.5);
            });
          }
        } else if (reportType === 'supplier') {
          const supplierData = data as { suppliers: SupplierPerformanceReport[]; pagination: PaginationInfo };
          doc.fontSize(14).text('SUPPLIER PERFORMANCE REPORT');
          doc.moveDown();
          
          if (supplierData.suppliers && supplierData.suppliers.length > 0) {
            doc.fontSize(10);
            supplierData.suppliers.forEach((supplier) => {
              doc.text(`${supplier.supplierName}`);
              doc.text(`  Total Orders: ${supplier.totalOrders || 0}`);
              doc.text(`  Total Value: ${(supplier.totalValue || 0).toFixed(2)}`);
              doc.text(`  Average Order Value: ${(supplier.averageOrderValue || 0).toFixed(2)}`);
              doc.text(`  Orders Received: ${supplier.ordersReceived || 0}`);
              doc.text(`  Orders Pending: ${supplier.ordersPending || 0}`);
              doc.text(`  Total Paid: ${(supplier.totalPaid || 0).toFixed(2)}`);
              doc.text(`  Total Outstanding: ${(supplier.totalOutstanding || 0).toFixed(2)}`);
              doc.text(`  Last Order Date: ${supplier.lastOrderDate ? new Date(supplier.lastOrderDate).toLocaleDateString() : 'N/A'}`);
              doc.moveDown(0.5);
            });
            doc.moveDown();
            doc.text(`Total Suppliers: ${supplierData.pagination?.total || supplierData.suppliers.length}`);
          }
        }

        // Add footer with page numbers
        // Since PDFKit streams the document, we track pages as we go
        let currentPage = 1;
        const addPageFooter = () => {
          doc.fillColor('#999999')
            .fontSize(9)
            .font('Helvetica')
            .text(
              `Page ${currentPage}`,
              margin,
              pageHeight - 30,
              {
                align: 'center',
                width: pageWidth - 2 * margin,
              }
            );
        };
        
        // Add footer to first page
        addPageFooter();
        
        // Override addPage to add footer to new pages
        const originalAddPage = doc.addPage.bind(doc);
        doc.addPage = function() {
          currentPage++;
          const result = originalAddPage();
          addPageFooter();
          return result;
        };

        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
      } catch (error) {
        logger.error('Error generating PDF report', error);
        reject(error);
      }
      })();
    });
  }

  /**
   * Calculate next run time
   */
  static calculateNextRun(report: ScheduledReportConfig): Date {
    const scheduleConfig: ScheduleConfig = JSON.parse(report.scheduleConfig || '{}');
    const now = new Date();
    const nextRun = new Date(now);

    switch (report.scheduleType) {
      case 'daily': {
        nextRun.setDate(now.getDate() + 1);
        const time = scheduleConfig.time || '09:00';
        const [hours, minutes] = time.split(':').map(Number);
        nextRun.setHours(hours, minutes, 0, 0);
        break;
      }

      case 'weekly': {
        const dayOfWeek = scheduleConfig.dayOfWeek !== undefined ? scheduleConfig.dayOfWeek : 1;
        const daysUntilNext = (dayOfWeek - now.getDay() + 7) % 7 || 7;
        nextRun.setDate(now.getDate() + daysUntilNext);
        const weeklyTime = scheduleConfig.time || '09:00';
        const [weeklyHours, weeklyMinutes] = weeklyTime.split(':').map(Number);
        nextRun.setHours(weeklyHours, weeklyMinutes, 0, 0);
        break;
      }

      case 'monthly': {
        nextRun.setMonth(now.getMonth() + 1);
        const dayOfMonth = scheduleConfig.dayOfMonth !== undefined ? scheduleConfig.dayOfMonth : 1;
        nextRun.setDate(dayOfMonth);
        const monthlyTime = scheduleConfig.time || '09:00';
        const [monthlyHours, monthlyMinutes] = monthlyTime.split(':').map(Number);
        nextRun.setHours(monthlyHours, monthlyMinutes, 0, 0);
        break;
      }

      default:
        nextRun.setDate(now.getDate() + 1);
    }

    return nextRun;
  }

  /**
   * Unschedule a report
   */
  static unscheduleReport(reportId: number): void {
    const task = this.scheduledTasks.get(reportId);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(reportId);
      logger.info(`Unscheduled report ${reportId}`);
    }
  }
}

