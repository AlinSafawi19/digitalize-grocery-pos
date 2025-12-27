export interface ReceiptTemplateData {
  header?: {
    storeName?: string;
    address?: string;
    phone?: string;
    logo?: string;
    customText?: string;
  };
  items?: {
    showHeaders?: boolean;
    showSeparator?: boolean;
    columns?: {
      description?: boolean;
      quantity?: boolean;
      unitPrice?: boolean;
      total?: boolean;
    };
  };
  totals?: {
    showSubtotal?: boolean;
    showDiscount?: boolean;
    showTax?: boolean;
    showTotalUSD?: boolean;
    showTotalLBP?: boolean;
  };
  footer?: {
    thankYouMessage?: string;
    showCashier?: boolean;
    showPoweredBy?: boolean;
    customText?: string;
  };
  layout?: {
    paperWidth?: number;
    fontSize?: number;
    lineSpacing?: number;
  };
}

export interface ReceiptTemplate {
  id: number;
  name: string;
  description?: string | null;
  template: string; // JSON string
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number;
  updatedBy?: number | null;
  creator?: {
    id: number;
    username: string;
  };
  updater?: {
    id: number;
    username: string;
  };
}

export interface CreateReceiptTemplateInput {
  name: string;
  description?: string;
  template: ReceiptTemplateData;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateReceiptTemplateInput {
  name?: string;
  description?: string;
  template?: ReceiptTemplateData;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface ReceiptTemplateListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}

export interface ReceiptTemplateListResult {
  success: boolean;
  templates?: ReceiptTemplate[];
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
 * Receipt Template Service (Renderer)
 * Handles receipt template management API calls via IPC
 */
export class ReceiptTemplateService {
  /**
   * Get template by ID
   */
  static async getTemplateById(templateId: number): Promise<{ success: boolean; template?: ReceiptTemplate; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('receiptTemplate:getById', templateId);
      return result as { success: boolean; template?: ReceiptTemplate; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get default template
   */
  static async getDefaultTemplate(): Promise<{ success: boolean; template?: ReceiptTemplate; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('receiptTemplate:getDefault');
      return result as { success: boolean; template?: ReceiptTemplate; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get templates list
   */
  static async getTemplates(options: ReceiptTemplateListOptions): Promise<ReceiptTemplateListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('receiptTemplate:getList', options);
      return result as ReceiptTemplateListResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get active templates
   */
  static async getActiveTemplates(): Promise<{ success: boolean; templates?: ReceiptTemplate[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('receiptTemplate:getActiveTemplates');
      return result as { success: boolean; templates?: ReceiptTemplate[]; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Create template
   */
  static async createTemplate(input: CreateReceiptTemplateInput, createdBy: number): Promise<{ success: boolean; template?: ReceiptTemplate; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('receiptTemplate:create', input, createdBy);
      return result as { success: boolean; template?: ReceiptTemplate; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update template
   */
  static async updateTemplate(id: number, input: UpdateReceiptTemplateInput, updatedBy: number): Promise<{ success: boolean; template?: ReceiptTemplate; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('receiptTemplate:update', id, input, updatedBy);
      return result as { success: boolean; template?: ReceiptTemplate; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete template
   */
  static async deleteTemplate(id: number, deletedBy: number): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('receiptTemplate:delete', id, deletedBy);
      return result as { success: boolean; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Set template as default
   */
  static async setDefaultTemplate(id: number, requestedBy: number): Promise<{ success: boolean; template?: ReceiptTemplate; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('receiptTemplate:setDefault', id, requestedBy);
      return result as { success: boolean; template?: ReceiptTemplate; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Parse template JSON
   */
  static parseTemplate(templateString: string): ReceiptTemplateData {
    try {
      return JSON.parse(templateString);
    } catch {
      return {};
    }
  }

  /**
   * Get default template data structure
   */
  static getDefaultTemplateData(): ReceiptTemplateData {
    return {
      header: {
        storeName: '',
        address: '',
        phone: '',
        customText: '',
      },
      items: {
        showHeaders: true,
        showSeparator: true,
        columns: {
          description: true,
          quantity: true,
          unitPrice: true,
          total: true,
        },
      },
      totals: {
        showSubtotal: true,
        showDiscount: true,
        showTax: true,
        showTotalUSD: true,
        showTotalLBP: true,
      },
      footer: {
        thankYouMessage: 'Thank you for your purchase! We hope to see you again soon!',
        showCashier: true,
        showPoweredBy: true,
        customText: '',
      },
      layout: {
        paperWidth: 80,
        fontSize: 12,
        lineSpacing: 1,
      },
    };
  }
}

