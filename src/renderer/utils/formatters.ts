import { formatDate as formatDateTz, formatDateTime as formatDateTimeTz } from './dateUtils';

/**
 * Format currency value
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Format number with decimals
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Apply rounding method to a monetary value
 * @param value - The value to round
 * @param roundingMethod - The rounding method: 'round', 'floor', 'ceil', or 'none'
 * @param decimals - Number of decimal places (default: 2)
 * @returns The rounded value
 */
export function applyRounding(
  value: number,
  roundingMethod: string = 'round',
  decimals: number = 2
): number {
  if (roundingMethod === 'none') {
    return value;
  }

  const multiplier = Math.pow(10, decimals);
  const multiplied = value * multiplier;

  let rounded: number;
  switch (roundingMethod) {
    case 'floor':
      rounded = Math.floor(multiplied);
      break;
    case 'ceil':
      rounded = Math.ceil(multiplied);
      break;
    case 'round':
    default:
      rounded = Math.round(multiplied);
      break;
  }

  return rounded / multiplier;
}

/**
 * Format date for display (uses timezone-aware formatting)
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  return formatDateTz(date);
}

/**
 * Format date with time for display (uses timezone-aware formatting)
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  return formatDateTimeTz(date);
}

