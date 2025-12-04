export interface Product {
  id: number;
  code: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: number | null;
  unit: string;
  price: number;
  costPrice: number | null;
  currency: string;
  supplierId: number | null;
  createdAt: Date;
  updatedAt: Date;
  category: Category | null;
  supplier: Supplier | null;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  barcode?: string | null;
  name: string;
  description?: string | null;
  categoryId?: number | null;
  unit?: string;
  price: number;
  costPrice?: number | null;
  currency?: string;
  supplierId?: number | null;
}

export interface UpdateProductInput {
  barcode?: string | null;
  name?: string;
  description?: string | null;
  categoryId?: number | null;
  unit?: string;
  price?: number;
  costPrice?: number | null;
  currency?: string;
  supplierId?: number | null;
}

export interface ProductListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: number;
  supplierId?: number;
  sortBy?: 'name' | 'barcode' | 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ProductListResult {
  success: boolean;
  products?: Product[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  error?: string;
}

/**
 * Product Service (Renderer)
 * Handles product management API calls via IPC
 */
export class ProductService {
  /**
   * Get product by ID
   */
  static async getProductById(productId: number, requestedById: number): Promise<{ success: boolean; product?: Product; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('product:getById', productId, requestedById) as { success: boolean; product?: Product; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get product by barcode
   */
  static async getProductByBarcode(barcode: string, requestedById: number): Promise<{ success: boolean; product?: Product; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('product:getByBarcode', barcode, requestedById) as { success: boolean; product?: Product; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get products list
   */
  static async getProducts(options: ProductListOptions, requestedById: number): Promise<ProductListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('product:getList', options, requestedById) as ProductListResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Search products
   */
  static async searchProducts(query: string, limit: number, requestedById: number): Promise<{ success: boolean; products?: Product[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('product:search', query, limit, requestedById) as { success: boolean; products?: Product[]; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get products by category
   */
  static async getProductsByCategory(categoryId: number, options: ProductListOptions, requestedById: number): Promise<ProductListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('product:getByCategory', categoryId, options, requestedById) as ProductListResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Create product
   */
  static async createProduct(input: CreateProductInput, createdBy: number): Promise<{ success: boolean; product?: Product; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('product:create', input, createdBy) as { success: boolean; product?: Product; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update product
   */
  static async updateProduct(id: number, input: UpdateProductInput, updatedBy: number): Promise<{ success: boolean; product?: Product; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('product:update', id, input, updatedBy) as { success: boolean; product?: Product; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete product
   */
  static async deleteProduct(id: number, deletedBy: number): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('product:delete', id, deletedBy) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Bulk delete products
   * PERFORMANCE FIX: Batch delete multiple products in a single IPC call
   */
  static async bulkDeleteProducts(ids: number[], deletedBy: number): Promise<{
    success: boolean;
    successCount?: number;
    failedCount?: number;
    errors?: Array<{ id: number; error: string }>;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('product:bulkDelete', ids, deletedBy) as {
        success: boolean;
        success?: number;
        failed?: number;
        errors?: Array<{ id: number; error: string }>;
        error?: string;
      };
      return {
        success: result.success,
        successCount: result.success,
        failedCount: result.failed,
        errors: result.errors,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get all products for export
   */
  static async getAllProductsForExport(requestedById: number): Promise<{ success: boolean; products?: Product[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('product:getAllForExport', requestedById) as { success: boolean; products?: Product[]; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Bulk create products
   */
  static async bulkCreateProducts(
    products: CreateProductInput[],
    createdBy: number
  ): Promise<{
    success: boolean;
    successCount?: number;
    failedCount?: number;
    errors?: Array<{ row: number; error: string }>;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('product:bulkCreate', products, createdBy) as {
        success: boolean;
        successCount?: number;
        failedCount?: number;
        errors?: Array<{ row: number; error: string }>;
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
}

