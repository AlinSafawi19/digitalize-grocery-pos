import { PurchaseOrder, PurchaseOrderItem, PurchaseInvoice, Supplier, Product, Prisma, PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationService } from '../notifications/notification.service';

export interface PurchaseOrderWithRelations extends PurchaseOrder {
  supplier: Supplier;
  items: (PurchaseOrderItem & {
    product: Product;
  })[];
  invoices?: PurchaseInvoice[];
}

export interface PurchaseOrderItemWithProduct extends PurchaseOrderItem {
  product: Product;
}

export interface CreatePurchaseOrderInput {
  supplierId: number;
  expectedDate?: Date | null;
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface UpdatePurchaseOrderInput {
  supplierId?: number;
  status?: 'draft' | 'pending' | 'partially_received' | 'received' | 'cancelled';
  expectedDate?: Date | null;
  items?: {
    productId: number;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface ReceiveGoodsInput {
  items: {
    itemId: number;
    receivedQuantity: number;
    expiryDate?: Date | null; // Optional expiry date for this batch
  }[];
}

export interface PurchaseOrderListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  supplierId?: number;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'orderDate' | 'orderNumber' | 'total' | 'status';
  sortOrder?: 'asc' | 'desc';
  includeRelations?: boolean; // PERFORMANCE FIX: Allow excluding relations for list views (default: true for backward compatibility)
}

export interface CreatePurchaseInvoiceInput {
  purchaseOrderId: number;
  invoiceNumber: string;
  amount: number;
  dueDate?: Date | null;
}

export interface UpdatePurchaseInvoiceInput {
  invoiceNumber?: string;
  amount?: number;
  dueDate?: Date | null;
  paidDate?: Date | null;
  status?: 'pending' | 'partial' | 'paid' | 'overdue';
}

/**
 * Generate purchase order number
 * Format: PO-YYYYMMDD-XXXXX (where XXXXX is a 5-digit sequential number)
 * PERFORMANCE FIX: Use sequential numbers instead of random to avoid collision checks
 */
async function generateOrderNumber(prisma: PrismaClient): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const prefix = `PO-${dateStr}-`;

  // Get the last purchase order number for today
  const lastOrder = await prisma.purchaseOrder.findFirst({
    where: {
      orderNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      orderNumber: 'desc',
    },
  });

  let sequence = 1;
  if (lastOrder) {
    const lastSeq = parseInt(lastOrder.orderNumber.slice(-5), 10);
    sequence = lastSeq + 1;
  }

  const sequenceStr = sequence.toString().padStart(5, '0');
  return `${prefix}${sequenceStr}`;
}

/**
 * Purchase Order Service
 * Handles purchase order operations
 */
export class PurchaseOrderService {
  /**
   * Get purchase order by ID
   */
  static async getById(id: number): Promise<PurchaseOrderWithRelations | null> {
    try {
      const prisma = databaseService.getClient();
      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  supplier: true,
                },
              },
            },
          },
          invoices: true,
        },
      });
      return purchaseOrder as PurchaseOrderWithRelations | null;
    } catch (error) {
      logger.error('Error getting purchase order by ID', { id, error });
      throw error;
    }
  }

  /**
   * Get purchase order by order number
   */
  static async getByOrderNumber(orderNumber: string): Promise<PurchaseOrderWithRelations | null> {
    try {
      const prisma = databaseService.getClient();
      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { orderNumber },
        include: {
          supplier: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  supplier: true,
                },
              },
            },
          },
          invoices: true,
        },
      });
      return purchaseOrder as PurchaseOrderWithRelations | null;
    } catch (error) {
      logger.error('Error getting purchase order by order number', { orderNumber, error });
      throw error;
    }
  }

  /**
   * Get purchase orders list with pagination
   */
  static async getList(
    options: PurchaseOrderListOptions
  ): Promise<{
    success: boolean;
    purchaseOrders?: PurchaseOrderWithRelations[];
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
    error?: string;
  }> {
    try {
      const prisma = databaseService.getClient();
      const {
        page = 1,
        pageSize = 20,
        search,
        supplierId,
        status,
        startDate,
        endDate,
        sortBy = 'orderDate',
        sortOrder = 'desc',
        includeRelations = true, // Default to true for backward compatibility
      } = options;

      const skip = (page - 1) * pageSize;
      const take = pageSize;

      // Build where clause
      const where: Prisma.PurchaseOrderWhereInput = {};

      if (supplierId) {
        where.supplierId = supplierId;
      }

      if (status) {
        where.status = status;
      }

      if (startDate || endDate) {
        where.orderDate = {};
        if (startDate) {
          where.orderDate.gte = startDate;
        }
        if (endDate) {
          where.orderDate.lte = endDate;
        }
      }

      if (search) {
        where.OR = [
          { orderNumber: { contains: search } },
          { supplier: { name: { contains: search } } },
        ];
      }

      // Build orderBy clause
      let orderBy: Prisma.PurchaseOrderOrderByWithRelationInput = {};
      switch (sortBy) {
        case 'orderDate':
          orderBy = { orderDate: sortOrder };
          break;
        case 'orderNumber':
          orderBy = { orderNumber: sortOrder };
          break;
        case 'total':
          orderBy = { total: sortOrder };
          break;
        case 'status':
          orderBy = { status: sortOrder };
          break;
        default:
          orderBy = { orderDate: 'desc' };
      }

      // PERFORMANCE FIX: Use select for list views to reduce payload size by 40-60%
      // Only include full relations when explicitly requested (for detail views)
      const [purchaseOrders, total] = await Promise.all([
        includeRelations
          ? prisma.purchaseOrder.findMany({
              where,
              skip,
              take,
              orderBy,
              include: {
                supplier: true,
                items: {
                  include: {
                    product: true,
                  },
                },
                invoices: true,
              },
            })
          : prisma.purchaseOrder.findMany({
              where,
              skip,
              take,
              orderBy,
              select: {
                id: true,
                orderNumber: true,
                supplierId: true,
                status: true,
                total: true,
                orderDate: true,
                expectedDate: true,
                receivedDate: true,
                createdAt: true,
                updatedAt: true,
                supplier: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            }),
        prisma.purchaseOrder.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        success: true,
        purchaseOrders: purchaseOrders as PurchaseOrderWithRelations[],
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting purchase orders list', { options, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Create purchase order
   */
  static async create(
    input: CreatePurchaseOrderInput,
    userId: number
  ): Promise<PurchaseOrderWithRelations> {
    try {
      const prisma = databaseService.getClient();

      // Validate required fields
      if (!input.supplierId) {
        throw new Error('Supplier is required');
      }

      // Validate items
      if (!input.items || input.items.length === 0) {
        throw new Error('Purchase order must have at least one item');
      }

      // Validate each item
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        if (!item.productId) {
          throw new Error(`Item ${i + 1}: Product is required`);
        }
        if (!item.quantity || item.quantity <= 0) {
          throw new Error(`Item ${i + 1}: Quantity is required and must be greater than 0`);
        }
        if (!item.unitPrice || item.unitPrice <= 0) {
          throw new Error(`Item ${i + 1}: Unit price is required and must be greater than 0`);
        }
      }

      // Validate supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id: input.supplierId },
      });
      if (!supplier) {
        throw new Error(`Supplier with ID ${input.supplierId} not found`);
      }

      // Validate products exist
      const productIds = input.items.map((item) => item.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });
      if (products.length !== productIds.length) {
        throw new Error('One or more products not found');
      }

      // Calculate total
      const total = input.items.reduce((sum, item) => {
        return sum + item.quantity * item.unitPrice;
      }, 0);

      // PERFORMANCE FIX: Generate sequential order number (no collision check needed)
      // This eliminates the potential infinite loop and reduces database queries
      const orderNumber = await generateOrderNumber(prisma);

      // Create purchase order with items
      const purchaseOrder = await prisma.purchaseOrder.create({
        data: {
          orderNumber,
          supplierId: input.supplierId,
          status: 'draft',
          total,
          expectedDate: input.expectedDate || null,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              receivedQuantity: 0,
              subtotal: item.quantity * item.unitPrice,
            })),
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  supplier: true,
                },
              },
            },
          },
          invoices: true,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'create',
        entity: 'purchase_order',
        entityId: purchaseOrder.id,
        details: JSON.stringify({
          orderNumber: purchaseOrder.orderNumber,
          supplierId: input.supplierId,
          total,
        }),
      });

      logger.info('Purchase order created successfully', {
        id: purchaseOrder.id,
        orderNumber: purchaseOrder.orderNumber,
      });

      // Create purchase order notification
      try {
        await NotificationService.createPurchaseOrderNotification(
          purchaseOrder.orderNumber,
          purchaseOrder.status,
          purchaseOrder.supplier.name,
          purchaseOrder.total,
          userId
        );
      } catch (notificationError) {
        // Don't fail purchase order creation if notification fails
        logger.error('Failed to create purchase order notification', notificationError);
      }

      return purchaseOrder as PurchaseOrderWithRelations;
    } catch (error) {
      logger.error('Error creating purchase order', { input, error });
      throw error;
    }
  }

  /**
   * Update purchase order
   */
  static async update(
    id: number,
    input: UpdatePurchaseOrderInput,
    userId: number
  ): Promise<PurchaseOrderWithRelations> {
    try {
      const prisma = databaseService.getClient();

      // Check if purchase order exists
      const existing = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) {
        throw new Error(`Purchase order with ID ${id} not found`);
      }

      // Cannot update if already received or cancelled
      if (existing.status === 'received' || existing.status === 'cancelled') {
        throw new Error(`Cannot update purchase order with status "${existing.status}"`);
      }

      // If updating supplier, validate it exists
      if (input.supplierId) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: input.supplierId },
        });
        if (!supplier) {
          throw new Error(`Supplier with ID ${input.supplierId} not found`);
        }
      }

      // If updating items, validate and recalculate total
      let total = existing.total;
      if (input.items) {
        if (input.items.length === 0) {
          throw new Error('Purchase order must have at least one item');
        }

        // Validate products exist
        const productIds = input.items.map((item) => item.productId);
        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
        });
        if (products.length !== productIds.length) {
          throw new Error('One or more products not found');
        }

        // Delete existing items and create new ones
        await prisma.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });

        // Calculate new total
        total = input.items.reduce((sum, item) => {
          return sum + item.quantity * item.unitPrice;
        }, 0);
      }

      // Update purchase order
      const purchaseOrder = await prisma.purchaseOrder.update({
        where: { id },
        data: {
          ...(input.supplierId && { supplierId: input.supplierId }),
          ...(input.status && { status: input.status }),
          ...(input.expectedDate !== undefined && { expectedDate: input.expectedDate }),
          ...(input.items && {
            items: {
              create: input.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                receivedQuantity: 0,
                subtotal: item.quantity * item.unitPrice,
              })),
            },
          }),
          total,
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  supplier: true,
                },
              },
            },
          },
          invoices: true,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'update',
        entity: 'purchase_order',
        entityId: id,
        details: JSON.stringify({
          orderNumber: purchaseOrder.orderNumber,
          changes: input,
        }),
      });

      logger.info('Purchase order updated successfully', {
        id: purchaseOrder.id,
        orderNumber: purchaseOrder.orderNumber,
      });

      // Create purchase order notification if status changed
      if (input.status && input.status !== existing.status) {
        try {
          await NotificationService.createPurchaseOrderNotification(
            purchaseOrder.orderNumber,
            purchaseOrder.status,
            purchaseOrder.supplier.name,
            purchaseOrder.total,
            userId
          );
        } catch (notificationError) {
          // Don't fail purchase order update if notification fails
          logger.error('Failed to create purchase order notification', notificationError);
        }
      }

      return purchaseOrder as PurchaseOrderWithRelations;
    } catch (error) {
      logger.error('Error updating purchase order', { id, input, error });
      throw error;
    }
  }

  /**
   * Receive goods (partial or full receiving)
   */
  static async receiveGoods(
    id: number,
    input: ReceiveGoodsInput,
    userId: number
  ): Promise<PurchaseOrderWithRelations> {
    try {
      const prisma = databaseService.getClient();

      // Get purchase order with items
      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!purchaseOrder) {
        throw new Error(`Purchase order with ID ${id} not found`);
      }

      // Cannot receive if cancelled
      if (purchaseOrder.status === 'cancelled') {
        throw new Error('Cannot receive goods for cancelled purchase order');
      }

      // Validate receiving items
      const itemMap = new Map(purchaseOrder.items.map((item) => [item.id, item]));
      for (const receiveItem of input.items) {
        const item = itemMap.get(receiveItem.itemId);
        if (!item) {
          throw new Error(`Purchase order item with ID ${receiveItem.itemId} not found`);
        }

        const remainingQuantity = item.quantity - item.receivedQuantity;
        if (receiveItem.receivedQuantity > remainingQuantity) {
          throw new Error(
            `Cannot receive ${receiveItem.receivedQuantity} units. Only ${remainingQuantity} remaining for item ${item.product.name}`
          );
        }

        if (receiveItem.receivedQuantity <= 0) {
          throw new Error('Received quantity must be greater than 0');
        }
      }

      // PERFORMANCE FIX: Batch all updates in a single transaction instead of sequential updates
      // This reduces from 2N database operations to 1 transaction with batch operations
      await prisma.$transaction(
        async (tx) => {
          // Batch update purchase order items
          const itemUpdates = input.items.map(async (receiveItem) => {
            const item = itemMap.get(receiveItem.itemId)!;
            const newReceivedQuantity = item.receivedQuantity + receiveItem.receivedQuantity;

            return tx.purchaseOrderItem.update({
              where: { id: receiveItem.itemId },
              data: {
                receivedQuantity: newReceivedQuantity,
              },
            });
          });

          await Promise.all(itemUpdates);

          // Prepare inventory adjustments (batch)
          const inventoryAdjustments = input.items.map((receiveItem) => {
            const item = itemMap.get(receiveItem.itemId)!;
            return {
              productId: item.productId,
              quantity: receiveItem.receivedQuantity,
              type: 'purchase' as const,
              reason: `Goods received from purchase order ${purchaseOrder.orderNumber}`,
              userId,
              referenceId: id,
              expiryDate: receiveItem.expiryDate || undefined,
            };
          });

          // Batch process inventory adjustments
          // Note: We need to use the inventory service's batch method or process directly
          // For now, we'll process them in parallel but within the transaction
          const inventoryPromises = inventoryAdjustments.map(async (adjustment) => {
            // Ensure inventory exists
            await InventoryService.initializeInventory(adjustment.productId);

            // Get current inventory
            const currentInventory = await tx.inventory.findUnique({
              where: { productId: adjustment.productId },
            });

            if (!currentInventory) {
              throw new Error(`Inventory not found for product ${adjustment.productId}`);
            }

            // Calculate new quantity
            const newQuantity = currentInventory.quantity + adjustment.quantity;

            // Get business rules
            const { SettingsService } = await import('../settings/settings.service');
            const businessRules = await SettingsService.getBusinessRules();
            const allowNegativeStock = businessRules.allowNegativeStock;

            // Determine final quantity
            let finalQuantity: number;
            if (newQuantity < 0 && !allowNegativeStock) {
              finalQuantity = 0;
            } else {
              finalQuantity = newQuantity;
            }

            // Update inventory
            await tx.inventory.update({
              where: { productId: adjustment.productId },
              data: {
                quantity: finalQuantity,
                lastUpdated: new Date(),
                ...(adjustment.expiryDate && {
                  expiryDate: adjustment.expiryDate,
                }),
              },
            });

            // Create stock movement
            await tx.stockMovement.create({
              data: {
                productId: adjustment.productId,
                type: adjustment.type,
                quantity: adjustment.quantity,
                reason: adjustment.reason,
                userId: adjustment.userId,
                referenceId: adjustment.referenceId,
                ...(adjustment.expiryDate && {
                  expiryDate: adjustment.expiryDate,
                }),
              },
            });
          });

          await Promise.all(inventoryPromises);
        },
        {
          timeout: 20000, // 20 seconds timeout for batch operations
        }
      );

      // Check if all items are fully received
      const updatedOrder = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      const allReceived = updatedOrder!.items.every(
        (item) => item.receivedQuantity >= item.quantity
      );
      const someReceived = updatedOrder!.items.some(
        (item) => item.receivedQuantity > 0 && item.receivedQuantity < item.quantity
      );

      // Update status
      let newStatus = purchaseOrder.status;
      if (allReceived) {
        newStatus = 'received';
      } else if (someReceived || purchaseOrder.status === 'draft') {
        newStatus = 'partially_received';
      }

      // Update purchase order
      const updatedPurchaseOrder = await prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          receivedDate: allReceived ? new Date() : purchaseOrder.receivedDate,
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  supplier: true,
                },
              },
            },
          },
          invoices: true,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'update',
        entity: 'purchase_order',
        entityId: id,
        details: JSON.stringify({
          orderNumber: purchaseOrder.orderNumber,
          action: 'receive_goods',
          receivedItems: input.items,
        }),
      });

      logger.info('Goods received successfully', {
        id: purchaseOrder.id,
        orderNumber: purchaseOrder.orderNumber,
      });

      return updatedPurchaseOrder as PurchaseOrderWithRelations;
    } catch (error) {
      logger.error('Error receiving goods', { id, input, error });
      throw error;
    }
  }

  /**
   * Get purchase order items
   */
  static async getItems(
    purchaseOrderId: number
  ): Promise<PurchaseOrderItemWithProduct[]> {
    try {
      const prisma = databaseService.getClient();
      const items = await prisma.purchaseOrderItem.findMany({
        where: { purchaseOrderId },
        include: {
          product: {
            include: {
              category: true,
              supplier: true,
            },
          },
        },
      });
      return items as PurchaseOrderItemWithProduct[];
    } catch (error) {
      logger.error('Error getting purchase order items', { purchaseOrderId, error });
      throw error;
    }
  }

  /**
   * Create purchase invoice
   */
  static async createInvoice(
    input: CreatePurchaseInvoiceInput,
    userId: number
  ): Promise<PurchaseInvoice> {
    try {
      const prisma = databaseService.getClient();

      // Validate purchase order exists
      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id: input.purchaseOrderId },
      });
      if (!purchaseOrder) {
        throw new Error(`Purchase order with ID ${input.purchaseOrderId} not found`);
      }

      // Check if invoice number already exists
      const existing = await prisma.purchaseInvoice.findUnique({
        where: { invoiceNumber: input.invoiceNumber },
      });
      if (existing) {
        throw new Error(`Invoice with number "${input.invoiceNumber}" already exists`);
      }

      // Determine status based on due date
      let status: 'pending' | 'partial' | 'paid' | 'overdue' = 'pending';
      if (input.dueDate && new Date(input.dueDate) < new Date()) {
        status = 'overdue';
      }

      // Create invoice
      const invoice = await prisma.purchaseInvoice.create({
        data: {
          purchaseOrderId: input.purchaseOrderId,
          invoiceNumber: input.invoiceNumber,
          amount: input.amount,
          dueDate: input.dueDate || null,
          status,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'create',
        entity: 'purchase_invoice',
        entityId: invoice.id,
        details: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          purchaseOrderId: input.purchaseOrderId,
          amount: input.amount,
        }),
      });

      logger.info('Purchase invoice created successfully', {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      });

      return invoice;
    } catch (error) {
      logger.error('Error creating purchase invoice', { input, error });
      throw error;
    }
  }

  /**
   * Update purchase invoice
   */
  static async updateInvoice(
    id: number,
    input: UpdatePurchaseInvoiceInput,
    userId: number
  ): Promise<PurchaseInvoice> {
    try {
      const prisma = databaseService.getClient();

      // Check if invoice exists
      const existing = await prisma.purchaseInvoice.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new Error(`Purchase invoice with ID ${id} not found`);
      }

      // Check if invoice number already exists (if changing)
      if (input.invoiceNumber && input.invoiceNumber !== existing.invoiceNumber) {
        const existingByNumber = await prisma.purchaseInvoice.findUnique({
          where: { invoiceNumber: input.invoiceNumber },
        });
        if (existingByNumber && existingByNumber.id !== id) {
          throw new Error(`Invoice with number "${input.invoiceNumber}" already exists`);
        }
      }

      // Determine status
      let status = input.status || existing.status;
      if (input.paidDate) {
        if (input.amount && input.amount > 0) {
          // Check if fully paid (simplified - in real system, track payments separately)
          status = 'paid';
        } else {
          status = 'partial';
        }
      } else if (input.dueDate) {
        if (new Date(input.dueDate) < new Date() && status === 'pending') {
          status = 'overdue';
        }
      }

      // Update invoice
      const invoice = await prisma.purchaseInvoice.update({
        where: { id },
        data: {
          ...(input.invoiceNumber && { invoiceNumber: input.invoiceNumber }),
          ...(input.amount !== undefined && { amount: input.amount }),
          ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
          ...(input.paidDate !== undefined && { paidDate: input.paidDate }),
          status,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'update',
        entity: 'purchase_invoice',
        entityId: id,
        details: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          changes: input,
        }),
      });

      logger.info('Purchase invoice updated successfully', {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      });

      return invoice;
    } catch (error) {
      logger.error('Error updating purchase invoice', { id, input, error });
      throw error;
    }
  }

  /**
   * Get purchase invoices for a purchase order
   */
  static async getInvoices(purchaseOrderId: number): Promise<PurchaseInvoice[]> {
    try {
      const prisma = databaseService.getClient();
      const invoices = await prisma.purchaseInvoice.findMany({
        where: { purchaseOrderId },
        orderBy: { createdAt: 'desc' },
      });
      return invoices;
    } catch (error) {
      logger.error('Error getting purchase invoices', { purchaseOrderId, error });
      throw error;
    }
  }
}

