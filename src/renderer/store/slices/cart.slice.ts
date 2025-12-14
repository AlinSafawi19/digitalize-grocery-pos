import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { applyRounding } from '../../utils/formatters';
import type { RootState } from '../index';
import { CurrencyService } from '../../services/currency.service';

// Cache exchange rate for synchronous conversion
let cachedExchangeRate: number | null = null;
let exchangeRatePromise: Promise<number> | null = null;

/**
 * Get exchange rate (cached for synchronous use)
 */
async function getExchangeRate(): Promise<number> {
  if (cachedExchangeRate !== null) {
    return cachedExchangeRate;
  }
  
  if (exchangeRatePromise) {
    return exchangeRatePromise;
  }
  
  exchangeRatePromise = CurrencyService.getExchangeRate().then(rate => {
    cachedExchangeRate = rate;
    exchangeRatePromise = null;
    return rate;
  });
  
  return exchangeRatePromise;
}

/**
 * Convert amount to USD (synchronous if rate is cached, otherwise returns original)
 */
function convertToUsd(amount: number, currency: string): number {
  if (currency === 'USD') {
    return amount;
  }
  if (currency === 'LBP' && cachedExchangeRate !== null) {
    return Math.round((amount / cachedExchangeRate) * 100) / 100;
  }
  // If rate not cached, return original (will be converted async later)
  return amount;
}

/**
 * Initialize exchange rate cache
 */
export async function initializeExchangeRate(): Promise<void> {
  try {
    await getExchangeRate();
  } catch (error) {
    console.error('Failed to initialize exchange rate:', error);
  }
}

export interface CartItem {
  productId: number;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  currency: string; // Product currency (USD or LBP)
  taxRate: number;
  taxInclusive: boolean; // Whether price includes tax
  discount: number; // Item-level discount amount
  subtotal: number; // Base amount before tax (or after extracting tax if inclusive)
  tax: number; // Tax amount
  total: number; // Final total
  transactionType?: 'sale' | 'return'; // Transaction type for this item
}

export interface CartState {
  items: CartItem[];
  transactionDiscount: number; // Transaction-level discount
  transactionDiscountCurrency?: string; // Currency of transaction discount
  transactionType?: 'sale' | 'return'; // Transaction type
  subtotal: number;
  tax: number;
  total: number;
}

const CART_STORAGE_KEY = 'pos_cart_state';

/**
 * Load cart state from localStorage
 */
function loadCartFromStorage(): CartState {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate the structure
      if (parsed && Array.isArray(parsed.items)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('[POS Cart] Failed to load cart from localStorage:', error);
  }
  return {
    items: [],
    transactionDiscount: 0,
    transactionType: 'sale',
    subtotal: 0,
    tax: 0,
    total: 0,
  };
}

/**
 * Save cart state to localStorage
 */
function saveCartToStorage(state: CartState): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[POS Cart] Failed to save cart to localStorage:', {
      itemCount: state.items.length,
      error,
    });
  }
}

const initialState: CartState = loadCartFromStorage();

/**
 * Calculate item totals
 * @param taxInclusive - If true, unitPrice already includes tax. If false, tax is added.
 * @param roundingMethod - The rounding method to apply
 */
function calculateItemTotals(
  quantity: number,
  unitPrice: number,
  taxRate: number,
  discount: number = 0,
  taxInclusive: boolean = false,
  roundingMethod: string = 'round'
): { subtotal: number; tax: number; total: number } {
  if (taxInclusive) {
    // Price already includes tax - extract tax from the price
    const subtotalIncludingTax = quantity * unitPrice - discount;
    // Extract tax: tax = subtotal * (taxRate / (100 + taxRate))
    const tax = taxRate > 0 ? (subtotalIncludingTax * taxRate) / (100 + taxRate) : 0;
    const subtotal = subtotalIncludingTax - tax;
    const total = subtotalIncludingTax; // Total equals subtotal when tax is inclusive

    return {
      subtotal: applyRounding(subtotal, roundingMethod),
      tax: applyRounding(tax, roundingMethod),
      total: applyRounding(total, roundingMethod),
    };
  } else {
    // Price excludes tax - add tax to the price
    const subtotal = quantity * unitPrice - discount;
    const tax = (subtotal * taxRate) / 100;
    const total = subtotal + tax;

    return {
      subtotal: applyRounding(subtotal, roundingMethod),
      tax: applyRounding(tax, roundingMethod),
      total: applyRounding(total, roundingMethod),
    };
  }
}

