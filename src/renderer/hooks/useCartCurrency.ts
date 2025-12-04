import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { CurrencyService, CurrencyAmounts } from '../services/currency.service';
import { CartItem } from '../store/slices/cart.slice';

/**
 * Hook to calculate dual currency totals for cart
 */
export function useCartCurrency() {
  const { items, subtotal, tax, total, transactionDiscount } = useSelector(
    (state: RootState) => state.cart
  );
  const [dualCurrencyTotals, setDualCurrencyTotals] = useState<{
    subtotal: CurrencyAmounts;
    tax: CurrencyAmounts;
    discount: CurrencyAmounts;
    total: CurrencyAmounts;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function calculateDualCurrency() {
      try {
        setLoading(true);

        // Cart totals (subtotal, tax, total) are now in USD
        // Convert them to LBP for dual currency display
        const subtotalLbp = await CurrencyService.convertUsdToLbp(subtotal);
        const taxLbp = await CurrencyService.convertUsdToLbp(tax);
        const discountLbp = await CurrencyService.convertUsdToLbp(transactionDiscount);
        const totalLbp = await CurrencyService.convertUsdToLbp(total);

        setDualCurrencyTotals({
          subtotal: { usd: subtotal, lbp: subtotalLbp },
          tax: { usd: tax, lbp: taxLbp },
          discount: { usd: transactionDiscount, lbp: discountLbp },
          total: { usd: total, lbp: totalLbp },
        });
      } catch (error) {
        console.error('Error calculating dual currency totals:', error);
        // Fallback to single currency
        setDualCurrencyTotals({
          subtotal: { usd: subtotal, lbp: 0 },
          tax: { usd: tax, lbp: 0 },
          discount: { usd: transactionDiscount, lbp: 0 },
          total: { usd: total, lbp: 0 },
        });
      } finally {
        setLoading(false);
      }
    }

    if (items.length > 0) {
      calculateDualCurrency();
    } else {
      setDualCurrencyTotals({
        subtotal: { usd: 0, lbp: 0 },
        tax: { usd: 0, lbp: 0 },
        discount: { usd: 0, lbp: 0 },
        total: { usd: 0, lbp: 0 },
      });
      setLoading(false);
    }
  }, [items, subtotal, tax, total, transactionDiscount]);

  return { dualCurrencyTotals, loading };
}

/**
 * Get dual currency amounts for a single cart item
 */
export async function getCartItemDualCurrency(item: CartItem): Promise<CurrencyAmounts> {
  try {
    return await CurrencyService.getDualCurrencyAmounts(item.total, item.currency);
  } catch (error) {
    console.error('Error getting cart item dual currency:', error);
    return {
      usd: item.currency === 'USD' ? item.total : 0,
      lbp: item.currency === 'LBP' ? item.total : 0,
    };
  }
}

