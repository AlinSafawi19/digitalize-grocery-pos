import { Product } from './product.service';

// Stock Transfer Types
export interface Location {
  id: number;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  isDefault: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockTransfer {
  id: number;
  transferNumber: string;
  fromLocationId: number;
  toLocationId: number;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  notes: string | null;
  requestedById: number;
  approvedById: number | null;
  completedById: number | null;
  requestedAt: Date;
  approvedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  fromLocation: Location;
  toLocation: Location;
  items: StockTransferItem[];
  requester: {
    id: number;
    username: string;
  };
  approver?: {
    id: number;
    username: string;
  } | null;
  completer?: {
    id: number;
    username: string;
  } | null;
}

export interface StockTransferItem {
  id: number;
  stockTransferId: number;
  productId: number;
  quantity: number;
  receivedQuantity: number;
  notes: string | null;
  product: Product;
}

export interface CreateStockTransferInput {
  fromLocationId: number;
  toLocationId: number;
  notes?: string;
  items: {
    productId: number;
    quantity: number;
    notes?: string;
  }[];
}

export interface UpdateStockTransferInput {
  status?: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  notes?: string;
  items?: {
    productId: number;
    quantity: number;
    receivedQuantity?: number;
    notes?: string;
  }[];
}

export interface StockTransferListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  fromLocationId?: number;
  toLocationId?: number;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'requestedAt' | 'transferNumber' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface StockTransferListResult {
  success: boolean;
  transfers?: StockTransfer[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  error?: string;
}

/**
 * Stock Transfer Service
 * Handles stock transfer operations from renderer process
 */
export class StockTransferService {
  /**
   * Get stock transfer by ID
   */
  static async getById(id: number): Promise<StockTransfer | null> {
    try {
      const result = await window.electron.ipcRenderer.invoke('stockTransfer:getById', id) as { success: boolean; transfer?: StockTransfer };
      if (result.success && result.transfer) {
        return result.transfer;
      }
      return null;
    } catch (error) {
      console.error('Error getting stock transfer by ID', error);
      throw error;
    }
  }

  /**
   * Get stock transfers list
   */
  static async getList(options: StockTransferListOptions): Promise<StockTransferListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('stockTransfer:getList', options) as StockTransferListResult;
      return result;
    } catch (error) {
      console.error('Error getting stock transfer list', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stock transfer list',
      };
    }
  }

  /**
   * Create stock transfer
   */
  static async create(
    input: CreateStockTransferInput,
    requestedById: number
  ): Promise<{ success: boolean; transfer?: StockTransfer; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('stockTransfer:create', input, requestedById) as { success: boolean; transfer?: StockTransfer; error?: string };
      return result;
    } catch (error) {
      console.error('Error creating stock transfer', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create stock transfer',
      };
    }
  }

  /**
   * Update stock transfer
   */
  static async update(
    id: number,
    input: UpdateStockTransferInput,
    updatedById: number
  ): Promise<{ success: boolean; transfer?: StockTransfer; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('stockTransfer:update', id, input, updatedById) as { success: boolean; transfer?: StockTransfer; error?: string };
      return result;
    } catch (error) {
      console.error('Error updating stock transfer', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update stock transfer',
      };
    }
  }

  /**
   * Complete stock transfer
   */
  static async complete(
    id: number,
    receivedItems: Array<{ itemId: number; receivedQuantity: number }>,
    completedById: number
  ): Promise<{ success: boolean; transfer?: StockTransfer; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'stockTransfer:complete',
        id,
        receivedItems,
        completedById
      ) as { success: boolean; transfer?: StockTransfer; error?: string };
      return result;
    } catch (error) {
      console.error('Error completing stock transfer', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete stock transfer',
      };
    }
  }

  /**
   * Cancel stock transfer
   */
  static async cancel(
    id: number,
    cancelledById: number
  ): Promise<{ success: boolean; transfer?: StockTransfer; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('stockTransfer:cancel', id, cancelledById) as { success: boolean; transfer?: StockTransfer; error?: string };
      return result;
    } catch (error) {
      console.error('Error cancelling stock transfer', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel stock transfer',
      };
    }
  }
}

