import { PricingRule, Promotion, Product, Category, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';

export interface PricingRuleWithRelations extends PricingRule {
  product?: Product | null;
  category?: Category | null;
  promotion?: Promotion | null;
}

export interface CreatePricingRuleInput {
  name: string;
  type: 'percentage_discount' | 'fixed_discount' | 'quantity_based' | 'buy_x_get_y' | 'time_based';
  productId?: number | null;
  categoryId?: number | null;
  promotionId?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minQuantity?: number;
  isActive?: boolean;
}

export interface UpdatePricingRuleInput {
  name?: string;
  type?: 'percentage_discount' | 'fixed_discount' | 'quantity_based' | 'buy_x_get_y' | 'time_based';
  productId?: number | null;
  categoryId?: number | null;
  promotionId?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  minQuantity?: number;
  isActive?: boolean;
}

export interface PricingRuleListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  productId?: number;
  categoryId?: number;
  type?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'createdAt' | 'startDate';
  sortOrder?: 'asc' | 'desc';
}

export interface CreatePromotionInput {
  name: string;
  description?: string | null;
  type: 'product_promotion' | 'category_promotion' | 'store_wide';
  startDate: Date;
  endDate: Date;
  isActive?: boolean;
}

export interface UpdatePromotionInput {
  name?: string;
  description?: string | null;
  type?: 'product_promotion' | 'category_promotion' | 'store_wide';
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
}

export interface PromotionListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'createdAt' | 'startDate';
  sortOrder?: 'asc' | 'desc';
}

export interface PromotionWithRules extends Promotion {
  pricingRules?: PricingRule[];
  pricingRulesCount?: number;
}

export interface ApplyPricingInput {
  productId: number;
  quantity: number;
  basePrice: number;
}

export interface AppliedPricing {
  originalPrice: number;
  discountedPrice: number;
  discountAmount: number;
  discountPercentage: number;
  appliedRule?: PricingRule;
}

/**
 * Pricing Service
 * Handles pricing rules, promotions, and discount calculations
 */
export class PricingService {
  /**
   * Get pricing rule by ID
   */
  static async getPricingRuleById(id: number): Promise<PricingRuleWithRelations | null> {
    try {
      const prisma = databaseService.getClient();
      const rule = await prisma.pricingRule.findUnique({
        where: { id },
        include: {
          product: true,
          category: true,
          promotion: true,
        },
      });
      return rule;
    } catch (error) {
      logger.error('Error getting pricing rule by ID', { id, error });
      throw error;
    }
  }

  /**
   * Get pricing rules list with pagination and filtering
   */
  static async getPricingRules(options: PricingRuleListOptions = {}): Promise<{
    rules: PricingRuleWithRelations[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const {
        page = 1,
        pageSize = 20,
        search,
        productId,
        categoryId,
        type,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      const skip = (page - 1) * pageSize;

      // Build where clause
      const where: Prisma.PricingRuleWhereInput = {};
      if (search) {
        where.name = { contains: search };
      }
      if (productId !== undefined) {
        where.productId = productId;
      }
      if (categoryId !== undefined) {
        where.categoryId = categoryId;
      }
      if (type) {
        where.type = type;
      }
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // Date filtering - only show active rules within date range
      const now = new Date();
      where.OR = [
        { startDate: null, endDate: null }, // No date restrictions
        { startDate: null, endDate: { gte: now } }, // No start, but end in future
        { startDate: { lte: now }, endDate: null }, // Started, no end
        { startDate: { lte: now }, endDate: { gte: now } }, // Currently active
      ];

      const [rules, total] = await Promise.all([
        prisma.pricingRule.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            product: true,
            category: true,
            promotion: true,
          },
        }),
        prisma.pricingRule.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        rules,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting pricing rules list', { options, error });
      throw error;
    }
  }

