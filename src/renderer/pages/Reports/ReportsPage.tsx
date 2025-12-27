import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Button,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  Inventory,
  AccountBalance,
  ShoppingBag,
  LocalShipping,
  Schedule,
  Refresh,
  CompareArrows,
  FolderOpen,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { RootState } from '../../store';
import { DateRange, OptionalDateRange, ScheduledReportService } from '../../services/report.service';
import MainLayout from '../../components/layout/MainLayout';
import SalesReportTab from './components/SalesReportTab';
import SalesComparisonReportTab from './components/SalesComparisonReportTab';
import InventoryReportTab from './components/InventoryReportTab';
import FinancialReportTab from './components/FinancialReportTab';
import ProductReportTab from './components/ProductReportTab';
import PurchaseSupplierReportTab from './components/PurchaseSupplierReportTab';
import ScheduledReportsTab from './components/ScheduledReportsTab';
import FilterHeader from '../../components/common/FilterHeader';
import { getRelativeDateRange } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { usePermission } from '../../hooks/usePermission';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  const tabPanelBoxSx = useMemo(() => ({
    p: 3,
  }), []);

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`report-tabpanel-${index}`}
      aria-labelledby={`report-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={tabPanelBoxSx}>{children}</Box>}
    </div>
  );
};

const ReportsPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(0);

  // Permission checks
  const canViewTransactions = usePermission('transactions.view');
  const canViewReports = usePermission('reports.view');
  const canViewInventory = usePermission('inventory.view');
  const canViewProducts = usePermission('products.view');
  const canViewPurchaseOrders = usePermission('purchase_orders.view');
  const canViewSuppliers = usePermission('suppliers.view');

  // Determine which tabs are available based on permissions
  const availableTabs = useMemo(() => {
    const tabs: number[] = [];
    
    // Tab 0: Sales Reports - requires reports.view or transactions.view
    if (canViewReports || canViewTransactions) {
      tabs.push(0);
    }
    
    // Tab 1: Sales Comparison - requires reports.view or transactions.view
    if (canViewReports || canViewTransactions) {
      tabs.push(1);
    }
    
    // Tab 2: Inventory Reports - requires inventory.view
    if (canViewInventory) {
      tabs.push(2);
    }
    
    // Tab 3: Financial Reports - requires reports.view or transactions.view
    if (canViewReports || canViewTransactions) {
      tabs.push(3);
    }
    
    // Tab 4: Product Reports - requires reports.view or products.view
    if (canViewReports || canViewProducts) {
      tabs.push(4);
    }
    
    // Tab 5: Purchase & Supplier Reports - requires purchase_orders.view or suppliers.view
    if (canViewPurchaseOrders || canViewSuppliers) {
      tabs.push(5);
    }
    
    // Tab 6: Scheduled Reports - requires reports.view
    if (canViewReports) {
      tabs.push(6);
    }
    
    return tabs;
  }, [canViewReports, canViewTransactions, canViewInventory, canViewProducts, canViewPurchaseOrders, canViewSuppliers]);

  // Map tab index to actual tab index (accounting for hidden tabs)
  const getActualTabIndex = useCallback((displayIndex: number) => {
    return availableTabs[displayIndex] ?? 0;
  }, [availableTabs]);

  // Get display index from actual tab index
  const getDisplayIndex = useCallback((actualIndex: number) => {
    return availableTabs.indexOf(actualIndex);
  }, [availableTabs]);
  // Initialize with timezone-aware date ranges
  const initialRange = getRelativeDateRange('last30days');
  const [dateRange, setDateRange] = useState<DateRange>(initialRange);
  const [quickRange, setQuickRange] = useState<string>('30days');
  const [currency, setCurrency] = useState<'USD' | 'LBP' | 'ALL'>('ALL');
  // Initialize with empty date ranges
  const [period1Range, setPeriod1Range] = useState<OptionalDateRange>({
    startDate: null,
    endDate: null,
  });
  const [period2Range, setPeriod2Range] = useState<OptionalDateRange>({
    startDate: null,
    endDate: null,
  });
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check URL params for tab on mount
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const tabIndex = parseInt(tabParam, 10);
      if (!isNaN(tabIndex) && tabIndex >= 0 && tabIndex <= 6) {
        // Check if the requested tab is available
        const displayIndex = getDisplayIndex(tabIndex);
        if (displayIndex !== -1) {
          setActiveTab(displayIndex);
        } else if (availableTabs.length > 0) {
          // If requested tab is not available, use first available tab
          setActiveTab(0);
        }
        // Remove the tab param from URL after setting it
        searchParams.delete('tab');
        setSearchParams(searchParams, { replace: true });
      }
    } else if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      // If current active tab is not available, switch to first available
      setActiveTab(0);
    }
  }, [searchParams, setSearchParams, availableTabs, getDisplayIndex, activeTab]);

  useEffect(() => {
    if (!user?.id) {
      showToast('You must be logged in to view reports', 'error');
    }
  }, [user?.id, showToast]);

  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  }, []);

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

  const handleClearFilters = useCallback(() => {
    const defaultRange = getRelativeDateRange('last30days');
    setDateRange(defaultRange);
    setQuickRange('30days');
    setCurrency('ALL');
  }, []);

  const handleClearComparisonFilters = useCallback(() => {
    // Clear all date ranges to empty
    setPeriod1Range({
      startDate: null,
      endDate: null,
    });
    setPeriod2Range({
      startDate: null,
      endDate: null,
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setRefreshKey((prev) => prev + 1);
    // Reset loading after a delay to allow tabs to start loading
    // The tabs will show their own loading states while data loads
    setTimeout(() => {
      setLoading(false);
    }, 1500);
  }, []);

  const handleOpenExportedReportsFolder = useCallback(async () => {
    try {
      const result = await ScheduledReportService.openExportedReportsFolder();
      if (!result.success) {
        showToast(result.error || 'Failed to open exported reports folder', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  }, [showToast]);

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
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontWeight: 600,
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

  const paperSx = useMemo(() => ({
    mb: 2,
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const tabsSx = useMemo(() => ({
    borderBottom: '1px solid #c0c0c0',
    '& .MuiTab-root': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textTransform: 'none',
      minHeight: '48px',
      '&.Mui-selected': {
        color: '#1a237e',
      },
    },
    '& .MuiTabs-indicator': {
      backgroundColor: '#1a237e',
    },
  }), []);

  const handleQuickRangeSelectChange = useCallback((value: unknown) => {
    handleQuickRangeChange(value as string);
  }, [handleQuickRangeChange]);

  const handleStartDateChange = useCallback((value: unknown) => {
    const dateValue = value as Date | null;
    if (dateValue) {
      handleDateRangeChange({ ...dateRange, startDate: dateValue });
    }
  }, [dateRange, handleDateRangeChange]);

  const handleEndDateChange = useCallback((value: unknown) => {
    const dateValue = value as Date | null;
    if (dateValue) {
      handleDateRangeChange({ ...dateRange, endDate: dateValue });
    }
  }, [dateRange, handleDateRangeChange]);

  const handlePeriod1StartChange = useCallback((value: unknown) => {
    setPeriod1Range((prev) => ({ ...prev, startDate: value as Date | null }));
  }, []);

  const handlePeriod1EndChange = useCallback((value: unknown) => {
    setPeriod1Range((prev) => ({ ...prev, endDate: value as Date | null }));
  }, []);

  const handlePeriod2StartChange = useCallback((value: unknown) => {
    setPeriod2Range((prev) => ({ ...prev, startDate: value as Date | null }));
  }, []);

  const handlePeriod2EndChange = useCallback((value: unknown) => {
    setPeriod2Range((prev) => ({ ...prev, endDate: value as Date | null }));
  }, []);

  const handleCurrencyChange = useCallback((value: unknown) => {
    setCurrency(value as 'USD' | 'LBP' | 'ALL');
  }, []);

  // Memoize filterFields arrays
  const dateRangeFilterFields = useMemo(() => [
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
    {
      type: 'select' as const,
      label: 'Currency',
      value: currency,
      onChange: handleCurrencyChange,
      options: [
        { value: 'ALL', label: 'All Currencies' },
        { value: 'USD', label: 'USD' },
        { value: 'LBP', label: 'LBP' },
      ],
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
  ], [quickRange, dateRange, currency, handleQuickRangeSelectChange, handleStartDateChange, handleEndDateChange, handleCurrencyChange]);

  const comparisonFilterFields = useMemo(() => [
    {
      type: 'date' as const,
      label: 'Period 1 Start',
      value: period1Range.startDate,
      onChange: handlePeriod1StartChange,
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'date' as const,
      label: 'Period 1 End',
      value: period1Range.endDate,
      onChange: handlePeriod1EndChange,
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'date' as const,
      label: 'Period 2 Start',
      value: period2Range.startDate,
      onChange: handlePeriod2StartChange,
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'date' as const,
      label: 'Period 2 End',
      value: period2Range.endDate,
      onChange: handlePeriod2EndChange,
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
  ], [period1Range, period2Range, handlePeriod1StartChange, handlePeriod1EndChange, handlePeriod2StartChange, handlePeriod2EndChange]);

  if (!user?.id) {
    return (
      <MainLayout>
        <Box sx={containerBoxSx}>
          <Typography sx={titleTypographySx}>Reports & Analytics</Typography>
        </Box>
        <Toast toast={toast} onClose={hideToast} />
      </MainLayout>
    );
  }

  // Get the actual tab index from the display index
  const actualTabIndex = getActualTabIndex(activeTab);

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography sx={titleTypographySx}>
            Reports & Analytics
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {actualTabIndex !== 6 && (
              <Tooltip title="Open Exported Reports Folder - View all manually exported reports">
                <Button
                  variant="outlined"
                  startIcon={<FolderOpen />}
                  onClick={handleOpenExportedReportsFolder}
                  sx={refreshButtonSx}
                >
                  Open Reports Folder
                </Button>
              </Tooltip>
            )}
            <Tooltip title={loading ? "Refreshing reports..." : "Refresh Reports - Reload all report data to get the latest information from the database."}>
              <span>
                <Button
                  variant="outlined"
                  startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
                  onClick={handleRefresh}
                  disabled={loading}
                  sx={refreshButtonSx}
                >
                  Refresh
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {actualTabIndex !== 1 && (
          <FilterHeader
            onClear={handleClearFilters}
            fields={dateRangeFilterFields}
          />
        )}

        {actualTabIndex === 1 && (
          <FilterHeader
            onClear={handleClearComparisonFilters}
            fields={comparisonFilterFields}
          />
        )}

        <Paper sx={paperSx}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="report tabs"
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={tabsSx}
          >
            {/* Tab 0: Sales Reports */}
            {(canViewReports || canViewTransactions) && (
              <Tab
                icon={<TrendingUp />}
                iconPosition="start"
                label="Sales Reports"
                id="report-tab-0"
                aria-controls="report-tabpanel-0"
              />
            )}
            
            {/* Tab 1: Sales Comparison */}
            {(canViewReports || canViewTransactions) && (
              <Tab
                icon={<CompareArrows />}
                iconPosition="start"
                label="Sales Comparison"
                id="report-tab-1"
                aria-controls="report-tabpanel-1"
              />
            )}
            
            {/* Tab 2: Inventory Reports */}
            {canViewInventory && (
              <Tab
                icon={<Inventory />}
                iconPosition="start"
                label="Inventory Reports"
                id="report-tab-2"
                aria-controls="report-tabpanel-2"
              />
            )}
            
            {/* Tab 3: Financial Reports */}
            {(canViewReports || canViewTransactions) && (
              <Tab
                icon={<AccountBalance />}
                iconPosition="start"
                label="Financial Reports"
                id="report-tab-3"
                aria-controls="report-tabpanel-3"
              />
            )}
            
            {/* Tab 4: Product Reports */}
            {(canViewReports || canViewProducts) && (
              <Tab
                icon={<ShoppingBag />}
                iconPosition="start"
                label="Product Reports"
                id="report-tab-4"
                aria-controls="report-tabpanel-4"
              />
            )}
            
            {/* Tab 5: Purchase & Supplier Reports */}
            {(canViewPurchaseOrders || canViewSuppliers) && (
              <Tab
                icon={<LocalShipping />}
                iconPosition="start"
                label="Purchase & Supplier Reports"
                id="report-tab-5"
                aria-controls="report-tabpanel-5"
              />
            )}
            
            {/* Tab 6: Scheduled Reports */}
            {canViewReports && (
              <Tab
                icon={<Schedule />}
                iconPosition="start"
                label="Scheduled Reports"
                id="report-tab-6"
                aria-controls="report-tabpanel-6"
              />
            )}
          </Tabs>

          {/* Tab Panels - Render in the same order as tabs, using display indices */}
          {availableTabs.map((actualTabIdx, displayIdx) => {
            if (actualTabIdx === 0) {
              return (
                <TabPanel key={0} value={activeTab} index={displayIdx}>
                  <SalesReportTab key={refreshKey} dateRange={dateRange} userId={user.id} currency={currency} />
                </TabPanel>
              );
            }
            if (actualTabIdx === 1) {
              return (
                <TabPanel key={1} value={activeTab} index={displayIdx}>
                  <SalesComparisonReportTab
                    key={refreshKey}
                    period1Range={period1Range}
                    period2Range={period2Range}
                    userId={user.id}
                    onPeriod1RangeChange={setPeriod1Range}
                    onPeriod2RangeChange={setPeriod2Range}
                  />
                </TabPanel>
              );
            }
            if (actualTabIdx === 2) {
              return (
                <TabPanel key={2} value={activeTab} index={displayIdx}>
                  <InventoryReportTab key={refreshKey} dateRange={dateRange} userId={user.id} />
                </TabPanel>
              );
            }
            if (actualTabIdx === 3) {
              return (
                <TabPanel key={3} value={activeTab} index={displayIdx}>
                  <FinancialReportTab key={refreshKey} dateRange={dateRange} userId={user.id} currency={currency} />
                </TabPanel>
              );
            }
            if (actualTabIdx === 4) {
              return (
                <TabPanel key={4} value={activeTab} index={displayIdx}>
                  <ProductReportTab key={refreshKey} dateRange={dateRange} userId={user.id} currency={currency} />
                </TabPanel>
              );
            }
            if (actualTabIdx === 5) {
              return (
                <TabPanel key={5} value={activeTab} index={displayIdx}>
                  <PurchaseSupplierReportTab key={refreshKey} dateRange={dateRange} userId={user.id} currency={currency} />
                </TabPanel>
              );
            }
            if (actualTabIdx === 6) {
              return (
                <TabPanel key={6} value={activeTab} index={displayIdx}>
                  <ScheduledReportsTab key={refreshKey} />
                </TabPanel>
              );
            }
            return null;
          })}
        </Paper>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default ReportsPage;

