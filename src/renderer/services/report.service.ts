// Report Types
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface OptionalDateRange {
  startDate: Date | null;
  endDate: Date | null;
}

export interface SalesReportOptions extends DateRange {
  cashierId?: number;
  productId?: number;
  categoryId?: number;
  groupBy?: 'day' | 'week' | 'month' | 'year';
  salesByCashierPage?: number;
  salesByCashierPageSize?: number;
}

export interface SalesReportData {
  totalSales: number;
  totalTransactions: number;
  totalItems: number;
  totalDiscount: number;
  totalTax: number;
  averageTransactionValue: number;
  breakdown?: Array<{
    period: string;
    sales: number;
    transactions: number;
    items: number;
  }>;
  topProducts?: Array<{
    productId: number;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  salesByCashier?: Array<{
    cashierId: number;
    cashierName: string;
    sales: number;
    transactions: number;
  }>;
  salesByCashierPagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface DailySalesStats {
  date: Date;
  totalSales: number;
  totalTransactions: number;
  totalItems: number;
  averageTransactionValue: number;
}

export interface TopSellingProduct {
  productId: number;
  productName: string;
  productCode: string;
  categoryName: string | null;
  quantitySold: number;
  revenue: number;
  averagePrice: number;
}

export interface SlowMovingProduct {
  productId: number;
  productName: string;
  productCode: string;
  categoryName: string | null;
  quantitySold: number;
  revenue: number;
  lastSoldDate: Date | null;
  daysSinceLastSale: number | null;
}

export interface InventoryReportData {
  totalProducts: number;
  totalStockValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  items?: Array<{
    productId: number;
    productName: string;
    productCode: string;
    categoryName: string | null;
    quantity: number;
    reorderLevel: number;
    stockValue: number;
    unitPrice: number;
  }>;
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface FinancialReportData {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossProfitMargin: number;
  totalDiscounts: number;
  totalTax: number;
  netProfit: number;
  netProfitMargin: number;
}

export interface SalesReportResult {
  success: boolean;
  data?: SalesReportData;
  error?: string;
}

export interface DailySalesStatsResult {
  success: boolean;
  data?: DailySalesStats[];
  error?: string;
}

export interface TopSellingProductsResult {
  success: boolean;
  data?: TopSellingProduct[];
  error?: string;
}

export interface SlowMovingProductsResult {
  success: boolean;
  data?: SlowMovingProduct[];
  error?: string;
}

export interface InventoryReportResult {
  success: boolean;
  data?: InventoryReportData;
  error?: string;
}

export interface FinancialReportResult {
  success: boolean;
  data?: FinancialReportData;
  error?: string;
}

export interface ProductPerformanceReportOptions extends DateRange {
  page?: number;
  pageSize?: number;
}

export interface ProductPerformanceReport {
  productId: number;
  productName: string;
  productCode: string;
  categoryName: string | null;
  totalQuantitySold: number;
  totalRevenue: number;
  averagePrice: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  firstSaleDate: Date | null;
  lastSaleDate: Date | null;
}

export interface ProductPerformanceReportData {
  products: ProductPerformanceReport[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ProductSalesHistory {
  productId: number;
  productName: string;
  productCode: string;
  sales: Array<{
    date: Date;
    quantity: number;
    revenue: number;
    transactions: number;
  }>;
}

export interface PriceHistoryReport {
  productId: number;
  productName: string;
  productCode: string;
  priceChanges: Array<{
    oldPrice: number;
    newPrice: number;
    changedBy: string;
    changedAt: Date;
  }>;
}

export interface PurchaseOrderReportOptions extends DateRange {
  ordersByStatusPage?: number;
  ordersByStatusPageSize?: number;
  ordersPage?: number;
  ordersPageSize?: number;
}

export interface PurchaseOrderReportData {
  totalOrders: number;
  totalValue: number;
  ordersByStatus: Array<{
    status: string;
    count: number;
    value: number;
  }>;
  ordersByStatusPagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  orders?: Array<{
    orderNumber: string;
    supplierName: string;
    orderDate: Date;
    expectedDate: Date | null;
    receivedDate: Date | null;
    status: string;
    total: number;
  }>;
  ordersPagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface SupplierPerformanceReportOptions extends DateRange {
  page?: number;
  pageSize?: number;
}

export interface SupplierPerformanceReport {
  supplierId: number;
  supplierName: string;
  totalOrders: number;
  totalValue: number;
  averageOrderValue: number;
  ordersReceived: number;
  ordersPending: number;
  totalPaid: number;
  totalOutstanding: number;
  lastOrderDate: Date | null;
}

export interface SupplierPerformanceReportData {
  suppliers: SupplierPerformanceReport[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface SupplierPaymentReport {
  supplierId: number;
  supplierName: string;
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  invoices?: Array<{
    invoiceNumber: string;
    purchaseOrderNumber: string;
    amount: number;
    dueDate: Date | null;
    paidDate: Date | null;
    status: string;
  }>;
}

export interface ReceivingReportData {
  totalReceivings: number;
  totalQuantityReceived: number;
  totalValue: number;
  receivings: Array<{
    id: number;
    purchaseOrderId: number;
    purchaseOrderNumber: string;
    supplierName: string;
    productId: number;
    productName: string;
    productCode: string;
    quantityReceived: number;
    unitPrice: number;
    subtotal: number;
    receivedBy: string | null;
    receivedAt: Date;
  }>;
  summaryByProduct?: Array<{
    productId: number;
    productName: string;
    productCode: string;
    totalQuantity: number;
    totalValue: number;
    receivingCount: number;
  }>;
  summaryBySupplier?: Array<{
    supplierId: number;
    supplierName: string;
    totalQuantity: number;
    totalValue: number;
    receivingCount: number;
  }>;
}

export interface CashFlowReportData {
  openingBalance: number;
  cashInflows: {
    sales: number;
    other: number;
    total: number;
  };
  cashOutflows: {
    purchases: number;
    supplierPayments: number;
    other: number;
    total: number;
  };
  closingBalance: number;
  netCashFlow: number;
  dailyFlow?: Array<{
    date: Date;
    inflows: number;
    outflows: number;
    netFlow: number;
  }>;
  dailyFlowPagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ProfitByCategoryReportOptions extends DateRange {
  page?: number;
  pageSize?: number;
}

export interface ProfitByProductCategoryReport {
  categoryId: number | null;
  categoryName: string | null;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossProfitMargin: number;
  productCount: number;
  products?: Array<{
    productId: number;
    productName: string;
    productCode: string;
    revenue: number;
    cost: number;
    profit: number;
    profitMargin: number;
  }>;
}

export interface ProfitByCategoryReportData {
  categories: ProfitByProductCategoryReport[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface StockMovementReportData {
  movements: Array<{
    id: number;
    productId: number;
    productCode: string;
    productName: string;
    categoryName: string | null;
    type: string;
    quantity: number;
    reason: string | null;
    userId: number | null;
    userName: string | null;
    referenceId: number | null;
    timestamp: Date;
  }>;
  summary: {
    totalMovements: number;
    totalAdditions: number;
    totalDeductions: number;
    byType: Record<string, number>;
  };
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ExpiryReportData {
  products: Array<{
    productId: number;
    productCode: string;
    productName: string;
    categoryName: string | null;
    currentStock: number;
    expiryDate: Date | null; // Actual expiry date from inventory
    daysUntilExpiry: number | null; // Days until expiry (negative if expired)
    expiryStatus: 'expired' | 'expiring_soon' | 'expiring_later' | 'no_expiry';
    expiryMovements: number; // Historical expiry movements count
    totalExpiredQuantity: number; // Total quantity from historical expiry movements
  }>;
  summary: {
    totalProductsWithExpiry: number;
    totalExpiredProducts: number;
    totalExpiringSoon: number; // Products expiring within daysAhead
    totalExpiredQuantity: number; // From historical movements
    productsAtRisk: number; // Products with low stock and expiry dates
  };
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface SalesComparisonReportData {
  period1: {
    startDate: Date;
    endDate: Date;
    totalSales: number;
    transactionCount: number;
    averageTransactionValue: number;
    totalItemsSold: number;
    totalDiscounts: number;
    totalTax: number;
  };
  period2: {
    startDate: Date;
    endDate: Date;
    totalSales: number;
    transactionCount: number;
    averageTransactionValue: number;
    totalItemsSold: number;
    totalDiscounts: number;
    totalTax: number;
  };
  comparison: {
    salesChange: number;
    salesChangePercent: number;
    transactionCountChange: number;
    transactionCountChangePercent: number;
    averageTransactionValueChange: number;
    averageTransactionValueChangePercent: number;
    itemsSoldChange: number;
    itemsSoldChangePercent: number;
  };
}

export interface VoidReturnTransactionReportData {
  voidedTransactions: Array<{
    id: number;
    transactionNumber: string;
    type: string;
    total: number;
    cashierId: number;
    cashierName: string;
    createdAt: Date;
    updatedAt: Date;
    reason?: string;
  }>;
  returnedTransactions: Array<{
    id: number;
    transactionNumber: string;
    originalTransactionNumber: string | null;
    total: number;
    cashierId: number;
    cashierName: string;
    createdAt: Date;
    items: Array<{
      productCode: string;
      productName: string;
      quantity: number;
      price: number;
      total: number;
    }>;
  }>;
  summary: {
    totalVoided: number;
    totalVoidedAmount: number;
    totalReturned: number;
    totalReturnedAmount: number;
    voidedCount: number;
    returnedCount: number;
  };
  voidedPagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  returnedPagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * Report Service (Frontend)
 * Handles report generation via IPC
 */
export class ReportService {
  /**
   * Get sales report
   */
  static async getSalesReport(
    options: SalesReportOptions,
    userId: number
  ): Promise<SalesReportResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getSalesReport',
        options,
        userId
      ) as SalesReportResult;
      return result;
    } catch (error) {
      console.error('Error getting sales report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sales report',
      };
    }
  }

  /**
   * Get daily sales statistics
   */
  static async getDailySalesStats(
    dateRange: DateRange,
    userId: number
  ): Promise<DailySalesStatsResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getDailySalesStats',
        dateRange,
        userId
      ) as DailySalesStatsResult;
      return result;
    } catch (error) {
      console.error('Error getting daily sales stats', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get daily sales stats',
      };
    }
  }

  /**
   * Get top selling products
   */
  static async getTopSellingProducts(
    dateRange: DateRange,
    limit: number,
    userId: number
  ): Promise<TopSellingProductsResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getTopSellingProducts',
        dateRange,
        limit,
        userId
      ) as TopSellingProductsResult;
      return result;
    } catch (error) {
      console.error('Error getting top selling products', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get top selling products',
      };
    }
  }

  /**
   * Get slow moving products
   */
  static async getSlowMovingProducts(
    dateRange: DateRange,
    limit: number,
    userId: number
  ): Promise<SlowMovingProductsResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getSlowMovingProducts',
        dateRange,
        limit,
        userId
      ) as SlowMovingProductsResult;
      return result;
    } catch (error) {
      console.error('Error getting slow moving products', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get slow moving products',
      };
    }
  }

  /**
   * Get inventory report
   */
  static async getInventoryReport(
    options: {
      page?: number;
      pageSize?: number;
    },
    userId: number
  ): Promise<InventoryReportResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getInventoryReport',
        options,
        userId
      ) as InventoryReportResult;
      return result;
    } catch (error) {
      console.error('Error getting inventory report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get inventory report',
      };
    }
  }

  /**
   * Get financial report
   */
  static async getFinancialReport(
    dateRange: DateRange,
    userId: number
  ): Promise<FinancialReportResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getFinancialReport',
        dateRange,
        userId
      ) as FinancialReportResult;
      return result;
    } catch (error) {
      console.error('Error getting financial report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get financial report',
      };
    }
  }

  /**
   * Get product performance report
   */
  static async getProductPerformanceReport(
    options: ProductPerformanceReportOptions,
    userId: number
  ): Promise<{
    success: boolean;
    data?: ProductPerformanceReportData;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getProductPerformanceReport',
        options,
        userId
      ) as {
        success: boolean;
        data?: ProductPerformanceReportData;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting product performance report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get product performance report',
      };
    }
  }

  /**
   * Get product sales history
   */
  static async getProductSalesHistory(
    productId: number,
    dateRange: DateRange,
    userId: number
  ): Promise<{
    success: boolean;
    data?: ProductSalesHistory;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getProductSalesHistory',
        productId,
        dateRange,
        userId
      ) as {
        success: boolean;
        data?: ProductSalesHistory;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting product sales history', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get product sales history',
      };
    }
  }

  /**
   * Get price history report
   */
  static async getPriceHistoryReport(
    productId: number,
    userId: number
  ): Promise<{
    success: boolean;
    data?: PriceHistoryReport;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getPriceHistoryReport',
        productId,
        userId
      ) as {
        success: boolean;
        data?: PriceHistoryReport;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting price history report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get price history report',
      };
    }
  }

  /**
   * Get purchase order report
   */
  static async getPurchaseOrderReport(
    options: PurchaseOrderReportOptions,
    userId: number
  ): Promise<{
    success: boolean;
    data?: PurchaseOrderReportData;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getPurchaseOrderReport',
        options,
        userId
      ) as {
        success: boolean;
        data?: PurchaseOrderReportData;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting purchase order report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get purchase order report',
      };
    }
  }

  /**
   * Get supplier performance report
   */
  static async getSupplierPerformanceReport(
    options: SupplierPerformanceReportOptions,
    userId: number
  ): Promise<{
    success: boolean;
    data?: SupplierPerformanceReportData;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getSupplierPerformanceReport',
        options,
        userId
      ) as {
        success: boolean;
        data?: SupplierPerformanceReportData;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting supplier performance report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get supplier performance report',
      };
    }
  }

  /**
   * Get supplier payment report
   */
  static async getSupplierPaymentReport(
    supplierId: number,
    userId: number
  ): Promise<{
    success: boolean;
    data?: SupplierPaymentReport;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getSupplierPaymentReport',
        supplierId,
        userId
      ) as {
        success: boolean;
        data?: SupplierPaymentReport;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting supplier payment report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get supplier payment report',
      };
    }
  }

  /**
   * Get receiving report
   */
  static async getReceivingReport(
    dateRange: DateRange,
    userId: number
  ): Promise<{
    success: boolean;
    data?: ReceivingReportData;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getReceivingReport',
        dateRange,
        userId
      ) as {
        success: boolean;
        data?: ReceivingReportData;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting receiving report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get receiving report',
      };
    }
  }

  /**
   * Get cash flow report
   */
  static async getCashFlowReport(
    options: {
      startDate: Date;
      endDate: Date;
      openingBalance?: number;
      dailyFlowPage?: number;
      dailyFlowPageSize?: number;
    },
    userId: number
  ): Promise<{
    success: boolean;
    data?: CashFlowReportData;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getCashFlowReport',
        options,
        userId
      ) as {
        success: boolean;
        data?: CashFlowReportData;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting cash flow report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cash flow report',
      };
    }
  }

  /**
   * Get profit by product/category report
   */
  static async getProfitByProductCategoryReport(
    options: ProfitByCategoryReportOptions,
    userId: number
  ): Promise<{
    success: boolean;
    data?: ProfitByCategoryReportData;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getProfitByProductCategoryReport',
        options,
        userId
      ) as {
        success: boolean;
        data?: ProfitByCategoryReportData;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting profit by product/category report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get profit by product/category report',
      };
    }
  }

  /**
   * Get stock movement report
   */
  static async getStockMovementReport(
    options: {
      startDate: Date;
      endDate: Date;
      productId?: number;
      type?: string;
      page?: number;
      pageSize?: number;
    },
    userId: number
  ): Promise<{
    success: boolean;
    data?: StockMovementReportData;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getStockMovementReport',
        options,
        userId
      ) as {
        success: boolean;
        data?: StockMovementReportData;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting stock movement report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stock movement report',
      };
    }
  }

  /**
   * Get expiry report
   */
  static async getExpiryReport(
    options: {
      startDate: Date;
      endDate: Date;
      page?: number;
      pageSize?: number;
      daysAhead?: number;
      includeExpired?: boolean;
      includeHistorical?: boolean;
    },
    userId: number
  ): Promise<{
    success: boolean;
    data?: ExpiryReportData;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getExpiryReport',
        options,
        userId
      ) as {
        success: boolean;
        data?: ExpiryReportData;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting expiry report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get expiry report',
      };
    }
  }

  /**
   * Get sales comparison report (period over period)
   */
  static async getSalesComparisonReport(
    period1Range: DateRange,
    period2Range: DateRange,
    userId: number
  ): Promise<{
    success: boolean;
    data?: SalesComparisonReportData;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getSalesComparisonReport',
        period1Range,
        period2Range,
        userId
      ) as {
        success: boolean;
        data?: SalesComparisonReportData;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting sales comparison report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sales comparison report',
      };
    }
  }

  /**
   * Get void/return transaction report
   */
  static async getVoidReturnTransactionReport(
    options: {
      startDate: Date;
      endDate: Date;
      voidedPage?: number;
      voidedPageSize?: number;
      returnedPage?: number;
      returnedPageSize?: number;
    },
    userId: number
  ): Promise<{
    success: boolean;
    data?: VoidReturnTransactionReportData;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getVoidReturnTransactionReport',
        options,
        userId
      ) as {
        success: boolean;
        data?: VoidReturnTransactionReportData;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting void/return transaction report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get void/return transaction report',
      };
    }
  }
}

