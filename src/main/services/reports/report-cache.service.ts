import { logger } from '../../utils/logger';

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache configuration
 */
interface CacheConfig {
  defaultTTL: number; // Time to live in milliseconds (default: 5 minutes)
  maxSize: number; // Maximum number of cache entries (default: 500 - increased for better performance)
}

/**
 * Report Cache Service
 * Provides in-memory caching for report results to improve performance
 */
export class ReportCacheService {
  private static cache: Map<string, CacheEntry<unknown>> = new Map();
  private static config: CacheConfig = {
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxSize: 500, // PERFORMANCE FIX: Increased from 100 to 500 to reduce cleanup frequency
  };

  /**
   * Generate cache key from report type and parameters
   */
  private static generateCacheKey(
    reportType: string,
    params: Record<string, unknown>
  ): string {
    // Sort params to ensure consistent keys
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => {
        const value = params[key];
        // Handle Date objects
        if (value instanceof Date) {
          return `${key}:${value.toISOString()}`;
        }
        // Handle objects
        if (typeof value === 'object' && value !== null) {
          return `${key}:${JSON.stringify(value)}`;
        }
        return `${key}:${value}`;
      })
      .join('|');

    return `${reportType}:${sortedParams}`;
  }

  /**
   * Get cached report data
   */
  static get<T>(reportType: string, params: Record<string, unknown>): T | null {
    try {
      const key = this.generateCacheKey(reportType, params);
      const entry = this.cache.get(key);

      if (!entry) {
        return null;
      }

      // Check if cache entry has expired
      const now = Date.now();
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        logger.debug('Cache entry expired', { key, reportType });
        return null;
      }

      logger.debug('Cache hit', { key, reportType });
      return entry.data as T;
    } catch (error) {
      logger.error('Error getting from cache', { reportType, error });
      return null;
    }
  }

  /**
   * Calculate smart TTL based on report date range
   * PERFORMANCE FIX: Historical data (older than 7 days) gets longer TTL since it won't change
   * Recent data gets shorter TTL to ensure freshness
   */
  static calculateSmartTTL(params: Record<string, unknown>, defaultTTL?: number): number {
    const baseTTL = defaultTTL || this.config.defaultTTL;
    
    // Check if params contain date ranges
    const startDate = params.startDate 
      ? (params.startDate instanceof Date ? params.startDate : new Date(params.startDate as string))
      : null;
    const endDate = params.endDate
      ? (params.endDate instanceof Date ? params.endDate : new Date(params.endDate as string))
      : null;

    if (!startDate || !endDate) {
      return baseTTL;
    }

    const now = new Date();
    const daysSinceEnd = Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

    // Historical data (older than 7 days) - cache for 1 hour (won't change)
    if (daysSinceEnd > 7) {
      return 60 * 60 * 1000; // 1 hour
    }
    
    // Recent historical data (1-7 days old) - cache for 30 minutes
    if (daysSinceEnd > 1) {
      return 30 * 60 * 1000; // 30 minutes
    }
    
    // Today's data - cache for 5-15 minutes (depending on report type)
    return baseTTL;
  }

  /**
   * Store report data in cache
   */
  static set<T>(
    reportType: string,
    params: Record<string, unknown>,
    data: T,
    ttl?: number
  ): void {
    try {
      // PERFORMANCE FIX: Only cleanup if cache is at 90% capacity to reduce cleanup frequency
      // Clean up expired entries if cache is getting large
      if (this.cache.size >= this.config.maxSize * 0.9) {
        this.cleanup();
        
        // If still at capacity after cleanup, remove oldest entries (LRU-like eviction)
        if (this.cache.size >= this.config.maxSize) {
          this.evictOldestEntries(this.config.maxSize * 0.8); // Keep 80% of max size
        }
      }

      const key = this.generateCacheKey(reportType, params);
      const now = Date.now();
      
      // PERFORMANCE FIX: Use smart TTL if not explicitly provided
      const finalTTL = ttl !== undefined ? ttl : this.calculateSmartTTL(params);
      const expiresAt = now + finalTTL;

      this.cache.set(key, {
        data,
        timestamp: now,
        expiresAt,
      });

      logger.debug('Cache entry stored', { 
        key, 
        reportType, 
        expiresAt: new Date(expiresAt),
        ttl: finalTTL,
      });
    } catch (error) {
      logger.error('Error storing in cache', { reportType, error });
    }
  }

  /**
   * Invalidate cache entries for a specific report type
   * PERFORMANCE FIX: Delete entries directly during iteration instead of building array first
   */
  static invalidate(reportType: string): void {
    try {
      const prefix = `${reportType}:`;
      let removedCount = 0;

      // Delete matching entries directly during iteration (safe for Map)
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        logger.info('Cache invalidated', { reportType, count: removedCount });
      }
    } catch (error) {
      logger.error('Error invalidating cache', { reportType, error });
    }
  }

  /**
   * Invalidate all cache entries
   */
  static invalidateAll(): void {
    try {
      const count = this.cache.size;
      this.cache.clear();
      logger.info('All cache entries invalidated', { count });
    } catch (error) {
      logger.error('Error invalidating all cache', { error });
    }
  }

  /**
   * Clean up expired cache entries
   * PERFORMANCE FIX: Delete entries directly during iteration instead of building array first
   * This reduces memory allocation and improves cleanup speed for large caches
   */
  static cleanup(): void {
    try {
      const now = Date.now();
      let removedCount = 0;

      // Delete expired entries directly during iteration (safe for Map)
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        logger.debug('Cache cleanup completed', { removed: removedCount });
      }
    } catch (error) {
      logger.error('Error cleaning up cache', { error });
    }
  }

  /**
   * Get cache statistics
   */
  static getStats(): {
    size: number;
    maxSize: number;
    entries: Array<{
      key: string;
      age: number;
      expiresIn: number;
    }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      expiresIn: entry.expiresAt - now,
    }));

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      entries,
    };
  }

  /**
   * Update cache configuration
   */
  static updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Cache configuration updated', { config: this.config });
  }

  /**
   * Evict oldest entries when cache is full (LRU-like eviction)
   * PERFORMANCE FIX: Remove oldest entries when cache exceeds max size
   */
  private static evictOldestEntries(targetSize: number): void {
    try {
      const entries = Array.from(this.cache.entries());
      
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest entries until we reach target size
      const toRemove = entries.length - targetSize;
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
      
      if (toRemove > 0) {
        logger.debug('Cache eviction completed', { removed: toRemove, newSize: this.cache.size });
      }
    } catch (error) {
      logger.error('Error evicting cache entries', { error });
    }
  }

  /**
   * Start periodic cleanup (runs every minute)
   */
  static startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // Every minute

    logger.info('Periodic cache cleanup started');
  }
}

