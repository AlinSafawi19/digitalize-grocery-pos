import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { ReorderSuggestionService, ReorderSuggestion, ReorderSuggestionOptions } from './reorder-suggestion.service';
import moment from 'moment-timezone';
import { Prisma } from '@prisma/client';

const TIMEZONE = 'Asia/Beirut';

export interface MLReorderSuggestion extends ReorderSuggestion {
  mlPredictedDemand: number; // ML-predicted demand for next period
  seasonalFactor: number; // Seasonal adjustment factor (1.0 = normal, >1.0 = high season, <1.0 = low season)
  trendDirection: 'increasing' | 'decreasing' | 'stable'; // Sales trend direction
  trendStrength: number; // Trend strength (0-100)
  patternConfidence: number; // Confidence in detected patterns (0-100)
  forecastAccuracy: number; // Historical forecast accuracy (0-100)
  mlConfidence: number; // Overall ML confidence score (0-100)
}

export interface MLReorderSuggestionOptions extends ReorderSuggestionOptions {
  enableMLPredictions?: boolean; // Enable ML-based predictions (default: true)
  forecastPeriodDays?: number; // Period to forecast demand for (default: 30)
  minDataPointsForML?: number; // Minimum data points required for ML predictions (default: 14)
}

/**
 * ML-Enhanced Reorder Suggestion Service
 * Provides advanced reorder suggestions with ML-based predictions,
 * seasonal pattern recognition, and trend analysis
 */
export class MLReorderSuggestionService {
  /**
   * Get ML-enhanced reorder suggestions
   */
  static async getMLReorderSuggestions(
    options: MLReorderSuggestionOptions = {}
  ): Promise<MLReorderSuggestion[]> {
    try {
      // Get base reorder suggestions
      const baseSuggestions = await ReorderSuggestionService.getReorderSuggestions(options);

      // Enhance with ML predictions if enabled
      const enableML = options.enableMLPredictions !== false;
      const forecastPeriodDays = options.forecastPeriodDays || 30;
      const minDataPoints = options.minDataPointsForML || 14;

      if (!enableML) {
        // Return base suggestions with default ML values
        return baseSuggestions.map((suggestion) => ({
          ...suggestion,
          mlPredictedDemand: suggestion.recommendedQuantity,
          seasonalFactor: 1.0,
          trendDirection: 'stable' as const,
          trendStrength: 0,
          patternConfidence: 50,
          forecastAccuracy: 0,
          mlConfidence: suggestion.confidence,
        }));
      }

      // Enhance each suggestion with ML predictions
      const mlSuggestions = await Promise.all(
        baseSuggestions.map((suggestion) =>
          this.enhanceSuggestionWithML(suggestion, forecastPeriodDays, minDataPoints)
        )
      );

      return mlSuggestions;
    } catch (error) {
      logger.error('Error getting ML reorder suggestions', error);
      throw error;
    }
  }

