import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  CircularProgress,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import { Add, Delete, ArrowBack } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useSelector } from 'react-redux';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { RootState } from '../../store';
import { fromBeirutToUTC, utcDateToDate, toBeirutTime } from '../../utils/dateUtils';
import {
  PurchaseOrderService,
  UpdatePurchaseOrderInput,
  PurchaseOrder,
  PurchaseOrderItem,
} from '../../services/purchase-order.service';
import { SupplierService } from '../../services/supplier.service';
import { ProductService, Supplier, Product } from '../../services/product.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

// Move formatCurrency outside component to avoid recreating on each render
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (amount: number) => currencyFormatter.format(amount);

interface PurchaseOrderItemInput {
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

const PurchaseOrderForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    supplierId?: string;
    items?: string;
    itemErrors?: { [index: number]: { productId?: string; quantity?: string; unitPrice?: string } };
  }>({});

  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [expectedDate, setExpectedDate] = useState<Date | null>(null);
  const [items, setItems] = useState<PurchaseOrderItemInput[]>([]);
  const [total, setTotal] = useState(0);

  // Initial values for change detection
  const [initialSupplierId, setInitialSupplierId] = useState<number | null>(null);
  const [initialExpectedDate, setInitialExpectedDate] = useState<Date | null>(null);
  const [initialItems, setInitialItems] = useState<PurchaseOrderItemInput[]>([]);

  // Supplier and Product autocomplete states
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierHasMore, setSupplierHasMore] = useState(true);
  const [supplierSearch, setSupplierSearch] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [productHasMore, setProductHasMore] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [barcodeInputs, setBarcodeInputs] = useState<{ [index: number]: string }>({});
  const [barcodeLoading, setBarcodeLoading] = useState<{ [index: number]: boolean }>({});

  // Load purchase order if editing
  useEffect(() => {
    if (id && user?.id) {
      setIsEditMode(true);
      setLoadingOrder(true);
      PurchaseOrderService.getPurchaseOrderById(parseInt(id), user.id)
        .then((result) => {
          if (result.success && result.purchaseOrder) {
            const order = result.purchaseOrder;
            setPurchaseOrder(order);
            const loadedSupplierId = order.supplierId;
            const loadedExpectedDate = order.expectedDate ? utcDateToDate(order.expectedDate) : null;
            const loadedItems = order.items.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            }));
            setSupplierId(loadedSupplierId);
            setExpectedDate(loadedExpectedDate);
            setItems(loadedItems);
            setTotal(order.total);
            setInitialSupplierId(loadedSupplierId);
            setInitialExpectedDate(loadedExpectedDate);
            setInitialItems(loadedItems);
            // Initialize barcode inputs for loaded items
            const initialBarcodeInputs: { [index: number]: string } = {};
            loadedItems.forEach((_, idx) => {
              initialBarcodeInputs[idx] = '';
            });
            setBarcodeInputs(initialBarcodeInputs);
            
            // If editing and has a supplier, ensure the supplier is loaded
            if (order.supplierId && order.supplier) {
              setSuppliers((prev) => {
                const exists = prev.some((s) => s.id === order.supplierId);
                if (!exists) {
                  return [order.supplier, ...prev];
                }
                return prev;
              });
            }
            
            // If editing, ensure selected products are loaded
            if (order.items && order.items.length > 0) {
              const missingProducts = order.items
                .filter((item) => item.product)
                .map((item) => item.product);
              
              if (missingProducts.length > 0) {
                setProducts((prev) => {
                  const existingProductIds = new Set(prev.map((p) => p.id));
                  const newProducts = missingProducts.filter(
                    (p) => !existingProductIds.has(p.id)
                  );
                  return [...prev, ...newProducts];
                });
              }
            }
          } else {
            showToast(result.error || 'Failed to load purchase order', 'error');
          }
        })
        .catch((err) => {
          showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
        })
        .finally(() => {
          setLoadingOrder(false);
        });
    }
  }, [id, user?.id, showToast]);

  // Debounced search states
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const supplierSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const productSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load suppliers
  const loadSuppliers = useCallback(async (page: number, reset: boolean = false, search: string = '') => {
    if (!user?.id) return;
    
    setSupplierLoading(true);
    try {
      const result = await SupplierService.getSuppliers(
        { page, pageSize: 50, search },
        user.id
      );
      if (result.success && result.suppliers) {
        if (reset) {
          setSuppliers(result.suppliers);
        } else {
          setSuppliers((prev) => {
            const existingIds = new Set(prev.map((s) => s.id));
            const newItems = result.suppliers!.filter((s) => !existingIds.has(s.id));
            return [...prev, ...newItems];
          });
        }
        setSupplierHasMore(result.pagination?.hasNextPage ?? false);
      }
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setSupplierLoading(false);
    }
  }, [user?.id]);

  // Load template data if provided via location state
  useEffect(() => {
    if (!id && location.state?.templateData && user?.id) {
      const templateData = location.state.templateData;
      setSupplierId(templateData.supplierId);
      if (templateData.expectedDate) {
        // Convert UTC date from template to local Date object for date picker
        // The date picker expects a Date object in local timezone
        const beirutTime = toBeirutTime(templateData.expectedDate);
        if (beirutTime) {
          setExpectedDate(beirutTime.toDate());
        } else {
          setExpectedDate(new Date(templateData.expectedDate));
        }
      }
      setItems(
        templateData.items.map((item: PurchaseOrderItem) => ({
          productId: item.productId,
          productName: '', // Will be loaded when products are fetched
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.quantity * item.unitPrice,
        }))
      );
      if (location.state.templateName) {
        showToast(`Template "${location.state.templateName}" loaded`, 'success');
      }
    }
  }, [id, location.state, user?.id, showToast]);

  // Debounce supplier search
  useEffect(() => {
    if (supplierSearchTimeoutRef.current) {
      clearTimeout(supplierSearchTimeoutRef.current);
    }
    supplierSearchTimeoutRef.current = setTimeout(() => {
      setDebouncedSupplierSearch(supplierSearch);
    }, 300);

    return () => {
      if (supplierSearchTimeoutRef.current) {
        clearTimeout(supplierSearchTimeoutRef.current);
      }
    };
  }, [supplierSearch]);

  // Load initial suppliers
  useEffect(() => {
    if (user?.id) {
      setSupplierPage(1);
      loadSuppliers(1, true, '');
    }
  }, [user?.id, loadSuppliers]);

  // Reset and reload when debounced search changes
  useEffect(() => {
    if (user?.id) {
      setSupplierPage(1);
      loadSuppliers(1, true, debouncedSupplierSearch);
    }
  }, [debouncedSupplierSearch, user?.id, loadSuppliers]);

  // Load products - only when supplier is selected
  const loadProducts = useCallback(async (page: number, reset: boolean = false, search: string = '', supplierIdFilter: number | null = null) => {
    if (!user?.id || !supplierIdFilter) {
      if (reset) {
        setProducts([]);
      }
      return;
    }
    
    setProductLoading(true);
    try {
      const result = await ProductService.getProducts(
        { page, pageSize: 50, search, supplierId: supplierIdFilter },
        user.id
      );
      if (result.success && result.products) {
        if (reset) {
          setProducts(result.products);
        } else {
          setProducts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newItems = result.products!.filter((p) => !existingIds.has(p.id));
            return [...prev, ...newItems];
          });
        }
        setProductHasMore(result.totalPages ? page < result.totalPages : false);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setProductLoading(false);
    }
  }, [user?.id]);

  // Debounce product search
  useEffect(() => {
    if (productSearchTimeoutRef.current) {
      clearTimeout(productSearchTimeoutRef.current);
    }
    
    productSearchTimeoutRef.current = setTimeout(() => {
      setDebouncedProductSearch(productSearch);
    }, 300);

    return () => {
      if (productSearchTimeoutRef.current) {
        clearTimeout(productSearchTimeoutRef.current);
      }
    };
  }, [productSearch]);

  // Track previous supplier to detect actual changes
  const prevSupplierIdRef = useRef<number | null>(null);

  // Load products when supplier is selected or changed
  useEffect(() => {
    if (user?.id && supplierId) {
      const supplierChanged = prevSupplierIdRef.current !== null && prevSupplierIdRef.current !== supplierId;
      
      // Only clear products if supplier actually changed (not on initial load)
      if (supplierChanged) {
        setProducts([]);
        // Clear items when supplier changes and add one empty item
        setItems([{
          productId: null,
          productName: '',
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
        }]);
        // Clear barcode inputs when supplier changes and initialize for new item
        setBarcodeInputs({ 0: '' });
        setBarcodeLoading({});
      }
      prevSupplierIdRef.current = supplierId;
      setProductPage(1);
      loadProducts(1, true, '', supplierId);
      
      // Automatically add one item if no items exist (for new orders when supplier is first selected)
      // This only applies when supplier hasn't changed (initial selection)
      if (!supplierChanged && items.length === 0) {
        setItems([{
          productId: null,
          productName: '',
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
        }]);
        // Initialize barcode input for the new item
        setBarcodeInputs({ 0: '' });
      }
    } else if (!supplierId) {
      // Clear products when supplier is cleared
      setProducts([]);
      setProductPage(1);
      setProductHasMore(true);
      prevSupplierIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, user?.id]);

  // Track previous debounced search to prevent unnecessary reloads
  const prevDebouncedProductSearchRef = useRef<string>('');

  // Reset and reload when debounced search changes (only if supplier is selected)
  useEffect(() => {
    if (user?.id && supplierId) {
      // Only reload if the search actually changed
      if (prevDebouncedProductSearchRef.current !== debouncedProductSearch) {
        prevDebouncedProductSearchRef.current = debouncedProductSearch;
        setProductPage(1);
        loadProducts(1, true, debouncedProductSearch, supplierId);
      }
    } else {
      prevDebouncedProductSearchRef.current = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedProductSearch, supplierId, user?.id]);

  // Calculate total when items change
  useEffect(() => {
    const newTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    setTotal(newTotal);
  }, [items]);

  // Create a map of products by ID for faster lookups
  const productsById = useMemo(() => {
    const map = new Map<number, Product>();
    products.forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [products]);

  // Memoize available products for each row to avoid recalculating on every render
  const availableProductsByIndex = useMemo(() => {
    // For each item, return products excluding those selected in other items
    return items.map((item, currentIndex) => {
      // Get product IDs selected in OTHER items (not the current one)
      const otherSelectedIds = new Set(
        items
          .map((it, idx) => (idx !== currentIndex && it.productId !== null ? it.productId : null))
          .filter((id): id is number => id !== null)
      );
      
      // Filter out products that are already selected in other items
      const filteredProducts = products.filter((product) => !otherSelectedIds.has(product.id));
      
      // If the current item has a selected product, ensure it's included in the options
      // This prevents Autocomplete from having issues when the value is not in options
      if (item.productId !== null) {
        const selectedProduct = productsById.get(item.productId);
        if (selectedProduct && !filteredProducts.some(p => p.id === selectedProduct.id)) {
          return [selectedProduct, ...filteredProducts];
        }
      }
      
      return filteredProducts;
    });
  }, [products, items, productsById]);

  const handleAddItem = useCallback(() => {
    setItems((prevItems) => [
      ...prevItems,
      {
        productId: null,
        productName: '',
        quantity: 1,
        unitPrice: 0,
        subtotal: 0,
      },
    ]);
    // Initialize barcode input for the new item
    setBarcodeInputs((prev) => ({ ...prev, [items.length]: '' }));
  }, [items.length]);

  const handleRemoveItem = useCallback((index: number) => {
    setItems((prevItems) => prevItems.filter((_, i) => i !== index));
    // Clean up barcode input for removed item
    setBarcodeInputs((prev) => {
      const newInputs = { ...prev };
      delete newInputs[index];
      // Reindex remaining items
      const reindexed: { [index: number]: string } = {};
      Object.keys(newInputs).forEach((key) => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = newInputs[oldIndex];
        } else if (oldIndex < index) {
          reindexed[oldIndex] = newInputs[oldIndex];
        }
      });
      return reindexed;
    });
    setBarcodeLoading((prev) => {
      const newLoading = { ...prev };
      delete newLoading[index];
      const reindexed: { [index: number]: boolean } = {};
      Object.keys(newLoading).forEach((key) => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = newLoading[oldIndex];
        } else if (oldIndex < index) {
          reindexed[oldIndex] = newLoading[oldIndex];
        }
      });
      return reindexed;
    });
  }, []);

  const handleItemChange = useCallback((index: number, field: keyof PurchaseOrderItemInput, value: string | number | null) => {
    setItems((prevItems) => {
      const newItems = [...prevItems];
      const item = { ...newItems[index] };

      if (field === 'productId') {
        if (value === null) {
          item.productId = null;
          item.productName = '';
          item.unitPrice = 0;
        } else {
          const product = productsById.get(value as number);
          if (product) {
            item.productId = product.id;
            item.productName = product.name;
            item.unitPrice = product.costPrice || product.price || 0;
          }
        }
      } else if (field === 'productName') {
        item.productName = value as string;
      } else if (field === 'quantity') {
        item.quantity = value as number;
      } else if (field === 'unitPrice') {
        item.unitPrice = value as number;
      }

      // Recalculate subtotal
      item.subtotal = item.quantity * item.unitPrice;
      newItems[index] = item;
      return newItems;
    });
  }, [productsById]);

  const validateForm = useCallback((): boolean => {
    const errors: {
      supplierId?: string;
      items?: string;
      itemErrors?: { [index: number]: { productId?: string; quantity?: string; unitPrice?: string } };
    } = {};

    // Validate supplier
    if (!supplierId) {
      errors.supplierId = 'Supplier is required';
    }

    // Validate items
    if (items.length === 0) {
      errors.items = 'Please add at least one item';
    } else {
      const itemErrors: { [index: number]: { productId?: string; quantity?: string; unitPrice?: string } } = {};
      
      items.forEach((item, index) => {
        const itemError: { productId?: string; quantity?: string; unitPrice?: string } = {};
        
        if (!item.productId) {
          itemError.productId = 'Product is required';
        }
        
        if (!item.quantity || item.quantity <= 0) {
          itemError.quantity = 'Quantity is required and must be greater than 0';
        }
        
        if (!item.unitPrice || item.unitPrice <= 0) {
          itemError.unitPrice = 'Unit price is required and must be greater than 0';
        }
        
        if (Object.keys(itemError).length > 0) {
          itemErrors[index] = itemError;
        }
      });
      
      if (Object.keys(itemErrors).length > 0) {
        errors.itemErrors = itemErrors;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [supplierId, items]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setFieldErrors({});

    try {
      // TypeScript: supplierId is guaranteed to be non-null after validation
      if (!supplierId) {
        showToast('Supplier is required', 'error');
        setLoading(false);
        return;
      }

      const input = {
        supplierId: supplierId,
        expectedDate: expectedDate ? fromBeirutToUTC(expectedDate) : null,
        items: items.map((item) => ({
          productId: item.productId!,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      if (isEditMode && purchaseOrder) {
        // Check if values have changed
        const currentExpectedDate = expectedDate ? fromBeirutToUTC(expectedDate) : null;
        const initialExpectedDateUTC = initialExpectedDate ? fromBeirutToUTC(initialExpectedDate) : null;
        const expectedDateChanged = currentExpectedDate?.getTime() !== initialExpectedDateUTC?.getTime();

        // Compare items - check if arrays have same length and same content
        const itemsChanged = 
          items.length !== initialItems.length ||
          items.some((item, index) => {
            const initialItem = initialItems[index];
            return !initialItem ||
              item.productId !== initialItem.productId ||
              item.quantity !== initialItem.quantity ||
              item.unitPrice !== initialItem.unitPrice;
          });

        if (
          supplierId === initialSupplierId &&
          !expectedDateChanged &&
          !itemsChanged
        ) {
          showToast('No changes made', 'info');
          return;
        }

        const updateInput: UpdatePurchaseOrderInput = {
          supplierId: supplierId,
          expectedDate: expectedDate ? fromBeirutToUTC(expectedDate) : null,
          items: input.items,
        };
        const result = await PurchaseOrderService.updatePurchaseOrder(
          purchaseOrder.id,
          updateInput,
          user.id
        );
        if (result.success) {
          setInitialSupplierId(supplierId);
          setInitialExpectedDate(expectedDate);
          setInitialItems(items);
          showToast('Purchase order updated successfully', 'success');
          setTimeout(() => {
            navigate(`/purchase-orders/${purchaseOrder.id}`);
          }, 1000);
        } else {
          showToast(result.error || 'Failed to update purchase order', 'error');
        }
      } else {
        const result = await PurchaseOrderService.createPurchaseOrder(input, user.id);
        if (result.success && result.purchaseOrder) {
          showToast('Purchase order created successfully', 'success');
          setTimeout(() => {
            navigate(`/purchase-orders/${result.purchaseOrder!.id}`);
          }, 1000);
        } else {
          showToast(result.error || 'Failed to create purchase order', 'error');
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.id, isEditMode, purchaseOrder, supplierId, expectedDate, items, initialSupplierId, initialExpectedDate, initialItems, validateForm, navigate, showToast]);

  // Memoize supplier value to prevent unnecessary re-renders
  const supplierValue = useMemo(() => {
    return suppliers.find((s) => s.id === supplierId) || null;
  }, [suppliers, supplierId]);

  // Helper function to clear field errors
  const clearItemFieldError = useCallback((
    index: number,
    field: 'productId' | 'quantity' | 'unitPrice'
  ) => {
    setFieldErrors((prevErrors) => {
      if (!prevErrors.itemErrors?.[index]?.[field]) return prevErrors;
      
      const newItemErrors = { ...prevErrors.itemErrors };
      delete newItemErrors[index]?.[field];
      if (Object.keys(newItemErrors[index] || {}).length === 0) {
        delete newItemErrors[index];
      }
      return { ...prevErrors, itemErrors: Object.keys(newItemErrors).length > 0 ? newItemErrors : undefined };
    });
  }, []);

  const handleNavigateBack = useCallback(() => {
    navigate('/purchase-orders');
  }, [navigate]);

  const handleCancel = useCallback(() => {
    navigate('/purchase-orders');
  }, [navigate]);

  const handleSupplierInputChange = useCallback((_: unknown, newValue: string) => {
    // If the input value matches the selected supplier's name, clear the search
    // This prevents searching when autocomplete reopens with selected value
    if (supplierValue && supplierValue.name === newValue) {
      setSupplierSearch('');
    } else {
      setSupplierSearch(newValue);
    }
  }, [supplierValue]);

  // Handle supplier autocomplete open - clear search and reload all options
  const handleSupplierOpen = useCallback(() => {
    setSupplierSearch('');
    setSupplierPage(1);
    loadSuppliers(1, true, '');
  }, [loadSuppliers]);

  const handleSupplierChange = useCallback((_: unknown, newValue: Supplier | null) => {
    const newSupplierId = newValue?.id || null;
    setSupplierId(newSupplierId);
    setFieldErrors((prev) => {
      if (prev.supplierId) {
        return { ...prev, supplierId: undefined };
      }
      return prev;
    });
  }, []);

  const handleSupplierScroll = useCallback((event: React.UIEvent<HTMLUListElement>) => {
    const listboxNode = event.currentTarget;
    if (
      listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 10 &&
      supplierHasMore &&
      !supplierLoading
    ) {
      const nextPage = supplierPage + 1;
      setSupplierPage(nextPage);
      loadSuppliers(nextPage, false, debouncedSupplierSearch);
    }
  }, [supplierHasMore, supplierLoading, supplierPage, debouncedSupplierSearch, loadSuppliers]);

  const handleExpectedDateChange = useCallback((newValue: Date | null) => {
    setExpectedDate(newValue);
  }, []);

  const handleProductInputChange = useCallback((index: number) => {
    return (_: unknown, newValue: string, reason: string) => {
      // Only update search when user is typing, not when selecting or clearing
      if (reason === 'input') {
        // If the input value matches the selected product's name, clear the search
        // This prevents searching when autocomplete reopens with selected value
        const item = items[index];
        if (item.productId !== null) {
          const selectedProduct = productsById.get(item.productId);
          if (selectedProduct && `${selectedProduct.name} (${selectedProduct.barcode || selectedProduct.code})` === newValue) {
            setProductSearch('');
            return;
          }
        }
        if (newValue !== productSearch) {
          setProductSearch(newValue);
        }
      } else if (reason === 'clear') {
        setProductSearch('');
      }
    };
  }, [productSearch, items, productsById]);

  const handleProductChange = useCallback((index: number) => {
    return (_: unknown, newValue: Product | null) => {
      handleItemChange(index, 'productId', newValue?.id || null);
      clearItemFieldError(index, 'productId');
    };
  }, [handleItemChange, clearItemFieldError]);

  const handleProductScroll = useCallback(() => {
    return (event: React.UIEvent<HTMLUListElement>) => {
      const listboxNode = event.currentTarget;
      if (
        listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 10 &&
        productHasMore &&
        !productLoading &&
        supplierId
      ) {
        const nextPage = productPage + 1;
        setProductPage(nextPage);
        loadProducts(nextPage, false, debouncedProductSearch, supplierId);
      }
    };
  }, [productHasMore, productLoading, supplierId, productPage, debouncedProductSearch, loadProducts]);

  const handleQuantityChange = useCallback((index: number) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0);
      clearItemFieldError(index, 'quantity');
    };
  }, [handleItemChange, clearItemFieldError]);

  const handleUnitPriceChange = useCallback((index: number) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0);
      clearItemFieldError(index, 'unitPrice');
    };
  }, [handleItemChange, clearItemFieldError]);

  const handleUnitPriceFocus = useCallback((index: number) => {
    return (e: React.FocusEvent<HTMLInputElement>) => {
      const item = items[index];
      if (item && item.unitPrice === 0) {
        e.target.select();
      }
    };
  }, [items]);

  // Handle barcode input change
  const handleBarcodeInputChange = useCallback((index: number) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setBarcodeInputs((prev) => ({ ...prev, [index]: e.target.value }));
    };
  }, []);

  // Handle barcode lookup and product selection
  const handleBarcodeLookup = useCallback(async (index: number, barcode: string) => {
    if (!barcode.trim() || !user?.id) return;

    setBarcodeLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const result = await ProductService.getProductByBarcode(barcode.trim(), user.id);
      if (result.success && result.product) {
        const product = result.product;
        
        // Check if product belongs to the selected supplier (if supplier is selected)
        if (supplierId && product.supplierId !== supplierId) {
          showToast(`Product "${product.name}" does not belong to the selected supplier`, 'warning');
          setBarcodeInputs((prev) => ({ ...prev, [index]: '' }));
          setBarcodeLoading((prev) => ({ ...prev, [index]: false }));
          return;
        }

        // Add product to products list if not already present
        setProducts((prev) => {
          const exists = prev.some((p) => p.id === product.id);
          if (!exists) {
            return [...prev, product];
          }
          return prev;
        });

        // Select the product
        handleItemChange(index, 'productId', product.id);
        clearItemFieldError(index, 'productId');
        
        // Clear barcode input
        setBarcodeInputs((prev) => ({ ...prev, [index]: '' }));
      } else {
        showToast(`Product not found for barcode: ${barcode.trim()}`, 'error');
        setBarcodeInputs((prev) => ({ ...prev, [index]: '' }));
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error looking up product by barcode', 'error');
      setBarcodeInputs((prev) => ({ ...prev, [index]: '' }));
    } finally {
      setBarcodeLoading((prev) => ({ ...prev, [index]: false }));
    }
  }, [user?.id, supplierId, handleItemChange, clearItemFieldError, showToast]);

  // Handle barcode input key press (Enter key)
  const handleBarcodeKeyPress = useCallback((index: number) => {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const barcode = barcodeInputs[index] || '';
        if (barcode.trim()) {
          handleBarcodeLookup(index, barcode);
        }
      }
    };
  }, [barcodeInputs, handleBarcodeLookup]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    backgroundColor: '#f5f5f5',
  }), []);

  const containerBoxSx = useMemo(() => ({
    p: 3,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const mainPaperSx = useMemo(() => ({
    padding: 0,
    width: '100%',
    border: '2px solid #c0c0c0',
    backgroundColor: '#ffffff',
    boxShadow: 'inset 1px 1px 0px 0px #ffffff, inset -1px -1px 0px 0px #808080',
  }), []);

  const titleBarBoxSx = useMemo(() => ({
    backgroundColor: '#1a237e',
    padding: '8px 12px',
    borderBottom: '1px solid #000051',
    display: 'flex',
    alignItems: 'center',
  }), []);

  const backIconButtonSx = useMemo(() => ({
    mr: 2,
    padding: '4px',
    color: '#ffffff',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#ffffff',
    fontWeight: 600,
  }), []);

  const paperSx = useMemo(() => ({
    p: 3,
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const sectionTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 600,
  }), []);

  const textFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '44px',
      '& input': {
        padding: '10px 14px',
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
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiFormHelperText-root': {
      fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const datePickerTextFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '44px',
      '& input': {
        padding: '10px 14px',
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
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const itemsHeaderBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 2,
  }), []);

  const addItemButtonSx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    borderColor: '#c0c0c0',
    color: '#1a237e',
    padding: '8px 20px',
    minHeight: '44px',
    '&:hover': {
      borderColor: '#1a237e',
      backgroundColor: '#f5f5f5',
    },
    '&:disabled': {
      borderColor: '#e0e0e0',
      color: '#9e9e9e',
    },
  }), []);

  const infoAlertSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #2196f3',
    borderLeft: '4px solid #2196f3',
    backgroundColor: '#e3f2fd',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    '& .MuiAlert-icon': {
      color: '#1976d2',
    },
    '& .MuiAlert-message': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const getErrorAlertSx = useCallback((hasError: boolean) => ({
    borderRadius: 0,
    border: hasError ? '1px solid #d32f2f' : '1px solid #2196f3',
    borderLeft: hasError ? '4px solid #d32f2f' : '4px solid #2196f3',
    backgroundColor: hasError ? '#ffebee' : '#e3f2fd',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    '& .MuiAlert-icon': {
      color: hasError ? '#c62828' : '#1976d2',
    },
    '& .MuiAlert-message': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const tableSx = useMemo(() => ({
    '& .MuiTableCell-root': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      borderColor: '#e0e0e0',
    },
    '& .MuiTableHead-root .MuiTableCell-root': {
      fontWeight: 600,
      backgroundColor: '#f5f5f5',
    },
    '& .MuiTableRow-root:hover': {
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const quantityTextFieldSx = useMemo(() => ({
    width: 100,
    ...textFieldSx,
  }), [textFieldSx]);

  const unitPriceTextFieldSx = useMemo(() => ({
    width: 120,
    ...textFieldSx,
  }), [textFieldSx]);

  const subtotalTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const deleteIconButtonSx = useMemo(() => ({
    color: '#d32f2f',
    '&:hover': {
      backgroundColor: '#ffebee',
    },
  }), []);

  const totalPaperSx = useMemo(() => ({
    p: 3,
    bgcolor: '#ffffff',
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
  }), []);

  const totalBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
  }), []);

  const totalLabelTypographySx = useMemo(() => ({
    mr: 3,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 600,
  }), []);

  const totalValueTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const actionsBoxSx = useMemo(() => ({
    display: 'flex',
    gap: 2,
    justifyContent: 'flex-end',
  }), []);

  const cancelButtonSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    borderColor: '#c0c0c0',
    color: '#1a237e',
    padding: '6px 16px',
    '&:hover': {
      borderColor: '#1a237e',
      backgroundColor: '#f5f5f5',
    },
    '&:disabled': {
      borderColor: '#e0e0e0',
      color: '#9e9e9e',
    },
  }), []);

  const submitButtonSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#1a237e',
    padding: '6px 16px',
    '&:hover': {
      backgroundColor: '#283593',
    },
    '&:disabled': {
      backgroundColor: '#e0e0e0',
      color: '#9e9e9e',
    },
  }), []);

  const listboxPropsSx = useMemo(() => ({
    style: { maxHeight: 300 },
  }), []);

  if (loadingOrder) {
    return (
      <MainLayout>
        <Box sx={loadingBoxSx}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Paper elevation={0} sx={mainPaperSx}>
          {/* Title Bar */}
          <Box sx={titleBarBoxSx}>
            <Tooltip title="Go Back - Return to the purchase orders list without saving changes.">
              <IconButton onClick={handleNavigateBack} sx={backIconButtonSx}>
                <ArrowBack sx={{ fontSize: '20px' }} />
              </IconButton>
            </Tooltip>
            <Typography variant="h4" fontWeight="bold" sx={titleTypographySx}>
              {isEditMode ? 'Edit Purchase Order' : 'New Purchase Order'}
            </Typography>
          </Box>

          <Box sx={{ p: '24px' }}>
            <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Supplier and Date Section */}
            <Grid item xs={12}>
              <Paper sx={paperSx}>
                <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                  Order Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Tooltip title="Supplier - Select the supplier for this purchase order. You can search for suppliers by typing. This is a required field. Products from this supplier will be available when adding items.">
                      <Autocomplete
                        options={suppliers}
                        getOptionLabel={(option) => option.name}
                        value={supplierValue}
                        loading={supplierLoading && (suppliers.length === 0 || supplierSearch !== '')}
                        onInputChange={handleSupplierInputChange}
                        onOpen={handleSupplierOpen}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Supplier *"
                            fullWidth
                            error={!!fieldErrors.supplierId}
                            helperText={fieldErrors.supplierId}
                            sx={textFieldSx}
                            InputLabelProps={{
                              ...params.InputLabelProps,
                              shrink: !!supplierValue,
                            }}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {supplierLoading && (suppliers.length === 0 || supplierSearch !== '') ? <CircularProgress color="inherit" size={20} /> : null}
                                  {params.InputProps.endAdornment}
                                </>
                              ),
                            }}
                          />
                        )}
                        onChange={handleSupplierChange}
                        ListboxProps={{
                          onScroll: handleSupplierScroll,
                          ...listboxPropsSx,
                        }}
                        noOptionsText="No suppliers found"
                      />
                    </Tooltip>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Tooltip title="Expected Delivery Date - Select the date when you expect to receive the goods from the supplier. This helps track order status and plan inventory.">
                      <DatePicker
                        label="Expected Delivery Date"
                        value={expectedDate}
                        onChange={handleExpectedDateChange}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            sx: datePickerTextFieldSx,
                          },
                        }}
                      />
                    </Tooltip>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* Items Section */}
            <Grid item xs={12}>
              <Paper sx={paperSx}>
                <Box sx={itemsHeaderBoxSx}>
                  <Typography variant="h6" sx={sectionTitleTypographySx}>
                    Order Items
                  </Typography>
                  <Tooltip title={!supplierId ? "Please select a supplier first - You must select a supplier before adding items to the purchase order" : "Add Item - Add a new product to this purchase order. Select the product, quantity, and unit price."}>
                    <span>
                      <Button
                        startIcon={<Add sx={{ fontSize: '18px' }} />}
                        onClick={handleAddItem}
                        variant="outlined"
                        size="small"
                        disabled={!supplierId}
                        sx={addItemButtonSx}
                      >
                        Add Item
                      </Button>
                    </span>
                  </Tooltip>
                </Box>

                {!supplierId ? (
                  <Alert severity="info" sx={infoAlertSx}>
                    Please select a supplier first to add items to this purchase order.
                  </Alert>
                ) : items.length === 0 ? (
                  <Alert severity={fieldErrors.items ? "error" : "info"} sx={getErrorAlertSx(!!fieldErrors.items)}>
                    {fieldErrors.items || "No items added. Click \"Add Item\" to add products."}
                  </Alert>
                ) : (
                  <TableContainer>
                    <Table size="small" sx={tableSx}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                          <TableCell align="right">Unit Price</TableCell>
                          <TableCell align="right">Subtotal</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((item, index) => {
                          const availableProducts = availableProductsByIndex[index] || [];
                          // Only show loading when actually loading AND:
                          // 1. No products loaded yet (initial load), OR
                          // 2. Searching and we have products but they're being filtered/searched
                          // Don't show loading if availableProducts is empty only due to filtering (not loading)
                          const shouldShowLoading = productLoading && (
                            products.length === 0 || 
                            (productSearch !== '' && products.length > 0)
                          );
                          
                          return (
                          <TableRow key={index}>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                <Tooltip title={`Product - Select a product to add to this purchase order. You can search by product name or barcode. Only products from the selected supplier are available.`}>
                                  <Autocomplete
                                    options={availableProducts}
                                    getOptionLabel={(option) => `${option.name} (${option.barcode || option.code})`}
                                    value={item.productId !== null ? (productsById.get(item.productId) || null) : null}
                                    loading={shouldShowLoading}
                                    onInputChange={handleProductInputChange(index)}
                                    onOpen={() => {
                                      setProductSearch('');
                                      setProductPage(1);
                                      if (supplierId) {
                                        loadProducts(1, true, '', supplierId);
                                      }
                                    }}
                                    sx={{ minWidth: 300, flex: 1 }}
                                    renderInput={(params) => (
                                      <TextField
                                        {...params}
                                        label="Product *"
                                        size="small"
                                        error={!!fieldErrors.itemErrors?.[index]?.productId}
                                        helperText={fieldErrors.itemErrors?.[index]?.productId}
                                        sx={textFieldSx}
                                        InputLabelProps={{
                                          ...params.InputLabelProps,
                                          shrink: item.productId !== null,
                                        }}
                                        InputProps={{
                                          ...params.InputProps,
                                          endAdornment: (
                                            <>
                                              {shouldShowLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                              {params.InputProps.endAdornment}
                                            </>
                                          ),
                                        }}
                                      />
                                    )}
                                    onChange={handleProductChange(index)}
                                    ListboxProps={{
                                      onScroll: handleProductScroll(),
                                      ...listboxPropsSx,
                                    }}
                                    noOptionsText="No products found"
                                  />
                                </Tooltip>
                                <Tooltip title="Barcode - Scan or type a product barcode to quickly find and add the product. Press Enter to search for the product by barcode.">
                                  <TextField
                                    label="Barcode"
                                    size="small"
                                    value={barcodeInputs[index] || ''}
                                    onChange={handleBarcodeInputChange(index)}
                                    onKeyPress={handleBarcodeKeyPress(index)}
                                    placeholder="Scan or type"
                                    disabled={!supplierId || barcodeLoading[index]}
                                    sx={{
                                      width: 150,
                                      ...textFieldSx,
                                    }}
                                    InputProps={{
                                      endAdornment: barcodeLoading[index] ? (
                                        <CircularProgress color="inherit" size={20} />
                                      ) : null,
                                    }}
                                    helperText="Press Enter to search"
                                  />
                                </Tooltip>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Tooltip title={`Quantity - Enter the quantity of ${item.productId ? productsById.get(item.productId)?.name || 'this product' : 'this product'} to order. Must be greater than 0.`}>
                                <TextField
                                  type="number"
                                  label="Quantity *"
                                  value={item.quantity}
                                  onChange={handleQuantityChange(index)}
                                  inputProps={{ min: 0.01, step: 0.01 }}
                                  size="small"
                                  error={!!fieldErrors.itemErrors?.[index]?.quantity}
                                  helperText={fieldErrors.itemErrors?.[index]?.quantity}
                                  sx={quantityTextFieldSx}
                                />
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Tooltip title={`Unit Price - Enter the price per unit for ${item.productId ? productsById.get(item.productId)?.name || 'this product' : 'this product'}. This is the price you're paying the supplier. Must be 0 or greater.`}>
                                <TextField
                                  type="number"
                                  label="Unit Price *"
                                  value={item.unitPrice}
                                  onChange={handleUnitPriceChange(index)}
                                  onFocus={handleUnitPriceFocus(index)}
                                  inputProps={{ min: 0, step: 0.01 }}
                                  size="small"
                                  error={!!fieldErrors.itemErrors?.[index]?.unitPrice}
                                helperText={fieldErrors.itemErrors?.[index]?.unitPrice}
                                sx={unitPriceTextFieldSx}
                              />
                              </Tooltip>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight="medium" sx={subtotalTypographySx}>
                                {formatCurrency(item.subtotal)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title={`Remove ${item.productName} - Remove this item from the purchase order.`}>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleRemoveItem(index)}
                                  sx={deleteIconButtonSx}
                                >
                                  <Delete fontSize="small" sx={{ fontSize: '18px' }} />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </Grid>

            {/* Total Section */}
            <Grid item xs={12}>
              <Paper sx={totalPaperSx}>
                <Box sx={totalBoxSx}>
                  <Typography variant="h6" sx={totalLabelTypographySx}>
                    Total:
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" sx={totalValueTypographySx}>
                    {formatCurrency(total)}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Actions */}
            <Grid item xs={12}>
              <Box sx={actionsBoxSx}>
                <Button
                  variant="outlined"
                  onClick={handleCancel}
                  disabled={loading}
                  sx={cancelButtonSx}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={submitButtonSx}
                >
                  {loading ? 'Saving...' : isEditMode ? 'Update Order' : 'Create Order'}
                </Button>
              </Box>
            </Grid>
          </Grid>
            </form>
          </Box>
        </Paper>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default PurchaseOrderForm;

