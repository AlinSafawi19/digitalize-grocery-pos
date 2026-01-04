import { StockTransfer, StockTransferItem, Location, Product, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';

export interface StockTransferWithRelations extends StockTransfer {
  fromLocation: Location;
  toLocation: Location;
  items: (StockTransferItem & {
    product: Product;
  })[];
  requester: {
    id: number;
    username: string;
  };
  approver?: {
    id: number;
    username: string;
  } | null;
  completer?: {
    id: number;
    username: string;
  } | null;
}

export interface CreateStockTransferInput {
  fromLocationId: number;
  toLocationId: number;
  notes?: string;
  items: {
    productId: number;
    quantity: number;
    notes?: string;
  }[];
}

export interface UpdateStockTransferInput {
  status?: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  notes?: string;
  items?: {
    productId: number;
    quantity: number;
    receivedQuantity?: number;
    notes?: string;
  }[];
}

export interface StockTransferListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  fromLocationId?: number;
  toLocationId?: number;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'requestedAt' | 'transferNumber' | 'status';
  sortOrder?: 'asc' | 'desc';
  includeRelations?: boolean;
}

/**
 * Generate stock transfer number
 * Format: ST-YYYYMMDD-XXXXX (where XXXXX is a 5-digit sequential number)
 */
async function generateTransferNumber(prisma: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const prefix = `ST-${dateStr}-`;

  // Get the last transfer number for today
  const lastTransfer = await prisma.stockTransfer.findFirst({
    where: {
      transferNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      transferNumber: 'desc',
    },
  });

  let sequence = 1;
  if (lastTransfer) {
    const lastSequence = parseInt(lastTransfer.transferNumber.slice(-5), 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  const sequenceStr = String(sequence).padStart(5, '0');
  return `${prefix}${sequenceStr}`;
}

/**
 * Stock Transfer Service
 * Handles stock transfers between locations
 */
export class StockTransferService {
  /**
   * Create a new stock transfer
   */
  static async createTransfer(
    input: CreateStockTransferInput,
    requestedById: number
  ): Promise<{ success: boolean; transfer?: StockTransferWithRelations; error?: string }> {
    try {
      const prisma = databaseService.getClient();
      const { fromLocationId, toLocationId, items, notes } = input;

      // Validate locations
      if (fromLocationId === toLocationId) {
        return {
          success: false,
          error: 'Source and destination locations cannot be the same',
        };
      }

      // Validate locations exist
      const [fromLocation, toLocation] = await Promise.all([
        prisma.location.findUnique({ where: { id: fromLocationId } }),
        prisma.location.findUnique({ where: { id: toLocationId } }),
      ]);

      if (!fromLocation || !toLocation) {
        return {
          success: false,
          error: 'One or both locations not found',
        };
      }

      if (!fromLocation.isActive || !toLocation.isActive) {
        return {
          success: false,
          error: 'One or both locations are inactive',
        };
      }

      // Validate items
      if (!items || items.length === 0) {
        return {
          success: false,
          error: 'Transfer must have at least one item',
        };
      }

      // Validate products exist and check stock availability
      const productIds = items.map((item) => item.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      if (products.length !== productIds.length) {
        return {
          success: false,
          error: 'One or more products not found',
        };
      }

      // Check stock availability at source location
      for (const item of items) {
        const inventoryLocation = await prisma.inventoryLocation.findUnique({
          where: {
            productId_locationId: {
              productId: item.productId,
              locationId: fromLocationId,
            },
          },
        });

        const availableQuantity = inventoryLocation?.quantity || 0;
        if (availableQuantity < item.quantity) {
          const product = products.find((p) => p.id === item.productId);
          return {
            success: false,
            error: `Insufficient stock for ${product?.name || 'product'}. Available: ${availableQuantity}, Requested: ${item.quantity}`,
          };
        }
      }

      // Create transfer in transaction
      const transfer = await prisma.$transaction(
        async (tx) => {
          const transferNumber = await generateTransferNumber(tx);

          // Create transfer
          const newTransfer = await tx.stockTransfer.create({
            data: {
              transferNumber,
              fromLocationId,
              toLocationId,
              notes,
              requestedById,
              status: 'pending',
              items: {
                create: items.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  receivedQuantity: 0,
                  notes: item.notes,
                })),
              },
            },
            include: {
              fromLocation: true,
              toLocation: true,
              items: {
                include: {
                  product: true,
                },
              },
              requester: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          });

          return newTransfer;
        },
        {
          timeout: 10000,
        }
      );

      // Log audit
      await AuditLogService.log({
        userId: requestedById,
        action: 'create',
        entity: 'stock_transfer',
        entityId: transfer.id,
        details: JSON.stringify({
          transferNumber: transfer.transferNumber,
          fromLocationId,
          toLocationId,
          itemCount: items.length,
        }),
      });

      logger.info('Stock transfer created', {
        transferId: transfer.id,
        transferNumber: transfer.transferNumber,
        fromLocationId,
        toLocationId,
      });

      return {
        success: true,
        transfer: transfer as StockTransferWithRelations,
      };
    } catch (error) {
      logger.error('Error creating stock transfer', { input, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get stock transfer by ID
   */
  static async getById(id: number): Promise<StockTransferWithRelations | null> {
    try {
      const prisma = databaseService.getClient();
      const transfer = await prisma.stockTransfer.findUnique({
        where: { id },
        include: {
          fromLocation: true,
          toLocation: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
          requester: {
            select: {
              id: true,
              username: true,
            },
          },
          approver: {
            select: {
              id: true,
              username: true,
            },
          },
          completer: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return transfer as StockTransferWithRelations | null;
    } catch (error) {
      logger.error('Error getting stock transfer by ID', { id, error });
      throw error;
    }
  }

  /**
   * Get stock transfers list with pagination
   */
  static async getList(
    options: StockTransferListOptions
  ): Promise<{
    success: boolean;
    transfers?: StockTransferWithRelations[];
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
        fromLocationId,
        toLocationId,
        status,
        startDate,
        endDate,
        sortBy = 'requestedAt',
        sortOrder = 'desc',
        includeRelations = true,
      } = options;

      const skip = (page - 1) * pageSize;
      const take = pageSize;

      // Build where clause
      const where: Prisma.StockTransferWhereInput = {};

      if (fromLocationId) {
        where.fromLocationId = fromLocationId;
      }

      if (toLocationId) {
        where.toLocationId = toLocationId;
      }

      if (status) {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { transferNumber: { contains: search } },
          { notes: { contains: search } },
        ];
      }

      if (startDate || endDate) {
        where.requestedAt = {};
        if (startDate) {
          where.requestedAt.gte = startDate;
        }
        if (endDate) {
          where.requestedAt.lte = endDate;
        }
      }

      // Build orderBy clause
      let orderBy: Prisma.StockTransferOrderByWithRelationInput = {};
      switch (sortBy) {
        case 'requestedAt':
          orderBy = { requestedAt: sortOrder };
          break;
        case 'transferNumber':
          orderBy = { transferNumber: sortOrder };
          break;
        case 'status':
          orderBy = { status: sortOrder };
          break;
        default:
          orderBy = { requestedAt: 'desc' };
      }

      // Get total count
      const total = await prisma.stockTransfer.count({ where });

      // Build include clause
      const include: Prisma.StockTransferInclude = includeRelations
        ? {
            fromLocation: true,
            toLocation: true,
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                  },
                },
              },
            },
            requester: {
              select: {
                id: true,
                username: true,
              },
            },
            approver: {
              select: {
                id: true,
                username: true,
              },
            },
            completer: {
              select: {
                id: true,
                username: true,
              },
            },
          }
        : {
            fromLocation: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            toLocation: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          };

      // Get transfers
      const transfers = await prisma.stockTransfer.findMany({
        where,
        skip,
        take,
        orderBy,
        include,
      });

      const totalPages = Math.ceil(total / pageSize);

      return {
        success: true,
        transfers: transfers as unknown as StockTransferWithRelations[],
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting stock transfer list', { options, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update stock transfer
   */
  static async updateTransfer(
    id: number,
    input: UpdateStockTransferInput,
    updatedById: number
  ): Promise<{ success: boolean; transfer?: StockTransferWithRelations; error?: string }> {
    try {
      const prisma = databaseService.getClient();
      const { status, notes } = input;

      // Get existing transfer
      const existingTransfer = await prisma.stockTransfer.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!existingTransfer) {
        return {
          success: false,
          error: 'Transfer not found',
        };
      }

      // Update transfer
      const updateData: Prisma.StockTransferUncheckedUpdateInput = {};
      if (status !== undefined) {
        updateData.status = status;
        if (status === 'completed' && existingTransfer.status !== 'completed') {
          updateData.completedAt = new Date();
          updateData.completedById = updatedById;
        }
      }
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const transfer = await prisma.stockTransfer.update({
        where: { id },
        data: updateData,
        include: {
          fromLocation: true,
          toLocation: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
          requester: {
            select: {
              id: true,
              username: true,
            },
          },
          approver: {
            select: {
              id: true,
              username: true,
            },
          },
          completer: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      // Log audit
      await AuditLogService.log({
        userId: updatedById,
        action: 'update',
        entity: 'stock_transfer',
        entityId: id,
        details: JSON.stringify({
          changes: updateData,
        }),
      });

      logger.info('Stock transfer updated', { transferId: id, updateData });
      return {
        success: true,
        transfer: transfer as StockTransferWithRelations,
      };
    } catch (error) {
      logger.error('Error updating stock transfer', { id, input, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Complete stock transfer (execute the transfer)
   * This moves stock from source location to destination location
   */
  static async completeTransfer(
    id: number,
    receivedItems: Array<{
      itemId: number;
      receivedQuantity: number;
    }>,
    completedById: number
  ): Promise<{ success: boolean; transfer?: StockTransferWithRelations; error?: string }> {
    try {
      const prisma = databaseService.getClient();

      // Get existing transfer
      const existingTransfer = await prisma.stockTransfer.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          fromLocation: true,
          toLocation: true,
        },
      });

      if (!existingTransfer) {
        return {
          success: false,
          error: 'Transfer not found',
        };
      }

      if (existingTransfer.status === 'completed') {
        return {
          success: false,
          error: 'Transfer is already completed',
        };
      }

      if (existingTransfer.status === 'cancelled') {
        return {
          success: false,
          error: 'Cannot complete a cancelled transfer',
        };
      }

      // Validate received items
      const itemMap = new Map(
        existingTransfer.items.map((item) => [item.id, item])
      );

      for (const receivedItem of receivedItems) {
        const transferItem = itemMap.get(receivedItem.itemId);
        if (!transferItem) {
          return {
            success: false,
            error: `Transfer item ${receivedItem.itemId} not found`,
          };
        }

        if (receivedItem.receivedQuantity > transferItem.quantity) {
          return {
            success: false,
            error: `Received quantity (${receivedItem.receivedQuantity}) cannot exceed transferred quantity (${transferItem.quantity})`,
          };
        }

        if (receivedItem.receivedQuantity < 0) {
          return {
            success: false,
            error: 'Received quantity cannot be negative',
          };
        }
      }

      // Execute transfer in transaction
      const transfer = await prisma.$transaction(
        async (tx) => {
          // Process each item
          for (const receivedItem of receivedItems) {
            const transferItem = itemMap.get(receivedItem.itemId)!;
            const quantity = receivedItem.receivedQuantity;

            if (quantity === 0) {
              continue;
            }

            // Update received quantity
            await tx.stockTransferItem.update({
              where: { id: receivedItem.itemId },
              data: {
                receivedQuantity: quantity,
              },
            });

            // Remove stock from source location
            await this.adjustLocationInventory(
              tx,
              transferItem.productId,
              existingTransfer.fromLocationId,
              -quantity,
              'transfer',
              `Stock transfer out: ${existingTransfer.transferNumber}`
            );

            // Add stock to destination location
            await this.adjustLocationInventory(
              tx,
              transferItem.productId,
              existingTransfer.toLocationId,
              quantity,
              'transfer',
              `Stock transfer in: ${existingTransfer.transferNumber}`
            );

            // Create stock movement records for both locations
            await tx.stockMovement.create({
              data: {
                productId: transferItem.productId,
                type: 'transfer',
                quantity: -quantity,
                reason: `Stock transfer out to ${existingTransfer.toLocation.name}: ${existingTransfer.transferNumber}`,
                userId: completedById,
                referenceId: id,
              },
            });

            await tx.stockMovement.create({
              data: {
                productId: transferItem.productId,
                type: 'transfer',
                quantity: quantity,
                reason: `Stock transfer in from ${existingTransfer.fromLocation.name}: ${existingTransfer.transferNumber}`,
                userId: completedById,
                referenceId: id,
              },
            });
          }

          // Update transfer status
          const updatedTransfer = await tx.stockTransfer.update({
            where: { id },
            data: {
              status: 'completed',
              completedAt: new Date(),
              completedById,
            },
            include: {
              fromLocation: true,
              toLocation: true,
              items: {
                include: {
                  product: {
                    include: {
                      category: true,
                    },
                  },
                },
              },
              requester: {
                select: {
                  id: true,
                  username: true,
                },
              },
              approver: {
                select: {
                  id: true,
                  username: true,
                },
              },
              completer: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          });

          return updatedTransfer;
        },
        {
          timeout: 15000,
        }
      );

      // Log audit
      await AuditLogService.log({
        userId: completedById,
        action: 'update',
        entity: 'stock_transfer',
        entityId: id,
        details: JSON.stringify({
          action: 'complete',
          transferNumber: transfer.transferNumber,
          receivedItemsCount: receivedItems.length,
        }),
      });

      logger.info('Stock transfer completed', {
        transferId: id,
        transferNumber: transfer.transferNumber,
        completedById,
      });

      return {
        success: true,
        transfer: transfer as StockTransferWithRelations,
      };
    } catch (error) {
      logger.error('Error completing stock transfer', { id, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Cancel stock transfer
   */
  static async cancelTransfer(
    id: number,
    cancelledById: number
  ): Promise<{ success: boolean; transfer?: StockTransferWithRelations; error?: string }> {
    try {
      const prisma = databaseService.getClient();

      // Get existing transfer
      const existingTransfer = await prisma.stockTransfer.findUnique({
        where: { id },
      });

      if (!existingTransfer) {
        return {
          success: false,
          error: 'Transfer not found',
        };
      }

      if (existingTransfer.status === 'completed') {
        return {
          success: false,
          error: 'Cannot cancel a completed transfer',
        };
      }

      if (existingTransfer.status === 'cancelled') {
        return {
          success: false,
          error: 'Transfer is already cancelled',
        };
      }

      // Update transfer status
      const transfer = await prisma.stockTransfer.update({
        where: { id },
        data: {
          status: 'cancelled',
        },
        include: {
          fromLocation: true,
          toLocation: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
          requester: {
            select: {
              id: true,
              username: true,
            },
          },
          approver: {
            select: {
              id: true,
              username: true,
            },
          },
          completer: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      // Log audit
      await AuditLogService.log({
        userId: cancelledById,
        action: 'update',
        entity: 'stock_transfer',
        entityId: id,
        details: JSON.stringify({
          action: 'cancel',
          transferNumber: transfer.transferNumber,
        }),
      });

      logger.info('Stock transfer cancelled', {
        transferId: id,
        transferNumber: transfer.transferNumber,
        cancelledById,
      });

      return {
        success: true,
        transfer: transfer as StockTransferWithRelations,
      };
    } catch (error) {
      logger.error('Error cancelling stock transfer', { id, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Helper method to adjust inventory at a specific location
   */
  private static async adjustLocationInventory(
    prisma: Prisma.TransactionClient,
    productId: number,
    locationId: number,
    quantity: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _type: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _reason: string
  ): Promise<void> {
    // Get or create inventory location
    const inventoryLocation = await prisma.inventoryLocation.findUnique({
      where: {
        productId_locationId: {
          productId,
          locationId,
        },
      },
    });

    if (inventoryLocation) {
      // Update existing inventory
      const newQuantity = inventoryLocation.quantity + quantity;
      await prisma.inventoryLocation.update({
        where: {
          productId_locationId: {
            productId,
            locationId,
          },
        },
        data: {
          quantity: newQuantity >= 0 ? newQuantity : 0,
          lastUpdated: new Date(),
        },
      });
    } else {
      // Create new inventory location if quantity is positive
      if (quantity > 0) {
        await prisma.inventoryLocation.create({
          data: {
            productId,
            locationId,
            quantity,
            lastUpdated: new Date(),
          },
        });
      }
    }
  }
}

