/**
 * Alert Rule Service (Frontend)
 * Handles alert rule operations via IPC
 */

export type AlertRuleType = 
  | 'low_stock'
  | 'out_of_stock'
  | 'price_change'
  | 'expiry_warning'
  | 'price_increase'
  | 'price_decrease';

export type AlertPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface AlertRuleConditions {
  threshold?: number;
  reorderLevel?: number;
  priceChangePercent?: number;
  priceChangeAmount?: number;
  daysBeforeExpiry?: number;
  compareOperator?: 'less_than' | 'less_equal' | 'greater_than' | 'greater_equal' | 'equal' | 'not_equal';
}

export interface CreateAlertRuleInput {
  name: string;
  description?: string;
  categoryId?: number | null;
  ruleType: AlertRuleType;
  conditions: AlertRuleConditions;
  isActive?: boolean;
  priority?: AlertPriority;
  notifyUsers?: number[];
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

export interface AlertHistoryItem {
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
}

export class AlertRuleService {
  /**
   * Create alert rule
   */
  static async createRule(input: CreateAlertRuleInput): Promise<{
    success: boolean;
    data?: AlertRule;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'alertRule:create',
        input
      ) as {
        success: boolean;
        data?: AlertRule;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error creating alert rule', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create alert rule',
      };
    }
  }

  /**
   * Get alert rule by ID
   */
  static async getRuleById(id: number): Promise<{
    success: boolean;
    data?: AlertRule;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'alertRule:getById',
        id
      ) as {
        success: boolean;
        data?: AlertRule;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting alert rule', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get alert rule',
      };
    }
  }

  /**
   * Get alert rules list
   */
  static async getRules(options?: {
    categoryId?: number | null;
    ruleType?: AlertRuleType;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{
    success: boolean;
    data?: AlertRule[];
    pagination?: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'alertRule:getList',
        options
      ) as {
        success: boolean;
        data?: AlertRule[];
        pagination?: {
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
        };
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting alert rules', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get alert rules',
      };
    }
  }

  /**
   * Update alert rule
   */
  static async updateRule(
    id: number,
    input: UpdateAlertRuleInput
  ): Promise<{
    success: boolean;
    data?: AlertRule;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'alertRule:update',
        id,
        input
      ) as {
        success: boolean;
        data?: AlertRule;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error updating alert rule', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update alert rule',
      };
    }
  }

  /**
   * Delete alert rule
   */
  static async deleteRule(id: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'alertRule:delete',
        id
      ) as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error deleting alert rule', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete alert rule',
      };
    }
  }

  /**
   * Evaluate product alerts
   */
  static async evaluateProductAlerts(productId: number): Promise<{
    success: boolean;
    data?: Array<{
      triggered: boolean;
      message?: string;
      severity?: AlertPriority;
      metadata?: Record<string, unknown>;
    }>;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'alertRule:evaluateProduct',
        productId
      ) as {
        success: boolean;
        data?: Array<{
          triggered: boolean;
          message?: string;
          severity?: AlertPriority;
          metadata?: Record<string, unknown>;
        }>;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error evaluating product alerts', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to evaluate alerts',
      };
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
    success: boolean;
    data?: AlertHistoryItem[];
    pagination?: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'alertRule:getHistory',
        options
      ) as {
        success: boolean;
        data?: AlertHistoryItem[];
        pagination?: {
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
        };
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting alert history', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get alert history',
      };
    }
  }

  /**
   * Resolve alert
   */
  static async resolveAlert(
    alertId: number,
    resolvedBy: number
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'alertRule:resolve',
        alertId,
        resolvedBy
      ) as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error resolving alert', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve alert',
      };
    }
  }

  /**
   * Parse conditions from JSON string
   */
  static parseConditions(conditions: string): AlertRuleConditions {
    try {
      return JSON.parse(conditions) as AlertRuleConditions;
    } catch {
      return {};
    }
  }

  /**
   * Get rule type display name
   */
  static getRuleTypeDisplayName(ruleType: AlertRuleType): string {
    const names: Record<AlertRuleType, string> = {
      low_stock: 'Low Stock',
      out_of_stock: 'Out of Stock',
      price_change: 'Price Change',
      expiry_warning: 'Expiry Warning',
      price_increase: 'Price Increase',
      price_decrease: 'Price Decrease',
    };
    return names[ruleType] || ruleType;
  }

  /**
   * Get priority display name
   */
  static getPriorityDisplayName(priority: AlertPriority): string {
    const names: Record<AlertPriority, string> = {
      low: 'Low',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
    };
    return names[priority] || priority;
  }
}

