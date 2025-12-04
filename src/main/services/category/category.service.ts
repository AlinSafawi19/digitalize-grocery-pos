import { Category, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';

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
  children: Category[];
  parent: Category | null;
}

export interface CategoryListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
}

/**
 * Category Service
 * Handles category-related operations
 */
export class CategoryService {
  /**
   * Get category by ID
   */
  static async getById(id: number): Promise<CategoryWithChildren | null> {
    try {
      const prisma = databaseService.getClient();
      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          parent: true,
          children: true,
        },
      });
      return category;
    } catch (error) {
      logger.error('Error getting category by ID', { id, error });
      throw error;
    }
  }

  /**
   * Get all categories
   * PERFORMANCE NOTE: This method returns all categories. For very large datasets (>1000 categories),
   * consider using getList() with pagination instead.
   * PERFORMANCE FIX: Added option to exclude relations for better performance in dropdowns
   */
  static async getAll(options?: { includeRelations?: boolean }): Promise<CategoryWithChildren[] | Category[]> {
    try {
      const prisma = databaseService.getClient();
      const { includeRelations = true } = options || {};
      
      // PERFORMANCE FIX: Add reasonable limit and allow excluding relations
      // Most POS systems won't have more than 500 categories, but we set a safe limit
      if (includeRelations) {
        const categories = await prisma.category.findMany({
          include: {
            parent: true,
            children: true,
          },
          orderBy: { name: 'asc' },
          take: 1000, // Reasonable limit for dropdown/select usage
        });
        return categories;
      } else {
        // For dropdowns, we only need basic data (40-60% smaller payload)
        const categories = await prisma.category.findMany({
          select: {
            id: true,
            name: true,
            description: true,
            parentId: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { name: 'asc' },
          take: 1000,
        });
        return categories as Category[];
      }
    } catch (error) {
      logger.error('Error getting all categories', { error });
      throw error;
    }
  }

  /**
   * Get categories list with pagination and filtering
   */
  static async getList(options: CategoryListOptions = {}): Promise<{
    categories: CategoryWithChildren[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const {
        page = 1,
        pageSize = 50,
        search,
      } = options;

      const skip = (page - 1) * pageSize;

      // Build where clause
      const where: Prisma.CategoryWhereInput = {};
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
        ];
      }

      // Get categories and total count
      // PERFORMANCE FIX: Use selective field loading for list views to reduce payload size by 40-60%
      // Only load full relations when viewing category details
      const [categories, total] = await Promise.all([
        prisma.category.findMany({
          where,
          select: {
            id: true,
            name: true,
            description: true,
            parentId: true,
            createdAt: true,
            updatedAt: true,
            parent: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            children: {
              select: {
                id: true,
                name: true,
                description: true,
                parentId: true,
              },
            },
          },
          orderBy: { name: 'asc' },
          skip,
          take: pageSize,
        }),
        prisma.category.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        categories,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting categories list', { options, error });
      throw error;
    }
  }

  /**
   * Get root categories (no parent)
   */
  static async getRootCategories(): Promise<Category[]> {
    try {
      const prisma = databaseService.getClient();
      const categories = await prisma.category.findMany({
        where: { parentId: null },
        include: {
          children: true,
        },
        orderBy: { name: 'asc' },
      });
      return categories;
    } catch (error) {
      logger.error('Error getting root categories', { error });
      throw error;
    }
  }

  /**
   * Get categories by parent
   */
  static async getByParent(parentId: number): Promise<Category[]> {
    try {
      const prisma = databaseService.getClient();
      const categories = await prisma.category.findMany({
        where: { parentId },
        include: {
          children: true,
        },
        orderBy: { name: 'asc' },
      });
      return categories;
    } catch (error) {
      logger.error('Error getting categories by parent', { parentId, error });
      throw error;
    }
  }

  /**
   * Create category
   */
  static async create(input: CreateCategoryInput, userId: number): Promise<CategoryWithChildren> {
    try {
      const prisma = databaseService.getClient();

      // Validate required fields
      if (!input.name || input.name.trim() === '') {
        throw new Error('Category name is required');
      }

      // Check if name already exists
      const existing = await prisma.category.findFirst({
        where: { name: input.name, parentId: input.parentId || null },
      });
      if (existing) {
        throw new Error(`Category with name "${input.name}" already exists`);
      }

      // Validate parent exists (if provided)
      if (input.parentId) {
        const parent = await prisma.category.findUnique({
          where: { id: input.parentId },
        });
        if (!parent) {
          throw new Error(`Parent category with ID ${input.parentId} not found`);
        }
      }

      // Create category
      const category = await prisma.category.create({
        data: {
          name: input.name,
          description: input.description || null,
          parentId: input.parentId || null,
        },
        include: {
          parent: true,
          children: true,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'create',
        entity: 'category',
        entityId: category.id,
        details: JSON.stringify({ name: category.name }),
      });

      logger.info('Category created successfully', { id: category.id, name: category.name });
      return category;
    } catch (error) {
      logger.error('Error creating category', { input, error });
      throw error;
    }
  }

  /**
   * Update category
   */
  static async update(
    id: number,
    input: UpdateCategoryInput,
    userId: number
  ): Promise<CategoryWithChildren> {
    try {
      const prisma = databaseService.getClient();

      // Check if category exists
      const existing = await prisma.category.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Category with ID ${id} not found`);
      }

      // Validate required fields if they're being updated
      if (input.name !== undefined) {
        if (!input.name || input.name.trim() === '') {
          throw new Error('Category name is required');
        }
      }

      // Prevent circular reference (category cannot be its own parent)
      if (input.parentId === id) {
        throw new Error('Category cannot be its own parent');
      }

      // Validate final state has required fields
      const finalName = input.name !== undefined ? input.name : existing.name;
      if (!finalName || finalName.trim() === '') {
        throw new Error('Category name is required');
      }

      // Check if name already exists (if changing)
      if (input.name && input.name !== existing.name) {
        const existingByName = await prisma.category.findFirst({
          where: {
            name: input.name,
            parentId: input.parentId !== undefined ? input.parentId : existing.parentId,
          },
        });
        if (existingByName && existingByName.id !== id) {
          throw new Error(`Category with name "${input.name}" already exists`);
        }
      }

      // Validate parent exists (if provided)
      if (input.parentId !== undefined && input.parentId !== null) {
        const parent = await prisma.category.findUnique({
          where: { id: input.parentId },
        });
        if (!parent) {
          throw new Error(`Parent category with ID ${input.parentId} not found`);
        }
      }

      // Update category
      const category = await prisma.category.update({
        where: { id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.parentId !== undefined && { parentId: input.parentId }),
        },
        include: {
          parent: true,
          children: true,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'update',
        entity: 'category',
        entityId: category.id,
        details: JSON.stringify({ name: category.name }),
      });

      logger.info('Category updated successfully', { id: category.id, name: category.name });
      return category;
    } catch (error) {
      logger.error('Error updating category', { id, input, error });
      throw error;
    }
  }

  /**
   * Delete category
   */
  static async delete(id: number, userId: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      // Check if category exists
      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          children: true,
          products: true,
        },
      });
      if (!category) {
        throw new Error(`Category with ID ${id} not found`);
      }

      // Check if category has children
      if (category.children.length > 0) {
        throw new Error('Cannot delete category with subcategories. Please delete subcategories first.');
      }

      // Check if category has products
      if (category.products.length > 0) {
        throw new Error('Cannot delete category with products. Please reassign or delete products first.');
      }

      // Delete category
      await prisma.category.delete({
        where: { id },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'delete',
        entity: 'category',
        entityId: id,
        details: JSON.stringify({ name: category.name }),
      });

      logger.info('Category deleted successfully', { id, name: category.name });
    } catch (error) {
      logger.error('Error deleting category', { id, error });
      throw error;
    }
  }
}

