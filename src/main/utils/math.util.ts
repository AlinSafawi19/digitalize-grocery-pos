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

