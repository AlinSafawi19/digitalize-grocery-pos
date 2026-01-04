import React, { useState, useEffect, useCallback } from 'react';
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
  CircularProgress,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Add, Delete, ArrowBack } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import {
  StockTransferService,
  CreateStockTransferInput,
} from '../../services/stock-transfer.service';
import { LocationService, Location } from '../../services/location.service';
import { ProductService, Product } from '../../services/product.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

interface StockTransferItemInput {
  productId: number | null;
  productName: string;
  quantity: number;
  notes: string;
}

const StockTransferForm: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [fromLocationId, setFromLocationId] = useState<number | null>(null);
  const [toLocationId, setToLocationId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<StockTransferItemInput[]>([
    { productId: null, productName: '', quantity: 0, notes: '' },
  ]);

  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const loadLocations = useCallback(async () => {
    try {
      // Ensure default location exists
      if (user?.id) {
        await LocationService.ensureDefault(user.id);
      }
      const result = await LocationService.getAll(true);
      setLocations(result);
    } catch (error) {
      console.error('Error loading locations', error);
    }
  }, [user?.id]);

  const loadProducts = useCallback(async (search: string) => {
    if (!user?.id) return;
    try {
      const result = await ProductService.getProducts({ search, page: 1, pageSize: 50 }, user.id);
      if (result.success && result.products) {
        setProducts(result.products);
      }
    } catch (error) {
      console.error('Error loading products', error);
    }
  }, [user?.id]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    if (productSearch) {
      loadProducts(productSearch);
    }
  }, [productSearch, loadProducts]);

  const handleAddItem = () => {
    setItems([...items, { productId: null, productName: '', quantity: 0, notes: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof StockTransferItemInput, value: string | number | null) => {
    const newItems = [...items];
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      newItems[index] = {
        ...newItems[index],
        productId: value,
        productName: product?.name || '',
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  const validateForm = (): boolean => {
    if (!fromLocationId || !toLocationId) {
      showToast('Please select both source and destination locations', 'error');
      return false;
    }

    if (fromLocationId === toLocationId) {
      showToast('Source and destination locations cannot be the same', 'error');
      return false;
    }

    if (items.length === 0 || items.every((item) => !item.productId || item.quantity <= 0)) {
      showToast('Please add at least one item with a product and quantity', 'error');
      return false;
    }

    for (const item of items) {
      if (!item.productId) {
        showToast('Please select a product for all items', 'error');
        return false;
      }
      if (item.quantity <= 0) {
        showToast('Quantity must be greater than 0', 'error');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !user?.id) return;

    setLoading(true);
    try {
      const input: CreateStockTransferInput = {
        fromLocationId: fromLocationId!,
        toLocationId: toLocationId!,
        notes: notes || undefined,
        items: items
          .filter((item) => item.productId && item.quantity > 0)
          .map((item) => ({
            productId: item.productId!,
            quantity: item.quantity,
            notes: item.notes || undefined,
          })),
      };

      const result = await StockTransferService.create(input, user.id);
      if (result.success && result.transfer) {
        showToast('Stock transfer created successfully', 'success');
        navigate(`/stock-transfers/${result.transfer.id}`);
      } else {
        showToast(result.error || 'Failed to create stock transfer', 'error');
      }
    } catch (error) {
      console.error('Error creating stock transfer', error);
      showToast('Failed to create stock transfer', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/stock-transfers')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" fontWeight="bold">
            New Stock Transfer
          </Typography>
        </Box>

        <Paper sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>From Location *</InputLabel>
                <Select
                  value={fromLocationId || ''}
                  label="From Location *"
                  onChange={(e) => setFromLocationId(e.target.value ? Number(e.target.value) : null)}
                >
                  {locations.map((loc) => (
                    <MenuItem key={loc.id} value={loc.id}>
                      {loc.name} {loc.code && `(${loc.code})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>To Location *</InputLabel>
                <Select
                  value={toLocationId || ''}
                  label="To Location *"
                  onChange={(e) => setToLocationId(e.target.value ? Number(e.target.value) : null)}
                >
                  {locations.map((loc) => (
                    <MenuItem key={loc.id} value={loc.id}>
                      {loc.name} {loc.code && `(${loc.code})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this transfer..."
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Items</Typography>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddItem}
                  size="small"
                >
                  Add Item
                </Button>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell width="150">Quantity</TableCell>
                      <TableCell>Notes</TableCell>
                      <TableCell width="80">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Autocomplete
                            options={products}
                            getOptionLabel={(option) => option.name}
                            value={products.find((p) => p.id === item.productId) || null}
                            onChange={(_, newValue) =>
                              handleItemChange(index, 'productId', newValue?.id || null)
                            }
                            onInputChange={(_, newInputValue) => setProductSearch(newInputValue)}
                            renderInput={(params) => (
                              <TextField {...params} placeholder="Search product..." size="small" />
                            )}
                            sx={{ minWidth: 250 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) =>
                              handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)
                            }
                            inputProps={{ min: 0, step: 0.01 }}
                            size="small"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={item.notes}
                            onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                            placeholder="Optional notes"
                            size="small"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveItem(index)}
                            disabled={items.length === 1}
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
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button variant="outlined" onClick={() => navigate('/stock-transfers')}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={loading}
                  sx={{ backgroundColor: '#1a237e', '&:hover': { backgroundColor: '#283593' } }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Create Transfer'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        <Toast toast={toast} onClose={hideToast} />
      </Box>
    </MainLayout>
  );
};

export default StockTransferForm;

