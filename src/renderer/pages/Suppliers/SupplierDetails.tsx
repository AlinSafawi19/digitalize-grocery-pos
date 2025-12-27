import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
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
  Chip,
  Tabs,
  Tab,
  IconButton,
  TablePagination,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Add,
  Contacts,
  Description,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { SupplierService } from '../../services/supplier.service';
import { Supplier } from '../../services/product.service';
import { PurchaseOrder, PurchaseInvoice } from '../../services/purchase-order.service';
import { SupplierPaymentService, SupplierPayment, SupplierBalanceSummary } from '../../services/supplier-payment.service';
import SupplierPaymentForm from './SupplierPaymentForm';
import SupplierContactList from '../../components/supplier/SupplierContactList';
import SupplierDocumentList from '../../components/supplier/SupplierDocumentList';
import MainLayout from '../../components/layout/MainLayout';
import { formatDate } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = memo(function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
});

// Move statusConfig outside component to prevent recreation on every render
type StatusConfig = {
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  label: string;
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  draft: { color: 'default' as const, label: 'Draft' },
  pending: { color: 'warning' as const, label: 'Pending' },
  partially_received: { color: 'info' as const, label: 'Partially Received' },
  received: { color: 'success' as const, label: 'Received' },
  cancelled: { color: 'error' as const, label: 'Cancelled' },
  paid: { color: 'success' as const, label: 'Paid' },
  partial: { color: 'warning' as const, label: 'Partial' },
  overdue: { color: 'error' as const, label: 'Overdue' },
};

// Create currency formatter once outside component
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

// Memoized PurchaseOrderRow component to prevent unnecessary re-renders
interface PurchaseOrderRowProps {
  order: PurchaseOrder;
  formatCurrency: (amount: number) => string;
  getStatusChip: (status: string) => React.ReactElement;
  navigate: (path: string) => void;
}

const PurchaseOrderRow = memo(function PurchaseOrderRow({
  order,
  formatCurrency,
  getStatusChip,
  navigate,
}: PurchaseOrderRowProps) {
  // Memoize sx prop objects
  const bodyTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const totalTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const viewButtonSx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    padding: '8px 16px',
    minHeight: '40px',
    color: '#1a237e',
    border: '1px solid #c0c0c0',
    '&:hover': {
      borderColor: '#1a237e',
      backgroundColor: '#f5f5f5',
    },
  }), []);

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight="medium" sx={bodyTypographySx}>
          {order.orderNumber}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={bodyTypographySx}>
          {formatDate(order.orderDate)}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight="medium" sx={totalTypographySx}>
          {formatCurrency(order.total)}
        </Typography>
      </TableCell>
      <TableCell>{getStatusChip(order.status)}</TableCell>
      <TableCell align="center">
        <Button
          size="small"
          onClick={() => navigate(`/purchase-orders/${order.id}`)}
          sx={viewButtonSx}
        >
          View
        </Button>
      </TableCell>
    </TableRow>
  );
});

// Memoized InvoiceRow component to prevent unnecessary re-renders
interface InvoiceRowProps {
  invoice: PurchaseInvoice;
  formatCurrency: (amount: number) => string;
  getStatusChip: (status: string) => React.ReactElement;
}

const InvoiceRow = memo(function InvoiceRow({
  invoice,
  formatCurrency,
  getStatusChip,
}: InvoiceRowProps) {
  // Memoize sx prop objects
  const bodyTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const totalTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight="medium" sx={bodyTypographySx}>
          {invoice.invoiceNumber}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={bodyTypographySx}>
          {invoice.purchaseOrderId}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight="medium" sx={totalTypographySx}>
          {formatCurrency(invoice.amount)}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={bodyTypographySx}>
          {formatDate(invoice.dueDate) || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={bodyTypographySx}>
          {formatDate(invoice.paidDate) || '-'}
        </Typography>
      </TableCell>
      <TableCell>{getStatusChip(invoice.status)}</TableCell>
    </TableRow>
  );
});

const SupplierDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Optimize useSelector to only subscribe to user.id instead of entire auth state
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { toast, showToast, hideToast } = useToast();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Performance stats
  type SupplierStats = {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    ordersThisMonth: number;
    ordersThisYear: number;
    totalInvoices: number;
    paidInvoices: number;
    pendingInvoices: number;
    overdueInvoices: number;
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
  };
  const [stats, setStats] = useState<SupplierStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Purchase orders
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersPageSize, setOrdersPageSize] = useState(20);
  const [ordersTotal, setOrdersTotal] = useState(0);

  // Payment history
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesPage, setInvoicesPage] = useState(0);
  const [invoicesPageSize, setInvoicesPageSize] = useState(20);
  const [invoicesTotal, setInvoicesTotal] = useState(0);

  // Supplier payments
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsPage, setPaymentsPage] = useState(0);
  const [paymentsPageSize, setPaymentsPageSize] = useState(20);
  const [paymentsTotal, setPaymentsTotal] = useState(0);

  // Balance summary
  const [balance, setBalance] = useState<SupplierBalanceSummary | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Payment form
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);

  const loadSupplier = useCallback(async () => {
    if (!id || !userId) return;

    setLoading(true);

    try {
      const supplierId = parseInt(id, 10);
      if (isNaN(supplierId)) {
        showToast('Invalid supplier ID', 'error');
        return;
      }

      const result = await SupplierService.getSupplierById(supplierId, userId);
      if (result.success && result.supplier) {
        setSupplier(result.supplier);
      } else {
        showToast(result.error || 'Failed to load supplier', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, userId, showToast]);

  const loadStats = useCallback(async () => {
    if (!id) return;

    setStatsLoading(true);
    try {
      const supplierId = parseInt(id, 10);
      const result = await SupplierService.getSupplierPerformanceStats(supplierId);
      if (result.success && result.stats) {
        setStats(result.stats);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [id]);

  const loadPurchaseOrders = useCallback(async () => {
    if (!id || !userId) return;

    setOrdersLoading(true);
    try {
      const supplierId = parseInt(id, 10);
      const result = await SupplierService.getSupplierPurchaseOrders(
        supplierId,
        {
          page: ordersPage + 1,
          pageSize: ordersPageSize,
        },
        userId
      );
      if (result.success && result.purchaseOrders) {
        setPurchaseOrders(result.purchaseOrders);
        setOrdersTotal(result.total || 0);
      }
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  }, [id, userId, ordersPage, ordersPageSize]);

  const loadPaymentHistory = useCallback(async () => {
    if (!id || !userId) return;

    setInvoicesLoading(true);
    try {
      const supplierId = parseInt(id, 10);
      const result = await SupplierService.getSupplierPaymentHistory(
        supplierId,
        {
          page: invoicesPage + 1,
          pageSize: invoicesPageSize,
        },
        userId
      );
      if (result.success && result.invoices) {
        setInvoices(result.invoices);
        setInvoicesTotal(result.pagination?.totalItems || 0);
      }
    } catch (err) {
      console.error('Failed to load payment history:', err);
    } finally {
      setInvoicesLoading(false);
    }
  }, [id, userId, invoicesPage, invoicesPageSize]);

  const loadPayments = useCallback(async () => {
    if (!id) return;

    setPaymentsLoading(true);
    try {
      const supplierId = parseInt(id, 10);
      const result = await SupplierPaymentService.getList({
        supplierId,
        page: paymentsPage + 1,
        pageSize: paymentsPageSize,
        sortBy: 'paymentDate',
        sortOrder: 'desc',
      });
      if (result.success && result.payments) {
        setPayments(result.payments);
        setPaymentsTotal(result.total || 0);
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setPaymentsLoading(false);
    }
  }, [id, paymentsPage, paymentsPageSize]);

  const loadBalance = useCallback(async () => {
    if (!id) return;

    setBalanceLoading(true);
    try {
      const supplierId = parseInt(id, 10);
      const result = await SupplierPaymentService.getSupplierBalance(supplierId);
      if (result.success && result.balance) {
        setBalance(result.balance);
      }
    } catch (err) {
      console.error('Failed to load balance:', err);
    } finally {
      setBalanceLoading(false);
    }
  }, [id]);

  const handlePaymentSuccess = useCallback(() => {
    loadPayments();
    loadBalance();
    loadPaymentHistory(); // Reload invoices to update status
  }, [loadPayments, loadBalance, loadPaymentHistory]);

  // Fix useEffect dependencies - remove callbacks from dependencies to prevent unnecessary re-renders
  useEffect(() => {
    if (id && userId) {
      loadSupplier();
    }
  }, [id, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (id) {
      loadStats();
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 1 && id && userId) {
      loadPurchaseOrders();
    }
  }, [activeTab, id, userId, ordersPage, ordersPageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 2 && id && userId) {
      loadPaymentHistory();
      loadPayments();
    }
  }, [activeTab, id, userId, invoicesPage, invoicesPageSize, paymentsPage, paymentsPageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (id && activeTab === 0) {
      loadBalance();
    }
  }, [id, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Memoize formatCurrency to prevent recreation on every render
  const formatCurrency = useCallback((amount: number) => {
    return currencyFormatter.format(amount);
  }, []);

  // Memoize getStatusChip to prevent recreation on every render
  const chipSx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
    height: '32px',
  }), []);

  const getStatusChip = useCallback((status: string) => {
    const config = STATUS_CONFIG[status] || { color: 'default' as const, label: status };
    return (
      <Chip
        label={config.label}
        size="small"
        color={config.color}
        sx={chipSx}
      />
    );
  }, [chipSx]);

  // Memoize navigation handler to prevent recreation
  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const handleNavigateBack = useCallback(() => {
    navigate('/suppliers');
  }, [navigate]);

  const handleNavigateToEdit = useCallback(() => {
    if (supplier) {
      navigate(`/suppliers/edit/${supplier.id}`);
    }
  }, [navigate, supplier]);

  const handleTabChange = useCallback((_: unknown, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  const handleOrdersPageChange = useCallback((_: unknown, newPage: number) => {
    setOrdersPage(newPage);
  }, []);

  const handleOrdersPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setOrdersPageSize(parseInt(e.target.value, 10));
    setOrdersPage(0);
  }, []);

  const handleInvoicesPageChange = useCallback((_: unknown, newPage: number) => {
    setInvoicesPage(newPage);
  }, []);

  const handleInvoicesPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInvoicesPageSize(parseInt(e.target.value, 10));
    setInvoicesPage(0);
  }, []);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  }), []);

  const containerBoxSx = useMemo(() => ({
    p: 2,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const backButtonSx = useMemo(() => ({
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
  }), []);

  const mainContainerBoxSx = useMemo(() => ({
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
    justifyContent: 'space-between',
    alignItems: 'center',
  }), []);

  const backIconButtonSx = useMemo(() => ({
    padding: '8px',
    width: '48px',
    height: '48px',
    color: '#ffffff',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#ffffff',
    fontWeight: 600,
  }), []);

  const editButtonSx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    color: '#ffffff',
    padding: '8px 16px',
    minWidth: 'auto',
    minHeight: '40px',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
  }), []);

  const cardSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const sectionTitleTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const dividerSx = useMemo(() => ({
    mb: 2,
    borderColor: '#e0e0e0',
  }), []);

  const labelTypographySx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const statsLoadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    p: 2,
  }), []);

  const statsBoxSx = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  }), []);

  const statValueTypographySx = useMemo(() => ({
    fontSize: { xs: '20px', sm: '24px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const statValueBoldTypographySx = useMemo(() => ({
    fontSize: { xs: '20px', sm: '24px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const statValueH6TypographySx = useMemo(() => ({
    fontSize: '18px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const tabsSx = useMemo(() => ({
    borderBottom: '1px solid #e0e0e0',
    '& .MuiTab-root': {
      textTransform: 'none',
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '56px',
      '&.Mui-selected': {
        color: '#1a237e',
      },
    },
    '& .MuiTabs-indicator': {
      backgroundColor: '#1a237e',
    },
  }), []);

  const overviewCardSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const overviewSubtitleTypographySx = useMemo(() => ({
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const overviewStatsBoxSx = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5,
  }), []);

  const overviewRowBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
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

  const emptyStateTypographySx = useMemo(() => ({
    py: 4,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const loadingTableBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    p: 4,
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

  if (!supplier) {
    return (
      <MainLayout>
        <Box sx={containerBoxSx}>
          <Button
            startIcon={<ArrowBack sx={{ fontSize: '28px' }} />}
            onClick={handleNavigateBack}
            sx={backButtonSx}
          >
            Back to Suppliers
          </Button>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={mainContainerBoxSx}>
        <Paper elevation={0} sx={paperSx}>
          {/* Title Bar */}
          <Box sx={titleBarBoxSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={handleNavigateBack} sx={backIconButtonSx}>
                <ArrowBack />
              </IconButton>
              <Typography variant="h4" component="h1" fontWeight="bold" sx={titleTypographySx}>
              DigitalizePOS - {supplier.name}
              </Typography>
            </Box>
            <Button
              variant="text"
              startIcon={<Edit sx={{ fontSize: '24px' }} />}
              onClick={handleNavigateToEdit}
              sx={editButtonSx}
            >
              Edit Supplier
            </Button>
          </Box>

          <Box sx={{ p: '24px' }}>

            <Grid container spacing={3}>
              {/* Supplier Information */}
              <Grid item xs={12} md={8}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                      Contact Information
                    </Typography>
                    <Divider sx={dividerSx} />
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                          Contact Person
                        </Typography>
                        <Typography variant="body1" sx={bodyTypographySx}>
                          {supplier.contact || '-'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                          Email
                        </Typography>
                        <Typography variant="body1" sx={bodyTypographySx}>
                          {supplier.email || '-'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                          Phone
                        </Typography>
                        <Typography variant="body1" sx={bodyTypographySx}>
                          {supplier.phone || '-'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                          Address
                        </Typography>
                        <Typography variant="body1" sx={bodyTypographySx}>
                          {supplier.address || '-'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Performance Stats */}
              <Grid item xs={12} md={4}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <TrendingUp sx={{ fontSize: '28px', color: '#1a237e' }} />
                      <Typography variant="h6" sx={sectionTitleTypographySx}>
                        Performance
                      </Typography>
                    </Box>
                    <Divider sx={dividerSx} />
                    {statsLoading ? (
                      <Box sx={statsLoadingBoxSx}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : stats ? (
                      <Box sx={statsBoxSx}>
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                            Total Orders
                          </Typography>
                          <Typography variant="h5" sx={statValueTypographySx}>
                            {stats.totalOrders}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                            Total Spent
                          </Typography>
                          <Typography variant="h5" fontWeight="bold" sx={statValueBoldTypographySx}>
                            {formatCurrency(stats.totalSpent)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                            Average Order Value
                          </Typography>
                          <Typography variant="h6" sx={statValueH6TypographySx}>
                            {formatCurrency(stats.averageOrderValue)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                            Orders This Month
                          </Typography>
                          <Typography variant="h6" sx={statValueH6TypographySx}>
                            {stats.ordersThisMonth}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                            Total Invoices
                          </Typography>
                          <Typography variant="h6" sx={statValueH6TypographySx}>
                            {stats.paidInvoices} Paid / {stats.pendingInvoices} Pending / {stats.overdueInvoices} Overdue
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                        No statistics available
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Balance Summary */}
              {(balance || balanceLoading) && (
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={overviewCardSx}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" gutterBottom sx={overviewSubtitleTypographySx}>
                          Payment Balance
                        </Typography>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<Add />}
                          onClick={() => setPaymentFormOpen(true)}
                          disabled={balanceLoading}
                          sx={{
                            backgroundColor: '#1a237e',
                            '&:hover': { backgroundColor: '#534bae' },
                          }}
                        >
                          Record Payment
                        </Button>
                      </Box>
                      <Divider sx={dividerSx} />
                      {balanceLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                          <CircularProgress size={24} />
                        </Box>
                      ) : balance ? (
                      <Box sx={overviewStatsBoxSx}>
                        <Box sx={overviewRowBoxSx}>
                          <Typography variant="body2" sx={bodyTypographySx}>
                            Total Invoices:
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" sx={bodyTypographySx}>
                            {balance.totalInvoices}
                          </Typography>
                        </Box>
                        <Box sx={overviewRowBoxSx}>
                          <Typography variant="body2" sx={bodyTypographySx}>
                            Total Invoice Amount:
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" sx={bodyTypographySx}>
                            {formatCurrency(balance.totalInvoiceAmount)}
                          </Typography>
                        </Box>
                        <Box sx={overviewRowBoxSx}>
                          <Typography variant="body2" sx={bodyTypographySx}>
                            Total Payments:
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" sx={bodyTypographySx}>
                            {formatCurrency(balance.totalPayments)}
                          </Typography>
                        </Box>
                        <Box sx={overviewRowBoxSx}>
                          <Typography variant="body2" fontWeight="bold" sx={bodyTypographySx}>
                            Outstanding Balance:
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{
                              ...bodyTypographySx,
                              color: balance.outstandingBalance > 0 ? '#d32f2f' : '#2e7d32',
                            }}
                          >
                            {formatCurrency(balance.outstandingBalance)}
                          </Typography>
                        </Box>
                        {balance.overdueAmount > 0 && (
                          <Box sx={overviewRowBoxSx}>
                            <Typography variant="body2" sx={{ ...bodyTypographySx, color: '#d32f2f' }}>
                              Overdue Amount:
                            </Typography>
                            <Typography variant="body2" fontWeight="bold" sx={{ ...bodyTypographySx, color: '#d32f2f' }}>
                              {formatCurrency(balance.overdueAmount)} ({balance.overdueInvoices} invoices)
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      ) : null}
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Tabs */}
              <Grid item xs={12}>
                <Paper sx={cardSx}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #e0e0e0' }}>
                    <Tabs
                      value={activeTab}
                      onChange={handleTabChange}
                      sx={tabsSx}
                    >
                      <Tab icon={<TrendingUp sx={{ fontSize: '18px' }} />} label="Overview" />
                      <Tab icon={<ShoppingCart sx={{ fontSize: '18px' }} />} label="Purchase History" />
                      <Tab icon={<Receipt sx={{ fontSize: '18px' }} />} label="Payment History" />
                      <Tab icon={<Contacts sx={{ fontSize: '18px' }} />} label="Contacts" />
                      <Tab icon={<Description sx={{ fontSize: '18px' }} />} label="Documents" />
                    </Tabs>
                    {activeTab === 2 && (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<Add />}
                        onClick={() => setPaymentFormOpen(true)}
                        sx={{
                          backgroundColor: '#1a237e',
                          '&:hover': { backgroundColor: '#534bae' },
                        }}
                      >
                        Record Payment
                      </Button>
                    )}
                  </Box>

                  <TabPanel value={activeTab} index={0}>
                    <Box sx={{ p: 3 }}>
                      {stats && (
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={6}>
                            <Card variant="outlined" sx={overviewCardSx}>
                              <CardContent>
                                <Typography variant="subtitle1" gutterBottom sx={overviewSubtitleTypographySx}>
                                  Order Statistics
                                </Typography>
                                <Divider sx={dividerSx} />
                                <Box sx={overviewStatsBoxSx}>
                                  <Box sx={overviewRowBoxSx}>
                                    <Typography variant="body2" sx={bodyTypographySx}>
                                      Total Orders:
                                    </Typography>
                                    <Typography variant="body2" fontWeight="medium" sx={bodyTypographySx}>
                                      {stats.totalOrders}
                                    </Typography>
                                  </Box>
                                  <Box sx={overviewRowBoxSx}>
                                    <Typography variant="body2" sx={bodyTypographySx}>
                                      This Month:
                                    </Typography>
                                    <Typography variant="body2" fontWeight="medium" sx={bodyTypographySx}>
                                      {stats.ordersThisMonth}
                                    </Typography>
                                  </Box>
                                  <Box sx={overviewRowBoxSx}>
                                    <Typography variant="body2" sx={bodyTypographySx}>
                                      This Year:
                                    </Typography>
                                    <Typography variant="body2" fontWeight="medium" sx={bodyTypographySx}>
                                      {stats.ordersThisYear}
                                    </Typography>
                                  </Box>
                                  <Box sx={overviewRowBoxSx}>
                                    <Typography variant="body2" sx={bodyTypographySx}>
                                      Average Order:
                                    </Typography>
                                    <Typography variant="body2" fontWeight="medium" sx={bodyTypographySx}>
                                      {formatCurrency(stats.averageOrderValue)}
                                    </Typography>
                                  </Box>
                                </Box>
                              </CardContent>
                            </Card>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Card variant="outlined" sx={overviewCardSx}>
                              <CardContent>
                                <Typography variant="subtitle1" gutterBottom sx={overviewSubtitleTypographySx}>
                                  Payment Statistics
                                </Typography>
                                <Divider sx={dividerSx} />
                                <Box sx={overviewStatsBoxSx}>
                                  <Box sx={overviewRowBoxSx}>
                                    <Typography variant="body2" sx={bodyTypographySx}>
                                      Total Paid:
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      fontWeight="medium"
                                      sx={[
                                        bodyTypographySx,
                                        { color: '#2e7d32' },
                                      ]}
                                    >
                                      {formatCurrency(stats.totalPaid)}
                                    </Typography>
                                  </Box>
                                  <Box sx={overviewRowBoxSx}>
                                    <Typography variant="body2" sx={bodyTypographySx}>
                                      Pending:
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      fontWeight="medium"
                                      sx={[
                                        bodyTypographySx,
                                        { color: '#ed6c02' },
                                      ]}
                                    >
                                      {formatCurrency(stats.totalPending)}
                                    </Typography>
                                  </Box>
                                  <Box sx={overviewRowBoxSx}>
                                    <Typography variant="body2" sx={bodyTypographySx}>
                                      Overdue:
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      fontWeight="medium"
                                      sx={[
                                        bodyTypographySx,
                                        { color: '#d32f2f' },
                                      ]}
                                    >
                                      {formatCurrency(stats.totalOverdue)}
                                    </Typography>
                                  </Box>
                                  <Box sx={overviewRowBoxSx}>
                                    <Typography variant="body2" sx={bodyTypographySx}>
                                      Total Invoices:
                                    </Typography>
                                    <Typography variant="body2" fontWeight="medium" sx={bodyTypographySx}>
                                      {stats.totalInvoices}
                                    </Typography>
                                  </Box>
                                </Box>
                              </CardContent>
                            </Card>
                          </Grid>
                        </Grid>
                      )}
                    </Box>
                  </TabPanel>

                  <TabPanel value={activeTab} index={1}>
                    <Box sx={{ p: 3 }}>
                      {ordersLoading ? (
                        <Box sx={loadingTableBoxSx}>
                          <CircularProgress />
                        </Box>
                      ) : (
                        <>
                          <TableContainer>
                            <Table sx={tableSx}>
                              <TableHead>
                                <TableRow>
                                  <TableCell>Order Number</TableCell>
                                  <TableCell>Order Date</TableCell>
                                  <TableCell align="right">Total</TableCell>
                                  <TableCell>Status</TableCell>
                                  <TableCell align="center">Actions</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {purchaseOrders.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={5} align="center">
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={emptyStateTypographySx}
                                      >
                                        No purchase orders found
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  purchaseOrders.map((order) => (
                                    <PurchaseOrderRow
                                      key={order.id}
                                      order={order}
                                      formatCurrency={formatCurrency}
                                      getStatusChip={getStatusChip}
                                      navigate={handleNavigate}
                                    />
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </TableContainer>
                          <TablePagination
                            component="div"
                            count={ordersTotal}
                            page={ordersPage}
                            onPageChange={handleOrdersPageChange}
                            rowsPerPage={ordersPageSize}
                            onRowsPerPageChange={handleOrdersPageSizeChange}
                            rowsPerPageOptions={[10, 20, 50, 100]}
                            sx={paginationSx}
                          />
                        </>
                      )}
                    </Box>
                  </TabPanel>

                  <TabPanel value={activeTab} index={2}>
                    <Box sx={{ p: 3 }}>
                      <Tabs value={0} sx={{ mb: 2, minHeight: 'auto' }}>
                        <Tab label="Payments" />
                        <Tab label="Invoices" />
                      </Tabs>
                      
                      {/* Payments Table */}
                      {paymentsLoading ? (
                        <Box sx={loadingTableBoxSx}>
                          <CircularProgress />
                        </Box>
                      ) : (
                        <>
                          <TableContainer>
                            <Table sx={tableSx}>
                              <TableHead>
                                <TableRow>
                                  <TableCell>Payment Date</TableCell>
                                  <TableCell>Amount</TableCell>
                                  <TableCell>Currency</TableCell>
                                  <TableCell>Payment Method</TableCell>
                                  <TableCell>Invoice</TableCell>
                                  <TableCell>Reference</TableCell>
                                  <TableCell>Notes</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {payments.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={7} align="center">
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={emptyStateTypographySx}
                                      >
                                        No payments found
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  payments.map((payment) => (
                                    <TableRow key={payment.id}>
                                      <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                                      <TableCell align="right">{formatCurrency(payment.amount)}</TableCell>
                                      <TableCell>{payment.currency}</TableCell>
                                      <TableCell>
                                        <Chip
                                          label={payment.paymentMethod.replace('_', ' ').toUpperCase()}
                                          size="small"
                                          sx={chipSx}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        {payment.purchaseInvoice ? (
                                          <Typography variant="body2" sx={bodyTypographySx}>
                                            {payment.purchaseInvoice.invoiceNumber}
                                          </Typography>
                                        ) : (
                                          <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                                            General Payment
                                          </Typography>
                                        )}
                                      </TableCell>
                                      <TableCell>{payment.referenceNumber || '-'}</TableCell>
                                      <TableCell>
                                        <Typography variant="body2" sx={bodyTypographySx} noWrap>
                                          {payment.notes || '-'}
                                        </Typography>
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </TableContainer>
                          <TablePagination
                            component="div"
                            count={paymentsTotal}
                            page={paymentsPage}
                            onPageChange={(_, newPage) => setPaymentsPage(newPage)}
                            rowsPerPage={paymentsPageSize}
                            onRowsPerPageChange={(e) => setPaymentsPageSize(parseInt(e.target.value, 10))}
                            rowsPerPageOptions={[10, 20, 50, 100]}
                            sx={paginationSx}
                          />
                        </>
                      )}

                      {/* Invoices Table */}
                      <Box sx={{ mt: 4 }}>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                          Invoices
                        </Typography>
                        {invoicesLoading ? (
                          <Box sx={loadingTableBoxSx}>
                            <CircularProgress />
                          </Box>
                        ) : (
                          <>
                            <TableContainer>
                              <Table sx={tableSx}>
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Invoice Number</TableCell>
                                    <TableCell>Order Number</TableCell>
                                    <TableCell align="right">Amount</TableCell>
                                    <TableCell>Due Date</TableCell>
                                    <TableCell>Paid Date</TableCell>
                                    <TableCell>Status</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {invoices.length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={6} align="center">
                                        <Typography
                                          variant="body2"
                                          color="text.secondary"
                                          sx={emptyStateTypographySx}
                                        >
                                          No invoices found
                                        </Typography>
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    invoices.map((invoice) => (
                                      <InvoiceRow
                                        key={invoice.id}
                                        invoice={invoice}
                                        formatCurrency={formatCurrency}
                                        getStatusChip={getStatusChip}
                                      />
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </TableContainer>
                            <TablePagination
                              component="div"
                              count={invoicesTotal}
                              page={invoicesPage}
                              onPageChange={handleInvoicesPageChange}
                              rowsPerPage={invoicesPageSize}
                              onRowsPerPageChange={handleInvoicesPageSizeChange}
                              rowsPerPageOptions={[10, 20, 50, 100]}
                              sx={paginationSx}
                            />
                          </>
                        )}
                      </Box>
                    </Box>
                  </TabPanel>
                  <TabPanel value={activeTab} index={3}>
                    <Box sx={{ p: 3 }}>
                      {id && userId && (
                        <SupplierContactList
                          supplierId={parseInt(id, 10)}
                          userId={userId}
                        />
                      )}
                    </Box>
                  </TabPanel>
                  <TabPanel value={activeTab} index={4}>
                    <Box sx={{ p: 3 }}>
                      {id && userId && (
                        <SupplierDocumentList
                          supplierId={parseInt(id, 10)}
                          userId={userId}
                        />
                      )}
                    </Box>
                  </TabPanel>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Box>
      <SupplierPaymentForm
        open={paymentFormOpen}
        onClose={() => setPaymentFormOpen(false)}
        onSuccess={handlePaymentSuccess}
        supplier={supplier}
        userId={userId || 0}
      />
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default SupplierDetails;