  /**
   * Enhance a reorder suggestion with ML predictions
   */
  private static async enhanceSuggestionWithML(
    suggestion: ReorderSuggestion,
    forecastPeriodDays: number,
    minDataPoints: number
  ): Promise<MLReorderSuggestion> {
    try {
      // Get historical sales data for analysis
      const historicalData = await this.getHistoricalSalesData(
        suggestion.productId,
        forecastPeriodDays * 2 // Get 2x the forecast period for better analysis
      );

      // Check if we have enough data for ML predictions
      if (historicalData.length < minDataPoints) {
        // Not enough data - return base suggestion with low ML confidence
        return {
          ...suggestion,
          mlPredictedDemand: suggestion.recommendedQuantity,
          seasonalFactor: 1.0,
          trendDirection: 'stable' as const,
          trendStrength: 0,
          patternConfidence: Math.max(0, (historicalData.length / minDataPoints) * 50),
          forecastAccuracy: 0,
          mlConfidence: Math.max(suggestion.confidence, (historicalData.length / minDataPoints) * 30),
        };
      }

      // Analyze trends
      const trendAnalysis = this.analyzeTrend(historicalData);

      // Detect seasonal patterns
      const seasonalAnalysis = this.detectSeasonalPatterns(historicalData);

      // Predict future demand
      const demandForecast = this.predictDemand(
        historicalData,
        forecastPeriodDays,
        trendAnalysis,
        seasonalAnalysis
      );

      // Calculate ML confidence based on data quality and pattern strength
      const mlConfidence = this.calculateMLConfidence(
        historicalData.length,
        trendAnalysis.strength,
        seasonalAnalysis.confidence,
        suggestion.confidence
      );

      // Adjust recommended quantity based on ML predictions
      const mlAdjustedQuantity = Math.max(
        suggestion.recommendedQuantity,
        Math.ceil(demandForecast.predictedDemand * seasonalAnalysis.factor)
      );

      return {
        ...suggestion,
        mlPredictedDemand: demandForecast.predictedDemand,
        seasonalFactor: seasonalAnalysis.factor,
        trendDirection: trendAnalysis.direction,
        trendStrength: trendAnalysis.strength,
        patternConfidence: seasonalAnalysis.confidence,
        forecastAccuracy: demandForecast.accuracy,
        mlConfidence,
        recommendedQuantity: mlAdjustedQuantity, // Use ML-adjusted quantity
      };
    } catch (error) {
      logger.error('Error enhancing suggestion with ML', {
        productId: suggestion.productId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return base suggestion on error
      return {
        ...suggestion,
        mlPredictedDemand: suggestion.recommendedQuantity,
        seasonalFactor: 1.0,
        trendDirection: 'stable' as const,
        trendStrength: 0,
        patternConfidence: 0,
        forecastAccuracy: 0,
        mlConfidence: suggestion.confidence,
      };
    }
  }

  /**
   * Get historical sales data for a product
   */
  private static async getHistoricalSalesData(
    productId: number,
    days: number
  ): Promise<Array<{ date: Date; quantity: number }>> {
    try {
      const prisma = databaseService.getClient();
      const endDate = moment.tz(TIMEZONE).toDate();
      const startDate = moment.tz(TIMEZONE).subtract(days, 'days').toDate();

      // Get daily sales aggregated by date
      const salesData = await prisma.transactionItem.findMany({
        where: {
          productId,
          transaction: {
            status: 'completed',
            type: 'sale',
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        select: {
          quantity: true,
          transaction: {
            select: {
              createdAt: true,
            },
          },
        },
        orderBy: {
          transaction: {
            createdAt: 'asc',
          },
        },
      });

      // Aggregate by date
      const dailySales = new Map<string, number>();
      for (const item of salesData) {
        const dateKey = moment(item.transaction.createdAt).tz(TIMEZONE).format('YYYY-MM-DD');
        dailySales.set(dateKey, (dailySales.get(dateKey) || 0) + item.quantity);
      }

      // Convert to array
      const result: Array<{ date: Date; quantity: number }> = [];
      for (const [dateKey, quantity] of dailySales.entries()) {
        result.push({
          date: moment.tz(dateKey, 'YYYY-MM-DD', TIMEZONE).toDate(),
          quantity,
        });
      }

      return result.sort((a, b) => a.date.getTime() - b.date.getTime());
    } catch (error) {
      logger.error('Error getting historical sales data', error);
      return [];
    }
  }

  /**
   * Analyze sales trend (increasing, decreasing, stable)
   */
  private static analyzeTrend(
    historicalData: Array<{ date: Date; quantity: number }>
  ): {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number; // 0-100
    slope: number;
  } {
    if (historicalData.length < 2) {
      return { direction: 'stable', strength: 0, slope: 0 };
    }

    // Simple linear regression to determine trend
    const n = historicalData.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    historicalData.forEach((point, index) => {
      const x = index;
      const y = point.quantity;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;

    // Calculate R-squared for trend strength
    let ssRes = 0;
    let ssTot = 0;
    historicalData.forEach((point, index) => {
      const predicted = avgY + slope * (index - sumX / n);
      ssRes += Math.pow(point.quantity - predicted, 2);
      ssTot += Math.pow(point.quantity - avgY, 2);
    });

    const rSquared = ssTot > 0 ? Math.max(0, Math.min(100, (1 - ssRes / ssTot) * 100)) : 0;

    // Determine direction
    let direction: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.01 || rSquared < 20) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    return {
      direction,
      strength: Math.round(rSquared),
      slope,
    };
  }

  /**
   * Detect seasonal patterns in sales data
   */
  private static detectSeasonalPatterns(
    historicalData: Array<{ date: Date; quantity: number }>
  ): {
    factor: number; // Seasonal adjustment factor
    confidence: number; // Confidence in pattern (0-100)
    pattern: 'weekly' | 'monthly' | 'none';
  } {
    if (historicalData.length < 14) {
      return { factor: 1.0, confidence: 0, pattern: 'none' };
    }

    // Group by day of week
    const weeklyPattern = new Map<number, number[]>();
    historicalData.forEach((point) => {
      const dayOfWeek = moment(point.date).day();
      if (!weeklyPattern.has(dayOfWeek)) {
        weeklyPattern.set(dayOfWeek, []);
      }
      weeklyPattern.get(dayOfWeek)!.push(point.quantity);
    });

    // Calculate average for each day of week
    const weeklyAverages = new Map<number, number>();
    let overallAverage = 0;
    let totalDays = 0;

    weeklyPattern.forEach((quantities, day) => {
      const avg = quantities.reduce((a, b) => a + b, 0) / quantities.length;
      weeklyAverages.set(day, avg);
      overallAverage += avg * quantities.length;
      totalDays += quantities.length;
    });

    overallAverage = totalDays > 0 ? overallAverage / totalDays : 0;

    // Find day with highest and lowest sales
    let maxDay = 0;
    let maxAvg = 0;
    let minDay = 0;
    let minAvg = Infinity;

    weeklyAverages.forEach((avg, day) => {
      if (avg > maxAvg) {
        maxAvg = avg;
        maxDay = day;
      }
      if (avg < minAvg) {
        minAvg = avg;
        minDay = day;
      }
    });

    // Calculate seasonal factor based on current day
    const currentDay = moment.tz(TIMEZONE).day();
    const currentDayAvg = weeklyAverages.get(currentDay) || overallAverage;
    const seasonalFactor = overallAverage > 0 ? currentDayAvg / overallAverage : 1.0;

    // Calculate confidence based on pattern strength
    const variance = Array.from(weeklyAverages.values()).reduce((sum, avg) => {
      return sum + Math.pow(avg - overallAverage, 2);
    }, 0) / weeklyAverages.size;

    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = overallAverage > 0 ? stdDev / overallAverage : 0;
    const confidence = Math.min(100, Math.max(0, (1 - coefficientOfVariation) * 100));

    return {
      factor: seasonalFactor,
      confidence: Math.round(confidence),
      pattern: confidence > 30 ? 'weekly' : 'none',
    };
  }

  /**
   * Predict future demand using historical data and patterns
   */
  private static predictDemand(
    historicalData: Array<{ date: Date; quantity: number }>,
    forecastPeriodDays: number,
    trendAnalysis: { direction: string; strength: number; slope: number },
    seasonalAnalysis: { factor: number; confidence: number; pattern: string }
  ): {
    predictedDemand: number;
    accuracy: number;
  } {
    if (historicalData.length === 0) {
      return { predictedDemand: 0, accuracy: 0 };
    }

    // Calculate average daily sales
    const totalSales = historicalData.reduce((sum, point) => sum + point.quantity, 0);
    const averageDailySales = totalSales / historicalData.length;

    // Apply trend adjustment
    let trendAdjustedDemand = averageDailySales;
    if (trendAnalysis.direction === 'increasing') {
      trendAdjustedDemand = averageDailySales * (1 + (trendAnalysis.strength / 100) * 0.2);
    } else if (trendAnalysis.direction === 'decreasing') {
      trendAdjustedDemand = averageDailySales * (1 - (trendAnalysis.strength / 100) * 0.2);
    }

    // Apply seasonal factor
    const seasonalAdjustedDemand = trendAdjustedDemand * seasonalAnalysis.factor;

    // Forecast for the period
    const predictedDemand = seasonalAdjustedDemand * forecastPeriodDays;

    // Calculate accuracy based on data quality and pattern confidence
    const dataQuality = Math.min(100, (historicalData.length / 60) * 100); // More data = better
    const accuracy = (dataQuality * 0.5 + seasonalAnalysis.confidence * 0.3 + trendAnalysis.strength * 0.2);

    return {
      predictedDemand: Math.max(0, Math.round(predictedDemand)),
      accuracy: Math.round(accuracy),
    };
  }

  /**
   * Calculate ML confidence score
   */
  private static calculateMLConfidence(
    dataPoints: number,
    trendStrength: number,
    seasonalConfidence: number,
    baseConfidence: number
  ): number {
    // ML confidence combines:
    // - Base confidence (data quality)
    // - Trend strength
    // - Seasonal pattern confidence
    // - Amount of historical data

    const dataQualityScore = Math.min(100, (dataPoints / 60) * 100);
    const mlScore = (
      baseConfidence * 0.4 +
      dataQualityScore * 0.2 +
      trendStrength * 0.2 +
      seasonalConfidence * 0.2
    );

    return Math.round(Math.min(100, Math.max(0, mlScore)));
  }
}