// Scheduled Report Types
export interface ScheduledReport {
  id: number;
  name: string;
  reportType: string;
  scheduleType: string;
  scheduleConfig: {
    cronExpression?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    time?: string;
  };
  dateRangeType: string;
  dateRangeConfig: {
    type: 'fixed' | 'relative';
    startDate?: string;
    endDate?: string;
    relativeType?: 'last7days' | 'last30days' | 'last90days' | 'thisMonth' | 'lastMonth' | 'thisYear';
  } | null;
  exportFormat: string;
  exportPath: string | null;
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduledReportInput {
  name: string;
  reportType: string;
  scheduleType: string;
  scheduleConfig: {
    cronExpression?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    time?: string;
  };
  dateRangeType: string;
  dateRangeConfig: {
    type: 'fixed' | 'relative';
    startDate?: string;
    endDate?: string;
    relativeType?: 'last7days' | 'last30days' | 'last90days' | 'thisMonth' | 'lastMonth' | 'thisYear';
  } | null;
  exportFormat: string;
  exportPath?: string;
}

export interface UpdateScheduledReportInput {
  name?: string;
  scheduleType?: string;
  scheduleConfig?: {
    cronExpression?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    time?: string;
  };
  dateRangeType?: string;
  dateRangeConfig?: {
    type: 'fixed' | 'relative';
    startDate?: string;
    endDate?: string;
    relativeType?: 'last7days' | 'last30days' | 'last90days' | 'thisMonth' | 'lastMonth' | 'thisYear';
  } | null;
  exportFormat?: string;
  exportPath?: string;
  isActive?: boolean;
}

/**
 * Scheduled Report Service (Frontend)
 * Handles scheduled report management via IPC
 */
export class ScheduledReportService {
  /**
   * Get all scheduled reports
   */
  static async getScheduledReports(
    userId: number,
    options?: { page?: number; pageSize?: number }
  ): Promise<{
    success: boolean;
    data?: ScheduledReport[];
    pagination?: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:getScheduledReports',
        userId,
        options
      ) as {
        success: boolean;
        data?: ScheduledReport[];
        pagination?: {
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
        };
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting scheduled reports', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scheduled reports',
      };
    }
  }

  /**
   * Create a new scheduled report
   */
  static async createScheduledReport(
    report: CreateScheduledReportInput,
    userId: number
  ): Promise<{
    success: boolean;
    data?: ScheduledReport;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:createScheduledReport',
        report,
        userId
      ) as {
        success: boolean;
        data?: ScheduledReport;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error creating scheduled report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create scheduled report',
      };
    }
  }

  /**
   * Update a scheduled report
   */
  static async updateScheduledReport(
    reportId: number,
    updates: UpdateScheduledReportInput,
    userId: number
  ): Promise<{
    success: boolean;
    data?: ScheduledReport;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:updateScheduledReport',
        reportId,
        updates,
        userId
      ) as {
        success: boolean;
        data?: ScheduledReport;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error updating scheduled report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update scheduled report',
      };
    }
  }

  /**
   * Delete a scheduled report
   */
  static async deleteScheduledReport(
    reportId: number,
    userId: number
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:deleteScheduledReport',
        reportId,
        userId
      ) as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error deleting scheduled report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete scheduled report',
      };
    }
  }

  /**
   * Execute a scheduled report immediately
   */
  static async executeScheduledReport(
    reportId: number,
    userId: number
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reports:executeScheduledReport',
        reportId,
        userId
      ) as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error executing scheduled report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute scheduled report',
      };
    }
  }

  /**
   * Get reports folder path
   */
  static async getReportsFolderPath(): Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('reports:getReportsFolderPath') as {
        success: boolean;
        path?: string;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting reports folder path', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get reports folder path',
      };
    }
  }

  /**
   * Open reports folder in file explorer
   */
  static async openReportsFolder(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('reports:openReportsFolder') as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error opening reports folder', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open reports folder',
      };
    }
  }

  /**
   * Open exported reports folder in file explorer
   */
  static async openExportedReportsFolder(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('reports:openExportedReportsFolder') as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error opening exported reports folder', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open exported reports folder',
      };
    }
  }

  /**
   * Save exported report file to exported reports folder
   */
  static async saveExportedReport(
    filename: string,
    content: Uint8Array | Buffer | string,
    fileType: 'csv' | 'xlsx' | 'pdf'
  ): Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }> {
    try {
      // Convert Buffer or Uint8Array to Uint8Array for IPC
      let buffer: Uint8Array | string;
      if (content instanceof Buffer) {
        buffer = new Uint8Array(content);
      } else if (content instanceof Uint8Array) {
        buffer = content;
      } else {
        buffer = content;
      }
      
      const result = await window.electron.ipcRenderer.invoke('reports:saveExportedReport', filename, buffer, fileType) as {
        success: boolean;
        path?: string;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error saving exported report', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save exported report',
      };
    }
  }
}

