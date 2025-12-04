import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  IconButton,
  Chip,
  Typography,
  CircularProgress,
  Checkbox,
  Tooltip,
} from '@mui/material';
import { Add, Edit, Delete, Visibility, Refresh } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ProductService, Product, ProductListOptions, Category } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { SupplierService } from '../../services/supplier.service';
import { Supplier } from '../../services/product.service';
import MainLayout from '../../components/layout/MainLayout';
import { ROUTES } from '../../utils/constants';
import { formatCurrency } from '../../utils/currency';
import { CurrencyService } from '../../services/currency.service';
import FilterHeader, { FilterField } from '../../components/common/FilterHeader';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { usePermission } from '../../hooks/usePermission';
import VirtualizedTableBody from '../../components/common/VirtualizedTableBody';

// Memoized ProductRow component to prevent unnecessary re-renders
interface ProductRowProps {
  product: Product;
  dualCurrency?: { price: { usd: number; lbp: number }; costPrice?: { usd: number; lbp: number } };
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  selected: boolean;
  onSelect: (productId: number) => void;
  canUpdate: boolean;
  canDelete: boolean;
}

/* eslint-disable react/prop-types */
const ProductRow = memo<ProductRowProps>(({ product, dualCurrency, onView, onEdit, onDelete, selected, onSelect, canUpdate, canDelete }) => {
  // Memoize sx prop objects
  const bodyTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const captionTypographySx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const chipSx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const priceTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const viewIconButtonSx = useMemo(() => ({
    padding: '8px',
    width: '48px',
    height: '48px',
    color: '#616161',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
  }), []);

  const editIconButtonSx = useMemo(() => ({
    padding: '8px',
    width: '48px',
    height: '48px',
    color: '#1a237e',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
  }), []);

  const deleteIconButtonSx = useMemo(() => ({
    padding: '8px',
    width: '48px',
    height: '48px',
    color: '#d32f2f',
    '&:hover': {
      backgroundColor: '#ffebee',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
  }), []);

  return (
    <TableRow hover>
      {canDelete && (
        <TableCell padding="checkbox">
          <Checkbox
            checked={selected}
            onChange={() => onSelect(product.id)}
            sx={{
              color: '#1a237e',
              '&.Mui-checked': {
                color: '#1a237e',
              },
            }}
          />
        </TableCell>
      )}
      <TableCell>
        <Typography variant="body2" sx={bodyTypographySx}>
          {product.barcode || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight="medium" sx={bodyTypographySx}>
          {product.name}
        </Typography>
        {product.description && (
          <Typography variant="caption" color="text.secondary" sx={captionTypographySx}>
            {product.description}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        {product.category ? (
          <Chip label={product.category.name} size="small" sx={chipSx} />
        ) : (
          <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
            -
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={bodyTypographySx}>
          {product.unit}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Box>
          <Typography variant="body2" sx={priceTypographySx}>
            {formatCurrency(product.price, product.currency || 'USD')}
          </Typography>
          {dualCurrency?.price && (
            <Typography variant="caption" color="text.secondary" sx={captionTypographySx}>
              {dualCurrency.price.lbp.toFixed(0)} LBP
            </Typography>
          )}
        </Box>
      </TableCell>
      <TableCell align="right">
        {product.costPrice ? (
          <Box>
            <Typography variant="body2" sx={priceTypographySx}>
              {formatCurrency(product.costPrice, product.currency || 'USD')}
            </Typography>
            {dualCurrency?.costPrice && (
              <Typography variant="caption" color="text.secondary" sx={captionTypographySx}>
                {dualCurrency.costPrice.lbp.toFixed(0)} LBP
              </Typography>
            )}
          </Box>
        ) : (
          <Typography variant="body2" sx={bodyTypographySx}>
            -
          </Typography>
        )}
      </TableCell>
      <TableCell>
        {product.supplier ? (
          <Typography variant="body2" sx={bodyTypographySx}>
            {product.supplier.name}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
            -
          </Typography>
        )}
      </TableCell>
      <TableCell align="center">
        <Tooltip title={`View ${product.name} - View detailed information about this product including pricing, inventory, and transaction history.`}>
          <IconButton
            onClick={() => onView(product)}
            sx={viewIconButtonSx}
          >
            <Visibility />
          </IconButton>
        </Tooltip>
        {canUpdate && (
          <Tooltip title={`Edit ${product.name} - Modify product details such as name, price, barcode, category, and supplier.`}>
            <IconButton
              onClick={() => onEdit(product)}
              sx={editIconButtonSx}
            >
              <Edit />
            </IconButton>
          </Tooltip>
        )}
        {canDelete && (
          <Tooltip title={`Delete ${product.name} - Permanently remove this product from the system. This action cannot be undone.`}>
            <IconButton
              onClick={() => onDelete(product)}
              sx={deleteIconButtonSx}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
});
/* eslint-enable react/prop-types */

ProductRow.displayName = 'ProductRow';

const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  // Permission checks
  const canCreate = usePermission('products.create');
  const canUpdate = usePermission('products.update');
  const canDelete = usePermission('products.delete');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [productDualCurrencies, setProductDualCurrencies] = useState<
    Record<number, { price: { usd: number; lbp: number }; costPrice?: { usd: number; lbp: number } }>
  >({});
  const [supplierFilter, setSupplierFilter] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<'name' | 'barcode' | 'price' | 'createdAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
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

  // Debounced search timeout ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadProducts = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const options: ProductListOptions = {
        page: page + 1,
        pageSize,
        search: debouncedSearch || undefined,
        categoryId: categoryFilter || undefined,
        supplierId: supplierFilter || undefined,
        sortBy,
        sortOrder,
      };

      const result = await ProductService.getProducts(options, user.id);
      if (result.success && result.products) {
        setProducts(result.products);
        setTotal(result.total || 0);
      } else {
        showToast(result.error || 'Failed to load products', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.id, page, pageSize, debouncedSearch, categoryFilter, supplierFilter, sortBy, sortOrder, showToast]);

  // Debounced search states
  const [debouncedCategorySearch, setDebouncedCategorySearch] = useState('');
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('');
  const categorySearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supplierSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          setCategories((prev) => [...prev, ...result.categories!]);
        }
        setCategoryHasMore(result.pagination?.hasNextPage ?? false);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setCategoryLoading(false);
    }
  }, [user?.id]);

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
          setSuppliers((prev) => [...prev, ...result.suppliers!]);
        }
        setSupplierHasMore(result.pagination?.hasNextPage ?? false);
      }
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setSupplierLoading(false);
    }
  }, [user?.id]);

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

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

  // Load initial categories and suppliers on mount
  useEffect(() => {
    if (user?.id) {
      setCategoryPage(1);
      setSupplierPage(1);
      loadCategories(1, true, '');
      loadSuppliers(1, true, '');
    }
  }, [user?.id, loadCategories, loadSuppliers]);

  // Reset and reload when debounced search changes (skip initial mount to avoid redundant calls)
  useEffect(() => {
    if (user?.id && debouncedCategorySearch !== '') {
      setCategoryPage(1);
      loadCategories(1, true, debouncedCategorySearch);
    }
  }, [debouncedCategorySearch, user?.id, loadCategories]);

  useEffect(() => {
    if (user?.id && debouncedSupplierSearch !== '') {
      setSupplierPage(1);
      loadSuppliers(1, true, debouncedSupplierSearch);
    }
  }, [debouncedSupplierSearch, user?.id, loadSuppliers]);

  useEffect(() => {
    loadProducts();
    // Clear selection when filters or page change
    setSelectedProducts(new Set());
  }, [loadProducts]);

  // PERFORMANCE FIX: Lazy load currency conversions only for visible rows
  // Load initial batch (first 20 products) and load more as user scrolls
  const [loadedCurrencyRange, setLoadedCurrencyRange] = useState({ start: 0, end: 20 });
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const loadingCurrenciesRef = useRef<Set<number>>(new Set());

  // Load currencies for a specific range of products
  const loadCurrenciesForRange = useCallback(async (start: number, end: number) => {
    if (products.length === 0) return;

    const range = products.slice(start, Math.min(end, products.length));
    
    // Check which products need loading (use functional state update to avoid dependency)
    setProductDualCurrencies((prevCurrencies) => {
      const productsToLoad = range.filter(
        p => !prevCurrencies[p.id] && !loadingCurrenciesRef.current.has(p.id)
      );
      
      if (productsToLoad.length === 0) return prevCurrencies;

      // Mark products as loading
      productsToLoad.forEach(p => loadingCurrenciesRef.current.add(p.id));

      // Load currencies asynchronously
      (async () => {
        try {
          const { getCachedConversion, setCachedConversion } = await import('../../utils/currencyCache');
          
          const currencyPromises = productsToLoad.map(async (product) => {
            try {
              // Check cache first
              let priceDual = getCachedConversion(product.price, product.currency || 'USD');
              if (!priceDual) {
                priceDual = await CurrencyService.getDualCurrencyAmounts(
                  product.price,
                  product.currency || 'USD'
                );
                setCachedConversion(product.price, product.currency || 'USD', priceDual);
              }

              let costPriceDual;
              if (product.costPrice) {
                costPriceDual = getCachedConversion(product.costPrice, product.currency || 'USD');
                if (!costPriceDual) {
                  costPriceDual = await CurrencyService.getDualCurrencyAmounts(
                    product.costPrice,
                    product.currency || 'USD'
                  );
                  setCachedConversion(product.costPrice, product.currency || 'USD', costPriceDual);
                }
              }

              return {
                productId: product.id,
                price: priceDual,
                costPrice: costPriceDual,
              };
            } catch (error) {
              console.error(`Error loading currency for product ${product.id}:`, error);
              return null;
            } finally {
              loadingCurrenciesRef.current.delete(product.id);
            }
          });

          // Execute all currency conversions in parallel
          const results = await Promise.all(currencyPromises);
          
          // Update state with new currencies
          setProductDualCurrencies((prev) => {
            const updated = { ...prev };
            results.forEach((result) => {
              if (result) {
                updated[result.productId] = {
                  price: result.price,
                  ...(result.costPrice && { costPrice: result.costPrice }),
                };
              }
            });
            return updated;
          });
        } catch (error) {
          console.error('Error loading currencies:', error);
          productsToLoad.forEach(p => loadingCurrenciesRef.current.delete(p.id));
        }
      })();

      return prevCurrencies; // Return unchanged state immediately
    });
  }, [products]);

  // Load initial batch of currencies when products change
  const productsKey = useMemo(
    () => products.map(p => p.id).join(','),
    [products]
  );

  useEffect(() => {
    if (products.length > 0) {
      loadCurrenciesForRange(0, 20);
      setLoadedCurrencyRange({ start: 0, end: 20 });
    } else {
      setProductDualCurrencies({});
      setLoadedCurrencyRange({ start: 0, end: 20 });
    }
  }, [productsKey, products.length, loadCurrenciesForRange]);

  // Handle scroll to load more currencies
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
      
      // Load next batch when user scrolls past 80% of the table
      if (scrollPercentage > 0.8 && loadedCurrencyRange.end < products.length) {
        const nextEnd = Math.min(loadedCurrencyRange.end + 20, products.length);
        if (nextEnd > loadedCurrencyRange.end) {
          loadCurrenciesForRange(loadedCurrencyRange.end, nextEnd);
          setLoadedCurrencyRange({ start: 0, end: nextEnd });
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [products.length, loadedCurrencyRange, loadCurrenciesForRange]);

  const handleDeleteClick = useCallback((product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!selectedProduct || !user?.id) return;

    setDeleting(true);
    try {
      const result = await ProductService.deleteProduct(selectedProduct.id, user.id);
      if (result.success) {
        showToast('Product deleted successfully', 'success');
        setDeleteDialogOpen(false);
        setSelectedProduct(null);
        loadProducts();
      } else {
        showToast(result.error || 'Failed to delete product', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setDeleting(false);
    }
  }, [selectedProduct, user?.id, loadProducts, showToast]);

  const handleDeleteDialogClose = useCallback(() => {
    setDeleteDialogOpen(false);
    setSelectedProduct(null);
  }, []);

  const handleSelectProduct = useCallback((productId: number) => {
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedProducts((prev) => {
      if (prev.size === products.length) {
        return new Set();
      } else {
        return new Set(products.map((p) => p.id));
      }
    });
  }, [products]);

  const handleBulkDelete = useCallback(() => {
    if (selectedProducts.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedProducts.size]);

  const confirmBulkDelete = useCallback(async () => {
    if (!user?.id || selectedProducts.size === 0) return;

    const selectedIds = Array.from(selectedProducts);

    setDeleting(true);
    try {
      // PERFORMANCE FIX: Use batch delete instead of deleting one by one
      // This reduces IPC calls from N to 1 and improves performance 5-10x
      const result = await ProductService.bulkDeleteProducts(selectedIds, user.id);
      
      if (result.success && result.successCount !== undefined) {
        // Update UI
        setProducts((prev) => prev.filter((p) => !selectedProducts.has(p.id)));
        setTotal((prev) => prev - result.successCount!);
        setSelectedProducts(new Set());
        
        const message = result.failedCount && result.failedCount > 0
          ? `Deleted ${result.successCount} product${result.successCount !== 1 ? 's' : ''}, ${result.failedCount} failed`
          : `Successfully deleted ${result.successCount} product${result.successCount !== 1 ? 's' : ''}`;
        showToast(message, result.failedCount && result.failedCount > 0 ? 'warning' : 'success');
      } else {
        showToast(result.error || 'Failed to delete products', 'error');
      }
    } catch (error) {
      console.error('Error deleting products:', error);
      showToast('Failed to delete products', 'error');
    } finally {
      setDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  }, [user?.id, selectedProducts, showToast]);

  const handleBulkDeleteDialogClose = useCallback(() => {
    if (!deleting) {
      setBulkDeleteDialogOpen(false);
    }
  }, [deleting]);

  const handleEdit = useCallback((product: Product) => {
    navigate(`${ROUTES.PRODUCTS}/edit/${product.id}`);
  }, [navigate]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0); // Reset to first page when searching (debounced search will trigger loadProducts)
  }, []);

  const handleView = useCallback((product: Product) => {
    navigate(`${ROUTES.PRODUCTS}/view/${product.id}`);
  }, [navigate]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setCategoryFilter('');
    setSupplierFilter('');
    setSortBy('name');
    setSortOrder('asc');
    setPage(0);
    setCategorySearch('');
    setSupplierSearch('');
  }, []);

  // Memoize category value to prevent unnecessary re-renders
  const categoryValue = useMemo(() => {
    return categoryFilter ? categories.find((cat) => cat.id === categoryFilter) || null : null;
  }, [categoryFilter, categories]);

  // Memoize supplier value to prevent unnecessary re-renders
  const supplierValue = useMemo(() => {
    return supplierFilter ? suppliers.find((sup) => sup.id === supplierFilter) || null : null;
  }, [supplierFilter, suppliers]);

  // Memoize filter change handlers
  const handleCategoryChange = useCallback((newValue: unknown) => {
    const category = newValue as Category | null;
    setCategoryFilter(category ? category.id : '');
    setPage(0);
  }, []);

  const handleSupplierChange = useCallback((newValue: unknown) => {
    const supplier = newValue as Supplier | null;
    setSupplierFilter(supplier ? supplier.id : '');
    setPage(0);
  }, []);

  const handleSortByChange = useCallback((value: unknown) => {
    setSortBy(value as 'name' | 'barcode' | 'price' | 'createdAt');
  }, []);

  const handleSortOrderChange = useCallback((value: unknown) => {
    setSortOrder(value as 'asc' | 'desc');
  }, []);

  // Memoize category scroll handler
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

  // Memoize supplier scroll handler
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

  // Handle category autocomplete open - clear search and reload all options
  const handleCategoryOpen = useCallback(() => {
    setCategorySearch('');
    setCategoryPage(1);
    loadCategories(1, true, '');
  }, [loadCategories]);

  // Handle supplier autocomplete open - clear search and reload all options
  const handleSupplierOpen = useCallback(() => {
    setSupplierSearch('');
    setSupplierPage(1);
    loadSuppliers(1, true, '');
  }, [loadSuppliers]);

  // Handle category input change - ignore if it matches selected value's name
  const handleCategoryInputChange = useCallback((value: string) => {
    // If the input value matches the selected category's name, clear the search
    // This prevents searching when autocomplete reopens with selected value
    if (categoryValue && (categoryValue as Category).name === value) {
      setCategorySearch('');
    } else {
      setCategorySearch(value);
    }
  }, [categoryValue]);

  // Handle supplier input change - ignore if it matches selected value's name
  const handleSupplierInputChange = useCallback((value: string) => {
    // If the input value matches the selected supplier's name, clear the search
    // This prevents searching when autocomplete reopens with selected value
    if (supplierValue && (supplierValue as Supplier).name === value) {
      setSupplierSearch('');
    } else {
      setSupplierSearch(value);
    }
  }, [supplierValue]);

  // Memoize autocomplete input sx
  const autocompleteInputSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      height: '40px',
      '& fieldset': {
        borderColor: 'rgba(0, 0, 0, 0.23)',
      },
    },
    '& .MuiInputLabel-root': {
      transform: 'translate(14px, 9px) scale(1)',
      '&.MuiInputLabel-shrink': {
        transform: 'translate(14px, -9px) scale(0.75)',
      },
    },
  }), []);

  // Memoize renderInput functions
  const renderCategoryInput = useCallback((params: unknown) => {
    const autocompleteParams = params as {
      InputLabelProps?: Record<string, unknown>;
      InputProps?: {
        endAdornment?: React.ReactNode;
      };
    } & React.ComponentProps<typeof TextField>;
    return (
      <TextField
        {...autocompleteParams}
        label="Category"
        placeholder="All Categories"
        size="small"
        fullWidth
        InputLabelProps={{
          ...autocompleteParams.InputLabelProps,
          shrink: !!categoryValue,
        }}
        InputProps={{
          ...autocompleteParams.InputProps,
          endAdornment: (
            <>
              {categoryLoading && (categories.length === 0 || categorySearch !== '') ? <CircularProgress color="inherit" size={20} /> : null}
              {autocompleteParams.InputProps?.endAdornment}
            </>
          ),
        }}
        sx={autocompleteInputSx}
      />
    );
  }, [categoryLoading, categories.length, categorySearch, categoryValue, autocompleteInputSx]);

  const renderSupplierInput = useCallback((params: unknown) => {
    const autocompleteParams = params as {
      InputLabelProps?: Record<string, unknown>;
      InputProps?: {
        endAdornment?: React.ReactNode;
      };
    } & React.ComponentProps<typeof TextField>;
    return (
      <TextField
        {...autocompleteParams}
        label="Supplier"
        placeholder="All Suppliers"
        size="small"
        fullWidth
        InputLabelProps={{
          ...autocompleteParams.InputLabelProps,
          shrink: !!supplierValue,
        }}
        InputProps={{
          ...autocompleteParams.InputProps,
          endAdornment: (
            <>
              {supplierLoading && (suppliers.length === 0 || supplierSearch !== '') ? <CircularProgress color="inherit" size={20} /> : null}
              {autocompleteParams.InputProps?.endAdornment}
            </>
          ),
        }}
        sx={autocompleteInputSx}
      />
    );
  }, [supplierLoading, suppliers.length, supplierSearch, supplierValue, autocompleteInputSx]);

  // Memoize fields array to prevent unnecessary re-renders
  const filterFields = useMemo((): FilterField[] => [
    {
      type: 'autocomplete' as const,
      label: 'Category',
      placeholder: 'All Categories',
      value: categoryValue,
      onChange: handleCategoryChange,
      autocompleteOptions: categories,
      getOptionLabel: (option: unknown) => (option as Category).name || '',
      isOptionEqualToValue: (option: unknown, value: unknown) => (option as Category).id === (value as Category).id,
      loading: categoryLoading && (categories.length === 0 || categorySearch !== ''),
      onInputChange: handleCategoryInputChange,
      onOpen: handleCategoryOpen,
      renderInput: renderCategoryInput,
      ListboxProps: {
        onScroll: handleCategoryScroll,
        style: { maxHeight: 300 },
      },
      noOptionsText: 'No categories found',
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'autocomplete' as const,
      label: 'Supplier',
      placeholder: 'All Suppliers',
      value: supplierValue,
      onChange: handleSupplierChange,
      autocompleteOptions: suppliers,
      getOptionLabel: (option: unknown) => (option as Supplier).name || '',
      isOptionEqualToValue: (option: unknown, value: unknown) => (option as Supplier).id === (value as Supplier).id,
      loading: supplierLoading && (suppliers.length === 0 || supplierSearch !== ''),
      onInputChange: handleSupplierInputChange,
      onOpen: handleSupplierOpen,
      renderInput: renderSupplierInput,
      ListboxProps: {
        onScroll: handleSupplierScroll,
        style: { maxHeight: 300 },
      },
      noOptionsText: 'No suppliers found',
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'select' as const,
      label: 'Sort By',
      value: sortBy,
      onChange: handleSortByChange,
      options: [
        { value: 'name', label: 'Name' },
        { value: 'barcode', label: 'Barcode' },
        { value: 'price', label: 'Price' },
        { value: 'createdAt', label: 'Date Created' },
      ],
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'select' as const,
      label: 'Order',
      value: sortOrder,
      onChange: handleSortOrderChange,
      options: [
        { value: 'asc', label: 'Ascending' },
        { value: 'desc', label: 'Descending' },
      ],
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
  ], [
    categoryValue,
    categories,
    categoryLoading,
    categorySearch,
    supplierValue,
    suppliers,
    supplierLoading,
    supplierSearch,
    sortBy,
    sortOrder,
    handleCategoryChange,
    handleSupplierChange,
    handleSortByChange,
    handleSortOrderChange,
    handleCategoryScroll,
    handleSupplierScroll,
    handleCategoryOpen,
    handleSupplierOpen,
    handleCategoryInputChange,
    handleSupplierInputChange,
    renderCategoryInput,
    renderSupplierInput,
  ]);

  const handleAddProduct = useCallback(() => {
    navigate(ROUTES.PRODUCTS_NEW);
  }, [navigate]);

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPageSize(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  // Memoize sx prop objects to avoid recreation on every render
  const containerBoxSx = useMemo(() => ({
    p: 3,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const headerBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 3,
    flexWrap: 'wrap',
    gap: 2,
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: { xs: '20px', sm: '24px', md: '28px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const refreshButtonSx = useMemo(() => ({
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

  const addButtonSx = useMemo(() => ({
    backgroundColor: '#1a237e',
    color: '#ffffff',
    borderRadius: 0,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    padding: '8px 20px',
    minHeight: '44px',
    border: '1px solid #000051',
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: '#534bae',
      boxShadow: 'none',
    },
    '&:active': {
      backgroundColor: '#000051',
    },
  }), []);

  const tableContainerSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    p: 4,
  }), []);

  const tableSx = useMemo(() => ({
    '& .MuiTableCell-root': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      borderColor: '#e0e0e0',
      padding: '12px 16px',
    },
    '& .MuiTableHead-root .MuiTableCell-root': {
      fontWeight: 600,
      backgroundColor: '#f5f5f5',
    },
    '& .MuiTableRow-root:hover': {
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const paginationSx = useMemo(() => ({
    '& .MuiTablePagination-toolbar': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography variant="h4" component="h1" sx={titleTypographySx}>
            Products
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
          {selectedProducts.size > 0 && canDelete && (
            <Tooltip title={`Delete Selected Products - Permanently delete ${selectedProducts.size} selected product(s). This action cannot be undone.`}>
              <Button
                variant="contained"
                color="error"
                startIcon={<Delete />}
                onClick={handleBulkDelete}
                sx={{
                  fontSize: '16px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  textTransform: 'none',
                  borderRadius: 0,
                  backgroundColor: '#d32f2f',
                  padding: '8px 20px',
                  minHeight: '44px',
                  '&:hover': {
                    backgroundColor: '#c62828',
                  },
                }}
              >
                Delete Selected ({selectedProducts.size})
              </Button>
            </Tooltip>
          )}
            <Tooltip title="Refresh Products - Reload the product list to get the latest data from the database.">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<Refresh sx={{ fontSize: '18px' }} />}
                  onClick={loadProducts}
                  disabled={loading}
                  sx={refreshButtonSx}
                >
                  Refresh
                </Button>
              </span>
            </Tooltip>
            {canCreate && (
              <Tooltip title="Add Product - Create a new product with details like name, price, barcode, category, and supplier information.">
                <span>
                  <Button
                    variant="contained"
                    startIcon={<Add sx={{ fontSize: '18px' }} />}
                    onClick={handleAddProduct}
                    sx={addButtonSx}
                  >
                    Add Product
                  </Button>
                </span>
              </Tooltip>
            )}
          </Box>
        </Box>

        <FilterHeader
          searchPlaceholder="Search products..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          onClear={handleClearFilters}
          fields={filterFields}
        />

        <TableContainer component={Paper} sx={tableContainerSx} ref={tableContainerRef}>
          {loading ? (
            <Box sx={loadingBoxSx}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Table sx={tableSx}>
                <TableHead>
                  <TableRow>
                    {canDelete && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedProducts.size > 0 && selectedProducts.size < products.length}
                          checked={products.length > 0 && selectedProducts.size === products.length}
                          onChange={handleSelectAll}
                          sx={{
                            color: '#1a237e',
                            '&.Mui-checked': {
                              color: '#1a237e',
                            },
                          }}
                        />
                      </TableCell>
                    )}
                    <TableCell>Barcode</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Cost Price</TableCell>
                    <TableCell>Supplier</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <VirtualizedTableBody
                  items={products}
                  renderRow={(product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      dualCurrency={productDualCurrencies[product.id]}
                      onView={handleView}
                      onEdit={handleEdit}
                      onDelete={handleDeleteClick}
                      selected={selectedProducts.has(product.id)}
                      onSelect={handleSelectProduct}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                    />
                  )}
                  emptyMessage="No products found"
                  emptyColSpan={canDelete ? 9 : 8}
                  rowHeight={80}
                  overscan={5}
                  tableContainerRef={tableContainerRef}
                />
              </Table>
              <TablePagination
                component="div"
                count={total}
                page={page}
                onPageChange={handlePageChange}
                rowsPerPage={pageSize}
                onRowsPerPageChange={handlePageSizeChange}
                rowsPerPageOptions={[10, 20, 50, 100]}
                sx={paginationSx}
              />
            </>
          )}
        </TableContainer>
      </Box>
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Product"
        message={`Are you sure you want to delete "${selectedProduct?.name}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={handleDeleteDialogClose}
        confirmColor="error"
        loading={deleting}
      />
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onCancel={handleBulkDeleteDialogClose}
        onConfirm={confirmBulkDelete}
        title="Delete Products"
        message={`Are you sure you want to delete ${selectedProducts.size} product${selectedProducts.size > 1 ? 's' : ''}?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={deleting}
      />
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default ProductList;