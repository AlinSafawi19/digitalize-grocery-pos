/**
 * Currency utility functions for frontend
 */

export interface CurrencyAmounts {
  usd: number;
  lbp: number;
}

/**
 * Format currency amount with symbol
 */
export function formatCurrency(amount: number, currency: string): string {
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`;
  } else if (currency === 'LBP') {
    return `${amount.toFixed(0)} LBP`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

/**
 * Format dual currency display
 * Shows both USD and LBP amounts
 * Always displays absolute values (no negative signs)
 */
export function formatLBPCurrency(amounts: CurrencyAmounts): string {
  return `${Math.abs(amounts.lbp).toFixed(0)} LBP`;
}

/**
 * Format currency with compact notation for large LBP amounts
 */
export function formatCurrencyCompact(amount: number, currency: string): string {
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`;
  } else if (currency === 'LBP') {
    // For large LBP amounts, use compact notation
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M LBP`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K LBP`;
    }
    return `${amount.toFixed(0)} LBP`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: string): string {
  if (currency === 'USD') {
    return '$';
  } else if (currency === 'LBP') {
    return 'LBP';
  }
  return currency;
}

