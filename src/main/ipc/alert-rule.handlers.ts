import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  AlertRuleService,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
} from '../services/alerts/alert-rule.service';

/**
 * Register alert rule IPC handlers
 */
export function registerAlertRuleHandlers(): void {
  logger.info('Registering alert rule IPC handlers...');

  /**
   * Create alert rule handler
   * IPC: alertRule:create
   */
  ipcMain.handle(
    'alertRule:create',
    async (_event, input: CreateAlertRuleInput) => {
      try {
        const rule = await AlertRuleService.createRule(input);
        return {
          success: true,
          data: rule,
        };
      } catch (error) {
        logger.error('Error in alertRule:create handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get alert rule by ID handler
   * IPC: alertRule:getById
   */
  ipcMain.handle(
    'alertRule:getById',
    async (_event, id: number) => {
      try {
        const rule = await AlertRuleService.getRuleById(id);
        return {
          success: true,
          data: rule,
        };
      } catch (error) {
        logger.error('Error in alertRule:getById handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get alert rules handler
   * IPC: alertRule:getList
   */
  ipcMain.handle(
    'alertRule:getList',
    async (
      _event,
      options?: {
        categoryId?: number | null;
        ruleType?: string;
        isActive?: boolean;
        page?: number;
        pageSize?: number;
      }
    ) => {
      try {
        const result = await AlertRuleService.getRules(options);
        return {
          success: true,
          data: result.rules,
          pagination: result.pagination,
        };
      } catch (error) {
        logger.error('Error in alertRule:getList handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update alert rule handler
   * IPC: alertRule:update
   */
  ipcMain.handle(
    'alertRule:update',
    async (_event, id: number, input: UpdateAlertRuleInput) => {
      try {
        const rule = await AlertRuleService.updateRule(id, input);
        return {
          success: true,
          data: rule,
        };
      } catch (error) {
        logger.error('Error in alertRule:update handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete alert rule handler
   * IPC: alertRule:delete
   */
  ipcMain.handle(
    'alertRule:delete',
    async (_event, id: number) => {
      try {
        await AlertRuleService.deleteRule(id);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in alertRule:delete handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Evaluate product alerts handler
   * IPC: alertRule:evaluateProduct
   */
  ipcMain.handle(
    'alertRule:evaluateProduct',
    async (_event, productId: number) => {
      try {
        const results = await AlertRuleService.evaluateProductAlerts(productId);
        return {
          success: true,
          data: results,
        };
      } catch (error) {
        logger.error('Error in alertRule:evaluateProduct handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get alert history handler
   * IPC: alertRule:getHistory
   */
  ipcMain.handle(
    'alertRule:getHistory',
    async (
      _event,
      options?: {
        alertRuleId?: number;
        productId?: number;
        categoryId?: number;
        isResolved?: boolean;
        page?: number;
        pageSize?: number;
      }
    ) => {
      try {
        const result = await AlertRuleService.getAlertHistory(options);
        return {
          success: true,
          data: result.alerts,
          pagination: result.pagination,
        };
      } catch (error) {
        logger.error('Error in alertRule:getHistory handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Resolve alert handler
   * IPC: alertRule:resolve
   */
  ipcMain.handle(
    'alertRule:resolve',
    async (_event, alertId: number, resolvedBy: number) => {
      try {
        await AlertRuleService.resolveAlert(alertId, resolvedBy);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in alertRule:resolve handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  logger.info('Alert rule IPC handlers registered');
}

