import { Product } from './product.service';
import { Supplier } from './product.service';

// Purchase Order Types
export interface PurchaseOrder {
  id: number;
  orderNumber: string;
  supplierId: number;
  status: 'draft' | 'pending' | 'partially_received' | 'received' | 'cancelled';
  total: number;
  orderDate: Date;
  expectedDate: Date | null;
  receivedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  supplier: Supplier;
  items: PurchaseOrderItem[];
  invoices?: PurchaseInvoice[];
}

export interface PurchaseOrderItem {
  id: number;
  purchaseOrderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;
  subtotal: number;
  product: Product;
}

export interface PurchaseInvoice {
  id: number;
  purchaseOrderId: number;
  invoiceNumber: string;
  amount: number;
  dueDate: Date | null;
  paidDate: Date | null;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePurchaseOrderInput {
  supplierId: number;
  expectedDate?: Date | null;
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface UpdatePurchaseOrderInput {
  supplierId?: number;
  status?: 'draft' | 'pending' | 'partially_received' | 'received' | 'cancelled';
  expectedDate?: Date | null;
  items?: {
    productId: number;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface ReceiveGoodsInput {
  items: {
    itemId: number;
    receivedQuantity: number;
    expiryDate?: Date | null; // Optional expiry date for this batch
  }[];
}

export interface PurchaseOrderListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  supplierId?: number;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'orderDate' | 'orderNumber' | 'total' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface CreatePurchaseInvoiceInput {
  purchaseOrderId: number;
  invoiceNumber: string;
  amount: number;
  dueDate?: Date | null;
}

export interface UpdatePurchaseInvoiceInput {
  invoiceNumber?: string;
  amount?: number;
  dueDate?: Date | null;
  paidDate?: Date | null;
  status?: 'pending' | 'partial' | 'paid' | 'overdue';
}

export interface PurchaseOrderListResult {
  success: boolean;
  purchaseOrders?: PurchaseOrder[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  error?: string;
}

/**
 * Purchase Order Service (Renderer)
 * Handles purchase order management API calls via IPC
 */
export class PurchaseOrderService {
  /**
   * Get purchase order by ID
   */
  static async getPurchaseOrderById(
    id: number,
    requestedById: number
  ): Promise<{ success: boolean; purchaseOrder?: PurchaseOrder; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchaseOrder:getById',
        id,
        requestedById
      );
      return result as { success: boolean; purchaseOrder?: PurchaseOrder; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get purchase orders list
   */
  static async getPurchaseOrders(
    options: PurchaseOrderListOptions,
    requestedById: number
  ): Promise<PurchaseOrderListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchaseOrder:getList',
        options,
        requestedById
      );
      return result as PurchaseOrderListResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Create purchase order
   */
  static async createPurchaseOrder(
    input: CreatePurchaseOrderInput,
    createdBy: number
  ): Promise<{ success: boolean; purchaseOrder?: PurchaseOrder; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchaseOrder:create',
        input,
        createdBy
      );
      return result as { success: boolean; purchaseOrder?: PurchaseOrder; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update purchase order
   */
  static async updatePurchaseOrder(
    id: number,
    input: UpdatePurchaseOrderInput,
    updatedBy: number
  ): Promise<{ success: boolean; purchaseOrder?: PurchaseOrder; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchaseOrder:update',
        id,
        input,
        updatedBy
      );
      return result as { success: boolean; purchaseOrder?: PurchaseOrder; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Receive goods
   */
  static async receiveGoods(
    id: number,
    input: ReceiveGoodsInput,
    receivedBy: number
  ): Promise<{ success: boolean; purchaseOrder?: PurchaseOrder; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchaseOrder:receiveGoods',
        id,
        input,
        receivedBy
      );
      return result as { success: boolean; purchaseOrder?: PurchaseOrder; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get purchase order items
   */
  static async getPurchaseOrderItems(
    purchaseOrderId: number,
    requestedById: number
  ): Promise<{ success: boolean; items?: PurchaseOrderItem[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchaseOrder:getItems',
        purchaseOrderId,
        requestedById
      );
      return result as { success: boolean; items?: PurchaseOrderItem[]; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Create purchase invoice
   */
  static async createPurchaseInvoice(
    input: CreatePurchaseInvoiceInput,
    createdBy: number
  ): Promise<{ success: boolean; invoice?: PurchaseInvoice; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchaseOrder:createInvoice',
        input,
        createdBy
      );
      return result as { success: boolean; invoice?: PurchaseInvoice; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update purchase invoice
   */
  static async updatePurchaseInvoice(
    id: number,
    input: UpdatePurchaseInvoiceInput,
    updatedBy: number
  ): Promise<{ success: boolean; invoice?: PurchaseInvoice; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchaseOrder:updateInvoice',
        id,
        input,
        updatedBy
      );
      return result as { success: boolean; invoice?: PurchaseInvoice; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get purchase invoices
   */
  static async getPurchaseInvoices(
    purchaseOrderId: number,
    requestedById: number
  ): Promise<{ success: boolean; invoices?: PurchaseInvoice[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchaseOrder:getInvoices',
        purchaseOrderId,
        requestedById
      );
      return result as { success: boolean; invoices?: PurchaseInvoice[]; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

