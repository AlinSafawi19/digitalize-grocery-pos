import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { NotificationService } from '../notifications/notification.service';
import { Prisma } from '@prisma/client';

export type AlertRuleType = 
  | 'low_stock'
  | 'out_of_stock'
  | 'price_change'
  | 'expiry_warning'
  | 'price_increase'
  | 'price_decrease';

export type AlertPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface AlertRuleConditions {
  // Low stock conditions
  threshold?: number; // Quantity threshold for low stock
  reorderLevel?: number; // Reorder level threshold
  
  // Price change conditions
  priceChangePercent?: number; // Percentage change threshold
  priceChangeAmount?: number; // Absolute amount change threshold
  
  // Expiry conditions
  daysBeforeExpiry?: number; // Days before expiry to alert
  
  // General conditions
  compareOperator?: 'less_than' | 'less_equal' | 'greater_than' | 'greater_equal' | 'equal' | 'not_equal';
}

export interface CreateAlertRuleInput {
  name: string;
  description?: string;
  categoryId?: number | null; // null = all categories
  ruleType: AlertRuleType;
  conditions: AlertRuleConditions;
  isActive?: boolean;
  priority?: AlertPriority;
  notifyUsers?: number[]; // Array of user IDs, empty = all users
  createdBy: number;
}

export interface UpdateAlertRuleInput {
  name?: string;
  description?: string;
  categoryId?: number | null;
  ruleType?: AlertRuleType;
  conditions?: AlertRuleConditions;
  isActive?: boolean;
  priority?: AlertPriority;
  notifyUsers?: number[];
}

export interface AlertRule {
  id: number;
  name: string;
  description: string | null;
  categoryId: number | null;
  ruleType: string;
  conditions: string; // JSON string
  isActive: boolean;
  priority: string;
  notifyUsers: string | null; // JSON array string
  createdAt: Date;
  updatedAt: Date;
  createdBy: number;
  category?: {
    id: number;
    name: string;
  } | null;
  creator?: {
    id: number;
    username: string;
  } | null;
}

export interface AlertEvaluationResult {
  triggered: boolean;
  message?: string;
  severity?: AlertPriority;
  metadata?: Record<string, unknown>;
}

/**
 * Alert Rule Service
 * Handles alert rule management and evaluation
 */
