import ExcelJS from 'exceljs';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../../utils/logger';
import { CreateProductInput, ProductWithRelations } from './product.service';
import { CategoryService } from '../category/category.service';
import { SupplierService } from '../supplier/supplier.service';

export interface ImportProductRow {
  barcode?: string;
  name: string;
  description?: string;
  category?: string; // Category name (will be resolved to ID)
  supplier?: string; // Supplier name (will be resolved to ID)
  unit?: string;
  price: number;
  costPrice?: number;
  currency?: string;
  quantity?: number; // Initial stock quantity
  reorderLevel?: number; // Minimum stock level before reorder alert
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  products: Array<{ product: CreateProductInput; rowNumber: number }>;
  errors: Array<{ row: number; error: string }>;
  preview?: ImportPreview;
}

export interface ImportPreview {
  products: Array<{
    row: number;
    data: CreateProductInput;
    warnings: string[];
  }>;
  errors: Array<{ row: number; error: string }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
}

export interface ExportOptions {
  includeHeaders?: boolean;
  format?: 'csv' | 'xlsx';
}

/**
 * Product Import/Export Service
 * Handles CSV and Excel file parsing and generation for product import/export
 */
export class ProductImportExportService {
  /**
   * Parse CSV file
   */
  private static async parseCSV(filePath: string): Promise<ImportProductRow[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim() !== '');
    
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse header row
    const headers = this.parseCSVLine(lines[0]);
    const headerMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      const normalizedHeader = this.normalizeHeaderName(header);
      headerMap[normalizedHeader] = index;
    });

    // Validate required headers
    const requiredHeaders = ['name', 'price'];
    const missingHeaders = requiredHeaders.filter(
      (h) => !headerMap[h.toLowerCase()]
    );
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Parse data rows
    const rows: ImportProductRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0 || values.every((v) => v.trim() === '')) {
        continue; // Skip empty rows
      }

      // Check if row has at least one meaningful field (name or barcode)
      const name = this.getValue(values, headerMap, 'name');
      const barcode = this.getValue(values, headerMap, 'barcode');
      if (!name && !barcode) {
        continue; // Skip rows with no name or barcode
      }

      const row: ImportProductRow = {
        name: name || '',
        price: parseFloat(this.getValue(values, headerMap, 'price') || '0'),
      };

      // Optional fields
      if (barcode) row.barcode = barcode;

      const description = this.getValue(values, headerMap, 'description');
      if (description) row.description = description;

      const category = this.getValue(values, headerMap, 'category');
      if (category) row.category = category;

      const supplier = this.getValue(values, headerMap, 'supplier');
      if (supplier) row.supplier = supplier;

      const unit = this.getValue(values, headerMap, 'unit');
      if (unit) row.unit = unit;

      const costPrice = this.getValue(values, headerMap, 'costprice');
      if (costPrice) row.costPrice = parseFloat(costPrice);

      const currency = this.getValue(values, headerMap, 'currency');
      if (currency) row.currency = currency;

      const quantity = this.getValue(values, headerMap, 'quantity');
      if (quantity) row.quantity = parseFloat(quantity);

      const reorderLevel = this.getValue(values, headerMap, 'reorderlevel');
      if (reorderLevel) row.reorderLevel = parseFloat(reorderLevel);

      rows.push(row);
    }

    return rows;
  }

  /**
   * Normalize header name by removing asterisks, spaces, and trimming
   * This allows "Cost Price*" to match "costprice" lookups
   */
  private static normalizeHeaderName(header: string): string {
    return header.toLowerCase().trim().replace(/\*+$/, '').replace(/\s+/g, '').trim();
  }

  /**
   * Parse CSV line (handles quoted values)
   */
  private static parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of value
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last value
    values.push(current.trim());
    return values;
  }

  /**
   * Get value from CSV row by header name
   */
  private static getValue(
    values: string[],
    headerMap: Record<string, number>,
    headerName: string
  ): string | null {
    const index = headerMap[headerName.toLowerCase()];
    if (index === undefined || index >= values.length) {
      return null;
    }
    const value = values[index];
    return value && value.trim() !== '' ? value.trim() : null;
  }

  /**
   * Parse Excel file
   */
  private static async parseExcel(filePath: string): Promise<ImportProductRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    if (workbook.worksheets.length === 0) {
      throw new Error('Excel file has no worksheets');
    }

    const worksheet = workbook.worksheets[0];
    if (worksheet.rowCount < 2) {
      throw new Error('Excel file must have at least a header row and one data row');
    }

    // Parse header row
    const headerRow = worksheet.getRow(1);
    const headerMap: Record<string, number> = {};
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = cell.value?.toString() || '';
      const normalizedHeader = this.normalizeHeaderName(header);
      headerMap[normalizedHeader] = colNumber;
    });

    // Validate required headers
    const requiredHeaders = ['name', 'price'];
    const missingHeaders = requiredHeaders.filter((h) => !headerMap[h]);
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Parse data rows
    const rows: ImportProductRow[] = [];
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      
      // Skip empty rows - check if row has any data
      let hasData = false;
      row.eachCell({ includeEmpty: false }, () => {
        hasData = true;
      });
      if (!hasData) continue;

      // Check if row has at least one meaningful field (name or barcode)
      const name = this.getCellValue(row, headerMap, 'name');
      const barcode = this.getCellValue(row, headerMap, 'barcode');
      if (!name && !barcode) {
        continue; // Skip rows with no name or barcode
      }

      const rowData: ImportProductRow = {
        name: name || '',
        price: parseFloat(this.getCellValue(row, headerMap, 'price') || '0'),
      };

      // Optional fields
      if (barcode) rowData.barcode = barcode;

      const description = this.getCellValue(row, headerMap, 'description');
      if (description) rowData.description = description;

      const category = this.getCellValue(row, headerMap, 'category');
      if (category) rowData.category = category;

      const supplier = this.getCellValue(row, headerMap, 'supplier');
      if (supplier) rowData.supplier = supplier;

      const unit = this.getCellValue(row, headerMap, 'unit');
      if (unit) rowData.unit = unit;

      const costPrice = this.getCellValue(row, headerMap, 'costprice');
      if (costPrice) rowData.costPrice = parseFloat(costPrice);

      const currency = this.getCellValue(row, headerMap, 'currency');
      if (currency) rowData.currency = currency;

      const quantity = this.getCellValue(row, headerMap, 'quantity');
      if (quantity) rowData.quantity = parseFloat(quantity);

      const reorderLevel = this.getCellValue(row, headerMap, 'reorderlevel');
      if (reorderLevel) rowData.reorderLevel = parseFloat(reorderLevel);

      rows.push(rowData);
    }

    return rows;
  }

  /**
   * Get cell value from Excel row by header name
   */
  private static getCellValue(
    row: ExcelJS.Row,
    headerMap: Record<string, number>,
    headerName: string
  ): string | null {
    const colNumber = headerMap[headerName.toLowerCase()];
    if (!colNumber) {
      return null;
    }
    const cell = row.getCell(colNumber);
    const value = cell.value?.toString() || '';
    return value.trim() !== '' ? value.trim() : null;
  }

  /**
   * Resolve category name to ID
   */
  private static async resolveCategoryName(
    categoryName: string
  ): Promise<number | null> {
    try {
      // Get all categories and find by name (case-insensitive)
      const categories = await CategoryService.getAll();
      const category = categories.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      );
      return category ? category.id : null;
    } catch (error) {
      logger.error('Error resolving category name', { categoryName, error });
      return null;
    }
  }

  /**
   * Resolve supplier name to ID
   */
  private static async resolveSupplierName(
    supplierName: string
  ): Promise<number | null> {
    try {
      // Get all suppliers and find by name (case-insensitive)
      const suppliers = await SupplierService.getAll();
      const supplier = suppliers.find(
        (s) => s.name.toLowerCase() === supplierName.toLowerCase()
      );
      return supplier ? supplier.id : null;
    } catch (error) {
      logger.error('Error resolving supplier name', { supplierName, error });
      return null;
    }
  }

  /**
   * Validate and prepare import data
   */
  static async prepareImportData(
    rows: ImportProductRow[]
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      totalRows: rows.length,
      validRows: 0,
      invalidRows: 0,
      products: [],
      errors: [],
    };

    // Get all categories and suppliers for batch resolution
    const categories = await CategoryService.getAll({ includeRelations: false });
    const suppliers = await SupplierService.getAll();
    const categoryMap = new Map(
      categories.map((c) => [c.name.toLowerCase(), c.id])
    );
    const supplierMap = new Map(
      suppliers.map((s) => [s.name.toLowerCase(), s.id])
    );

    // Check for duplicate barcodes in import data
    const barcodeSet = new Set<string>();
    const duplicateBarcodes = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate required fields
      if (!row.name || row.name.trim() === '') {
        errors.push('Product name is required');
      }

      if (row.price === undefined || row.price === null || isNaN(row.price) || row.price <= 0) {
        errors.push('Price is required and must be greater than 0');
      }

      // Validate barcode (required)
      if (!row.barcode || row.barcode.trim() === '') {
        errors.push('Barcode is required');
      } else {
        if (barcodeSet.has(row.barcode)) {
          duplicateBarcodes.add(row.barcode);
          errors.push(`Duplicate barcode in import file: ${row.barcode}`);
        } else {
          barcodeSet.add(row.barcode);
        }
      }

      // Validate cost price (required)
      if (row.costPrice === undefined || row.costPrice === null || isNaN(row.costPrice)) {
        errors.push('Cost price is required');
      } else if (row.costPrice < 0) {
        errors.push('Cost price must be >= 0');
      }

      // Validate currency (required)
      if (!row.currency || row.currency.trim() === '') {
        errors.push('Currency is required');
      } else if (row.currency !== 'USD' && row.currency !== 'LBP') {
        errors.push('Currency must be either USD or LBP');
      }

      // Resolve category
      let categoryId: number | null = null;
      if (row.category) {
        const categoryIdFromMap = categoryMap.get(row.category.toLowerCase());
        if (categoryIdFromMap) {
          categoryId = categoryIdFromMap;
        } else {
          warnings.push(`Category "${row.category}" not found - will be set to null`);
        }
      }

      // Resolve supplier
      let supplierId: number | null = null;
      if (row.supplier) {
        const supplierIdFromMap = supplierMap.get(row.supplier.toLowerCase());
        if (supplierIdFromMap) {
          supplierId = supplierIdFromMap;
        } else {
          warnings.push(`Supplier "${row.supplier}" not found - will be set to null`);
        }
      }

      if (errors.length > 0) {
        result.invalidRows++;
        result.errors.push({
          row: rowNumber,
          error: errors.join('; '),
        });
      } else {
        result.validRows++;
        result.products.push({
          product: {
            barcode: row.barcode!.trim(),
            name: row.name.trim(),
            description: row.description?.trim() || null,
            categoryId,
            supplierId,
            unit: row.unit || 'pcs',
            price: row.price,
            costPrice: row.costPrice!,
            currency: row.currency!.trim(),
            quantity: row.quantity ?? 0,
            reorderLevel: row.reorderLevel ?? 0,
          },
          rowNumber,
        });
      }
    }

    result.success = result.invalidRows === 0;
    return result;
  }

  /**
   * Parse import file (CSV or Excel)
   */
  static async parseImportFile(filePath: string): Promise<ImportProductRow[]> {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.csv') {
      return await this.parseCSV(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      return await this.parseExcel(filePath);
    } else {
      throw new Error(`Unsupported file format: ${ext}. Supported formats: .csv, .xlsx, .xls`);
    }
  }

  /**
   * Generate import preview
   */
  static async generateImportPreview(
    filePath: string
  ): Promise<ImportPreview> {
    try {
      const rows = await this.parseImportFile(filePath);
      const prepared = await this.prepareImportData(rows);

      const preview: ImportPreview = {
        products: prepared.products.map((item) => ({
          row: item.rowNumber,
          data: item.product,
          warnings: [], // Warnings are already handled in prepareImportData
        })),
        errors: prepared.errors,
        summary: {
          total: prepared.totalRows,
          valid: prepared.validRows,
          invalid: prepared.invalidRows,
          duplicates: 0, // Could be calculated if needed
        },
      };

      return preview;
    } catch (error) {
      logger.error('Error generating import preview', { filePath, error });
      throw error;
    }
  }

  /**
   * Export products to CSV
   */
  static async exportToCSV(
    products: ProductWithRelations[],
    filePath: string,
    options: ExportOptions = {}
  ): Promise<string> {
    const includeHeaders = options.includeHeaders !== false;
    const lines: string[] = [];

    // Header row
    if (includeHeaders) {
      lines.push(
        'Barcode,Name,Description,Category,Supplier,Unit,Price,Cost Price,Currency,Quantity,Reorder Level'
      );
    }

    // Data rows
    for (const product of products) {
      const inventory = (product as any).inventory;
      const row = [
        this.escapeCSVValue(product.barcode || ''),
        this.escapeCSVValue(product.name),
        this.escapeCSVValue(product.description || '-'),
        this.escapeCSVValue(product.category?.name || '-'),
        this.escapeCSVValue(product.supplier?.name || '-'),
        this.escapeCSVValue(product.unit),
        product.price.toString(),
        product.costPrice?.toString() || '',
        this.escapeCSVValue(product.currency),
        (inventory?.quantity ?? 0).toString(),
        (inventory?.reorderLevel ?? 0).toString(),
      ];
      lines.push(row.join(','));
    }

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
    return filePath;
  }

  /**
   * Escape CSV value (handle quotes and commas)
   */
  private static escapeCSVValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Export products to Excel
   */
  static async exportToExcel(
    products: ProductWithRelations[],
    filePath: string,
    options: ExportOptions = {}
  ): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products');

    const includeHeaders = options.includeHeaders !== false;

    // Fetch categories and suppliers for dropdown lists
    const categories = await CategoryService.getAll({ includeRelations: false });
    const suppliers = await SupplierService.getAll();
    const categoryNames = categories.map((c) => c.name);
    const supplierNames = suppliers.map((s) => s.name);

    // Header row
    if (includeHeaders) {
      worksheet.addRow([
        'Barcode*',
        'Name*',
        'Description',
        'Category',
        'Supplier',
        'Unit',
        'Price*',
        'Cost Price*',
        'Currency*',
        'Quantity',
        'Reorder Level',
      ]);

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    }

    // Data rows
    const startRow = includeHeaders ? 2 : 1;
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const inventory = (product as any).inventory;
      const rowNumber = startRow + i;
      
      worksheet.addRow([
        product.barcode || '',
        product.name,
        product.description || '-',
        product.category?.name || '-',
        product.supplier?.name || '-',
        product.unit,
        product.price,
        product.costPrice || '',
        product.currency,
        inventory?.quantity ?? 0,
        inventory?.reorderLevel ?? 0,
      ]);

      // Add data validation for Category column (column D, index 4)
      const categoryCell = worksheet.getCell(rowNumber, 4);
      if (categoryNames.length > 0) {
        // Format: comma-separated quoted values in a single string
        const categoryList = categoryNames
          .map(name => `"${name.replace(/"/g, '""')}"`)
          .join(',');
        categoryCell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [categoryList],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Invalid Category',
          error: 'Please select a category from the dropdown list.',
        };
      }

      // Add data validation for Supplier column (column E, index 5)
      const supplierCell = worksheet.getCell(rowNumber, 5);
      if (supplierNames.length > 0) {
        // Format: comma-separated quoted values in a single string
        const supplierList = supplierNames
          .map(name => `"${name.replace(/"/g, '""')}"`)
          .join(',');
        supplierCell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [supplierList],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Invalid Supplier',
          error: 'Please select a supplier from the dropdown list.',
        };
      }

      // Add data validation for Unit column (column F, index 6)
      const unitCell = worksheet.getCell(rowNumber, 6);
      const unitOptions = ['pcs', 'kg', 'g', 'l', 'ml', 'm', 'cm'];
      const unitList = unitOptions
        .map(unit => `"${unit}"`)
        .join(',');
      unitCell.dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [unitList],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Unit Required',
        error: 'Unit is required. Please select a unit from the dropdown list.',
      };
    }

    // Auto-size columns
    worksheet.columns.forEach((column) => {
      if (column.header) {
        column.width = 15;
      }
    });

    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  /**
   * Generate export template (empty file with headers)
   */
  static async generateTemplate(
    filePath: string,
    format: 'csv' | 'xlsx' = 'xlsx'
  ): Promise<string> {
    const emptyProducts: ProductWithRelations[] = [];
    
    if (format === 'csv') {
      return await this.exportToCSV(emptyProducts, filePath, { includeHeaders: true });
    } else {
      // For Excel templates, we want to add dropdowns to at least a few rows
      // so users can see and use them
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Products');

      // Fetch categories and suppliers for dropdown lists
      const categories = await CategoryService.getAll({ includeRelations: false });
      const suppliers = await SupplierService.getAll();
      const categoryNames = categories.map((c) => c.name);
      const supplierNames = suppliers.map((s) => s.name);

      // Create a helper sheet for dropdown lists (more reliable than inline formulas)
      const listsSheet = workbook.addWorksheet('Lists');
      listsSheet.state = 'hidden'; // Hide the sheet from users
      
      // Add categories to helper sheet
      if (categoryNames.length > 0) {
        categoryNames.forEach((name, index) => {
          listsSheet.getCell(index + 1, 1).value = name;
        });
      } else {
        listsSheet.getCell(1, 1).value = 'No categories available';
      }
      
      // Add suppliers to helper sheet
      if (supplierNames.length > 0) {
        supplierNames.forEach((name, index) => {
          listsSheet.getCell(index + 1, 2).value = name;
        });
      } else {
        listsSheet.getCell(1, 2).value = 'No suppliers available';
      }
      
      // Add currencies to helper sheet
      listsSheet.getCell(1, 3).value = 'USD';
      listsSheet.getCell(2, 3).value = 'LBP';
      
      // Add units to helper sheet
      const unitOptions = ['pcs', 'kg', 'g', 'l', 'ml', 'm', 'cm'];
      unitOptions.forEach((unit, index) => {
        listsSheet.getCell(index + 1, 4).value = unit;
      });
      
      // Define ranges for dropdowns
      const categoryRange = categoryNames.length > 0 
        ? `Lists!$A$1:$A$${categoryNames.length}`
        : 'Lists!$A$1:$A$1';
      const supplierRange = supplierNames.length > 0
        ? `Lists!$B$1:$B$${supplierNames.length}`
        : 'Lists!$B$1:$B$1';
      const currencyRange = 'Lists!$C$1:$C$2';
      const unitRange = `Lists!$D$1:$D$${unitOptions.length}`;

      // Header row (data table starts at row 1)
      worksheet.addRow([
        'Barcode*',
        'Name*',
        'Description',
        'Category',
        'Supplier',
        'Unit*',
        'Price*',
        'Cost Price*',
        'Currency*',
        'Quantity',
        'Reorder Level',
      ]);

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Add helpers in column L (column 12) next to the table
      const helperColumn = 12; // Column L
      let helperRow = 1;

      // Helper title
      const helperTitleCell = worksheet.getCell(helperRow, helperColumn);
      helperTitleCell.value = '📋 Template Guide';
      helperTitleCell.font = { bold: true, size: 12, color: { argb: 'FF000000' } };
      helperTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F3FF' },
      };
      helperRow++;

      // Required fields info
      const requiredFieldsCell = worksheet.getCell(helperRow, helperColumn);
      requiredFieldsCell.value = 'Required Fields (*):\n• Barcode\n• Name\n• Unit (select from list)\n• Price (must be > 0)\n• Cost Price (must be >= 0)\n• Currency';
      requiredFieldsCell.font = { bold: true, size: 10, color: { argb: 'FF333333' } };
      requiredFieldsCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      helperRow++;

      // Dropdowns info
      const dropdownsCell = worksheet.getCell(helperRow, helperColumn);
      dropdownsCell.value = 'Dropdown Fields:\n• Category (select from list)\n• Supplier (select from list)\n• Unit* (required, select from list)\n• Currency* (required, USD or LBP)';
      dropdownsCell.font = { size: 10, color: { argb: 'FF333333' } };
      dropdownsCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      helperRow++;

      // Default values info
      const defaultsCell = worksheet.getCell(helperRow, helperColumn);
      defaultsCell.value = 'Default Values:\n• Price: 0 (update required)\n• Cost Price: 0 (update required)\n• Quantity: 0\n• Reorder Level: 0\n• Unit: pcs\n• Currency: USD';
      defaultsCell.font = { size: 10, color: { argb: 'FF333333' } };
      defaultsCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      helperRow++;

      // Add warning notes if categories or suppliers are empty
      let warningMessages: string[] = [];
      if (categoryNames.length === 0) {
        warningMessages.push('⚠️ No categories found. Please add categories first, then redownload this template.');
      }
      if (supplierNames.length === 0) {
        warningMessages.push('⚠️ No suppliers found. Please add suppliers first, then redownload this template.');
      }

      if (warningMessages.length > 0) {
        const warningCell = worksheet.getCell(helperRow, helperColumn);
        warningCell.value = warningMessages.join('\n\n');
        warningCell.font = { bold: true, color: { argb: 'FFFF0000' }, size: 10 };
        warningCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE6E6' },
        };
        warningCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        helperRow++;
      }

      // Set helper column width
      worksheet.getColumn(helperColumn).width = 40;

      // Data starts at row 2 (after header)
      const dataStartRow = 2;

      // Add data validation to rows for Category, Supplier, and Currency columns
      // Show only one row of data in the template
      const maxTemplateRows = 1;
      
      for (let rowNumber = dataStartRow; rowNumber <= dataStartRow + maxTemplateRows - 1; rowNumber++) {
        // Add default values for Price, Cost Price, Quantity, and Reorder Level
        const priceCell = worksheet.getCell(rowNumber, 7); // Price column (moved from 6 to 7)
        priceCell.value = 0;
        // Add data validation for Price - required and > 0
        priceCell.dataValidation = {
          type: 'decimal',
          allowBlank: false,
          operator: 'greaterThan',
          formulae: [0],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Price Required',
          error: 'Price is required and must be greater than 0.',
        };
        
        const costPriceCell = worksheet.getCell(rowNumber, 8); // Cost Price column (moved from 7 to 8)
        costPriceCell.value = 0;
        // Add data validation for Cost Price - required and >= 0
        costPriceCell.dataValidation = {
          type: 'decimal',
          allowBlank: false,
          operator: 'greaterThanOrEqual',
          formulae: [0],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Cost Price Required',
          error: 'Cost Price is required and must be >= 0.',
        };
        
        const quantityCell = worksheet.getCell(rowNumber, 10); // Quantity column (moved from 9 to 10)
        quantityCell.value = 0;
        
        const reorderLevelCell = worksheet.getCell(rowNumber, 11); // Reorder Level column (moved from 10 to 11)
        reorderLevelCell.value = 0;

        // Add data validation for Barcode column (column A, index 1) - required
        const barcodeCell = worksheet.getCell(rowNumber, 1);
        barcodeCell.dataValidation = {
          type: 'custom',
          allowBlank: false,
          formulae: ['LEN(TRIM(A' + rowNumber + '))>0'],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Barcode Required',
          error: 'Barcode is required and cannot be empty.',
        };

        // Add data validation for Category column (column D, index 4)
        // Use range reference to helper sheet (more reliable than inline formulas)
        const categoryCell = worksheet.getCell(rowNumber, 4);
        categoryCell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [categoryRange],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Invalid Category',
          error: 'Please select a category from the dropdown list.',
        };

        // Add data validation for Supplier column (column E, index 5)
        // Use range reference to helper sheet
        const supplierCell = worksheet.getCell(rowNumber, 5);
        supplierCell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [supplierRange],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Invalid Supplier',
          error: 'Please select a supplier from the dropdown list.',
        };

        // Add data validation for Unit column (column F, index 6)
        // Use range reference to helper sheet
        const unitCell = worksheet.getCell(rowNumber, 6);
        // Set default unit to pcs
        unitCell.value = 'pcs';
        unitCell.dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [unitRange],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Unit Required',
          error: 'Unit is required. Please select a unit from the dropdown list.',
        };

        // Add data validation for Currency column (column I, index 9)
        // Use range reference to helper sheet
        const currencyCell = worksheet.getCell(rowNumber, 9);
        currencyCell.dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [currencyRange],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Currency Required',
          error: 'Currency is required. Please select USD or LBP from the dropdown list.',
        };
        // Set default currency to USD
        currencyCell.value = 'USD';
      }

      // Auto-size columns
      worksheet.columns.forEach((column) => {
        if (column.header) {
          column.width = 15;
        }
      });

      await workbook.xlsx.writeFile(filePath);
      return filePath;
    }
  }
}

