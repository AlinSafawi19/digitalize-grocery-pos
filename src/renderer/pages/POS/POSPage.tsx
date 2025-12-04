import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Grid, TextField, InputAdornment, Paper, Button, ButtonGroup, IconButton, Menu, MenuItem, Typography, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { Search, QrCodeScanner, Home, Menu as MenuIcon, Dashboard, Inventory, Category, LocalShipping, Receipt, Warehouse, ShoppingCart as ShoppingCartIcon, LocalOffer, Assessment, Analytics, History, Settings, Backup, Phone, VpnKey, People, AccountBalanceWallet } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../../store';
import { AuthState } from '../../store/slices/auth.slice';
import { addItemWithRounding, clearCart, setTransactionType as setCartTransactionType } from '../../store/slices/cart.slice';
import ProductGrid from './components/ProductGrid';
import ShoppingCart from './components/ShoppingCart';
import { ProductService, Product } from '../../services/product.service';
import { PricingService, Promotion } from '../../services/pricing.service';
import { SettingsService } from '../../services/settings.service';
import { TransactionService } from '../../services/transaction.service';
import { ReceiptService } from '../../services/receipt.service';
import { CashDrawerService } from '../../services/cash-drawer.service';
import { ROUTES } from '../../utils/constants';
import { usePricingRules } from '../../hooks/usePricingRules';
import { useRoutePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

type TransactionType = 'sale' | 'return';

const POSPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useSelector((state: RootState): AuthState => state.auth);
  const { items, subtotal, tax, total, transactionDiscount } = useSelector((state: RootState) => state.cart);
  const { toast, showToast, hideToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>('sale');
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [taxInclusive, setTaxInclusive] = useState<boolean>(false);
  const [pendingTransactionId, setPendingTransactionId] = useState<number | null>(null);
  const [openingDrawer, setOpeningDrawer] = useState(false);

  // Apply pricing rules automatically when cart changes
  usePricingRules();

  // Permission checks for navigation menu
  const canAccessProducts = useRoutePermission(ROUTES.PRODUCTS);
  const canAccessCategories = useRoutePermission(ROUTES.CATEGORIES);
  const canAccessSuppliers = useRoutePermission(ROUTES.SUPPLIERS);
  // Cashiers page is only accessible by main user (ID = 1)
  const canAccessCashiers = user?.id === 1;
  const canAccessTransactions = useRoutePermission(ROUTES.TRANSACTIONS);
  const canAccessInventory = useRoutePermission(ROUTES.INVENTORY);
  const canAccessPurchaseOrders = useRoutePermission(ROUTES.PURCHASE_ORDERS);
  const canAccessPricing = useRoutePermission(ROUTES.PRICING_RULES);
  const canAccessReports = useRoutePermission(ROUTES.REPORTS);
  const canAccessAnalytics = useRoutePermission(ROUTES.ANALYTICS);
  const canAccessSettings = useRoutePermission(ROUTES.SETTINGS);

  // Sync cart transaction type with local state on mount
  useEffect(() => {
    dispatch(setCartTransactionType({ transactionType }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Recalculate cart items when tax config changes
  useEffect(() => {
    if (items.length > 0) {
      // Re-add all items with new tax config to recalculate
      // Adding with quantity 0 will update existing items with new tax config
      items.forEach((item) => {
        dispatch(
          addItemWithRounding({
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            unit: item.unit,
            unitPrice: item.unitPrice,
            currency: item.currency,
            taxRate: taxRate,
            taxInclusive: taxInclusive,
            quantity: 0, // This will update existing item's tax config without changing quantity
          })
        );
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxRate, taxInclusive]); // Only recalculate when tax config actually changes

  const loadTaxConfig = useCallback(async () => {
    if (!user?.id) return;

    try {
      const result = await SettingsService.getTaxConfig(user.id);
      if (result.success && result.taxConfig) {
        setTaxRate(result.taxConfig.defaultTaxRate || 0);
        setTaxInclusive(result.taxConfig.taxInclusive || false);
      }
    } catch (error) {
      console.error('[POS] Error loading tax config:', error);
    }
  }, [user?.id]);

  const loadActivePromotions = useCallback(async () => {
    if (!user?.id) return;

    try {
      const result = await PricingService.getActivePromotions(user.id);
      if (result.success && result.promotions) {
        setActivePromotions(result.promotions);
      }
    } catch (error) {
      console.error('[POS] Error loading active promotions:', {
        userId: user.id,
        error,
      });
    }
  }, [user?.id]);


  // Load active promotions and tax config on mount
  useEffect(() => {
    loadActivePromotions();
    loadTaxConfig();
    // Refresh promotions every 5 minutes
    const interval = setInterval(loadActivePromotions, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadActivePromotions, loadTaxConfig]);

  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuAnchorEl(null);
  }, []);

  // PERFORMANCE FIX: Reduce initial load and implement pagination
  // Load 50 products initially instead of 100 to improve initial render time
  const [productPage, setProductPage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const PRODUCTS_PER_PAGE = 50; // Reduced from 100 for better performance

  const loadProducts = useCallback(async (page: number = 1, append: boolean = false) => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const result = await ProductService.getProducts(
        {
          page,
          pageSize: PRODUCTS_PER_PAGE,
          search: searchQuery || undefined,
        },
        user.id
      );

      if (result.success && result.products) {
        if (append) {
          // Append new products for infinite scroll
          setProducts((prev) => [...prev, ...result.products!]);
        } else {
          // Replace products for new search or initial load
          setProducts(result.products);
        }
        
        // Check if there are more products to load
        const totalPages = result.totalPages || 1;
        setHasMoreProducts(page < totalPages);
        setProductPage(page);
      }
    } catch (error) {
      console.error('[POS] Error loading products:', {
        userId: user.id,
        searchQuery,
        error,
      });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, user?.id, PRODUCTS_PER_PAGE]);

  // Load products on mount and when search changes
  useEffect(() => {
    setProductPage(1);
    setHasMoreProducts(true);
    loadProducts(1, false);
  }, [searchQuery, user?.id, loadProducts]); // Only reload when search or user changes

  // Load more products handler for infinite scroll
  const loadMoreProducts = useCallback(() => {
    if (!loading && hasMoreProducts && user?.id) {
      loadProducts(productPage + 1, true);
    }
  }, [loading, hasMoreProducts, productPage, loadProducts, user?.id]);

  // Handle barcode scanner input
  const handleBarcodeSubmit = useCallback(
    async (barcode: string) => {
      if (!barcode.trim() || !user?.id) return;

      try {
        const result = await ProductService.getProductByBarcode(barcode.trim(), user.id);
        if (result.success && result.product) {
          // Add product to cart
          dispatch(
            addItemWithRounding({
              productId: result.product.id,
              productCode: result.product.code,
              productName: result.product.name,
              unit: result.product.unit,
              unitPrice: result.product.price,
              currency: result.product.currency || 'USD',
              taxRate: taxRate,
              taxInclusive: taxInclusive,
              quantity: 1,
            })
          );
          
          setBarcodeInput(''); // Clear input
        } else {
          // Show user-friendly message explaining product not found
          showToast(
            `Product not found for barcode: ${barcode.trim()}. Please check the barcode or add this product to the system first.`,
            'warning'
          );
          setBarcodeInput(''); // Clear input
        }
      } catch (error) {
        console.error('[POS] Error fetching product by barcode:', {
          userId: user.id,
          barcode: barcode.trim(),
          error,
        });
        // Show user-friendly error message
        showToast(
          `Error looking up product: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`,
          'error'
        );
        setBarcodeInput(''); // Clear input
      }
    },
    [dispatch, user, taxRate, taxInclusive, showToast]
  );

  // Handle barcode input with Enter key
  const handleBarcodeKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      handleBarcodeSubmit(barcodeInput);
    }
  }, [barcodeInput, handleBarcodeSubmit]);

  // Handle product click
  const handleProductClick = useCallback((product: Product) => {
    dispatch(
      addItemWithRounding({
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        unit: product.unit,
        unitPrice: product.price,
        currency: product.currency || 'USD',
        taxRate: taxRate,
        taxInclusive: taxInclusive,
        quantity: 1,
        transactionType: transactionType,
      })
    );
  }, [dispatch, user?.id, transactionType, taxRate, taxInclusive]);

  // Handle manual cash drawer open
  const handleOpenDrawer = useCallback(async () => {
    if (!user?.id) return;

    try {
      setOpeningDrawer(true);

      // Get printer settings to get printer name
      const printerSettingsResult = await SettingsService.getPrinterSettings(user.id);
      const printerName = printerSettingsResult.success && printerSettingsResult.printerSettings?.printerName
        ? printerSettingsResult.printerSettings.printerName
        : undefined;

      const result = await CashDrawerService.openCashDrawer(printerName);

      if (result.success) {
        showToast('Cash drawer opened', 'success');
      } else {
        showToast(
          result.error || 'Failed to open cash drawer. Please check printer connection.',
          'warning'
        );
      }
    } catch (error) {
      console.error('[POS] Error opening cash drawer', {
        userId: user.id,
        error,
      });
      showToast(
        error instanceof Error ? error.message : 'Failed to open cash drawer',
        'error'
      );
    } finally {
      setOpeningDrawer(false);
    }
  }, [user?.id, showToast]);

  // Handle checkout - process transaction directly
  const handleCheckout = useCallback(async () => {
    if (items.length === 0 || !user?.id) return;

    // Determine effective transaction type based on cart total
    // If total < 0, it's a refund (customer gets money back)
    // If total >= 0, it's a payment (customer pays)
    const effectiveTransactionType: 'sale' | 'return' = total < 0 ? 'return' : 'sale';
    const isRefund = effectiveTransactionType === 'return';
    const absoluteTotal = Math.abs(total);

    setProcessingCheckout(true);

    try {
      let createResult;

      // If transaction was already created during printing, use it
      if (pendingTransactionId) {
        // Fetch the existing transaction
        const transactionResult = await TransactionService.getTransactionById(
          pendingTransactionId,
          user.id
        );
        
        if (!transactionResult.success || !transactionResult.transaction) {
          throw new Error('Failed to retrieve pending transaction');
        }

        createResult = {
          success: true,
          transaction: transactionResult.transaction,
        };
      } else {
        // Create transaction with effective type based on cart total
        const transactionInput = {
          type: effectiveTransactionType,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            transactionType: item.transactionType || 'sale', // Pass item's transaction type
          })),
          discount: transactionDiscount,
          cashierId: user.id,
        };

        createResult = await TransactionService.createTransaction(
          transactionInput,
          user.id
        );
      }

      if (!createResult.success || !createResult.transaction) {
        console.error('[POS Checkout] Transaction creation failed', {
          userId: user.id,
          error: createResult.error,
          transactionType: effectiveTransactionType,
        });
        throw new Error(createResult.error || 'Failed to create transaction');
      }

      // For returns, the payment represents a refund (negative amount)
      // For sales, the payment is positive (money coming in)
      // Cash received equals the absolute total (exact payment, no change)
      const paymentInput = {
        amount: isRefund ? -absoluteTotal : total,
        received: absoluteTotal, // Cash received equals total (exact payment)
      };

      const paymentResult = await TransactionService.addPayment(
        createResult.transaction.id,
        paymentInput,
        user.id
      );

      if (!paymentResult.success) {
        console.error('[POS Checkout] Payment processing failed', {
          userId: user.id,
          transactionId: createResult.transaction.id,
          error: paymentResult.error,
        });
        throw new Error(paymentResult.error || 'Failed to process payment');
      }

      // Generate receipt and print immediately if auto-print is enabled
      try {
        // Get printer settings first to check if auto-print is enabled
        const printerSettingsResult = await SettingsService.getPrinterSettings(user.id);
        
        const shouldAutoPrint = printerSettingsResult.success && 
                                printerSettingsResult.printerSettings?.autoPrint;
        
        const receiptResult = await ReceiptService.generateReceipt(
          createResult.transaction.id,
          user.id
        );
        
        if (receiptResult.success && receiptResult.filepath) {
          // Receipt generated successfully

          // Print immediately if auto-print is enabled
          if (shouldAutoPrint) {
            const printerName = printerSettingsResult.printerSettings?.printerName;

            // Print the receipt immediately - await to ensure it starts right away
            // but don't fail the transaction if printing fails
            try {
              const printResult = await ReceiptService.printReceipt(
                receiptResult.filepath,
                printerName
              );

              if (printResult.success) {
                showToast('Receipt printed successfully', 'success');
              } else {
                showToast(
                  `Receipt generated but printing failed: ${printResult.error || 'Unknown error'}`,
                  'warning'
                );
              }
            } catch (printError) {
              console.error('[POS Checkout] Error printing receipt:', {
                userId: user.id,
                transactionId: createResult.transaction?.id,
                printerName: printerName || '(default printer)',
                error: printError,
              });
              showToast(
                `Receipt generated but printing failed: ${printError instanceof Error ? printError.message : 'Unknown error'}`,
                'warning'
              );
              }
            }
        }
      } catch (receiptError) {
        // Log error but don't fail the transaction
        console.error('[POS Checkout] Exception during receipt generation/printing:', {
          userId: user.id,
          transactionId: createResult.transaction.id,
          error: receiptError,
          errorMessage: receiptError instanceof Error ? receiptError.message : String(receiptError),
          errorStack: receiptError instanceof Error ? receiptError.stack : undefined,
        });
      }

      // Auto-open cash drawer if enabled
      try {
        const cashDrawerSettingsResult = await SettingsService.getCashDrawerSettings(user.id);
        if (cashDrawerSettingsResult.success && cashDrawerSettingsResult.cashDrawerSettings?.autoOpen) {
          const printerSettingsResult = await SettingsService.getPrinterSettings(user.id);
          const printerName = printerSettingsResult.success && printerSettingsResult.printerSettings?.printerName
            ? printerSettingsResult.printerSettings.printerName
            : undefined;

          await CashDrawerService.openCashDrawer(printerName);
          // Don't show error toast for auto-open failures to avoid disrupting checkout flow
        }
      } catch (drawerError) {
        // Log but don't fail the transaction if cash drawer fails
        console.error('[POS Checkout] Error in cash drawer auto-open', {
          userId: user.id,
          error: drawerError,
        });
      }

      showToast(
        isRefund
          ? 'Return processed successfully'
          : 'Transaction completed successfully',
        'success'
      );
      
      // Clear cart and reset pending transaction after successful checkout
      dispatch(clearCart());
      setPendingTransactionId(null);
    } catch (err) {
      console.error('[POS Checkout] Checkout processing error', {
        userId: user?.id,
        transactionType: effectiveTransactionType,
        error: err,
      });
      showToast(
        err instanceof Error ? err.message : 'Failed to process checkout',
        'error'
      );
    } finally {
      setProcessingCheckout(false);
    }
  }, [items, user?.id, total, subtotal, tax, transactionDiscount, dispatch, showToast, pendingTransactionId]);

  // Memoize sx prop objects to avoid recreation on every render
  const containerBoxSx = useMemo(() => ({
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  }), []);

  const headerPaperSx = useMemo(() => ({
    p: 2,
    borderRadius: 0,
    borderBottom: '1px solid #c0c0c0',
    backgroundColor: '#ffffff',
    boxShadow: 'none',
  }), []);

  const iconButtonSx = useMemo(() => ({
    mr: { xs: 0.5, md: 1 },
    color: '#1a237e',
    width: { xs: 48, md: 56 },
    height: { xs: 48, md: 56 },
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
    '& .MuiSvgIcon-root': {
      fontSize: { xs: 28, md: 32 },
    },
  }), []);

  const buttonGroupSx = useMemo(() => ({
    '& .MuiButton-root': {
      fontSize: { xs: '16px', md: '18px' },
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textTransform: 'none',
      borderRadius: 0,
      borderColor: '#c0c0c0',
      color: '#1a237e',
      minHeight: { xs: 44, md: 44 },
      padding: { xs: '8px 20px', md: '8px 20px' },
      fontWeight: 600,
      '&.MuiButton-contained': {
        backgroundColor: '#1a237e',
        color: '#ffffff',
        '&:hover': {
          backgroundColor: '#283593',
        },
      },
      '&:hover': {
        borderColor: '#1a237e',
        backgroundColor: '#f5f5f5',
      },
    },
  }), []);

  const textFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: { xs: '16px', md: '18px' },
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: { xs: 44, md: 44 },
      '& input': {
        padding: { xs: '10px 14px', md: '12px 14px' },
      },
      '& .MuiInputAdornment-root': {
        '& .MuiSvgIcon-root': {
          fontSize: { xs: 24, md: 28 },
        },
      },
      '& fieldset': {
        borderColor: '#c0c0c0',
        borderWidth: '1px',
      },
      '&:hover fieldset': {
        borderColor: '#1a237e',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#1a237e',
        borderWidth: '1px',
      },
    },
    '& .MuiInputLabel-root': {
      fontSize: { xs: '14px', md: '16px' },
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const mainContentBoxSx = useMemo(() => ({
    flex: 1,
    display: 'flex',
    flexDirection: { xs: 'column', md: 'row' },
    overflow: 'hidden',
  }), []);

  const productGridBoxSx = useMemo(() => ({
    width: { xs: '100%', md: '70%' },
    height: { xs: '50vh', md: 'auto' },
    borderRight: { xs: 'none', md: '1px solid #c0c0c0' },
    borderBottom: { xs: '1px solid #c0c0c0', md: 'none' },
    overflow: 'auto',
    backgroundColor: '#ffffff',
  }), []);

  const shoppingCartBoxSx = useMemo(() => ({
    width: { xs: '100%', md: '30%' },
    height: { xs: '50vh', md: 'auto' },
    overflow: 'auto',
    backgroundColor: '#ffffff',
  }), []);

  const footerPaperSx = useMemo(() => ({
    position: 'sticky',
    bottom: 0,
    width: '100%',
    backgroundColor: '#f5f5f5',
    color: '#333333',
    py: { xs: 1, md: 1.5 },
    px: { xs: 2, md: 3 },
    zIndex: 1000,
    borderTop: '1px solid #c0c0c0',
    borderRadius: 0,
    boxShadow: 'none',
  }), []);

  const footerBoxSx = useMemo(() => ({
    display: 'flex',
    flexDirection: { xs: 'column', sm: 'row' },
    alignItems: 'center',
    justifyContent: 'center',
    gap: { xs: 1, sm: 2 },
  }), []);

  const footerTypographySx = useMemo(() => ({
    fontSize: { xs: '14px', md: '16px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
    textAlign: { xs: 'center', sm: 'left' },
  }), []);

  const footerPhoneBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  }), []);

  const footerPhoneLinkSx = useMemo(() => ({
    color: 'inherit',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: { xs: '12px', md: '13px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
    '&:hover': {
      textDecoration: 'underline',
    },
  }), []);

  const menuItemSx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    minHeight: 44,
    padding: '10px 16px',
    '& .MuiSvgIcon-root': {
      fontSize: 20,
    },
  }), []);

  const menuPaperSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
  }), []);

  // Memoize navigation handlers
  const handleNavigate = useCallback((route: string) => {
    // Block access to backup, license, and logs pages for non-main users
    if ((route === ROUTES.BACKUP || route === ROUTES.LICENSE || route === ROUTES.LOGS) && user?.id !== 1) {
      navigate(ROUTES.ACCESS_DENIED);
      handleMenuClose();
      return;
    }
    navigate(route);
    handleMenuClose();
  }, [navigate, handleMenuClose, user?.id]);

  // Memoize transaction type change handlers
  const handleTransactionTypeChange = useCallback((type: TransactionType) => {
    setTransactionType(type);
    dispatch(setCartTransactionType({ transactionType: type }));
  }, [dispatch]);

  // Memoize search and barcode input handlers
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, [setSearchQuery]);

  const handleBarcodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcodeInput(e.target.value);
  }, [setBarcodeInput]);

  return (
    <Box sx={containerBoxSx}>
      {/* Header */}
      <Paper sx={headerPaperSx}>
        <Grid container spacing={{ xs: 1, md: 2 }} alignItems="center">
          {/* Navigation Buttons */}
          <Grid item xs="auto">
            <Tooltip title="Go to Dashboard - View overview and quick actions">
              <IconButton
                onClick={() => navigate(ROUTES.DASHBOARD)}
                sx={iconButtonSx}
              >
                <Home />
              </IconButton>
            </Tooltip>
            <Tooltip title="Navigation Menu - Access all sections of the application">
              <IconButton
                onClick={handleMenuOpen}
                sx={iconButtonSx}
              >
                <MenuIcon />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={menuAnchorEl}
              open={Boolean(menuAnchorEl)}
              onClose={handleMenuClose}
              PaperProps={{ sx: menuPaperSx }}
            >
              <MenuItem onClick={() => handleNavigate(ROUTES.DASHBOARD)} sx={menuItemSx}>
                <Dashboard sx={{ mr: 1 }} />
                Dashboard
              </MenuItem>
              {canAccessProducts && (
                <MenuItem onClick={() => handleNavigate(ROUTES.PRODUCTS)} sx={menuItemSx}>
                  <Inventory sx={{ mr: 1 }} />
                  Products
                </MenuItem>
              )}
              {canAccessCategories && (
                <MenuItem onClick={() => handleNavigate(ROUTES.CATEGORIES)} sx={menuItemSx}>
                  <Category sx={{ mr: 1 }} />
                  Categories
                </MenuItem>
              )}
              {canAccessSuppliers && (
                <MenuItem onClick={() => handleNavigate(ROUTES.SUPPLIERS)} sx={menuItemSx}>
                  <LocalShipping sx={{ mr: 1 }} />
                  Suppliers
                </MenuItem>
              )}
              {canAccessCashiers && (
                <MenuItem onClick={() => handleNavigate(ROUTES.CASHIERS)} sx={menuItemSx}>
                  <People sx={{ mr: 1 }} />
                  Cashiers
                </MenuItem>
              )}
              {canAccessTransactions && (
                <MenuItem onClick={() => handleNavigate(ROUTES.TRANSACTIONS)} sx={menuItemSx}>
                  <Receipt sx={{ mr: 1 }} />
                  Transactions
                </MenuItem>
              )}
              {canAccessInventory && (
                <MenuItem onClick={() => handleNavigate(ROUTES.INVENTORY)} sx={menuItemSx}>
                  <Warehouse sx={{ mr: 1 }} />
                  Inventory
                </MenuItem>
              )}
              {canAccessPurchaseOrders && (
                <MenuItem onClick={() => handleNavigate(ROUTES.PURCHASE_ORDERS)} sx={menuItemSx}>
                  <ShoppingCartIcon sx={{ mr: 1 }} />
                  Purchase Orders
                </MenuItem>
              )}
              {canAccessPricing && (
                <MenuItem onClick={() => handleNavigate(ROUTES.PRICING_RULES)} sx={menuItemSx}>
                  <LocalOffer sx={{ mr: 1 }} />
                  Pricing
                </MenuItem>
              )}
              {canAccessReports && (
                <MenuItem onClick={() => handleNavigate(ROUTES.REPORTS)} sx={menuItemSx}>
                  <Assessment sx={{ mr: 1 }} />
                  Reports
                </MenuItem>
              )}
              {canAccessAnalytics && (
                <MenuItem onClick={() => handleNavigate(ROUTES.ANALYTICS)} sx={menuItemSx}>
                  <Analytics sx={{ mr: 1 }} />
                  Analytics
                </MenuItem>
              )}
              {user?.id === 1 && (
                <MenuItem onClick={() => handleNavigate(ROUTES.LOGS)} sx={menuItemSx}>
                  <History sx={{ mr: 1 }} />
                  Logs
                </MenuItem>
              )}
              {canAccessSettings && (
                <MenuItem onClick={() => handleNavigate(ROUTES.SETTINGS)} sx={menuItemSx}>
                  <Settings sx={{ mr: 1 }} />
                  Settings
                </MenuItem>
              )}
              {user?.id === 1 && (
                <MenuItem onClick={() => handleNavigate(ROUTES.BACKUP)} sx={menuItemSx}>
                  <Backup sx={{ mr: 1 }} />
                  Backup and Restore
                </MenuItem>
              )}
              {user?.id === 1 && (
                <MenuItem onClick={() => handleNavigate(ROUTES.LICENSE)} sx={menuItemSx}>
                  <VpnKey sx={{ mr: 1 }} />
                  License
                </MenuItem>
              )}
            </Menu>
          </Grid>
          {/* Transaction Type Selector */}
          <Grid item xs={12} sm="auto">
            <ButtonGroup size="large" variant="outlined" sx={buttonGroupSx} fullWidth={isMobile}>
              <Tooltip title="Sale Mode - Process regular sales transactions. Products will be added to cart for purchase.">
                <span>
                  <Button
                    variant={transactionType === 'sale' ? 'contained' : 'outlined'}
                    onClick={() => handleTransactionTypeChange('sale')}
                  >
                    Sale
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="Return Mode - Process returns and refunds. Products will be added to cart as returns, and customer will receive a refund.">
                <span>
                  <Button
                    variant={transactionType === 'return' ? 'contained' : 'outlined'}
                    onClick={() => handleTransactionTypeChange('return')}
                  >
                    Return
                  </Button>
                </span>
              </Tooltip>
            </ButtonGroup>
          </Grid>
          {/* Open Cash Drawer Button */}
          <Grid item xs={12} sm="auto">
            <Tooltip title="Open Cash Drawer - Manually open the cash drawer connected to your receipt printer.">
              <span>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<AccountBalanceWallet />}
                  onClick={handleOpenDrawer}
                  disabled={openingDrawer}
                  fullWidth={isMobile}
                  sx={{
                    ...buttonGroupSx['& .MuiButton-root'],
                    textTransform: 'none',
                    '& .MuiSvgIcon-root': {
                      fontSize: 24,
                    },
                  }}
                >
                  {openingDrawer ? 'Opening...' : 'Open Drawer'}
                </Button>
              </span>
            </Tooltip>
          </Grid>
          {/* Search and Scan - Side by Side */}
          <Grid item xs={12} md>
            <Tooltip title="Search Products - Type to search products by name, product code, or barcode. Results will appear in the product grid below.">
              <TextField
                fullWidth
                placeholder="Search products by name, code, or barcode..."
                value={searchQuery}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                size="medium"
                sx={textFieldSx}
              />
            </Tooltip>
          </Grid>
          <Grid item xs={12} md>
            <Tooltip title="Barcode Scanner - Scan or type a barcode and press Enter to automatically add the product to cart. Works with barcode scanners and manual entry.">
              <TextField
                fullWidth
                placeholder="Scan barcode..."
                value={barcodeInput}
                onChange={handleBarcodeChange}
                onKeyPress={handleBarcodeKeyPress}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <QrCodeScanner />
                    </InputAdornment>
                  ),
                }}
                size="medium"
                autoFocus
                sx={textFieldSx}
              />
            </Tooltip>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Content - Split Screen */}
      <Box sx={mainContentBoxSx}>
        {/* Left Side - Product Grid (70%) */}
        <Box sx={productGridBoxSx}>
          <ProductGrid
            products={products}
            loading={loading}
            onProductClick={handleProductClick}
          />
          {/* Load More Button - PERFORMANCE FIX: Only load more when needed */}
          {hasMoreProducts && !loading && products.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 2 }}>
              <Button
                variant="outlined"
                onClick={loadMoreProducts}
                sx={{
                  fontSize: '16px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  textTransform: 'none',
                  padding: '8px 24px',
                }}
              >
                Load More Products
              </Button>
            </Box>
          )}
        </Box>

        {/* Right Side - Shopping Cart (30%) */}
        <Box sx={shoppingCartBoxSx}>
          <ShoppingCart 
            onCheckout={handleCheckout} 
            activePromotions={activePromotions} 
            transactionType={transactionType}
            checkoutDisabled={processingCheckout}
          />
        </Box>
      </Box>

      {/* Contact administrator Footer - Always Visible */}
      <Paper component="footer" sx={footerPaperSx}>
        <Box sx={footerBoxSx}>
          <Typography sx={footerTypographySx}>
            Contact Administrator:
          </Typography>
          <Box sx={footerPhoneBoxSx}>
            <Phone sx={{ fontSize: 18 }} />
            <Typography
              component="a"
              href="tel:+96171882088"
              sx={footerPhoneLinkSx}
            >
              +96171882088
            </Typography>
          </Box>
        </Box>
      </Paper>
      <Toast toast={toast} onClose={hideToast} />
    </Box>
  );
};

export default POSPage;