/**
 * Recalculate cart totals
 * Converts all LBP amounts to USD for internal calculations
 * Handles mixed sale and return items
 * @param roundingMethod - The rounding method to apply
 */
function recalculateCartTotals(state: CartState, roundingMethod: string = 'round'): void {
  let subtotal = 0;
  let tax = 0;

  state.items.forEach((item) => {
    // Convert LBP to USD for all calculations
    const itemSubtotalUsd = convertToUsd(item.subtotal, item.currency);
    const itemTaxUsd = convertToUsd(item.tax, item.currency);
    
    // For return items, make values negative (represents money going out)
    // For sale items, keep values positive (represents money coming in)
    const itemTransactionType = item.transactionType || state.transactionType || 'sale';
    const multiplier = itemTransactionType === 'return' ? -1 : 1;
    
    subtotal += itemSubtotalUsd * multiplier;
    tax += itemTaxUsd * multiplier;
  });

  // Apply transaction-level discount (already in USD)
  // Discount is always positive (reduces the total)
  const finalSubtotal = subtotal - state.transactionDiscount;
  const finalTax = tax; // Tax is calculated before transaction discount
  const finalTotal = finalSubtotal + finalTax;

  state.subtotal = applyRounding(finalSubtotal, roundingMethod);
  state.tax = applyRounding(finalTax, roundingMethod);
  state.total = applyRounding(finalTotal, roundingMethod);
}

// Thunk actions that automatically include rounding method from state
export const addItemWithRounding = createAsyncThunk(
  'cart/addItemWithRounding',
  async (
    payload: {
      productId: number;
      productCode: string;
      productName: string;
      unit: string;
      unitPrice: number;
      currency: string;
      taxRate: number;
      taxInclusive: boolean;
      quantity?: number;
      transactionType?: 'sale' | 'return';
    },
    { getState, dispatch }
  ) => {
    const state = getState() as RootState;
    const roundingMethod = state.settings?.businessRules?.roundingMethod || 'round';
    dispatch(
      addItem({
        ...payload,
        roundingMethod,
      })
    );
  }
);

export const removeItemWithRounding = createAsyncThunk(
  'cart/removeItemWithRounding',
  async (
    payload: number | { productId: number; transactionType?: 'sale' | 'return' },
    { getState, dispatch }
  ) => {
    const state = getState() as RootState;
    const roundingMethod = state.settings?.businessRules?.roundingMethod || 'round';
    if (typeof payload === 'number') {
      dispatch(removeItem({ productId: payload, roundingMethod }));
    } else {
      dispatch(removeItem({ ...payload, roundingMethod }));
    }
  }
);

export const updateQuantityWithRounding = createAsyncThunk(
  'cart/updateQuantityWithRounding',
  async (
    payload: { productId: number; quantity: number },
    { getState, dispatch }
  ) => {
    const state = getState() as RootState;
    const roundingMethod = state.settings?.businessRules?.roundingMethod || 'round';
    dispatch(updateQuantity({ ...payload, roundingMethod }));
  }
);

export const applyItemDiscountWithRounding = createAsyncThunk(
  'cart/applyItemDiscountWithRounding',
  async (
    payload: { productId: number; discount: number },
    { getState, dispatch }
  ) => {
    const state = getState() as RootState;
    const roundingMethod = state.settings?.businessRules?.roundingMethod || 'round';
    dispatch(applyItemDiscount({ ...payload, roundingMethod }));
  }
);

export const applyTransactionDiscountWithRounding = createAsyncThunk(
  'cart/applyTransactionDiscountWithRounding',
  async (discount: number, { getState, dispatch }) => {
    const state = getState() as RootState;
    const roundingMethod = state.settings?.businessRules?.roundingMethod || 'round';
    dispatch(applyTransactionDiscount({ discount, roundingMethod }));
  }
);

