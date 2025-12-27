export interface SupplierContact {
  id: number;
  supplierId: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  supplier?: {
    id: number;
    name: string;
  };
}

export interface CreateSupplierContactInput {
  supplierId: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

export interface UpdateSupplierContactInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

export interface SupplierContactListOptions {
  supplierId?: number;
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface SupplierContactListResult {
  success: boolean;
  contacts?: SupplierContact[];
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
 * Supplier Contact Service (Renderer)
 * Handles supplier contact management API calls via IPC
 */
export class SupplierContactService {
  /**
   * Get contact by ID
   */
  static async getContactById(contactId: number): Promise<{ success: boolean; contact?: SupplierContact; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierContact:getById', contactId);
      return result as { success: boolean; contact?: SupplierContact; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get contacts list
   */
  static async getContacts(options: SupplierContactListOptions): Promise<SupplierContactListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierContact:getList', options);
      return result as SupplierContactListResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get contacts by supplier ID
   */
  static async getContactsBySupplierId(supplierId: number): Promise<{ success: boolean; contacts?: SupplierContact[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierContact:getBySupplierId', supplierId);
      return result as { success: boolean; contacts?: SupplierContact[]; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Create contact
   */
  static async createContact(input: CreateSupplierContactInput, createdBy: number): Promise<{ success: boolean; contact?: SupplierContact; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierContact:create', input, createdBy);
      return result as { success: boolean; contact?: SupplierContact; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update contact
   */
  static async updateContact(id: number, input: UpdateSupplierContactInput, updatedBy: number): Promise<{ success: boolean; contact?: SupplierContact; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierContact:update', id, input, updatedBy);
      return result as { success: boolean; contact?: SupplierContact; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete contact
   */
  static async deleteContact(id: number, deletedBy: number): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierContact:delete', id, deletedBy);
      return result as { success: boolean; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Set contact as primary
   */
  static async setPrimaryContact(id: number, requestedBy: number): Promise<{ success: boolean; contact?: SupplierContact; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierContact:setPrimary', id, requestedBy);
      return result as { success: boolean; contact?: SupplierContact; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

