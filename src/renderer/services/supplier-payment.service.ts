import {
  CreateSupplierPaymentInput,
  UpdateSupplierPaymentInput,
  SupplierPaymentListOptions,
  SupplierBalanceSummary,
  PaymentReminder,
} from '../../main/services/supplier/supplier-payment.service';

export interface SupplierPayment {
  id: number;
  supplierId: number;
  purchaseInvoiceId: number | null;
  amount: number;
  currency: string;
  paymentDate: Date;
  paymentMethod: 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'other';
  referenceNumber: string | null;
  notes: string | null;
  recordedById: number;
  createdAt: Date;
  updatedAt: Date;
  supplier?: {
    id: number;
    name: string;
    contact: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  purchaseInvoice?: {
    id: number;
    invoiceNumber: string;
    amount: number;
    dueDate: Date | null;
    status: string;
    purchaseOrder?: {
      id: number;
      orderNumber: string;
      supplierId: number;
    };
  } | null;
}

/**
 * Supplier Payment Service (Renderer)
 * Handles supplier payment operations via IPC
 */
export class SupplierPaymentService {
  /**
   * Create a new supplier payment
   */
  static async createPayment(
    input: CreateSupplierPaymentInput,
    recordedById: number
  ): Promise<{ success: boolean; payment?: SupplierPayment; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'supplier-payment:create',
        input,
        recordedById
      ) as { success: boolean; payment?: SupplierPayment; error?: string };
      return result;
    } catch (error) {
      console.error('Error creating supplier payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get payment by ID
   */
  static async getById(id: number): Promise<{ success: boolean; payment?: SupplierPayment; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'supplier-payment:getById',
        id
      ) as { success: boolean; payment?: SupplierPayment; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting supplier payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get payments list
   */
  static async getList(
    options: SupplierPaymentListOptions = {}
  ): Promise<{
    success: boolean;
    payments?: SupplierPayment[];
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'supplier-payment:getList',
        options
      ) as {
        success: boolean;
        payments?: SupplierPayment[];
        total?: number;
        page?: number;
        pageSize?: number;
        totalPages?: number;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting supplier payments list:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update payment
   */
  static async updatePayment(
    id: number,
    input: UpdateSupplierPaymentInput,
    userId: number
  ): Promise<{ success: boolean; payment?: SupplierPayment; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'supplier-payment:update',
        id,
        input,
        userId
      ) as { success: boolean; payment?: SupplierPayment; error?: string };
      return result;
    } catch (error) {
      console.error('Error updating supplier payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete payment
   */
  static async deletePayment(
    id: number,
    userId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'supplier-payment:delete',
        id,
        userId
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      console.error('Error deleting supplier payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get supplier balance
   */
  static async getSupplierBalance(
    supplierId: number
  ): Promise<{ success: boolean; balance?: SupplierBalanceSummary; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'supplier-payment:getSupplierBalance',
        supplierId
      ) as { success: boolean; balance?: SupplierBalanceSummary; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting supplier balance:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get all supplier balances
   */
  static async getAllSupplierBalances(): Promise<{
    success: boolean;
    balances?: SupplierBalanceSummary[];
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'supplier-payment:getAllSupplierBalances'
      ) as { success: boolean; balances?: SupplierBalanceSummary[]; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting all supplier balances:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get payment reminders
   */
  static async getPaymentReminders(
    daysOverdue?: number
  ): Promise<{ success: boolean; reminders?: PaymentReminder[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'supplier-payment:getPaymentReminders',
        daysOverdue
      ) as { success: boolean; reminders?: PaymentReminder[]; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting payment reminders:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get invoice payments
   */
  static async getInvoicePayments(
    invoiceId: number
  ): Promise<{ success: boolean; payments?: SupplierPayment[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'supplier-payment:getInvoicePayments',
        invoiceId
      ) as { success: boolean; payments?: SupplierPayment[]; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting invoice payments:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

// Re-export types for convenience
export type {
  CreateSupplierPaymentInput,
  UpdateSupplierPaymentInput,
  SupplierPaymentListOptions,
  SupplierBalanceSummary,
  PaymentReminder,
};

