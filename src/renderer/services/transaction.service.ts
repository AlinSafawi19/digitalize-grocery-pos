export interface TransactionItemInput {
  productId: number;
  quantity: number;
  unitPrice?: number;
  discount?: number;
  transactionType?: 'sale' | 'return'; // Transaction type for this item
}

export interface CreateTransactionInput {
  type?: 'sale' | 'return';
  items: TransactionItemInput[];
  discount?: number;
  cashierId: number;
}

export interface PaymentInput {
  amount: number;
  received: number;
}

export interface User {
  id: number;
  username: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: number;
  code: string;
  name: string;
  price: number;
  currency: string;
}

export interface TransactionItem {
  id: number;
  transactionId: number;
  productId: number | null; // Made nullable to support deleted products
  quantity: number;
  unitPrice: number;
  currency: string;
  discount: number;
  tax: number;
  subtotal: number;
  total: number;
  subtotalUsd?: number;
  subtotalLbp?: number;
  taxUsd?: number;
  taxLbp?: number;
  totalUsd?: number;
  totalLbp?: number;
  productName?: string; // Snapshot of product name at time of transaction
  productCode?: string; // Snapshot of product code at time of transaction
  product?: Product;
}

export interface Payment {
  id: number;
  transactionId: number;
  amount: number;
  currency: string;
  received: number;
  change: number;
  amountUsd?: number;
  amountLbp?: number;
  receivedUsd?: number;
  receivedLbp?: number;
  changeUsd?: number;
  changeLbp?: number;
  timestamp: Date;
}

export interface Transaction {
  id: number;
  transactionNumber: string;
  type: string;
  status: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  // Dual currency fields
  subtotalUsd?: number;
  subtotalLbp?: number;
  taxUsd?: number;
  taxLbp?: number;
  discountUsd?: number;
  discountLbp?: number;
  totalUsd?: number;
  totalLbp?: number;
  cashierId: number;
  createdAt: Date;
  updatedAt: Date;
  cashier?: User;
  items?: TransactionItem[];
  payments?: Payment[];
}

export interface TransactionListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'pending' | 'completed' | 'voided';
  type?: 'sale' | 'return';
  cashierId?: number;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'createdAt' | 'total' | 'transactionNumber';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionListResult {
  success: boolean;
  transactions?: Transaction[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  error?: string;
}

/**
 * Transaction Service (Renderer)
 * Handles transaction management API calls via IPC
 */
export class TransactionService {
  /**
   * Create transaction
   */
  static async createTransaction(
    input: CreateTransactionInput,
    requestedById: number
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'transaction:create',
        input,
        requestedById
      ) as { success: boolean; transaction?: Transaction; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Add payment to transaction
   */
  static async addPayment(
    transactionId: number,
    payment: PaymentInput,
    requestedById: number
  ): Promise<{ success: boolean; payment?: Payment; transaction?: Transaction; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'transaction:addPayment',
        transactionId,
        payment,
        requestedById
      ) as { success: boolean; payment?: Payment; transaction?: Transaction; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get transaction by ID
   */
  static async getTransactionById(
    transactionId: number,
    requestedById: number
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'transaction:getById',
        transactionId,
        requestedById
      ) as { success: boolean; transaction?: Transaction; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get transaction by transaction number
   */
  static async getTransactionByNumber(
    transactionNumber: string,
    requestedById: number
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'transaction:getByTransactionNumber',
        transactionNumber,
        requestedById
      ) as { success: boolean; transaction?: Transaction; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get transactions list
   */
  static async getTransactions(
    options: TransactionListOptions,
    requestedById: number
  ): Promise<TransactionListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'transaction:getList',
        options,
        requestedById
      ) as TransactionListResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get transactions by date range
   */
  static async getTransactionsByDateRange(
    startDate: Date,
    endDate: Date,
    options: Omit<TransactionListOptions, 'startDate' | 'endDate'>,
    requestedById: number
  ): Promise<TransactionListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'transaction:getByDateRange',
        startDate,
        endDate,
        options,
        requestedById
      ) as TransactionListResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Void transaction
   */
  static async voidTransaction(
    transactionId: number,
    reason: string | undefined,
    requestedById: number
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'transaction:void',
        transactionId,
        reason,
        requestedById
      ) as { success: boolean; transaction?: Transaction; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(
    options: TransactionListOptions,
    requestedById: number
  ): Promise<TransactionListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'transaction:getHistory',
        options,
        requestedById
      ) as TransactionListResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

}

