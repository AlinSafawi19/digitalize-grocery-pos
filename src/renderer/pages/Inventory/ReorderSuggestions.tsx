import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Refresh,
  AddShoppingCart,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  ReorderSuggestionService,
  ReorderSuggestion,
  ReorderSuggestionOptions,
  ReorderSuggestionSummary,
} from '../../services/reorder-suggestion.service';
import { CategoryService } from '../../services/category.service';
import { SupplierService } from '../../services/supplier.service';
import { PurchaseOrderService, CreatePurchaseOrderInput } from '../../services/purchase-order.service';
import { ProductService } from '../../services/product.service';
import { Category } from '../../services/product.service';
import { Supplier } from '../../services/product.service';
import { useToast } from '../../hooks/useToast';
import MainLayout from '../../components/layout/MainLayout';
import { ROUTES } from '../../utils/constants';
import { usePermission } from '../../hooks/usePermission';

export default function ReorderSuggestions() {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { showToast } = useToast();
  const canCreatePurchaseOrders = usePermission('purchase_orders.create');

  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [summary, setSummary] = useState<ReorderSuggestionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [creatingPO, setCreatingPO] = useState(false);

  // Filters
  const [urgencyFilter, setUrgencyFilter] = useState<
    ('critical' | 'high' | 'medium' | 'low')[]
  >(['critical', 'high']);
  const [supplierFilter, setSupplierFilter] = useState<number | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [analysisPeriodDays, setAnalysisPeriodDays] = useState(30);
  const [safetyStockDays, setSafetyStockDays] = useState(7);

  const loadSuggestions = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const options: ReorderSuggestionOptions = {
        urgencyFilter: urgencyFilter.length > 0 ? urgencyFilter : undefined,
        supplierId: supplierFilter || undefined,
        categoryId: categoryFilter || undefined,
        includeInactive,
        analysisPeriodDays,
        safetyStockDays,
      };

      const [suggestionsResult, summaryResult] = await Promise.all([
        ReorderSuggestionService.getSuggestions(options),
        ReorderSuggestionService.getSummary(options),
      ]);

      if (suggestionsResult.success && suggestionsResult.suggestions) {
        setSuggestions(suggestionsResult.suggestions);
      } else {
        showToast(suggestionsResult.error || 'Failed to load suggestions', 'error');
      }

      if (summaryResult.success && summaryResult.summary) {
        setSummary(summaryResult.summary);
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
    urgencyFilter,
    supplierFilter,
    categoryFilter,
    includeInactive,
    analysisPeriodDays,
    safetyStockDays,
    showToast,
  ]);

  const loadCategories = useCallback(async () => {
    try {
      if (!user?.id) return;
      const result = await CategoryService.getCategoriesList({ page: 1, pageSize: 1000 }, user.id);
      if (result.success && result.categories) {
        setCategories(result.categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, [user?.id]);

  const loadSuppliers = useCallback(async () => {
    try {
      if (!user?.id) return;
      const result = await SupplierService.getSuppliers({ page: 1, pageSize: 1000 }, user.id);
      if (result.success && result.suppliers) {
        setSuppliers(result.suppliers);
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    loadCategories();
    loadSuppliers();
  }, [loadCategories, loadSuppliers]);

  const handleSelectSuggestion = useCallback((productId: number) => {
    setSelectedSuggestions((prev) => {
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
    if (selectedSuggestions.size === suggestions.length) {
      setSelectedSuggestions(new Set());
    } else {
      setSelectedSuggestions(new Set(suggestions.map((s) => s.productId)));
    }
  }, [suggestions, selectedSuggestions.size]);

  const handleCreatePurchaseOrder = useCallback(async () => {
    if (!user?.id || selectedSuggestions.size === 0 || !canCreatePurchaseOrders) {
      return;
    }

    setCreatingPO(true);
    try {
      // Group suggestions by supplier
      const suggestionsBySupplier = new Map<number, ReorderSuggestion[]>();
      for (const suggestion of suggestions) {
        if (selectedSuggestions.has(suggestion.productId) && suggestion.supplierId) {
          if (!suggestionsBySupplier.has(suggestion.supplierId)) {
            suggestionsBySupplier.set(suggestion.supplierId, []);
          }
          suggestionsBySupplier.get(suggestion.supplierId)!.push(suggestion);
        }
      }

      // Filter out suggestions without suppliers
      if (suggestionsBySupplier.size === 0) {
        showToast('Selected products must have suppliers assigned', 'warning');
        setCreatingPO(false);
        return;
      }

      // Create purchase orders for each supplier
      let createdCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const [supplierId, supplierSuggestions] of suggestionsBySupplier.entries()) {
        try {
          // Get product details to get cost prices
          const items = await Promise.all(
            supplierSuggestions.map(async (suggestion) => {
              const productResult = await ProductService.getProductById(
                suggestion.productId,
                user.id
              );

              if (!productResult.success || !productResult.product) {
                throw new Error(`Failed to fetch product ${suggestion.productName}`);
              }

              const product = productResult.product;
              const unitPrice = product.costPrice || product.price || 0;

              if (unitPrice === 0) {
                throw new Error(
                  `Product ${suggestion.productName} has no cost price set. Please set a cost price before creating purchase order.`
                );
              }

              return {
                productId: suggestion.productId,
                quantity: suggestion.recommendedQuantity,
                unitPrice,
              };
            })
          );

          // Create purchase order
          const createPOInput: CreatePurchaseOrderInput = {
            supplierId,
            items,
          };

          const result = await PurchaseOrderService.createPurchaseOrder(
            createPOInput,
            user.id
          );

          if (result.success) {
            createdCount++;
          } else {
            errorCount++;
            errors.push(
              `Supplier ${suppliers.find((s) => s.id === supplierId)?.name || supplierId}: ${result.error || 'Unknown error'}`
            );
          }
        } catch (error) {
          errorCount++;
          const supplierName =
            suppliers.find((s) => s.id === supplierId)?.name || `Supplier ${supplierId}`;
          errors.push(
            `${supplierName}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          console.error(`Error creating PO for supplier ${supplierId}:`, error);
        }
      }

      if (createdCount > 0) {
        showToast(
          `Successfully created ${createdCount} purchase order(s)${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
          createdCount > 0 && errorCount === 0 ? 'success' : 'warning'
        );
        setSelectedSuggestions(new Set());
        loadSuggestions();
        // Navigate to purchase orders page
        navigate(ROUTES.PURCHASE_ORDERS);
      } else {
        showToast(
          `Failed to create purchase orders: ${errors.join('; ')}`,
          'error'
        );
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to create purchase orders',
        'error'
      );
    } finally {
      setCreatingPO(false);
    }
  }, [
    user?.id,
    selectedSuggestions,
    suggestions,
    suppliers,
    canCreatePurchaseOrders,
    showToast,
    loadSuggestions,
    navigate,
  ]);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const containerBoxSx = useMemo(
    () => ({
      p: 3,
      backgroundColor: '#f5f5f5',
      minHeight: '100vh',
    }),
    []
  );

  const headerBoxSx = useMemo(
    () => ({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      mb: 3,
      flexWrap: 'wrap',
      gap: 2,
    }),
    []
  );

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            Reorder Suggestions
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh Suggestions - Reload reorder suggestions based on current stock levels and sales data.">
              <span>
                <IconButton onClick={loadSuggestions} disabled={loading}>
                  <Refresh />
                </IconButton>
              </span>
            </Tooltip>
            {canCreatePurchaseOrders && selectedSuggestions.size > 0 && (
              <Button
                variant="contained"
                startIcon={<AddShoppingCart />}
                onClick={handleCreatePurchaseOrder}
                disabled={creatingPO}
                sx={{
                  backgroundColor: '#1a237e',
                  '&:hover': { backgroundColor: '#534bae' },
                }}
              >
                {creatingPO ? 'Creating...' : `Create PO (${selectedSuggestions.size})`}
              </Button>
            )}
          </Box>
        </Box>

        {/* Summary Cards */}
        {summary && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Suggestions
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {summary.total}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Critical
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="error">
                    {summary.critical}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    High Priority
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {summary.high}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Medium/Low
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {summary.medium + summary.low}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Urgency</InputLabel>
              <Select
                multiple
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value as any)}
                label="Urgency"
              >
                <MenuItem value="critical">Critical</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Supplier</InputLabel>
              <Select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value as number | '')}
                label="Supplier"
              >
                <MenuItem value="">All Suppliers</MenuItem>
                {suppliers.map((supplier) => (
                  <MenuItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as number | '')}
                label="Category"
              >
                <MenuItem value="">All Categories</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Analysis Period (days)"
              type="number"
              value={analysisPeriodDays}
              onChange={(e) => setAnalysisPeriodDays(parseInt(e.target.value) || 30)}
              sx={{ width: 180 }}
            />

            <TextField
              size="small"
              label="Safety Stock (days)"
              type="number"
              value={safetyStockDays}
              onChange={(e) => setSafetyStockDays(parseInt(e.target.value) || 7)}
              sx={{ width: 180 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                />
              }
              label="Include Inactive"
            />
          </Box>
        </Paper>

        {/* Suggestions Table */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {canCreatePurchaseOrders && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedSuggestions.size === suggestions.length && suggestions.length > 0}
                        indeterminate={
                          selectedSuggestions.size > 0 && selectedSuggestions.size < suggestions.length
                        }
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Supplier</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Current Stock</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Reorder Level</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Daily Sales</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Days Remaining</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Recommended Qty</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Urgency</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Confidence</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={canCreatePurchaseOrders ? 11 : 10} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : suggestions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canCreatePurchaseOrders ? 11 : 10} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No reorder suggestions found. All products are well stocked!
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  suggestions.map((suggestion) => (
                    <TableRow key={suggestion.productId} hover>
                      {canCreatePurchaseOrders && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedSuggestions.has(suggestion.productId)}
                            onChange={() => handleSelectSuggestion(suggestion.productId)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {suggestion.productName}
                        </Typography>
                        {suggestion.productCode && (
                          <Typography variant="caption" color="text.secondary">
                            Code: {suggestion.productCode}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{suggestion.category || '-'}</TableCell>
                      <TableCell>{suggestion.supplier || '-'}</TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{
                            color:
                              suggestion.currentStock <= suggestion.reorderLevel
                                ? '#d32f2f'
                                : 'inherit',
                            fontWeight:
                              suggestion.currentStock <= suggestion.reorderLevel ? 600 : 400,
                          }}
                        >
                          {suggestion.currentStock.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{suggestion.reorderLevel.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        {suggestion.averageDailySales.toFixed(2)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{
                            color:
                              suggestion.daysOfStockRemaining <= 3
                                ? '#d32f2f'
                                : suggestion.daysOfStockRemaining <= 7
                                ? '#ed6c02'
                                : 'inherit',
                          }}
                        >
                          {suggestion.daysOfStockRemaining.toFixed(1)} days
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="primary">
                          {suggestion.recommendedQuantity.toFixed(0)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={suggestion.urgency.toUpperCase()}
                          color={getUrgencyColor(suggestion.urgency) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          {suggestion.confidence}%
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {suggestions.length > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Analysis Period:</strong> {analysisPeriodDays} days |{' '}
              <strong>Safety Stock:</strong> {safetyStockDays} days |{' '}
              <strong>Last Updated:</strong> {new Date().toLocaleString()}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Suggestions are based on current stock levels, sales velocity, and reorder points.
              Recommended quantities include safety stock buffer.
            </Typography>
          </Alert>
        )}
      </Box>
    </MainLayout>
  );
}

