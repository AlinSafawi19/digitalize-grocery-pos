import { Supplier } from './product.service';
import { PurchaseOrder, PurchaseInvoice } from './purchase-order.service';

export interface CreateSupplierInput {
  name: string;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface UpdateSupplierInput {
  name?: string;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface SupplierListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface SupplierListResult {
  success: boolean;
  suppliers?: Supplier[];
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  error?: string;
}

/**
 * Supplier Service (Renderer)
 * Handles supplier management API calls via IPC
 */
export class SupplierService {
  /**
   * Get supplier by ID
   */
  static async getSupplierById(supplierId: number, requestedById: number): Promise<{ success: boolean; supplier?: Supplier; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplier:getById', supplierId, requestedById);
      return result as { success: boolean; supplier?: Supplier; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get suppliers list
   */
  static async getSuppliers(options: SupplierListOptions, requestedById: number): Promise<SupplierListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplier:getList', options, requestedById);
      return result as SupplierListResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get all suppliers
   */
  static async getAllSuppliers(requestedById: number): Promise<{ success: boolean; suppliers?: Supplier[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplier:getAll', requestedById);
      return result as { success: boolean; suppliers?: Supplier[]; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Create supplier
   */
  static async createSupplier(input: CreateSupplierInput, createdBy: number): Promise<{ success: boolean; supplier?: Supplier; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplier:create', input, createdBy);
      return result as { success: boolean; supplier?: Supplier; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update supplier
   */
  static async updateSupplier(id: number, input: UpdateSupplierInput, updatedBy: number): Promise<{ success: boolean; supplier?: Supplier; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplier:update', id, input, updatedBy);
      return result as { success: boolean; supplier?: Supplier; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete supplier
   */
  static async deleteSupplier(id: number, deletedBy: number): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplier:delete', id, deletedBy);
      return result as { success: boolean; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get purchase orders for supplier
   */
  static async getSupplierPurchaseOrders(
    supplierId: number,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: string;
      sortBy?: 'orderDate' | 'orderNumber' | 'total' | 'status';
      sortOrder?: 'asc' | 'desc';
    },
    requestedById: number
  ): Promise<{
    success: boolean;
    purchaseOrders?: PurchaseOrder[];
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'supplier:getPurchaseOrders',
        supplierId,
        options,
        requestedById
      );
      return result as {
        success: boolean;
        purchaseOrders?: PurchaseOrder[];
        total?: number;
        page?: number;
        pageSize?: number;
        totalPages?: number;
        error?: string;
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get supplier performance statistics
   */
  static async getSupplierPerformanceStats(
    supplierId: number
  ): Promise<{
    success: boolean;
    stats?: {
      totalOrders: number;
      totalSpent: number;
      averageOrderValue: number;
      ordersThisMonth: number;
      ordersThisYear: number;
      totalInvoices: number;
      paidInvoices: number;
      pendingInvoices: number;
      overdueInvoices: number;
      totalPaid: number;
      totalPending: number;
      totalOverdue: number;
    };
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'supplier:getPerformanceStats',
        supplierId
      );
      return result as {
        success: boolean;
        stats?: {
          totalOrders: number;
          totalSpent: number;
          averageOrderValue: number;
          ordersThisMonth: number;
          ordersThisYear: number;
          totalInvoices: number;
          paidInvoices: number;
          pendingInvoices: number;
          overdueInvoices: number;
          totalPaid: number;
          totalPending: number;
          totalOverdue: number;
        };
        error?: string;
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get supplier payment history
   */
  static async getSupplierPaymentHistory(
    supplierId: number,
    options: {
      page?: number;
      pageSize?: number;
      startDate?: Date;
      endDate?: Date;
    },
    requestedById: number
  ): Promise<{
    success: boolean;
    invoices?: PurchaseInvoice[];
    pagination?: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'supplier:getPaymentHistory',
        supplierId,
        options,
        requestedById
      );
      return result as {
        success: boolean;
        invoices?: PurchaseInvoice[];
        pagination?: {
          page: number;
          pageSize: number;
          totalItems: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
        error?: string;
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

