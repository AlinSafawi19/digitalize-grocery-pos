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
  maxStock?: number;
  averageDailySales: number;
  daysOfStockRemaining: number;
  recommendedQuantity: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  lastSaleDate: Date | null;
  salesVelocity: number;
  confidence: number;
}

export interface MLReorderSuggestion extends ReorderSuggestion {
  mlPredictedDemand: number;
  seasonalFactor: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  trendStrength: number;
  patternConfidence: number;
  forecastAccuracy: number;
  mlConfidence: number;
}

export interface ReorderSuggestionOptions {
  includeInactive?: boolean;
  minDaysOfStock?: number;
  maxDaysOfStock?: number;
  urgencyFilter?: ('critical' | 'high' | 'medium' | 'low')[];
  supplierId?: number;
  categoryId?: number;
  analysisPeriodDays?: number;
  safetyStockDays?: number;
}

export interface MLReorderSuggestionOptions extends ReorderSuggestionOptions {
  enableMLPredictions?: boolean;
  forecastPeriodDays?: number;
  minDataPointsForML?: number;
}

export interface ReorderSuggestionSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalRecommendedValue: number;
}

/**
 * Reorder Suggestion Service (Renderer)
 * Handles reorder suggestion operations via IPC
 */
export class ReorderSuggestionService {
  /**
   * Get reorder suggestions
   */
  static async getSuggestions(
    options: ReorderSuggestionOptions = {}
  ): Promise<{ success: boolean; suggestions?: ReorderSuggestion[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reorder-suggestion:getSuggestions',
        options
      ) as { success: boolean; suggestions?: ReorderSuggestion[]; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting reorder suggestions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get reorder suggestion summary
   */
  static async getSummary(
    options: ReorderSuggestionOptions = {}
  ): Promise<{ success: boolean; summary?: ReorderSuggestionSummary; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reorder-suggestion:getSummary',
        options
      ) as { success: boolean; summary?: ReorderSuggestionSummary; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting reorder suggestion summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get product reorder suggestion
   */
  static async getProductSuggestion(
    productId: number,
    analysisPeriodDays?: number,
    safetyStockDays?: number
  ): Promise<{ success: boolean; suggestion?: ReorderSuggestion; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reorder-suggestion:getProductSuggestion',
        productId,
        analysisPeriodDays,
        safetyStockDays
      ) as { success: boolean; suggestion?: ReorderSuggestion; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting product reorder suggestion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get products needing reorder
   */
  static async getProductsNeedingReorder(
    options: { supplierId?: number; categoryId?: number } = {}
  ): Promise<{ success: boolean; suggestions?: ReorderSuggestion[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reorder-suggestion:getProductsNeedingReorder',
        options
      ) as { success: boolean; suggestions?: ReorderSuggestion[]; error?: string };
      return result;
    } catch (error) {
      console.error('Error getting products needing reorder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get ML-enhanced reorder suggestions
   */
  static async getMLSuggestions(
    options: MLReorderSuggestionOptions = {}
  ): Promise<{ success: boolean; suggestions?: MLReorderSuggestion[]; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'reorder-suggestion:getMLSuggestions',
        options
      ) as { success: boolean; suggestions?: MLReorderSuggestion[]; error?: string };
      
      // Convert date strings to Date objects
      if (result.success && result.suggestions) {
        result.suggestions = result.suggestions.map((s) => ({
          ...s,
          lastSaleDate: s.lastSaleDate ? new Date(s.lastSaleDate) : null,
        }));
      }
      
      return result;
    } catch (error) {
      console.error('Error getting ML reorder suggestions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

