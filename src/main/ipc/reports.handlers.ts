import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  ReportService,
  SalesReportOptions,
  DateRange,
  ProfitByCategoryReportOptions,
  ProductPerformanceReportOptions,
  PurchaseOrderReportOptions,
  SupplierPerformanceReportOptions,
} from '../services/reports/report.service';

/**
 * Register reports IPC handlers
 */
export function registerReportsHandlers(): void {
  logger.info('Registering reports IPC handlers...');

  /**
   * Get sales report handler
   * IPC: reports:getSalesReport
   */
  ipcMain.handle(
    'reports:getSalesReport',
    async (_event, options: SalesReportOptions) => {
      try {
        // allow any authenticated user to view reports
        const result = await ReportService.getSalesReport(options);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getSalesReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get daily sales statistics handler
   * IPC: reports:getDailySalesStats
   */
  ipcMain.handle(
    'reports:getDailySalesStats',
    async (_event, dateRange: DateRange) => {
      try {
        const result = await ReportService.getDailySalesStats(
          dateRange.startDate,
          dateRange.endDate
        );
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getDailySalesStats handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get top selling products handler
   * IPC: reports:getTopSellingProducts
   */
  ipcMain.handle(
    'reports:getTopSellingProducts',
    async (
      _event,
      dateRange: DateRange,
      limit: number
    ) => {
      try {
        const result = await ReportService.getTopSellingProducts(
          dateRange.startDate,
          dateRange.endDate,
          limit || 10
        );
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getTopSellingProducts handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get slow moving products handler
   * IPC: reports:getSlowMovingProducts
   */
  ipcMain.handle(
    'reports:getSlowMovingProducts',
    async (
      _event,
      dateRange: DateRange,
      limit: number
    ) => {
      try {
        const result = await ReportService.getSlowMovingProducts(
          dateRange.startDate,
          dateRange.endDate,
          limit || 10
        );
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getSlowMovingProducts handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get inventory report handler
   * IPC: reports:getInventoryReport
   */
  ipcMain.handle(
    'reports:getInventoryReport',
    async (
      _event,
      options: {
        page?: number;
        pageSize?: number;
      }
    ) => {
      try {
        const result = await ReportService.getInventoryReport(options);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getInventoryReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get financial report handler
   * IPC: reports:getFinancialReport
   */
  ipcMain.handle(
    'reports:getFinancialReport',
    async (_event, dateRange: DateRange) => {
      try {
        const result = await ReportService.getFinancialReport(
          dateRange.startDate,
          dateRange.endDate
        );
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getFinancialReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get product performance report handler
   * IPC: reports:getProductPerformanceReport
   */
  ipcMain.handle(
    'reports:getProductPerformanceReport',
    async (_event, options: ProductPerformanceReportOptions) => {
      try {
        const result = await ReportService.getProductPerformanceReport(options);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getProductPerformanceReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get product sales history handler
   * IPC: reports:getProductSalesHistory
   */
  ipcMain.handle(
    'reports:getProductSalesHistory',
    async (
      _event,
      productId: number,
      dateRange: DateRange
    ) => {
      try {
        const result = await ReportService.getProductSalesHistory(
          productId,
          dateRange.startDate,
          dateRange.endDate
        );
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getProductSalesHistory handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get price history report handler
   * IPC: reports:getPriceHistoryReport
   */
  ipcMain.handle(
    'reports:getPriceHistoryReport',
    async (_event, productId: number) => {
      try {
        const result = await ReportService.getPriceHistoryReport(productId);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getPriceHistoryReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get purchase order report handler
   * IPC: reports:getPurchaseOrderReport
   */
  ipcMain.handle(
    'reports:getPurchaseOrderReport',
    async (_event, options: PurchaseOrderReportOptions) => {
      try {
        const result = await ReportService.getPurchaseOrderReport(options);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getPurchaseOrderReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get supplier performance report handler
   * IPC: reports:getSupplierPerformanceReport
   */
  ipcMain.handle(
    'reports:getSupplierPerformanceReport',
    async (_event, options: SupplierPerformanceReportOptions) => {
      try {
        const result = await ReportService.getSupplierPerformanceReport(options);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getSupplierPerformanceReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get supplier payment report handler
   * IPC: reports:getSupplierPaymentReport
   */
  ipcMain.handle(
    'reports:getSupplierPaymentReport',
    async (_event, supplierId: number) => {
      try {
        const result = await ReportService.getSupplierPaymentReport(supplierId);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getSupplierPaymentReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get receiving report handler
   * IPC: reports:getReceivingReport
   */
  ipcMain.handle(
    'reports:getReceivingReport',
    async (_event, dateRange: DateRange) => {
      try {
        const result = await ReportService.getReceivingReport(
          dateRange.startDate,
          dateRange.endDate
        );
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getReceivingReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get cash flow report handler
   * IPC: reports:getCashFlowReport
   */
  ipcMain.handle(
    'reports:getCashFlowReport',
    async (
      _event,
      options: {
        startDate: Date;
        endDate: Date;
        openingBalance?: number;
        dailyFlowPage?: number;
        dailyFlowPageSize?: number;
      }
    ) => {
      try {
        const result = await ReportService.getCashFlowReport(options);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getCashFlowReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get profit by product/category report handler
   * IPC: reports:getProfitByProductCategoryReport
   */
  ipcMain.handle(
    'reports:getProfitByProductCategoryReport',
    async (_event, options: ProfitByCategoryReportOptions) => {
      try {
        const result = await ReportService.getProfitByProductCategoryReport(options);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getProfitByProductCategoryReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get stock movement report handler
   * IPC: reports:getStockMovementReport
   */
  ipcMain.handle(
    'reports:getStockMovementReport',
    async (
      _event,
      options: {
        startDate: Date;
        endDate: Date;
        productId?: number;
        type?: string;
        page?: number;
        pageSize?: number;
      }
    ) => {
      try {
        const result = await ReportService.getStockMovementReport(options);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getStockMovementReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get expiry report handler
   * IPC: reports:getExpiryReport
   */
  ipcMain.handle(
    'reports:getExpiryReport',
    async (
      _event,
      options: {
        startDate: Date;
        endDate: Date;
        page?: number;
        pageSize?: number;
      }
    ) => {
      try {
        const result = await ReportService.getExpiryReport(options);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getExpiryReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get sales comparison report handler
   * IPC: reports:getSalesComparisonReport
   */
  ipcMain.handle(
    'reports:getSalesComparisonReport',
    async (
      _event,
      period1Range: DateRange,
      period2Range: DateRange
    ) => {
      try {
        const result = await ReportService.getSalesComparisonReport(
          period1Range.startDate,
          period1Range.endDate,
          period2Range.startDate,
          period2Range.endDate
        );
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getSalesComparisonReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get void/return transaction report handler
   * IPC: reports:getVoidReturnTransactionReport
   */
  ipcMain.handle(
    'reports:getVoidReturnTransactionReport',
    async (
      _event,
      options: {
        startDate: Date;
        endDate: Date;
        voidedPage?: number;
        voidedPageSize?: number;
        returnedPage?: number;
        returnedPageSize?: number;
      }
    ) => {
      try {
        const result = await ReportService.getVoidReturnTransactionReport(options);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Error in reports:getVoidReturnTransactionReport handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  logger.info('Reports IPC handlers registered');
}

