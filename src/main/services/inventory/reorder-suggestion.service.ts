import { Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Beirut';

export interface ReorderSuggestion {
  productId: number;
  productName: string;
  productCode: string | null;
  barcode: string | null;
  category: string | null;
  supplier: string | null;
  supplierId: number | null;
  currentStock: number;
  reorderLevel: number;
  maxStock?: number; // Optional maximum stock level
  averageDailySales: number; // Average units sold per day
  daysOfStockRemaining: number; // Estimated days until stockout
  recommendedQuantity: number; // Recommended reorder quantity
  urgency: 'critical' | 'high' | 'medium' | 'low'; // Urgency level
  lastSaleDate: Date | null; // Date of last sale
  salesVelocity: number; // Units sold per day over analysis period
  confidence: number; // Confidence score (0-100) based on data quality
}

export interface ReorderSuggestionOptions {
  includeInactive?: boolean; // Include products with no recent sales
  minDaysOfStock?: number; // Minimum days of stock remaining to include
  maxDaysOfStock?: number; // Maximum days of stock remaining to include
  urgencyFilter?: ('critical' | 'high' | 'medium' | 'low')[]; // Filter by urgency
  supplierId?: number; // Filter by supplier
  categoryId?: number; // Filter by category
  analysisPeriodDays?: number; // Number of days to analyze for sales velocity (default: 30)
  safetyStockDays?: number; // Safety stock buffer in days (default: 7)
}

export interface ReorderSuggestionSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalRecommendedValue: number; // Total value of recommended reorders
}

/**
 * Reorder Suggestion Service
 * Calculates reorder suggestions based on stock levels and sales velocity
 */
