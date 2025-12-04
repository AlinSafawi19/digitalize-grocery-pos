import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Chip,
  Divider,
} from '@mui/material';
import { ArrowBack, Inventory } from '@mui/icons-material';
import { useAppSelector } from '../../store/hooks';
import {
  PurchaseOrderService,
  PurchaseOrder,
  ReceiveGoodsInput,
} from '../../services/purchase-order.service';
import MainLayout from '../../components/layout/MainLayout';
import { formatDate, fromBeirutToUTC } from '../../utils/dateUtils';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

// Move formatCurrency outside component to avoid recreating on each render
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (amount: number) => currencyFormatter.format(amount);

// Memoized table row component to prevent unnecessary re-renders
interface ReceivingItemRowProps {
  item: ReceivingItem;
  onQuantityChange: (itemId: number, value: number) => void;
  onExpiryDateChange: (itemId: number, value: Date | null) => void;
}

// Memoize sx prop objects for ReceivingItemRow
const productNameTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const productCodeTypographySx = {
  fontSize: '11px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#616161',
};

const quantityTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const receivedQuantityTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#616161',
};

const unitPriceTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const chipSx = {
  fontSize: '11px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontWeight: 500,
};

const quantityTextFieldSx = {
  width: 120,
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
};

const datePickerTextFieldSx = {
  width: 180,
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
};

const dashTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#616161',
};

