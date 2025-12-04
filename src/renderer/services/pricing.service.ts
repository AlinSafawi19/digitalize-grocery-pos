import { Product } from './product.service';
import { Category } from './category.service';

// Pricing Rule Types
export interface PricingRule {
  id: number;
  name: string;
  type: 'percentage_discount' | 'fixed_discount' | 'quantity_based' | 'buy_x_get_y' | 'time_based';
  productId: number | null;
  categoryId: number | null;
  promotionId: number | null;
  startDate: Date | null;
  endDate: Date | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minQuantity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  product?: Product | null;
  category?: Category | null;
  promotion?: Promotion | null;
}

export interface Promotion {
  id: number;
  name: string;
  description: string | null;
  type: 'product_promotion' | 'category_promotion' | 'store_wide';
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  pricingRules?: PricingRule[];
  pricingRulesCount?: number;
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

export interface PricingRuleListResult {
  success: boolean;
  rules?: PricingRule[];
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

export interface PromotionListResult {
  success: boolean;
  promotions?: Promotion[];
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

export interface PricingRuleResult {
  success: boolean;
  rule?: PricingRule;
  error?: string;
}

export interface PromotionResult {
  success: boolean;
  promotion?: Promotion;
  error?: string;
}

export interface AppliedPricingResult {
  success: boolean;
  pricing?: AppliedPricing;
  error?: string;
}

/**
 * Pricing Service (Frontend)
 * Handles pricing rules and promotions via IPC
 */
export class PricingService {
  /**
   * Get pricing rule by ID
   */
  static async getRule(id: number, userId: number): Promise<PricingRuleResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'pricing:getRule',
        id,
        userId
      ) as PricingRuleResult;
      return result;
    } catch (error) {
      console.error('Error getting pricing rule', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pricing rule',
      };
    }
  }

  /**
   * Get pricing rules list
   */
  static async getRules(
    options: PricingRuleListOptions,
    userId: number
  ): Promise<PricingRuleListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'pricing:getRules',
        options,
        userId
      ) as PricingRuleListResult;
      return result;
    } catch (error) {
      console.error('Error getting pricing rules', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pricing rules',
      };
    }
  }

  /**
   * Create pricing rule
   */
  static async createRule(
    input: CreatePricingRuleInput,
    userId: number
  ): Promise<PricingRuleResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'pricing:createRule',
        input,
        userId
      ) as PricingRuleResult;
      return result;
    } catch (error) {
      console.error('Error creating pricing rule', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create pricing rule',
      };
    }
  }

  /**
   * Update pricing rule
   */
  static async updateRule(
    id: number,
    input: UpdatePricingRuleInput,
    userId: number
  ): Promise<PricingRuleResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'pricing:updateRule',
        id,
        input,
        userId
      ) as PricingRuleResult;
      return result;
    } catch (error) {
      console.error('Error updating pricing rule', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update pricing rule',
      };
    }
  }

  /**
   * Delete pricing rule
   */
  static async deleteRule(id: number, userId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'pricing:deleteRule',
        id,
        userId
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      console.error('Error deleting pricing rule', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete pricing rule',
      };
    }
  }

  /**
   * Get promotion by ID
   */
  static async getPromotion(id: number, userId: number): Promise<PromotionResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'pricing:getPromotion',
        id,
        userId
      ) as PromotionResult;
      return result;
    } catch (error) {
      console.error('Error getting promotion', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get promotion',
      };
    }
  }

  /**
   * Get promotions list
   */
  static async getPromotions(
    options: PromotionListOptions,
    userId: number
  ): Promise<PromotionListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'pricing:getPromotions',
        options,
        userId
      ) as PromotionListResult;
      return result;
    } catch (error) {
      console.error('Error getting promotions', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get promotions',
      };
    }
  }

  /**
   * Get active promotions (public)
   */
  static async getActivePromotions(userId: number): Promise<PromotionListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'pricing:getActivePromotions',
        userId
      ) as PromotionListResult;
      return result;
    } catch (error) {
      console.error('Error getting active promotions', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get active promotions',
      };
    }
  }

  /**
   * Create promotion
   */
  static async createPromotion(
    input: CreatePromotionInput,
    userId: number
  ): Promise<PromotionResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'pricing:createPromotion',
        input,
        userId
      ) as PromotionResult;
      return result;
    } catch (error) {
      console.error('Error creating promotion', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create promotion',
      };
    }
  }

  /**
   * Update promotion
   */
  static async updatePromotion(
    id: number,
    input: UpdatePromotionInput,
    userId: number
  ): Promise<PromotionResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'pricing:updatePromotion',
        id,
        input,
        userId
      ) as PromotionResult;
      return result;
    } catch (error) {
      console.error('Error updating promotion', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update promotion',
      };
    }
  }

  /**
   * Delete promotion
   */
  static async deletePromotion(id: number, userId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'pricing:deletePromotion',
        id,
        userId
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      console.error('Error deleting promotion', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete promotion',
      };
    }
  }

  /**
   * Apply pricing rules (for POS)
   */
  static async applyRules(
    input: ApplyPricingInput,
    userId: number
  ): Promise<AppliedPricingResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'pricing:applyRules',
        input,
        userId
      ) as AppliedPricingResult;
      return result;
    } catch (error) {
      console.error('Error applying pricing rules', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply pricing rules',
      };
    }
  }

  /**
   * Get pricing history
   */
  static async getHistory(
    options: {
      page?: number;
      pageSize?: number;
      pricingRuleId?: number;
      productId?: number;
      startDate?: Date;
      endDate?: Date;
    },
    userId: number
  ): Promise<{
    success: boolean;
    logs?: Array<{
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
    pagination?: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'pricing:getHistory',
        options,
        userId
      ) as {
        success: boolean;
        logs?: Array<{
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
        pagination?: {
          page: number;
          pageSize: number;
          totalItems: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting pricing history', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pricing history',
      };
    }
  }
}

