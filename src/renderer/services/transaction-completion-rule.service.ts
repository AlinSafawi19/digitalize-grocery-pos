/**
 * Rule condition types
 */
export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal' | 'contains' | 'in' | 'not_in';

/**
 * Rule condition
 */
export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
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
  params?: Record<string, unknown>;
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
  createdAt: string;
  updatedAt: string;
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
 * Frontend service for transaction completion rules
 */
export class TransactionCompletionRuleService {
  /**
   * Create a new rule
   */
  static async createRule(input: CreateRuleInput, userId: number): Promise<{ success: boolean; rule?: TransactionCompletionRule; error?: string }> {
    return await window.electron.ipcRenderer.invoke('transactionCompletionRule:create', input, userId) as { success: boolean; rule?: TransactionCompletionRule; error?: string };
  }

  /**
   * Update an existing rule
   */
  static async updateRule(ruleId: number, input: UpdateRuleInput): Promise<{ success: boolean; rule?: TransactionCompletionRule; error?: string }> {
    return await window.electron.ipcRenderer.invoke('transactionCompletionRule:update', ruleId, input) as { success: boolean; rule?: TransactionCompletionRule; error?: string };
  }

  /**
   * Delete a rule
   */
  static async deleteRule(ruleId: number): Promise<{ success: boolean; error?: string }> {
    return await window.electron.ipcRenderer.invoke('transactionCompletionRule:delete', ruleId) as { success: boolean; error?: string };
  }

  /**
   * Get all rules
   */
  static async getAllRules(activeOnly?: boolean): Promise<{ success: boolean; rules: TransactionCompletionRule[]; error?: string }> {
    return await window.electron.ipcRenderer.invoke('transactionCompletionRule:getAll', activeOnly) as { success: boolean; rules: TransactionCompletionRule[]; error?: string };
  }

  /**
   * Get a rule by ID
   */
  static async getRuleById(ruleId: number): Promise<{ success: boolean; rule: TransactionCompletionRule | null; error?: string }> {
    return await window.electron.ipcRenderer.invoke('transactionCompletionRule:getById', ruleId) as { success: boolean; rule: TransactionCompletionRule | null; error?: string };
  }

  /**
   * Test a rule against a transaction
   */
  static async testRule(ruleId: number, transactionId: number): Promise<{ success: boolean; result?: RuleEvaluationResult; error?: string }> {
    return await window.electron.ipcRenderer.invoke('transactionCompletionRule:test', ruleId, transactionId) as { success: boolean; result?: RuleEvaluationResult; error?: string };
  }
}

