import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  CategoryService,
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryListOptions,
} from '../services/category/category.service';

/**
 * Register category management IPC handlers
 */
export function registerCategoryHandlers(): void {
  logger.info('Registering category management IPC handlers...');

  /**
   * Get category by ID handler
   * IPC: category:getById
   */
  ipcMain.handle('category:getById', async (_event, categoryId: number) => {
    try {
      const category = await CategoryService.getById(categoryId);
      if (!category) {
        return {
          success: false,
          error: 'Category not found',
        };
      }

      return { success: true, category };
    } catch (error) {
      logger.error('Error in category:getById handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get all categories handler
   * IPC: category:getAll
   */
  ipcMain.handle('category:getAll', async () => {
    try {
      const categories = await CategoryService.getAll();
      return { success: true, categories };
    } catch (error) {
      logger.error('Error in category:getAll handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get categories list with pagination handler
   * IPC: category:getList
   */
  ipcMain.handle('category:getList', async (_event, options: CategoryListOptions) => {
    try {
      const result = await CategoryService.getList(options);
      return {
        success: true,
        categories: result.categories,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          totalItems: result.total,
          totalPages: result.totalPages,
          hasNextPage: result.page < result.totalPages,
          hasPreviousPage: result.page > 1,
        },
      };
    } catch (error) {
      logger.error('Error in category:getList handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get root categories handler
   * IPC: category:getRootCategories
   */
  ipcMain.handle('category:getRootCategories', async () => {
    try {
      const categories = await CategoryService.getRootCategories();
      return { success: true, categories };
    } catch (error) {
      logger.error('Error in category:getRootCategories handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get categories by parent handler
   * IPC: category:getByParent
   */
  ipcMain.handle('category:getByParent', async (_event, parentId: number) => {
    try {
      const categories = await CategoryService.getByParent(parentId);
      return { success: true, categories };
    } catch (error) {
      logger.error('Error in category:getByParent handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Create category handler
   * IPC: category:create
   */
  ipcMain.handle('category:create', async (_event, input: CreateCategoryInput, requestedById: number) => {
    try {
      const category = await CategoryService.create(input, requestedById);
      return { success: true, category };
    } catch (error) {
      logger.error('Error in category:create handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Update category handler
   * IPC: category:update
   */
  ipcMain.handle('category:update', async (_event, categoryId: number, input: UpdateCategoryInput, requestedById: number) => {
    try {
      const category = await CategoryService.update(categoryId, input, requestedById);
      return { success: true, category };
    } catch (error) {
      logger.error('Error in category:update handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Delete category handler
   * IPC: category:delete
   */
  ipcMain.handle('category:delete', async (_event, categoryId: number, requestedById: number) => {
    try {
      await CategoryService.delete(categoryId, requestedById);
      return { success: true };
    } catch (error) {
      logger.error('Error in category:delete handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });
}