export class ReorderSuggestionService {
  /**
   * Calculate average daily sales for a product over a period
   */
  private static async calculateAverageDailySales(
    productId: number,
    days: number = 30
  ): Promise<{
    averageDailySales: number;
    totalSales: number;
    salesDays: number;
    lastSaleDate: Date | null;
  }> {
    try {
      const prisma = databaseService.getClient();
      const endDate = moment.tz(TIMEZONE).toDate();
      const startDate = moment.tz(TIMEZONE).subtract(days, 'days').toDate();

      // Get all completed sales transactions for this product in the period
      const transactionItems = await prisma.transactionItem.findMany({
        where: {
          productId,
          transaction: {
            status: 'completed',
            type: 'sale',
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        select: {
          quantity: true,
          transaction: {
            select: {
              createdAt: true,
            },
          },
        },
        orderBy: {
          transaction: {
            createdAt: 'desc',
          },
        },
      });

      if (transactionItems.length === 0) {
        return {
          averageDailySales: 0,
          totalSales: 0,
          salesDays: 0,
          lastSaleDate: null,
        };
      }

      // Calculate total quantity sold
      const totalSales = transactionItems.reduce((sum, item) => sum + item.quantity, 0);

      // Get unique days with sales
      const salesDates = new Set(
        transactionItems.map((item) =>
          moment.tz(item.transaction.createdAt, TIMEZONE).format('YYYY-MM-DD')
        )
      );
      const salesDays = salesDates.size;

      // Calculate average daily sales
      // If product sold on fewer days than the period, use actual sales days
      // Otherwise, use the full period
      const effectiveDays = salesDays > 0 ? salesDays : days;
      const averageDailySales = totalSales / effectiveDays;

      // Get last sale date
      const lastSaleDate =
        transactionItems.length > 0
          ? transactionItems[0].transaction.createdAt
          : null;

      return {
        averageDailySales,
        totalSales,
        salesDays,
        lastSaleDate,
      };
    } catch (error) {
      logger.error('Error calculating average daily sales', { productId, days, error });
      return {
        averageDailySales: 0,
        totalSales: 0,
        salesDays: 0,
        lastSaleDate: null,
      };
    }
  }

  /**
   * Calculate recommended reorder quantity
   */
  private static calculateRecommendedQuantity(
    currentStock: number,
    reorderLevel: number,
    averageDailySales: number,
    safetyStockDays: number = 7,
    maxStock?: number
  ): number {
    // Calculate minimum reorder quantity to reach reorder level
    const minReorder = Math.max(0, reorderLevel - currentStock);

    // Calculate quantity needed for safety stock (safetyStockDays of sales)
    const safetyStockQuantity = averageDailySales * safetyStockDays;

    // Calculate total recommended quantity
    // Should bring stock to reorder level + safety stock
    const targetStock = reorderLevel + safetyStockQuantity;
    let recommendedQuantity = Math.max(minReorder, targetStock - currentStock);

    // Round up to nearest whole number
    recommendedQuantity = Math.ceil(recommendedQuantity);

    // If maxStock is set, don't exceed it
    if (maxStock !== undefined && maxStock > 0) {
      recommendedQuantity = Math.min(recommendedQuantity, maxStock - currentStock);
    }

    // Ensure non-negative
    return Math.max(0, recommendedQuantity);
  }

  /**
   * Calculate urgency level
   */
  private static calculateUrgency(
    currentStock: number,
    reorderLevel: number,
    daysOfStockRemaining: number
  ): 'critical' | 'high' | 'medium' | 'low' {
    // Critical: Out of stock or will run out in 1 day
    if (currentStock <= 0 || daysOfStockRemaining <= 1) {
      return 'critical';
    }

    // High: Below reorder level or will run out in 3 days
    if (currentStock <= reorderLevel || daysOfStockRemaining <= 3) {
      return 'high';
    }

    // Medium: Will run out in 7 days
    if (daysOfStockRemaining <= 7) {
      return 'medium';
    }

    // Low: More than 7 days remaining
    return 'low';
  }

  /**
   * Calculate confidence score based on data quality
   */
  private static calculateConfidence(
    salesDays: number,
    analysisPeriodDays: number,
    averageDailySales: number
  ): number {
    // Base confidence on data availability
    let confidence = 0;

    // If we have sales data, start with base confidence
    if (salesDays > 0) {
      // More sales days = higher confidence
      const dataCompleteness = Math.min(100, (salesDays / analysisPeriodDays) * 100);
      confidence = 50 + (dataCompleteness * 0.5); // 50-100% range

      // If average daily sales is very low or zero, reduce confidence
      if (averageDailySales < 0.1) {
        confidence *= 0.7; // Reduce by 30%
      }
    } else {
      // No sales data = low confidence
      confidence = 20;
    }

    return Math.round(Math.min(100, Math.max(0, confidence)));
  }

  /**
   * Get reorder suggestions for all products
   */
  static async getReorderSuggestions(
    options: ReorderSuggestionOptions = {}
  ): Promise<ReorderSuggestion[]> {
    try {
      const prisma = databaseService.getClient();
      const {
        includeInactive = false,
        minDaysOfStock,
        maxDaysOfStock,
        urgencyFilter,
        supplierId,
        categoryId,
        analysisPeriodDays = 30,
        safetyStockDays = 7,
      } = options;

      // Build where clause for inventory query
      const inventoryWhere: Prisma.InventoryWhereInput = {};
      if (supplierId || categoryId) {
        inventoryWhere.product = {};
        if (supplierId) {
          inventoryWhere.product.supplierId = supplierId;
        }
        if (categoryId) {
          inventoryWhere.product.categoryId = categoryId;
        }
      }

      // Get all inventory items with products
      const inventoryItems = await prisma.inventory.findMany({
        where: inventoryWhere,
        include: {
          product: {
            include: {
              category: true,
              supplier: true,
            },
          },
        },
      });

      const suggestions: ReorderSuggestion[] = [];

      // Calculate suggestions for each product
      for (const inventory of inventoryItems) {
        const product = inventory.product;

        // Skip if product is not active and includeInactive is false
        // (We'll assume all products in inventory are active for now)

        // Calculate sales velocity
        const salesData = await this.calculateAverageDailySales(
          product.id,
          analysisPeriodDays
        );

        // Skip products with no sales if includeInactive is false
        if (!includeInactive && salesData.totalSales === 0) {
          continue;
        }

        const { averageDailySales, salesDays, lastSaleDate } = salesData;

        // Calculate days of stock remaining
        const daysOfStockRemaining =
          averageDailySales > 0 ? inventory.quantity / averageDailySales : Infinity;

        // Apply filters
        if (minDaysOfStock !== undefined && daysOfStockRemaining > minDaysOfStock) {
          continue;
        }
        if (maxDaysOfStock !== undefined && daysOfStockRemaining < maxDaysOfStock) {
          continue;
        }

        // Calculate recommended quantity
        const recommendedQuantity = this.calculateRecommendedQuantity(
          inventory.quantity,
          inventory.reorderLevel,
          averageDailySales,
          safetyStockDays
        );

        // Skip if no reorder needed
        if (recommendedQuantity <= 0) {
          continue;
        }

        // Calculate urgency
        const urgency = this.calculateUrgency(
          inventory.quantity,
          inventory.reorderLevel,
          daysOfStockRemaining
        );

        // Apply urgency filter
        if (urgencyFilter && !urgencyFilter.includes(urgency)) {
          continue;
        }

        // Calculate confidence
        const confidence = this.calculateConfidence(
          salesDays,
          analysisPeriodDays,
          averageDailySales
        );

        suggestions.push({
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          barcode: product.barcode,
          category: product.category?.name || null,
          supplier: product.supplier?.name || null,
          supplierId: product.supplierId,
          currentStock: inventory.quantity,
          reorderLevel: inventory.reorderLevel,
          averageDailySales,
          daysOfStockRemaining: isFinite(daysOfStockRemaining) ? daysOfStockRemaining : 999,
          recommendedQuantity,
          urgency,
          lastSaleDate,
          salesVelocity: averageDailySales,
          confidence,
        });
      }

      // Sort by urgency (critical first) then by days of stock remaining
      suggestions.sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return a.daysOfStockRemaining - b.daysOfStockRemaining;
      });

      return suggestions;
    } catch (error) {
      logger.error('Error getting reorder suggestions', { options, error });
      throw error;
    }
  }

