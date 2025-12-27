import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  IconButton,
  Chip,
  Typography,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Visibility,
  Inventory,
  Edit,
  CheckCircle,
  Cancel,
  HourglassEmpty,
  Refresh,
  FileCopy,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import {
  PurchaseOrderService,
  PurchaseOrder,
  PurchaseOrderListOptions,
} from '../../services/purchase-order.service';
import MainLayout from '../../components/layout/MainLayout';
import FilterHeader from '../../components/common/FilterHeader';
import { formatDate } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { usePermission } from '../../hooks/usePermission';
import { ROUTES } from '../../utils/constants';

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
interface PurchaseOrderRowProps {
  order: PurchaseOrder;
  onView: (id: number) => void;
}

// Memoize sx prop objects for PurchaseOrderRow
const orderNumberTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const supplierTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const dateTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#616161',
};

const totalTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#1a237e',
};

const itemsTypographySx = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#616161',
};

const viewIconButtonSx = {
  color: '#1a237e',
  '&:hover': {
    backgroundColor: '#e3f2fd',
  },
};

const PurchaseOrderRow = memo(({ order, onView }: PurchaseOrderRowProps) => {
  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight="medium" sx={orderNumberTypographySx}>
          {order.orderNumber}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={supplierTypographySx}>
          {order.supplier.name}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={dateTypographySx}>
          {formatDate(order.orderDate)}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={dateTypographySx}>
          {order.expectedDate ? formatDate(order.expectedDate) : '-'}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight="bold" sx={totalTypographySx}>
          {formatCurrency(order.total)}
        </Typography>
      </TableCell>
      <TableCell>{getStatusChip(order.status)}</TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={itemsTypographySx}>
          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
        </Typography>
      </TableCell>
      <TableCell align="center">
        <Tooltip title={`View Purchase Order ${order.orderNumber} - View detailed information including items, supplier details, status, and total amount.`}>
          <IconButton
            size="small"
            color="primary"
            onClick={() => onView(order.id)}
            sx={viewIconButtonSx}
          >
            <Visibility fontSize="small" sx={{ fontSize: '18px' }} />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
});

PurchaseOrderRow.displayName = 'PurchaseOrderRow';

