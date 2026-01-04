import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  Tabs,
  Tab,
  TablePagination,
} from '@mui/material';
import {
  TrendingUp,
  ShoppingCart,
  Receipt,
  LocalOffer,
  Download,
  Cancel,
} from '@mui/icons-material';
import {
  ReportService,
  SalesReportData,
  VoidReturnTransactionReportData,
  DateRange,
} from '../../../services/report.service';
import { formatCurrency } from '../../../utils/formatters';
import {
  exportSalesReportToCSV,
  exportSalesReportToExcel,
  exportSalesReportToPDF,
  exportVoidReturnTransactionReportToCSV,
  exportVoidReturnTransactionReportToExcel,
  exportVoidReturnTransactionReportToPDF,
} from '../../../utils/exportUtils';
import { convertDateRangeToUTC, formatDateTime } from '../../../utils/dateUtils';
import { useToast } from '../../../hooks/useToast';
import Toast from '../../../components/common/Toast';

interface SalesReportTabProps {
  dateRange: DateRange;
  userId: number;
  currency?: 'USD' | 'LBP' | 'ALL';
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
    <div role="tabpanel" hidden={value !== index} id={`sales-tabpanel-${index}`} {...other}>
      {value === index && <Box sx={tabPanelBoxSx}>{children}</Box>}
    </div>
  );
};

