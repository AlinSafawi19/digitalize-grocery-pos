import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { TransactionService, TransactionWithRelations } from './transaction.service';
import { Prisma } from '@prisma/client';

/**
 * Rule condition types
 */
export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal' | 'contains' | 'in' | 'not_in';

/**
 * Rule condition
 */
export interface RuleCondition {
  field: string; // e.g., 'total', 'itemCount', 'cashierId', 'type'
  operator: ConditionOperator;
  value: unknown; // Value to compare against
}

/**
 * Rule action types
 */
export type RuleActionType = 'complete_transaction' | 'add_note' | 'apply_discount' | 'set_status';

/**
 * Rule action
 */
export interface RuleAction {
  type: RuleActionType;
  params?: Record<string, unknown>; // Action-specific parameters
}

/**
 * Transaction completion rule
 */
export interface TransactionCompletionRule {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create rule input
 */
export interface CreateRuleInput {
  name: string;
  description?: string;
  isActive?: boolean;
  priority?: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

/**
 * Update rule input
 */
export interface UpdateRuleInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  priority?: number;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
}

/**
 * Rule evaluation result
 */
export interface RuleEvaluationResult {
  ruleId: number;
  ruleName: string;
  matched: boolean;
  actionsExecuted: RuleAction[];
  error?: string;
}

/**
 * Transaction Completion Rule Service
 */
export class TransactionCompletionRuleService {
  /**
   * Create a new rule
   */
  async createRule(input: CreateRuleInput, userId: number): Promise<TransactionCompletionRule> {
    try {
      const prisma = databaseService.getClient();
      
      const rule = await prisma.transactionCompletionRule.create({
        data: {
          name: input.name,
          description: input.description || null,
          isActive: input.isActive !== undefined ? input.isActive : true,
          priority: input.priority || 0,
          conditions: JSON.stringify(input.conditions),
          actions: JSON.stringify(input.actions),
          createdBy: userId,
        },
      });

      return this.mapToRule(rule);
    } catch (error: unknown) {
      logger.error('Error creating transaction completion rule', error);
      throw error;
    }
  }

