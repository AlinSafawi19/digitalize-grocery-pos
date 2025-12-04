import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Divider,
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  TablePagination,
} from '@mui/material';
import {
  AccountBalance,
  TrendingUp,
  TrendingDown,
  LocalOffer,
  Receipt,
  Download,
  ShowChart,
  ExpandMore,
} from '@mui/icons-material';
import { ReportService, FinancialReportData, DateRange } from '../../../services/report.service';
import { formatCurrency, formatPercentage } from '../../../utils/formatters';
import {
  exportFinancialReportToCSV,
  exportFinancialReportToExcel,
  exportFinancialReportToPDF,
  exportCashFlowReportToCSV,
  exportCashFlowReportToExcel,
  exportCashFlowReportToPDF,
  exportProfitByCategoryReportToCSV,
  exportProfitByCategoryReportToExcel,
  exportProfitByCategoryReportToPDF,
} from '../../../utils/exportUtils';
import { convertDateRangeToUTC } from '../../../utils/dateUtils';
import { CashFlowReportData, ProfitByProductCategoryReport } from '../../../services/report.service';
import { useToast } from '../../../hooks/useToast';
import Toast from '../../../components/common/Toast';

interface FinancialReportTabProps {
  dateRange: DateRange;
  userId: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  const tabPanelBoxSx = useMemo(() => ({
    p: 2,
  }), []);

  return (
    <div role="tabpanel" hidden={value !== index} id={`financial-tabpanel-${index}`} {...other}>
      {value === index && <Box sx={tabPanelBoxSx}>{children}</Box>}
    </div>
  );
};

