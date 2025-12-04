import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Grid,
  Typography,
  CircularProgress,
  Autocomplete,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  IconButton,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { RootState } from '../../store';
import {
  PricingService,
  CreatePricingRuleInput,
  UpdatePricingRuleInput,
  Promotion,
} from '../../services/pricing.service';
import { ProductService, Product, Category } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import MainLayout from '../../components/layout/MainLayout';
import { fromBeirutToUTC, utcDateToDate } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

const PricingRuleForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingRule, setLoadingRule] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    discountValue?: string;
    minQuantity?: string;
  }>({});

  const [formData, setFormData] = useState<CreatePricingRuleInput>({
    name: '',
    type: 'percentage_discount',
    productId: null,
    categoryId: null,
    promotionId: null,
    startDate: null,
    endDate: null,
    discountType: 'percentage',
    discountValue: 0,
    minQuantity: 1,
    isActive: true,
  });

  // Initial form data for change detection
  const [initialFormData, setInitialFormData] = useState<CreatePricingRuleInput>({
    name: '',
    type: 'percentage_discount',
    productId: null,
    categoryId: null,
    promotionId: null,
    startDate: null,
    endDate: null,
    discountType: 'percentage',
    discountValue: 0,
    minQuantity: 1,
    isActive: true,
  });

  // Promotions state
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionPage, setPromotionPage] = useState(1);
  const [promotionHasMore, setPromotionHasMore] = useState(true);
  const [promotionSearch, setPromotionSearch] = useState('');

  // Product and Category autocomplete states
  const [products, setProducts] = useState<Product[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [productHasMore, setProductHasMore] = useState(true);
  const [productSearch, setProductSearch] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryHasMore, setCategoryHasMore] = useState(true);
  const [categorySearch, setCategorySearch] = useState('');

  // Track if autocomplete/select dropdowns are open
  const typeSelectOpenRef = useRef(false);
  const productAutocompleteOpenRef = useRef(false);
  const categoryAutocompleteOpenRef = useRef(false);
  const promotionAutocompleteOpenRef = useRef(false);
  const discountTypeSelectOpenRef = useRef(false);

  // Control autocomplete/select open state for programmatic opening
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);
  const [productAutocompleteOpen, setProductAutocompleteOpen] = useState(false);
  const [categoryAutocompleteOpen, setCategoryAutocompleteOpen] = useState(false);
  const [promotionAutocompleteOpen, setPromotionAutocompleteOpen] = useState(false);
  const [discountTypeSelectOpen, setDiscountTypeSelectOpen] = useState(false);

  // Flags to track if we should move to next field after selection
  const shouldMoveAfterTypeSelectRef = useRef(false);
  const shouldMoveAfterDiscountTypeSelectRef = useRef(false);

  // Flags to track if select was opened by user (to move focus even if same value selected)
  const typeSelectWasOpenedRef = useRef(false);
  const discountTypeSelectWasOpenedRef = useRef(false);

  // Track if optional autocompletes have been "visited" (opened at least once)
  // Once visited, Enter when closed will move forward instead of opening again
  const productVisitedRef = useRef(false);
  const categoryVisitedRef = useRef(false);
  const promotionVisitedRef = useRef(false);

  // Load pricing rule if editing
  useEffect(() => {
    if (id && user?.id) {
      setIsEditMode(true);
      setLoadingRule(true);
      PricingService.getRule(parseInt(id), user.id)
        .then((result) => {
          if (result.success && result.rule) {
            const rule = result.rule;
            const loadedFormData = {
              name: rule.name,
              type: rule.type,
              productId: rule.productId,
              categoryId: rule.categoryId,
              promotionId: rule.promotionId,
              startDate: rule.startDate ? utcDateToDate(rule.startDate) : null,
              endDate: rule.endDate ? utcDateToDate(rule.endDate) : null,
              discountType: rule.discountType,
              discountValue: rule.discountValue,
              minQuantity: rule.minQuantity,
              isActive: rule.isActive,
            };
            setFormData(loadedFormData);
            setInitialFormData(loadedFormData);
            // Ensure selected product and category are in the lists
            if (rule.productId && rule.product) {
              const product = rule.product;
              setProducts((prev) => {
                const exists = prev.some((p) => p.id === rule.productId);
                if (!exists) {
                  return [product, ...prev];
                }
                return prev;
              });
            }
            if (rule.categoryId && rule.category) {
              const category = rule.category;
              setCategories((prev) => {
                const exists = prev.some((c) => c.id === rule.categoryId);
                if (!exists) {
                  return [category, ...prev];
                }
                return prev;
              });
            }
            if (rule.promotionId && rule.promotion) {
              const promotion = rule.promotion;
              setPromotions((prev) => {
                const exists = prev.some((p) => p.id === rule.promotionId);
                if (!exists) {
                  return [promotion, ...prev];
                }
                return prev;
              });
            }
          } else {
            showToast(result.error || 'Failed to load pricing rule', 'error');
          }
        })
        .catch((err) => {
          showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
        })
        .finally(() => {
          setLoadingRule(false);
        });
    }
  }, [id, user?.id, showToast]);

  // Debounced search states
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [debouncedCategorySearch, setDebouncedCategorySearch] = useState('');
  const [debouncedPromotionSearch, setDebouncedPromotionSearch] = useState('');
  const productSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const categorySearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const promotionSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load products
  const loadProducts = useCallback(async (page: number, reset: boolean = false, search: string = '') => {
    if (!user?.id) return;
    setProductLoading(true);
    try {
      const result = await ProductService.getProducts(
        { page, pageSize: 50, search },
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

  useEffect(() => {
    if (user?.id) {
      setProductPage(1);
      loadProducts(1, true, '');
    }
  }, [user?.id, loadProducts]);

  useEffect(() => {
    if (user?.id) {
      setProductPage(1);
      loadProducts(1, true, debouncedProductSearch);
    }
  }, [debouncedProductSearch, user?.id, loadProducts]);

  // Load categories
  const loadCategories = useCallback(async (page: number, reset: boolean = false, search: string = '') => {
    if (!user?.id) return;
    setCategoryLoading(true);
    try {
      const result = await CategoryService.getCategoriesList(
        { page, pageSize: 50, search },
        user.id
      );
      if (result.success && result.categories) {
        if (reset) {
          setCategories(result.categories);
        } else {
          setCategories((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newItems = result.categories!.filter((c) => !existingIds.has(c.id));
            return [...prev, ...newItems];
          });
        }
        setCategoryHasMore(result.pagination?.hasNextPage ?? false);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setCategoryLoading(false);
    }
  }, [user?.id]);

  // Load promotions
  const loadPromotions = useCallback(async (page: number, reset: boolean = false, search: string = '') => {
    if (!user?.id) return;
    setPromotionLoading(true);
    try {
      const result = await PricingService.getPromotions(
        { page, pageSize: 50, search },
        user.id
      );
      if (result.success && result.promotions) {
        if (reset) {
          setPromotions(result.promotions);
        } else {
          setPromotions((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newItems = result.promotions!.filter((p) => !existingIds.has(p.id));
            return [...prev, ...newItems];
          });
        }
        setPromotionHasMore(result.pagination?.hasNextPage ?? false);
      }
    } catch (err) {
      console.error('Failed to load promotions:', err);
    } finally {
      setPromotionLoading(false);
    }
  }, [user?.id]);

  // Debounce promotion search
  useEffect(() => {
    if (promotionSearchTimeoutRef.current) {
      clearTimeout(promotionSearchTimeoutRef.current);
    }
    promotionSearchTimeoutRef.current = setTimeout(() => {
      setDebouncedPromotionSearch(promotionSearch);
    }, 300);

    return () => {
      if (promotionSearchTimeoutRef.current) {
        clearTimeout(promotionSearchTimeoutRef.current);
      }
    };
  }, [promotionSearch]);

  useEffect(() => {
    if (user?.id) {
      setPromotionPage(1);
      loadPromotions(1, true, '');
    }
  }, [user?.id, loadPromotions]);

  useEffect(() => {
    if (user?.id) {
      setPromotionPage(1);
      loadPromotions(1, true, debouncedPromotionSearch);
    }
  }, [debouncedPromotionSearch, user?.id, loadPromotions]);

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

  useEffect(() => {
    if (user?.id) {
      setCategoryPage(1);
      loadCategories(1, true, '');
    }
  }, [user?.id, loadCategories]);

  useEffect(() => {
    if (user?.id) {
      setCategoryPage(1);
      loadCategories(1, true, debouncedCategorySearch);
    }
  }, [debouncedCategorySearch, user?.id, loadCategories]);

  const validateForm = useCallback((): boolean => {
    const errors: {
      name?: string;
      discountValue?: string;
      minQuantity?: string;
    } = {};

    // Validate name
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Name is required';
    }

    // Validate discount value
    if (formData.discountType === 'percentage') {
      if (formData.discountValue === undefined || formData.discountValue === null || formData.discountValue < 0 || formData.discountValue > 100) {
        errors.discountValue = 'Percentage discount is required and must be between 0 and 100';
      }
    } else {
      if (formData.discountValue === undefined || formData.discountValue === null || formData.discountValue < 0) {
        errors.discountValue = 'Discount amount is required and must be greater than or equal to 0';
      }
    }

    // Validate minimum quantity
    if (formData.minQuantity === undefined || formData.minQuantity === null || formData.minQuantity < 1) {
      errors.minQuantity = 'Minimum quantity is required and must be at least 1';
    }

    setFieldErrors((prev) => ({ ...prev, ...errors }));
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    // Additional business logic validations
    if (formData.productId && formData.categoryId) {
      showToast('Cannot specify both product and category', 'error');
      return;
    }

    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      showToast('Start date must be before end date', 'error');
      return;
    }

    // Check if values have changed (only in edit mode)
    if (isEditMode && id) {
      // Compare dates by converting to UTC for comparison
      const currentStartDate = formData.startDate ? fromBeirutToUTC(formData.startDate) : null;
      const currentEndDate = formData.endDate ? fromBeirutToUTC(formData.endDate) : null;
      const initialStartDate = initialFormData.startDate ? fromBeirutToUTC(initialFormData.startDate) : null;
      const initialEndDate = initialFormData.endDate ? fromBeirutToUTC(initialFormData.endDate) : null;

      // Compare dates by timestamp
      const startDateChanged = currentStartDate?.getTime() !== initialStartDate?.getTime();
      const endDateChanged = currentEndDate?.getTime() !== initialEndDate?.getTime();

      if (
        formData.name === initialFormData.name &&
        formData.type === initialFormData.type &&
        formData.productId === initialFormData.productId &&
        formData.categoryId === initialFormData.categoryId &&
        formData.promotionId === initialFormData.promotionId &&
        !startDateChanged &&
        !endDateChanged &&
        formData.discountType === initialFormData.discountType &&
        formData.discountValue === initialFormData.discountValue &&
        formData.minQuantity === initialFormData.minQuantity &&
        formData.isActive === initialFormData.isActive
      ) {
        showToast('No changes made', 'info');
        return;
      }
    }

    setLoading(true);
    setFieldErrors({});

    try {
      // Convert dates from Beirut timezone to UTC before saving
      const submitData: CreatePricingRuleInput = {
        ...formData,
        startDate: formData.startDate ? fromBeirutToUTC(formData.startDate) : null,
        endDate: formData.endDate ? fromBeirutToUTC(formData.endDate) : null,
      };

      let result;
      if (isEditMode && id) {
        const updateInput: UpdatePricingRuleInput = submitData;
        result = await PricingService.updateRule(parseInt(id), updateInput, user.id);
      } else {
        result = await PricingService.createRule(submitData, user.id);
      }

      if (result.success) {
        if (isEditMode) {
          setInitialFormData(formData);
        }
        showToast(isEditMode ? 'Pricing rule updated successfully' : 'Pricing rule created successfully', 'success');
        navigate('/pricing-rules');
      } else {
        showToast(result.error || 'Failed to save pricing rule', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [formData, initialFormData, user?.id, isEditMode, id, navigate, showToast, validateForm]);

  const handleNavigateBack = useCallback(() => {
    navigate('/pricing-rules');
  }, [navigate]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
    setFieldErrors((prev) => {
      if (prev.name) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { name, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, []);

  const handleTypeChange = useCallback((e: { target: { value: unknown } }) => {
    setFormData((prev) => ({
      ...prev,
      type: e.target.value as CreatePricingRuleInput['type'],
    }));
    // Set flag to move to next field after dropdown closes
    shouldMoveAfterTypeSelectRef.current = true;
  }, []);

  const handleProductChange = useCallback((_: unknown, newValue: Product | null) => {
    setFormData((prev) => ({
      ...prev,
      productId: newValue?.id || null,
      categoryId: newValue ? null : prev.categoryId,
    }));
  }, []);


  const handleProductScroll = useCallback((event: React.UIEvent<HTMLUListElement>) => {
    const listboxNode = event.currentTarget;
    if (
      listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 10 &&
      productHasMore &&
      !productLoading
    ) {
      const nextPage = productPage + 1;
      setProductPage(nextPage);
      loadProducts(nextPage, false, debouncedProductSearch);
    }
  }, [productHasMore, productLoading, productPage, debouncedProductSearch, loadProducts]);

  const handleCategoryChange = useCallback((_: unknown, newValue: Category | null) => {
    setFormData((prev) => ({
      ...prev,
      categoryId: newValue?.id || null,
      productId: newValue ? null : prev.productId,
    }));
  }, []);


  const handleCategoryScroll = useCallback((event: React.UIEvent<HTMLUListElement>) => {
    const listboxNode = event.currentTarget;
    if (
      listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 10 &&
      categoryHasMore &&
      !categoryLoading
    ) {
      const nextPage = categoryPage + 1;
      setCategoryPage(nextPage);
      loadCategories(nextPage, false, debouncedCategorySearch);
    }
  }, [categoryHasMore, categoryLoading, categoryPage, debouncedCategorySearch, loadCategories]);

  const handlePromotionChange = useCallback((_: unknown, newValue: Promotion | null) => {
    setFormData((prev) => ({
      ...prev,
      promotionId: newValue?.id || null,
    }));
  }, []);


  const handlePromotionScroll = useCallback((event: React.UIEvent<HTMLUListElement>) => {
    const listboxNode = event.currentTarget;
    if (
      listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 10 &&
      promotionHasMore &&
      !promotionLoading
    ) {
      const nextPage = promotionPage + 1;
      setPromotionPage(nextPage);
      loadPromotions(nextPage, false, debouncedPromotionSearch);
    }
  }, [promotionHasMore, promotionLoading, promotionPage, debouncedPromotionSearch, loadPromotions]);

  const handleStartDateChange = useCallback((newValue: Date | null) => {
    setFormData((prev) => ({
      ...prev,
      startDate: newValue,
    }));
  }, []);

  const handleEndDateChange = useCallback((newValue: Date | null) => {
    setFormData((prev) => ({
      ...prev,
      endDate: newValue,
    }));
  }, []);

  const handleDiscountTypeChange = useCallback((e: { target: { value: unknown } }) => {
    setFormData((prev) => ({
      ...prev,
      discountType: e.target.value as 'percentage' | 'fixed',
    }));
    // Set flag to move to next field after dropdown closes
    shouldMoveAfterDiscountTypeSelectRef.current = true;
  }, []);

  const handleDiscountValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      discountValue: parseFloat(e.target.value) || 0,
    }));
    setFieldErrors((prev) => {
      if (prev.discountValue) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { discountValue, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, []);

  const handleMinQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      minQuantity: parseFloat(e.target.value) || 1,
    }));
    setFieldErrors((prev) => {
      if (prev.minQuantity) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { minQuantity, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, []);

  const handleIsActiveChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setFormData((prev) => ({ ...prev, isActive: newValue }));
    // If toggle is activated (toggled on), trigger save button
    if (newValue) {
      setTimeout(() => {
        const submitButton = document.getElementById('pricing-rule-submit');
        if (submitButton) {
          (submitButton as HTMLButtonElement).click();
        } else {
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }
      }, 0);
    }
  }, []);

  const handleIsActiveKeyDown = useCallback((e: React.KeyboardEvent<HTMLLabelElement>) => {
    // Allow Enter to trigger save button without toggling
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      // Use setTimeout to ensure the event is fully processed
      setTimeout(() => {
        const submitButton = document.getElementById('pricing-rule-submit') as HTMLButtonElement | null;
        if (submitButton && !submitButton.disabled) {
          submitButton.click();
        } else {
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }
      }, 0);
      return;
    }
    // Prevent default toggle behavior on Space - only allow arrow keys
    if (e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Toggle with arrow keys (left = false, right = true)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      const newValue = e.key === 'ArrowRight';
      setFormData((prev) => ({ ...prev, isActive: newValue }));
      // If toggle is activated (toggled on), trigger save button
      if (newValue) {
        setTimeout(() => {
          const submitButton = document.getElementById('pricing-rule-submit') as HTMLButtonElement | null;
          if (submitButton && !submitButton.disabled) {
            submitButton.click();
          } else {
            const form = document.querySelector('form');
            if (form) {
              form.requestSubmit();
            }
          }
        }, 0);
      }
    }
  }, []);

  const handleCancel = useCallback(() => {
    navigate('/pricing-rules');
  }, [navigate]);

  // Keyboard navigation handlers
  const handleNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const typeInput = document.getElementById('pricing-rule-type');
      typeInput?.focus();
    }
  }, []);

  const handleProductKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // If dropdown is open, close it and move forward
      if (productAutocompleteOpenRef.current) {
        e.preventDefault();
        productVisitedRef.current = true;
        setProductAutocompleteOpen(false);
        setTimeout(() => {
          const categoryInput = document.getElementById('pricing-rule-category');
          categoryInput?.focus();
        }, 0);
      } else if (productVisitedRef.current) {
        // If dropdown is closed and was previously visited, move forward
        e.preventDefault();
        const categoryInput = document.getElementById('pricing-rule-category');
        categoryInput?.focus();
      } else {
        // If dropdown is closed and not visited yet, open it
        e.preventDefault();
        productVisitedRef.current = true;
        setProductAutocompleteOpen(true);
      }
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
          const promotionInput = document.getElementById('pricing-rule-promotion');
          promotionInput?.focus();
        }, 0);
      } else if (categoryVisitedRef.current) {
        // If dropdown is closed and was previously visited, move forward
        e.preventDefault();
        const promotionInput = document.getElementById('pricing-rule-promotion');
        promotionInput?.focus();
      } else {
        // If dropdown is closed and not visited yet, open it
        e.preventDefault();
        categoryVisitedRef.current = true;
        setCategoryAutocompleteOpen(true);
      }
    }
  }, []);

  const handlePromotionKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // If dropdown is open, close it and move forward
      if (promotionAutocompleteOpenRef.current) {
        e.preventDefault();
        promotionVisitedRef.current = true;
        setPromotionAutocompleteOpen(false);
        setTimeout(() => {
          const startDateInput = document.getElementById('pricing-rule-start-date');
          startDateInput?.focus();
        }, 0);
      } else if (promotionVisitedRef.current) {
        // If dropdown is closed and was previously visited, move forward
        e.preventDefault();
        const startDateInput = document.getElementById('pricing-rule-start-date');
        startDateInput?.focus();
      } else {
        // If dropdown is closed and not visited yet, open it
        e.preventDefault();
        promotionVisitedRef.current = true;
        setPromotionAutocompleteOpen(true);
      }
    }
  }, []);

  const handleStartDateKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const endDateInput = document.getElementById('pricing-rule-end-date');
      endDateInput?.focus();
    }
  }, []);

  const handleEndDateKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const discountTypeInput = document.getElementById('pricing-rule-discount-type');
      discountTypeInput?.focus();
    }
  }, []);

  const handleDiscountValueKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const minQuantityInput = document.getElementById('pricing-rule-min-quantity');
      minQuantityInput?.focus();
    }
  }, []);

  const handleMinQuantityKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const toggleSwitch = document.getElementById('pricing-rule-active-toggle');
      toggleSwitch?.focus();
    }
  }, []);

  // Handlers for select open/close
  const handleTypeSelectOpen = useCallback(() => {
    typeSelectOpenRef.current = true;
    setTypeSelectOpen(true);
    typeSelectWasOpenedRef.current = true;
  }, []);

  const handleTypeSelectClose = useCallback(() => {
    const wasOpened = typeSelectWasOpenedRef.current;
    typeSelectOpenRef.current = false;
    setTypeSelectOpen(false);
    typeSelectWasOpenedRef.current = false;
    shouldMoveAfterTypeSelectRef.current = false;
    
    // Always move to next field if select was opened by user
    if (wasOpened) {
      setTimeout(() => {
        const productInput = document.getElementById('pricing-rule-product');
        productInput?.focus();
      }, 0);
    }
  }, []);

  const handleTypeMenuItemClick = useCallback((event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (typeSelectWasOpenedRef.current || typeSelectOpenRef.current) {
      typeSelectWasOpenedRef.current = false;
      typeSelectOpenRef.current = false;
      setTypeSelectOpen(false);
      setTimeout(() => {
        const productInput = document.getElementById('pricing-rule-product');
        productInput?.focus();
      }, 150);
    }
  }, []);

  const handleDiscountTypeSelectOpen = useCallback(() => {
    discountTypeSelectOpenRef.current = true;
    setDiscountTypeSelectOpen(true);
    discountTypeSelectWasOpenedRef.current = true;
  }, []);

  const handleDiscountTypeSelectClose = useCallback(() => {
    const wasOpened = discountTypeSelectWasOpenedRef.current;
    discountTypeSelectOpenRef.current = false;
    setDiscountTypeSelectOpen(false);
    discountTypeSelectWasOpenedRef.current = false;
    shouldMoveAfterDiscountTypeSelectRef.current = false;
    
    // Always move to next field if select was opened by user
    if (wasOpened) {
      setTimeout(() => {
        const discountValueInput = document.getElementById('pricing-rule-discount-value');
        discountValueInput?.focus();
      }, 0);
    }
  }, []);

  const handleDiscountTypeMenuItemClick = useCallback((event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (discountTypeSelectWasOpenedRef.current || discountTypeSelectOpenRef.current) {
      discountTypeSelectWasOpenedRef.current = false;
      discountTypeSelectOpenRef.current = false;
      setDiscountTypeSelectOpen(false);
      setTimeout(() => {
        const discountValueInput = document.getElementById('pricing-rule-discount-value');
        discountValueInput?.focus();
      }, 150);
    }
  }, []);

  // Memoize selected product and category to prevent unnecessary re-renders
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === formData.productId) || null;
  }, [products, formData.productId]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === formData.categoryId) || null;
  }, [categories, formData.categoryId]);

  const selectedPromotion = useMemo(() => {
    return promotions.find((p) => p.id === formData.promotionId) || null;
  }, [promotions, formData.promotionId]);

  // Handle product input change - ignore if it matches selected value's name
  const handleProductInputChange = useCallback((_: unknown, newInputValue: string) => {
    // If the input value matches the selected product's name, clear the search
    // This prevents searching when autocomplete reopens with selected value
    if (selectedProduct && selectedProduct.name === newInputValue) {
      setProductSearch('');
    } else {
      setProductSearch(newInputValue);
    }
  }, [selectedProduct]);

  // Handle product autocomplete open - clear search and reload all options
  const handleProductOpen = useCallback(() => {
    productAutocompleteOpenRef.current = true;
    setProductAutocompleteOpen(true);
    productVisitedRef.current = true;
    setProductSearch('');
    setProductPage(1);
    loadProducts(1, true, '');
  }, [loadProducts]);

  const handleProductClose = useCallback(() => {
    productAutocompleteOpenRef.current = false;
    setProductAutocompleteOpen(false);
  }, []);

  // Handle category input change - ignore if it matches selected value's name
  const handleCategoryInputChange = useCallback((_: unknown, newInputValue: string) => {
    // If the input value matches the selected category's name, clear the search
    // This prevents searching when autocomplete reopens with selected value
    if (selectedCategory && selectedCategory.name === newInputValue) {
      setCategorySearch('');
    } else {
      setCategorySearch(newInputValue);
    }
  }, [selectedCategory]);

  // Handle category autocomplete open - clear search and reload all options
  const handleCategoryOpen = useCallback(() => {
    categoryAutocompleteOpenRef.current = true;
    setCategoryAutocompleteOpen(true);
    categoryVisitedRef.current = true;
    setCategorySearch('');
    setCategoryPage(1);
    loadCategories(1, true, '');
  }, [loadCategories]);

  const handleCategoryClose = useCallback(() => {
    categoryAutocompleteOpenRef.current = false;
    setCategoryAutocompleteOpen(false);
  }, []);

  // Handle promotion input change - ignore if it matches selected value's name
  const handlePromotionInputChange = useCallback((_: unknown, newInputValue: string) => {
    // If the input value matches the selected promotion's name, clear the search
    // This prevents searching when autocomplete reopens with selected value
    if (selectedPromotion && selectedPromotion.name === newInputValue) {
      setPromotionSearch('');
    } else {
      setPromotionSearch(newInputValue);
    }
  }, [selectedPromotion]);

  // Handle promotion autocomplete open - clear search and reload all options
  const handlePromotionOpen = useCallback(() => {
    promotionAutocompleteOpenRef.current = true;
    setPromotionAutocompleteOpen(true);
    promotionVisitedRef.current = true;
    setPromotionSearch('');
    setPromotionPage(1);
    loadPromotions(1, true, '');
  }, [loadPromotions]);

  const handlePromotionClose = useCallback(() => {
    promotionAutocompleteOpenRef.current = false;
    setPromotionAutocompleteOpen(false);
  }, []);

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

  const formContentBoxSx = useMemo(() => ({
    p: 3,
  }), []);

  const textFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
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
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiFormHelperText-root': {
      fontSize: '12px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const autocompleteTextFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
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
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const selectTextFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
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
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const datePickerTextFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
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
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const formControlLabelSx = useMemo(() => ({
    '& .MuiFormControlLabel-label': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const buttonBoxSx = useMemo(() => ({
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
    '&:hover': {
      borderColor: '#1a237e',
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const submitButtonSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#1a237e',
    '&:hover': {
      backgroundColor: '#000051',
    },
  }), []);

  const listboxPropsSx = useMemo(() => ({
    maxHeight: 300,
  }), []);

  const getProductOptionLabel = useCallback((option: Product) => option.name || '', []);

  const getCategoryOptionLabel = useCallback((option: Category) => option.name || '', []);

  const getPromotionOptionLabel = useCallback((option: Promotion) => option.name || '', []);

  const discountLabel = useMemo(() => 
    formData.discountType === 'percentage' ? 'Discount Percentage *' : 'Discount Amount *',
    [formData.discountType]
  );

  const discountHelperText = useMemo(() => 
    fieldErrors.discountValue || (formData.discountType === 'percentage'
      ? 'Enter percentage (0-100)'
      : 'Enter fixed amount'),
    [fieldErrors.discountValue, formData.discountType]
  );

  if (loadingRule) {
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
        <Paper sx={paperSx}>
          <Box sx={titleBarBoxSx}>
            <IconButton onClick={handleNavigateBack} sx={backIconButtonSx}>
              <ArrowBack />
            </IconButton>
            <Typography sx={titleTypographySx}>
              {isEditMode ? 'Edit Pricing Rule' : 'New Pricing Rule'}
            </Typography>
          </Box>

          <Box sx={formContentBoxSx}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  id="pricing-rule-name"
                  label="Name *"
                  value={formData.name}
                  onChange={handleNameChange}
                  onKeyDown={handleNameKeyDown}
                  error={!!fieldErrors.name}
                  helperText={fieldErrors.name}
                  tabIndex={1}
                  autoFocus
                  sx={textFieldSx}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    id="pricing-rule-type"
                    value={formData.type}
                    label="Type"
                    onChange={handleTypeChange}
                    open={typeSelectOpen}
                    onOpen={handleTypeSelectOpen}
                    onClose={handleTypeSelectClose}
                    tabIndex={2}
                    sx={selectTextFieldSx}
                  >
                    <MenuItem value="percentage_discount" onClick={(e) => handleTypeMenuItemClick(e)}>Percentage Discount</MenuItem>
                    <MenuItem value="fixed_discount" onClick={(e) => handleTypeMenuItemClick(e)}>Fixed Discount</MenuItem>
                    <MenuItem value="quantity_based" onClick={(e) => handleTypeMenuItemClick(e)}>Quantity Based</MenuItem>
                    <MenuItem value="buy_x_get_y" onClick={(e) => handleTypeMenuItemClick(e)}>Buy X Get Y</MenuItem>
                    <MenuItem value="time_based" onClick={(e) => handleTypeMenuItemClick(e)}>Time Based</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  id="pricing-rule-product"
                  options={products}
                  getOptionLabel={getProductOptionLabel}
                  loading={productLoading && (products.length === 0 || productSearch !== '')}
                  value={selectedProduct}
                  onChange={handleProductChange}
                  onInputChange={handleProductInputChange}
                  open={productAutocompleteOpen}
                  onOpen={handleProductOpen}
                  onClose={handleProductClose}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Product (optional)"
                      placeholder="Select a product..."
                      onKeyDown={handleProductKeyDown}
                      tabIndex={3}
                      sx={autocompleteTextFieldSx}
                      InputLabelProps={{
                        ...params.InputLabelProps,
                        shrink: !!selectedProduct,
                      }}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {productLoading && (products.length === 0 || productSearch !== '') ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  ListboxProps={{
                    onScroll: handleProductScroll,
                    style: listboxPropsSx,
                  }}
                  noOptionsText="No products found"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  id="pricing-rule-category"
                  options={categories}
                  getOptionLabel={getCategoryOptionLabel}
                  loading={categoryLoading && (categories.length === 0 || categorySearch !== '')}
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  onInputChange={handleCategoryInputChange}
                  open={categoryAutocompleteOpen}
                  onOpen={handleCategoryOpen}
                  onClose={handleCategoryClose}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Category (optional)"
                      placeholder="Select a category..."
                      onKeyDown={handleCategoryKeyDown}
                      tabIndex={4}
                      sx={autocompleteTextFieldSx}
                      InputLabelProps={{
                        ...params.InputLabelProps,
                        shrink: !!selectedCategory,
                      }}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {categoryLoading && (categories.length === 0 || categorySearch !== '') ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  ListboxProps={{
                    onScroll: handleCategoryScroll,
                    style: listboxPropsSx,
                  }}
                  noOptionsText="No categories found"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  id="pricing-rule-promotion"
                  options={promotions}
                  getOptionLabel={getPromotionOptionLabel}
                  loading={promotionLoading && (promotions.length === 0 || promotionSearch !== '')}
                  value={selectedPromotion}
                  onChange={handlePromotionChange}
                  onInputChange={handlePromotionInputChange}
                  open={promotionAutocompleteOpen}
                  onOpen={handlePromotionOpen}
                  onClose={handlePromotionClose}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Promotion (optional)"
                      placeholder="Select a promotion..."
                      onKeyDown={handlePromotionKeyDown}
                      tabIndex={5}
                      sx={autocompleteTextFieldSx}
                      InputLabelProps={{
                        ...params.InputLabelProps,
                        shrink: !!selectedPromotion,
                      }}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {promotionLoading && (promotions.length === 0 || promotionSearch !== '') ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  ListboxProps={{
                    onScroll: handlePromotionScroll,
                    style: listboxPropsSx,
                  }}
                  noOptionsText="No promotions found"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Start Date (optional)"
                  value={formData.startDate}
                  onChange={handleStartDateChange}
                  slotProps={{
                    textField: {
                      id: 'pricing-rule-start-date',
                      fullWidth: true,
                      onKeyDown: handleStartDateKeyDown,
                      tabIndex: 6,
                      sx: datePickerTextFieldSx,
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="End Date (optional)"
                  value={formData.endDate}
                  onChange={handleEndDateChange}
                  slotProps={{
                    textField: {
                      id: 'pricing-rule-end-date',
                      fullWidth: true,
                      onKeyDown: handleEndDateKeyDown,
                      tabIndex: 7,
                      sx: datePickerTextFieldSx,
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Discount Type</InputLabel>
                  <Select
                    id="pricing-rule-discount-type"
                    value={formData.discountType}
                    label="Discount Type"
                    onChange={handleDiscountTypeChange}
                    open={discountTypeSelectOpen}
                    onOpen={handleDiscountTypeSelectOpen}
                    onClose={handleDiscountTypeSelectClose}
                    tabIndex={8}
                    sx={selectTextFieldSx}
                  >
                    <MenuItem value="percentage" onClick={(e) => handleDiscountTypeMenuItemClick(e)}>Percentage</MenuItem>
                    <MenuItem value="fixed" onClick={(e) => handleDiscountTypeMenuItemClick(e)}>Fixed Amount</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  id="pricing-rule-discount-value"
                  label={discountLabel}
                  type="number"
                  value={formData.discountValue}
                  onChange={handleDiscountValueChange}
                  onKeyDown={handleDiscountValueKeyDown}
                  inputProps={{
                    min: 0,
                    max: formData.discountType === 'percentage' ? 100 : undefined,
                    step: 0.01,
                  }}
                  error={!!fieldErrors.discountValue}
                  helperText={discountHelperText}
                  tabIndex={9}
                  sx={textFieldSx}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  id="pricing-rule-min-quantity"
                  label="Minimum Quantity *"
                  type="number"
                  value={formData.minQuantity}
                  onChange={handleMinQuantityChange}
                  onKeyDown={handleMinQuantityKeyDown}
                  inputProps={{ min: 1, step: 1 }}
                  error={!!fieldErrors.minQuantity}
                  helperText={fieldErrors.minQuantity}
                  tabIndex={10}
                  sx={textFieldSx}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      id="pricing-rule-active-toggle"
                      checked={formData.isActive}
                      onChange={handleIsActiveChange}
                      tabIndex={11}
                    />
                  }
                  label="Active"
                  sx={formControlLabelSx}
                  onKeyDown={handleIsActiveKeyDown}
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={buttonBoxSx}>
                  <Button
                    variant="outlined"
                    onClick={handleCancel}
                    disabled={loading}
                    tabIndex={12}
                    sx={cancelButtonSx}
                  >
                    Cancel
                  </Button>
                  <Button
                    id="pricing-rule-submit"
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    tabIndex={13}
                    sx={submitButtonSx}
                  >
                    {loading ? <CircularProgress size={20} /> : 'Save Pricing Rule'}
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

export default PricingRuleForm;