  /**
   * Update an existing rule
   */
  async updateRule(ruleId: number, input: UpdateRuleInput): Promise<TransactionCompletionRule> {
    try {
      const prisma = databaseService.getClient();
      
      const updateData: Prisma.TransactionCompletionRuleUpdateInput = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description || null;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.conditions !== undefined) updateData.conditions = JSON.stringify(input.conditions);
      if (input.actions !== undefined) updateData.actions = JSON.stringify(input.actions);

      const rule = await prisma.transactionCompletionRule.update({
        where: { id: ruleId },
        data: updateData,
      });

      return this.mapToRule(rule);
    } catch (error: unknown) {
      logger.error('Error updating transaction completion rule', error);
      throw error;
    }
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      await prisma.transactionCompletionRule.delete({
        where: { id: ruleId },
      });
    } catch (error: unknown) {
      logger.error('Error deleting transaction completion rule', error);
      throw error;
    }
  }

  /**
   * Get all rules
   */
  async getRules(activeOnly: boolean = false): Promise<TransactionCompletionRule[]> {
    try {
      const prisma = databaseService.getClient();
      
      const where: Prisma.TransactionCompletionRuleWhereInput = {};
      if (activeOnly) {
        where.isActive = true;
      }

      const rules = await prisma.transactionCompletionRule.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      return rules.map(rule => this.mapToRule(rule));
    } catch (error: unknown) {
      logger.error('Error getting transaction completion rules', error);
      return [];
    }
  }

  /**
   * Get a single rule by ID
   */
  async getRuleById(ruleId: number): Promise<TransactionCompletionRule | null> {
    try {
      const prisma = databaseService.getClient();
      const rule = await prisma.transactionCompletionRule.findUnique({
        where: { id: ruleId },
      });

      return rule ? this.mapToRule(rule) : null;
    } catch (error: unknown) {
      logger.error('Error getting transaction completion rule by ID', error);
      return null;
    }
  }

  /**
   * Evaluate a transaction against all active rules
   */
  async evaluateTransaction(transaction: TransactionWithRelations): Promise<RuleEvaluationResult[]> {
    try {
      const rules = await this.getRules(true); // Get only active rules
      const results: RuleEvaluationResult[] = [];

      // Evaluate rules in priority order
      for (const rule of rules) {
        const result = await this.evaluateRule(transaction, rule);
        results.push(result);
        
        // If rule matched and has actions, execute them
        if (result.matched && result.actionsExecuted.length > 0) {
          await this.executeActions(transaction, result.actionsExecuted);
        }
      }

      return results;
    } catch (error: unknown) {
      logger.error('Error evaluating transaction against rules', error);
      return [];
    }
  }

  /**
   * Evaluate a single rule against a transaction
   */
  async evaluateRule(
    transaction: TransactionWithRelations,
    rule: TransactionCompletionRule
  ): Promise<RuleEvaluationResult> {
    try {
      // Check if all conditions match
      let allConditionsMatch = true;

      for (const condition of rule.conditions) {
        const fieldValue = this.getFieldValue(transaction, condition.field);
        const matches = this.evaluateCondition(fieldValue, condition.operator, condition.value);
        
        if (!matches) {
          allConditionsMatch = false;
          break;
        }
      }

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matched: allConditionsMatch,
        actionsExecuted: allConditionsMatch ? rule.actions : [],
      };
    } catch (error: unknown) {
      const err = error as { message?: string };
      logger.error('Error evaluating rule', { ruleId: rule.id, error: err.message });
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matched: false,
        actionsExecuted: [],
        error: err.message || 'Unknown error',
      };
    }
  }

  /**
   * Get field value from transaction
   */
  private getFieldValue(transaction: TransactionWithRelations, field: string): unknown {
    // Direct transaction fields
    if (field in transaction) {
      return (transaction as unknown as Record<string, unknown>)[field];
    }

    // Computed fields
    switch (field) {
      case 'itemCount':
        return transaction.items.length;
      case 'hasItems':
        return transaction.items.length > 0;
      case 'hasPayments':
        return transaction.payments.length > 0;
      case 'paymentTotal':
        return transaction.payments.reduce((sum, p) => sum + p.amount, 0);
      case 'isFullyPaid': {
        const paymentTotal = transaction.payments.reduce((sum, p) => sum + p.amount, 0);
        return paymentTotal >= transaction.total;
      }
      default: {
        // Try nested fields (e.g., 'cashier.id', 'cashier.username')
        const parts = field.split('.');
        let value: unknown = transaction;
        for (const part of parts) {
          if (value && typeof value === 'object' && part in value) {
            value = (value as Record<string, unknown>)[part];
          } else {
            return undefined;
          }
        }
        return value;
      }
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(fieldValue: unknown, operator: ConditionOperator, expectedValue: unknown): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'not_equals':
        return fieldValue !== expectedValue;
      case 'greater_than':
        return Number(fieldValue) > Number(expectedValue);
      case 'less_than':
        return Number(fieldValue) < Number(expectedValue);
      case 'greater_or_equal':
        return Number(fieldValue) >= Number(expectedValue);
      case 'less_or_equal':
        return Number(fieldValue) <= Number(expectedValue);
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue);
      default:
        return false;
    }
  }

  /**
   * Execute actions on a transaction
   */
  private async executeActions(
    transaction: TransactionWithRelations,
    actions: RuleAction[]
  ): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      
      for (const action of actions) {
        switch (action.type) {
          case 'complete_transaction':
            // Update transaction status to completed
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: 'completed' },
            });
            logger.info('Transaction automatically completed by rule', {
              transactionId: transaction.id,
              transactionNumber: transaction.transactionNumber,
            });
            break;

          case 'add_note':
            if (action.params?.note) {
              const newNote = transaction.notes
                ? `${transaction.notes}\n[Auto] ${action.params.note}`
                : `[Auto] ${action.params.note}`;
              await prisma.transaction.update({
                where: { id: transaction.id },
                data: { notes: newNote },
              });
            }
            break;

          case 'set_status':
            if (action.params?.status) {
              await prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: action.params.status },
              });
            }
            break;

          default:
            logger.warn('Unknown action type', { actionType: action.type });
        }
      }
    } catch (error: unknown) {
      logger.error('Error executing rule actions', error);
      throw error;
    }
  }

  /**
   * Test a rule against a transaction (without executing actions)
   */
  async testRule(ruleId: number, transactionId: number): Promise<RuleEvaluationResult> {
    try {
      const rule = await this.getRuleById(ruleId);
      if (!rule) {
        throw new Error('Rule not found');
      }

      const transaction = await TransactionService.getById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return await this.evaluateRule(transaction, rule);
    } catch (error: unknown) {
      const err = error as { message?: string };
      logger.error('Error testing rule', error);
      throw new Error(err.message || 'Failed to test rule');
    }
  }

  /**
   * Map database record to rule interface
   */
  private mapToRule(record: {
    id: number;
    name: string;
    description: string | null;
    isActive: boolean;
    priority: number;
    conditions: string;
    actions: string;
    createdBy: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): TransactionCompletionRule {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      isActive: record.isActive,
      priority: record.priority,
      conditions: JSON.parse(record.conditions),
      actions: JSON.parse(record.actions),
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

// Singleton instance
export const transactionCompletionRuleService = new TransactionCompletionRuleService();