  /**
   * Create pricing rule
   */
  static async createPricingRule(
    input: CreatePricingRuleInput,
    createdBy: number
  ): Promise<PricingRuleWithRelations> {
    try {
      const prisma = databaseService.getClient();

      // Validate required fields
      if (!input.name || input.name.trim() === '') {
        throw new Error('Name is required');
      }

      // Validate discount value
      if (input.discountType === 'percentage') {
        if (input.discountValue === undefined || input.discountValue === null || input.discountValue < 0 || input.discountValue > 100) {
          throw new Error('Percentage discount is required and must be between 0 and 100');
        }
      } else {
        if (input.discountValue === undefined || input.discountValue === null || input.discountValue < 0) {
          throw new Error('Discount amount is required and must be greater than or equal to 0');
        }
      }

      // Validate minimum quantity
      if (input.minQuantity === undefined || input.minQuantity === null || input.minQuantity < 1) {
        throw new Error('Minimum quantity is required and must be at least 1');
      }

      // Validate: must have either productId or categoryId, but not both
      if (input.productId && input.categoryId) {
        throw new Error('Cannot specify both productId and categoryId');
      }
      if (!input.productId && !input.categoryId && input.type !== 'time_based') {
        throw new Error('Must specify either productId or categoryId for this rule type');
      }

      // Validate dates
      if (input.startDate && input.endDate && input.startDate > input.endDate) {
        throw new Error('Start date must be before end date');
      }

      const rule = await prisma.pricingRule.create({
        data: {
          name: input.name,
          type: input.type,
          productId: input.productId || null,
          categoryId: input.categoryId || null,
          promotionId: input.promotionId || null,
          startDate: input.startDate || null,
          endDate: input.endDate || null,
          discountType: input.discountType,
          discountValue: input.discountValue,
          minQuantity: input.minQuantity || 1,
          isActive: input.isActive !== undefined ? input.isActive : true,
        },
        include: {
          product: true,
          category: true,
          promotion: true,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId: createdBy,
        action: 'create',
        entity: 'pricing_rule',
        entityId: rule.id,
        details: JSON.stringify({ name: rule.name, type: rule.type }),
      });

      logger.info('Pricing rule created successfully', {
        id: rule.id,
        name: rule.name,
      });

      return rule;
    } catch (error) {
      logger.error('Error creating pricing rule', { input, error });
      throw error;
    }
  }

  /**
   * Update pricing rule
   */
  static async updatePricingRule(
    id: number,
    input: UpdatePricingRuleInput,
    updatedBy: number
  ): Promise<PricingRuleWithRelations> {
    try {
      const prisma = databaseService.getClient();

      // Check if rule exists
      const existingRule = await prisma.pricingRule.findUnique({
        where: { id },
      });

      if (!existingRule) {
        throw new Error('Pricing rule not found');
      }

      // Validate: must have either productId or categoryId, but not both
      if (input.productId !== undefined && input.categoryId !== undefined && input.productId && input.categoryId) {
        throw new Error('Cannot specify both productId and categoryId');
      }

      // Validate discount value
      if (input.discountType === 'percentage' && input.discountValue !== undefined) {
        if (input.discountValue < 0 || input.discountValue > 100) {
          throw new Error('Percentage discount must be between 0 and 100');
        }
      }
      if (input.discountType === 'fixed' && input.discountValue !== undefined) {
        if (input.discountValue < 0) {
          throw new Error('Fixed discount must be positive');
        }
      }

      // Validate dates
      const startDate = input.startDate !== undefined ? input.startDate : existingRule.startDate;
      const endDate = input.endDate !== undefined ? input.endDate : existingRule.endDate;
      if (startDate && endDate && startDate > endDate) {
        throw new Error('Start date must be before end date');
      }

      const rule = await prisma.pricingRule.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.productId !== undefined && { productId: input.productId }),
          ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
          ...(input.promotionId !== undefined && { promotionId: input.promotionId }),
          ...(input.startDate !== undefined && { startDate: input.startDate }),
          ...(input.endDate !== undefined && { endDate: input.endDate }),
          ...(input.discountType !== undefined && { discountType: input.discountType }),
          ...(input.discountValue !== undefined && { discountValue: input.discountValue }),
          ...(input.minQuantity !== undefined && { minQuantity: input.minQuantity }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        include: {
          product: true,
          category: true,
          promotion: true,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId: updatedBy,
        action: 'update',
        entity: 'pricing_rule',
        entityId: id,
        details: JSON.stringify({ changes: Object.keys(input) }),
      });

      logger.info('Pricing rule updated successfully', {
        id: rule.id,
        name: rule.name,
      });

      return rule;
    } catch (error) {
      logger.error('Error updating pricing rule', { id, input, error });
      throw error;
    }
  }

