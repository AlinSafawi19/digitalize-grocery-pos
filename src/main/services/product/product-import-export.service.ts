import ExcelJS from 'exceljs';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../../utils/logger';
import { ProductService, CreateProductInput, ProductWithRelations } from './product.service';
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
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  products: CreateProductInput[];
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
      headerMap[header.toLowerCase().trim()] = index;
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

      const row: ImportProductRow = {
        name: this.getValue(values, headerMap, 'name') || '',
        price: parseFloat(this.getValue(values, headerMap, 'price') || '0'),
      };

      // Optional fields
      const barcode = this.getValue(values, headerMap, 'barcode');
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

      rows.push(row);
    }

    return rows;
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
      const header = (cell.value?.toString() || '').toLowerCase().trim();
      headerMap[header] = colNumber;
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
      
      // Skip empty rows
      let hasData = false;
      row.eachCell({ includeEmpty: false }, () => {
        hasData = true;
      });
      if (!hasData) continue;

      const rowData: ImportProductRow = {
        name: this.getCellValue(row, headerMap, 'name') || '',
        price: parseFloat(this.getCellValue(row, headerMap, 'price') || '0'),
      };

      // Optional fields
      const barcode = this.getCellValue(row, headerMap, 'barcode');
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

      // Validate barcode
      if (row.barcode) {
        if (barcodeSet.has(row.barcode)) {
          duplicateBarcodes.add(row.barcode);
          errors.push(`Duplicate barcode in import file: ${row.barcode}`);
        } else {
          barcodeSet.add(row.barcode);
        }
      }

      // Validate cost price if provided
      if (row.costPrice !== undefined && row.costPrice !== null) {
        if (isNaN(row.costPrice) || row.costPrice < 0) {
          errors.push('Cost price must be a valid number >= 0');
        }
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
          barcode: row.barcode || null,
          name: row.name.trim(),
          description: row.description?.trim() || null,
          categoryId,
          supplierId,
          unit: row.unit || 'pcs',
          price: row.price,
          costPrice: row.costPrice || null,
          currency: row.currency || 'USD',
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
        products: prepared.products.map((product, index) => ({
          row: index + 2, // +2 because row 1 is header, and arrays are 0-indexed
          data: product,
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
        'Barcode,Name,Description,Category,Supplier,Unit,Price,Cost Price,Currency'
      );
    }

    // Data rows
    for (const product of products) {
      const row = [
        this.escapeCSVValue(product.barcode || ''),
        this.escapeCSVValue(product.name),
        this.escapeCSVValue(product.description || ''),
        this.escapeCSVValue(product.category?.name || ''),
        this.escapeCSVValue(product.supplier?.name || ''),
        this.escapeCSVValue(product.unit),
        product.price.toString(),
        product.costPrice?.toString() || '',
        this.escapeCSVValue(product.currency),
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

    // Header row
    if (includeHeaders) {
      worksheet.addRow([
        'Barcode',
        'Name',
        'Description',
        'Category',
        'Supplier',
        'Unit',
        'Price',
        'Cost Price',
        'Currency',
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
    for (const product of products) {
      worksheet.addRow([
        product.barcode || '',
        product.name,
        product.description || '',
        product.category?.name || '',
        product.supplier?.name || '',
        product.unit,
        product.price,
        product.costPrice || '',
        product.currency,
      ]);
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
      return await this.exportToExcel(emptyProducts, filePath, { includeHeaders: true });
    }
  }
}

