export interface InventoryItem {
  id: number;
  productId: number;
  quantity: number;
  reorderLevel: number;
  location: string | null;
  lastUpdated: Date;
  product: {
    id: number;
    code: string;
    name: string;
    unit: string;
    price: number;
    category?: {
      id: number;
      name: string;
    } | null;
    supplier?: {
      id: number;
      name: string;
    } | null;
  };
}

export interface StockMovement {
  id: number;
  productId: number;
  type: string;
  quantity: number;
  reason: string | null;
  userId: number | null;
  referenceId: number | null;
  timestamp: Date;
  product: {
    id: number;
    code: string;
    name: string;
    unit: string;
  };
  user?: {
    id: number;
    username: string;
  } | null;
}

export interface InventoryListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  productId?: number;
  lowStockOnly?: boolean;
  outOfStockOnly?: boolean;
  sortBy?: 'productName' | 'quantity' | 'reorderLevel' | 'lastUpdated';
  sortOrder?: 'asc' | 'desc';
}

export interface AdjustStockInput {
  productId: number;
  quantity: number;
  type: 'adjustment' | 'transfer' | 'damage' | 'expiry' | 'purchase';
  reason?: string;
  userId?: number;
  referenceId?: number;
  expiryDate?: Date | null; // Expiry date for this stock batch
}

export interface UpdateInventoryInput {
  productId: number;
  quantity?: number;
  reorderLevel?: number;
  location?: string | null;
}

export interface StockMovementListOptions {
  page?: number;
  pageSize?: number;
  productId?: number;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: number;
  sortBy?: 'timestamp' | 'quantity' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export interface InventoryListResult {
  success: boolean;
  items?: InventoryItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  error?: string;
}

export interface StockMovementListResult {
  success: boolean;
  movements?: StockMovement[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  error?: string;
}

/**
 * Inventory Service (Renderer)
 * Handles inventory management API calls via IPC
 */
export class InventoryService {
  /**
   * Get inventory item by product ID
   */
  static async getByProductId(
    productId: number,
    requestedById: number
  ): Promise<{ success: boolean; inventory?: InventoryItem; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'inventory:getByProductId',
        productId,
        requestedById
      ) as { success: boolean; inventory?: InventoryItem; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get inventory list
   */
  static async getList(
    options: InventoryListOptions,
    requestedById: number
  ): Promise<InventoryListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'inventory:getList',
        options,
        requestedById
      ) as InventoryListResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Initialize inventory for a product
   */
  static async initializeInventory(
    productId: number,
    initialQuantity: number,
    reorderLevel: number,
    requestedById: number
  ): Promise<{ success: boolean; inventory?: InventoryItem; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'inventory:initialize',
        productId,
        initialQuantity,
        reorderLevel,
        requestedById
      ) as { success: boolean; inventory?: InventoryItem; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update inventory
   */
  static async updateInventory(
    input: UpdateInventoryInput,
    requestedById: number
  ): Promise<{ success: boolean; inventory?: InventoryItem; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'inventory:update',
        input,
        requestedById
      ) as { success: boolean; inventory?: InventoryItem; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Adjust stock
   */
  static async adjustStock(
    input: AdjustStockInput,
    requestedById: number
  ): Promise<{
    success: boolean;
    inventory?: InventoryItem;
    movement?: StockMovement;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'inventory:adjustStock',
        input,
        requestedById
      ) as {
        success: boolean;
        inventory?: InventoryItem;
        movement?: StockMovement;
        error?: string;
      };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get stock movements
   */
  static async getStockMovements(
    options: StockMovementListOptions,
    requestedById: number
  ): Promise<StockMovementListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'inventory:getStockMovements',
        options,
        requestedById
      ) as StockMovementListResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get low stock items
   */
  static async getLowStockItems(
    options: Omit<InventoryListOptions, 'lowStockOnly' | 'outOfStockOnly'>,
    requestedById: number
  ): Promise<InventoryListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'inventory:getLowStockItems',
        options,
        requestedById
      ) as InventoryListResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get out of stock items
   */
  static async getOutOfStockItems(
    options: Omit<InventoryListOptions, 'lowStockOnly' | 'outOfStockOnly'>,
    requestedById: number
  ): Promise<InventoryListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'inventory:getOutOfStockItems',
        options,
        requestedById
      ) as InventoryListResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get low stock count (for dashboard)
   */
  static async getLowStockCount(): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('inventory:getLowStockCount') as { success: boolean; count?: number; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        count: 0,
      };
    }
  }

  /**
   * Get out of stock count (for dashboard)
   */
  static async getOutOfStockCount(): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('inventory:getOutOfStockCount') as { success: boolean; count?: number; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        count: 0,
      };
    }
  }
}