const SalesReportTab: React.FC<SalesReportTabProps> = ({ dateRange, userId, currency = 'ALL' }) => {
  const { toast, showToast, hideToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<SalesReportData | null>(null);
  const [voidReturnData, setVoidReturnData] = useState<VoidReturnTransactionReportData | null>(null);
  const [salesSummaryExportMenuAnchor, setSalesSummaryExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [voidReturnExportMenuAnchor, setVoidReturnExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [voidReturnLoading, setVoidReturnLoading] = useState(false);
  const [salesByCashierPage, setSalesByCashierPage] = useState(0);
  const [salesByCashierPageSize, setSalesByCashierPageSize] = useState(20);
  const [voidedPage, setVoidedPage] = useState(0);
  const [voidedPageSize, setVoidedPageSize] = useState(20);
  const [returnedPage, setReturnedPage] = useState(0);
  const [returnedPageSize, setReturnedPageSize] = useState(20);

  const loadReport = useCallback(async () => {
    setLoading(true);

    try {
      // Convert date range from Beirut timezone to UTC for API
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(
        dateRange.startDate,
        dateRange.endDate
      );

      const result = await ReportService.getSalesReport(
        {
          startDate: startDateUTC!,
          endDate: endDateUTC!,
          currency,
          groupBy: 'day',
          salesByCashierPage: salesByCashierPage + 1, // Convert from 0-based to 1-based
          salesByCashierPageSize,
        },
        userId
      );

      if (result.success && result.data) {
        setReportData(result.data);
      } else {
        showToast(result.error || 'Failed to load sales report', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange, userId, currency, salesByCashierPage, salesByCashierPageSize, showToast]);

  const loadVoidReturnReport = useCallback(async () => {
    setVoidReturnLoading(true);
    try {
      // Convert date range from Beirut timezone to UTC for API
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(
        dateRange.startDate,
        dateRange.endDate
      );

      const result = await ReportService.getVoidReturnTransactionReport(
        {
          startDate: startDateUTC!,
          endDate: endDateUTC!,
          voidedPage: voidedPage + 1, // Convert from 0-based to 1-based
          voidedPageSize,
          returnedPage: returnedPage + 1, // Convert from 0-based to 1-based
          returnedPageSize,
        },
        userId
      );
      if (result.success && result.data) {
        setVoidReturnData(result.data);
      } else {
        showToast(result.error || 'Failed to load void/return transaction report', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred while loading void/return transaction report', 'error');
    } finally {
      setVoidReturnLoading(false);
    }
  }, [dateRange, userId, voidedPage, voidedPageSize, returnedPage, returnedPageSize, showToast]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (activeSubTab === 1) {
      loadVoidReturnReport();
    }
  }, [activeSubTab, loadVoidReturnReport]);

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

  const buttonGroupSx = useMemo(() => ({
    '& .MuiButton-root': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textTransform: 'none',
      borderRadius: 0,
      borderColor: '#c0c0c0',
      color: '#1a237e',
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

  const handleSubTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setActiveSubTab(newValue);
  }, []);

  const handleSalesByCashierPageChange = useCallback((_: unknown, newPage: number) => {
    setSalesByCashierPage(newPage);
  }, []);

  const handleSalesByCashierPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSalesByCashierPageSize(parseInt(e.target.value, 10));
    setSalesByCashierPage(0);
  }, []);

  const handleVoidedPageChange = useCallback((_: unknown, newPage: number) => {
    setVoidedPage(newPage);
  }, []);

  const handleVoidedPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setVoidedPageSize(parseInt(e.target.value, 10));
    setVoidedPage(0);
  }, []);

  const handleReturnedPageChange = useCallback((_: unknown, newPage: number) => {
    setReturnedPage(newPage);
  }, []);

  const handleReturnedPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setReturnedPageSize(parseInt(e.target.value, 10));
    setReturnedPage(0);
  }, []);

  const handleExportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setSalesSummaryExportMenuAnchor(event.currentTarget);
  }, []);

  const handleExportMenuClose = useCallback(() => {
    setSalesSummaryExportMenuAnchor(null);
  }, []);

  const handleExportCSV = useCallback(async () => {
    if (reportData) {
      await exportSalesReportToCSV(reportData, dateRange);
    }
    handleExportMenuClose();
  }, [reportData, dateRange, handleExportMenuClose]);

  const handleExportExcel = useCallback(async () => {
    if (reportData) {
      await exportSalesReportToExcel(reportData, dateRange);
    }
    handleExportMenuClose();
  }, [reportData, dateRange, handleExportMenuClose]);

  const handleExportPDF = useCallback(async () => {
    if (reportData) {
      await exportSalesReportToPDF(reportData, dateRange, userId);
    }
    handleExportMenuClose();
  }, [reportData, dateRange, userId, handleExportMenuClose]);

  // Void/Return export handlers
  const handleVoidReturnExportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setVoidReturnExportMenuAnchor(event.currentTarget);
  }, []);

  const handleVoidReturnExportMenuClose = useCallback(() => {
    setVoidReturnExportMenuAnchor(null);
  }, []);

  const handleVoidReturnExportCSV = useCallback(async () => {
    if (voidReturnData) {
      await exportVoidReturnTransactionReportToCSV(voidReturnData, dateRange);
    }
    handleVoidReturnExportMenuClose();
  }, [voidReturnData, dateRange, handleVoidReturnExportMenuClose]);

  const handleVoidReturnExportExcel = useCallback(async () => {
    if (voidReturnData) {
      await exportVoidReturnTransactionReportToExcel(voidReturnData, dateRange);
    }
    handleVoidReturnExportMenuClose();
  }, [voidReturnData, dateRange, handleVoidReturnExportMenuClose]);

  const handleVoidReturnExportPDF = useCallback(async () => {
    if (voidReturnData) {
      await exportVoidReturnTransactionReportToPDF(voidReturnData, dateRange, userId);
    }
    handleVoidReturnExportMenuClose();
  }, [voidReturnData, dateRange, userId, handleVoidReturnExportMenuClose]);

  // Memoize additional sx objects
  const emptyStateTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '13px',
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

  const h4TypographySx = useMemo(() => ({
    fontSize: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const chipSx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const exportButtonsBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'flex-end',
    mb: 2,
  }), []);

  const cardHeaderBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    mb: 1,
  }), []);

  const statsRowBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    mb: 1,
  }), []);

  const emptyStateBoxSx = useMemo(() => ({
    py: 4,
  }), []);

  const topProductsCardSx = useMemo(() => ({
    mb: 3,
    ...cardSx,
  }), [cardSx]);

  const voidedTransactionsCardSx = useMemo(() => ({
    mb: 3,
    ...cardSx,
  }), [cardSx]);

  const voidedAmountTableCellSx = useMemo(() => ({
    color: 'error.main',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

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
            No data available for the selected period.
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
          <Tab label="Sales Summary" icon={<TrendingUp />} iconPosition="start" />
          <Tab label="Void/Return Transactions" icon={<Cancel />} iconPosition="start" />
        </Tabs>

        {/* Sales Summary Tab */}
        <TabPanel value={activeSubTab} index={0}>
          {loading ? (
            <Box sx={loadingBoxSx}>
              <CircularProgress />
            </Box>
          ) : !reportData ? (
            <Box sx={loadingBoxSx}>
              <Typography sx={emptyStateTypographySx}>
                No data available for the selected period.
              </Typography>
            </Box>
          ) : (
            <Box id="sales-report-content">
              {/* Export Buttons */}
              <Box sx={exportButtonsBoxSx} className="no-print">
                <ButtonGroup variant="outlined" size="small" sx={buttonGroupSx}>
                  <Button startIcon={<Download />} onClick={handleExportMenuOpen}>
                    Export
                  </Button>
                </ButtonGroup>
                <Menu
                  anchorEl={salesSummaryExportMenuAnchor}
                  open={Boolean(salesSummaryExportMenuAnchor)}
                  onClose={handleExportMenuClose}
                >
                  <MenuItem onClick={handleExportCSV}>Export as CSV</MenuItem>
                  <MenuItem onClick={handleExportExcel}>Export as Excel</MenuItem>
                  <MenuItem onClick={handleExportPDF}>Export as PDF</MenuItem>
                </Menu>
              </Box>

              {/* Summary Cards */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Box sx={cardHeaderBoxSx}>
                        <TrendingUp color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                          Total Sales
                        </Typography>
                      </Box>
                      <Typography variant="h4" color="primary" sx={h4TypographySx}>
                        {formatCurrency(reportData.totalSales)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Box sx={cardHeaderBoxSx}>
                        <Receipt color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                          Transactions
                        </Typography>
                      </Box>
                      <Typography variant="h4" color="primary" sx={h4TypographySx}>
                        {reportData.totalTransactions}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Box sx={cardHeaderBoxSx}>
                        <ShoppingCart color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                          Items Sold
                        </Typography>
                      </Box>
                      <Typography variant="h4" color="primary" sx={h4TypographySx}>
                        {reportData.totalItems}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Box sx={cardHeaderBoxSx}>
                        <LocalOffer color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                          Avg. Transaction
                        </Typography>
                      </Box>
                      <Typography variant="h4" color="primary" sx={h4TypographySx}>
                        {formatCurrency(reportData.averageTransactionValue)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Additional Stats */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Discounts & Tax
                      </Typography>
                      <Box sx={statsRowBoxSx}>
                        <Typography sx={bodyTypographySx}>Total Discounts:</Typography>
                        <Typography fontWeight="bold" sx={bodyTypographySx}>{formatCurrency(reportData.totalDiscount)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={bodyTypographySx}>Total Tax:</Typography>
                        <Typography fontWeight="bold" sx={bodyTypographySx}>{formatCurrency(reportData.totalTax)}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Top Products */}
              <Card sx={topProductsCardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Top Selling Products
                  </Typography>
                  <TableContainer sx={tableContainerSx}>
                    <Table size="small" sx={tableSx}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                          <TableCell align="right">Revenue</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {!reportData.topProducts || reportData.topProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} align="center" sx={emptyStateBoxSx}>
                              <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                                No products found
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          reportData.topProducts.map((product) => (
                            <TableRow key={product.productId}>
                              <TableCell sx={bodyTypographySx}>{product.productName}</TableCell>
                              <TableCell align="right" sx={bodyTypographySx}>{product.quantity}</TableCell>
                              <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(product.revenue)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* Sales by Cashier */}
              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Sales by Cashier
                  </Typography>
                  <TableContainer sx={tableContainerSx}>
                    <Table size="small" sx={tableSx}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Cashier</TableCell>
                          <TableCell align="right">Transactions</TableCell>
                          <TableCell align="right">Total Sales</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {!reportData.salesByCashier || reportData.salesByCashier.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} align="center" sx={emptyStateBoxSx}>
                              <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                                No cashier data found
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          reportData.salesByCashier.map((cashier) => (
                            <TableRow key={cashier.cashierId}>
                              <TableCell sx={bodyTypographySx}>{cashier.cashierName}</TableCell>
                              <TableCell align="right" sx={bodyTypographySx}>{cashier.transactions}</TableCell>
                              <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(cashier.sales)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {reportData.salesByCashierPagination && (
                    <TablePagination
                      component="div"
                      count={reportData.salesByCashierPagination.total}
                      page={salesByCashierPage}
                      onPageChange={handleSalesByCashierPageChange}
                      rowsPerPage={salesByCashierPageSize}
                      onRowsPerPageChange={handleSalesByCashierPageSizeChange}
                      rowsPerPageOptions={[10, 20, 50, 100]}
                      sx={tablePaginationSx}
                    />
                  )}
                </CardContent>
              </Card>
            </Box>
          )}
        </TabPanel>

        {/* Void/Return Transactions Tab */}
        <TabPanel value={activeSubTab} index={1}>
          {voidReturnData && (
            <Box sx={exportButtonsBoxSx} className="no-print">
              <ButtonGroup variant="outlined" size="small" sx={buttonGroupSx}>
                <Button startIcon={<Download />} onClick={handleVoidReturnExportMenuOpen}>
                  Export
                </Button>
              </ButtonGroup>
              <Menu
                anchorEl={voidReturnExportMenuAnchor}
                open={Boolean(voidReturnExportMenuAnchor)}
                onClose={handleVoidReturnExportMenuClose}
              >
                <MenuItem onClick={handleVoidReturnExportCSV}>Export as CSV</MenuItem>
                <MenuItem onClick={handleVoidReturnExportExcel}>Export as Excel</MenuItem>
                <MenuItem onClick={handleVoidReturnExportPDF}>Export as PDF</MenuItem>
              </Menu>
            </Box>
          )}
          {voidReturnLoading ? (
            <Box sx={loadingBoxSx}>
              <CircularProgress />
            </Box>
          ) : voidReturnData ? (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Voided Transactions
                      </Typography>
                      <Typography variant="h4" color="error.main" sx={h4TypographySx}>
                        {voidReturnData.summary.voidedCount}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                        Total: {formatCurrency(voidReturnData.summary.totalVoidedAmount)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Returned Transactions
                      </Typography>
                      <Typography variant="h4" color="warning.main" sx={h4TypographySx}>
                        {voidReturnData.summary.returnedCount}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                        Total: {formatCurrency(voidReturnData.summary.totalReturnedAmount)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Voided Transactions Table */}
              <Card sx={voidedTransactionsCardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Voided Transactions
                  </Typography>
                  <TableContainer sx={tableContainerSx}>
                    <Table size="small" sx={tableSx}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Transaction #</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Cashier</TableCell>
                          <TableCell>Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {!voidReturnData.voidedTransactions || voidReturnData.voidedTransactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={emptyStateBoxSx}>
                              <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                                No voided transactions found
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          voidReturnData.voidedTransactions.map((txn) => (
                            <TableRow key={txn.id}>
                              <TableCell sx={bodyTypographySx}>{txn.transactionNumber}</TableCell>
                              <TableCell>
                                <Chip label={txn.type} size="small" color="error" sx={chipSx} />
                              </TableCell>
                              <TableCell align="right" sx={voidedAmountTableCellSx}>
                                {formatCurrency(txn.total)}
                              </TableCell>
                              <TableCell sx={bodyTypographySx}>{txn.cashierName}</TableCell>
                              <TableCell sx={bodyTypographySx}>{formatDateTime(txn.createdAt)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {voidReturnData.voidedPagination && (
                    <TablePagination
                      component="div"
                      count={voidReturnData.voidedPagination.total}
                      page={voidedPage}
                      onPageChange={handleVoidedPageChange}
                      rowsPerPage={voidedPageSize}
                      onRowsPerPageChange={handleVoidedPageSizeChange}
                      rowsPerPageOptions={[10, 20, 50, 100]}
                      sx={tablePaginationSx}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Returned Transactions Table */}
              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Returned Transactions
                  </Typography>
                  <TableContainer sx={tableContainerSx}>
                    <Table size="small" sx={tableSx}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Transaction #</TableCell>
                          <TableCell>Product Code</TableCell>
                          <TableCell>Product Name</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                          <TableCell align="right">Price</TableCell>
                          <TableCell align="right">Total</TableCell>
                          <TableCell>Cashier</TableCell>
                          <TableCell>Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {!voidReturnData.returnedTransactions || voidReturnData.returnedTransactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center" sx={emptyStateBoxSx}>
                              <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                                No returned transactions found
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          voidReturnData.returnedTransactions.flatMap((txn) =>
                            txn.items.map((item, idx) => (
                              <TableRow key={`${txn.id}-${idx}`}>
                                {idx === 0 && (
                                  <TableCell rowSpan={txn.items.length} sx={bodyTypographySx}>
                                    {txn.transactionNumber}
                                  </TableCell>
                                )}
                                <TableCell sx={bodyTypographySx}>{item.productCode}</TableCell>
                                <TableCell sx={bodyTypographySx}>{item.productName}</TableCell>
                                <TableCell align="right" sx={bodyTypographySx}>{item.quantity}</TableCell>
                                <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(item.price)}</TableCell>
                                <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(item.total)}</TableCell>
                                {idx === 0 && (
                                  <>
                                    <TableCell rowSpan={txn.items.length} sx={bodyTypographySx}>{txn.cashierName}</TableCell>
                                    <TableCell rowSpan={txn.items.length} sx={bodyTypographySx}>
                                      {formatDateTime(txn.createdAt)}
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            ))
                          )
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {voidReturnData.returnedPagination && (
                    <TablePagination
                      component="div"
                      count={voidReturnData.returnedPagination.total}
                      page={returnedPage}
                      onPageChange={handleReturnedPageChange}
                      rowsPerPage={returnedPageSize}
                      onRowsPerPageChange={handleReturnedPageSizeChange}
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
                No void/return transaction data available.
              </Typography>
            </Box>
          )}
        </TabPanel>
      </Paper>
      <Toast toast={toast} onClose={hideToast} />
    </Box>
  );
};

export default SalesReportTab;

