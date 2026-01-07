import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
  Tooltip,
} from '@mui/material';
import { TrendingUp, ShoppingCart, Receipt, AccountBalance, Refresh } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ReportService, DailySalesStats, TopSellingProduct, DateRange, SalesReportData, InventoryReportData } from '../../services/report.service';
import MainLayout from '../../components/layout/MainLayout';
import SalesTrendChart from './components/SalesTrendChart';
import TopProductsChart from './components/TopProductsChart';
import SalesByCashierChart from './components/SalesByCashierChart';
import InventoryStatusChart from './components/InventoryStatusChart';
import { formatCurrency } from '../../utils/formatters';
import FilterHeader from '../../components/common/FilterHeader';
import { getRelativeDateRange, convertDateRangeToUTC } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { usePermission } from '../../hooks/usePermission';
import { PermissionService } from '../../services/permission.service';

const AnalyticsPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  // Permission checks
  const canViewTransactions = usePermission('transactions.view');
  const canViewReports = usePermission('reports.view');
  const canViewInventory = usePermission('inventory.view');
  // Initialize with last 30 days in Beirut timezone
  const initialRange = getRelativeDateRange('last30days');
  const [dateRange, setDateRange] = useState<DateRange>(initialRange);
  const [quickRange, setQuickRange] = useState<string>('30days');
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<DailySalesStats[]>([]);
  const [topProducts, setTopProducts] = useState<TopSellingProduct[]>([]);
  const [salesReport, setSalesReport] = useState<SalesReportData | null>(null);
  const [inventoryReport, setInventoryReport] = useState<InventoryReportData | null>(null);

  const checkDateRangeMatch = useCallback((startDate: Date, endDate: Date): string | null => {
    const now = new Date();
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Helper to compare dates by date only (ignore time)
    const compareDates = (date1: Date, date2: Date): boolean => {
      return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
      );
    };

    // Check today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    if (compareDates(start, todayStart) && compareDates(end, todayEnd)) {
      return 'today';
    }

    // Check last 7 days
    const sevenDaysStart = new Date(now);
    sevenDaysStart.setDate(now.getDate() - 7);
    sevenDaysStart.setHours(0, 0, 0, 0);
    if (compareDates(start, sevenDaysStart) && compareDates(end, todayEnd)) {
      return '7days';
    }

    // Check last 30 days
    const thirtyDaysStart = new Date(now);
    thirtyDaysStart.setDate(now.getDate() - 30);
    thirtyDaysStart.setHours(0, 0, 0, 0);
    if (compareDates(start, thirtyDaysStart) && compareDates(end, todayEnd)) {
      return '30days';
    }

    // Check last 90 days
    const ninetyDaysStart = new Date(now);
    ninetyDaysStart.setDate(now.getDate() - 90);
    ninetyDaysStart.setHours(0, 0, 0, 0);
    if (compareDates(start, ninetyDaysStart) && compareDates(end, todayEnd)) {
      return '90days';
    }

    // Check this month
    const thisMonthStart = new Date(now);
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    if (compareDates(start, thisMonthStart) && compareDates(end, todayEnd)) {
      return 'thisMonth';
    }

    // Check last month
    const lastMonthStart = new Date(now);
    lastMonthStart.setMonth(now.getMonth() - 1);
    lastMonthStart.setDate(1);
    lastMonthStart.setHours(0, 0, 0, 0);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    lastMonthEnd.setHours(23, 59, 59, 999);
    if (compareDates(start, lastMonthStart) && compareDates(end, lastMonthEnd)) {
      return 'lastMonth';
    }

    // Check this year
    const thisYearStart = new Date(now);
    thisYearStart.setMonth(0, 1);
    thisYearStart.setHours(0, 0, 0, 0);
    if (compareDates(start, thisYearStart) && compareDates(end, todayEnd)) {
      return 'thisYear';
    }

    return null;
  }, []);

  const handleQuickRangeChange = useCallback((range: string) => {
    if (range === 'custom') {
      setQuickRange('custom');
      return;
    }

    setQuickRange(range);
    // Use timezone-aware relative date range
    const newRange = getRelativeDateRange(range);
    setDateRange(newRange);
  }, []);

  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    setDateRange(newDateRange);
    const matchedRange = checkDateRangeMatch(newDateRange.startDate, newDateRange.endDate);
    if (matchedRange) {
      setQuickRange(matchedRange);
    } else {
      setQuickRange('custom');
    }
  }, [checkDateRangeMatch]);

  const loadAnalytics = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      // Check permissions before loading data
      const canViewTransactions = await PermissionService.userHasPermission(user.id, 'transactions.view');
      const canViewReports = await PermissionService.userHasPermission(user.id, 'reports.view');
      const canViewInventory = await PermissionService.userHasPermission(user.id, 'inventory.view');

      // Convert date range from Beirut timezone to UTC for API
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(
        dateRange.startDate,
        dateRange.endDate
      );
      const dateRangeUTC: DateRange = {
        startDate: startDateUTC!,
        endDate: endDateUTC!,
      };

      // Build array of promises conditionally based on permissions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const promises: Promise<any>[] = [];
      const promiseIndices: { [key: string]: number } = {};

      // Sales data (requires reports.view or transactions.view)
      if (canViewReports || canViewTransactions) {
        promiseIndices.dailyStats = promises.length;
        promises.push(ReportService.getDailySalesStats(dateRangeUTC, user.id));
        
        promiseIndices.topProducts = promises.length;
        promises.push(ReportService.getTopSellingProducts(dateRangeUTC, 10, user.id));
        
        promiseIndices.salesReport = promises.length;
        promises.push(ReportService.getSalesReport({ ...dateRangeUTC, groupBy: 'day' }, user.id));
      }

      // Inventory data (requires inventory.view)
      if (canViewInventory) {
        promiseIndices.inventoryReport = promises.length;
        promises.push(ReportService.getInventoryReport({}, user.id));
      }

      // Execute all promises
      const results = await Promise.all(promises);

      // Process results based on indices
      if (promiseIndices.dailyStats !== undefined) {
        const dailyStatsResult = results[promiseIndices.dailyStats];
        if (dailyStatsResult.success && dailyStatsResult.data) {
          setDailyStats(dailyStatsResult.data);
        } else {
          setDailyStats([]);
        }
      } else {
        setDailyStats([]);
      }

      if (promiseIndices.topProducts !== undefined) {
        const topProductsResult = results[promiseIndices.topProducts];
        if (topProductsResult.success && topProductsResult.data) {
          setTopProducts(topProductsResult.data);
        } else {
          setTopProducts([]);
        }
      } else {
        setTopProducts([]);
      }

      if (promiseIndices.salesReport !== undefined) {
        const salesReportResult = results[promiseIndices.salesReport];
        if (salesReportResult.success && salesReportResult.data) {
          setSalesReport(salesReportResult.data);
        } else {
          setSalesReport(null);
        }
      } else {
        setSalesReport(null);
      }

      if (promiseIndices.inventoryReport !== undefined) {
        const inventoryReportResult = results[promiseIndices.inventoryReport];
        if (inventoryReportResult.success && inventoryReportResult.data) {
          setInventoryReport(inventoryReportResult.data);
        } else {
          setInventoryReport(null);
        }
      } else {
        setInventoryReport(null);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred while loading analytics', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange, user?.id, showToast]);

  useEffect(() => {
    if (user?.id) {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, dateRange]);

  const handleClearFilters = useCallback(() => {
    const defaultRange = getRelativeDateRange('last30days');
    setDateRange(defaultRange);
    setQuickRange('30days');
  }, []);

  const handleRefresh = useCallback(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    p: 4,
    backgroundColor: '#f5f5f5',
    minHeight: '400px',
  }), []);

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
  }), []);

  const cardSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const cardContentSx = useMemo(() => ({
    p: 2,
  }), []);

  const cardIconBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    mb: 1,
  }), []);

  const cardTitleTypographySx = useMemo(() => ({
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const cardValueTypographySx = useMemo(() => ({
    fontSize: '24px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
    fontWeight: 600,
  }), []);

  const errorAlertSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    backgroundColor: '#ffebee',
  }), []);

  const iconSx = useMemo(() => ({
    mr: 1,
    color: '#1a237e',
    fontSize: '20px',
  }), []);

  // Memoize summary stats calculations
  const summaryStats = useMemo(() => {
    const totalSales = dailyStats.reduce((sum, stat) => sum + stat.totalSales, 0);
    const totalTransactions = dailyStats.reduce((sum, stat) => sum + stat.totalTransactions, 0);
    const totalItems = dailyStats.reduce((sum, stat) => sum + stat.totalItems, 0);
    const avgTransactionValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    return { totalSales, totalTransactions, totalItems, avgTransactionValue };
  }, [dailyStats]);

  // Memoize FilterHeader field handlers
  const handleQuickRangeSelectChange = useCallback((value: unknown) => {
    handleQuickRangeChange(value as string);
  }, [handleQuickRangeChange]);

  const handleStartDateChange = useCallback((value: unknown) => {
    if (value) {
      handleDateRangeChange({ ...dateRange, startDate: value as Date });
    }
  }, [dateRange, handleDateRangeChange]);

  const handleEndDateChange = useCallback((value: unknown) => {
    if (value) {
      handleDateRangeChange({ ...dateRange, endDate: value as Date });
    }
  }, [dateRange, handleDateRangeChange]);

  // Memoize FilterHeader fields configuration
  const filterFields = useMemo(() => [
    {
      type: 'select' as const,
      label: 'Quick Range',
      value: quickRange,
      onChange: handleQuickRangeSelectChange,
      options: [
        { value: 'today', label: 'Today' },
        { value: '7days', label: 'Last 7 Days' },
        { value: '30days', label: 'Last 30 Days' },
        { value: '90days', label: 'Last 90 Days' },
        { value: 'thisMonth', label: 'This Month' },
        { value: 'lastMonth', label: 'Last Month' },
        { value: 'thisYear', label: 'This Year' },
        { value: 'custom', label: 'Custom' },
      ],
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'date' as const,
      label: 'Start Date',
      value: dateRange.startDate,
      onChange: handleStartDateChange,
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'date' as const,
      label: 'End Date',
      value: dateRange.endDate,
      onChange: handleEndDateChange,
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
  ], [quickRange, dateRange, handleQuickRangeSelectChange, handleStartDateChange, handleEndDateChange]);

  if (!user?.id) {
    return (
      <MainLayout>
        <Box sx={containerBoxSx}>
          <Alert severity="error" sx={errorAlertSx}>
            You must be logged in to view analytics.
          </Alert>
        </Box>
        <Toast toast={toast} onClose={hideToast} />
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <Box sx={loadingBoxSx}>
          <CircularProgress />
        </Box>
        <Toast toast={toast} onClose={hideToast} />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography variant="h4" fontWeight="bold" sx={titleTypographySx}>
            Analytics Dashboard
          </Typography>
          <Tooltip title={loading ? "Refreshing analytics..." : "Refresh Analytics - Reload all analytics data and charts to get the latest information from the database."}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
              disabled={loading}
              sx={refreshButtonSx}
            >
              Refresh
            </Button>
          </Tooltip>
        </Box>

        {/* Filter Header - Only show if user has at least one permission */}
        {(canViewReports || canViewTransactions || canViewInventory) && (
          <FilterHeader
            onClear={handleClearFilters}
            fields={filterFields}
          />
        )}

        {/* KPI Cards - Only show if user has reports.view or transactions.view */}
        {(canViewReports || canViewTransactions) && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={cardSx}>
                <CardContent sx={cardContentSx}>
                  <Box sx={cardIconBoxSx}>
                    <TrendingUp sx={iconSx} />
                    <Typography sx={cardTitleTypographySx}>
                      Total Sales
                    </Typography>
                  </Box>
                  <Typography sx={cardValueTypographySx}>
                    {formatCurrency(summaryStats.totalSales)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={cardSx}>
                <CardContent sx={cardContentSx}>
                  <Box sx={cardIconBoxSx}>
                    <Receipt sx={iconSx} />
                    <Typography sx={cardTitleTypographySx}>
                      Transactions
                    </Typography>
                  </Box>
                  <Typography sx={cardValueTypographySx}>
                    {summaryStats.totalTransactions}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={cardSx}>
                <CardContent sx={cardContentSx}>
                  <Box sx={cardIconBoxSx}>
                    <ShoppingCart sx={iconSx} />
                    <Typography sx={cardTitleTypographySx}>
                      Items Sold
                    </Typography>
                  </Box>
                  <Typography sx={cardValueTypographySx}>
                    {summaryStats.totalItems}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={cardSx}>
                <CardContent sx={cardContentSx}>
                  <Box sx={cardIconBoxSx}>
                    <AccountBalance sx={iconSx} />
                    <Typography sx={cardTitleTypographySx}>
                      Avg. Transaction
                    </Typography>
                  </Box>
                  <Typography sx={cardValueTypographySx}>
                    {formatCurrency(summaryStats.avgTransactionValue)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Charts */}
        {(canViewReports || canViewTransactions || canViewInventory) && (
          <Grid container spacing={3}>
            {/* Sales Trend Chart - requires reports.view or transactions.view */}
            {(canViewReports || canViewTransactions) && (
              <Grid item xs={12} md={8}>
                <SalesTrendChart data={dailyStats} />
              </Grid>
            )}

            {/* Top Products Chart - requires reports.view or transactions.view */}
            {(canViewReports || canViewTransactions) && (
              <Grid item xs={12} md={4}>
                <TopProductsChart data={topProducts} />
              </Grid>
            )}

            {/* Sales by Cashier Chart - requires reports.view or transactions.view */}
            {(canViewReports || canViewTransactions) && (
              <Grid item xs={12} md={canViewInventory ? 6 : 12}>
                <SalesByCashierChart data={salesReport?.salesByCashier || []} />
              </Grid>
            )}

            {/* Inventory Status Chart - requires inventory.view */}
            {canViewInventory && inventoryReport && (
              <Grid item xs={12} md={(canViewReports || canViewTransactions) ? 6 : 12}>
                <InventoryStatusChart data={inventoryReport} />
              </Grid>
            )}
          </Grid>
        )}
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default AnalyticsPage;

