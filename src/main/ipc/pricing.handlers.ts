import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  PricingService,
  CreatePricingRuleInput,
  UpdatePricingRuleInput,
  PricingRuleListOptions,
  CreatePromotionInput,
  UpdatePromotionInput,
  PromotionListOptions,
  ApplyPricingInput,
} from '../services/pricing/pricing.service';

/**
 * Register pricing management IPC handlers
 */
export function registerPricingHandlers(): void {
  logger.info('Registering pricing management IPC handlers...');

  /**
   * Get pricing rule by ID handler
   * IPC: pricing:getRule
   */
  ipcMain.handle(
    'pricing:getRule',
    async (_event, id: number) => {
      try {
        const rule = await PricingService.getPricingRuleById(id);
        if (!rule) {
          return {
            success: false,
            error: 'Pricing rule not found',
          };
        }

        return { success: true, rule };
      } catch (error) {
        logger.error('Error in pricing:getRule handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get pricing rules list handler
   * IPC: pricing:getRules
   */
  ipcMain.handle(
    'pricing:getRules',
    async (_event, options: PricingRuleListOptions) => {
      try {
        const result = await PricingService.getPricingRules(options);
        return {
          success: true,
          rules: result.rules,
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
        logger.error('Error in pricing:getRules handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Create pricing rule handler
   * IPC: pricing:createRule
   */
  ipcMain.handle(
    'pricing:createRule',
    async (_event, input: CreatePricingRuleInput, requestedById: number) => {
      try {
        const rule = await PricingService.createPricingRule(input, requestedById);
        return { success: true, rule };
      } catch (error) {
        logger.error('Error in pricing:createRule handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update pricing rule handler
   * IPC: pricing:updateRule
   */
  ipcMain.handle(
    'pricing:updateRule',
    async (
      _event,
      id: number,
      input: UpdatePricingRuleInput,
      requestedById: number
    ) => {
      try {
        const rule = await PricingService.updatePricingRule(id, input, requestedById);
        return { success: true, rule };
      } catch (error) {
        logger.error('Error in pricing:updateRule handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete pricing rule handler
   * IPC: pricing:deleteRule
   */
  ipcMain.handle(
    'pricing:deleteRule',
    async (_event, id: number, requestedById: number) => {
      try {
        await PricingService.deletePricingRule(id, requestedById);
        return { success: true };
      } catch (error) {
        logger.error('Error in pricing:deleteRule handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get promotion by ID handler
   * IPC: pricing:getPromotion
   */
  ipcMain.handle(
    'pricing:getPromotion',
    async (_event, id: number) => {
      try {
        const promotion = await PricingService.getPromotionById(id);
        if (!promotion) {
          return {
            success: false,
            error: 'Promotion not found',
          };
        }

        return { success: true, promotion };
      } catch (error) {
        logger.error('Error in pricing:getPromotion handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get promotions list handler
   * IPC: pricing:getPromotions
   */
  ipcMain.handle(
    'pricing:getPromotions',
    async (_event, options: PromotionListOptions) => {
      try {
        const result = await PricingService.getPromotions(options);
        return {
          success: true,
          promotions: result.promotions,
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
        logger.error('Error in pricing:getPromotions handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get active promotions handler
   * IPC: pricing:getActivePromotions
   */
  ipcMain.handle(
    'pricing:getActivePromotions',
    async () => {
      try {
        // Active promotions can be viewed by anyone (for POS display)
        const promotions = await PricingService.getActivePromotions();
        return { success: true, promotions };
      } catch (error) {
        logger.error('Error in pricing:getActivePromotions handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Create promotion handler
   * IPC: pricing:createPromotion
   */
  ipcMain.handle(
    'pricing:createPromotion',
    async (_event, input: CreatePromotionInput, requestedById: number) => {
      try {
        const promotion = await PricingService.createPromotion(input, requestedById);
        return { success: true, promotion };
      } catch (error) {
        logger.error('Error in pricing:createPromotion handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update promotion handler
   * IPC: pricing:updatePromotion
   */
  ipcMain.handle(
    'pricing:updatePromotion',
    async (
      _event,
      id: number,
      input: UpdatePromotionInput,
      requestedById: number
    ) => {
      try {
        const promotion = await PricingService.updatePromotion(id, input, requestedById);
        return { success: true, promotion };
      } catch (error) {
        logger.error('Error in pricing:updatePromotion handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete promotion handler
   * IPC: pricing:deletePromotion
   */
  ipcMain.handle(
    'pricing:deletePromotion',
    async (_event, id: number, requestedById: number) => {
      try {
        await PricingService.deletePromotion(id, requestedById);
        return { success: true };
      } catch (error) {
        logger.error('Error in pricing:deletePromotion handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Apply pricing rules handler (for POS)
   * IPC: pricing:applyRules
   */
  ipcMain.handle(
    'pricing:applyRules',
    async (_event, input: ApplyPricingInput, requestedById: number) => {
      try {
        // Anyone can apply pricing rules (for POS transactions)
        const result = await PricingService.applyPricingRules(input, requestedById);
        return { success: true, pricing: result };
      } catch (error) {
        logger.error('Error in pricing:applyRules handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get pricing history handler
   * IPC: pricing:getHistory
   */
  ipcMain.handle(
    'pricing:getHistory',
    async (
      _event,
      options: {
        page?: number;
        pageSize?: number;
        pricingRuleId?: number;
        productId?: number;
        startDate?: Date;
        endDate?: Date;
      }
    ) => {
      try {
        const result = await PricingService.getPricingHistory(options);
        return {
          success: true,
          logs: result.logs,
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
        logger.error('Error in pricing:getHistory handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  logger.info('Pricing management IPC handlers registered successfully');
}