export class AlertRuleService {
  /**
   * Create a new alert rule
   */
  static async createRule(input: CreateAlertRuleInput): Promise<AlertRule> {
    try {
      const prisma = databaseService.getClient();
      
      const rule = await prisma.alertRule.create({
        data: {
          name: input.name,
          description: input.description || null,
          categoryId: input.categoryId ?? null,
          ruleType: input.ruleType,
          conditions: JSON.stringify(input.conditions),
          isActive: input.isActive ?? true,
          priority: input.priority || 'normal',
          notifyUsers: input.notifyUsers ? JSON.stringify(input.notifyUsers) : null,
          createdBy: input.createdBy,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
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

      logger.info(`Alert rule created: ${rule.name} (ID: ${rule.id})`);
      return this.mapToAlertRule(rule);
    } catch (error) {
      logger.error('Error creating alert rule', error);
      throw error;
    }
  }

  /**
   * Get alert rule by ID
   */
  static async getRuleById(id: number): Promise<AlertRule | null> {
    try {
      const prisma = databaseService.getClient();
      
      const rule = await prisma.alertRule.findUnique({
        where: { id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
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

      return rule ? this.mapToAlertRule(rule) : null;
    } catch (error) {
      logger.error(`Error getting alert rule ${id}`, error);
      throw error;
    }
  }

  /**
   * Get all alert rules
   */
  static async getRules(options?: {
    categoryId?: number | null;
    ruleType?: AlertRuleType;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{
    rules: AlertRule[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }> {
    try {
      const prisma = databaseService.getClient();
      const page = options?.page || 1;
      const pageSize = options?.pageSize || 50;

      const where: Prisma.AlertRuleWhereInput = {};
      
      if (options?.categoryId !== undefined) {
        where.categoryId = options.categoryId;
      }
      
      if (options?.ruleType) {
        where.ruleType = options.ruleType;
      }
      
      if (options?.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      const [rules, total] = await Promise.all([
        prisma.alertRule.findMany({
          where,
          include: {
            category: {
              select: {
                id: true,
                name: true,
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
            createdAt: 'desc',
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.alertRule.count({ where }),
      ]);

      return {
        rules: rules.map(rule => this.mapToAlertRule(rule)),
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      logger.error('Error getting alert rules', error);
      throw error;
    }
  }

  /**
   * Update alert rule
   */
  static async updateRule(id: number, input: UpdateAlertRuleInput): Promise<AlertRule> {
    try {
      const prisma = databaseService.getClient();
      
      const updateData: Prisma.AlertRuleUpdateInput = {};
      
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
      if (input.ruleType !== undefined) updateData.ruleType = input.ruleType;
      if (input.conditions !== undefined) updateData.conditions = JSON.stringify(input.conditions);
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.notifyUsers !== undefined) {
        updateData.notifyUsers = input.notifyUsers.length > 0 
          ? JSON.stringify(input.notifyUsers) 
          : null;
      }

      const rule = await prisma.alertRule.update({
        where: { id },
        data: updateData,
        include: {
          category: {
            select: {
              id: true,
              name: true,
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

      logger.info(`Alert rule updated: ${rule.name} (ID: ${rule.id})`);
      return this.mapToAlertRule(rule);
    } catch (error) {
      logger.error(`Error updating alert rule ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete alert rule
   */
  static async deleteRule(id: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      
      await prisma.alertRule.delete({
        where: { id },
      });

      logger.info(`Alert rule deleted: ID ${id}`);
    } catch (error) {
      logger.error(`Error deleting alert rule ${id}`, error);
      throw error;
    }
  }

  /**
   * Evaluate alert rules for a product
   */
  static async evaluateProductAlerts(productId: number): Promise<AlertEvaluationResult[]> {
    try {
      const prisma = databaseService.getClient();
      
      // Get product with inventory and category
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          inventory: true,
          category: true,
        },
      });

      if (!product) {
        return [];
      }

      // Get active alert rules that apply to this product's category or all categories
      const rules = await prisma.alertRule.findMany({
        where: {
          isActive: true,
          OR: [
            { categoryId: null }, // All categories
            { categoryId: product.categoryId },
          ],
        },
      });

      const results: AlertEvaluationResult[] = [];

      for (const rule of rules) {
        const conditions = JSON.parse(rule.conditions) as AlertRuleConditions;
        const result = this.evaluateRule(rule.ruleType as AlertRuleType, product, conditions);
        
        if (result.triggered) {
          results.push(result);
          
          // Create alert history entry
          await this.createAlertHistory({
            alertRuleId: rule.id,
            productId: product.id,
            categoryId: product.categoryId,
            message: result.message || 'Alert triggered',
            severity: result.severity || (rule.priority as AlertPriority),
            metadata: result.metadata,
          });

          // Send notification
          const notifyUsers = rule.notifyUsers 
            ? (JSON.parse(rule.notifyUsers) as number[])
            : null;
          
          await NotificationService.createNotification({
            type: this.mapRuleTypeToNotificationType(rule.ruleType as AlertRuleType),
            title: `Alert: ${rule.name}`,
            message: result.message || 'Alert condition met',
            userId: notifyUsers && notifyUsers.length === 1 ? notifyUsers[0] : null,
            priority: result.severity || (rule.priority as AlertPriority),
          });
        }
      }

      return results;
    } catch (error) {
      logger.error(`Error evaluating alerts for product ${productId}`, error);
      throw error;
    }
  }

  /**
   * Evaluate a single rule
   */
  private static evaluateRule(
    ruleType: AlertRuleType,
    product: {
      id: number;
      name: string;
      price: number;
      categoryId: number | null;
      inventory: {
        quantity: number;
        reorderLevel: number | null;
        expiryDate: Date | null;
      } | null;
    },
    conditions: AlertRuleConditions
  ): AlertEvaluationResult {
    switch (ruleType) {
      case 'low_stock':
        return this.evaluateLowStock(product, conditions);
      case 'out_of_stock':
        return this.evaluateOutOfStock(product);
      case 'price_change':
      case 'price_increase':
      case 'price_decrease':
        // Price change evaluation requires price history, handled separately
        return { triggered: false };
      case 'expiry_warning':
        return this.evaluateExpiry(product, conditions);
      default:
        return { triggered: false };
    }
  }

  /**
   * Evaluate low stock condition
   */
  private static evaluateLowStock(
    product: {
      id: number;
      name: string;
      inventory: { quantity: number; reorderLevel: number | null } | null;
    },
    conditions: AlertRuleConditions
  ): AlertEvaluationResult {
    if (!product.inventory) {
      return { triggered: false };
    }

    const quantity = product.inventory.quantity;
    const threshold = conditions.threshold ?? product.inventory.reorderLevel ?? 10;
    
    if (quantity <= threshold) {
      return {
        triggered: true,
        message: `Low stock alert: ${product.name} has ${quantity} units remaining (threshold: ${threshold})`,
        severity: quantity === 0 ? 'urgent' : quantity <= threshold * 0.5 ? 'high' : 'normal',
        metadata: {
          productId: product.id,
          productName: product.name,
          currentQuantity: quantity,
          threshold,
        },
      };
    }

    return { triggered: false };
  }

  /**
   * Evaluate out of stock condition
   */
  private static evaluateOutOfStock(
    product: {
      id: number;
      name: string;
      inventory: { quantity: number } | null;
    }
  ): AlertEvaluationResult {
    if (!product.inventory) {
      return { triggered: false };
    }

    if (product.inventory.quantity <= 0) {
      return {
        triggered: true,
        message: `Out of stock: ${product.name} is out of stock`,
        severity: 'urgent',
        metadata: {
          productId: product.id,
          productName: product.name,
          currentQuantity: product.inventory.quantity,
        },
      };
    }

    return { triggered: false };
  }

  /**
   * Evaluate expiry warning condition
   */
  private static evaluateExpiry(
    product: {
      id: number;
      name: string;
      inventory: { expiryDate: Date | null } | null;
    },
    conditions: AlertRuleConditions
  ): AlertEvaluationResult {
    if (!product.inventory || !product.inventory.expiryDate) {
      return { triggered: false };
    }

    const daysBeforeExpiry = conditions.daysBeforeExpiry ?? 30;
    const expiryDate = new Date(product.inventory.expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= daysBeforeExpiry && daysUntilExpiry >= 0) {
      return {
        triggered: true,
        message: `Expiry warning: ${product.name} expires in ${daysUntilExpiry} days (${expiryDate.toLocaleDateString()})`,
        severity: daysUntilExpiry <= 7 ? 'urgent' : daysUntilExpiry <= 14 ? 'high' : 'normal',
        metadata: {
          productId: product.id,
          productName: product.name,
          expiryDate: product.inventory.expiryDate,
          daysUntilExpiry,
        },
      };
    }

    if (daysUntilExpiry < 0) {
      return {
        triggered: true,
        message: `Expired: ${product.name} expired ${Math.abs(daysUntilExpiry)} days ago`,
        severity: 'urgent',
        metadata: {
          productId: product.id,
          productName: product.name,
          expiryDate: product.inventory.expiryDate,
          daysSinceExpiry: Math.abs(daysUntilExpiry),
        },
      };
    }

    return { triggered: false };
  }

  /**
   * Map rule type to notification type
   */
  private static mapRuleTypeToNotificationType(ruleType: AlertRuleType): NotificationService.NotificationType {
    switch (ruleType) {
      case 'low_stock':
      case 'out_of_stock':
        return 'low_stock';
      case 'price_change':
      case 'price_increase':
      case 'price_decrease':
        return 'price_change';
      case 'expiry_warning':
        return 'expiry_warning';
      default:
        return 'system_warning';
    }
  }

  /**
   * Create alert history entry
   */
  private static async createAlertHistory(input: {
    alertRuleId: number;
    productId?: number;
    categoryId?: number | null;
    message: string;
    severity: AlertPriority;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      
      await prisma.alertHistory.create({
        data: {
          alertRuleId: input.alertRuleId,
          productId: input.productId ?? null,
          categoryId: input.categoryId ?? null,
          message: input.message,
          severity: input.severity,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        },
      });
    } catch (error) {
      logger.error('Error creating alert history', error);
      // Don't throw - alert history is not critical
    }
  }

  /**
   * Get alert history
   */
  static async getAlertHistory(options?: {
    alertRuleId?: number;
    productId?: number;
    categoryId?: number;
    isResolved?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{
    alerts: Array<{
      id: number;
      alertRuleId: number;
      productId: number | null;
      categoryId: number | null;
      message: string;
      severity: string;
      isResolved: boolean;
      resolvedAt: Date | null;
      resolvedBy: number | null;
      metadata: Record<string, unknown> | null;
      createdAt: Date;
      alertRule?: {
        id: number;
        name: string;
      };
      product?: {
        id: number;
        name: string;
      };
      category?: {
        id: number;
        name: string;
      };
    }>;
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }> {
    try {
      const prisma = databaseService.getClient();
      const page = options?.page || 1;
      const pageSize = options?.pageSize || 50;

      const where: Prisma.AlertHistoryWhereInput = {};
      
      if (options?.alertRuleId) where.alertRuleId = options.alertRuleId;
      if (options?.productId) where.productId = options.productId;
      if (options?.categoryId) where.categoryId = options.categoryId;
      if (options?.isResolved !== undefined) where.isResolved = options.isResolved;

      const [alerts, total] = await Promise.all([
        prisma.alertHistory.findMany({
          where,
          include: {
            alertRule: {
              select: {
                id: true,
                name: true,
              },
            },
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.alertHistory.count({ where }),
      ]);

      return {
        alerts: alerts.map(alert => ({
          id: alert.id,
          alertRuleId: alert.alertRuleId,
          productId: alert.productId,
          categoryId: alert.categoryId,
          message: alert.message,
          severity: alert.severity,
          isResolved: alert.isResolved,
          resolvedAt: alert.resolvedAt,
          resolvedBy: alert.resolvedBy,
          metadata: alert.metadata ? JSON.parse(alert.metadata) : null,
          createdAt: alert.createdAt,
          alertRule: alert.alertRule ? {
            id: alert.alertRule.id,
            name: alert.alertRule.name,
          } : undefined,
          product: alert.product ? {
            id: alert.product.id,
            name: alert.product.name,
          } : undefined,
          category: alert.category ? {
            id: alert.category.id,
            name: alert.category.name,
          } : undefined,
        })),
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      logger.error('Error getting alert history', error);
      throw error;
    }
  }

  /**
   * Resolve alert
   */
  static async resolveAlert(alertId: number, resolvedBy: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      
      await prisma.alertHistory.update({
        where: { id: alertId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy,
        },
      });

      logger.info(`Alert resolved: ID ${alertId}`);
    } catch (error) {
      logger.error(`Error resolving alert ${alertId}`, error);
      throw error;
    }
  }

  /**
   * Map Prisma model to AlertRule interface
   */
  private static mapToAlertRule(rule: {
    id: number;
    name: string;
    description: string | null;
    categoryId: number | null;
    ruleType: string;
    conditions: string;
    isActive: boolean;
    priority: string;
    notifyUsers: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: number;
    category?: { id: number; name: string } | null;
    creator?: { id: number; username: string } | null;
  }): AlertRule {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      categoryId: rule.categoryId,
      ruleType: rule.ruleType,
      conditions: rule.conditions,
      isActive: rule.isActive,
      priority: rule.priority,
      notifyUsers: rule.notifyUsers,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      createdBy: rule.createdBy,
      category: rule.category || null,
      creator: rule.creator || null,
    };
  }
}

