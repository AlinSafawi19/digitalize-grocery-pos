import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { applyItemDiscount } from '../store/slices/cart.slice';
import { PricingService } from '../services/pricing.service';

/**
 * Hook to automatically apply pricing rules to cart items
 * Only applies rules when item quantities or products change, not when discounts are updated
 */
export function usePricingRules() {
  const dispatch = useDispatch<AppDispatch>();
  const { items } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  const lastAppliedRef = useRef<Map<number, { quantity: number; discount: number }>>(new Map());

  useEffect(() => {
    if (!user?.id || items.length === 0) {
      lastAppliedRef.current.clear();
      return;
    }

    // Apply pricing rules to each item
    const applyRulesToItems = async () => {
      for (const item of items) {
        const lastApplied = lastAppliedRef.current.get(item.productId);
        
        // Only apply if quantity changed or item is new
        const shouldApply = !lastApplied || 
          lastApplied.quantity !== item.quantity ||
          lastApplied.discount === 0;

        if (!shouldApply) continue;

        try {
          const result = await PricingService.applyRules(
            {
              productId: item.productId,
              quantity: item.quantity,
              basePrice: item.unitPrice,
            },
            user.id
          );

          if (result.success && result.pricing) {
            const discountAmount = result.pricing.discountAmount;
            
            // Only update if discount changed
            if (!lastApplied || lastApplied.discount !== discountAmount) {
              // Apply the discount amount to the item
              dispatch(
                applyItemDiscount({
                  productId: item.productId,
                  discount: discountAmount,
                })
              );
              
              // Update tracking
              lastAppliedRef.current.set(item.productId, {
                quantity: item.quantity,
                discount: discountAmount,
              });
            }
          }
        } catch (error) {
          console.error('[POS Pricing] Failed to apply pricing rules', {
            userId: user.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            error,
          });
        }
      }

      // Remove tracking for items no longer in cart
      const currentProductIds = new Set(items.map(item => item.productId));
      for (const productId of lastAppliedRef.current.keys()) {
        if (!currentProductIds.has(productId)) {
          lastAppliedRef.current.delete(productId);
        }
      }
    };

    applyRulesToItems();
  }, [items, user?.id, dispatch]);
}

