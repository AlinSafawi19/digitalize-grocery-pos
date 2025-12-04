import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Chip,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Paper,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Inventory,
  CheckCircle,
  Cancel,
  HourglassEmpty,
  Receipt,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  PurchaseOrderService,
  PurchaseOrder,
  PurchaseInvoice,
} from '../../services/purchase-order.service';
import MainLayout from '../../components/layout/MainLayout';
import { AuthState } from '../../store/slices/auth.slice';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

// Move formatCurrency outside component to avoid recreating on each render
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (amount: number) => currencyFormatter.format(amount);

// Status configuration moved outside component
const statusConfig = {
  draft: { color: 'default' as const, label: 'Draft', icon: <Edit fontSize="small" /> },
  pending: { color: 'warning' as const, label: 'Pending', icon: <HourglassEmpty fontSize="small" /> },
  partially_received: {
    color: 'info' as const,
    label: 'Partially Received',
    icon: <Inventory fontSize="small" />,
  },
  received: { color: 'success' as const, label: 'Received', icon: <CheckCircle fontSize="small" /> },
  cancelled: { color: 'error' as const, label: 'Cancelled', icon: <Cancel fontSize="small" /> },
};

// Memoize chip sx to avoid recreation
const chipSx = {
  fontSize: '11px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontWeight: 500,
};

const getStatusChip = (status: PurchaseOrder['status']) => {
  const config = statusConfig[status];
  return (
    <Chip
      icon={config.icon}
      label={config.label}
      size="small"
      color={config.color}
      sx={chipSx}
    />
  );
};

// Memoized table row component to prevent unnecessary re-renders
interface ItemRowProps {
  item: PurchaseOrder['items'][0];
}

// Memoize sx prop objects for ItemRow
const productNameTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const productCodeTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#616161',
};

const quantityTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const unitPriceTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const subtotalTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#1a237e',
};

const ItemRow = memo(({ item }: ItemRowProps) => {
  const isFullyReceived = item.receivedQuantity >= item.quantity;
  const isPartiallyReceived = item.receivedQuantity > 0 && !isFullyReceived;

  const receivedQuantitySx = {
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: isFullyReceived ? '#2e7d32' : '#616161',
    fontWeight: isPartiallyReceived ? 600 : 400,
  };

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight="medium" sx={productNameTypographySx}>
          {item.product.name}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={productCodeTypographySx}>
          {item.product.code}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" sx={quantityTypographySx}>
          {item.quantity.toFixed(2)} {item.product.unit}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" sx={receivedQuantitySx}>
          {item.receivedQuantity.toFixed(2)} {item.product.unit}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" sx={unitPriceTypographySx}>
          {formatCurrency(item.unitPrice)}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight="medium" sx={subtotalTypographySx}>
          {formatCurrency(item.subtotal)}
        </Typography>
      </TableCell>
      <TableCell>
        {isFullyReceived ? (
          <Chip label="Received" size="small" color="success" sx={chipSx} />
        ) : isPartiallyReceived ? (
          <Chip label="Partial" size="small" color="warning" sx={chipSx} />
        ) : (
          <Chip label="Pending" size="small" color="default" sx={chipSx} />
        )}
      </TableCell>
    </TableRow>
  );
});

ItemRow.displayName = 'ItemRow';

// Memoized invoice row component
interface InvoiceRowProps {
  invoice: PurchaseInvoice;
}

// Memoize sx prop objects for InvoiceRow
const invoiceNumberTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const invoiceAmountTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const invoiceDateTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const getInvoiceChipColor = (status: string) => {
  if (status === 'paid') return 'success';
  if (status === 'overdue') return 'error';
  return 'default';
};

