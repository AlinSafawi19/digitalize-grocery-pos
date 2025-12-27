import {
  PurchaseOrderTemplate,
  PurchaseOrderTemplateItem,
  Supplier,
  Product,
  User,
  Prisma,
} from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';

export interface PurchaseOrderTemplateWithRelations extends PurchaseOrderTemplate {
  supplier: Supplier;
  items: (PurchaseOrderTemplateItem & {
    product: Product;
  })[];
  creator: {
    id: number;
    username: string;
  };
}

export interface CreatePurchaseOrderTemplateInput {
  name: string;
  description?: string | null;
  supplierId: number;
  items: {
    productId: number;
    quantity: number;
    unitPrice?: number | null; // Optional - will use current product cost price if null
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

/**
 * Purchase Order Template Service
 * Handles purchase order template management
 */
export class PurchaseOrderTemplateService {
  /**
   * Create a new purchase order template
   */
  static async createTemplate(
    input: CreatePurchaseOrderTemplateInput,
    createdById: number
  ): Promise<PurchaseOrderTemplateWithRelations> {
    try {
      const prisma = databaseService.getClient();

      // Validate supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id: input.supplierId },
      });
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      // Validate products exist and get current cost prices
      const productIds = input.items.map((item) => item.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, costPrice: true },
      });

      if (products.length !== productIds.length) {
        throw new Error('One or more products not found');
      }

      // Create template with items
      const template = await prisma.purchaseOrderTemplate.create({
        data: {
          name: input.name,
          description: input.description,
          supplierId: input.supplierId,
          createdById,
          items: {
            create: input.items.map((item) => {
              const product = products.find((p) => p.id === item.productId);
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice ?? product?.costPrice ?? 0,
                notes: item.notes,
              };
            }),
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      // Audit log
      await AuditLogService.log({
        userId: createdById,
        action: 'create',
        entityType: 'purchase_order_template',
        entityId: template.id,
        details: {
          name: template.name,
          supplierId: template.supplierId,
          itemCount: template.items.length,
        },
      });

      logger.info('Purchase order template created', {
        templateId: template.id,
        name: template.name,
        supplierId: template.supplierId,
      });

      return template;
    } catch (error) {
      logger.error('Error creating purchase order template', { input, createdById, error });
      throw error;
    }
  }

  /**
   * Update a purchase order template
   */
  static async updateTemplate(
    templateId: number,
    input: UpdatePurchaseOrderTemplateInput,
    updatedById: number
  ): Promise<PurchaseOrderTemplateWithRelations> {
    try {
      const prisma = databaseService.getClient();

      // Check if template exists
      const existingTemplate = await prisma.purchaseOrderTemplate.findUnique({
        where: { id: templateId },
      });
      if (!existingTemplate) {
        throw new Error('Template not found');
      }

      // Validate supplier if provided
      if (input.supplierId) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: input.supplierId },
        });
        if (!supplier) {
          throw new Error('Supplier not found');
        }
      }

      // Validate products if items are being updated
      if (input.items) {
        const productIds = input.items.map((item) => item.productId);
        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, costPrice: true },
        });

        if (products.length !== productIds.length) {
          throw new Error('One or more products not found');
        }
      }

      // Update template
      const updateData: Prisma.PurchaseOrderTemplateUpdateInput = {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.supplierId && { supplierId: input.supplierId }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      };

      // Update items if provided
      if (input.items) {
        // Delete existing items
        await prisma.purchaseOrderTemplateItem.deleteMany({
          where: { purchaseOrderTemplateId: templateId },
        });

        // Create new items
        const productIds = input.items.map((item) => item.productId);
        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, costPrice: true },
        });

        updateData.items = {
          create: input.items.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return {
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice ?? product?.costPrice ?? 0,
              notes: item.notes,
            };
          }),
        };
      }

      const template = await prisma.purchaseOrderTemplate.update({
        where: { id: templateId },
        data: updateData,
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      // Audit log
      await AuditLogService.log({
        userId: updatedById,
        action: 'update',
        entityType: 'purchase_order_template',
        entityId: template.id,
        details: {
          name: template.name,
          supplierId: template.supplierId,
        },
      });

      logger.info('Purchase order template updated', {
        templateId: template.id,
        name: template.name,
      });

      return template;
    } catch (error) {
      logger.error('Error updating purchase order template', {
        templateId,
        input,
        updatedById,
        error,
      });
      throw error;
    }
  }

  /**
   * Delete a purchase order template
   */
  static async deleteTemplate(templateId: number, deletedById: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      const template = await prisma.purchaseOrderTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template) {
        throw new Error('Template not found');
      }

      // Delete template (items will be cascade deleted)
      await prisma.purchaseOrderTemplate.delete({
        where: { id: templateId },
      });

      // Audit log
      await AuditLogService.log({
        userId: deletedById,
        action: 'delete',
        entityType: 'purchase_order_template',
        entityId: templateId,
        details: {
          name: template.name,
          supplierId: template.supplierId,
        },
      });

      logger.info('Purchase order template deleted', { templateId });
    } catch (error) {
      logger.error('Error deleting purchase order template', { templateId, deletedById, error });
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  static async getTemplateById(
    templateId: number
  ): Promise<PurchaseOrderTemplateWithRelations | null> {
    try {
      const prisma = databaseService.getClient();

      const template = await prisma.purchaseOrderTemplate.findUnique({
        where: { id: templateId },
        include: {
          supplier: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return template;
    } catch (error) {
      logger.error('Error getting purchase order template', { templateId, error });
      throw error;
    }
  }

  /**
   * Get list of templates
   */
  static async getTemplates(
    options: PurchaseOrderTemplateListOptions = {}
  ): Promise<{
    templates: PurchaseOrderTemplateWithRelations[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const {
        page = 1,
        pageSize = 20,
        search,
        supplierId,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      const where: Prisma.PurchaseOrderTemplateWhereInput = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (supplierId) {
        where.supplierId = supplierId;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [templates, total] = await Promise.all([
        prisma.purchaseOrderTemplate.findMany({
          where,
          include: {
            supplier: true,
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                  },
                },
              },
            },
            creator: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: {
            [sortBy]: sortOrder,
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.purchaseOrderTemplate.count({ where }),
      ]);

      return {
        templates,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error('Error getting purchase order templates', { options, error });
      throw error;
    }
  }

  /**
   * Create a purchase order from a template
   */
  static async createOrderFromTemplate(
    templateId: number,
    expectedDate?: Date | null,
    createdById: number
  ): Promise<{
    template: PurchaseOrderTemplateWithRelations;
    orderInput: {
      supplierId: number;
      expectedDate?: Date | null;
      items: {
        productId: number;
        quantity: number;
        unitPrice: number;
      }[];
    };
  }> {
    try {
      const template = await this.getTemplateById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      if (!template.isActive) {
        throw new Error('Template is not active');
      }

      // Get current product cost prices (in case they've changed)
      const prisma = databaseService.getClient();
      const productIds = template.items.map((item) => item.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, costPrice: true },
      });

      // Build order input from template
      const orderInput = {
        supplierId: template.supplierId,
        expectedDate: expectedDate ?? null,
        items: template.items.map((item) => {
          const product = products.find((p) => p.id === item.productId);
          // Use current product cost price if available, otherwise use template price
          const unitPrice = product?.costPrice ?? item.unitPrice ?? 0;
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice,
          };
        }),
      };

      return {
        template,
        orderInput,
      };
    } catch (error) {
      logger.error('Error creating order from template', { templateId, createdById, error });
      throw error;
    }
  }
}

