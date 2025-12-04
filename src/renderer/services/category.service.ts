import { Category } from './product.service';

export type { Category };

export interface CreateCategoryInput {
  name: string;
  description?: string | null;
  parentId?: number | null;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  parentId?: number | null;
}

export interface CategoryWithChildren extends Category {
  children?: Category[];
  parent?: Category | null;
}

export interface CategoryListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface CategoryListResult {
  success: boolean;
  categories?: CategoryWithChildren[];
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
 * Category Service (Renderer)
 * Handles category management API calls via IPC
 */
export class CategoryService {
  /**
   * Get category by ID
   */
  static async getCategoryById(categoryId: number, requestedById: number): Promise<{ success: boolean; category?: CategoryWithChildren; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('category:getById', categoryId, requestedById) as { success: boolean; category?: CategoryWithChildren; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get all categories
   */
  static async getAllCategories(requestedById: number): Promise<{ success: boolean; categories?: CategoryWithChildren[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('category:getAll', requestedById) as { success: boolean; categories?: CategoryWithChildren[]; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get categories list with pagination
   */
  static async getCategoriesList(options: CategoryListOptions, requestedById: number): Promise<CategoryListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('category:getList', options, requestedById) as CategoryListResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get root categories
   */
  static async getRootCategories(requestedById: number): Promise<{ success: boolean; categories?: Category[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('category:getRootCategories', requestedById) as { success: boolean; categories?: Category[]; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get categories by parent
   */
  static async getCategoriesByParent(parentId: number, requestedById: number): Promise<{ success: boolean; categories?: Category[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('category:getByParent', parentId, requestedById) as { success: boolean; categories?: Category[]; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Create category
   */
  static async createCategory(input: CreateCategoryInput, createdBy: number): Promise<{ success: boolean; category?: CategoryWithChildren; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('category:create', input, createdBy) as { success: boolean; category?: CategoryWithChildren; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update category
   */
  static async updateCategory(id: number, input: UpdateCategoryInput, updatedBy: number): Promise<{ success: boolean; category?: CategoryWithChildren; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('category:update', id, input, updatedBy) as { success: boolean; category?: CategoryWithChildren; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete category
   */
  static async deleteCategory(id: number, deletedBy: number): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('category:delete', id, deletedBy) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

