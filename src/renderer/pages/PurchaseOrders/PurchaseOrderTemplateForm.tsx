import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Add, Delete, ArrowBack } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { RootState } from '../../store';
import {
  PurchaseOrderTemplateService,
  CreatePurchaseOrderTemplateInput,
  UpdatePurchaseOrderTemplateInput,
  PurchaseOrderTemplate,
} from '../../services/purchase-order-template.service';
import { SupplierService } from '../../services/supplier.service';
import { ProductService, Supplier, Product } from '../../services/product.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { ROUTES } from '../../utils/constants';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (amount: number) => currencyFormatter.format(amount);

interface TemplateItemInput {
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes: string;
  subtotal: number;
}

const PurchaseOrderTemplateForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [template, setTemplate] = useState<PurchaseOrderTemplate | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    supplierId?: string;
    items?: string;
  }>({});

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<TemplateItemInput[]>([]);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const supplierSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const productSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load template if editing
  useEffect(() => {
    if (id && user?.id) {
      setIsEditMode(true);
      setLoadingTemplate(true);
      PurchaseOrderTemplateService.getById(parseInt(id))
        .then((result) => {
          if (result.success && result.template) {
            setTemplate(result.template);
            setName(result.template.name);
            setDescription(result.template.description || '');
            setSupplierId(result.template.supplierId);
            setIsActive(result.template.isActive);
            setItems(
              result.template.items.map((item) => ({
                productId: item.productId,
                productName: item.product.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                notes: item.notes || '',
                subtotal: item.quantity * item.unitPrice,
              }))
            );
          } else {
            showToast(result.error || 'Failed to load template', 'error');
            navigate(ROUTES.PURCHASE_ORDER_TEMPLATES);
          }
        })
        .catch((error) => {
          showToast(
            error instanceof Error ? error.message : 'An error occurred',
            'error'
          );
          navigate(ROUTES.PURCHASE_ORDER_TEMPLATES);
        })
        .finally(() => {
          setLoadingTemplate(false);
        });
    }
  }, [id, user?.id, navigate, showToast]);

  // Load suppliers
  const loadSuppliers = useCallback(
    async (search: string = '') => {
      if (!user?.id) return;

      setSupplierLoading(true);
      try {
        const result = await SupplierService.getSuppliers(
          { page: 1, pageSize: 100, search },
          user.id
        );
        if (result.success && result.suppliers) {
          setSuppliers(result.suppliers);
        }
      } catch (error) {
        console.error('Failed to load suppliers:', error);
      } finally {
        setSupplierLoading(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    if (user?.id) {
      loadSuppliers();
    }
  }, [user?.id, loadSuppliers]);

  // Load products when supplier is selected
  const loadProducts = useCallback(
    async (search: string = '') => {
      if (!user?.id || !supplierId) {
        setProducts([]);
        return;
      }

      setProductLoading(true);
      try {
        const result = await ProductService.getProducts(
          { page: 1, pageSize: 100, search, supplierId },
          user.id
        );
        if (result.success && result.products) {
          setProducts(result.products);
        }
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setProductLoading(false);
      }
    },
    [user?.id, supplierId]
  );

  useEffect(() => {
    if (user?.id && supplierId) {
      loadProducts();
    } else {
      setProducts([]);
      setItems([]);
    }
  }, [user?.id, supplierId, loadProducts]);

  // Debounce supplier search
  useEffect(() => {
    if (supplierSearchTimeoutRef.current) {
      clearTimeout(supplierSearchTimeoutRef.current);
    }
    supplierSearchTimeoutRef.current = setTimeout(() => {
      loadSuppliers(supplierSearch);
    }, 300);

    return () => {
      if (supplierSearchTimeoutRef.current) {
        clearTimeout(supplierSearchTimeoutRef.current);
      }
    };
  }, [supplierSearch, loadSuppliers]);

  // Debounce product search
  useEffect(() => {
    if (productSearchTimeoutRef.current) {
      clearTimeout(productSearchTimeoutRef.current);
    }
    productSearchTimeoutRef.current = setTimeout(() => {
      loadProducts(productSearch);
    }, 300);

    return () => {
      if (productSearchTimeoutRef.current) {
        clearTimeout(productSearchTimeoutRef.current);
      }
    };
  }, [productSearch, loadProducts]);

  const handleAddItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        productId: null,
        productName: '',
        quantity: 1,
        unitPrice: 0,
        notes: '',
        subtotal: 0,
      },
    ]);
  }, []);

  const handleRemoveItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleItemChange = useCallback(
    (index: number, field: keyof TemplateItemInput, value: any) => {
      setItems((prev) => {
        const newItems = [...prev];
        const item = { ...newItems[index] };

        if (field === 'productId') {
          const product = products.find((p) => p.id === value);
          item.productId = value;
          item.productName = product?.name || '';
          item.unitPrice = product?.costPrice || item.unitPrice || 0;
        } else {
          (item as any)[field] = value;
        }

        item.subtotal = item.quantity * item.unitPrice;
        newItems[index] = item;
        return newItems;
      });
    },
    [products]
  );

  const validateForm = useCallback((): boolean => {
    const errors: typeof fieldErrors = {};

    if (!name.trim()) {
      errors.name = 'Template name is required';
    }

    if (!supplierId) {
      errors.supplierId = 'Supplier is required';
    }

    if (items.length === 0) {
      errors.items = 'At least one item is required';
    } else {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.productId) {
          errors.items = 'All items must have a product selected';
          break;
        }
        if (item.quantity <= 0) {
          errors.items = 'All items must have a quantity greater than 0';
          break;
        }
        if (item.unitPrice < 0) {
          errors.items = 'All items must have a valid unit price';
          break;
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [name, supplierId, items]);

  const handleSubmit = useCallback(async () => {
    if (!user?.id || !validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const templateItems = items.map((item) => ({
        productId: item.productId!,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        notes: item.notes || null,
      }));

      if (isEditMode && id) {
        const input: UpdatePurchaseOrderTemplateInput = {
          name,
          description: description || null,
          supplierId: supplierId!,
          isActive,
          items: templateItems,
        };

        const result = await PurchaseOrderTemplateService.update(
          parseInt(id),
          input,
          user.id
        );

        if (result.success) {
          showToast('Template updated successfully', 'success');
          navigate(ROUTES.PURCHASE_ORDER_TEMPLATES);
        } else {
          showToast(result.error || 'Failed to update template', 'error');
        }
      } else {
        const input: CreatePurchaseOrderTemplateInput = {
          name,
          description: description || null,
          supplierId: supplierId!,
          items: templateItems,
        };

        const result = await PurchaseOrderTemplateService.create(input, user.id);

        if (result.success) {
          showToast('Template created successfully', 'success');
          navigate(ROUTES.PURCHASE_ORDER_TEMPLATES);
        } else {
          showToast(result.error || 'Failed to create template', 'error');
        }
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'An error occurred',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [
    user?.id,
    isEditMode,
    id,
    name,
    description,
    supplierId,
    isActive,
    items,
    validateForm,
    navigate,
    showToast,
  ]);

  if (loadingTemplate) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <MainLayout>
      <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            {isEditMode ? 'Edit Template' : 'New Purchase Order Template'}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => navigate(ROUTES.PURCHASE_ORDER_TEMPLATES)}
          >
            Back
          </Button>
        </Box>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Template Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={!!fieldErrors.name}
                helperText={fieldErrors.name}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                options={suppliers}
                getOptionLabel={(option) => option.name}
                loading={supplierLoading}
                value={suppliers.find((s) => s.id === supplierId) || null}
                onChange={(_, newValue) => setSupplierId(newValue?.id || null)}
                onInputChange={(_, newInputValue) => setSupplierSearch(newInputValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Supplier *"
                    error={!!fieldErrors.supplierId}
                    helperText={fieldErrors.supplierId}
                    disabled={loading}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </Grid>
            {isEditMode && (
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      disabled={loading}
                    />
                  }
                  label="Active"
                />
              </Grid>
            )}
          </Grid>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Template Items</Typography>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={handleAddItem}
              disabled={loading || !supplierId}
            >
              Add Item
            </Button>
          </Box>

          {fieldErrors.items && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {fieldErrors.items}
            </Alert>
          )}

          {items.length === 0 ? (
            <Alert severity="info">
              No items added yet. Click "Add Item" to start building your template.
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Quantity</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Unit Price</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Subtotal</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Autocomplete
                          options={products}
                          getOptionLabel={(option) => option.name}
                          loading={productLoading}
                          value={products.find((p) => p.id === item.productId) || null}
                          onChange={(_, newValue) =>
                            handleItemChange(index, 'productId', newValue?.id || null)
                          }
                          onInputChange={(_, newInputValue) => setProductSearch(newInputValue)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Select product"
                              size="small"
                              disabled={loading}
                            />
                          )}
                          sx={{ minWidth: 200 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          size="small"
                          disabled={loading}
                          sx={{ width: 100 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                          size="small"
                          disabled={loading}
                          sx={{ width: 120 }}
                          InputProps={{
                            startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.notes}
                          onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                          size="small"
                          disabled={loading}
                          placeholder="Optional notes"
                          sx={{ width: 150 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(item.subtotal)}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveItem(index)}
                          disabled={loading}
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {items.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Typography variant="h6">
                Total: {formatCurrency(total)}
              </Typography>
            </Box>
          )}
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => navigate(ROUTES.PURCHASE_ORDER_TEMPLATES)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            sx={{
              backgroundColor: '#1a237e',
              '&:hover': { backgroundColor: '#534bae' },
            }}
          >
            {loading ? <CircularProgress size={24} /> : isEditMode ? 'Update Template' : 'Create Template'}
          </Button>
        </Box>

        <Toast toast={toast} onClose={hideToast} />
      </Box>
    </MainLayout>
  );
};

export default PurchaseOrderTemplateForm;