const FinancialReportTab: React.FC<FinancialReportTabProps> = ({ dateRange, userId }) => {
  const { toast, showToast, hideToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<FinancialReportData | null>(null);
  const [cashFlowData, setCashFlowData] = useState<CashFlowReportData | null>(null);
  const [profitByCategoryData, setProfitByCategoryData] = useState<
    ProfitByProductCategoryReport[]
  >([]);
  const [profitByCategoryPagination, setProfitByCategoryPagination] = useState<{
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null>(null);
  const [financialSummaryExportMenuAnchor, setFinancialSummaryExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [cashFlowExportMenuAnchor, setCashFlowExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [profitByCategoryExportMenuAnchor, setProfitByCategoryExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [cashFlowLoading, setCashFlowLoading] = useState(false);
  const [profitByCategoryLoading, setProfitByCategoryLoading] = useState(false);
  const [dailyFlowPage, setDailyFlowPage] = useState(0);
  const [dailyFlowPageSize, setDailyFlowPageSize] = useState(20);
  const [profitByCategoryPage, setProfitByCategoryPage] = useState(0);
  const [profitByCategoryPageSize, setProfitByCategoryPageSize] = useState(20);

  const loadReport = useCallback(async () => {
    setLoading(true);

    try {
      // Convert date range from Beirut timezone to UTC for API
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(
        dateRange.startDate,
        dateRange.endDate
      );

      const result = await ReportService.getFinancialReport(
        { startDate: startDateUTC!, endDate: endDateUTC! },
        userId
      );

      if (result.success && result.data) {
        setReportData(result.data);
      } else {
        showToast(result.error || 'Failed to load financial report', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange, userId, showToast]);

  const loadCashFlowReport = useCallback(async () => {
    setCashFlowLoading(true);
    try {
      // Convert date range from Beirut timezone to UTC for API
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(
        dateRange.startDate,
        dateRange.endDate
      );

      const result = await ReportService.getCashFlowReport(
        {
          startDate: startDateUTC!,
          endDate: endDateUTC!,
          openingBalance,
          dailyFlowPage: dailyFlowPage + 1, // Convert from 0-based to 1-based
          dailyFlowPageSize,
        },
        userId
      );
      if (result.success && result.data) {
        setCashFlowData(result.data);
      }
    } catch (err) {
      console.error('Error loading cash flow report', err);
    } finally {
      setCashFlowLoading(false);
    }
  }, [dateRange, userId, openingBalance, dailyFlowPage, dailyFlowPageSize]);

  const loadProfitByCategoryReport = useCallback(async () => {
    setProfitByCategoryLoading(true);
    try {
      // Convert date range from Beirut timezone to UTC for API
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(
        dateRange.startDate,
        dateRange.endDate
      );

      const result = await ReportService.getProfitByProductCategoryReport(
        {
          startDate: startDateUTC!,
          endDate: endDateUTC!,
          page: profitByCategoryPage + 1, // Convert from 0-based to 1-based
          pageSize: profitByCategoryPageSize,
        },
        userId
      );
      if (result.success && result.data) {
        setProfitByCategoryData(result.data.categories);
        setProfitByCategoryPagination(result.data.pagination);
      }
    } catch (err) {
      console.error('Error loading profit by category report', err);
    } finally {
      setProfitByCategoryLoading(false);
    }
  }, [dateRange, userId, profitByCategoryPage, profitByCategoryPageSize]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (activeSubTab === 1) {
      loadCashFlowReport();
    } else if (activeSubTab === 2) {
      loadProfitByCategoryReport();
    }
  }, [activeSubTab, loadCashFlowReport, loadProfitByCategoryReport]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    p: 4,
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

  const cardSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const tableContainerSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const tableSx = useMemo(() => ({
    '& .MuiTableCell-head': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: 600,
      backgroundColor: '#f5f5f5',
      borderBottom: '2px solid #c0c0c0',
    },
    '& .MuiTableCell-body': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const textFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '16px',
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
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const buttonGroupSx = useMemo(() => ({
    '& .MuiButton-root': {
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
    },
  }), []);

  const tablePaginationSx = useMemo(() => ({
    borderTop: '1px solid #c0c0c0',
    '& .MuiTablePagination-toolbar': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiTablePagination-selectLabel': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiTablePagination-displayedRows': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  // Memoize additional sx objects
  const emptyStateTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const emptyStateBoxSx = useMemo(() => ({
    py: 4,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const emptyStateBoxSx2 = useMemo(() => ({
    py: 2,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const h6TypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const h6BoldTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const h3TypographySx = useMemo(() => ({
    fontSize: '24px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const h4TypographySx = useMemo(() => ({
    fontSize: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const dividerSx = useMemo(() => ({
    mb: 2,
    borderColor: '#e0e0e0',
  }), []);

  const exportButtonsBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'flex-end',
    mb: 2,
  }), []);

  const cardHeaderBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    mb: 2,
  }), []);

  const detailsRowBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    mb: 1,
  }), []);

  const detailsLabelBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
  }), []);

  const cashFlowHeaderBoxSx = useMemo(() => ({
    mb: 2,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }), []);

  const openingBalanceTextFieldSx = useMemo(() => ({
    ...textFieldSx,
    width: 200,
  }), [textFieldSx]);

  const dateTableCellSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const inflowTableCellSx = useMemo(() => ({
    color: 'success.main',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const outflowTableCellSx = useMemo(() => ({
    color: 'error.main',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const getNetFlowTableCellSx = useCallback((netFlow: number) => ({
    color: netFlow >= 0 ? 'success.main' : 'error.main',
    fontWeight: 'bold',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const profitByCategoryHeaderBoxSx = useMemo(() => ({
    mb: 2,
    display: 'flex',
    justifyContent: 'flex-end',
  }), []);

  const accordionSx = useMemo(() => ({
    mb: 2,
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
  }), []);

  const accordionSummaryBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    pr: 2,
  }), []);

  const accordionSummaryStatsBoxSx = useMemo(() => ({
    display: 'flex',
    gap: 3,
  }), []);

  const getProfitTableCellSx = useCallback((profit: number) => ({
    color: profit >= 0 ? 'success.main' : 'error.main',
    fontWeight: 'bold',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const tablePaginationWithMarginSx = useMemo(() => ({
    ...tablePaginationSx,
    mt: 2,
  }), [tablePaginationSx]);

  const handleSubTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setActiveSubTab(newValue);
  }, []);

  const handleExportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setFinancialSummaryExportMenuAnchor(event.currentTarget);
  }, []);

  const handleExportMenuClose = useCallback(() => {
    setFinancialSummaryExportMenuAnchor(null);
  }, []);

  const handleExportCSV = useCallback(async () => {
    if (reportData) {
      await exportFinancialReportToCSV(reportData, dateRange);
    }
    handleExportMenuClose();
  }, [reportData, dateRange, handleExportMenuClose]);

  const handleExportExcel = useCallback(async () => {
    if (reportData) {
      await exportFinancialReportToExcel(reportData, dateRange);
    }
    handleExportMenuClose();
  }, [reportData, dateRange, handleExportMenuClose]);

  const handleExportPDF = useCallback(async () => {
    if (reportData) {
      await exportFinancialReportToPDF(reportData, dateRange, userId);
    }
    handleExportMenuClose();
  }, [reportData, dateRange, userId, handleExportMenuClose]);

  const handleCashFlowExportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setCashFlowExportMenuAnchor(event.currentTarget);
  }, []);

  const handleCashFlowExportMenuClose = useCallback(() => {
    setCashFlowExportMenuAnchor(null);
  }, []);

  const handleCashFlowExportCSV = useCallback(async () => {
    if (cashFlowData) {
      await exportCashFlowReportToCSV(cashFlowData, dateRange);
    }
    handleCashFlowExportMenuClose();
  }, [cashFlowData, dateRange, handleCashFlowExportMenuClose]);

  const handleCashFlowExportExcel = useCallback(async () => {
    if (cashFlowData) {
      await exportCashFlowReportToExcel(cashFlowData, dateRange);
    }
    handleCashFlowExportMenuClose();
  }, [cashFlowData, dateRange, handleCashFlowExportMenuClose]);

  const handleCashFlowExportPDF = useCallback(async () => {
    if (cashFlowData) {
      await exportCashFlowReportToPDF(cashFlowData, dateRange, userId);
    }
    handleCashFlowExportMenuClose();
  }, [cashFlowData, dateRange, userId, handleCashFlowExportMenuClose]);

  const handleProfitByCategoryExportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setProfitByCategoryExportMenuAnchor(event.currentTarget);
  }, []);

  const handleProfitByCategoryExportMenuClose = useCallback(() => {
    setProfitByCategoryExportMenuAnchor(null);
  }, []);

  const handleProfitByCategoryExportCSV = useCallback(async () => {
    if (profitByCategoryData.length > 0) {
      await exportProfitByCategoryReportToCSV(profitByCategoryData, dateRange);
    }
    handleProfitByCategoryExportMenuClose();
  }, [profitByCategoryData, dateRange, handleProfitByCategoryExportMenuClose]);

  const handleProfitByCategoryExportExcel = useCallback(async () => {
    if (profitByCategoryData.length > 0) {
      await exportProfitByCategoryReportToExcel(profitByCategoryData, dateRange);
    }
    handleProfitByCategoryExportMenuClose();
  }, [profitByCategoryData, dateRange, handleProfitByCategoryExportMenuClose]);

  const handleProfitByCategoryExportPDF = useCallback(async () => {
    if (profitByCategoryData.length > 0) {
      await exportProfitByCategoryReportToPDF(profitByCategoryData, dateRange, userId);
    }
    handleProfitByCategoryExportMenuClose();
  }, [profitByCategoryData, dateRange, userId, handleProfitByCategoryExportMenuClose]);

  const handleOpeningBalanceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setOpeningBalance(parseFloat(e.target.value) || 0);
  }, []);

  const handleDailyFlowPageChange = useCallback((_: unknown, newPage: number) => {
    setDailyFlowPage(newPage);
  }, []);

  const handleDailyFlowPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDailyFlowPageSize(parseInt(e.target.value, 10));
    setDailyFlowPage(0);
  }, []);

  const handleProfitByCategoryPageChange = useCallback((_: unknown, newPage: number) => {
    setProfitByCategoryPage(newPage);
  }, []);

  const handleProfitByCategoryPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfitByCategoryPageSize(parseInt(e.target.value, 10));
    setProfitByCategoryPage(0);
  }, []);

  // Memoize computed values
  const totalRevenue = useMemo(() => 
    profitByCategoryData.reduce((sum, c) => sum + c.totalRevenue, 0),
    [profitByCategoryData]
  );

  const totalProfit = useMemo(() => 
    profitByCategoryData.reduce((sum, c) => sum + c.grossProfit, 0),
    [profitByCategoryData]
  );

  if (loading) {
    return (
      <Box sx={loadingBoxSx}>
        <CircularProgress />
      </Box>
    );
  }

  if (!reportData) {
    return (
      <>
        <Box sx={loadingBoxSx}>
          <Typography sx={emptyStateTypographySx}>
            No financial data available for the selected period.
          </Typography>
        </Box>
        <Toast toast={toast} onClose={hideToast} />
      </>
    );
  }

  return (
    <Box>
      <Paper sx={paperSx}>
        <Tabs value={activeSubTab} onChange={handleSubTabChange} sx={tabsSx}>
          <Tab label="Financial Summary" icon={<AccountBalance />} iconPosition="start" />
          <Tab label="Cash Flow" icon={<ShowChart />} iconPosition="start" />
          <Tab label="Profit by Category" icon={<TrendingUp />} iconPosition="start" />
        </Tabs>

        {/* Financial Summary Tab */}
        <TabPanel value={activeSubTab} index={0}>
          {loading ? (
            <Box sx={loadingBoxSx}>
              <CircularProgress />
            </Box>
          ) : !reportData ? (
            <Box sx={loadingBoxSx}>
              <Typography sx={emptyStateTypographySx}>
                No financial data available for the selected period.
              </Typography>
            </Box>
          ) : (
            <Box>
              {/* Export Buttons */}
              <Box sx={exportButtonsBoxSx} className="no-print">
                <ButtonGroup variant="outlined" size="small" sx={buttonGroupSx}>
                  <Button startIcon={<Download />} onClick={handleExportMenuOpen}>
                    Export
                  </Button>
                </ButtonGroup>
                <Menu
                  anchorEl={financialSummaryExportMenuAnchor}
                  open={Boolean(financialSummaryExportMenuAnchor)}
                  onClose={handleExportMenuClose}
                >
                  <MenuItem onClick={handleExportCSV}>Export as CSV</MenuItem>
                  <MenuItem onClick={handleExportExcel}>Export as Excel</MenuItem>
                  <MenuItem onClick={handleExportPDF}>Export as PDF</MenuItem>
                </Menu>
              </Box>

              {/* Revenue Section */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Box sx={cardHeaderBoxSx}>
                        <AccountBalance color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                          Revenue
                        </Typography>
                      </Box>
                      <Typography variant="h3" color="primary" fontWeight="bold" sx={h3TypographySx}>
                        {formatCurrency(reportData.revenue)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Box sx={cardHeaderBoxSx}>
                        <TrendingDown color="error" sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                          Cost of Goods Sold (COGS)
                        </Typography>
                      </Box>
                      <Typography variant="h3" color="error.main" fontWeight="bold" sx={h3TypographySx}>
                        {formatCurrency(reportData.costOfGoodsSold)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Profit Section */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Box sx={cardHeaderBoxSx}>
                        <TrendingUp color="success" sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                          Gross Profit
                        </Typography>
                      </Box>
                      <Typography variant="h3" color="success.main" fontWeight="bold" sx={h3TypographySx}>
                        {formatCurrency(reportData.grossProfit)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ ...bodyTypographySx, mt: 1 }}>
                        Margin: {formatPercentage(reportData.grossProfitMargin)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Box sx={cardHeaderBoxSx}>
                        <TrendingUp color="info" sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                          Net Profit
                        </Typography>
                      </Box>
                      <Typography variant="h3" color="info.main" fontWeight="bold" sx={h3TypographySx}>
                        {formatCurrency(reportData.netProfit)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ ...bodyTypographySx, mt: 1 }}>
                        Margin: {formatPercentage(reportData.netProfitMargin)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Additional Details */}
              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Additional Details
                  </Typography>
                  <Divider sx={dividerSx} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Box sx={detailsRowBoxSx}>
                        <Box sx={detailsLabelBoxSx}>
                          <LocalOffer sx={{ mr: 1, color: 'text.secondary' }} />
                          <Typography>Total Discounts:</Typography>
                        </Box>
                        <Typography fontWeight="bold" sx={bodyTypographySx}>{formatCurrency(reportData.totalDiscounts)}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={detailsRowBoxSx}>
                        <Box sx={detailsLabelBoxSx}>
                          <Receipt sx={{ mr: 1, color: 'text.secondary' }} />
                          <Typography sx={bodyTypographySx}>Total Tax:</Typography>
                        </Box>
                        <Typography fontWeight="bold" sx={bodyTypographySx}>{formatCurrency(reportData.totalTax)}</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Box>
          )}
        </TabPanel>

        {/* Cash Flow Tab */}
        <TabPanel value={activeSubTab} index={1}>
          <Box sx={cashFlowHeaderBoxSx}>
              <TextField
              type="number"
              label="Opening Balance"
              size="small"
              value={openingBalance}
              onChange={handleOpeningBalanceChange}
              InputLabelProps={{ shrink: true }}
              sx={openingBalanceTextFieldSx}
            />
            {cashFlowData && (
              <Box className="no-print">
                <ButtonGroup variant="outlined" size="small" sx={buttonGroupSx}>
                  <Button startIcon={<Download />} onClick={handleCashFlowExportMenuOpen}>
                    Export
                  </Button>
                </ButtonGroup>
                <Menu
                  anchorEl={cashFlowExportMenuAnchor}
                  open={Boolean(cashFlowExportMenuAnchor)}
                  onClose={handleCashFlowExportMenuClose}
                >
                  <MenuItem onClick={handleCashFlowExportCSV}>Export as CSV</MenuItem>
                  <MenuItem onClick={handleCashFlowExportExcel}>Export as Excel</MenuItem>
                  <MenuItem onClick={handleCashFlowExportPDF}>Export as PDF</MenuItem>
                </Menu>
              </Box>
            )}
          </Box>
          {cashFlowLoading ? (
            <Box sx={loadingBoxSx}>
              <CircularProgress />
            </Box>
          ) : cashFlowData ? (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Opening Balance
                      </Typography>
                      <Typography variant="h4" color="primary" sx={h4TypographySx}>
                        {formatCurrency(cashFlowData.openingBalance)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Cash Inflows
                      </Typography>
                      <Typography variant="h4" color="success.main" sx={h4TypographySx}>
                        {formatCurrency(cashFlowData.cashInflows.total)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                        Sales: {formatCurrency(cashFlowData.cashInflows.sales)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Cash Outflows
                      </Typography>
                      <Typography variant="h4" color="error.main" sx={h4TypographySx}>
                        {formatCurrency(cashFlowData.cashOutflows.total)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                        Purchases: {formatCurrency(cashFlowData.cashOutflows.purchases)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Closing Balance
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={h4TypographySx}>
                        {formatCurrency(cashFlowData.closingBalance)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                        Net Flow: {formatCurrency(cashFlowData.netCashFlow)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Daily Flow Table */}
              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Daily Cash Flow
                  </Typography>
                  <TableContainer sx={tableContainerSx}>
                    <Table size="small" sx={tableSx}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell align="right">Inflows</TableCell>
                          <TableCell align="right">Outflows</TableCell>
                          <TableCell align="right">Net Flow</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {!cashFlowData.dailyFlow || cashFlowData.dailyFlow.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center">
                              <Typography variant="body2" color="text.secondary" sx={emptyStateBoxSx}>
                                No daily flow data available
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          cashFlowData.dailyFlow.map((day, index) => (
                            <TableRow key={index}>
                              <TableCell sx={dateTableCellSx}>{day.date.toLocaleDateString()}</TableCell>
                              <TableCell align="right" sx={inflowTableCellSx}>
                                {formatCurrency(day.inflows)}
                              </TableCell>
                              <TableCell align="right" sx={outflowTableCellSx}>
                                {formatCurrency(day.outflows)}
                              </TableCell>
                              <TableCell align="right" sx={getNetFlowTableCellSx(day.netFlow)}>
                                {formatCurrency(day.netFlow)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {cashFlowData.dailyFlowPagination && (
                    <TablePagination
                      component="div"
                      count={cashFlowData.dailyFlowPagination.total}
                      page={dailyFlowPage}
                      onPageChange={handleDailyFlowPageChange}
                      rowsPerPage={dailyFlowPageSize}
                      onRowsPerPageChange={handleDailyFlowPageSizeChange}
                      rowsPerPageOptions={[10, 20, 50, 100]}
                      sx={tablePaginationSx}
                    />
                  )}
                </CardContent>
              </Card>
            </Box>
          ) : (
            <Box sx={loadingBoxSx}>
              <Typography sx={emptyStateTypographySx}>
                No cash flow data available.
              </Typography>
            </Box>
          )}
        </TabPanel>

        {/* Profit by Category Tab */}
        <TabPanel value={activeSubTab} index={2}>
          <Box sx={profitByCategoryHeaderBoxSx} className="no-print">
            <ButtonGroup variant="outlined" size="small" sx={buttonGroupSx}>
              <Button
                startIcon={<Download />}
                onClick={handleProfitByCategoryExportMenuOpen}
              >
                Export
              </Button>
            </ButtonGroup>
            <Menu
              anchorEl={profitByCategoryExportMenuAnchor}
              open={Boolean(profitByCategoryExportMenuAnchor)}
              onClose={handleProfitByCategoryExportMenuClose}
            >
              <MenuItem
                onClick={handleProfitByCategoryExportCSV}
              >
                Export as CSV
              </MenuItem>
              <MenuItem
                onClick={handleProfitByCategoryExportExcel}
              >
                Export as Excel
              </MenuItem>
              <MenuItem
                onClick={handleProfitByCategoryExportPDF}
              >
                Export as PDF
              </MenuItem>
            </Menu>
          </Box>
          {profitByCategoryLoading ? (
            <Box sx={loadingBoxSx}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Total Categories
                      </Typography>
                      <Typography variant="h4" color="primary" sx={h4TypographySx}>
                        {profitByCategoryData.length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        Total Revenue
                      </Typography>
                      <Typography variant="h4" color="success.main" sx={h4TypographySx}>
                        {formatCurrency(totalRevenue)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Total Profit
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={h4TypographySx}>
                        {formatCurrency(totalProfit)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Category Profit Table */}
              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ ...h6BoldTypographySx, mb: 2 }}>
                    Category Profit Table
                  </Typography>
                  {profitByCategoryData.length === 0 ? (
                    <TableContainer sx={tableContainerSx}>
                      <Table size="small" sx={tableSx}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Category</TableCell>
                            <TableCell align="right">Revenue</TableCell>
                            <TableCell align="right">Cost</TableCell>
                            <TableCell align="right">Profit</TableCell>
                            <TableCell align="right">Profit Margin</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={emptyStateBoxSx}>
                              <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                                No profit by category data available for the selected period.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    profitByCategoryData.map((category) => (
                      <Accordion key={category.categoryId || 'uncategorized'} sx={accordionSx}>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Box sx={accordionSummaryBoxSx}>
                            <Typography variant="h6" sx={h6BoldTypographySx}>
                              {category.categoryName || 'Uncategorized'}
                            </Typography>
                            <Box sx={accordionSummaryStatsBoxSx}>
                              <Typography sx={bodyTypographySx}>
                                Revenue: <strong>{formatCurrency(category.totalRevenue)}</strong>
                              </Typography>
                              <Typography sx={bodyTypographySx}>
                                Profit: <strong>{formatCurrency(category.grossProfit)}</strong>
                              </Typography>
                              <Typography sx={bodyTypographySx}>
                                Margin: <strong>{formatPercentage(category.grossProfitMargin)}</strong>
                              </Typography>
                            </Box>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          {category.products && category.products.length > 0 ? (
                            <TableContainer sx={tableContainerSx}>
                              <Table size="small" sx={tableSx}>
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Product Code</TableCell>
                                    <TableCell>Product Name</TableCell>
                                    <TableCell align="right">Revenue</TableCell>
                                    <TableCell align="right">Cost</TableCell>
                                    <TableCell align="right">Profit</TableCell>
                                    <TableCell align="right">Profit Margin</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {category.products.map((product) => (
                                    <TableRow key={product.productId}>
                                      <TableCell sx={bodyTypographySx}>{product.productCode}</TableCell>
                                      <TableCell sx={bodyTypographySx}>{product.productName}</TableCell>
                                      <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(product.revenue)}</TableCell>
                                      <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(product.cost)}</TableCell>
                                      <TableCell align="right" sx={getProfitTableCellSx(product.profit)}>
                                        {formatCurrency(product.profit)}
                                      </TableCell>
                                      <TableCell align="right" sx={bodyTypographySx}>
                                        {formatPercentage(product.profitMargin)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          ) : (
                            <TableContainer sx={tableContainerSx}>
                              <Table size="small" sx={tableSx}>
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Product Code</TableCell>
                                    <TableCell>Product Name</TableCell>
                                    <TableCell align="right">Revenue</TableCell>
                                    <TableCell align="right">Cost</TableCell>
                                    <TableCell align="right">Profit</TableCell>
                                    <TableCell align="right">Profit Margin</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  <TableRow>
                                    <TableCell colSpan={6} align="center" sx={emptyStateBoxSx2}>
                                      <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                                        No products in this category.
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </TableContainer>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    ))
                  )}
                  {profitByCategoryPagination && (
                    <TablePagination
                      component="div"
                      count={profitByCategoryPagination.total}
                      page={profitByCategoryPage}
                      onPageChange={handleProfitByCategoryPageChange}
                      rowsPerPage={profitByCategoryPageSize}
                      onRowsPerPageChange={handleProfitByCategoryPageSizeChange}
                      rowsPerPageOptions={[10, 20, 50, 100]}
                      sx={tablePaginationWithMarginSx}
                    />
                  )}
                </CardContent>
              </Card>
            </Box>
          )}
        </TabPanel>
      </Paper>
      <Toast toast={toast} onClose={hideToast} />
    </Box>
  );
};

export default FinancialReportTab;

