import {
  SalesReportData,
  InventoryReportData,
  FinancialReportData,
  CashFlowReportData,
  ProfitByProductCategoryReport,
  StockMovementReportData,
  ExpiryReportData,
  SalesComparisonReportData,
  VoidReturnTransactionReportData,
  PurchaseOrderReportData,
  SupplierPerformanceReport,
  ProductPerformanceReport,
  ScheduledReportService,
} from '../services/report.service';
import { formatCurrency, formatPercentage } from './formatters';
import { SettingsService, StoreInfo } from '../services/settings.service';

/**
 * Helper function to fetch store info
 */
async function getStoreInfo(userId?: number): Promise<StoreInfo | null> {
  try {
    // Use a default userId if not provided (for cases where user context isn't available)
    const result = await SettingsService.getStoreInfo(userId || 1);
    if (result.success && result.storeInfo) {
      return result.storeInfo;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Export data to CSV format
 */
export async function exportToCSV(data: Record<string, unknown>[], filename: string): Promise<void> {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Handle values that might contain commas or quotes
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    ),
  ].join('\n');

  // Save to exported reports folder
  try {
    const result = await ScheduledReportService.saveExportedReport(filename, csvContent, 'csv');
    if (result.success && result.path) {
      // Open the exported file
      try {
        await window.electron.ipcRenderer.invoke('file:open', result.path);
      } catch (openError) {
        console.error('Error opening exported file:', openError);
        // Still show success message even if opening fails
        alert(`Report exported successfully to: ${result.path}`);
      }
    } else {
      alert(`Failed to export report: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error exporting CSV:', error);
    alert('Failed to export report. Please try again.');
  }
}

/**
 * Export sales report to CSV
 */
export async function exportSalesReportToCSV(reportData: SalesReportData, dateRange: { startDate: Date; endDate: Date }): Promise<void> {
  const data: Record<string, unknown>[] = [];

  // Summary row
  data.push({
    Metric: 'Total Sales',
    Value: reportData.totalSales.toFixed(2),
  });
  data.push({
    Metric: 'Total Transactions',
    Value: reportData.totalTransactions,
  });
  data.push({
    Metric: 'Total Items',
    Value: reportData.totalItems,
  });
  data.push({
    Metric: 'Total Discount',
    Value: reportData.totalDiscount.toFixed(2),
  });
  data.push({
    Metric: 'Total Tax',
    Value: reportData.totalTax.toFixed(2),
  });
  data.push({
    Metric: 'Average Transaction Value',
    Value: reportData.averageTransactionValue.toFixed(2),
  });
  data.push({ Metric: '', Value: '' }); // Empty row

  // Top Products
  if (reportData.topProducts && reportData.topProducts.length > 0) {
    data.push({ Metric: 'Top Products', Value: '' });
    data.push({ Metric: 'Product Name', Value: 'Quantity', Revenue: 'Revenue' });
    reportData.topProducts.forEach((product) => {
      data.push({
        Metric: product.productName,
        Value: product.quantity,
        Revenue: product.revenue.toFixed(2),
      });
    });
    data.push({ Metric: '', Value: '' }); // Empty row
  }

  // Sales by Cashier
  if (reportData.salesByCashier && reportData.salesByCashier.length > 0) {
    data.push({ Metric: 'Sales by Cashier', Value: '' });
    data.push({ Metric: 'Cashier Name', Value: 'Transactions', Revenue: 'Sales' });
    reportData.salesByCashier.forEach((cashier) => {
      data.push({
        Metric: cashier.cashierName,
        Value: cashier.transactions,
        Revenue: cashier.sales.toFixed(2),
      });
    });
  }

  const filename = `sales-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  await exportToCSV(data, filename);
}

/**
 * Export inventory report to CSV
 */
export async function exportInventoryReportToCSV(reportData: InventoryReportData): Promise<void> {
  if (!reportData.items || reportData.items.length === 0) {
    alert('No inventory data to export');
    return;
  }

  const data = reportData.items.map((item) => ({
    'Product Code': item.productCode,
    'Product Name': item.productName,
    Category: item.categoryName || 'N/A',
    Quantity: item.quantity,
    'Reorder Level': item.reorderLevel,
    'Unit Price': item.unitPrice.toFixed(2),
    'Stock Value': item.stockValue.toFixed(2),
    Status: item.quantity <= 0 ? 'Out of Stock' : item.quantity <= item.reorderLevel ? 'Low Stock' : 'In Stock',
  }));

  const filename = `inventory-report-${new Date().toISOString().split('T')[0]}`;
  exportToCSV(data, filename);
}

/**
 * Export financial report to CSV
 */
export async function exportFinancialReportToCSV(reportData: FinancialReportData, dateRange: { startDate: Date; endDate: Date }): Promise<void> {
  const data = [
    { Metric: 'Revenue', Value: reportData.revenue.toFixed(2) },
    { Metric: 'Cost of Goods Sold (COGS)', Value: reportData.costOfGoodsSold.toFixed(2) },
    { Metric: 'Gross Profit', Value: reportData.grossProfit.toFixed(2) },
    { Metric: 'Gross Profit Margin', Value: `${reportData.grossProfitMargin.toFixed(2)}%` },
    { Metric: 'Total Discounts', Value: reportData.totalDiscounts.toFixed(2) },
    { Metric: 'Total Tax', Value: reportData.totalTax.toFixed(2) },
    { Metric: 'Net Profit', Value: reportData.netProfit.toFixed(2) },
    { Metric: 'Net Profit Margin', Value: `${reportData.netProfitMargin.toFixed(2)}%` },
  ];

  const filename = `financial-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  exportToCSV(data, filename);
}

/**
 * Export chart data to CSV
 */
export async function exportChartDataToCSV(data: Record<string, unknown>[], filename: string): Promise<void> {
  await exportToCSV(data, filename);
}

/**
 * Export data to Excel format
 */
export async function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName: string = 'Sheet1'
): Promise<void> {
  try {
    // Dynamic import to avoid loading in main bundle
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    
    // Add headers
    worksheet.addRow(headers);
    
    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data rows
    data.forEach((row) => {
      const values = headers.map((header) => row[header] ?? '');
      worksheet.addRow(values);
    });

    // Auto-fit columns
    headers.forEach((header, index) => {
      const column = worksheet.getColumn(index + 1);
      let maxLength = header.length;
      data.forEach((row) => {
        const value = String(row[header] ?? '');
        if (value.length > maxLength) {
          maxLength = value.length;
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    // Save to exported reports folder
    const buffer = await workbook.xlsx.writeBuffer();
    try {
      // Convert Buffer to Uint8Array
      const uint8Array = new Uint8Array(buffer);
      const result = await ScheduledReportService.saveExportedReport(filename, uint8Array, 'xlsx');
      if (result.success && result.path) {
        // Open the exported file
        try {
          await window.electron.ipcRenderer.invoke('file:open', result.path);
        } catch (openError) {
          console.error('Error opening exported file:', openError);
          // Still show success message even if opening fails
          alert(`Report exported successfully to: ${result.path}`);
        }
      } else {
        alert(`Failed to export report: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving Excel file:', error);
      alert('Failed to export report. Please try again.');
    }
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Failed to export to Excel. Please try CSV export instead.');
  }
}

/**
 * Export sales report to Excel
 */
export async function exportSalesReportToExcel(
  reportData: SalesReportData,
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const data: Record<string, unknown>[] = [];

  // Summary
  data.push({ Metric: 'Total Sales', Value: reportData.totalSales.toFixed(2) });
  data.push({ Metric: 'Total Transactions', Value: reportData.totalTransactions });
  data.push({ Metric: 'Total Items', Value: reportData.totalItems });
  data.push({ Metric: 'Total Discount', Value: reportData.totalDiscount.toFixed(2) });
  data.push({ Metric: 'Total Tax', Value: reportData.totalTax.toFixed(2) });
  data.push({ Metric: 'Average Transaction Value', Value: reportData.averageTransactionValue.toFixed(2) });
  data.push({ Metric: '', Value: '' });

  // Top Products
  if (reportData.topProducts && reportData.topProducts.length > 0) {
    data.push({ Metric: 'Top Products', Value: '', Revenue: '' });
    data.push({ Metric: 'Product Name', Value: 'Quantity', Revenue: 'Revenue' });
    reportData.topProducts.forEach((product) => {
      data.push({
        Metric: product.productName,
        Value: product.quantity,
        Revenue: product.revenue.toFixed(2),
      });
    });
    data.push({ Metric: '', Value: '', Revenue: '' });
  }

  // Sales by Cashier
  if (reportData.salesByCashier && reportData.salesByCashier.length > 0) {
    data.push({ Metric: 'Sales by Cashier', Value: '', Revenue: '' });
    data.push({ Metric: 'Cashier Name', Value: 'Transactions', Revenue: 'Sales' });
    reportData.salesByCashier.forEach((cashier) => {
      data.push({
        Metric: cashier.cashierName,
        Value: cashier.transactions,
        Revenue: cashier.sales.toFixed(2),
      });
    });
  }

  const filename = `sales-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  await exportToExcel(data, filename, 'Sales Report');
}

/**
 * Export inventory report to Excel
 */
export async function exportInventoryReportToExcel(reportData: InventoryReportData): Promise<void> {
  if (!reportData.items || reportData.items.length === 0) {
    alert('No inventory data to export');
    return;
  }

  const data = reportData.items.map((item) => ({
    'Product Code': item.productCode,
    'Product Name': item.productName,
    Category: item.categoryName || 'N/A',
    Quantity: item.quantity,
    'Reorder Level': item.reorderLevel,
    'Unit Price': item.unitPrice.toFixed(2),
    'Stock Value': item.stockValue.toFixed(2),
    Status: item.quantity <= 0 ? 'Out of Stock' : item.quantity <= item.reorderLevel ? 'Low Stock' : 'In Stock',
  }));

  const filename = `inventory-report-${new Date().toISOString().split('T')[0]}`;
  await exportToExcel(data, filename, 'Inventory Report');
}

/**
 * Export financial report to Excel
 */
export async function exportFinancialReportToExcel(
  reportData: FinancialReportData,
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const data = [
    { Metric: 'Revenue', Value: reportData.revenue.toFixed(2) },
    { Metric: 'Cost of Goods Sold (COGS)', Value: reportData.costOfGoodsSold.toFixed(2) },
    { Metric: 'Gross Profit', Value: reportData.grossProfit.toFixed(2) },
    { Metric: 'Gross Profit Margin', Value: `${reportData.grossProfitMargin.toFixed(2)}%` },
    { Metric: 'Total Discounts', Value: reportData.totalDiscounts.toFixed(2) },
    { Metric: 'Total Tax', Value: reportData.totalTax.toFixed(2) },
    { Metric: 'Net Profit', Value: reportData.netProfit.toFixed(2) },
    { Metric: 'Net Profit Margin', Value: `${reportData.netProfitMargin.toFixed(2)}%` },
  ];

  const filename = `financial-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  await exportToExcel(data, filename, 'Financial Report');
}

/**
 * Export data to PDF format using jsPDF with professional styling
 */
export async function exportToPDF(
  title: string,
  data: Record<string, unknown>[],
  filename: string,
  headers?: string[],
  storeInfo?: StoreInfo | null
): Promise<void> {
  try {
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const headerHeight = 80;
    let yPos = headerHeight;

    // Professional color scheme
    const primaryColor = [26, 35, 126]; // #1a237e
    const secondaryColor = [245, 245, 245]; // #f5f5f5
    const textColor = [33, 33, 33]; // #212121
    const lightGray = [224, 224, 224]; // #e0e0e0

    // Draw header background
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    // Add store logo if available
    if (storeInfo?.logo) {
      try {
        const logoUrl = storeInfo.logo; // Store in local variable for type safety
        const img = new Image();
        img.src = logoUrl;
        await new Promise<void>((resolve) => {
          img.onload = () => {
            try {
              // Calculate logo dimensions (max 50px height, maintain aspect ratio)
              const maxLogoHeight = 50;
              const logoWidth = (img.width / img.height) * maxLogoHeight;
              const logoX = margin;
              const logoY = 15;
              
              doc.addImage(logoUrl, 'PNG', logoX, logoY, logoWidth, maxLogoHeight);
              resolve();
            } catch {
              resolve(); // Continue without logo
            }
          };
          img.onerror = () => {
            resolve(); // Continue without logo
          };
        });
      } catch {
        // Continue without logo
      }
    }

    // Store information (right-aligned in header)
    const storeInfoX = pageWidth - margin;
    let storeInfoY = 20;
    doc.setTextColor(255, 255, 255); // White text
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    
    if (storeInfo?.name) {
      doc.text(storeInfo.name, storeInfoX, storeInfoY, { align: 'right' });
      storeInfoY += 8;
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (storeInfo?.address) {
      doc.text(storeInfo.address, storeInfoX, storeInfoY, { align: 'right' });
      storeInfoY += 6;
    }
    
    if (storeInfo?.phone) {
      doc.text(`Phone: ${storeInfo.phone}`, storeInfoX, storeInfoY, { align: 'right' });
      storeInfoY += 6;
    }

    // Report title (centered, below header)
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    const titleY = headerHeight + 20;
    doc.text(title, pageWidth / 2, titleY, { align: 'center' });

    // Report metadata
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const generatedText = `Generated: ${new Date().toLocaleString()}`;
    doc.text(generatedText, pageWidth / 2, titleY + 10, { align: 'center' });

    yPos = titleY + 25;

    if (data.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text('No data available', pageWidth / 2, yPos, { align: 'center' });
      doc.save(`${filename}.pdf`);
      return;
    }

    // Get headers
    const tableHeaders = headers || Object.keys(data[0]);
    
    // Calculate column widths dynamically
    const availableWidth = pageWidth - 2 * margin;
    const colCount = tableHeaders.length;
    const colWidth = availableWidth / colCount;
    const rowHeight = 8;
    const headerRowHeight = 10;

    // Table header background
    const headerY = yPos - headerRowHeight;
    doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.rect(margin, headerY, availableWidth, headerRowHeight, 'F');

    // Draw header border
    doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.setLineWidth(0.5);
    doc.rect(margin, headerY, availableWidth, headerRowHeight);

    // Add table headers
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    tableHeaders.forEach((header, index) => {
      const xPos = margin + index * colWidth + 3;
      doc.text(header, xPos, headerY + 7);
    });

    yPos = headerY + headerRowHeight;

    // Add data rows with alternating row colors
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let rowIndex = 0;
    
    data.forEach((row) => {
      // Check if we need a new page
      if (yPos + rowHeight > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
        
        // Redraw header on new page
        const newHeaderY = yPos;
        doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.rect(margin, newHeaderY, availableWidth, headerRowHeight, 'F');
        doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.rect(margin, newHeaderY, availableWidth, headerRowHeight);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        tableHeaders.forEach((header, index) => {
          const xPos = margin + index * colWidth + 3;
          doc.text(header, xPos, newHeaderY + 7);
        });
        yPos = newHeaderY + headerRowHeight;
      }

      // Alternate row background color
      if (rowIndex % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(250, 250, 250);
      }
      doc.rect(margin, yPos, availableWidth, rowHeight, 'F');

      // Draw row border
      doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos + rowHeight, pageWidth - margin, yPos + rowHeight);

      // Add cell content
      doc.setFontSize(10);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      tableHeaders.forEach((header, index) => {
        const value = String(row[header] ?? '');
        const xPos = margin + index * colWidth + 3;
        const maxWidth = colWidth - 6;
        
        // Handle long text with word wrapping
        const lines = doc.splitTextToSize(value, maxWidth);
        doc.text(lines[0] || '', xPos, yPos + 6);
      });

      yPos += rowHeight;
      rowIndex++;
    });

    // Add footer on each page
    const addFooter = (pageNum: number, totalPages: number) => {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      const footerY = pageHeight - 10;
      doc.text(
        `Page ${pageNum} of ${totalPages}`,
        pageWidth / 2,
        footerY,
        { align: 'center' }
      );
    };

    // Get total pages and add footers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(i, totalPages);
    }

    // Get PDF as buffer and save to exported reports folder
    const pdfBuffer = doc.output('arraybuffer');
    try {
      const result = await ScheduledReportService.saveExportedReport(filename, new Uint8Array(pdfBuffer), 'pdf');
      if (result.success && result.path) {
        // Open the exported file
        try {
          await window.electron.ipcRenderer.invoke('file:open', result.path);
        } catch (openError) {
          console.error('Error opening exported file:', openError);
          // Still show success message even if opening fails
          alert(`Report exported successfully to: ${result.path}`);
        }
      } else {
        alert(`Failed to export report: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving PDF file:', error);
      alert('Failed to export report. Please try again.');
    }
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    alert('Failed to export to PDF. Please try CSV or Excel export instead.');
  }
}

/**
 * Export sales report to PDF
 */
export async function exportSalesReportToPDF(
  reportData: SalesReportData,
  dateRange: { startDate: Date; endDate: Date },
  userId?: number
): Promise<void> {
  const data: Record<string, unknown>[] = [];

  // Summary
  data.push({ Metric: 'Total Sales', Value: formatCurrency(reportData.totalSales) });
  data.push({ Metric: 'Total Transactions', Value: reportData.totalTransactions });
  data.push({ Metric: 'Total Items', Value: reportData.totalItems });
  data.push({ Metric: 'Total Discount', Value: formatCurrency(reportData.totalDiscount) });
  data.push({ Metric: 'Total Tax', Value: formatCurrency(reportData.totalTax) });
  data.push({ Metric: 'Average Transaction Value', Value: formatCurrency(reportData.averageTransactionValue) });

  const filename = `sales-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  const title = `Sales Report (${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()})`;
  const storeInfo = await getStoreInfo(userId);
  await exportToPDF(title, data, filename, ['Metric', 'Value'], storeInfo);
}

/**
 * Export inventory report to PDF
 */
export async function exportInventoryReportToPDF(
  reportData: InventoryReportData,
  userId?: number
): Promise<void> {
  if (!reportData.items || reportData.items.length === 0) {
    alert('No inventory data to export');
    return;
  }

  const data = reportData.items.map((item) => ({
    'Product Code': item.productCode,
    'Product Name': item.productName,
    Category: item.categoryName || 'N/A',
    Quantity: item.quantity,
    'Reorder Level': item.reorderLevel,
    'Unit Price': formatCurrency(item.unitPrice),
    'Stock Value': formatCurrency(item.stockValue),
    Status: item.quantity <= 0 ? 'Out of Stock' : item.quantity <= item.reorderLevel ? 'Low Stock' : 'In Stock',
  }));

  const filename = `inventory-report-${new Date().toISOString().split('T')[0]}`;
  const title = 'Inventory Report';
  const storeInfo = await getStoreInfo(userId);
  await exportToPDF(title, data, filename, undefined, storeInfo);
}

/**
 * Export financial report to PDF
 */
export async function exportFinancialReportToPDF(
  reportData: FinancialReportData,
  dateRange: { startDate: Date; endDate: Date },
  userId?: number
): Promise<void> {
  const data = [
    { Metric: 'Revenue', Value: formatCurrency(reportData.revenue) },
    { Metric: 'Cost of Goods Sold (COGS)', Value: formatCurrency(reportData.costOfGoodsSold) },
    { Metric: 'Gross Profit', Value: formatCurrency(reportData.grossProfit) },
    { Metric: 'Gross Profit Margin', Value: `${reportData.grossProfitMargin.toFixed(2)}%` },
    { Metric: 'Total Discounts', Value: formatCurrency(reportData.totalDiscounts) },
    { Metric: 'Total Tax', Value: formatCurrency(reportData.totalTax) },
    { Metric: 'Net Profit', Value: formatCurrency(reportData.netProfit) },
    { Metric: 'Net Profit Margin', Value: `${reportData.netProfitMargin.toFixed(2)}%` },
  ];

  const filename = `financial-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  const title = `Financial Report (${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()})`;
  const storeInfo = await getStoreInfo(userId);
  await exportToPDF(title, data, filename, ['Metric', 'Value'], storeInfo);
}

/**
 * Export cash flow report to CSV
 */
export async function exportCashFlowReportToCSV(
  reportData: CashFlowReportData,
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const data = [
    { Metric: 'Opening Balance', Value: formatCurrency(reportData.openingBalance) },
    { Metric: 'Cash Inflows - Sales', Value: formatCurrency(reportData.cashInflows.sales) },
    { Metric: 'Cash Inflows - Other', Value: formatCurrency(reportData.cashInflows.other) },
    { Metric: 'Total Cash Inflows', Value: formatCurrency(reportData.cashInflows.total) },
    { Metric: 'Cash Outflows - Purchases', Value: formatCurrency(reportData.cashOutflows.purchases) },
    { Metric: 'Cash Outflows - Supplier Payments', Value: formatCurrency(reportData.cashOutflows.supplierPayments) },
    { Metric: 'Cash Outflows - Other', Value: formatCurrency(reportData.cashOutflows.other) },
    { Metric: 'Total Cash Outflows', Value: formatCurrency(reportData.cashOutflows.total) },
    { Metric: 'Net Cash Flow', Value: formatCurrency(reportData.netCashFlow) },
    { Metric: 'Closing Balance', Value: formatCurrency(reportData.closingBalance) },
  ];

  if (reportData.dailyFlow && reportData.dailyFlow.length > 0) {
    data.push({ Metric: '', Value: '' });
    data.push({ Metric: 'Daily Cash Flow', Value: '' });
    reportData.dailyFlow.forEach((day) => {
      data.push({
        Metric: day.date.toLocaleDateString(),
        Value: `Inflows: ${formatCurrency(day.inflows)}, Outflows: ${formatCurrency(day.outflows)}, Net: ${formatCurrency(day.netFlow)}`,
      });
    });
  }

  const filename = `cash-flow-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  exportToCSV(data, filename);
}

/**
 * Export cash flow report to Excel
 */
export async function exportCashFlowReportToExcel(
  reportData: CashFlowReportData,
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Cash Flow Report');

  worksheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];

  worksheet.addRow({ metric: 'Opening Balance', value: formatCurrency(reportData.openingBalance) });
  worksheet.addRow({ metric: 'Cash Inflows - Sales', value: formatCurrency(reportData.cashInflows.sales) });
  worksheet.addRow({ metric: 'Cash Inflows - Other', value: formatCurrency(reportData.cashInflows.other) });
  worksheet.addRow({ metric: 'Total Cash Inflows', value: formatCurrency(reportData.cashInflows.total) });
  worksheet.addRow({ metric: 'Cash Outflows - Purchases', value: formatCurrency(reportData.cashOutflows.purchases) });
  worksheet.addRow({ metric: 'Cash Outflows - Supplier Payments', value: formatCurrency(reportData.cashOutflows.supplierPayments) });
  worksheet.addRow({ metric: 'Cash Outflows - Other', value: formatCurrency(reportData.cashOutflows.other) });
  worksheet.addRow({ metric: 'Total Cash Outflows', value: formatCurrency(reportData.cashOutflows.total) });
  worksheet.addRow({ metric: 'Net Cash Flow', value: formatCurrency(reportData.netCashFlow) });
  worksheet.addRow({ metric: 'Closing Balance', value: formatCurrency(reportData.closingBalance) });

  if (reportData.dailyFlow && reportData.dailyFlow.length > 0) {
    worksheet.addRow({});
    worksheet.addRow({ metric: 'Daily Cash Flow', value: '' });
    worksheet.addRow({ metric: 'Date', value: 'Inflows' });
    reportData.dailyFlow.forEach((day) => {
      worksheet.addRow({
        metric: day.date.toLocaleDateString(),
        value: formatCurrency(day.inflows),
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `cash-flow-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  try {
    // Convert Buffer to Uint8Array
    const uint8Array = new Uint8Array(buffer);
    const result = await ScheduledReportService.saveExportedReport(filename, uint8Array, 'xlsx');
    if (result.success && result.path) {
      // Open the exported file
      try {
        await window.electron.ipcRenderer.invoke('file:open', result.path);
      } catch (openError) {
        console.error('Error opening exported file:', openError);
        alert(`Report exported successfully to: ${result.path}`);
      }
    } else {
      alert(`Failed to export report: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error saving Excel file:', error);
    alert('Failed to export report. Please try again.');
  }
}

/**
 * Export cash flow report to PDF
 */
export async function exportCashFlowReportToPDF(
  reportData: CashFlowReportData,
  dateRange: { startDate: Date; endDate: Date },
  userId?: number
): Promise<void> {
  const data = [
    { Metric: 'Opening Balance', Value: formatCurrency(reportData.openingBalance) },
    { Metric: 'Cash Inflows - Sales', Value: formatCurrency(reportData.cashInflows.sales) },
    { Metric: 'Cash Inflows - Other', Value: formatCurrency(reportData.cashInflows.other) },
    { Metric: 'Total Cash Inflows', Value: formatCurrency(reportData.cashInflows.total) },
    { Metric: 'Cash Outflows - Purchases', Value: formatCurrency(reportData.cashOutflows.purchases) },
    { Metric: 'Cash Outflows - Supplier Payments', Value: formatCurrency(reportData.cashOutflows.supplierPayments) },
    { Metric: 'Cash Outflows - Other', Value: formatCurrency(reportData.cashOutflows.other) },
    { Metric: 'Total Cash Outflows', Value: formatCurrency(reportData.cashOutflows.total) },
    { Metric: 'Net Cash Flow', Value: formatCurrency(reportData.netCashFlow) },
    { Metric: 'Closing Balance', Value: formatCurrency(reportData.closingBalance) },
  ];

  const filename = `cash-flow-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  const title = `Cash Flow Report (${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()})`;
  const storeInfo = await getStoreInfo(userId);
  await exportToPDF(title, data, filename, ['Metric', 'Value'], storeInfo);
}

/**
 * Export profit by product/category report to CSV
 */
export async function exportProfitByCategoryReportToCSV(
  reportData: ProfitByProductCategoryReport[],
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const data = reportData.flatMap((category) => [
    {
      Category: category.categoryName || 'Uncategorized',
      'Total Revenue': formatCurrency(category.totalRevenue),
      'Total Cost': formatCurrency(category.totalCost),
      'Gross Profit': formatCurrency(category.grossProfit),
      'Gross Profit Margin': formatPercentage(category.grossProfitMargin),
      'Product Count': category.productCount,
    },
    ...(category.products || []).map((product) => ({
      Category: category.categoryName || 'Uncategorized',
      'Product Code': product.productCode,
      'Product Name': product.productName,
      Revenue: formatCurrency(product.revenue),
      Cost: formatCurrency(product.cost),
      Profit: formatCurrency(product.profit),
      'Profit Margin': formatPercentage(product.profitMargin),
    })),
  ]);

  const filename = `profit-by-category-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  exportToCSV(data, filename);
}

/**
 * Export profit by product/category report to Excel
 */
export async function exportProfitByCategoryReportToExcel(
  reportData: ProfitByProductCategoryReport[],
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Profit by Category');

  worksheet.columns = [
    { header: 'Category', key: 'category', width: 25 },
    { header: 'Product Code', key: 'productCode', width: 15 },
    { header: 'Product Name', key: 'productName', width: 30 },
    { header: 'Revenue', key: 'revenue', width: 15 },
    { header: 'Cost', key: 'cost', width: 15 },
    { header: 'Profit', key: 'profit', width: 15 },
    { header: 'Profit Margin', key: 'profitMargin', width: 15 },
  ];

  reportData.forEach((category) => {
    worksheet.addRow({
      category: category.categoryName || 'Uncategorized',
      productCode: 'TOTAL',
      productName: '',
      revenue: formatCurrency(category.totalRevenue),
      cost: formatCurrency(category.totalCost),
      profit: formatCurrency(category.grossProfit),
      profitMargin: formatPercentage(category.grossProfitMargin),
    });

    if (category.products && category.products.length > 0) {
      category.products.forEach((product) => {
        worksheet.addRow({
          category: '',
          productCode: product.productCode,
          productName: product.productName,
          revenue: formatCurrency(product.revenue),
          cost: formatCurrency(product.cost),
          profit: formatCurrency(product.profit),
          profitMargin: formatPercentage(product.profitMargin),
        });
      });
    }
    worksheet.addRow({});
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `profit-by-category-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  try {
    // Convert Buffer to Uint8Array
    const uint8Array = new Uint8Array(buffer);
    const result = await ScheduledReportService.saveExportedReport(filename, uint8Array, 'xlsx');
    if (result.success && result.path) {
      // Open the exported file
      try {
        await window.electron.ipcRenderer.invoke('file:open', result.path);
      } catch (openError) {
        console.error('Error opening exported file:', openError);
        alert(`Report exported successfully to: ${result.path}`);
      }
    } else {
      alert(`Failed to export report: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error saving Excel file:', error);
    alert('Failed to export report. Please try again.');
  }
}

/**
 * Export profit by product/category report to PDF
 */
export async function exportProfitByCategoryReportToPDF(
  reportData: ProfitByProductCategoryReport[],
  dateRange: { startDate: Date; endDate: Date },
  userId?: number
): Promise<void> {
  const data = reportData.flatMap((category) => [
    {
      Category: category.categoryName || 'Uncategorized',
      'Total Revenue': formatCurrency(category.totalRevenue),
      'Total Cost': formatCurrency(category.totalCost),
      'Gross Profit': formatCurrency(category.grossProfit),
      'Gross Profit Margin': formatPercentage(category.grossProfitMargin),
    },
    ...(category.products || []).map((product) => ({
      Category: category.categoryName || 'Uncategorized',
      'Product Code': product.productCode,
      'Product Name': product.productName,
      Revenue: formatCurrency(product.revenue),
      Cost: formatCurrency(product.cost),
      Profit: formatCurrency(product.profit),
      'Profit Margin': formatPercentage(product.profitMargin),
    })),
  ]);

  const filename = `profit-by-category-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  const title = `Profit by Product/Category Report (${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()})`;
  const storeInfo = await getStoreInfo(userId);
  await exportToPDF(title, data, filename, undefined, storeInfo);
}

/**
 * Export stock movement report to CSV
 */
export async function exportStockMovementReportToCSV(
  reportData: StockMovementReportData,
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const data = reportData.movements.map((movement) => ({
    Date: movement.timestamp.toLocaleString(),
    'Product Code': movement.productCode,
    'Product Name': movement.productName,
    Category: movement.categoryName || 'N/A',
    Type: movement.type,
    Quantity: movement.quantity,
    Reason: movement.reason || 'N/A',
    User: movement.userName || 'System',
  }));

  const filename = `stock-movement-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  exportToCSV(data, filename);
}

/**
 * Export stock movement report to Excel
 */
export async function exportStockMovementReportToExcel(
  reportData: StockMovementReportData,
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Stock Movements');

  worksheet.columns = [
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Product Code', key: 'productCode', width: 15 },
    { header: 'Product Name', key: 'productName', width: 30 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Quantity', key: 'quantity', width: 15 },
    { header: 'Reason', key: 'reason', width: 30 },
    { header: 'User', key: 'user', width: 20 },
  ];

  reportData.movements.forEach((movement) => {
    worksheet.addRow({
      date: movement.timestamp.toLocaleString(),
      productCode: movement.productCode,
      productName: movement.productName,
      category: movement.categoryName || 'N/A',
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason || 'N/A',
      user: movement.userName || 'System',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `stock-movement-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  try {
    // Convert Buffer to Uint8Array
    const uint8Array = new Uint8Array(buffer);
    const result = await ScheduledReportService.saveExportedReport(filename, uint8Array, 'xlsx');
    if (result.success && result.path) {
      // Open the exported file
      try {
        await window.electron.ipcRenderer.invoke('file:open', result.path);
      } catch (openError) {
        console.error('Error opening exported file:', openError);
        alert(`Report exported successfully to: ${result.path}`);
      }
    } else {
      alert(`Failed to export report: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error saving Excel file:', error);
    alert('Failed to export report. Please try again.');
  }
}

/**
 * Export stock movement report to PDF
 */
export async function exportStockMovementReportToPDF(
  reportData: StockMovementReportData,
  dateRange: { startDate: Date; endDate: Date },
  userId?: number
): Promise<void> {
  const data = reportData.movements.map((movement) => ({
    Date: movement.timestamp.toLocaleString(),
    'Product Code': movement.productCode,
    'Product Name': movement.productName,
    Category: movement.categoryName || 'N/A',
    Type: movement.type,
    Quantity: movement.quantity.toString(),
    Reason: movement.reason || 'N/A',
    User: movement.userName || 'System',
  }));

  const filename = `stock-movement-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  const title = `Stock Movement Report (${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()})`;
  const storeInfo = await getStoreInfo(userId);
  await exportToPDF(title, data, filename, undefined, storeInfo);
}

/**
 * Export expiry report to CSV
 */
export async function exportExpiryReportToCSV(
  reportData: ExpiryReportData,
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const data = reportData.products.map((product) => ({
    'Product Code': product.productCode,
    'Product Name': product.productName,
    Category: product.categoryName || 'N/A',
    'Current Stock': product.currentStock,
    'Expiry Date': product.expiryDate ? product.expiryDate.toLocaleDateString() : 'N/A',
    'Days Until Expiry': product.daysUntilExpiry !== null ? product.daysUntilExpiry : 'N/A',
    'Status': product.expiryStatus,
    'Historical Expired Qty': product.totalExpiredQuantity,
    'Historical Expiry Movements': product.expiryMovements,
  }));

  const filename = `expiry-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  exportToCSV(data, filename);
}

/**
 * Export expiry report to Excel
 */
export async function exportExpiryReportToExcel(
  reportData: ExpiryReportData,
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Expiry Report');

  worksheet.columns = [
    { header: 'Product Code', key: 'productCode', width: 15 },
    { header: 'Product Name', key: 'productName', width: 30 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Current Stock', key: 'currentStock', width: 15 },
    { header: 'Expiry Date', key: 'expiryDate', width: 15 },
    { header: 'Days Until Expiry', key: 'daysUntilExpiry', width: 18 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Historical Expired Qty', key: 'historicalExpired', width: 20 },
    { header: 'Historical Movements', key: 'expiryMovements', width: 18 },
  ];

  reportData.products.forEach((product) => {
    worksheet.addRow({
      productCode: product.productCode,
      productName: product.productName,
      category: product.categoryName || 'N/A',
      currentStock: product.currentStock,
      expiryDate: product.expiryDate ? product.expiryDate.toLocaleDateString() : 'N/A',
      daysUntilExpiry: product.daysUntilExpiry !== null ? product.daysUntilExpiry : 'N/A',
      status: product.expiryStatus.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      historicalExpired: product.totalExpiredQuantity,
      expiryMovements: product.expiryMovements,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `expiry-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  try {
    // Convert Buffer to Uint8Array
    const uint8Array = new Uint8Array(buffer);
    const result = await ScheduledReportService.saveExportedReport(filename, uint8Array, 'xlsx');
    if (result.success && result.path) {
      // Open the exported file
      try {
        await window.electron.ipcRenderer.invoke('file:open', result.path);
      } catch (openError) {
        console.error('Error opening exported file:', openError);
        alert(`Report exported successfully to: ${result.path}`);
      }
    } else {
      alert(`Failed to export report: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error saving Excel file:', error);
    alert('Failed to export report. Please try again.');
  }
}

/**
 * Export expiry report to PDF
 */
export async function exportExpiryReportToPDF(
  reportData: ExpiryReportData,
  dateRange: { startDate: Date; endDate: Date },
  userId?: number
): Promise<void> {
  const data = reportData.products.map((product) => ({
    'Product Code': product.productCode,
    'Product Name': product.productName,
    Category: product.categoryName || 'N/A',
    'Current Stock': product.currentStock.toString(),
    'Expiry Date': product.expiryDate ? product.expiryDate.toLocaleDateString() : 'N/A',
    'Days Until Expiry': product.daysUntilExpiry !== null ? product.daysUntilExpiry.toString() : 'N/A',
    'Status': product.expiryStatus.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    'Historical Expired Qty': product.totalExpiredQuantity.toString(),
    'Historical Movements': product.expiryMovements.toString(),
  }));

  const filename = `expiry-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  const title = `Expiry Report (${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()})`;
  const storeInfo = await getStoreInfo(userId);
  await exportToPDF(title, data, filename, undefined, storeInfo);
}

/**
 * Export sales comparison report to CSV
 */
export async function exportSalesComparisonReportToCSV(
  reportData: SalesComparisonReportData
): Promise<void> {
  const data = [
    {
      Metric: 'Period 1 Total Sales',
      Value: formatCurrency(reportData.period1.totalSales),
    },
    {
      Metric: 'Period 1 Transactions',
      Value: reportData.period1.transactionCount.toString(),
    },
    {
      Metric: 'Period 1 Avg Transaction',
      Value: formatCurrency(reportData.period1.averageTransactionValue),
    },
    {
      Metric: 'Period 2 Total Sales',
      Value: formatCurrency(reportData.period2.totalSales),
    },
    {
      Metric: 'Period 2 Transactions',
      Value: reportData.period2.transactionCount.toString(),
    },
    {
      Metric: 'Period 2 Avg Transaction',
      Value: formatCurrency(reportData.period2.averageTransactionValue),
    },
    {
      Metric: 'Sales Change',
      Value: formatCurrency(reportData.comparison.salesChange),
    },
    {
      Metric: 'Sales Change %',
      Value: formatPercentage(reportData.comparison.salesChangePercent),
    },
    {
      Metric: 'Transaction Count Change',
      Value: reportData.comparison.transactionCountChange.toString(),
    },
    {
      Metric: 'Transaction Count Change %',
      Value: formatPercentage(reportData.comparison.transactionCountChangePercent),
    },
  ];

  const filename = `sales-comparison-report-${new Date().toISOString().split('T')[0]}`;
  exportToCSV(data, filename);
}

/**
 * Export sales comparison report to Excel
 */
export async function exportSalesComparisonReportToExcel(
  reportData: SalesComparisonReportData
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales Comparison');

  worksheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Period 1', key: 'period1', width: 20 },
    { header: 'Period 2', key: 'period2', width: 20 },
    { header: 'Change', key: 'change', width: 20 },
    { header: 'Change %', key: 'changePercent', width: 15 },
  ];

  worksheet.addRow({
    metric: 'Total Sales',
    period1: formatCurrency(reportData.period1.totalSales),
    period2: formatCurrency(reportData.period2.totalSales),
    change: formatCurrency(reportData.comparison.salesChange),
    changePercent: formatPercentage(reportData.comparison.salesChangePercent),
  });

  worksheet.addRow({
    metric: 'Transaction Count',
    period1: reportData.period1.transactionCount.toString(),
    period2: reportData.period2.transactionCount.toString(),
    change: reportData.comparison.transactionCountChange.toString(),
    changePercent: formatPercentage(reportData.comparison.transactionCountChangePercent),
  });

  worksheet.addRow({
    metric: 'Average Transaction Value',
    period1: formatCurrency(reportData.period1.averageTransactionValue),
    period2: formatCurrency(reportData.period2.averageTransactionValue),
    change: formatCurrency(reportData.comparison.averageTransactionValueChange),
    changePercent: formatPercentage(reportData.comparison.averageTransactionValueChangePercent),
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `sales-comparison-report-${new Date().toISOString().split('T')[0]}`;
  try {
    // Convert Buffer to Uint8Array
    const uint8Array = new Uint8Array(buffer);
    const result = await ScheduledReportService.saveExportedReport(filename, uint8Array, 'xlsx');
    if (result.success && result.path) {
      // Open the exported file
      try {
        await window.electron.ipcRenderer.invoke('file:open', result.path);
      } catch (openError) {
        console.error('Error opening exported file:', openError);
        alert(`Report exported successfully to: ${result.path}`);
      }
    } else {
      alert(`Failed to export report: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error saving Excel file:', error);
    alert('Failed to export report. Please try again.');
  }
}

/**
 * Export sales comparison report to PDF
 */
export async function exportSalesComparisonReportToPDF(
  reportData: SalesComparisonReportData,
  userId?: number
): Promise<void> {
  const data = [
    { Metric: 'Period 1 Total Sales', Value: formatCurrency(reportData.period1.totalSales) },
    { Metric: 'Period 1 Transactions', Value: reportData.period1.transactionCount.toString() },
    { Metric: 'Period 2 Total Sales', Value: formatCurrency(reportData.period2.totalSales) },
    { Metric: 'Period 2 Transactions', Value: reportData.period2.transactionCount.toString() },
    { Metric: 'Sales Change', Value: formatCurrency(reportData.comparison.salesChange) },
    { Metric: 'Sales Change %', Value: formatPercentage(reportData.comparison.salesChangePercent) },
  ];

  const filename = `sales-comparison-report-${new Date().toISOString().split('T')[0]}`;
  const title = 'Sales Comparison Report';
  const storeInfo = await getStoreInfo(userId);
  await exportToPDF(title, data, filename, ['Metric', 'Value'], storeInfo);
}

/**
 * Export void/return transaction report to CSV
 */
export async function exportVoidReturnTransactionReportToCSV(
  reportData: VoidReturnTransactionReportData,
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const data = [
    ...reportData.voidedTransactions.map((txn) => ({
      Type: 'Voided',
      'Transaction #': txn.transactionNumber,
      Amount: formatCurrency(txn.total),
      Cashier: txn.cashierName,
      Date: txn.createdAt.toLocaleString(),
    })),
    ...reportData.returnedTransactions.flatMap((txn) =>
      txn.items.map((item) => ({
        Type: 'Returned',
        'Transaction #': txn.transactionNumber,
        'Product Code': item.productCode,
        'Product Name': item.productName,
        Quantity: item.quantity,
        Amount: formatCurrency(item.total),
        Cashier: txn.cashierName,
        Date: txn.createdAt.toLocaleString(),
      }))
    ),
  ];

  const filename = `void-return-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  exportToCSV(data, filename);
}

/**
 * Export void/return transaction report to Excel
 */
export async function exportVoidReturnTransactionReportToExcel(
  reportData: VoidReturnTransactionReportData,
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  // Voided transactions sheet
  const voidedSheet = workbook.addWorksheet('Voided Transactions');
  voidedSheet.columns = [
    { header: 'Transaction #', key: 'transactionNumber', width: 20 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Cashier', key: 'cashier', width: 20 },
    { header: 'Date', key: 'date', width: 20 },
  ];

  reportData.voidedTransactions.forEach((txn) => {
    voidedSheet.addRow({
      transactionNumber: txn.transactionNumber,
      type: txn.type,
      amount: formatCurrency(txn.total),
      cashier: txn.cashierName,
      date: txn.createdAt.toLocaleString(),
    });
  });

  // Returned transactions sheet
  const returnedSheet = workbook.addWorksheet('Returned Transactions');
  returnedSheet.columns = [
    { header: 'Transaction #', key: 'transactionNumber', width: 20 },
    { header: 'Product Code', key: 'productCode', width: 15 },
    { header: 'Product Name', key: 'productName', width: 30 },
    { header: 'Quantity', key: 'quantity', width: 15 },
    { header: 'Price', key: 'price', width: 15 },
    { header: 'Total', key: 'total', width: 15 },
    { header: 'Cashier', key: 'cashier', width: 20 },
    { header: 'Date', key: 'date', width: 20 },
  ];

  reportData.returnedTransactions.forEach((txn) => {
    txn.items.forEach((item) => {
      returnedSheet.addRow({
        transactionNumber: txn.transactionNumber,
        productCode: item.productCode,
        productName: item.productName,
        quantity: item.quantity,
        price: formatCurrency(item.price),
        total: formatCurrency(item.total),
        cashier: txn.cashierName,
        date: txn.createdAt.toLocaleString(),
      });
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `void-return-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  try {
    // Convert Buffer to Uint8Array
    const uint8Array = new Uint8Array(buffer);
    const result = await ScheduledReportService.saveExportedReport(filename, uint8Array, 'xlsx');
    if (result.success && result.path) {
      // Open the exported file
      try {
        await window.electron.ipcRenderer.invoke('file:open', result.path);
      } catch (openError) {
        console.error('Error opening exported file:', openError);
        alert(`Report exported successfully to: ${result.path}`);
      }
    } else {
      alert(`Failed to export report: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error saving Excel file:', error);
    alert('Failed to export report. Please try again.');
  }
}

/**
 * Export void/return transaction report to PDF
 */
export async function exportVoidReturnTransactionReportToPDF(
  reportData: VoidReturnTransactionReportData,
  dateRange: { startDate: Date; endDate: Date },
  userId?: number
): Promise<void> {
  const data = [
    ...reportData.voidedTransactions.map((txn) => ({
      Type: 'Voided',
      'Transaction #': txn.transactionNumber,
      Amount: formatCurrency(txn.total),
      Cashier: txn.cashierName,
      Date: txn.createdAt.toLocaleString(),
    })),
    ...reportData.returnedTransactions.flatMap((txn) =>
      txn.items.map((item) => ({
        Type: 'Returned',
        'Transaction #': txn.transactionNumber,
        'Product': item.productName,
        Quantity: item.quantity.toString(),
        Amount: formatCurrency(item.total),
        Cashier: txn.cashierName,
        Date: txn.createdAt.toLocaleString(),
      }))
    ),
  ];

  const filename = `void-return-report-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  const title = `Void/Return Transaction Report (${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()})`;
  const storeInfo = await getStoreInfo(userId);
  await exportToPDF(title, data, filename, undefined, storeInfo);
}

/**
 * Export purchase order report to CSV
 */
export async function exportPurchaseOrderReportToCSV(
  reportData: PurchaseOrderReportData,
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const data: Record<string, unknown>[] = [];

  // Summary
  data.push({ Metric: 'Total Orders', Value: reportData.totalOrders });
  data.push({ Metric: 'Total Value', Value: formatCurrency(reportData.totalValue) });
  data.push({ Metric: '', Value: '' }); // Empty row

  // Orders by Status
  if (reportData.ordersByStatus && reportData.ordersByStatus.length > 0) {
    data.push({ Metric: 'Orders by Status', Value: '' });
    data.push({ Metric: 'Status', Value: 'Count', 'Total Value': 'Total Value' });
    reportData.ordersByStatus.forEach((status) => {
      data.push({
        Metric: status.status,
        Value: status.count,
        'Total Value': formatCurrency(status.value),
      });
    });
    data.push({ Metric: '', Value: '', 'Total Value': '' }); // Empty row
  }

  // Purchase Orders
  if (reportData.orders && reportData.orders.length > 0) {
    data.push({ Metric: 'Purchase Orders', Value: '' });
    data.push({
      'Order Number': 'Order Number',
      'Supplier Name': 'Supplier Name',
      'Order Date': 'Order Date',
      'Expected Date': 'Expected Date',
      'Received Date': 'Received Date',
      'Status': 'Status',
      'Total': 'Total',
    });
    reportData.orders.forEach((order) => {
      data.push({
        'Order Number': order.orderNumber,
        'Supplier Name': order.supplierName,
        'Order Date': order.orderDate.toLocaleDateString(),
        'Expected Date': order.expectedDate?.toLocaleDateString() || 'N/A',
        'Received Date': order.receivedDate?.toLocaleDateString() || 'N/A',
        'Status': order.status,
        'Total': formatCurrency(order.total),
      });
    });
  }

  const filename = `purchase-orders-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  exportToCSV(data, filename);
}

/**
 * Export purchase order report to Excel
 */
export async function exportPurchaseOrderReportToExcel(
  reportData: PurchaseOrderReportData,
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();

  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  summarySheet.addRow({ metric: 'Total Orders', value: reportData.totalOrders });
  summarySheet.addRow({ metric: 'Total Value', value: formatCurrency(reportData.totalValue) });
  summarySheet.addRow({ metric: '', value: '' });

  // Orders by Status
  if (reportData.ordersByStatus && reportData.ordersByStatus.length > 0) {
    summarySheet.addRow({ metric: 'Orders by Status', value: '' });
    summarySheet.addRow({ metric: 'Status', value: 'Count' });
    reportData.ordersByStatus.forEach((status) => {
      summarySheet.addRow({ metric: status.status, value: status.count });
    });
  }

  // Purchase Orders sheet
  if (reportData.orders && reportData.orders.length > 0) {
    const ordersSheet = workbook.addWorksheet('Purchase Orders');
    ordersSheet.columns = [
      { header: 'Order Number', key: 'orderNumber', width: 20 },
      { header: 'Supplier Name', key: 'supplierName', width: 30 },
      { header: 'Order Date', key: 'orderDate', width: 15 },
      { header: 'Expected Date', key: 'expectedDate', width: 15 },
      { header: 'Received Date', key: 'receivedDate', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Total', key: 'total', width: 15 },
    ];

    reportData.orders.forEach((order) => {
      ordersSheet.addRow({
        orderNumber: order.orderNumber,
        supplierName: order.supplierName,
        orderDate: order.orderDate.toLocaleDateString(),
        expectedDate: order.expectedDate?.toLocaleDateString() || 'N/A',
        receivedDate: order.receivedDate?.toLocaleDateString() || 'N/A',
        status: order.status,
        total: formatCurrency(order.total),
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `purchase-orders-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  try {
    // Convert Buffer to Uint8Array
    const uint8Array = new Uint8Array(buffer);
    const result = await ScheduledReportService.saveExportedReport(filename, uint8Array, 'xlsx');
    if (result.success && result.path) {
      // Open the exported file
      try {
        await window.electron.ipcRenderer.invoke('file:open', result.path);
      } catch (openError) {
        console.error('Error opening exported file:', openError);
        alert(`Report exported successfully to: ${result.path}`);
      }
    } else {
      alert(`Failed to export report: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error saving Excel file:', error);
    alert('Failed to export report. Please try again.');
  }
}

/**
 * Export purchase order report to PDF
 */
export async function exportPurchaseOrderReportToPDF(
  reportData: PurchaseOrderReportData,
  dateRange: { startDate: Date; endDate: Date },
  userId?: number
): Promise<void> {
  const data: Record<string, unknown>[] = [];

  // Summary
  data.push({ Metric: 'Total Orders', Value: reportData.totalOrders.toString() });
  data.push({ Metric: 'Total Value', Value: formatCurrency(reportData.totalValue) });

  // Orders by Status
  if (reportData.ordersByStatus && reportData.ordersByStatus.length > 0) {
    data.push({ Metric: '', Value: '' });
    reportData.ordersByStatus.forEach((status) => {
      data.push({
        Metric: `Status: ${status.status}`,
        Value: `Count: ${status.count}, Value: ${formatCurrency(status.value)}`,
      });
    });
  }

  // Purchase Orders
  if (reportData.orders && reportData.orders.length > 0) {
    data.push({ Metric: '', Value: '' });
    reportData.orders.forEach((order) => {
      data.push({
        Metric: `Order: ${order.orderNumber}`,
        Value: `${order.supplierName} - ${formatCurrency(order.total)} - ${order.status}`,
      });
    });
  }

  const filename = `purchase-orders-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  const title = `Purchase Order Report (${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()})`;
  const storeInfo = await getStoreInfo(userId);
  await exportToPDF(title, data, filename, ['Metric', 'Value'], storeInfo);
}

/**
 * Export supplier performance report to CSV
 */
export async function exportSupplierPerformanceReportToCSV(
  suppliers: SupplierPerformanceReport[],
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const data = suppliers.map((s) => ({
    'Supplier Name': s.supplierName,
    'Total Orders': s.totalOrders,
    'Total Value': formatCurrency(s.totalValue),
    'Average Order Value': formatCurrency(s.averageOrderValue),
    'Orders Received': s.ordersReceived,
    'Orders Pending': s.ordersPending,
    'Total Paid': formatCurrency(s.totalPaid),
    'Total Outstanding': formatCurrency(s.totalOutstanding),
  }));

  const filename = `supplier-performance-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  exportToCSV(data, filename);
}

/**
 * Export supplier performance report to Excel
 */
export async function exportSupplierPerformanceReportToExcel(
  suppliers: SupplierPerformanceReport[],
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Supplier Performance');

  worksheet.columns = [
    { header: 'Supplier Name', key: 'supplierName', width: 30 },
    { header: 'Total Orders', key: 'totalOrders', width: 15 },
    { header: 'Total Value', key: 'totalValue', width: 15 },
    { header: 'Average Order Value', key: 'averageOrderValue', width: 20 },
    { header: 'Orders Received', key: 'ordersReceived', width: 15 },
    { header: 'Orders Pending', key: 'ordersPending', width: 15 },
    { header: 'Total Paid', key: 'totalPaid', width: 15 },
    { header: 'Total Outstanding', key: 'totalOutstanding', width: 18 },
  ];

  suppliers.forEach((supplier) => {
    worksheet.addRow({
      supplierName: supplier.supplierName,
      totalOrders: supplier.totalOrders,
      totalValue: formatCurrency(supplier.totalValue),
      averageOrderValue: formatCurrency(supplier.averageOrderValue),
      ordersReceived: supplier.ordersReceived,
      ordersPending: supplier.ordersPending,
      totalPaid: formatCurrency(supplier.totalPaid),
      totalOutstanding: formatCurrency(supplier.totalOutstanding),
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `supplier-performance-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  try {
    // Convert Buffer to Uint8Array
    const uint8Array = new Uint8Array(buffer);
    const result = await ScheduledReportService.saveExportedReport(filename, uint8Array, 'xlsx');
    if (result.success && result.path) {
      // Open the exported file
      try {
        await window.electron.ipcRenderer.invoke('file:open', result.path);
      } catch (openError) {
        console.error('Error opening exported file:', openError);
        alert(`Report exported successfully to: ${result.path}`);
      }
    } else {
      alert(`Failed to export report: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error saving Excel file:', error);
    alert('Failed to export report. Please try again.');
  }
}

/**
 * Export supplier performance report to PDF
 */
export async function exportSupplierPerformanceReportToPDF(
  suppliers: SupplierPerformanceReport[],
  dateRange: { startDate: Date; endDate: Date },
  userId?: number
): Promise<void> {
  const data = suppliers.map((s) => ({
    'Supplier Name': s.supplierName,
    'Total Orders': s.totalOrders.toString(),
    'Total Value': formatCurrency(s.totalValue),
    'Average Order Value': formatCurrency(s.averageOrderValue),
    'Orders Received': s.ordersReceived.toString(),
    'Orders Pending': s.ordersPending.toString(),
    'Total Paid': formatCurrency(s.totalPaid),
    'Total Outstanding': formatCurrency(s.totalOutstanding),
  }));

  const filename = `supplier-performance-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  const title = `Supplier Performance Report (${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()})`;
  const storeInfo = await getStoreInfo(userId);
  await exportToPDF(title, data, filename, undefined, storeInfo);
}

/**
 * Export product performance report to CSV
 */
export async function exportProductPerformanceReportToCSV(
  products: ProductPerformanceReport[],
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const data = products.map((p) => ({
    'Product Code': p.productCode,
    'Product Name': p.productName,
    Category: p.categoryName || 'N/A',
    'Quantity Sold': p.totalQuantitySold,
    Revenue: p.totalRevenue.toFixed(2),
    Cost: p.totalCost.toFixed(2),
    Profit: p.profit.toFixed(2),
    'Profit Margin': `${p.profitMargin.toFixed(2)}%`,
    'Average Price': p.averagePrice.toFixed(2),
  }));

  const filename = `product-performance-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  exportToCSV(data, filename);
}

/**
 * Export product performance report to Excel
 */
export async function exportProductPerformanceReportToExcel(
  products: ProductPerformanceReport[],
  dateRange: { startDate: Date; endDate: Date }
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Product Performance');

  worksheet.columns = [
    { header: 'Product Code', key: 'productCode', width: 15 },
    { header: 'Product Name', key: 'productName', width: 30 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Quantity Sold', key: 'quantitySold', width: 15 },
    { header: 'Revenue', key: 'revenue', width: 15 },
    { header: 'Cost', key: 'cost', width: 15 },
    { header: 'Profit', key: 'profit', width: 15 },
    { header: 'Profit Margin', key: 'profitMargin', width: 15 },
    { header: 'Average Price', key: 'averagePrice', width: 15 },
  ];

  products.forEach((product) => {
    worksheet.addRow({
      productCode: product.productCode,
      productName: product.productName,
      category: product.categoryName || 'N/A',
      quantitySold: product.totalQuantitySold,
      revenue: formatCurrency(product.totalRevenue),
      cost: formatCurrency(product.totalCost),
      profit: formatCurrency(product.profit),
      profitMargin: `${formatPercentage(product.profitMargin)}`,
      averagePrice: formatCurrency(product.averagePrice),
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `product-performance-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  try {
    // Convert Buffer to Uint8Array
    const uint8Array = new Uint8Array(buffer);
    const result = await ScheduledReportService.saveExportedReport(filename, uint8Array, 'xlsx');
    if (result.success && result.path) {
      // Open the exported file
      try {
        await window.electron.ipcRenderer.invoke('file:open', result.path);
      } catch (openError) {
        console.error('Error opening exported file:', openError);
        alert(`Report exported successfully to: ${result.path}`);
      }
    } else {
      alert(`Failed to export report: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error saving Excel file:', error);
    alert('Failed to export report. Please try again.');
  }
}

/**
 * Export product performance report to PDF
 */
export async function exportProductPerformanceReportToPDF(
  products: ProductPerformanceReport[],
  dateRange: { startDate: Date; endDate: Date },
  userId?: number
): Promise<void> {
  const data = products.map((p) => ({
    'Product Code': p.productCode,
    'Product Name': p.productName,
    Category: p.categoryName || 'N/A',
    'Quantity Sold': p.totalQuantitySold.toString(),
    Revenue: formatCurrency(p.totalRevenue),
    Cost: formatCurrency(p.totalCost),
    Profit: formatCurrency(p.profit),
    'Profit Margin': formatPercentage(p.profitMargin),
    'Average Price': formatCurrency(p.averagePrice),
  }));

  const filename = `product-performance-${dateRange.startDate.toISOString().split('T')[0]}-to-${dateRange.endDate.toISOString().split('T')[0]}`;
  const title = `Product Performance Report (${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()})`;
  const storeInfo = await getStoreInfo(userId);
  await exportToPDF(title, data, filename, undefined, storeInfo);
}