export const restoreCartWithRounding = createAsyncThunk(
  'cart/restoreCartWithRounding',
  async (cart: CartState, { getState, dispatch }) => {
    const state = getState() as RootState;
    const roundingMethod = state.settings?.businessRules?.roundingMethod || 'round';
    dispatch(restoreCart({ cart, roundingMethod }));
  }
);

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    /**
     * Add item to cart or increase quantity if already exists
     */
    addItem: (
      state,
      action: PayloadAction<{
        productId: number;
        productCode: string;
        productName: string;
        unit: string;
        unitPrice: number;
        currency: string; // Product currency
        taxRate: number;
        taxInclusive: boolean; // Whether price includes tax
        quantity?: number;
        transactionType?: 'sale' | 'return'; // Transaction type for this item
        roundingMethod?: string; // Optional rounding method override
      }>
    ) => {
      const {
        productId,
        productCode,
        productName,
        unit,
        unitPrice,
        currency,
        taxRate,
        taxInclusive,
        quantity = 1,
        transactionType,
        roundingMethod = 'round',
      } = action.payload;

      // Use item's transactionType, fallback to cart's transactionType, then 'sale'
      // Always explicitly set transactionType (don't leave it undefined)
      const itemTransactionType: 'sale' | 'return' = transactionType || state.transactionType || 'sale';

      // Find existing item with same productId AND transactionType
      const existingItem = state.items.find(
        (item) => item.productId === productId && (item.transactionType || 'sale') === itemTransactionType
      );

      if (existingItem) {
        // Update tax config if it changed, then increase quantity
        if (existingItem.taxRate !== taxRate || existingItem.taxInclusive !== taxInclusive) {
          existingItem.taxRate = taxRate;
          existingItem.taxInclusive = taxInclusive;
        }
        // Ensure transactionType is set explicitly
        existingItem.transactionType = itemTransactionType;
        // Increase quantity
        existingItem.quantity += quantity;
        const { subtotal, tax, total } = calculateItemTotals(
          existingItem.quantity,
          existingItem.unitPrice,
          existingItem.taxRate,
          existingItem.discount,
          existingItem.taxInclusive,
          roundingMethod
        );
        existingItem.subtotal = subtotal;
        existingItem.tax = tax;
        existingItem.total = total;
      } else {
        // Add new item
        // Calculate totals in the product's currency
        const { subtotal, tax, total } = calculateItemTotals(
          quantity,
          unitPrice,
          taxRate,
          0,
          taxInclusive,
          roundingMethod
        );
        state.items.push({
          productId,
          productCode,
          productName,
          unit,
          quantity,
          unitPrice,
          currency,
          taxRate,
          taxInclusive,
          discount: 0,
          subtotal, // Stored in product's currency
          tax, // Stored in product's currency
          total, // Stored in product's currency
          transactionType: itemTransactionType, // Store transaction type per item
        });
      }

      recalculateCartTotals(state, roundingMethod);
      saveCartToStorage(state);
    },

    /**
     * Remove item from cart
     */
    removeItem: (
      state,
      action: PayloadAction<{ productId: number; transactionType?: 'sale' | 'return'; roundingMethod?: string }>
    ) => {
      const payload = typeof action.payload === 'number' 
        ? { productId: action.payload } 
        : action.payload;
      const { productId, transactionType, roundingMethod = 'round' } = payload;
      
      // If transactionType is provided, remove only items matching both productId and transactionType
      // Otherwise, remove all items with that productId (backward compatibility)
      if (transactionType !== undefined) {
        state.items = state.items.filter((item) => {
          // Get item's transactionType (should always be set now, but fallback to 'sale' for safety)
          const itemType = item.transactionType || 'sale';
          // Check if this item should be removed (both productId and transactionType must match)
          const shouldRemove = item.productId === productId && itemType === transactionType;
          // Keep item if it should NOT be removed
          return !shouldRemove;
        });
      } else {
        state.items = state.items.filter((item) => item.productId !== productId);
      }
      recalculateCartTotals(state, roundingMethod);
      saveCartToStorage(state);
    },

    /**
     * Update item quantity
     */
    updateQuantity: (
      state,
      action: PayloadAction<{ productId: number; quantity: number; roundingMethod?: string }>
    ) => {
      const { productId, quantity, roundingMethod = 'round' } = action.payload;
      const item = state.items.find((item) => item.productId === productId);

      if (item) {
        if (quantity === 0) {
          // Remove item if quantity is exactly 0
          state.items = state.items.filter((item) => item.productId !== productId);
        } else {
          item.quantity = quantity;
          const { subtotal, tax, total } = calculateItemTotals(
            item.quantity,
            item.unitPrice,
            item.taxRate,
            item.discount,
            item.taxInclusive,
            roundingMethod
          );
          item.subtotal = subtotal;
          item.tax = tax;
          item.total = total;
        }
        recalculateCartTotals(state, roundingMethod);
        saveCartToStorage(state);
      }
    },

    /**
     * Apply discount to item
     */
    applyItemDiscount: (
      state,
      action: PayloadAction<{ productId: number; discount: number; roundingMethod?: string }>
    ) => {
      const { productId, discount, roundingMethod = 'round' } = action.payload;
      const item = state.items.find((item) => item.productId === productId);

      if (item) {
        item.discount = Math.max(0, discount);
        const { subtotal, tax, total } = calculateItemTotals(
          item.quantity,
          item.unitPrice,
          item.taxRate,
          item.discount,
          item.taxInclusive,
          roundingMethod
        );
        item.subtotal = subtotal;
        item.tax = tax;
        item.total = total;
        recalculateCartTotals(state, roundingMethod);
        saveCartToStorage(state);
      }
    },

    /**
     * Apply transaction-level discount
     */
    applyTransactionDiscount: (
      state,
      action: PayloadAction<{ discount: number; roundingMethod?: string } | number>
    ) => {
      const discount = typeof action.payload === 'number' ? action.payload : action.payload.discount;
      const roundingMethod = typeof action.payload === 'object' ? (action.payload.roundingMethod || 'round') : 'round';
      state.transactionDiscount = Math.max(0, discount);
      recalculateCartTotals(state, roundingMethod);
      saveCartToStorage(state);
    },

    /**
     * Clear cart
     */
    clearCart: (state) => {
      state.items = [];
      state.transactionDiscount = 0;
      state.subtotal = 0;
      state.tax = 0;
      state.total = 0;
      saveCartToStorage(state);
    },

    /**
     * Update transaction type
     */
    setTransactionType: (
      state,
      action: PayloadAction<{ transactionType: 'sale' | 'return'; roundingMethod?: string }>
    ) => {
      const { transactionType, roundingMethod = 'round' } = action.payload;
      state.transactionType = transactionType;
      // Recalculate totals with new transaction type
      recalculateCartTotals(state, roundingMethod);
      saveCartToStorage(state);
    },

    /**
     * Restore cart from storage (used on app initialization)
     */
    restoreCart: (
      state,
      action: PayloadAction<{ cart: CartState; roundingMethod?: string } | CartState>
    ) => {
      const cart = 'cart' in action.payload ? action.payload.cart : action.payload;
      const roundingMethod = 'roundingMethod' in action.payload ? (action.payload.roundingMethod || 'round') : 'round';
      // Ensure all items have taxInclusive field (default to false for backward compatibility)
      const items = (cart.items || []).map(item => ({
        ...item,
        taxInclusive: item.taxInclusive ?? false,
      }));
      state.items = items;
      state.transactionDiscount = cart.transactionDiscount || 0;
      state.transactionType = cart.transactionType || 'sale';
      state.subtotal = cart.subtotal || 0;
      state.tax = cart.tax || 0;
      state.total = cart.total || 0;
      // Recalculate to ensure consistency with current rounding method
      recalculateCartTotals(state, roundingMethod);
    },
  },
});

export const {
  addItem,
  removeItem,
  updateQuantity,
  applyItemDiscount,
  applyTransactionDiscount,
  setTransactionType,
  clearCart,
  restoreCart,
} = cartSlice.actions;

export default cartSlice.reducer;