  /**
   * Get reorder suggestion summary
   */
  static async getReorderSuggestionSummary(
    options: ReorderSuggestionOptions = {}
  ): Promise<ReorderSuggestionSummary> {
    try {
      const suggestions = await this.getReorderSuggestions(options);

      const summary: ReorderSuggestionSummary = {
        total: suggestions.length,
        critical: suggestions.filter((s) => s.urgency === 'critical').length,
        high: suggestions.filter((s) => s.urgency === 'high').length,
        medium: suggestions.filter((s) => s.urgency === 'medium').length,
        low: suggestions.filter((s) => s.urgency === 'low').length,
        totalRecommendedValue: 0, // Will be calculated if product prices are available
      };

      // Calculate total recommended value (if we have product prices)
      // This would require fetching product prices, which we can do if needed
      // For now, we'll leave it at 0

      return summary;
    } catch (error) {
      logger.error('Error getting reorder suggestion summary', { options, error });
      throw error;
    }
  }

  /**
   * Get reorder suggestions for a specific product
   */
  static async getProductReorderSuggestion(
    productId: number,
    analysisPeriodDays: number = 30,
    safetyStockDays: number = 7
  ): Promise<ReorderSuggestion | null> {
    try {
      const prisma = databaseService.getClient();

      const inventory = await prisma.inventory.findUnique({
        where: { productId },
        include: {
          product: {
            include: {
              category: true,
              supplier: true,
            },
          },
        },
      });

      if (!inventory) {
        return null;
      }

      const salesData = await this.calculateAverageDailySales(
        productId,
        analysisPeriodDays
      );

      const { averageDailySales, salesDays, lastSaleDate } = salesData;
      const daysOfStockRemaining =
        averageDailySales > 0 ? inventory.quantity / averageDailySales : Infinity;

      const recommendedQuantity = this.calculateRecommendedQuantity(
        inventory.quantity,
        inventory.reorderLevel,
        averageDailySales,
        safetyStockDays
      );

      const urgency = this.calculateUrgency(
        inventory.quantity,
        inventory.reorderLevel,
        daysOfStockRemaining
      );

      const confidence = this.calculateConfidence(
        salesDays,
        analysisPeriodDays,
        averageDailySales
      );

      return {
        productId: inventory.product.id,
        productName: inventory.product.name,
        productCode: inventory.product.code,
        barcode: inventory.product.barcode,
        category: inventory.product.category?.name || null,
        supplier: inventory.product.supplier?.name || null,
        supplierId: inventory.product.supplierId,
        currentStock: inventory.quantity,
        reorderLevel: inventory.reorderLevel,
        averageDailySales,
        daysOfStockRemaining: isFinite(daysOfStockRemaining) ? daysOfStockRemaining : 999,
        recommendedQuantity,
        urgency,
        lastSaleDate,
        salesVelocity: averageDailySales,
        confidence,
      };
    } catch (error) {
      logger.error('Error getting product reorder suggestion', { productId, error });
      throw error;
    }
  }

  /**
   * Get products that need reordering (below reorder level)
   */
  static async getProductsNeedingReorder(
    options: {
      supplierId?: number;
      categoryId?: number;
    } = {}
  ): Promise<ReorderSuggestion[]> {
    return this.getReorderSuggestions({
      ...options,
      urgencyFilter: ['critical', 'high'],
    });
  }
}