const PurchaseOrderList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  // Permission checks
  const canCreate = usePermission('purchase_orders.create');

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'orderDate' | 'orderNumber' | 'total' | 'status'>('orderDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const loadPurchaseOrders = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const options: PurchaseOrderListOptions = {
        page: page + 1,
        pageSize,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        sortBy,
        sortOrder,
      };

      const result = await PurchaseOrderService.getPurchaseOrders(options, user.id);
      if (result.success && result.purchaseOrders) {
        setPurchaseOrders(result.purchaseOrders);
        setTotal(result.total || 0);
      } else {
        showToast(result.error || 'Failed to load purchase orders', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, sortBy, sortOrder, user?.id, showToast]);

  useEffect(() => {
    loadPurchaseOrders();
  }, [loadPurchaseOrders]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setSortBy('orderDate');
    setSortOrder('desc');
    setPage(0);
  }, []);

  const handleViewOrder = useCallback((id: number) => {
    navigate(`/purchase-orders/${id}`);
  }, [navigate]);

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPageSize(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  const handleStatusFilterChange = useCallback((value: unknown) => {
    setStatusFilter(value as string);
    setPage(0);
  }, []);

  const handleSortByChange = useCallback((value: unknown) => {
    setSortBy(value as 'orderDate' | 'orderNumber' | 'total' | 'status');
  }, []);

  const handleSortOrderChange = useCallback((value: unknown) => {
    setSortOrder(value as 'asc' | 'desc');
  }, []);

  const handleAddPurchaseOrder = useCallback(() => {
    navigate(ROUTES.PURCHASE_ORDERS_NEW);
  }, [navigate]);

  const handleManageTemplates = useCallback(() => {
    navigate(ROUTES.PURCHASE_ORDER_TEMPLATES);
  }, [navigate]);

  // Memoize filter options to prevent recreating on every render
  const statusOptions = useMemo(() => [
    { value: 'all', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'pending', label: 'Pending' },
    { value: 'partially_received', label: 'Partially Received' },
    { value: 'received', label: 'Received' },
    { value: 'cancelled', label: 'Cancelled' },
  ], []);

  const sortByOptions = useMemo(() => [
    { value: 'orderDate', label: 'Order Date' },
    { value: 'orderNumber', label: 'Order Number' },
    { value: 'total', label: 'Total' },
    { value: 'status', label: 'Status' },
  ], []);

  const sortOrderOptions = useMemo(() => [
    { value: 'asc', label: 'Ascending' },
    { value: 'desc', label: 'Descending' },
  ], []);

  // Memoize FilterHeader fields array
  const filterFields = useMemo(() => [
    {
      type: 'select' as const,
      label: 'Status',
      value: statusFilter,
      onChange: handleStatusFilterChange,
      options: statusOptions,
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'select' as const,
      label: 'Sort By',
      value: sortBy,
      onChange: handleSortByChange,
      options: sortByOptions,
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'select' as const,
      label: 'Order',
      value: sortOrder,
      onChange: handleSortOrderChange,
      options: sortOrderOptions,
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
  ], [statusFilter, handleStatusFilterChange, statusOptions, sortBy, handleSortByChange, sortByOptions, sortOrder, handleSortOrderChange, sortOrderOptions]);

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

  const subtitleTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
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
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#1a237e',
    padding: '8px 20px',
    minHeight: '44px',
    '&:hover': {
      backgroundColor: '#283593',
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

  const emptyStateTypographySx = useMemo(() => ({
    py: 4,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
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
          <Box>
            <Typography variant="h4" gutterBottom fontWeight="bold" sx={titleTypographySx}>
              Purchase Orders
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={subtitleTypographySx}>
              Manage purchase orders and track goods receiving
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Tooltip title="Refresh Purchase Orders - Reload the purchase order list to get the latest data from the database.">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<Refresh sx={{ fontSize: '18px' }} />}
                  onClick={loadPurchaseOrders}
                  disabled={loading}
                  sx={refreshButtonSx}
                >
                  Refresh
                </Button>
              </span>
            </Tooltip>
            {canCreate && (
              <Tooltip title="New Purchase Order - Create a new purchase order to order products from a supplier.">
                <Button
                  variant="contained"
                  startIcon={<Add sx={{ fontSize: '18px' }} />}
                  onClick={handleAddPurchaseOrder}
                  color="primary"
                  sx={addButtonSx}
                >
                  New Purchase Order
                </Button>
              </Tooltip>
              <Tooltip title="Manage Templates - Create and manage reusable purchase order templates.">
                <Button
                  variant="outlined"
                  startIcon={<FileCopy sx={{ fontSize: '18px' }} />}
                  onClick={handleManageTemplates}
                  sx={addButtonSx}
                >
                  Templates
                </Button>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Filters */}
        <FilterHeader
          searchPlaceholder="Search by order number or supplier name..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          onClear={handleClearFilters}
          fields={filterFields}
        />

        {/* Purchase Orders Table */}
        <TableContainer component={Paper} sx={tableContainerSx}>
          {loading ? (
            <Box sx={loadingBoxSx}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Table sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Order Number</TableCell>
                    <TableCell>Supplier</TableCell>
                    <TableCell>Order Date</TableCell>
                    <TableCell>Expected Date</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Items</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchaseOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography variant="body2" color="text.secondary" sx={emptyStateTypographySx}>
                          No purchase orders found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    purchaseOrders.map((order) => (
                      <PurchaseOrderRow key={order.id} order={order} onView={handleViewOrder} />
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={total}
                page={page}
                onPageChange={handlePageChange}
                rowsPerPage={pageSize}
                onRowsPerPageChange={handleRowsPerPageChange}
                rowsPerPageOptions={[10, 20, 50, 100]}
                sx={paginationSx}
              />
            </>
          )}
        </TableContainer>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default PurchaseOrderList;

