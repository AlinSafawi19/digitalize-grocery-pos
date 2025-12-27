import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { ProductService } from '../product/product.service';
import { InventoryService } from '../inventory/inventory.service';
import { BarcodeService } from './barcode.service';

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
  id: string; // Unique batch ID
  operation: 'inventory_count' | 'stock_adjustment' | 'product_lookup' | 'bulk_import';
  items: BatchScanItem[];
  totalScanned: number;
  successful: number;
  failed: number;
  duplicates: number;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in milliseconds
}

export interface BatchScanOptions {
  operation: 'inventory_count' | 'stock_adjustment' | 'product_lookup' | 'bulk_import';
  allowDuplicates?: boolean; // Allow same barcode to be scanned multiple times
  autoValidate?: boolean; // Automatically validate barcodes
  onItemScanned?: (item: BatchScanItem) => void; // Callback for each scanned item
}

/**
 * Batch Barcode Scan Service
 * Handles batch scanning operations for multiple barcodes
 */
export class BatchBarcodeScanService {
  private static activeBatches: Map<string, BatchScanResult> = new Map();

  /**
   * Start a new batch scan session
   */
  static startBatchScan(options: BatchScanOptions): string {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const batch: BatchScanResult = {
      id: batchId,
      operation: options.operation,
      items: [],
      totalScanned: 0,
      successful: 0,
      failed: 0,
      duplicates: 0,
      startTime: new Date(),
    };

    this.activeBatches.set(batchId, batch);
    logger.info('Started batch barcode scan', { batchId, operation: options.operation });
    
    return batchId;
  }

  /**
   * Scan a single barcode in a batch
   */
  static async scanBarcode(
    batchId: string,
    barcode: string,
    options: BatchScanOptions,
    userId: number
  ): Promise<BatchScanItem> {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      throw new Error(`Batch scan session not found: ${batchId}`);
    }

    const item: BatchScanItem = {
      barcode: barcode.trim(),
      status: 'pending',
      timestamp: new Date(),
    };

    try {
      // Validate barcode format if auto-validate is enabled
      if (options.autoValidate) {
        const validationResult = BarcodeService.validateBarcode(barcode.trim());
        if (!validationResult.valid) {
          item.status = 'error';
          item.error = validationResult.error || 'Invalid barcode format';
          batch.items.push(item);
          batch.totalScanned++;
          batch.failed++;
          if (options.onItemScanned) {
            options.onItemScanned(item);
          }
          return item;
        }
      }

      // Check for duplicates if not allowed
      if (!options.allowDuplicates) {
        const existingItem = batch.items.find(
          (i) => i.barcode === barcode.trim() && i.status === 'success'
        );
        if (existingItem) {
          item.status = 'duplicate';
          item.error = 'Barcode already scanned in this batch';
          item.productId = existingItem.productId;
          item.productName = existingItem.productName;
          batch.items.push(item);
          batch.totalScanned++;
          batch.duplicates++;
          if (options.onItemScanned) {
            options.onItemScanned(item);
          }
          return item;
        }
      }

      // Lookup product by barcode
      const productResult = await ProductService.getProductByBarcode(
        barcode.trim(),
        userId
      );

      if (productResult.success && productResult.product) {
        item.productId = productResult.product.id;
        item.productName = productResult.product.name;
        item.quantity = 1; // Default quantity
        item.status = 'success';
        batch.items.push(item);
        batch.totalScanned++;
        batch.successful++;
      } else {
        item.status = 'error';
        item.error = productResult.error || 'Product not found';
        batch.items.push(item);
        batch.totalScanned++;
        batch.failed++;
      }

      if (options.onItemScanned) {
        options.onItemScanned(item);
      }

      return item;
    } catch (error) {
      item.status = 'error';
      item.error = error instanceof Error ? error.message : 'Unknown error';
      batch.items.push(item);
      batch.totalScanned++;
      batch.failed++;
      
      logger.error('Error scanning barcode in batch', { batchId, barcode, error });
      
      if (options.onItemScanned) {
        options.onItemScanned(item);
      }
      
      return item;
    }
  }

  /**
   * Update quantity for a scanned item
   */
  static updateItemQuantity(batchId: string, barcode: string, quantity: number): boolean {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      return false;
    }

    const item = batch.items.find(
      (i) => i.barcode === barcode && i.status === 'success'
    );
    if (item) {
      item.quantity = quantity;
      return true;
    }

    return false;
  }

  /**
   * Remove an item from the batch
   */
  static removeItem(batchId: string, barcode: string): boolean {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      return false;
    }

    const index = batch.items.findIndex((i) => i.barcode === barcode);
    if (index !== -1) {
      const item = batch.items[index];
      batch.items.splice(index, 1);
      batch.totalScanned--;

      // Update counters
      if (item.status === 'success') {
        batch.successful--;
      } else if (item.status === 'error') {
        batch.failed--;
      } else if (item.status === 'duplicate') {
        batch.duplicates--;
      }

      return true;
    }

    return false;
  }

  /**
   * Get current batch scan result
   */
  static getBatchResult(batchId: string): BatchScanResult | null {
    return this.activeBatches.get(batchId) || null;
  }

  /**
   * Complete a batch scan session
   */
  static completeBatch(batchId: string): BatchScanResult | null {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      return null;
    }

    batch.endTime = new Date();
    batch.duration = batch.endTime.getTime() - batch.startTime.getTime();

    logger.info('Completed batch barcode scan', {
      batchId,
      totalScanned: batch.totalScanned,
      successful: batch.successful,
      failed: batch.failed,
      duplicates: batch.duplicates,
      duration: batch.duration,
    });

    // Keep batch in memory for a while (could be moved to database for persistence)
    // For now, we'll keep it for 1 hour
    setTimeout(() => {
      this.activeBatches.delete(batchId);
    }, 60 * 60 * 1000);

    return batch;
  }

  /**
   * Cancel a batch scan session
   */
  static cancelBatch(batchId: string): boolean {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      return false;
    }

    this.activeBatches.delete(batchId);
    logger.info('Cancelled batch barcode scan', { batchId });
    return true;
  }

  /**
   * Get all active batch scan sessions
   */
  static getActiveBatches(): BatchScanResult[] {
    return Array.from(this.activeBatches.values());
  }

  /**
   * Clear old completed batches (cleanup)
   */
  static clearOldBatches(maxAge: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleared = 0;

    for (const [batchId, batch] of this.activeBatches.entries()) {
      if (batch.endTime) {
        const age = now - batch.endTime.getTime();
        if (age > maxAge) {
          this.activeBatches.delete(batchId);
          cleared++;
        }
      }
    }

    return cleared;
  }

  /**
   * Export batch scan results to CSV format
   */
  static exportToCSV(batchId: string): string | null {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      return null;
    }

    const headers = ['Barcode', 'Product Name', 'Product ID', 'Quantity', 'Status', 'Error', 'Timestamp'];
    const rows = batch.items.map((item) => [
      item.barcode,
      item.productName || '',
      item.productId?.toString() || '',
      item.quantity?.toString() || '1',
      item.status,
      item.error || '',
      item.timestamp.toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }
}