const InvoiceRow = memo(({ invoice }: InvoiceRowProps) => {
  const chipColor = getInvoiceChipColor(invoice.status);
  
  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight="medium" sx={invoiceNumberTypographySx}>
          {invoice.invoiceNumber}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" sx={invoiceAmountTypographySx}>
          {formatCurrency(invoice.amount)}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={invoiceDateTypographySx}>
          {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={invoiceDateTypographySx}>
          {invoice.paidDate ? formatDate(invoice.paidDate) : '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip
          label={invoice.status}
          size="small"
          color={chipColor}
          sx={chipSx}
        />
      </TableCell>
    </TableRow>
  );
});

InvoiceRow.displayName = 'InvoiceRow';

const PurchaseOrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState): AuthState => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);

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
        setPurchaseOrder(result.purchaseOrder);
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


  const handleNavigateBack = useCallback(() => {
    navigate('/purchase-orders');
  }, [navigate]);

  const handleReceiveGoods = useCallback(() => {
    if (purchaseOrder) {
      navigate(`/purchase-orders/${purchaseOrder.id}/receive`);
    }
  }, [purchaseOrder, navigate]);

  const handleEdit = useCallback(() => {
    if (purchaseOrder) {
      navigate(`/purchase-orders/edit/${purchaseOrder.id}`);
    }
  }, [purchaseOrder, navigate]);

  // Memoize computed values to avoid recalculating on every render
  const canEdit = useMemo(
    () => purchaseOrder?.status === 'draft' || purchaseOrder?.status === 'pending',
    [purchaseOrder?.status]
  );

  const canReceive = useMemo(
    () => purchaseOrder?.status !== 'received' && purchaseOrder?.status !== 'cancelled',
    [purchaseOrder?.status]
  );

  // Memoize summary calculations
  const summaryStats = useMemo(() => {
    if (!purchaseOrder) {
      return {
        totalItems: 0,
        itemsReceived: 0,
        totalQuantity: 0,
        receivedQuantity: 0,
      };
    }

    const items = purchaseOrder.items;
    return {
      totalItems: items.length,
      itemsReceived: items.filter((item) => item.receivedQuantity >= item.quantity).length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      receivedQuantity: items.reduce((sum, item) => sum + item.receivedQuantity, 0),
    };
  }, [purchaseOrder]);

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
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
  }), []);

  const titleBarLeftBoxSx = useMemo(() => ({
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

  const editButtonSx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    color: '#ffffff',
    padding: '4px 8px',
    minWidth: 'auto',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderColor: 'rgba(255, 255, 255, 0.5)',
    },
  }), []);

  const receiveButtonSx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    backgroundColor: '#ffffff',
    color: '#1a237e',
    padding: '4px 8px',
    minWidth: 'auto',
    '&:hover': {
      backgroundColor: '#e3f2fd',
    },
  }), []);

  const cardSx = useMemo(() => ({
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

  const totalAmountTypographySx = useMemo(() => ({
    fontSize: '18px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const summaryBoxSx = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  }), []);

  const summaryValueTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const summaryValueGreenTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#2e7d32',
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

  const invoicesHeaderBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    mb: 2,
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
            onClick={handleNavigateBack}
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
      <Box id="purchase-order-details" sx={containerBoxSx}>
        <Paper elevation={0} sx={mainPaperSx}>
          {/* Title Bar */}
          <Box sx={titleBarBoxSx}>
            <Box sx={titleBarLeftBoxSx}>
              <IconButton onClick={handleNavigateBack} sx={backIconButtonSx}>
                <ArrowBack sx={{ fontSize: '20px' }} />
              </IconButton>
              <Typography variant="h4" component="h1" fontWeight="bold" sx={titleTypographySx}>
                {purchaseOrder.orderNumber} - Purchase Order Details
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {canEdit && (
                <Button
                  variant="outlined"
                  startIcon={<Edit sx={{ fontSize: '18px' }} />}
                  onClick={handleEdit}
                  className="no-print"
                  sx={editButtonSx}
                >
                  Edit Order
                </Button>
              )}
              {canReceive && (
                <Button
                  variant="contained"
                  startIcon={<Inventory sx={{ fontSize: '18px' }} />}
                  onClick={handleReceiveGoods}
                  className="no-print"
                  sx={receiveButtonSx}
                >
                  Receive Goods
                </Button>
              )}
            </Box>
          </Box>

          <Box sx={{ p: '24px' }}>
            <Grid container spacing={3}>
          {/* Order Information */}
          <Grid item xs={12} md={8}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                  Order Information
                </Typography>
                <Divider sx={dividerSx} />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                      Order Number
                    </Typography>
                    <Typography variant="body1" fontWeight="medium" sx={bodyTypographySx}>
                      {purchaseOrder.orderNumber}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                      Status
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>{getStatusChip(purchaseOrder.status)}</Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                      Supplier
                    </Typography>
                    <Typography variant="body1" sx={bodyTypographySx}>
                      {purchaseOrder.supplier.name}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                      Order Date
                    </Typography>
                    <Typography variant="body1" sx={bodyTypographySx}>
                      {formatDate(purchaseOrder.orderDate)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                      Expected Date
                    </Typography>
                    <Typography variant="body1" sx={bodyTypographySx}>
                      {purchaseOrder.expectedDate ? formatDate(purchaseOrder.expectedDate) : '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                      Received Date
                    </Typography>
                    <Typography variant="body1" sx={bodyTypographySx}>
                      {purchaseOrder.receivedDate ? formatDate(purchaseOrder.receivedDate) : '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                      Total Amount
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" sx={totalAmountTypographySx}>
                      {formatCurrency(purchaseOrder.total)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                      Created At
                    </Typography>
                    <Typography variant="body1" sx={bodyTypographySx}>
                      {formatDateTime(purchaseOrder.createdAt)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Summary Card */}
          <Grid item xs={12} md={4}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                  Summary
                </Typography>
                <Divider sx={dividerSx} />
                <Box sx={summaryBoxSx}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                      Total Items
                    </Typography>
                    <Typography variant="h5" sx={summaryValueTypographySx}>
                      {summaryStats.totalItems}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                      Items Received
                    </Typography>
                    <Typography variant="h5" sx={summaryValueGreenTypographySx}>
                      {summaryStats.itemsReceived} / {summaryStats.totalItems}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                      Total Quantity
                    </Typography>
                    <Typography variant="h5" sx={summaryValueTypographySx}>
                      {summaryStats.totalQuantity.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                      Received Quantity
                    </Typography>
                    <Typography variant="h5" sx={summaryValueGreenTypographySx}>
                      {summaryStats.receivedQuantity.toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Items Table */}
          <Grid item xs={12}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                  Order Items
                </Typography>
                <Divider sx={dividerSx} />
                <TableContainer>
                  <Table sx={tableSx}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell>Code</TableCell>
                        <TableCell align="right">Ordered Qty</TableCell>
                        <TableCell align="right">Received Qty</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Subtotal</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {purchaseOrder.items.map((item) => (
                        <ItemRow key={item.id} item={item} />
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Invoices Section */}
          {purchaseOrder.invoices && purchaseOrder.invoices.length > 0 && (
            <Grid item xs={12}>
              <Card sx={cardSx}>
                <CardContent>
                  <Box sx={invoicesHeaderBoxSx}>
                    <Receipt sx={{ fontSize: '20px', color: '#1a237e' }} />
                    <Typography variant="h6" sx={sectionTitleTypographySx}>
                      Purchase Invoices
                    </Typography>
                  </Box>
                  <Divider sx={dividerSx} />
                  <TableContainer>
                    <Table size="small" sx={tableSx}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Invoice Number</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Due Date</TableCell>
                          <TableCell>Paid Date</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {purchaseOrder.invoices.map((invoice) => (
                          <InvoiceRow key={invoice.id} invoice={invoice} />
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          )}
            </Grid>
          </Box>
        </Paper>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default PurchaseOrderDetails;