  /**
   * Delete pricing rule
   */
  static async deletePricingRule(id: number, deletedBy: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      // Check if rule exists
      const rule = await prisma.pricingRule.findUnique({
        where: { id },
      });

      if (!rule) {
        throw new Error('Pricing rule not found');
      }

      // Delete rule
      await prisma.pricingRule.delete({
        where: { id },
      });

      // Log audit
      await AuditLogService.log({
        userId: deletedBy,
        action: 'delete',
        entity: 'pricing_rule',
        entityId: id,
        details: JSON.stringify({ name: rule.name }),
      });

      logger.info('Pricing rule deleted successfully', {
        id,
        name: rule.name,
      });
    } catch (error) {
      logger.error('Error deleting pricing rule', { id, error });
      throw error;
    }
  }

  /**
   * Get promotion by ID
   */
  static async getPromotionById(id: number): Promise<PromotionWithRules | null> {
    try {
      const prisma = databaseService.getClient();
      const promotion = await prisma.promotion.findUnique({
        where: { id },
        include: {
          pricingRules: {
            include: {
              product: true,
              category: true,
            },
          },
        },
      });
      if (!promotion) return null;
      return {
        ...promotion,
        pricingRulesCount: promotion.pricingRules.length,
      };
    } catch (error) {
      logger.error('Error getting promotion by ID', { id, error });
      throw error;
    }
  }

  /**
   * Get promotions list with pagination and filtering
   */
  static async getPromotions(options: PromotionListOptions = {}): Promise<{
    promotions: PromotionWithRules[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const {
        page = 1,
        pageSize = 20,
        search,
        type,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      const skip = (page - 1) * pageSize;

      // Build where clause
      const where: Prisma.PromotionWhereInput = {};
      if (search) {
        where.name = { contains: search };
      }
      if (type) {
        where.type = type;
      }
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [promotions, total] = await Promise.all([
        prisma.promotion.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            _count: {
              select: {
                pricingRules: true,
              },
            },
          },
        }),
        prisma.promotion.count({ where }),
      ]);

      const promotionsWithCounts: PromotionWithRules[] = promotions.map((p) => ({
        ...p,
        pricingRules: [],
        pricingRulesCount: p._count.pricingRules,
      }));

      const totalPages = Math.ceil(total / pageSize);

      return {
        promotions: promotionsWithCounts,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting promotions list', { options, error });
      throw error;
    }
  }

  /**
   * Get active promotions
   */
  static async getActivePromotions(): Promise<Promotion[]> {
    try {
      const prisma = databaseService.getClient();
      const now = new Date();

      const promotions = await prisma.promotion.findMany({
        where: {
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        orderBy: { startDate: 'asc' },
      });

      return promotions;
    } catch (error) {
      logger.error('Error getting active promotions', { error });
      throw error;
    }
  }

  /**
   * Create promotion
   */
  static async createPromotion(
    input: CreatePromotionInput,
    createdBy: number
  ): Promise<Promotion> {
    try {
      const prisma = databaseService.getClient();

      // Validate required fields
      if (!input.name || input.name.trim() === '') {
        throw new Error('Name is required');
      }

      if (!input.startDate) {
        throw new Error('Start date is required');
      }

      if (!input.endDate) {
        throw new Error('End date is required');
      }

      // Validate dates
      if (input.startDate > input.endDate) {
        throw new Error('Start date must be before end date');
      }

      const promotion = await prisma.promotion.create({
        data: {
          name: input.name,
          description: input.description || null,
          type: input.type,
          startDate: input.startDate,
          endDate: input.endDate,
          isActive: input.isActive !== undefined ? input.isActive : true,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId: createdBy,
        action: 'create',
        entity: 'promotion',
        entityId: promotion.id,
        details: JSON.stringify({ name: promotion.name, type: promotion.type }),
      });

      logger.info('Promotion created successfully', {
        id: promotion.id,
        name: promotion.name,
      });

      return promotion;
    } catch (error) {
      logger.error('Error creating promotion', { input, error });
      throw error;
    }
  }

  /**
   * Update promotion
   */
  static async updatePromotion(
    id: number,
    input: UpdatePromotionInput,
    updatedBy: number
  ): Promise<Promotion> {
    try {
      const prisma = databaseService.getClient();

      // Check if promotion exists
      const existingPromotion = await prisma.promotion.findUnique({
        where: { id },
      });

      if (!existingPromotion) {
        throw new Error('Promotion not found');
      }

      // Validate dates
      const startDate = input.startDate !== undefined ? input.startDate : existingPromotion.startDate;
      const endDate = input.endDate !== undefined ? input.endDate : existingPromotion.endDate;
      if (startDate > endDate) {
        throw new Error('Start date must be before end date');
      }

      const promotion = await prisma.promotion.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.startDate !== undefined && { startDate: input.startDate }),
          ...(input.endDate !== undefined && { endDate: input.endDate }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });

      // Log audit
      await AuditLogService.log({
        userId: updatedBy,
        action: 'update',
        entity: 'promotion',
        entityId: id,
        details: JSON.stringify({ changes: Object.keys(input) }),
      });

      logger.info('Promotion updated successfully', {
        id: promotion.id,
        name: promotion.name,
      });

      return promotion;
    } catch (error) {
      logger.error('Error updating promotion', { id, input, error });
      throw error;
    }
  }

  /**
   * Delete promotion
   */
  static async deletePromotion(id: number, deletedBy: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      // Check if promotion exists
      const promotion = await prisma.promotion.findUnique({
        where: { id },
      });

      if (!promotion) {
        throw new Error('Promotion not found');
      }

      // Delete promotion
      await prisma.promotion.delete({
        where: { id },
      });

      // Log audit
      await AuditLogService.log({
        userId: deletedBy,
        action: 'delete',
        entity: 'promotion',
        entityId: id,
        details: JSON.stringify({ name: promotion.name }),
      });

      logger.info('Promotion deleted successfully', {
        id,
        name: promotion.name,
      });
    } catch (error) {
      logger.error('Error deleting promotion', { id, error });
      throw error;
    }
  }

  /**
   * Apply pricing rules to a product
   * This is the core pricing logic that determines the final price
   * @param input Pricing input with productId, quantity, and basePrice
   * @param userId Optional user ID for audit logging
   */
  static async applyPricingRules(
    input: ApplyPricingInput,
    userId?: number
  ): Promise<AppliedPricing> {
    try {
      const prisma = databaseService.getClient();
      const { productId, quantity, basePrice } = input;

      // Get product with category
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { category: true },
      });

      if (!product) {
        throw new Error('Product not found');
      }

      const now = new Date();
      let bestDiscount = 0;
      let appliedRule: PricingRule | undefined;

      // Get applicable pricing rules
      const applicableRules = await prisma.pricingRule.findMany({
        where: {
          isActive: true,
          AND: [
            {
              OR: [
                { startDate: null, endDate: null },
                { startDate: null, endDate: { gte: now } },
                { startDate: { lte: now }, endDate: null },
                { startDate: { lte: now }, endDate: { gte: now } },
              ],
            },
            {
              OR: [
                { productId: productId },
                { categoryId: product.categoryId },
                { productId: null, categoryId: null }, // Store-wide rules
              ],
            },
          ],
        },
        include: {
          product: true,
          category: true,
          promotion: true,
        },
      });

      // Filter out rules whose promotions are inactive or outside date range
      const rulesWithActivePromotions = applicableRules.filter((rule) => {
        // If rule is not linked to a promotion, it's always valid
        if (!rule.promotionId || !rule.promotion) {
          return true;
        }
        
        // If linked to a promotion, check if promotion is active and within date range
        const promotion = rule.promotion;
        if (!promotion.isActive) {
          return false;
        }
        
        // Check if promotion is within its date range
        const promotionStart = promotion.startDate;
        const promotionEnd = promotion.endDate;
        return promotionStart <= now && promotionEnd >= now;
      });

      // Filter rules that match quantity requirement
      const quantityMatchedRules = rulesWithActivePromotions.filter(
        (rule) => quantity >= (rule.minQuantity || 1)
      );

      // Apply each rule and find the best discount
      for (const rule of quantityMatchedRules) {
        let discount = 0;

        switch (rule.type) {
          case 'percentage_discount':
          case 'time_based':
            if (rule.discountType === 'percentage') {
              discount = (basePrice * rule.discountValue) / 100;
            } else {
              discount = rule.discountValue;
            }
            break;

          case 'fixed_discount':
            if (rule.discountType === 'percentage') {
              discount = (basePrice * rule.discountValue) / 100;
            } else {
              discount = rule.discountValue;
            }
            break;

          case 'quantity_based':
            // For quantity-based, discount applies per unit or total
            if (rule.discountType === 'percentage') {
              discount = (basePrice * quantity * rule.discountValue) / 100;
            } else {
              discount = rule.discountValue * quantity;
            }
            break;

          case 'buy_x_get_y': {
            // Buy X get Y free logic
            // minQuantity = X (buy X items)
            // discountValue = Y (get Y items free)
            // Example: minQuantity=3, discountValue=1 means "buy 3 get 1 free"
            const buyX = rule.minQuantity || 1;
            const getY = rule.discountValue || 0;
            
            if (quantity >= buyX && getY > 0) {
              // Calculate how many "buy X get Y" sets the customer qualifies for
              const sets = Math.floor(quantity / buyX);
              // Total free items = sets * Y
              const freeItems = sets * getY;
              // Discount = free items * unit price
              discount = freeItems * basePrice;
            }
            break;
          }
        }

        // Cap discount at base price (can't be negative)
        discount = Math.min(discount, basePrice * quantity);

        // Track the best discount
        if (discount > bestDiscount) {
          bestDiscount = discount;
          appliedRule = rule;
        }
      }

      const discountedPrice = Math.max(0, basePrice * quantity - bestDiscount);
      const discountPercentage = basePrice > 0 ? (bestDiscount / (basePrice * quantity)) * 100 : 0;

      // Log pricing rule application for history (non-blocking)
      if (appliedRule && bestDiscount > 0 && userId) {
        AuditLogService.log({
          userId,
          action: 'apply_pricing_rule',
          entity: 'pricing_rule',
          entityId: appliedRule.id,
          details: JSON.stringify({
            productId,
            quantity,
            basePrice,
            discountAmount: bestDiscount,
            discountPercentage,
            ruleName: appliedRule.name,
            ruleType: appliedRule.type,
          }),
        }).catch((err) => {
          // Don't fail if audit logging fails
          logger.error('Failed to log pricing rule application', err);
        });
      }

      return {
        originalPrice: basePrice * quantity,
        discountedPrice,
        discountAmount: bestDiscount,
        discountPercentage,
        appliedRule,
      };
    } catch (error) {
      logger.error('Error applying pricing rules', { input, error });
      throw error;
    }
  }

  /**
   * Get pricing history (audit logs of applied pricing rules)
   */
  static async getPricingHistory(options: {
    page?: number;
    pageSize?: number;
    pricingRuleId?: number;
    productId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    logs: Array<{
      id: number;
      userId: number;
      username: string;
      pricingRuleId: number;
      productId: number;
      quantity: number;
      basePrice: number;
      discountAmount: number;
      discountPercentage: number;
      ruleName: string;
      ruleType: string;
      timestamp: Date;
    }>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const where: Prisma.AuditLogWhereInput = {
        entity: 'pricing_rule',
        action: 'apply_pricing_rule',
      };

      if (options.pricingRuleId) {
        where.entityId = options.pricingRuleId;
      }

      if (options.startDate || options.endDate) {
        where.timestamp = {};
        if (options.startDate) {
          where.timestamp.gte = options.startDate;
        }
        if (options.endDate) {
          where.timestamp.lte = options.endDate;
        }
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { timestamp: 'desc' },
          include: {
            user: {
              select: {
                username: true,
              },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      const parsedLogs = logs
        .map((log) => {
          try {
            const details = log.details ? JSON.parse(log.details) : {};
            return {
              id: log.id,
              userId: log.userId,
              username: log.user.username,
              pricingRuleId: log.entityId || 0,
              productId: details.productId || 0,
              quantity: details.quantity || 0,
              basePrice: details.basePrice || 0,
              discountAmount: details.discountAmount || 0,
              discountPercentage: details.discountPercentage || 0,
              ruleName: details.ruleName || 'Unknown',
              ruleType: details.ruleType || 'unknown',
              timestamp: log.timestamp,
            };
          } catch {
            return null;
          }
        })
        .filter((log): log is NonNullable<typeof log> => log !== null);

      // Filter by productId if specified (after parsing)
      const filteredLogs = options.productId
        ? parsedLogs.filter((log) => log.productId === options.productId)
        : parsedLogs;

      const totalPages = Math.ceil(total / pageSize);

      return {
        logs: filteredLogs,
        total: filteredLogs.length,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting pricing history', { options, error });
      throw error;
    }
  }
}

