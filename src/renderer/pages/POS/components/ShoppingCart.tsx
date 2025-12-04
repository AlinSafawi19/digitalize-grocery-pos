import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  IconButton,
  Button,
  Divider,
  TextField,
  Chip,
  Card,
  Tooltip,
} from '@mui/material';
import { Add, Remove, Delete, Edit, Check, Close, Undo } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import {
  removeItemWithRounding,
  updateQuantityWithRounding,
  applyItemDiscountWithRounding,
  clearCart,
} from '../../../store/slices/cart.slice';
import PromotionsBanner from './PromotionsBanner';
import { Promotion } from '../../../services/pricing.service';
import { useCartCurrency, getCartItemDualCurrency } from '../../../hooks/useCartCurrency';
import { formatCurrency, formatLBPCurrency } from '../../../utils/currency';
import ConfirmDialog from '../../../components/common/ConfirmDialog';

interface ShoppingCartProps {
  onCheckout: () => void;
  activePromotions?: Promotion[];
  transactionType?: 'sale' | 'return';
  checkoutDisabled?: boolean;
}

const ShoppingCart: React.FC<ShoppingCartProps> = ({ onCheckout, activePromotions = [], checkoutDisabled = false }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, subtotal, tax, total, transactionDiscount } = useSelector(
    (state: RootState) => state.cart
  );
  const { dualCurrencyTotals } = useCartCurrency();
  const [editingDiscount, setEditingDiscount] = useState<number | null>(null);
  const [discountInput, setDiscountInput] = useState<string>('');
  const [itemDualCurrencies, setItemDualCurrencies] = useState<
    Record<number, { usd: number; lbp: number }>
  >({});
  const [removeItemDialog, setRemoveItemDialog] = useState<{
    open: boolean;
    productId: number;
    transactionType: 'sale' | 'return';
    itemName: string;
  }>({ open: false, productId: 0, transactionType: 'sale', itemName: '' });
  const [clearCartDialog, setClearCartDialog] = useState(false);

  const handleIncreaseQuantity = (productId: number, currentQuantity: number) => {
    dispatch(updateQuantityWithRounding({ productId, quantity: currentQuantity + 1 }));
  };

  const handleDecreaseQuantity = useCallback((productId: number, currentQuantity: number) => {
    if (currentQuantity > 1) {
      dispatch(updateQuantityWithRounding({ productId, quantity: currentQuantity - 1 }));
    } else {
      // When quantity is 1, decreasing will remove the item - ask for confirmation
      const itemName = item?.productName || 'this item';
      const itemTransactionType = item?.transactionType || 'sale';
      setRemoveItemDialog({
        open: true,
        productId,
        transactionType: itemTransactionType,
        itemName,
      });
    }
  }, [items, dispatch]);

  const handleRemoveItem = useCallback((productId: number, transactionType: 'sale' | 'return') => {
    // Find the exact item to remove
    const itemToRemove = items.find((i) => {
      const itemType = i.transactionType || 'sale';
      return i.productId === productId && itemType === transactionType;
    });
    
    const itemName = itemToRemove?.productName || 'this item';
    setRemoveItemDialog({
      open: true,
      productId,
      transactionType,
      itemName,
    });
  }, [items]);

  const handleConfirmRemoveItem = useCallback(() => {
    const { productId, transactionType } = removeItemDialog;
    const itemToRemove = items.find((i) => {
      const itemType = i.transactionType || 'sale';
      return i.productId === productId && itemType === transactionType;
    });
    
    // Always pass transactionType to ensure only the specific item is removed
    dispatch(removeItemWithRounding({ productId, transactionType }));
    setRemoveItemDialog({ open: false, productId: 0, transactionType: 'sale', itemName: '' });
  }, [removeItemDialog, items, dispatch]);

  const handleStartEditDiscount = useCallback((productId: number, currentDiscount: number) => {
    setEditingDiscount(productId);
    setDiscountInput(currentDiscount.toFixed(2));
  }, []);

  const handleSaveDiscount = useCallback((productId: number) => {
    const discount = parseFloat(discountInput) || 0;
    const item = items.find((i) => i.productId === productId);
    if (item) {
      // Cap discount at item subtotal (before discount)
      const maxDiscount = item.quantity * item.unitPrice;
      const finalDiscount = Math.max(0, Math.min(discount, maxDiscount));
      dispatch(applyItemDiscountWithRounding({ productId, discount: finalDiscount }));
    }
    setEditingDiscount(null);
    setDiscountInput('');
  }, [discountInput, items, dispatch]);

  const handleCancelEditDiscount = useCallback(() => {
    setEditingDiscount(null);
    setDiscountInput('');
  }, []);

  const handleClearCart = useCallback(() => {
    setClearCartDialog(true);
  }, []);

  const handleConfirmClearCart = useCallback(() => {
    dispatch(clearCart());
    setClearCartDialog(false);
  }, [dispatch]);

  // Load dual currency for each item
  useEffect(() => {
    const loadItemCurrencies = async () => {
      const currencies: Record<number, { usd: number; lbp: number }> = {};
      for (const item of items) {
        try {
          currencies[item.productId] = await getCartItemDualCurrency(item);
        } catch (error) {
          console.error('Error loading item currency:', error);
        }
      }
      setItemDualCurrencies(currencies);
    };

    if (items.length > 0) {
      loadItemCurrencies();
    } else {
      setItemDualCurrencies({});
    }
  }, [items]);

  // Memoize sx prop objects
  const containerBoxSx = useMemo(() => ({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }), []);

  const headerPaperSx = useMemo(() => ({
    p: { xs: 1.5, md: 2 },
    borderRadius: 0,
    borderBottom: '1px solid #c0c0c0',
    backgroundColor: '#ffffff',
    boxShadow: 'none',
  }), []);

  const headerBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: { xs: '14px', md: '16px' },
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const itemCountTypographySx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const clearButtonSx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    color: '#d32f2f',
    '&:hover': {
      backgroundColor: '#ffebee',
    },
    '&:disabled': {
      color: '#bdbdbd',
    },
  }), []);

  const emptyCartBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  }), []);

  const emptyCartTypographySx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const getCardSx = useCallback((isReturn: boolean) => ({
    mb: 1.5,
    border: isReturn ? '2px solid' : '1px solid',
    borderColor: isReturn ? '#d32f2f' : '#c0c0c0',
    borderRadius: 0,
    backgroundColor: isReturn ? '#ffebee' : '#ffffff',
    boxShadow: 'none',
    overflow: 'visible',
    position: 'relative',
    '&:hover': {
      boxShadow: 1,
      borderColor: isReturn ? '#c62828' : '#1a237e',
    },
    transition: 'all 0.2s ease-in-out',
  }), []);

  const summaryPaperSx = useMemo(() => ({
    p: { xs: 1.5, md: 2 },
    borderRadius: 0,
    borderTop: '1px solid #c0c0c0',
    backgroundColor: '#ffffff',
    boxShadow: 'none',
  }), []);

  const checkoutButtonSx = useMemo(() => ({
    py: 1.5,
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#1a237e',
    '&:hover': {
      backgroundColor: '#283593',
    },
    '&:disabled': {
      backgroundColor: '#bdbdbd',
    },
  }), []);

  // Memoize computed values
  const itemCountText = useMemo(() => {
    return `${items.length} item${items.length !== 1 ? 's' : ''}`;
  }, [items.length]);

  const promotionsBoxSx = useMemo(() => ({
    p: 2,
    pb: 0,
  }), []);

  const cartItemsBoxSx = useMemo(() => ({
    flex: 1,
    overflow: 'auto',
    p: { xs: 1, md: 2 },
  }), []);

  return (
    <Box sx={containerBoxSx}>
      <Paper sx={headerPaperSx}>
        <Box sx={headerBoxSx}>
          <Box>
            <Typography sx={titleTypographySx}>
              Shopping Cart
            </Typography>
            <Typography sx={itemCountTypographySx}>
              {itemCountText}
            </Typography>
          </Box>
          <Tooltip title={items.length === 0 ? "Cart is empty" : "Clear Cart - Remove all items from the shopping cart. This action requires confirmation."}>
            <span>
              <Button
                size="small"
                disabled={items.length === 0}
                onClick={handleClearCart}
                sx={clearButtonSx}
              >
                Clear Cart
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Paper>

      {/* Promotions Banner */}
      {activePromotions.length > 0 && (
        <Box sx={promotionsBoxSx}>
          <PromotionsBanner promotions={activePromotions} />
        </Box>
      )}

      {/* Cart Items */}
      <Box sx={cartItemsBoxSx}>
        {items.length === 0 ? (
          <Box sx={emptyCartBoxSx}>
            <Typography sx={emptyCartTypographySx}>
              Cart is empty
            </Typography>
          </Box>
        ) : (
          <List>
            {items.map((item, index) => {
              const itemTransactionType = item.transactionType || 'sale';
              const isReturn = itemTransactionType === 'return';
              return (
              <React.Fragment key={`${item.productId}-${itemTransactionType}-${index}`}>
                <Card sx={getCardSx(isReturn)}>
                  <ListItem
                    sx={{
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      px: 2,
                      py: 2,
                    }}
                  >
                    {/* Header with product name and delete button */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                          <Typography 
                            variant="subtitle1" 
                            fontWeight="600"
                            sx={{ 
                              color: isReturn ? 'error.dark' : 'text.primary',
                              fontSize: '1rem',
                            }}
                          >
                            {item.productName}
                          </Typography>
                          {isReturn && (
                            <Chip
                              icon={<Undo sx={{ fontSize: '14px !important' }} />}
                              label="RETURN"
                              size="small"
                              color="error"
                              sx={{
                                height: 22,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                '& .MuiChip-icon': {
                                  fontSize: '14px',
                                },
                              }}
                            />
                          )}
                        </Box>
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ 
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <span>{item.productCode}</span>
                          <span>•</span>
                          <span>{formatCurrency(item.unitPrice, item.currency)}/{item.unit}</span>
                        </Typography>
                      </Box>
                      <Tooltip title={`Remove ${item.productName} from cart - This will remove the item from the shopping cart.`}>
                        <IconButton
                          size="small"
                          color={isReturn ? 'error' : 'default'}
                          onClick={() => handleRemoveItem(item.productId, itemTransactionType)}
                          sx={{
                            ml: 1,
                            '&:hover': {
                              backgroundColor: isReturn ? 'error.light' : 'action.hover',
                            },
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {/* Quantity and Price Row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      {/* Quantity Controls */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title={`Decrease quantity of ${item.productName} - Click to reduce quantity by 1. If quantity is 1, this will remove the item from cart.`}>
                          <IconButton
                            size="small"
                            onClick={() => handleDecreaseQuantity(item.productId, item.quantity)}
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              width: 32,
                              height: 32,
                              '&:hover': {
                                backgroundColor: isReturn ? 'error.light' : 'action.hover',
                                borderColor: isReturn ? 'error.main' : 'primary.main',
                              },
                            }}
                          >
                            <Remove fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={`Edit quantity of ${item.productName} - Type a number to set the quantity directly. Minimum quantity is 1.`}>
                          <TextField
                            size="small"
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const qty = parseFloat(e.target.value) || 1;
                              dispatch(updateQuantityWithRounding({ productId: item.productId, quantity: qty }));
                            }}
                            inputProps={{
                              min: 1,
                              style: { 
                                textAlign: 'center', 
                                padding: '6px 8px',
                                fontWeight: 600,
                              },
                            }}
                            sx={{ 
                              width: '70px',
                              '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                  borderColor: isReturn ? 'error.light' : 'divider',
                                },
                                '&:hover fieldset': {
                                  borderColor: isReturn ? 'error.main' : 'primary.main',
                                },
                              },
                            }}
                          />
                        </Tooltip>
                        <Tooltip title={`Increase quantity of ${item.productName} - Click to add 1 more of this item to the cart.`}>
                          <IconButton
                            size="small"
                            onClick={() => handleIncreaseQuantity(item.productId, item.quantity)}
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              width: 32,
                              height: 32,
                              '&:hover': {
                                backgroundColor: isReturn ? 'error.light' : 'action.hover',
                                borderColor: isReturn ? 'error.main' : 'primary.main',
                              },
                            }}
                          >
                            <Add fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {/* Price Display */}
                      <Box sx={{ textAlign: 'right', ml: 2 }}>
                        <Typography 
                          variant="h6" 
                          fontWeight="700"
                          sx={{
                            color: isReturn ? 'error.main' : 'text.primary',
                            fontSize: '1.1rem',
                            lineHeight: 1.2,
                          }}
                        >
                          {formatCurrency(Math.abs(item.total), item.currency)}
                        </Typography>
                        {itemDualCurrencies[item.productId] && (
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{ 
                              fontSize: '0.7rem',
                              display: 'block',
                              mt: 0.25,
                            }}
                          >
                            {formatLBPCurrency({
                              usd: Math.abs(itemDualCurrencies[item.productId].usd),
                              lbp: Math.abs(itemDualCurrencies[item.productId].lbp),
                            })}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* Discount Section */}
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      pt: 1,
                      borderTop: '1px solid',
                      borderColor: 'divider',
                    }}>
                      {editingDiscount === item.productId ? (
                        <>
                          <TextField
                            size="small"
                            type="number"
                            value={discountInput}
                            onChange={(e) => setDiscountInput(e.target.value)}
                            placeholder="0.00"
                            inputProps={{
                              min: 0,
                              step: 0.01,
                              style: { width: '80px', textAlign: 'right' },
                            }}
                            sx={{ width: '100px' }}
                            autoFocus
                          />
                          <Tooltip title="Save discount - Apply the entered discount amount to this item.">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleSaveDiscount(item.productId)}
                              sx={{ ml: 'auto' }}
                            >
                              <Check fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel discount edit - Discard changes and keep the current discount.">
                            <IconButton
                              size="small"
                              onClick={handleCancelEditDiscount}
                            >
                              <Close fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <>
                          {item.discount > 0 ? (
                            <Typography 
                              variant="body2" 
                              color="success.main"
                              sx={{ fontWeight: 500 }}
                            >
                              Discount: {formatCurrency(item.discount, item.currency)}
                            </Typography>
                          ) : (
                            <Typography 
                              variant="body2" 
                              color="text.secondary"
                              sx={{ fontSize: '0.8rem' }}
                            >
                              No discount
                            </Typography>
                          )}
                          <Tooltip title={`Edit discount for ${item.productName} - Click to apply a discount amount to this item. Discount cannot exceed the item's total price.`}>
                            <IconButton
                              size="small"
                              onClick={() => handleStartEditDiscount(item.productId, item.discount)}
                              sx={{
                                ml: 'auto',
                                '&:hover': {
                                  backgroundColor: 'action.hover',
                                },
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </ListItem>
                </Card>
              </React.Fragment>
              );
            })}
          </List>
        )}
      </Box>

      {/* Cart Summary */}
      <Paper sx={summaryPaperSx}>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">Subtotal:</Typography>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2">${subtotal.toFixed(2)}</Typography>
              {dualCurrencyTotals && (
                <Typography variant="caption" color="text.secondary">
                  {formatLBPCurrency(dualCurrencyTotals.subtotal)}
                </Typography>
              )}
            </Box>
          </Box>
          {transactionDiscount > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="success.main">
                Discount:
              </Typography>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" color="success.main">
                  -${transactionDiscount.toFixed(2)}
                </Typography>
                {dualCurrencyTotals && (
                  <Typography variant="caption" color="text.secondary">
                    -{formatLBPCurrency(dualCurrencyTotals.discount)}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">Tax:</Typography>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2">${tax.toFixed(2)}</Typography>
              {dualCurrencyTotals && (
                <Typography variant="caption" color="text.secondary">
                  {formatLBPCurrency(dualCurrencyTotals.tax)}
                </Typography>
              )}
            </Box>
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6" fontWeight="bold">
              {total < 0 ? 'Refund Amount:' : 'Total:'}
            </Typography>
            <Box sx={{ textAlign: 'right' }}>
              <Typography 
                variant="h6" 
                fontWeight="bold" 
                color={total < 0 ? 'error.main' : (total > 0 ? 'primary' : 'text.primary')}
              >
                ${Math.abs(total).toFixed(2)}
              </Typography>
              {dualCurrencyTotals && (
                <Typography variant="caption" color="text.secondary">
                  {formatLBPCurrency(dualCurrencyTotals.total)}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        <Tooltip title={items.length === 0 ? "Add items to cart before checkout" : checkoutDisabled ? "Processing transaction..." : "Checkout - Complete the transaction. This will process payment, create a transaction record, and print a receipt if auto-print is enabled."}>
          <span>
            <Button
              variant="contained"
              fullWidth
              size="large"
              disabled={items.length === 0 || checkoutDisabled}
              onClick={onCheckout}
              sx={checkoutButtonSx}
            >
              {checkoutDisabled ? 'Processing...' : 'Checkout'}
            </Button>
          </span>
        </Tooltip>
      </Paper>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={removeItemDialog.open}
        title="Remove Item"
        message={`Are you sure you want to remove "${removeItemDialog.itemName}" from the cart?`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={handleConfirmRemoveItem}
        onCancel={() => setRemoveItemDialog({ open: false, productId: 0, transactionType: 'sale', itemName: '' })}
        confirmColor="error"
      />
      <ConfirmDialog
        open={clearCartDialog}
        title="Clear Cart"
        message="Are you sure you want to clear all items from the cart? This action cannot be undone."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        onConfirm={handleConfirmClearCart}
        onCancel={() => setClearCartDialog(false)}
        confirmColor="error"
      />
    </Box>
  );
};

export default ShoppingCart;

