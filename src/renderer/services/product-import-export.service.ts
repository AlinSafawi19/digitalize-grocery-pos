export interface ImportPreview {
  products: Array<{
    row: number;
    data: {
      barcode?: string | null;
      name: string;
      description?: string | null;
      categoryId?: number | null;
      supplierId?: number | null;
      unit: string;
      price: number;
      costPrice?: number | null;
      currency: string;
    };
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

export interface ImportResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ row: number; error: string }>;
  validationErrors?: Array<{ row: number; error: string }>;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  count?: number;
  error?: string;
}

export interface FileDialogResult {
  success: boolean;
  filePath?: string;
  format?: 'csv' | 'xlsx';
  canceled?: boolean;
  error?: string;
}

/**
 * Product Import/Export Service (Renderer)
 * Handles product import/export operations via IPC
 */
export class ProductImportExportService {
  /**
   * Show import file dialog
   */
  static async showImportDialog(): Promise<FileDialogResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'product:showImportDialog'
      ) as FileDialogResult;
      return result;
    } catch (error) {
      console.error('Error showing import dialog:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Show export file dialog
   */
  static async showExportDialog(defaultFileName?: string): Promise<FileDialogResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'product:showExportDialog',
        defaultFileName
      ) as FileDialogResult;
      return result;
    } catch (error) {
      console.error('Error showing export dialog:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Generate import preview
   */
  static async generateImportPreview(filePath: string): Promise<{ success: boolean; preview?: ImportPreview; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'product:generateImportPreview',
        filePath
      ) as { success: boolean; preview?: ImportPreview; error?: string };
      return result;
    } catch (error) {
      console.error('Error generating import preview:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Import products from file
   */
  static async importFromFile(
    filePath: string,
    userId: number,
    onProgress?: (progress: { stage: string; message: string }) => void
  ): Promise<ImportResult> {
    try {
      // Set up progress listener
      if (onProgress) {
        const progressListener = (_event: any, progress: { stage: string; message: string }) => {
          onProgress(progress);
        };
        window.electron.ipcRenderer.on('product:import:progress', progressListener);

        // Clean up listener after import completes
        const cleanup = () => {
          window.electron.ipcRenderer.removeListener('product:import:progress', progressListener);
        };

        try {
          const result = await window.electron.ipcRenderer.invoke(
            'product:importFromFile',
            filePath,
            userId
          ) as ImportResult;
          cleanup();
          return result;
        } catch (error) {
          cleanup();
          throw error;
        }
      } else {
        const result = await window.electron.ipcRenderer.invoke(
          'product:importFromFile',
          filePath,
          userId
        ) as ImportResult;
        return result;
      }
    } catch (error) {
      console.error('Error importing products:', error);
      return {
        success: false,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        successCount: 0,
        failedCount: 0,
        errors: [],
        error: error instanceof Error ? error.message : 'An error occurred',
      } as ImportResult;
    }
  }

  /**
   * Export products to file
   */
  static async exportToFile(filePath: string, format: 'csv' | 'xlsx' = 'xlsx'): Promise<ExportResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'product:exportToFile',
        filePath,
        format
      ) as ExportResult;
      return result;
    } catch (error) {
      console.error('Error exporting products:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Generate export template
   */
  static async generateTemplate(filePath: string, format: 'csv' | 'xlsx' = 'xlsx'): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'product:generateTemplate',
        filePath,
        format
      ) as { success: boolean; filePath?: string; error?: string };
      return result;
    } catch (error) {
      console.error('Error generating template:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

