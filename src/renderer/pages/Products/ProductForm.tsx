import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Button,
  TextField,
  Box,
  Grid,
  MenuItem,
  Autocomplete,
  CircularProgress,
  Paper,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import { ArrowBack, Add } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { RootState } from '../../store';

// Memoized selector to prevent unnecessary re-renders
const selectUser = (state: RootState) => state.auth.user;
import { ProductService, Product, CreateProductInput, Category, Supplier } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { SupplierService } from '../../services/supplier.service';
import { InventoryService } from '../../services/inventory.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import { usePermission } from '../../hooks/usePermission';
import Toast from '../../components/common/Toast';
import { ROUTES } from '../../utils/constants';

// Throttle utility function
const throttle = <T extends (...args: unknown[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      func(...args);
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
      }, delay - timeSinceLastCall);
    }
  };
};

const ProductForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const user = useSelector(selectUser);
  const { toast, showToast, hideToast } = useToast();
  const canCreateCategory = usePermission('categories.create');
  const canCreateSupplier = usePermission('suppliers.create');

  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    barcode?: string;
    name?: string;
    price?: string;
    costPrice?: string;
  }>({});

  // Category pagination state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryHasMore, setCategoryHasMore] = useState(true);
  const [categorySearch, setCategorySearch] = useState('');

  // Supplier pagination state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierHasMore, setSupplierHasMore] = useState(true);
  const [supplierSearch, setSupplierSearch] = useState('');

  // Control autocomplete/select open state for programmatic opening
  const [categoryAutocompleteOpen, setCategoryAutocompleteOpen] = useState(false);
  const [supplierAutocompleteOpen, setSupplierAutocompleteOpen] = useState(false);
  const [unitSelectOpen, setUnitSelectOpen] = useState(false);
  const [currencySelectOpen, setCurrencySelectOpen] = useState(false);

  // Abort controllers for request cancellation
  const categoryAbortControllerRef = useRef<AbortController | null>(null);
  const supplierAbortControllerRef = useRef<AbortController | null>(null);
  const productAbortControllerRef = useRef<AbortController | null>(null);

  // Track if initial load has been done to prevent double loading
  const initialLoadDoneRef = useRef<string | number | null>(null);

  // Scroll throttling refs
  const categoryScrollThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const supplierScrollThrottleRef = useRef<NodeJS.Timeout | null>(null);

  // Track if autocomplete/select dropdowns are open
  const categoryAutocompleteOpenRef = useRef(false);
  const supplierAutocompleteOpenRef = useRef(false);
  const unitSelectOpenRef = useRef(false);
  const currencySelectOpenRef = useRef(false);

  // Flags to track if we should move to next field after selection
  const shouldMoveAfterCategorySelectRef = useRef(false);
  const shouldMoveAfterSupplierSelectRef = useRef(false);
  const shouldMoveAfterUnitSelectRef = useRef(false);
  const shouldMoveAfterCurrencySelectRef = useRef(false);
  
  // Flags to track if select was opened by user (to move focus even if same value selected)
  const unitSelectWasOpenedRef = useRef(false);
  const currencySelectWasOpenedRef = useRef(false);

  // Track if optional autocompletes have been "visited" (opened at least once)
  // Once visited, Enter when closed will move forward instead of opening again
  const categoryVisitedRef = useRef(false);
  const supplierVisitedRef = useRef(false);

  const [formData, setFormData] = useState<CreateProductInput>({
    barcode: '',
    name: '',
    description: '',
    categoryId: null,
    unit: 'pcs',
    price: 0,
    costPrice: null,
    currency: 'USD',
    supplierId: null,
  });

  // Inventory fields (only for new products)
  const [initialQuantity, setInitialQuantity] = useState<string>('0');
  const [reorderLevel, setReorderLevel] = useState<string>('0');

  // Initial form data for change detection
  const [initialFormData, setInitialFormData] = useState<CreateProductInput>({
    barcode: '',
    name: '',
    description: '',
    categoryId: null,
    unit: 'pcs',
    price: 0,
    costPrice: null,
    currency: 'USD',
    supplierId: null,
  });

  // Load product if editing
  useEffect(() => {
    // Cancel previous request
    if (productAbortControllerRef.current) {
      productAbortControllerRef.current.abort();
    }

    // If we have an id but user is not yet loaded, wait (don't reset form)
    if (id && !user?.id) {
      return;
    }

    if (id && user?.id) {
      const productId = parseInt(id);
      
      // If product is already loaded for this id and formData is populated, skip reload
      if (product?.id === productId && formData.name) {
        return;
      }

      // If product exists but formData is empty, populate it
      if (product?.id === productId && !formData.name && product.name) {
        const validCurrency = product.currency === 'LBP' ? 'LBP' : 'USD';
        const loadedFormData = {
          barcode: product.barcode || '',
          name: product.name,
          description: product.description || '',
          categoryId: product.categoryId,
          unit: product.unit,
          price: product.price,
          costPrice: product.costPrice,
          currency: validCurrency,
          supplierId: product.supplierId,
        };
        setFormData(loadedFormData);
        setInitialFormData(loadedFormData);
        return;
      }

      setIsEditMode(true);
      setLoadingProduct(true);

      // Create new abort controller
      const abortController = new AbortController();
      productAbortControllerRef.current = abortController;

      ProductService.getProductById(parseInt(id), user.id)
        .then((result) => {
          // Check if request was aborted
          if (abortController.signal.aborted) return;

          if (result.success && result.product) {
            const prod = result.product;
            setProduct(prod);
            // Ensure currency is either USD or LBP (convert EUR/GBP to USD)
            const validCurrency = prod.currency === 'LBP' ? 'LBP' : 'USD';
            const loadedFormData = {
              barcode: prod.barcode || '',
              name: prod.name,
              description: prod.description || '',
              categoryId: prod.categoryId,
              unit: prod.unit,
              price: prod.price,
              costPrice: prod.costPrice,
              currency: validCurrency,
              supplierId: prod.supplierId,
            };
            setFormData(loadedFormData);
            setInitialFormData(loadedFormData);

            // If editing and has a category, ensure the category is loaded
            if (prod.categoryId && prod.category) {
              setCategories((prev) => {
                const exists = prev.some((cat) => cat.id === prod.categoryId);
                if (!exists && prod.category) {
                  return [prod.category, ...prev];
                }
                return prev;
              });
            }

            // If editing and has a supplier, ensure the supplier is loaded
            if (prod.supplierId && prod.supplier) {
              setSuppliers((prev) => {
                const exists = prev.some((sup) => sup.id === prod.supplierId);
                if (!exists && prod.supplier) {
                  return [prod.supplier, ...prev];
                }
                return prev;
              });
            }
          } else {
            showToast(result.error || 'Failed to load product', 'error');
          }
        })
        .catch((err) => {
          // Ignore abort errors
          if (err instanceof Error && err.name === 'AbortError') return;
          showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setLoadingProduct(false);
          }
        });
    } else if (!id) {
      // Only reset form if we're not in edit mode (no id)
      setIsEditMode(false);
      setProduct(null);
      setFormData({
        barcode: '',
        name: '',
        description: '',
        categoryId: null,
        unit: 'pcs',
        price: 0,
        costPrice: null,
        currency: 'USD',
        supplierId: null,
      });
      setInitialQuantity('0');
      setReorderLevel('0');
    }

    return () => {
      if (productAbortControllerRef.current) {
        productAbortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id, showToast, product?.id]);


  // Debounced search states
  const [debouncedCategorySearch, setDebouncedCategorySearch] = useState('');
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('');
  const categorySearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supplierSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadCategories = useCallback(async (page: number, reset: boolean = false, search: string = '') => {
    if (!user?.id) return;

    // Cancel previous request
    if (categoryAbortControllerRef.current) {
      categoryAbortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    categoryAbortControllerRef.current = abortController;

    setCategoryLoading(true);
    try {
      const result = await CategoryService.getCategoriesList(
        { page, pageSize: 50, search },
        user.id
      );

      // Check if request was aborted
      if (abortController.signal.aborted) return;

      if (result.success && result.categories) {
        if (reset) {
          setCategories(result.categories);
        } else {
          setCategories((prev) => [...prev, ...result.categories!]);
        }
        setCategoryHasMore(result.pagination?.hasNextPage ?? false);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Failed to load categories:', err);
    } finally {
      if (!abortController.signal.aborted) {
        setCategoryLoading(false);
      }
    }
  }, [user?.id]);

  const loadSuppliers = useCallback(async (page: number, reset: boolean = false, search: string = '') => {
    if (!user?.id) return;

    // Cancel previous request
    if (supplierAbortControllerRef.current) {
      supplierAbortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    supplierAbortControllerRef.current = abortController;

    setSupplierLoading(true);
    try {
      const result = await SupplierService.getSuppliers(
        { page, pageSize: 50, search },
        user.id
      );

      // Check if request was aborted
      if (abortController.signal.aborted) return;

      if (result.success && result.suppliers) {
        if (reset) {
          setSuppliers(result.suppliers);
        } else {
          setSuppliers((prev) => [...prev, ...result.suppliers!]);
        }
        setSupplierHasMore(result.pagination?.hasNextPage ?? false);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Failed to load suppliers:', err);
    } finally {
      if (!abortController.signal.aborted) {
        setSupplierLoading(false);
      }
    }
  }, [user?.id]);

  // Debounce category search
  useEffect(() => {
    if (categorySearchTimeoutRef.current) {
      clearTimeout(categorySearchTimeoutRef.current);
    }
    categorySearchTimeoutRef.current = setTimeout(() => {
      setDebouncedCategorySearch(categorySearch);
    }, 300);

    return () => {
      if (categorySearchTimeoutRef.current) {
        clearTimeout(categorySearchTimeoutRef.current);
      }
    };
  }, [categorySearch]);

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

  // Store stable function references
  const loadCategoriesRef = useRef(loadCategories);
  const loadSuppliersRef = useRef(loadSuppliers);

  useEffect(() => {
    loadCategoriesRef.current = loadCategories;
  }, [loadCategories]);

  useEffect(() => {
    loadSuppliersRef.current = loadSuppliers;
  }, [loadSuppliers]);

  // Load initial categories and suppliers (only once per user)
  useEffect(() => {
    if (user?.id && initialLoadDoneRef.current !== user.id) {
      initialLoadDoneRef.current = user.id;
      setCategoryPage(1);
      setSupplierPage(1);
      loadCategoriesRef.current(1, true, '');
      loadSuppliersRef.current(1, true, '');
    }
  }, [user?.id]);

  // Reset and reload when debounced search changes
  useEffect(() => {
    if (user?.id && debouncedCategorySearch !== undefined) {
      setCategoryPage(1);
      loadCategoriesRef.current(1, true, debouncedCategorySearch);
    }
  }, [debouncedCategorySearch, user?.id]);

  useEffect(() => {
    if (user?.id && debouncedSupplierSearch !== undefined) {
      setSupplierPage(1);
      loadSuppliersRef.current(1, true, debouncedSupplierSearch);
    }
  }, [debouncedSupplierSearch, user?.id]);

  // Throttled scroll handlers for category and supplier autocomplete
  const handleCategoryScroll = useMemo(
    () =>
      throttle((event: unknown) => {
        const uiEvent = event as React.UIEvent<HTMLUListElement>;
        const listboxNode = uiEvent.currentTarget;
        if (
          listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 10 &&
          categoryHasMore &&
          !categoryLoading
        ) {
          const nextPage = categoryPage + 1;
          setCategoryPage(nextPage);
          loadCategoriesRef.current(nextPage, false, debouncedCategorySearch);
        }
      }, 200),
    [categoryHasMore, categoryLoading, categoryPage, debouncedCategorySearch]
  );

  const handleSupplierScroll = useMemo(
    () =>
      throttle((event: unknown) => {
        const uiEvent = event as React.UIEvent<HTMLUListElement>;
        const listboxNode = uiEvent.currentTarget;
        if (
          listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 10 &&
          supplierHasMore &&
          !supplierLoading
        ) {
          const nextPage = supplierPage + 1;
          setSupplierPage(nextPage);
          loadSuppliersRef.current(nextPage, false, debouncedSupplierSearch);
        }
      }, 200),
    [supplierHasMore, supplierLoading, supplierPage, debouncedSupplierSearch]
  );

  // Memoized event handlers to prevent unnecessary re-renders
  const handleCategoryChange = useCallback((_: unknown, newValue: Category | null) => {
    setFormData((prev) => ({ ...prev, categoryId: newValue ? newValue.id : null }));
    // Set flag to move to next field after dropdown closes
    if (newValue !== null) {
      shouldMoveAfterCategorySelectRef.current = true;
    }
  }, []);

  const handleSupplierChange = useCallback((_: unknown, newValue: Supplier | null) => {
    setFormData((prev) => ({ ...prev, supplierId: newValue ? newValue.id : null }));
    // Set flag to move to next field after dropdown closes
    if (newValue !== null) {
      shouldMoveAfterSupplierSelectRef.current = true;
    }
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, description: e.target.value || null }));
  }, []);

  const handleUnitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const oldValue = formData.unit;
    setFormData((prev) => ({ ...prev, unit: newValue }));
    // Set flag to move to next field after dropdown closes
    shouldMoveAfterUnitSelectRef.current = true;
    // If same value selected, manually close and move forward immediately
    if (newValue === oldValue && unitSelectWasOpenedRef.current) {
      unitSelectWasOpenedRef.current = false;
      setUnitSelectOpen(false);
      // Use a slightly longer timeout to ensure select closes
      setTimeout(() => {
        const priceInput = document.getElementById('product-price');
        priceInput?.focus();
      }, 100);
    }
  }, [formData.unit]);

  const handleCurrencyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const oldValue = formData.currency;
    setFormData((prev) => ({ ...prev, currency: newValue }));
    // Set flag to move to next field after dropdown closes
    shouldMoveAfterCurrencySelectRef.current = true;
    // If same value selected, manually close and move to next field
    if (newValue === oldValue && currencySelectWasOpenedRef.current) {
      currencySelectWasOpenedRef.current = false;
      setCurrencySelectOpen(false);
      // Use a slightly longer timeout to ensure select closes
      setTimeout(() => {
        if (!isEditMode) {
          // When creating new product, move to initial quantity
          const initialQuantityInput = document.getElementById('product-initial-quantity');
          initialQuantityInput?.focus();
        } else {
          // When editing, submit the form
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }
      }, 100);
    }
  }, [formData.currency, isEditMode]);

  const handlePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setFormData((prev) => ({ ...prev, price: value }));
    setFieldErrors((prev) => {
      if (prev.price) {
        return { ...prev, price: undefined };
      }
      return prev;
    });
  }, []);

  const handlePriceFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (formData.price === 0) {
      e.target.select();
    }
  }, [formData.price]);

  const handleCostPriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(e.target.value) : null;
    setFormData((prev) => ({ ...prev, costPrice: value }));
    setFieldErrors((prev) => {
      if (prev.costPrice) {
        return { ...prev, costPrice: undefined };
      }
      return prev;
    });
  }, []);

  const handleBarcodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, barcode: value || null }));
    setFieldErrors((prev) => {
      if (prev.barcode) {
        return { ...prev, barcode: undefined };
      }
      return prev;
    });
  }, []);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, name: value }));
    setFieldErrors((prev) => {
      if (prev.name) {
        return { ...prev, name: undefined };
      }
      return prev;
    });
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: {
      barcode?: string;
      name?: string;
      price?: string;
      costPrice?: string;
    } = {};

    // Validate barcode
    if (!formData.barcode || formData.barcode.trim() === '') {
      errors.barcode = 'Barcode is required';
    }

    // Validate product name
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Product name is required';
    }

    // Validate price
    if (formData.price === undefined || formData.price === null || formData.price <= 0) {
      errors.price = 'Price is required and must be greater than 0';
    }

    // Validate cost price
    if (formData.costPrice === undefined || formData.costPrice === null || formData.costPrice <= 0) {
      errors.costPrice = 'Cost price is required and must be greater than 0';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

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
      if (isEditMode && product) {
        // Check if values have changed
        if (
          formData.barcode === initialFormData.barcode &&
          formData.name === initialFormData.name &&
          formData.description === initialFormData.description &&
          formData.categoryId === initialFormData.categoryId &&
          formData.unit === initialFormData.unit &&
          formData.price === initialFormData.price &&
          formData.costPrice === initialFormData.costPrice &&
          formData.currency === initialFormData.currency &&
          formData.supplierId === initialFormData.supplierId
        ) {
          showToast('No changes made', 'info');
          return;
        }

        // Update
        const result = await ProductService.updateProduct(product.id, formData, user.id);
        if (result.success) {
          setInitialFormData(formData);
          showToast('Product updated successfully', 'success');
          navigate('/products');
        } else {
          showToast(result.error || 'Failed to update product', 'error');
        }
      } else {
        // Create
        const result = await ProductService.createProduct(formData, user.id);
        if (result.success && result.product) {
          // Initialize inventory for the new product
          const initialQty = parseFloat(initialQuantity) || 0;
          const reorder = parseFloat(reorderLevel) || 0;
          
          const inventoryResult = await InventoryService.initializeInventory(
            result.product.id,
            initialQty,
            reorder,
            user.id
          );

          if (inventoryResult.success) {
            showToast('Product created and inventory initialized successfully', 'success');
          } else {
            // Product was created but inventory initialization failed
            showToast('Product created, but failed to initialize inventory. You can add inventory manually.', 'warning');
          }
          navigate('/products');
        } else {
          showToast(result.error || 'Failed to create product', 'error');
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.id, isEditMode, product, formData, initialFormData, initialQuantity, reorderLevel, navigate, validateForm, showToast]);

  const handleCancel = useCallback(() => {
    navigate('/products');
  }, [navigate]);

  // Create Maps for O(1) lookups instead of O(n) find operations
  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>();
    categories.forEach((cat) => {
      map.set(cat.id, cat);
    });
    return map;
  }, [categories]);

  const supplierMap = useMemo(() => {
    const map = new Map<number, Supplier>();
    suppliers.forEach((sup) => {
      map.set(sup.id, sup);
    });
    return map;
  }, [suppliers]);

  // Memoize category and supplier values to prevent unnecessary re-renders (O(1) lookup)
  const categoryValue = useMemo(() => {
    if (!formData.categoryId) return null;
    return categoryMap.get(formData.categoryId) || null;
  }, [categoryMap, formData.categoryId]);

  const supplierValue = useMemo(() => {
    if (!formData.supplierId) return null;
    return supplierMap.get(formData.supplierId) || null;
  }, [supplierMap, formData.supplierId]);

  // Handle category input change - ignore if it matches selected value's name
  const handleCategoryInputChange = useCallback((_: unknown, newInputValue: string) => {
    // If the input value matches the selected category's name, clear the search
    // This prevents searching when autocomplete reopens with selected value
    if (categoryValue && categoryValue.name === newInputValue) {
      setCategorySearch('');
    } else {
      setCategorySearch(newInputValue);
    }
  }, [categoryValue]);

  // Handle supplier input change - ignore if it matches selected value's name
  const handleSupplierInputChange = useCallback((_: unknown, newInputValue: string) => {
    // If the input value matches the selected supplier's name, clear the search
    // This prevents searching when autocomplete reopens with selected value
    if (supplierValue && supplierValue.name === newInputValue) {
      setSupplierSearch('');
    } else {
      setSupplierSearch(newInputValue);
    }
  }, [supplierValue]);

  // Handle category autocomplete open - clear search and reload all options
  const handleCategoryOpen = useCallback(() => {
    categoryAutocompleteOpenRef.current = true;
    setCategoryAutocompleteOpen(true);
    categoryVisitedRef.current = true;
    setCategorySearch('');
    setCategoryPage(1);
    loadCategoriesRef.current(1, true, '');
  }, []);

  const handleCategoryClose = useCallback((_?: React.SyntheticEvent, reason?: string) => {
    categoryAutocompleteOpenRef.current = false;
    setCategoryAutocompleteOpen(false);
    // Move to next field if a selection was made (reason will be 'selectOption' when an option is selected)
    if (shouldMoveAfterCategorySelectRef.current || reason === 'selectOption') {
      shouldMoveAfterCategorySelectRef.current = false;
      // Use setTimeout to ensure the dropdown is fully closed before moving focus
      setTimeout(() => {
        const supplierInput = document.getElementById('product-supplier');
        supplierInput?.focus();
      }, 0);
    }
  }, []);

  // Handle supplier autocomplete open - clear search and reload all options
  const handleSupplierOpen = useCallback(() => {
    supplierAutocompleteOpenRef.current = true;
    setSupplierAutocompleteOpen(true);
    supplierVisitedRef.current = true;
    setSupplierSearch('');
    setSupplierPage(1);
    loadSuppliersRef.current(1, true, '');
  }, []);

  const handleSupplierClose = useCallback((_?: React.SyntheticEvent, reason?: string) => {
    supplierAutocompleteOpenRef.current = false;
    setSupplierAutocompleteOpen(false);
    // Move to next field if a selection was made (reason will be 'selectOption' when an option is selected)
    if (shouldMoveAfterSupplierSelectRef.current || reason === 'selectOption') {
      shouldMoveAfterSupplierSelectRef.current = false;
      // Use setTimeout to ensure the dropdown is fully closed before moving focus
      setTimeout(() => {
        const unitInput = document.getElementById('product-unit');
        unitInput?.focus();
      }, 0);
    }
  }, []);

  // Memoize loading conditions
  const categoryLoadingCondition = useMemo(() => {
    return categoryLoading && (categories.length === 0 || categorySearch !== '');
  }, [categoryLoading, categories.length, categorySearch]);

  const supplierLoadingCondition = useMemo(() => {
    return supplierLoading && (suppliers.length === 0 || supplierSearch !== '');
  }, [supplierLoading, suppliers.length, supplierSearch]);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    const categoryScrollThrottle = categoryScrollThrottleRef.current;
    const supplierScrollThrottle = supplierScrollThrottleRef.current;
    return () => {
      if (categoryAbortControllerRef.current) {
        categoryAbortControllerRef.current.abort();
      }
      if (supplierAbortControllerRef.current) {
        supplierAbortControllerRef.current.abort();
      }
      if (productAbortControllerRef.current) {
        productAbortControllerRef.current.abort();
      }
      if (categoryScrollThrottle) {
        clearTimeout(categoryScrollThrottle);
      }
      if (supplierScrollThrottle) {
        clearTimeout(supplierScrollThrottle);
      }
    };
  }, []);

  const handleNavigateBack = useCallback(() => {
    navigate('/products');
  }, [navigate]);

  const handleCreateCategory = useCallback(() => {
    // Navigate to create category form with return path
    const returnPath = id ? `/products/edit/${id}` : '/products/new';
    navigate(ROUTES.CATEGORIES_NEW, { state: { returnPath } });
  }, [navigate, id]);

  const handleCreateSupplier = useCallback(() => {
    // Navigate to create supplier form with return path
    const returnPath = id ? `/products/edit/${id}` : '/products/new';
    navigate(ROUTES.SUPPLIERS_NEW, { state: { returnPath } });
  }, [navigate, id]);

  // Keyboard navigation handlers
  const handleProductNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const barcodeInput = document.getElementById('product-barcode');
      barcodeInput?.focus();
    }
  }, []);

  const handleBarcodeKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const descriptionInput = document.getElementById('product-description');
      descriptionInput?.focus();
    }
  }, []);

  const handleDescriptionKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // For multiline, Shift+Enter creates new line, Enter moves to next field
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const categoryInput = document.getElementById('product-category');
      categoryInput?.focus();
    }
  }, []);

  const handleCategoryKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // If dropdown is open, close it and move forward
      if (categoryAutocompleteOpenRef.current) {
        e.preventDefault();
        categoryVisitedRef.current = true;
        setCategoryAutocompleteOpen(false);
        setTimeout(() => {
          const supplierInput = document.getElementById('product-supplier');
          supplierInput?.focus();
        }, 0);
      } else if (categoryVisitedRef.current) {
        // If dropdown is closed and was previously visited, move forward
        e.preventDefault();
        const supplierInput = document.getElementById('product-supplier');
        supplierInput?.focus();
      } else {
        // If dropdown is closed and not visited yet, open it
        e.preventDefault();
        categoryVisitedRef.current = true;
        setCategoryAutocompleteOpen(true);
      }
    }
  }, []);

  const handleSupplierKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // If dropdown is open, close it and move forward
      if (supplierAutocompleteOpenRef.current) {
        e.preventDefault();
        supplierVisitedRef.current = true;
        setSupplierAutocompleteOpen(false);
        setTimeout(() => {
          const unitInput = document.getElementById('product-unit');
          unitInput?.focus();
        }, 0);
      } else if (supplierVisitedRef.current) {
        // If dropdown is closed and was previously visited, move forward
        e.preventDefault();
        const unitInput = document.getElementById('product-unit');
        unitInput?.focus();
      } else {
        // If dropdown is closed and not visited yet, open it
        e.preventDefault();
        supplierVisitedRef.current = true;
        setSupplierAutocompleteOpen(true);
      }
    }
  }, []);

  const handleUnitKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // If dropdown is closed, open it
      if (!unitSelectOpenRef.current) {
        e.preventDefault();
        setUnitSelectOpen(true);
      }
      // If dropdown is open, let MUI handle the selection (default behavior)
    }
  }, []);

  const handlePriceKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const costPriceInput = document.getElementById('product-cost-price');
      costPriceInput?.focus();
    }
  }, []);

  const handleCostPriceKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const currencyInput = document.getElementById('product-currency');
      currencyInput?.focus();
    }
  }, []);

  const handleInitialQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const num = parseFloat(value);
    if (value === '' || (!isNaN(num) && num >= 0)) {
      setInitialQuantity(value);
    }
  }, []);

  const handleInitialQuantityFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (initialQuantity === '0') {
      e.target.select();
    }
  }, [initialQuantity]);

  const handleReorderLevelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const num = parseFloat(value);
    if (value === '' || (!isNaN(num) && num >= 0)) {
      setReorderLevel(value);
    }
  }, []);

  const handleReorderLevelFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (reorderLevel === '0') {
      e.target.select();
    }
  }, [reorderLevel]);

  const handleInitialQuantityKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const reorderLevelInput = document.getElementById('product-reorder-level');
      reorderLevelInput?.focus();
    }
  }, []);

  const handleReorderLevelKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Submit the form directly
      const form = document.querySelector('form');
      if (form) {
        form.requestSubmit();
      }
    }
  }, []);

  const handleCurrencyKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // If dropdown is closed, open it
      if (!currencySelectOpenRef.current) {
        e.preventDefault();
        setCurrencySelectOpen(true);
      }
      // If dropdown is open, let MUI handle the selection (default behavior)
    }
  }, []);

  // Handlers to track select open state
  const handleUnitSelectOpen = useCallback(() => {
    unitSelectOpenRef.current = true;
    setUnitSelectOpen(true);
    // Mark that select was opened by user
    unitSelectWasOpenedRef.current = true;
  }, []);

  const handleUnitMenuItemClick = useCallback((event?: React.MouseEvent) => {
    // Handle click on menu item - always close select and move forward
    // This ensures it works even when same value is selected
    if (event) {
      // Prevent default to ensure we handle the close
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (unitSelectWasOpenedRef.current || unitSelectOpenRef.current) {
      unitSelectWasOpenedRef.current = false;
      unitSelectOpenRef.current = false;
      setUnitSelectOpen(false);
      // Always move forward after clicking a menu item
      setTimeout(() => {
        const priceInput = document.getElementById('product-price');
        priceInput?.focus();
      }, 150);
    }
  }, []);

  const handleUnitSelectClose = useCallback(() => {
    const wasOpened = unitSelectWasOpenedRef.current;
    unitSelectOpenRef.current = false;
    setUnitSelectOpen(false);
    unitSelectWasOpenedRef.current = false;
    shouldMoveAfterUnitSelectRef.current = false;
    
    // Always move to next field if select was opened by user
    if (wasOpened) {
      // Use setTimeout to ensure the dropdown is fully closed before moving focus
      setTimeout(() => {
        const priceInput = document.getElementById('product-price');
        priceInput?.focus();
      }, 0);
    }
  }, []);

  const handleCurrencySelectOpen = useCallback(() => {
    currencySelectOpenRef.current = true;
    setCurrencySelectOpen(true);
    // Mark that select was opened by user
    currencySelectWasOpenedRef.current = true;
  }, []);

  const handleCurrencyMenuItemClick = useCallback((event?: React.MouseEvent) => {
    // Handle click on menu item - close select and move to next field or submit
    // This ensures it works even when same value is selected
    if (event) {
      // Prevent default to ensure we handle the close
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (currencySelectWasOpenedRef.current || currencySelectOpenRef.current) {
      currencySelectWasOpenedRef.current = false;
      currencySelectOpenRef.current = false;
      setCurrencySelectOpen(false);
      // If creating new product, move to initial quantity; otherwise submit
      setTimeout(() => {
        if (!isEditMode) {
          const initialQuantityInput = document.getElementById('product-initial-quantity');
          initialQuantityInput?.focus();
        } else {
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }
      }, 150);
    }
  }, [isEditMode]);

  const handleCurrencySelectClose = useCallback(() => {
    const wasOpened = currencySelectWasOpenedRef.current;
    currencySelectOpenRef.current = false;
    setCurrencySelectOpen(false);
    currencySelectWasOpenedRef.current = false;
    shouldMoveAfterCurrencySelectRef.current = false;
    
    // Move to next field or submit based on mode
    if (wasOpened) {
      // Use setTimeout to ensure the dropdown is fully closed before moving focus
      setTimeout(() => {
        if (!isEditMode) {
          // When creating new product, move to initial quantity
          const initialQuantityInput = document.getElementById('product-initial-quantity');
          initialQuantityInput?.focus();
        } else {
          // When editing, submit the form
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }
      }, 0);
    }
  }, [isEditMode]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  }), []);

  const containerBoxSx = useMemo(() => ({
    p: 3,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const paperSx = useMemo(() => ({
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

  const sectionTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    mb: 2,
  }), []);

  const textFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '16px',
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
      fontSize: '12px',
    },
  }), []);

  const textFieldMultilineSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '16px',
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

  const autocompleteTextFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '16px',
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

  const selectTextFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '16px',
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
    '& .MuiSelect-select': {
      fontSize: '16px',
      minHeight: '44px',
      '& input': {
        padding: '10px 14px',
      },
    },
  }), []);

  const menuItemSx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    minHeight: '44px',
    padding: '10px 16px',
  }), []);

  const buttonsBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 2,
    mt: 3,
  }), []);

  const cancelButtonSx = useMemo(() => ({
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

  const submitButtonSx = useMemo(() => ({
    backgroundColor: '#1a237e',
    color: '#ffffff',
    borderRadius: 0,
    padding: '8px 20px',
    minHeight: '44px',
    fontSize: '16px',
    fontWeight: 500,
    textTransform: 'none',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    border: '1px solid #000051',
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: '#534bae',
      boxShadow: 'none',
    },
    '&:active': {
      backgroundColor: '#000051',
    },
    '&:disabled': {
      backgroundColor: '#e0e0e0',
      color: '#9e9e9e',
      border: '1px solid #c0c0c0',
    },
  }), []);

  const listboxPropsSx = useMemo(() => ({
    maxHeight: 300,
  }), []);

  if (loadingProduct) {
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
        <Paper elevation={0} sx={paperSx}>
          {/* Title Bar */}
          <Box sx={titleBarBoxSx}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip title="Go Back - Return to the products list without saving changes.">
                <IconButton onClick={handleNavigateBack} sx={backIconButtonSx}>
                  <ArrowBack sx={{ fontSize: '20px' }} />
                </IconButton>
              </Tooltip>
              <Typography variant="h4" fontWeight="bold" sx={titleTypographySx}>
              DigitalizePOS - {isEditMode ? 'Edit Product' : 'New Product'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ p: '24px' }}>

            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                    Product Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Tooltip title="Product Name - Enter the name of the product as it should appear in the system, receipts, and reports. This is a required field.">
                        <TextField
                          fullWidth
                          id="product-name"
                          label="Product Name *"
                          value={formData.name}
                          onChange={handleNameChange}
                          onKeyDown={handleProductNameKeyDown}
                          error={!!fieldErrors.name}
                          helperText={fieldErrors.name}
                          disabled={loading}
                          tabIndex={1}
                          autoFocus
                          sx={textFieldSx}
                        />
                      </Tooltip>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Tooltip title="Barcode - Enter a unique barcode (EAN, UPC, or custom) for this product. This barcode can be scanned at the POS to quickly add the product to a transaction. This is a required field.">
                        <TextField
                          fullWidth
                          id="product-barcode"
                          label="Barcode *"
                          value={formData.barcode}
                          onChange={handleBarcodeChange}
                          onKeyDown={handleBarcodeKeyDown}
                          error={!!fieldErrors.barcode}
                          helperText={fieldErrors.barcode}
                          disabled={loading}
                          tabIndex={2}
                          sx={textFieldSx}
                        />
                      </Tooltip>
                    </Grid>
                    <Grid item xs={12}>
                      <Tooltip title="Description - Enter a detailed description of the product. This is optional but helpful for inventory management and product identification.">
                        <TextField
                          fullWidth
                          id="product-description"
                          label="Description"
                          value={formData.description}
                          onChange={handleDescriptionChange}
                          onKeyDown={handleDescriptionKeyDown}
                          multiline
                          rows={3}
                          disabled={loading}
                          tabIndex={3}
                          sx={textFieldMultilineSx}
                        />
                      </Tooltip>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                          <Tooltip title="Category - Select the product category to organize this product. You can search for categories by typing. Categories help organize products and can be used for filtering and reporting.">
                            <Autocomplete
                              id="product-category"
                              options={categories}
                              value={categoryValue}
                              onChange={handleCategoryChange}
                              onInputChange={handleCategoryInputChange}
                              open={categoryAutocompleteOpen}
                              onOpen={handleCategoryOpen}
                              onClose={handleCategoryClose}
                              getOptionLabel={(option) => option.name || ''}
                              isOptionEqualToValue={(option, value) => option.id === value.id}
                              loading={categoryLoadingCondition}
                              disabled={loading}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="Category (optional)"
                                  placeholder="Select a category..."
                                  disabled={loading}
                                  onKeyDown={handleCategoryKeyDown}
                                  tabIndex={4}
                                  InputLabelProps={{
                                    ...params.InputLabelProps,
                                    shrink: !!categoryValue,
                                  }}
                                  InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                      <>
                                        {categoryLoadingCondition ? <CircularProgress color="inherit" size={20} /> : null}
                                        {params.InputProps.endAdornment}
                                      </>
                                    ),
                                  }}
                                  sx={autocompleteTextFieldSx}
                                />
                              )}
                              ListboxProps={{
                                onScroll: handleCategoryScroll,
                                style: listboxPropsSx,
                              }}
                              noOptionsText="No categories found"
                            />
                          </Tooltip>
                        </Box>
                        {canCreateCategory && (
                          <Tooltip title="Create Category - Quickly create a new category without leaving the product form.">
                            <IconButton
                              onClick={handleCreateCategory}
                              disabled={loading}
                              sx={{
                                mt: 1,
                                padding: '8px',
                                color: '#1a237e',
                                border: '1px solid #c0c0c0',
                                borderRadius: 0,
                                backgroundColor: '#ffffff',
                                '&:hover': {
                                  backgroundColor: '#f5f5f5',
                                  borderColor: '#1a237e',
                                },
                                '&:disabled': {
                                  borderColor: '#e0e0e0',
                                  color: '#9e9e9e',
                                },
                              }}
                            >
                              <Add sx={{ fontSize: '18px' }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                          <Tooltip title="Supplier - Select the supplier who provides this product. You can search for suppliers by typing. Supplier information is used for purchase orders and inventory management.">
                            <Autocomplete
                              id="product-supplier"
                              options={suppliers}
                              value={supplierValue}
                              onChange={handleSupplierChange}
                              onInputChange={handleSupplierInputChange}
                              open={supplierAutocompleteOpen}
                              onOpen={handleSupplierOpen}
                              onClose={handleSupplierClose}
                              getOptionLabel={(option) => option.name || ''}
                              isOptionEqualToValue={(option, value) => option.id === value.id}
                              loading={supplierLoadingCondition}
                              disabled={loading}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="Supplier (optional)"
                                  placeholder="Select a supplier..."
                                  disabled={loading}
                                  onKeyDown={handleSupplierKeyDown}
                                  tabIndex={5}
                                  InputLabelProps={{
                                    ...params.InputLabelProps,
                                    shrink: !!supplierValue,
                                  }}
                                  InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                      <>
                                        {supplierLoadingCondition ? <CircularProgress color="inherit" size={20} /> : null}
                                        {params.InputProps.endAdornment}
                                      </>
                                    ),
                                  }}
                                  sx={autocompleteTextFieldSx}
                                />
                              )}
                              ListboxProps={{
                                onScroll: handleSupplierScroll,
                                style: listboxPropsSx,
                              }}
                              noOptionsText="No suppliers found"
                            />
                          </Tooltip>
                        </Box>
                        {canCreateSupplier && (
                          <Tooltip title="Create Supplier - Quickly create a new supplier without leaving the product form.">
                            <IconButton
                              onClick={handleCreateSupplier}
                              disabled={loading}
                              sx={{
                                mt: 1,
                                padding: '8px',
                                color: '#1a237e',
                                border: '1px solid #c0c0c0',
                                borderRadius: 0,
                                backgroundColor: '#ffffff',
                                '&:hover': {
                                  backgroundColor: '#f5f5f5',
                                  borderColor: '#1a237e',
                                },
                                '&:disabled': {
                                  borderColor: '#e0e0e0',
                                  color: '#9e9e9e',
                                },
                              }}
                            >
                              <Add sx={{ fontSize: '18px' }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Tooltip title="Unit - Select the unit of measurement for this product (e.g., Pieces, Kilogram, Liter). This unit is used for inventory tracking and will appear on receipts and reports.">
                        <TextField
                          fullWidth
                          id="product-unit"
                          label="Unit"
                          value={formData.unit}
                          onChange={handleUnitChange}
                          onKeyDown={handleUnitKeyDown}
                          select
                          disabled={loading}
                          tabIndex={6}
                          SelectProps={{
                            open: unitSelectOpen,
                            onOpen: handleUnitSelectOpen,
                            onClose: handleUnitSelectClose,
                          }}
                          sx={selectTextFieldSx}
                        >
                          <MenuItem value="pcs" onClick={(e) => handleUnitMenuItemClick(e)} sx={menuItemSx}>Pieces</MenuItem>
                          <MenuItem value="kg" onClick={(e) => handleUnitMenuItemClick(e)} sx={menuItemSx}>Kilogram</MenuItem>
                          <MenuItem value="g" onClick={(e) => handleUnitMenuItemClick(e)} sx={menuItemSx}>Gram</MenuItem>
                          <MenuItem value="l" onClick={(e) => handleUnitMenuItemClick(e)} sx={menuItemSx}>Liter</MenuItem>
                          <MenuItem value="ml" onClick={(e) => handleUnitMenuItemClick(e)} sx={menuItemSx}>Milliliter</MenuItem>
                          <MenuItem value="m" onClick={(e) => handleUnitMenuItemClick(e)} sx={menuItemSx}>Meter</MenuItem>
                          <MenuItem value="cm" onClick={(e) => handleUnitMenuItemClick(e)} sx={menuItemSx}>Centimeter</MenuItem>
                        </TextField>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Tooltip title="Price - Enter the selling price of the product. This is the price customers will pay. Must be greater than or equal to 0. This is a required field.">
                        <TextField
                          fullWidth
                          id="product-price"
                          label="Price *"
                          type="number"
                          value={formData.price}
                          onChange={handlePriceChange}
                          onFocus={handlePriceFocus}
                          onKeyDown={handlePriceKeyDown}
                          inputProps={{ min: 0, step: 0.01 }}
                          error={!!fieldErrors.price}
                          helperText={fieldErrors.price}
                          disabled={loading}
                          tabIndex={7}
                          sx={textFieldSx}
                        />
                      </Tooltip>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Tooltip title="Cost Price - Enter the cost price (wholesale price) of the product. This is used to calculate profit margins and is required for inventory valuation. Must be greater than or equal to 0. This is a required field.">
                        <TextField
                          fullWidth
                          id="product-cost-price"
                          label="Cost Price *"
                          type="number"
                          value={formData.costPrice || ''}
                          onChange={handleCostPriceChange}
                          onKeyDown={handleCostPriceKeyDown}
                          inputProps={{ min: 0, step: 0.01 }}
                          error={!!fieldErrors.costPrice}
                          helperText={fieldErrors.costPrice}
                          disabled={loading}
                          tabIndex={8}
                          sx={textFieldSx}
                        />
                      </Tooltip>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Tooltip title="Currency - Select the currency for this product's price (USD or LBP). The system will handle currency conversion based on the exchange rate configured in settings.">
                        <TextField
                          fullWidth
                          id="product-currency"
                          label="Currency"
                          value={formData.currency}
                          onChange={handleCurrencyChange}
                          onKeyDown={handleCurrencyKeyDown}
                          select
                          disabled={loading}
                          tabIndex={9}
                          SelectProps={{
                            open: currencySelectOpen,
                            onOpen: handleCurrencySelectOpen,
                            onClose: handleCurrencySelectClose,
                          }}
                          sx={selectTextFieldSx}
                        >
                          <MenuItem value="USD" onClick={(e) => handleCurrencyMenuItemClick(e)} sx={menuItemSx}>USD</MenuItem>
                          <MenuItem value="LBP" onClick={(e) => handleCurrencyMenuItemClick(e)} sx={menuItemSx}>LBP</MenuItem>
                        </TextField>
                      </Tooltip>
                    </Grid>
                  </Grid>
                </Grid>

                {/* Inventory Information - Only show when creating new product */}
                {!isEditMode && (
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                      Inventory Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Tooltip title="Initial Quantity - Enter the starting stock quantity for this product when it's first added to the system. This sets the initial inventory level. Must be 0 or greater.">
                          <TextField
                            fullWidth
                            id="product-initial-quantity"
                            label="Initial Quantity"
                            type="number"
                            value={initialQuantity}
                            onChange={handleInitialQuantityChange}
                            onFocus={handleInitialQuantityFocus}
                            onKeyDown={handleInitialQuantityKeyDown}
                            inputProps={{ min: 0, step: 0.01 }}
                            helperText="Starting stock quantity for this product"
                            disabled={loading}
                            tabIndex={10}
                            sx={textFieldSx}
                          />
                        </Tooltip>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Tooltip title="Reorder Level - Enter the minimum stock level that triggers a low stock alert. When inventory falls below this level, you'll receive a notification to reorder. Must be 0 or greater.">
                          <TextField
                            fullWidth
                            id="product-reorder-level"
                            label="Reorder Level"
                            type="number"
                            value={reorderLevel}
                            onChange={handleReorderLevelChange}
                            onFocus={handleReorderLevelFocus}
                            onKeyDown={handleReorderLevelKeyDown}
                            inputProps={{ min: 0, step: 0.01 }}
                            helperText="Minimum stock level before reorder alert"
                            disabled={loading}
                            tabIndex={11}
                            sx={textFieldSx}
                          />
                        </Tooltip>
                      </Grid>
                    </Grid>
                  </Grid>
                )}
              </Grid>

              <Box sx={buttonsBoxSx}>
                <Tooltip title="Cancel - Discard all changes and return to the products list without saving.">
                  <span>
                    <Button
                      onClick={handleCancel}
                      disabled={loading}
                      tabIndex={isEditMode ? 10 : 12}
                      sx={cancelButtonSx}
                    >
                      Cancel
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title={loading ? "Saving product..." : isEditMode ? "Update Product - Save all changes to this product including name, price, barcode, category, and inventory settings." : "Create Product - Save this new product to the system. The product will be available for sale immediately."}>
                  <span>
                    <Button
                      id="product-submit"
                      type="submit"
                      variant="contained"
                      disabled={loading}
                      tabIndex={isEditMode ? 11 : 13}
                      sx={submitButtonSx}
                    >
                      {loading ? 'Saving...' : isEditMode ? 'Update Product' : 'Create Product'}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </form>
          </Box>
        </Paper>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default ProductForm;

