export interface SupplierDocument {
  id: number;
  supplierId: number;
  fileName: string;
  filePath: string;
  category?: string | null;
  mimeType?: string | null;
  size?: number | null;
  expiryDate?: Date | null;
  description?: string | null;
  uploadedAt: Date;
  updatedAt: Date;
  supplier?: {
    id: number;
    name: string;
  };
}

export interface UploadDocumentInput {
  supplierId: number;
  filePath: string;
  fileName: string;
  category?: string;
  description?: string;
  expiryDate?: Date | null;
}

export interface UpdateDocumentInput {
  category?: string;
  description?: string;
  expiryDate?: Date | null;
}

export interface SupplierDocumentListOptions {
  supplierId?: number;
  category?: string;
  expiredOnly?: boolean;
  expiringSoon?: boolean;
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface SupplierDocumentListResult {
  success: boolean;
  documents?: SupplierDocument[];
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
 * Supplier Document Service (Renderer)
 * Handles supplier document management API calls via IPC
 */
export class SupplierDocumentService {
  /**
   * Get document by ID
   */
  static async getDocumentById(documentId: number): Promise<{ success: boolean; document?: SupplierDocument; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierDocument:getById', documentId);
      return result as { success: boolean; document?: SupplierDocument; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get documents list
   */
  static async getDocuments(options: SupplierDocumentListOptions): Promise<SupplierDocumentListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierDocument:getList', options);
      return result as SupplierDocumentListResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get documents by supplier ID
   */
  static async getDocumentsBySupplierId(supplierId: number): Promise<{ success: boolean; documents?: SupplierDocument[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierDocument:getBySupplierId', supplierId);
      return result as { success: boolean; documents?: SupplierDocument[]; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get expired documents
   */
  static async getExpiredDocuments(): Promise<{ success: boolean; documents?: SupplierDocument[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierDocument:getExpired');
      return result as { success: boolean; documents?: SupplierDocument[]; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get documents expiring soon
   */
  static async getExpiringSoonDocuments(): Promise<{ success: boolean; documents?: SupplierDocument[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierDocument:getExpiringSoon');
      return result as { success: boolean; documents?: SupplierDocument[]; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Show file selection dialog
   */
  static async showSelectDialog(): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierDocument:showSelectDialog');
      return result as { success: boolean; filePath?: string; canceled?: boolean; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Copy file to temporary location
   */
  static async copyToTemp(sourcePath: string): Promise<{ success: boolean; tempPath?: string; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierDocument:copyToTemp', sourcePath);
      return result as { success: boolean; tempPath?: string; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Upload document
   */
  static async uploadDocument(input: UploadDocumentInput, uploadedBy: number): Promise<{ success: boolean; document?: SupplierDocument; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierDocument:upload', input, uploadedBy);
      return result as { success: boolean; document?: SupplierDocument; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update document
   */
  static async updateDocument(id: number, input: UpdateDocumentInput, updatedBy: number): Promise<{ success: boolean; document?: SupplierDocument; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierDocument:update', id, input, updatedBy);
      return result as { success: boolean; document?: SupplierDocument; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete document
   */
  static async deleteDocument(id: number, deletedBy: number): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierDocument:delete', id, deletedBy);
      return result as { success: boolean; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get document file path
   */
  static async getDocumentFilePath(documentId: number): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierDocument:getFilePath', documentId);
      return result as { success: boolean; filePath?: string; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get document categories
   */
  static async getCategories(): Promise<{ success: boolean; categories?: string[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('supplierDocument:getCategories');
      return result as { success: boolean; categories?: string[]; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