const ReceivingItemRow = memo(({ item, onQuantityChange, onExpiryDateChange }: ReceivingItemRowProps) => {
  const remaining = item.orderedQuantity - item.currentReceived;

  const remainingQuantitySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: remaining > 0 ? '#1a237e' : '#2e7d32',
    fontWeight: remaining > 0 ? 600 : 400,
  }), [remaining]);

  return (
    <TableRow hover>
      <TableCell>
        <Box>
          <Typography variant="body2" fontWeight="medium" sx={productNameTypographySx}>
            {item.productName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={productCodeTypographySx}>
            {item.productCode}
          </Typography>
        </Box>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" sx={quantityTypographySx}>
          {item.orderedQuantity.toFixed(2)} {item.unit}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" color="text.secondary" sx={receivedQuantityTypographySx}>
          {item.currentReceived.toFixed(2)} {item.unit}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" sx={remainingQuantitySx}>
          {remaining.toFixed(2)} {item.unit}
        </Typography>
      </TableCell>
      <TableCell>
        {remaining > 0 ? (
          <TextField
            type="number"
            value={item.newReceivedQuantity}
            onChange={(e) => onQuantityChange(item.itemId, parseFloat(e.target.value) || 0)}
            inputProps={{
              min: 0,
              max: remaining,
              step: 0.01,
            }}
            size="small"
            sx={quantityTextFieldSx}
            error={item.newReceivedQuantity > remaining || item.newReceivedQuantity < 0}
            helperText={item.newReceivedQuantity > remaining ? `Max: ${remaining.toFixed(2)}` : ''}
          />
        ) : (
          <Chip label="Fully Received" size="small" color="success" sx={chipSx} />
        )}
      </TableCell>
      <TableCell>
        {remaining > 0 && item.newReceivedQuantity > 0 ? (
          <DatePicker
            value={item.expiryDate}
            onChange={(newValue) => onExpiryDateChange(item.itemId, newValue)}
            slotProps={{
              textField: {
                size: 'small',
                sx: datePickerTextFieldSx,
                helperText: 'Optional',
              },
            }}
          />
        ) : (
          <Typography variant="body2" color="text.secondary" sx={dashTypographySx}>
            -
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" sx={unitPriceTypographySx}>
          {formatCurrency(item.unitPrice)}
        </Typography>
      </TableCell>
    </TableRow>
  );
});

ReceivingItemRow.displayName = 'ReceivingItemRow';

interface ReceivingItem {
  itemId: number;
  productName: string;
  productCode: string;
  orderedQuantity: number;
  receivedQuantity: number;
  currentReceived: number;
  newReceivedQuantity: number;
  unit: string;
  unitPrice: number;
  expiryDate: Date | null; // Date object for the expiry date picker
}

const ReceiveGoods: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receivingItems, setReceivingItems] = useState<ReceivingItem[]>([]);

  const loadPurchaseOrder = useCallback(async () => {
    if (!id || !user?.id) return;

    setLoading(true);

    try {
      const orderId = parseInt(id, 10);
      if (isNaN(orderId)) {
        showToast('Invalid purchase order ID', 'error');
        return;
      }

      const result = await PurchaseOrderService.getPurchaseOrderById(orderId, user.id);
      if (result.success && result.purchaseOrder) {
        const order = result.purchaseOrder;
        setPurchaseOrder(order);

        // Initialize receiving items
        const items: ReceivingItem[] = order.items.map((item) => {
          const remaining = item.quantity - item.receivedQuantity;
          return {
            itemId: item.id,
            productName: item.product.name,
            productCode: item.product.code,
            orderedQuantity: item.quantity,
            receivedQuantity: item.receivedQuantity,
            currentReceived: item.receivedQuantity,
            newReceivedQuantity: remaining > 0 ? remaining : 0, // Default to remaining quantity
            unit: item.product.unit,
            unitPrice: item.unitPrice,
            expiryDate: null, // Initialize with no expiry date
          };
        });
        setReceivingItems(items);
      } else {
        showToast(result.error || 'Failed to load purchase order', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, showToast]);

  useEffect(() => {
    loadPurchaseOrder();
  }, [loadPurchaseOrder]);

  const handleQuantityChange = useCallback((itemId: number, value: number) => {
    setReceivingItems((prev) =>
      prev.map((item) => {
        if (item.itemId === itemId) {
          const remaining = item.orderedQuantity - item.currentReceived;
          const newValue = Math.max(0, Math.min(value, remaining)); // Clamp between 0 and remaining
          return { ...item, newReceivedQuantity: newValue };
        }
        return item;
      })
    );
  }, []);

  const handleExpiryDateChange = useCallback((itemId: number, value: Date | null) => {
    setReceivingItems((prev) =>
      prev.map((item) => {
        if (item.itemId === itemId) {
          return { ...item, expiryDate: value };
        }
        return item;
      })
    );
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !purchaseOrder) return;

    // Filter items that have quantity > 0
    const itemsToReceive = receivingItems.filter((item) => item.newReceivedQuantity > 0);

    if (itemsToReceive.length === 0) {
      showToast('Please enter quantities for at least one item', 'error');
      return;
    }

    setSaving(true);

    try {
      const input: ReceiveGoodsInput = {
        items: itemsToReceive.map((item) => ({
          itemId: item.itemId,
          receivedQuantity: item.newReceivedQuantity,
          expiryDate: item.expiryDate ? fromBeirutToUTC(item.expiryDate) : null,
        })),
      };

      const result = await PurchaseOrderService.receiveGoods(purchaseOrder.id, input, user.id);
      if (result.success) {
        showToast('Goods received successfully', 'success');
        setTimeout(() => {
          navigate(`/purchase-orders/${purchaseOrder.id}`);
        }, 1000);
      } else {
        showToast(result.error || 'Failed to receive goods', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setSaving(false);
    }
  }, [user?.id, purchaseOrder, receivingItems, navigate, showToast]);

  // Memoize total calculation to avoid recalculating on every render
  // Must be called before any early returns to maintain hook order
  const totalItemsToReceive = useMemo(
    () => receivingItems.reduce((sum, item) => sum + item.newReceivedQuantity, 0),
    [receivingItems]
  );

  const totalCost = useMemo(
    () => receivingItems.reduce((sum, item) => sum + (item.newReceivedQuantity * item.unitPrice), 0),
    [receivingItems]
  );

  const handleBack = useCallback(() => {
    if (purchaseOrder) {
      navigate(`/purchase-orders/${purchaseOrder.id}`);
    }
  }, [purchaseOrder, navigate]);

  const handleCancel = useCallback(() => {
    if (purchaseOrder) {
      navigate(`/purchase-orders/${purchaseOrder.id}`);
    }
  }, [purchaseOrder, navigate]);

  const handleNavigateToPurchaseOrders = useCallback(() => {
    navigate('/purchase-orders');
  }, [navigate]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    backgroundColor: '#f5f5f5',
  }), []);

  const emptyContainerBoxSx = useMemo(() => ({
    p: 2,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const backButtonSx = useMemo(() => ({
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
  }), []);

  const containerBoxSx = useMemo(() => ({
    p: 3,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const headerBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    mb: 3,
  }), []);

  const backIconButtonSx = useMemo(() => ({
    mr: 2,
    color: '#1a237e',
    '&:hover': {
      backgroundColor: '#e3f2fd',
    },
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: { xs: '20px', sm: '24px', md: '28px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const subtitleTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const cardSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const orderInfoHeaderBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    mb: 2,
  }), []);

  const sectionTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 600,
  }), []);

  const dividerSx = useMemo(() => ({
    mb: 2,
    borderColor: '#e0e0e0',
  }), []);

  const labelTypographySx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
    mb: 0.5,
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
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

  const summaryBoxSx = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  }), []);

  const summaryRowBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }), []);

  const summaryLabelTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 600,
  }), []);

  const summaryValueTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const summaryCostTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#2e7d32',
  }), []);

  const summaryDividerSx = useMemo(() => ({
    borderColor: '#e0e0e0',
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

  if (loading) {
    return (
      <MainLayout>
        <Box sx={loadingBoxSx}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (!purchaseOrder) {
    return (
      <MainLayout>
        <Box sx={emptyContainerBoxSx}>
          <Button
            startIcon={<ArrowBack sx={{ fontSize: '18px' }} />}
            onClick={handleNavigateToPurchaseOrders}
            sx={backButtonSx}
            variant="outlined"
          >
            Back to Purchase Orders
          </Button>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <IconButton onClick={handleBack} sx={backIconButtonSx}>
            <ArrowBack sx={{ fontSize: '20px' }} />
          </IconButton>
          <Box>
            <Typography variant="h4" fontWeight="bold" sx={titleTypographySx}>
              Receive Goods
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={subtitleTypographySx}>
              Order: {purchaseOrder.orderNumber}
            </Typography>
          </Box>
        </Box>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Order Summary */}
            <Grid item xs={12}>
              <Card sx={cardSx}>
                <CardContent>
                  <Box sx={orderInfoHeaderBoxSx}>
                    <Inventory sx={{ fontSize: '20px', color: '#1a237e' }} />
                    <Typography variant="h6" sx={sectionTitleTypographySx}>
                      Order Information
                    </Typography>
                  </Box>
                  <Divider sx={dividerSx} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                        Supplier
                      </Typography>
                      <Typography variant="body1" sx={bodyTypographySx}>
                        {purchaseOrder.supplier.name}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                        Order Date
                      </Typography>
                      <Typography variant="body1" sx={bodyTypographySx}>
                        {formatDate(purchaseOrder.orderDate)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                        Expected Date
                      </Typography>
                      <Typography variant="body1" sx={bodyTypographySx}>
                        {purchaseOrder.expectedDate ? formatDate(purchaseOrder.expectedDate) : '-'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Receiving Items Table */}
            <Grid item xs={12}>
              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                    Items to Receive
                  </Typography>
                  <Divider sx={dividerSx} />
                  <TableContainer>
                    <Table sx={tableSx}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell align="right">Ordered</TableCell>
                          <TableCell align="right">Already Received</TableCell>
                          <TableCell align="right">Remaining</TableCell>
                          <TableCell align="right">Receive Quantity</TableCell>
                          <TableCell>Expiry Date</TableCell>
                          <TableCell align="right">Unit Price</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {receivingItems.map((item) => (
                          <ReceivingItemRow
                            key={item.itemId}
                            item={item}
                            onQuantityChange={handleQuantityChange}
                            onExpiryDateChange={handleExpiryDateChange}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Summary */}
            <Grid item xs={12}>
              <Card sx={cardSx}>
                <CardContent>
                  <Box sx={summaryBoxSx}>
                    <Box sx={summaryRowBoxSx}>
                      <Typography variant="h6" sx={summaryLabelTypographySx}>
                        Total Items to Receive
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" sx={summaryValueTypographySx}>
                        {totalItemsToReceive.toFixed(2)}
                      </Typography>
                    </Box>
                    <Divider sx={summaryDividerSx} />
                    <Box sx={summaryRowBoxSx}>
                      <Typography variant="h6" sx={summaryLabelTypographySx}>
                        Total Cost
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" sx={summaryCostTypographySx}>
                        {formatCurrency(totalCost)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Actions */}
            <Grid item xs={12}>
              <Box sx={actionsBoxSx}>
                <Button
                  variant="outlined"
                  onClick={handleCancel}
                  disabled={saving}
                  sx={cancelButtonSx}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving || totalItemsToReceive === 0}
                  sx={submitButtonSx}
                >
                  {saving ? 'Receiving...' : 'Receive Goods'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default ReceiveGoods;

