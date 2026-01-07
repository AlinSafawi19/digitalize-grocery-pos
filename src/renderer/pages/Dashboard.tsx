import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Button,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PointOfSale,
  Receipt,
  AccountBalance,
  ShoppingCart,
  Inventory,
  Warning,
  ArrowForward,
  Visibility,
  Category,
  LocalShipping,
  Assessment,
  Refresh,
  TrendingUp,
  TrendingDown,
  LocalOffer,
  Cancel,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import { AuthState } from '../store/slices/auth.slice';
import MainLayout from '../components/layout/MainLayout';
import { ReportService, DailySalesStats, TopSellingProduct, DailySalesStatsResult, TopSellingProductsResult } from '../services/report.service';
import { TransactionService, Transaction } from '../services/transaction.service';
import { InventoryService } from '../services/inventory.service';
import { PricingService } from '../services/pricing.service';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { convertDateRangeToUTC, getStartOfDayBeirut, getEndOfDayBeirut } from '../utils/dateUtils';
import moment from 'moment-timezone';
import { ROUTES } from '../utils/constants';
import { useToast } from '../hooks/useToast';
import Toast from '../components/common/Toast';
import { usePermission } from '../hooks/usePermission';
import { PermissionService } from '../services/permission.service';
import PaymentReminders from './Suppliers/PaymentReminders';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState): AuthState => state.auth);
  const { toast, showToast, hideToast } = useToast();

  // Permission checks
  const canViewTransactions = usePermission('transactions.view');
  const canCreateTransactions = usePermission('transactions.create');
  const canViewInventory = usePermission('inventory.view');
  const canViewPurchaseOrders = usePermission('purchase_orders.view');
  const canViewProducts = usePermission('products.view');
  const canViewReports = usePermission('reports.view');
  const canViewSuppliers = usePermission('suppliers.view');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Today's stats
  const [todayStats, setTodayStats] = useState<DailySalesStats | null>(null);
  const [yesterdayStats, setYesterdayStats] = useState<DailySalesStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [outOfStockCount, setOutOfStockCount] = useState<number>(0);
  const [topProducts, setTopProducts] = useState<TopSellingProduct[]>([]);
  const [pendingPurchaseOrders, setPendingPurchaseOrders] = useState<number>(0);
  const [activePromotions, setActivePromotions] = useState<number>(0);

  const loadDashboardData = useCallback(async () => {
    if (!user?.id) return;

    setRefreshing(true);

    try {
      const today = getStartOfDayBeirut();
      const todayEnd = getEndOfDayBeirut();
      // Calculate yesterday in Beirut timezone by subtracting 1 day, then get start/end of that day
      // This properly handles timezone boundaries and calendar days
      const yesterdayBeirut = moment.tz('Asia/Beirut').subtract(1, 'day');
      const yesterday = yesterdayBeirut.clone().startOf('day').toDate();
      const yesterdayEnd = yesterdayBeirut.clone().endOf('day').toDate();

      // Convert to UTC for API
      const todayRangeUTC = convertDateRangeToUTC(today, todayEnd);
      const yesterdayRangeUTC = convertDateRangeToUTC(yesterday, yesterdayEnd);

      // Check permissions before loading data
      const canViewTransactions = await PermissionService.userHasPermission(user.id, 'transactions.view');
      const canViewInventory = await PermissionService.userHasPermission(user.id, 'inventory.view');
      const canViewPurchaseOrders = await PermissionService.userHasPermission(user.id, 'purchase_orders.view');
      const canViewReports = await PermissionService.userHasPermission(user.id, 'reports.view');
      const canViewProducts = await PermissionService.userHasPermission(user.id, 'products.view');

      // Build array of promises conditionally based on permissions
      const promises: Promise<unknown>[] = [];
      const promiseIndices: { [key: string]: number } = {};

      // Sales stats (requires transactions.view or reports.view)
      if (canViewTransactions || canViewReports) {
        promiseIndices.todayStats = promises.length;
        promises.push(
          ReportService.getDailySalesStats(
            {
              startDate: todayRangeUTC.startDate!,
              endDate: todayRangeUTC.endDate!,
            },
            user.id
          )
        );
        promiseIndices.yesterdayStats = promises.length;
        promises.push(
          ReportService.getDailySalesStats(
            {
              startDate: yesterdayRangeUTC.startDate!,
              endDate: yesterdayRangeUTC.endDate!,
            },
            user.id
          )
        );
      }

      // Recent transactions (requires transactions.view)
      if (canViewTransactions) {
        promiseIndices.recentTransactions = promises.length;
        promises.push(
          TransactionService.getTransactions(
            {
              page: 1,
              pageSize: 5,
              status: 'completed',
              sortBy: 'createdAt',
              sortOrder: 'desc',
            },
            user.id
          )
        );
      }

      // Inventory data (requires inventory.view)
      if (canViewInventory) {
        promiseIndices.lowStockCount = promises.length;
        promises.push(InventoryService.getLowStockCount());
        promiseIndices.inventoryReport = promises.length;
        promises.push(ReportService.getInventoryReport({ page: 1, pageSize: 1 }, user.id));
      }

      // Top products (requires reports.view or transactions.view)
      if (canViewReports || canViewTransactions) {
        promiseIndices.topProducts = promises.length;
        promises.push(
          ReportService.getTopSellingProducts(
            {
              startDate: todayRangeUTC.startDate!,
              endDate: todayRangeUTC.endDate!,
            },
            3,
            user.id
          )
        );
      }

      // Purchase orders (requires purchase_orders.view)
      if (canViewPurchaseOrders) {
        promiseIndices.purchaseOrders = promises.length;
        promises.push(
          PurchaseOrderService.getPurchaseOrders(
            {
              page: 1,
              pageSize: 1,
              status: 'pending',
            },
            user.id
          )
        );
      }

      // Promotions (requires products.view)
      if (canViewProducts) {
        promiseIndices.promotions = promises.length;
        promises.push(PricingService.getActivePromotions(user.id));
      }

      // Execute all promises
      const results = await Promise.all(promises);

      // Process results based on indices
      if (promiseIndices.todayStats !== undefined) {
        const todayStatsResult = results[promiseIndices.todayStats] as DailySalesStatsResult;
        if (todayStatsResult.success && todayStatsResult.data && todayStatsResult.data.length > 0) {
          setTodayStats(todayStatsResult.data[0]);
        } else {
          setTodayStats({
            date: today,
            totalSales: 0,
            totalTransactions: 0,
            totalItems: 0,
            averageTransactionValue: 0,
          });
        }
      }

      if (promiseIndices.yesterdayStats !== undefined) {
        const yesterdayStatsResult = results[promiseIndices.yesterdayStats] as DailySalesStatsResult;
        if (yesterdayStatsResult.success && yesterdayStatsResult.data && yesterdayStatsResult.data.length > 0) {
          setYesterdayStats(yesterdayStatsResult.data[0]);
        } else {
          setYesterdayStats({
            date: yesterday,
            totalSales: 0,
            totalTransactions: 0,
            totalItems: 0,
            averageTransactionValue: 0,
          });
        }
      }

      if (promiseIndices.recentTransactions !== undefined) {
        const recentTransactionsResult = results[promiseIndices.recentTransactions] as { success: boolean; transactions?: Transaction[]; error?: string };
        if (recentTransactionsResult.success && recentTransactionsResult.transactions) {
          setRecentTransactions(recentTransactionsResult.transactions);
        }
      }

      if (promiseIndices.lowStockCount !== undefined) {
        const lowStockCountResult = results[promiseIndices.lowStockCount] as { success: boolean; count?: number; error?: string };
        if (lowStockCountResult.success && lowStockCountResult.count !== undefined) {
          setLowStockCount(lowStockCountResult.count);
        }
      }

      if (promiseIndices.inventoryReport !== undefined) {
        const inventoryReportResult = results[promiseIndices.inventoryReport] as { success: boolean; data?: { outOfStockItems?: number }; error?: string };
        if (inventoryReportResult.success && inventoryReportResult.data) {
          setOutOfStockCount(inventoryReportResult.data.outOfStockItems || 0);
        }
      }

      if (promiseIndices.topProducts !== undefined) {
        const topProductsResult = results[promiseIndices.topProducts] as TopSellingProductsResult;
        if (topProductsResult.success && topProductsResult.data) {
          setTopProducts(topProductsResult.data);
        }
      }

      if (promiseIndices.purchaseOrders !== undefined) {
        const purchaseOrdersResult = results[promiseIndices.purchaseOrders] as { success: boolean; total?: number; error?: string };
        if (purchaseOrdersResult.success && purchaseOrdersResult.total !== undefined) {
          setPendingPurchaseOrders(purchaseOrdersResult.total);
        }
      }

      if (promiseIndices.promotions !== undefined) {
        const promotionsResult = results[promiseIndices.promotions] as { success: boolean; promotions?: unknown[]; error?: string };
        if (promotionsResult.success && promotionsResult.promotions) {
          setActivePromotions(promotionsResult.promotions.length);
        }
      }

    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred while loading dashboard data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, showToast]);

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
      // Refresh every 5 minutes
      const interval = setInterval(loadDashboardData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user?.id, loadDashboardData]);

  const calculateChange = useCallback((today: number, yesterday: number): { percent: number; isPositive: boolean } => {
    if (yesterday === 0) {
      return { percent: today > 0 ? 100 : 0, isPositive: today > 0 };
    }
    const change = today - yesterday;
    const percent = (change / yesterday) * 100;
    return { percent: Math.abs(percent), isPositive: change >= 0 };
  }, []);

  // Memoize navigation handlers
  const handleNavigateToPOS = useCallback(() => {
    navigate(ROUTES.POS);
  }, [navigate]);

  const handleNavigateToInventoryLowStock = useCallback(() => {
    navigate(ROUTES.INVENTORY_LOW_STOCK);
  }, [navigate]);

  const handleNavigateToTransactions = useCallback(() => {
    navigate(ROUTES.TRANSACTIONS);
  }, [navigate]);

  const handleNavigateToInventory = useCallback(() => {
    navigate(ROUTES.INVENTORY);
  }, [navigate]);

  const handleNavigateToProducts = useCallback(() => {
    navigate(ROUTES.PRODUCTS);
  }, [navigate]);

  const handleNavigateToPurchaseOrders = useCallback(() => {
    navigate(ROUTES.PURCHASE_ORDERS);
  }, [navigate]);

  const handleNavigateToReports = useCallback(() => {
    navigate(ROUTES.REPORTS);
  }, [navigate]);

  const handleNavigateToAnalytics = useCallback(() => {
    navigate(ROUTES.ANALYTICS);
  }, [navigate]);

  // Memoize computed values
  const salesChange = useMemo(() => {
    if (!todayStats || !yesterdayStats) return null;
    return calculateChange(todayStats.totalSales, yesterdayStats.totalSales);
  }, [todayStats, yesterdayStats, calculateChange]);

  const transactionsChange = useMemo(() => {
    if (!todayStats || !yesterdayStats) return null;
    return calculateChange(todayStats.totalTransactions, yesterdayStats.totalTransactions);
  }, [todayStats, yesterdayStats, calculateChange]);

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
    mb: 4,
    flexWrap: 'wrap',
    gap: 2,
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: { xs: '20px', sm: '24px', md: '28px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const subtitleTypographySx = useMemo(() => ({
    fontSize: '16px',
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

  const posCardSx = useMemo(() => ({
    background: 'linear-gradient(135deg, #1a237e 0%, #000051 100%)',
    color: 'white',
    cursor: 'pointer',
    borderRadius: 0,
    border: '2px solid #000051',
    boxShadow: 'inset 1px 1px 0px 0px rgba(255, 255, 255, 0.1), inset -1px -1px 0px 0px rgba(0, 0, 0, 0.2)',
    '&:hover': {
      boxShadow: 'inset 1px 1px 0px 0px rgba(255, 255, 255, 0.15), inset -1px -1px 0px 0px rgba(0, 0, 0, 0.3)',
    },
  }), []);

  const posCardContentSx = useMemo(() => ({
    p: { xs: 3, md: 4 },
  }), []);

  const posTitleTypographySx = useMemo(() => ({
    fontSize: { xs: '24px', sm: '32px', md: '40px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const posSubtitleTypographySx = useMemo(() => ({
    opacity: 0.9,
    mb: 3,
    fontSize: { xs: '14px', sm: '16px', md: '18px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const launchPosButtonSx = useMemo(() => ({
    bgcolor: 'white',
    color: '#1a237e',
    borderRadius: 0,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    padding: '8px 20px',
    minHeight: '44px',
    border: '1px solid #ffffff',
    boxShadow: 'none',
    '&:hover': {
      bgcolor: 'rgba(255, 255, 255, 0.95)',
      boxShadow: 'none',
    },
  }), []);

  const statCardSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const performanceCardSx = useMemo(() => ({
    ...statCardSx,
    height: '100%',
    minHeight: '140px',
    display: 'flex',
    flexDirection: 'column',
  }), [statCardSx]);

  const activityCardSx = useMemo(() => ({
    ...statCardSx,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }), [statCardSx]);

  const statLabelTypographySx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const statValueTypographySx = useMemo(() => ({
    fontSize: { xs: '20px', sm: '24px', md: '28px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const changeCaptionTypographySx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const alertCardSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const alertTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const alertBodyTypographySx = useMemo(() => ({
    mb: 2,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const lowStockButtonSx = useMemo(() => ({
    backgroundColor: '#ed6c02',
    color: '#ffffff',
    borderRadius: 0,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    padding: '8px 20px',
    minHeight: '44px',
    border: '1px solid #e65100',
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: '#f57c00',
      boxShadow: 'none',
    },
    '&:disabled': {
      backgroundColor: '#f5f5f5',
      color: '#9e9e9e',
      borderColor: '#e0e0e0',
    },
  }), []);

  const quickActionButtonSx = useMemo(() => ({
    py: 1.5,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    borderColor: '#c0c0c0',
    color: '#1a237e',
    minHeight: '44px',
    '&:hover': {
      borderColor: '#1a237e',
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const viewAllButtonSx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    color: '#1a237e',
    minHeight: '40px',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const emptyStateBoxSx = useMemo(() => ({
    py: 4,
    textAlign: 'center',
  }), []);

  const emptyStateTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
    mb: 2,
  }), []);

  const startSaleButtonSx = useMemo(() => ({
    mt: 2,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    borderColor: '#c0c0c0',
    color: '#1a237e',
    minHeight: '44px',
    '&:hover': {
      borderColor: '#1a237e',
      backgroundColor: '#f5f5f5',
    },
  }), []);


  const transactionNumberTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const transactionTimeTypographySx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const transactionTotalTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const statusChipSx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const viewIconButtonSx = useMemo(() => ({
    padding: '8px',
    width: '48px',
    height: '48px',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
  }), []);

  const outOfStockButtonSx = useMemo(() => ({
    backgroundColor: '#d32f2f',
    color: '#ffffff',
    borderRadius: 0,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    padding: '8px 20px',
    minHeight: '44px',
    border: '1px solid #c62828',
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: '#c62828',
      boxShadow: 'none',
    },
    '&:disabled': {
      backgroundColor: '#f5f5f5',
      color: '#9e9e9e',
      borderColor: '#e0e0e0',
    },
  }), []);

  const purchaseOrderButtonSx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    borderColor: '#0288d1',
    color: '#0288d1',
    padding: '8px 20px',
    minHeight: '44px',
    '&:hover': {
      borderColor: '#0277bd',
      backgroundColor: '#f5f5f5',
    },
    '&:disabled': {
      borderColor: '#e0e0e0',
      color: '#9e9e9e',
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const topProductBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    py: 1.5,
  }), []);

  const topProductNameTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const topProductInfoTypographySx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const topProductChipSx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    borderColor: '#1a237e',
    color: '#1a237e',
  }), []);

  // Show loading overlay instead of replacing content
  const loadingOverlaySx = useMemo(() => ({
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 9999,
    pointerEvents: 'none',
  }), []);

  return (
    <MainLayout>
      {loading && (
        <Box sx={loadingOverlaySx}>
          <CircularProgress />
        </Box>
      )}
      <Box sx={containerBoxSx}>
        {/* Header Section */}
        <Box sx={headerBoxSx}>
          <Box>
            <Typography
              variant="h4"
              fontWeight="bold"
              gutterBottom
              sx={titleTypographySx}
            >
              Welcome back, {user?.username || 'User'}
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={subtitleTypographySx}
            >
              Here&apos;s what&apos;s happening today
            </Typography>
          </Box>
          <Tooltip title="Refresh Dashboard - Reload all dashboard statistics and data to get the latest information.">
            <Button
              variant="outlined"
              startIcon={<Refresh sx={{ fontSize: '18px' }} />}
              onClick={loadDashboardData}
              disabled={refreshing}
              sx={refreshButtonSx}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Tooltip>
        </Box>

        {/* Main POS Button - Hero Section */}
        {canCreateTransactions && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Card
                sx={posCardSx}
                onClick={handleNavigateToPOS}
              >
                <CardContent sx={posCardContentSx}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="h3"
                        fontWeight="bold"
                        gutterBottom
                        sx={posTitleTypographySx}
                      >
                        Open Point of Sale
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={posSubtitleTypographySx}
                      >
                        Start processing sales and transactions
                      </Typography>
                      <Tooltip title="Launch POS - Open the Point of Sale interface to process sales transactions, returns, and manage the shopping cart.">
                        <Button
                          variant="contained"
                          size="large"
                          startIcon={<PointOfSale />}
                          sx={launchPosButtonSx}
                        >
                          Launch POS
                        </Button>
                      </Tooltip>
                    </Box>
                    <Box sx={{ display: { xs: 'none', md: 'block' }, ml: 4 }}>
                      <PointOfSale sx={{ fontSize: 120, opacity: 0.2 }} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Today's Performance - Primary Metrics */}
        {(canViewTransactions || canViewReports) && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="h6"
              fontWeight="bold"
              sx={{ mb: 2, fontSize: '18px', fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              Today&apos;s Performance
            </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} lg={3}>
              <Card sx={performanceCardSx}>
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                        sx={statLabelTypographySx}
                      >
                        Today&apos;s Sales
                      </Typography>
                      <Typography
                        variant="h4"
                        fontWeight="bold"
                        color="primary"
                        sx={statValueTypographySx}
                      >
                        {formatCurrency(todayStats?.totalSales || 0)}
                      </Typography>
                      {yesterdayStats && salesChange && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                          {salesChange.isPositive ? (
                            <TrendingUp color="success" fontSize="small" />
                          ) : (
                            <TrendingDown color="error" fontSize="small" />
                          )}
                          <Typography
                            variant="caption"
                            sx={[
                              changeCaptionTypographySx,
                              { color: salesChange.isPositive ? '#2e7d32' : '#d32f2f' },
                            ]}
                          >
                            {salesChange.percent.toFixed(1)}% vs yesterday
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <AccountBalance sx={{ fontSize: { xs: 32, sm: 40 }, color: '#1a237e', opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} lg={3}>
              <Card sx={performanceCardSx}>
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                        sx={statLabelTypographySx}
                      >
                        Transactions
                      </Typography>
                      <Typography
                        variant="h4"
                        fontWeight="bold"
                        color="primary"
                        sx={statValueTypographySx}
                      >
                        {todayStats?.totalTransactions || 0}
                      </Typography>
                      {yesterdayStats && transactionsChange && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                          {transactionsChange.isPositive ? (
                            <TrendingUp sx={{ fontSize: '16px', color: '#2e7d32' }} />
                          ) : (
                            <TrendingDown sx={{ fontSize: '16px', color: '#d32f2f' }} />
                          )}
                          <Typography
                            variant="caption"
                            sx={[
                              changeCaptionTypographySx,
                              { color: transactionsChange.isPositive ? '#2e7d32' : '#d32f2f' },
                            ]}
                          >
                            {transactionsChange.percent.toFixed(1)}% vs yesterday
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <Receipt sx={{ fontSize: { xs: 32, sm: 40 }, color: '#1a237e', opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} lg={3}>
              <Card sx={performanceCardSx}>
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                        sx={statLabelTypographySx}
                      >
                        Items Sold
                      </Typography>
                      <Typography
                        variant="h4"
                        fontWeight="bold"
                        color="primary"
                        sx={statValueTypographySx}
                      >
                        {todayStats?.totalItems || 0}
                      </Typography>
                    </Box>
                    <ShoppingCart sx={{ fontSize: { xs: 32, sm: 40 }, color: '#1a237e', opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} lg={3}>
              <Card sx={performanceCardSx}>
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                        sx={statLabelTypographySx}
                      >
                        Avg. Transaction
                      </Typography>
                      <Typography
                        variant="h4"
                        fontWeight="bold"
                        sx={statValueTypographySx}
                      >
                        {formatCurrency(todayStats?.averageTransactionValue || 0)}
                      </Typography>
                    </Box>
                    <TrendingUp sx={{ fontSize: { xs: 32, sm: 40 }, color: '#1a237e', opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          </Box>
        )}

        {/* Inventory & Operations Status */}
        {canViewInventory && (
          <Box sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            fontWeight="bold"
            sx={{ mb: 2, fontSize: '18px', fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            Inventory & Operations
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={statCardSx}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                        sx={statLabelTypographySx}
                      >
                        Low Stock Items
                      </Typography>
                      <Typography
                        variant="h4"
                        fontWeight="bold"
                        sx={[
                          statValueTypographySx,
                          { color: lowStockCount > 0 ? '#ed6c02' : '#2e7d32' },
                        ]}
                      >
                        {lowStockCount}
                      </Typography>
                    </Box>
                    <Inventory sx={{ fontSize: { xs: 32, sm: 40 }, color: lowStockCount > 0 ? '#ed6c02' : '#2e7d32', opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={statCardSx}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                        sx={statLabelTypographySx}
                      >
                        Out of Stock
                      </Typography>
                      <Typography
                        variant="h4"
                        fontWeight="bold"
                        sx={[
                          statValueTypographySx,
                          { color: outOfStockCount > 0 ? '#d32f2f' : '#2e7d32' },
                        ]}
                      >
                        {outOfStockCount}
                      </Typography>
                    </Box>
                    <Cancel sx={{ fontSize: { xs: 32, sm: 40 }, color: outOfStockCount > 0 ? '#d32f2f' : '#2e7d32', opacity: 0.7 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {canViewPurchaseOrders && (
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={statCardSx}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          gutterBottom
                          sx={statLabelTypographySx}
                        >
                          Pending Orders
                        </Typography>
                        <Typography
                          variant="h4"
                          fontWeight="bold"
                          sx={[
                            statValueTypographySx,
                            { color: pendingPurchaseOrders > 0 ? '#ed6c02' : '#616161' },
                          ]}
                        >
                          {pendingPurchaseOrders}
                        </Typography>
                      </Box>
                      <LocalShipping sx={{ fontSize: { xs: 32, sm: 40 }, color: pendingPurchaseOrders > 0 ? '#ed6c02' : '#616161', opacity: 0.7 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {canViewProducts && (
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={statCardSx}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          gutterBottom
                          sx={statLabelTypographySx}
                        >
                          Active Promotions
                        </Typography>
                        <Typography
                          variant="h4"
                          fontWeight="bold"
                          sx={statValueTypographySx}
                        >
                          {activePromotions}
                        </Typography>
                      </Box>
                      <LocalOffer sx={{ fontSize: { xs: 32, sm: 40 }, color: '#1a237e', opacity: 0.7 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
          </Box>
        )}

        {/* Alerts Section */}
        {(canViewInventory || canViewPurchaseOrders || canViewSuppliers) && (
          <Box sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            fontWeight="bold"
            sx={{ mb: 2, fontSize: '18px', fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            Alerts & Notifications
          </Typography>
          <Grid container spacing={3}>
            {canViewSuppliers && (
              <Grid item xs={12}>
                <PaymentReminders maxItems={5} showActions={true} />
              </Grid>
            )}
            {canViewInventory && (
              <>
                <Grid item xs={12} md={4}>
                  <Card
                    sx={[
                      alertCardSx,
                      {
                        borderLeft: '4px solid #ed6c02',
                        opacity: lowStockCount > 0 ? 1 : 0.7,
                      },
                    ]}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Warning sx={{ mr: 1, fontSize: 32, color: '#ed6c02' }} />
                        <Typography
                          variant="h6"
                          fontWeight="bold"
                          sx={alertTitleTypographySx}
                        >
                          Low Stock Alert
                        </Typography>
                      </Box>
                      <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={alertBodyTypographySx}
                      >
                        {lowStockCount > 0 ? (
                          <>You have <strong>{lowStockCount}</strong> {lowStockCount === 1 ? 'item' : 'items'} that need restocking.</>
                        ) : (
                          <>All items are well stocked.</>
                        )}
                      </Typography>
                      <Tooltip title={lowStockCount === 0 ? "No low stock items" : "View Low Stock Items - Navigate to inventory page filtered to show products with low stock levels that need restocking."}>
                        <span>
                          <Button
                            variant="contained"
                            endIcon={<ArrowForward sx={{ fontSize: '18px' }} />}
                            onClick={handleNavigateToInventoryLowStock}
                            sx={lowStockButtonSx}
                            disabled={lowStockCount === 0}
                          >
                            View Low Stock Items
                          </Button>
                        </span>
                      </Tooltip>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card
                    sx={[
                      alertCardSx,
                      {
                        borderLeft: '4px solid #d32f2f',
                        opacity: outOfStockCount > 0 ? 1 : 0.7,
                      },
                    ]}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Cancel sx={{ mr: 1, fontSize: 32, color: '#d32f2f' }} />
                        <Typography
                          variant="h6"
                          fontWeight="bold"
                          sx={alertTitleTypographySx}
                        >
                          Out of Stock Alert
                        </Typography>
                      </Box>
                      <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={alertBodyTypographySx}
                      >
                        {outOfStockCount > 0 ? (
                          <>You have <strong>{outOfStockCount}</strong> {outOfStockCount === 1 ? 'item' : 'items'} that are out of stock.</>
                        ) : (
                          <>No items are out of stock.</>
                        )}
                      </Typography>
                      <Tooltip title={outOfStockCount === 0 ? "No out of stock items" : "View Inventory - Navigate to inventory page filtered to show products that are currently out of stock."}>
                        <span>
                          <Button
                            variant="contained"
                            endIcon={<ArrowForward sx={{ fontSize: '18px' }} />}
                            onClick={handleNavigateToInventory}
                            sx={outOfStockButtonSx}
                            disabled={outOfStockCount === 0}
                          >
                            View Inventory
                          </Button>
                        </span>
                      </Tooltip>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}

            {canViewPurchaseOrders && (
              <Grid item xs={12} md={4}>
                <Card
                  sx={[
                    alertCardSx,
                    {
                      borderLeft: '4px solid #0288d1',
                      opacity: pendingPurchaseOrders > 0 ? 1 : 0.7,
                    },
                  ]}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <LocalShipping sx={{ mr: 1, fontSize: 32, color: '#0288d1' }} />
                      <Typography
                        variant="h6"
                        fontWeight="bold"
                        sx={alertTitleTypographySx}
                      >
                        Pending Purchase Orders
                      </Typography>
                    </Box>
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      sx={alertBodyTypographySx}
                    >
                      {pendingPurchaseOrders > 0 ? (
                        <>You have <strong>{pendingPurchaseOrders}</strong> {pendingPurchaseOrders === 1 ? 'order' : 'orders'} pending.</>
                      ) : (
                        <>No pending purchase orders.</>
                      )}
                    </Typography>
                    <Tooltip title={pendingPurchaseOrders === 0 ? "No pending purchase orders" : "View Purchase Orders - Navigate to purchase orders page to view and manage pending orders from suppliers."}>
                      <span>
                        <Button
                          variant="outlined"
                          endIcon={<ArrowForward sx={{ fontSize: '18px' }} />}
                          onClick={handleNavigateToPurchaseOrders}
                          sx={purchaseOrderButtonSx}
                          disabled={pendingPurchaseOrders === 0}
                        >
                          View Purchase Orders
                        </Button>
                      </span>
                    </Tooltip>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
          </Box>
        )}

        {/* Quick Actions & Activity Section */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Quick Actions */}
          <Grid item xs={12} md={4}>
            <Card sx={activityCardSx}>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  gutterBottom
                  sx={alertTitleTypographySx}
                >
                  Quick Actions
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {canViewTransactions && (
                    <Grid item xs={6}>
                      <Tooltip title="View Transactions - Navigate to the transactions page to view, search, and manage all sales and return transactions.">
                        <span>
                          <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<Receipt sx={{ fontSize: '18px' }} />}
                            onClick={handleNavigateToTransactions}
                            sx={quickActionButtonSx}
                          >
                            Transactions
                          </Button>
                        </span>
                      </Tooltip>
                    </Grid>
                  )}
                  {canViewInventory && (
                    <Grid item xs={6}>
                      <Tooltip title="View Inventory - Navigate to the inventory page to view stock levels, adjust quantities, and manage product inventory.">
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<Inventory sx={{ fontSize: '18px' }} />}
                          onClick={handleNavigateToInventory}
                          sx={quickActionButtonSx}
                        >
                          Inventory
                        </Button>
                      </Tooltip>
                    </Grid>
                  )}
                  {canViewProducts && (
                    <Grid item xs={6}>
                      <Tooltip title="View Products - Navigate to the products page to view, add, edit, and manage all products in your store.">
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<Category sx={{ fontSize: '18px' }} />}
                          onClick={handleNavigateToProducts}
                          sx={quickActionButtonSx}
                        >
                          Products
                        </Button>
                      </Tooltip>
                    </Grid>
                  )}
                  {canViewPurchaseOrders && (
                    <Grid item xs={6}>
                      <Tooltip title="View Purchase Orders - Navigate to the purchase orders page to create, view, and manage orders from suppliers.">
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<LocalShipping sx={{ fontSize: '18px' }} />}
                          onClick={handleNavigateToPurchaseOrders}
                          sx={quickActionButtonSx}
                        >
                          Purchase Orders
                        </Button>
                      </Tooltip>
                    </Grid>
                  )}
                  {canViewReports && (
                    <>
                      <Grid item xs={6}>
                        <Tooltip title="View Reports - Navigate to the reports page to generate and view sales, inventory, financial, and other business reports.">
                          <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<Assessment sx={{ fontSize: '18px' }} />}
                            onClick={handleNavigateToReports}
                            sx={quickActionButtonSx}
                          >
                            Reports
                          </Button>
                        </Tooltip>
                      </Grid>
                      <Grid item xs={6}>
                        <Tooltip title="View Analytics - Navigate to the analytics page to view charts, trends, and insights about your business performance.">
                          <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<Assessment sx={{ fontSize: '18px' }} />}
                            onClick={handleNavigateToAnalytics}
                            sx={quickActionButtonSx}
                          >
                            Analytics
                          </Button>
                        </Tooltip>
                      </Grid>
                    </>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Today's Top Products */}
          {(canViewReports || canViewTransactions) && (
            <Grid item xs={12} md={4}>
              <Card sx={activityCardSx}>
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    gutterBottom
                    sx={alertTitleTypographySx}
                  >
                    Top Products Today
                  </Typography>
                {topProducts.length === 0 ? (
                  <Box sx={{ ...emptyStateBoxSx, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <ShoppingCart sx={{ fontSize: 48, color: '#9e9e9e', mb: 2, opacity: 0.5 }} />
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      sx={emptyStateTypographySx}
                    >
                      No products sold today
                    </Typography>
                    <Tooltip title="Start Your First Sale - Launch the Point of Sale interface to begin processing sales transactions.">
                      <Button
                        variant="outlined"
                        startIcon={<PointOfSale sx={{ fontSize: '18px' }} />}
                        onClick={handleNavigateToPOS}
                        sx={startSaleButtonSx}
                      >
                        Start Your First Sale
                      </Button>
                    </Tooltip>
                  </Box>
                ) : (
                  <Box sx={{ mt: 2, flex: 1 }}>
                    {topProducts.map((product, index) => (
                      <Box
                        key={product.productId}
                        sx={[
                          topProductBoxSx,
                          {
                            borderBottom: index < topProducts.length - 1 ? '1px solid' : 'none',
                            borderColor: '#e0e0e0',
                          },
                        ]}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            sx={topProductNameTypographySx}
                          >
                            {product.productName}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={topProductInfoTypographySx}
                          >
                            {product.quantitySold} sold • {formatCurrency(product.revenue)}
                          </Typography>
                        </Box>
                        <Chip
                          label={`#${index + 1}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={topProductChipSx}
                        />
                      </Box>
                    ))}
                  </Box>
                )}
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Recent Transactions */}
          {canViewTransactions && (
            <Grid item xs={12} md={4}>
            <Card sx={activityCardSx}>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    sx={alertTitleTypographySx}
                  >
                    Recent Transactions
                  </Typography>
                  <Tooltip title="View All Transactions - Navigate to the transactions page to see all transaction history.">
                    <span>
                      <Button
                        size="small"
                        endIcon={<ArrowForward sx={{ fontSize: '16px' }} />}
                        onClick={handleNavigateToTransactions}
                        sx={viewAllButtonSx}
                      >
                        View All
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
                {recentTransactions.length === 0 ? (
                  <Box sx={{ ...emptyStateBoxSx, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <Receipt sx={{ fontSize: 48, color: '#9e9e9e', mb: 2, opacity: 0.5 }} />
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      sx={emptyStateTypographySx}
                    >
                      No transactions today
                    </Typography>
                    <Tooltip title="Start Your First Sale - Launch the Point of Sale interface to begin processing sales transactions.">
                      <Button
                        variant="outlined"
                        startIcon={<PointOfSale sx={{ fontSize: '18px' }} />}
                        onClick={handleNavigateToPOS}
                        sx={startSaleButtonSx}
                      >
                        Start Your First Sale
                      </Button>
                    </Tooltip>
                  </Box>
                ) : (
                  <Box sx={{ flex: 1 }}>
                    {recentTransactions.slice(0, 5).map((transaction) => (
                      <Box
                        key={transaction.id}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          py: 1.5,
                          borderBottom: '1px solid #e0e0e0',
                          '&:last-child': {
                            borderBottom: 'none',
                          },
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            sx={transactionNumberTypographySx}
                          >
                            {transaction.transactionNumber}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={transactionTimeTypographySx}
                          >
                            {formatDateTime(transaction.createdAt)}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right', mr: 1 }}>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={transactionTotalTypographySx}
                          >
                            {formatCurrency(transaction.total)}
                          </Typography>
                          <Chip
                            label={transaction.status}
                            color={
                              transaction.status === 'completed'
                                ? 'success'
                                : transaction.status === 'voided'
                                  ? 'error'
                                  : 'default'
                            }
                            size="small"
                            sx={[statusChipSx, { mt: 0.5 }]}
                          />
                        </Box>
                        <Tooltip title="View Transaction Details - Navigate to the transactions page to view full details of this transaction.">
                          <IconButton
                            size="small"
                            onClick={handleNavigateToTransactions}
                            sx={viewIconButtonSx}
                          >
                            <Visibility sx={{ fontSize: '18px', color: '#616161' }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          )}
        </Grid>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default Dashboard;
