import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  ReorderSuggestionService,
  ReorderSuggestionOptions,
} from '../services/inventory/reorder-suggestion.service';
import {
  MLReorderSuggestionService,
  MLReorderSuggestionOptions,
} from '../services/inventory/ml-reorder-suggestion.service';

/**
 * Register reorder suggestion IPC handlers
 */
export function registerReorderSuggestionHandlers(): void {
  logger.info('Registering reorder suggestion IPC handlers...');

  /**
   * Get reorder suggestions handler
   * IPC: reorder-suggestion:getSuggestions
   */
  ipcMain.handle(
    'reorder-suggestion:getSuggestions',
    async (_event, options: ReorderSuggestionOptions) => {
      try {
        const suggestions = await ReorderSuggestionService.getReorderSuggestions(options);
        return {
          success: true,
          suggestions,
        };
      } catch (error) {
        logger.error('Error in reorder-suggestion:getSuggestions handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get reorder suggestion summary handler
   * IPC: reorder-suggestion:getSummary
   */
  ipcMain.handle(
    'reorder-suggestion:getSummary',
    async (_event, options: ReorderSuggestionOptions) => {
      try {
        const summary = await ReorderSuggestionService.getReorderSuggestionSummary(options);
        return {
          success: true,
          summary,
        };
      } catch (error) {
        logger.error('Error in reorder-suggestion:getSummary handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get product reorder suggestion handler
   * IPC: reorder-suggestion:getProductSuggestion
   */
  ipcMain.handle(
    'reorder-suggestion:getProductSuggestion',
    async (
      _event,
      productId: number,
      analysisPeriodDays?: number,
      safetyStockDays?: number
    ) => {
      try {
        const suggestion = await ReorderSuggestionService.getProductReorderSuggestion(
          productId,
          analysisPeriodDays,
          safetyStockDays
        );
        if (!suggestion) {
          return {
            success: false,
            error: 'Product not found or has no inventory record',
          };
        }
        return {
          success: true,
          suggestion,
        };
      } catch (error) {
        logger.error('Error in reorder-suggestion:getProductSuggestion handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get products needing reorder handler
   * IPC: reorder-suggestion:getProductsNeedingReorder
   */
  ipcMain.handle(
    'reorder-suggestion:getProductsNeedingReorder',
    async (_event, options: { supplierId?: number; categoryId?: number } = {}) => {
      try {
        const suggestions =
          await ReorderSuggestionService.getProductsNeedingReorder(options);
        return {
          success: true,
          suggestions,
        };
      } catch (error) {
        logger.error('Error in reorder-suggestion:getProductsNeedingReorder handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get ML-enhanced reorder suggestions handler
   * IPC: reorder-suggestion:getMLSuggestions
   */
  ipcMain.handle(
    'reorder-suggestion:getMLSuggestions',
    async (_event, options: MLReorderSuggestionOptions) => {
      try {
        const suggestions = await MLReorderSuggestionService.getMLReorderSuggestions(options);
        return {
          success: true,
          suggestions,
        };
      } catch (error) {
        logger.error('Error in reorder-suggestion:getMLSuggestions handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
          suggestions: [],
        };
      }
    }
  );

  logger.info('Reorder suggestion IPC handlers registered');
}

