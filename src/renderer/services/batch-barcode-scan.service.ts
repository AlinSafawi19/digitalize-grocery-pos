export interface BatchScanItem {
  barcode: string;
  productId?: number;
  productName?: string;
  quantity?: number;
  status: 'pending' | 'success' | 'error' | 'duplicate';
  error?: string;
  timestamp: Date;
}

export interface BatchScanResult {
  id: string;
  operation: 'inventory_count' | 'stock_adjustment' | 'product_lookup' | 'bulk_import';
  items: BatchScanItem[];
  totalScanned: number;
  successful: number;
  failed: number;
  duplicates: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface BatchScanOptions {
  operation: 'inventory_count' | 'stock_adjustment' | 'product_lookup' | 'bulk_import';
  allowDuplicates?: boolean;
  autoValidate?: boolean;
}

/**
 * Batch Barcode Scan Service (Renderer)
 * Handles batch barcode scanning operations via IPC
 */
export class BatchBarcodeScanService {
  /**
   * Start a new batch scan session
   */
  static async startBatch(
    options: BatchScanOptions
  ): Promise<{ success: boolean; batchId?: string; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'batch-barcode-scan:startBatch',
        options
      ) as { success: boolean; batchId?: string; error?: string };
      return result;
    } catch (error) {
      console.error('Error starting batch scan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Scan a single barcode in a batch
   */
  static async scanBarcode(
    batchId: string,
    barcode: string,
    options: BatchScanOptions,
    userId: number
  ): Promise<{ success: boolean; item?: BatchScanItem; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'batch-barcode-scan:scanBarcode',
        batchId,
        barcode,
        options,
        userId
      ) as { success: boolean; item?: BatchScanItem; error?: string };
      return result;
    } catch (error) {
      console.error('Error scanning barcode:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update item quantity
   */
  static async updateItemQuantity(
    batchId: string,
    barcode: string,
    quantity: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'batch-barcode-scan:updateItemQuantity',
        batchId,
        barcode,
        quantity
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      console.error('Error updating item quantity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Remove an item from the batch
   */
  static async removeItem(
    batchId: string,
    barcode: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'batch-barcode-scan:removeItem',
        batchId,
        barcode
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      console.error('Error removing item:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get current batch scan result
   */
  static async getBatchResult(
    batchId: string
  ): Promise<{ success: boolean; result?: BatchScanResult; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'batch-barcode-scan:getBatchResult',
        batchId
      ) as { success: boolean; result?: BatchScanResult; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting batch result:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Complete a batch scan session
   */
  static async completeBatch(
    batchId: string
  ): Promise<{ success: boolean; result?: BatchScanResult; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'batch-barcode-scan:completeBatch',
        batchId
      ) as { success: boolean; result?: BatchScanResult; error?: string };
      return result;
    } catch (error) {
      console.error('Error completing batch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Cancel a batch scan session
   */
  static async cancelBatch(
    batchId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'batch-barcode-scan:cancelBatch',
        batchId
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      console.error('Error cancelling batch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Export batch scan results to CSV
   */
  static async exportToCSV(
    batchId: string
  ): Promise<{ success: boolean; csv?: string; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'batch-barcode-scan:exportToCSV',
        batchId
      ) as { success: boolean; csv?: string; error?: string };
      return result;
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

