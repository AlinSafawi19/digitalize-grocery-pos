import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  transactionCompletionRuleService,
  CreateRuleInput,
  UpdateRuleInput,
} from '../services/transaction/transaction-completion-rule.service';

/**
 * Register transaction completion rule IPC handlers
 */
export function registerTransactionCompletionRuleHandlers(): void {
  logger.info('Registering transaction completion rule IPC handlers...');

  /**
   * Create a transaction completion rule
   * IPC: transactionCompletionRule:create
   */
  ipcMain.handle('transactionCompletionRule:create', async (_event, input: CreateRuleInput, userId: number) => {
    try {
      logger.info('IPC: transactionCompletionRule:create', { name: input.name, userId });
      const rule = await transactionCompletionRuleService.createRule(input, userId);
      return { success: true, rule };
    } catch (error) {
      logger.error('IPC: transactionCompletionRule:create error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create rule',
      };
    }
  });

  /**
   * Update a transaction completion rule
   * IPC: transactionCompletionRule:update
   */
  ipcMain.handle('transactionCompletionRule:update', async (_event, ruleId: number, input: UpdateRuleInput) => {
    try {
      logger.info('IPC: transactionCompletionRule:update', { ruleId });
      const rule = await transactionCompletionRuleService.updateRule(ruleId, input);
      return { success: true, rule };
    } catch (error) {
      logger.error('IPC: transactionCompletionRule:update error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update rule',
      };
    }
  });

  /**
   * Delete a transaction completion rule
   * IPC: transactionCompletionRule:delete
   */
  ipcMain.handle('transactionCompletionRule:delete', async (_event, ruleId: number) => {
    try {
      logger.info('IPC: transactionCompletionRule:delete', { ruleId });
      await transactionCompletionRuleService.deleteRule(ruleId);
      return { success: true };
    } catch (error) {
      logger.error('IPC: transactionCompletionRule:delete error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete rule',
      };
    }
  });

  /**
   * Get all transaction completion rules
   * IPC: transactionCompletionRule:getAll
   */
  ipcMain.handle('transactionCompletionRule:getAll', async (_event, activeOnly?: boolean) => {
    try {
      logger.info('IPC: transactionCompletionRule:getAll', { activeOnly });
      const rules = await transactionCompletionRuleService.getRules(activeOnly);
      return { success: true, rules };
    } catch (error) {
      logger.error('IPC: transactionCompletionRule:getAll error', error);
      return {
        success: false,
        rules: [],
        error: error instanceof Error ? error.message : 'Failed to get rules',
      };
    }
  });

  /**
   * Get a transaction completion rule by ID
   * IPC: transactionCompletionRule:getById
   */
  ipcMain.handle('transactionCompletionRule:getById', async (_event, ruleId: number) => {
    try {
      logger.info('IPC: transactionCompletionRule:getById', { ruleId });
      const rule = await transactionCompletionRuleService.getRuleById(ruleId);
      return { success: true, rule };
    } catch (error) {
      logger.error('IPC: transactionCompletionRule:getById error', error);
      return {
        success: false,
        rule: null,
        error: error instanceof Error ? error.message : 'Failed to get rule',
      };
    }
  });

  /**
   * Test a rule against a transaction
   * IPC: transactionCompletionRule:test
   */
  ipcMain.handle('transactionCompletionRule:test', async (_event, ruleId: number, transactionId: number) => {
    try {
      logger.info('IPC: transactionCompletionRule:test', { ruleId, transactionId });
      const result = await transactionCompletionRuleService.testRule(ruleId, transactionId);
      return { success: true, result };
    } catch (error) {
      logger.error('IPC: transactionCompletionRule:test error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test rule',
      };
    }
  });

  logger.info('Transaction completion rule IPC handlers registered');
}

