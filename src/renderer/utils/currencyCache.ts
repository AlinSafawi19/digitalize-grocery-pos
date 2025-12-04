/**
 * Currency Conversion Cache
 * PERFORMANCE FIX: Caches currency conversion results to avoid redundant API calls
 */

interface CacheEntry {
  usd: number;
  lbp: number;
  timestamp: number;
}

interface CurrencyCache {
  [key: string]: CacheEntry;
}

// In-memory cache with 5-minute TTL
const cache: CurrencyCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate cache key from amount and currency
 */
function getCacheKey(amount: number, currency: string): string {
  return `${currency}:${amount.toFixed(2)}`;
}

/**
 * Get cached conversion result if available and not expired
 */
export function getCachedConversion(
  amount: number,
  currency: string
): { usd: number; lbp: number } | null {
  const key = getCacheKey(amount, currency);
  const entry = cache[key];

  if (!entry) {
    return null;
  }

  // Check if cache entry is expired
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    delete cache[key];
    return null;
  }

  return {
    usd: entry.usd,
    lbp: entry.lbp,
  };
}

/**
 * Store conversion result in cache
 */
export function setCachedConversion(
  amount: number,
  currency: string,
  result: { usd: number; lbp: number }
): void {
  const key = getCacheKey(amount, currency);
  cache[key] = {
    usd: result.usd,
    lbp: result.lbp,
    timestamp: Date.now(),
  };
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  Object.keys(cache).forEach((key) => {
    if (now - cache[key].timestamp > CACHE_TTL) {
      delete cache[key];
    }
  });
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  Object.keys(cache).forEach((key) => {
    delete cache[key];
  });
}

