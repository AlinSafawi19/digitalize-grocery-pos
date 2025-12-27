import { Product, Supplier } from './product.service';

export interface PurchaseOrderTemplate {
  id: number;
  name: string;
  description: string | null;
  supplierId: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  supplier: Supplier;
  items: PurchaseOrderTemplateItem[];
  creator: {
    id: number;
    username: string;
  };
}

export interface PurchaseOrderTemplateItem {
  id: number;
  purchaseOrderTemplateId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  product: Product;
}

export interface CreatePurchaseOrderTemplateInput {
  name: string;
  description?: string | null;
  supplierId: number;
  items: {
    productId: number;
    quantity: number;
    unitPrice?: number | null;
    notes?: string | null;
  }[];
}

export interface UpdatePurchaseOrderTemplateInput {
  name?: string;
  description?: string | null;
  supplierId?: number;
  isActive?: boolean;
  items?: {
    productId: number;
    quantity: number;
    unitPrice?: number | null;
    notes?: string | null;
  }[];
}

export interface PurchaseOrderTemplateListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  supplierId?: number;
  isActive?: boolean;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PurchaseOrderTemplateListResult {
  templates: PurchaseOrderTemplate[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Purchase Order Template Service (Renderer)
 * Handles purchase order template operations via IPC
 */
export class PurchaseOrderTemplateService {
  /**
   * Create a new template
   */
  static async create(
    input: CreatePurchaseOrderTemplateInput,
    createdById: number
  ): Promise<{ success: boolean; template?: PurchaseOrderTemplate; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchase-order-template:create',
        input,
        createdById
      ) as { success: boolean; template?: PurchaseOrderTemplate; error?: string };
      return result;
    } catch (error) {
      console.error('Error creating purchase order template:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update a template
   */
  static async update(
    templateId: number,
    input: UpdatePurchaseOrderTemplateInput,
    updatedById: number
  ): Promise<{ success: boolean; template?: PurchaseOrderTemplate; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchase-order-template:update',
        templateId,
        input,
        updatedById
      ) as { success: boolean; template?: PurchaseOrderTemplate; error?: string };
      return result;
    } catch (error) {
      console.error('Error updating purchase order template:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete a template
   */
  static async delete(
    templateId: number,
    deletedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchase-order-template:delete',
        templateId,
        deletedById
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      console.error('Error deleting purchase order template:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get template by ID
   */
  static async getById(
    templateId: number
  ): Promise<{ success: boolean; template?: PurchaseOrderTemplate; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchase-order-template:getById',
        templateId
      ) as { success: boolean; template?: PurchaseOrderTemplate; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting purchase order template:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get list of templates
   */
  static async getList(
    options: PurchaseOrderTemplateListOptions = {}
  ): Promise<{ success: boolean; templates?: PurchaseOrderTemplate[]; total?: number; page?: number; pageSize?: number; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchase-order-template:getList',
        options
      ) as PurchaseOrderTemplateListResult & { success: boolean; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting purchase order templates:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Create order from template
   */
  static async createOrderFromTemplate(
    templateId: number,
    expectedDate?: Date | null,
    createdById: number
  ): Promise<{
    success: boolean;
    template?: PurchaseOrderTemplate;
    orderInput?: {
      supplierId: number;
      expectedDate?: Date | null;
      items: {
        productId: number;
        quantity: number;
        unitPrice: number;
      }[];
    };
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'purchase-order-template:createOrderFromTemplate',
        templateId,
        expectedDate,
        createdById
      ) as {
        success: boolean;
        template?: PurchaseOrderTemplate;
        orderInput?: {
          supplierId: number;
          expectedDate?: Date | null;
          items: {
            productId: number;
            quantity: number;
            unitPrice: number;
          }[];
        };
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error creating order from template:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

