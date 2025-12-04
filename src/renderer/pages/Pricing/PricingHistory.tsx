import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Typography,
  CircularProgress,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import { Refresh, History as HistoryIcon } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { RootState } from '../../store';
import { AuthState } from '../../store/slices/auth.slice';
import { PricingService } from '../../services/pricing.service';
import MainLayout from '../../components/layout/MainLayout';
import FilterHeader from '../../components/common/FilterHeader';
import { formatDateTime, convertDateRangeToUTC } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

interface PricingHistoryLog {
  id: number;
  userId: number;
  username: string;
  pricingRuleId: number;
  productId: number;
  quantity: number;
  basePrice: number;
  discountAmount: number;
  discountPercentage: number;
  ruleName: string;
  ruleType: string;
  timestamp: Date;
}

const PricingHistory: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state: RootState): AuthState => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const [activeTab, setActiveTab] = useState(2);

  const [logs, setLogs] = useState<PricingHistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [pricingRuleId, setPricingRuleId] = useState<number | undefined>(undefined);
  const [productId, setProductId] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const getTypeLabel = useCallback((type: string) => {
    const labels: Record<string, string> = {
      percentage_discount: 'Percentage',
      fixed_discount: 'Fixed',
      quantity_based: 'Quantity',
      buy_x_get_y: 'Buy X Get Y',
      time_based: 'Time Based',
    };
    return labels[type] || type;
  }, []);

  const clearFilters = useCallback(() => {
    setPricingRuleId(undefined);
    setProductId(undefined);
    setStartDate(null);
    setEndDate(null);
    setPage(0);
  }, []);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      // Convert date range from Beirut timezone to UTC for API
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(startDate, endDate);
      
      const options = {
        page: page + 1,
        pageSize,
        pricingRuleId,
        productId,
        startDate: startDateUTC || undefined,
        endDate: endDateUTC || undefined,
      };

      const result = await PricingService.getHistory(options, user.id);
      if (result.success && result.logs) {
        setLogs(result.logs);
        setTotal(result.pagination?.totalItems || 0);
      } else {
        showToast(result.error || 'Failed to load pricing history', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, pricingRuleId, productId, startDate, endDate, user?.id, showToast]);

  useEffect(() => {
    // Update tab based on URL
    const isPromotions = location.pathname.includes('/promotions');
    const isHistory = location.pathname.includes('/history');
    setActiveTab(isHistory ? 2 : isPromotions ? 1 : 0);
  }, [location.pathname]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    if (newValue === 0) {
      navigate('/pricing-rules');
    } else if (newValue === 1) {
      navigate('/promotions');
    } else {
      navigate('/pricing/history');
    }
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    loadHistory();
  }, [loadHistory]);

  const handlePricingRuleIdChange = useCallback((value: unknown) => {
    setPricingRuleId(value as number | undefined);
    setPage(0);
  }, []);

  const handleProductIdChange = useCallback((value: unknown) => {
    setProductId(value as number | undefined);
    setPage(0);
  }, []);

  const handleStartDateChange = useCallback((value: unknown) => {
    setStartDate(value as Date | null);
    setPage(0);
  }, []);

  const handleEndDateChange = useCallback((value: unknown) => {
    setEndDate(value as Date | null);
    setPage(0);
  }, []);

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPageSize(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  // Memoize filterFields array
  const filterFields = useMemo(() => [
    {
      type: 'number' as const,
      label: 'Pricing Rule ID',
      placeholder: 'Filter by rule ID',
      value: pricingRuleId,
      onChange: handlePricingRuleIdChange,
      gridSize: { xs: 12, md: 2.5 },
    },
    {
      type: 'number' as const,
      label: 'Product ID',
      placeholder: 'Filter by product ID',
      value: productId,
      onChange: handleProductIdChange,
      gridSize: { xs: 12, md: 2.5 },
    },
    {
      type: 'date' as const,
      label: 'Start Date',
      value: startDate,
      onChange: handleStartDateChange,
      gridSize: { xs: 12, md: 2.5 },
    },
    {
      type: 'date' as const,
      label: 'End Date',
      value: endDate,
      onChange: handleEndDateChange,
      gridSize: { xs: 12, md: 2.5 },
    },
  ], [pricingRuleId, productId, startDate, endDate, handlePricingRuleIdChange, handleProductIdChange, handleStartDateChange, handleEndDateChange]);

  // Memoize sx prop objects
  const containerBoxSx = useMemo(() => ({
    p: 3,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const headerBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 2,
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: { xs: '20px', sm: '24px', md: '28px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 'bold',
  }), []);

  const tabsSx = useMemo(() => ({
    mb: 3,
    '& .MuiTab-root': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textTransform: 'none',
      minHeight: 48,
      '&.Mui-selected': {
        color: '#1a237e',
        fontWeight: 600,
      },
    },
    '& .MuiTabs-indicator': {
      backgroundColor: '#1a237e',
    },
  }), []);

  const headerActionsBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 3,
    flexWrap: 'wrap',
    gap: 2,
  }), []);

  const refreshButtonSx = useMemo(() => ({
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

  const emptyStateTypographySx = useMemo(() => ({
    py: 4,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const ruleNameTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const chipSx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const basePriceTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const discountTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#2e7d32',
  }), []);

  const discountChipSx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const paginationSx = useMemo(() => ({
    '& .MuiTablePagination-toolbar': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography variant="h4" sx={titleTypographySx}>
            Pricing & Promotions
          </Typography>
        </Box>

        <Tabs value={activeTab} onChange={handleTabChange} sx={tabsSx}>
          <Tab label="Pricing Rules" />
          <Tab label="Promotions" />
          <Tab label="History" icon={<HistoryIcon sx={{ fontSize: '18px' }} />} iconPosition="start" />
        </Tabs>

        <Box sx={headerActionsBoxSx}>
          <Typography variant="h4" sx={titleTypographySx}>
            Pricing History
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh sx={{ fontSize: '18px' }} />}
            onClick={handleRefresh}
            disabled={loading}
            sx={refreshButtonSx}
          >
            Refresh
          </Button>
        </Box>

        <FilterHeader onClear={clearFilters} fields={filterFields} />

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
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Cashier</TableCell>
                    <TableCell>Rule Name</TableCell>
                    <TableCell>Rule Type</TableCell>
                    <TableCell>Product ID</TableCell>
                    <TableCell>Quantity</TableCell>
                    <TableCell align="right">Base Price</TableCell>
                    <TableCell align="right">Discount</TableCell>
                    <TableCell align="center">Discount %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <Typography variant="body2" color="text.secondary" sx={emptyStateTypographySx}>
                          No pricing history found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={bodyTypographySx}>
                            {formatDateTime(log.timestamp)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={bodyTypographySx}>
                            {log.username}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium" sx={ruleNameTypographySx}>
                            {log.ruleName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={getTypeLabel(log.ruleType)} size="small" sx={chipSx} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={bodyTypographySx}>
                            {log.productId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={bodyTypographySx}>
                            {log.quantity.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium" sx={basePriceTypographySx}>
                            ${log.basePrice.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold" sx={discountTypographySx}>
                            -${log.discountAmount.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${log.discountPercentage.toFixed(1)}%`}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={discountChipSx}
                          />
                        </TableCell>
                      </TableRow>
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
                onRowsPerPageChange={handlePageSizeChange}
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

export default PricingHistory;

