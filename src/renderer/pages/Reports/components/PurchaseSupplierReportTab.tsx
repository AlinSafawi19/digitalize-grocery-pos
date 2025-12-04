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
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  Tabs,
  Tab,
  Chip,
  TablePagination,
} from '@mui/material';
import { LocalShipping, ShoppingCart, Download } from '@mui/icons-material';
import {
  ReportService,
  PurchaseOrderReportData,
  SupplierPerformanceReport,
  DateRange,
} from '../../../services/report.service';
import { formatCurrency } from '../../../utils/formatters';
import {
  exportPurchaseOrderReportToCSV,
  exportPurchaseOrderReportToExcel,
  exportPurchaseOrderReportToPDF,
  exportSupplierPerformanceReportToCSV,
  exportSupplierPerformanceReportToExcel,
  exportSupplierPerformanceReportToPDF,
} from '../../../utils/exportUtils';
import { convertDateRangeToUTC } from '../../../utils/dateUtils';
import { useToast } from '../../../hooks/useToast';
import Toast from '../../../components/common/Toast';

interface PurchaseSupplierReportTabProps {
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
    <div role="tabpanel" hidden={value !== index} id={`purchase-tabpanel-${index}`} {...other}>
      {value === index && <Box sx={tabPanelBoxSx}>{children}</Box>}
    </div>
  );
};

const PurchaseSupplierReportTab: React.FC<PurchaseSupplierReportTabProps> = ({
  dateRange,
  userId,
}) => {
  const { toast, showToast, hideToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [purchaseOrderReport, setPurchaseOrderReport] = useState<PurchaseOrderReportData | null>(
    null
  );
  const [supplierPerformanceReport, setSupplierPerformanceReport] = useState<
    SupplierPerformanceReport[]
  >([]);
  const [supplierPerformancePagination, setSupplierPerformancePagination] = useState<{
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [purchaseOrderExportMenuAnchor, setPurchaseOrderExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [supplierPerformanceExportMenuAnchor, setSupplierPerformanceExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [ordersByStatusPage, setOrdersByStatusPage] = useState(0);
  const [ordersByStatusPageSize, setOrdersByStatusPageSize] = useState(20);
  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersPageSize, setOrdersPageSize] = useState(20);
  const [supplierPerformancePage, setSupplierPerformancePage] = useState(0);
  const [supplierPerformancePageSize, setSupplierPerformancePageSize] = useState(20);

  const loadReports = useCallback(async () => {
    setLoading(true);

    try {
      // Convert date range from Beirut timezone to UTC for API
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(
        dateRange.startDate,
        dateRange.endDate
      );

      const [purchaseResult, supplierResult] = await Promise.all([
        ReportService.getPurchaseOrderReport(
          {
            startDate: startDateUTC!,
            endDate: endDateUTC!,
            ordersByStatusPage: ordersByStatusPage + 1, // Convert from 0-based to 1-based
            ordersByStatusPageSize,
            ordersPage: ordersPage + 1, // Convert from 0-based to 1-based
            ordersPageSize,
          },
          userId
        ),
        ReportService.getSupplierPerformanceReport(
          {
            startDate: startDateUTC!,
            endDate: endDateUTC!,
            page: supplierPerformancePage + 1, // Convert from 0-based to 1-based
            pageSize: supplierPerformancePageSize,
          },
          userId
        ),
      ]);

      if (purchaseResult.success && purchaseResult.data) {
        setPurchaseOrderReport(purchaseResult.data);
      }

      if (supplierResult.success && supplierResult.data) {
        setSupplierPerformanceReport(supplierResult.data.suppliers);
        setSupplierPerformancePagination(supplierResult.data.pagination);
      }

      if (!purchaseResult.success && !supplierResult.success) {
        showToast(purchaseResult.error || supplierResult.error || 'Failed to load reports', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    dateRange,
    userId,
    ordersByStatusPage,
    ordersByStatusPageSize,
    ordersPage,
    ordersPageSize,
    supplierPerformancePage,
    supplierPerformancePageSize,
    showToast,
  ]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    p: 4,
  }), []);

  const paperSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const tabsSx = useMemo(() => ({
    borderBottom: '1px solid #c0c0c0',
    '& .MuiTab-root': {
      fontSize: '13px',
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
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: 600,
      backgroundColor: '#f5f5f5',
      borderBottom: '2px solid #c0c0c0',
    },
    '& .MuiTableCell-body': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const buttonGroupSx = useMemo(() => ({
    '& .MuiButton-root': {
      fontSize: '13px',
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
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiTablePagination-selectLabel': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiTablePagination-displayedRows': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const handleSubTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setActiveSubTab(newValue);
  }, []);

  const handleOrdersByStatusPageChange = useCallback((_: unknown, newPage: number) => {
    setOrdersByStatusPage(newPage);
  }, []);

  const handleOrdersByStatusPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setOrdersByStatusPageSize(parseInt(e.target.value, 10));
    setOrdersByStatusPage(0);
  }, []);

  const handleOrdersPageChange = useCallback((_: unknown, newPage: number) => {
    setOrdersPage(newPage);
  }, []);

  const handleOrdersPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setOrdersPageSize(parseInt(e.target.value, 10));
    setOrdersPage(0);
  }, []);

  const handleSupplierPerformancePageChange = useCallback((_: unknown, newPage: number) => {
    setSupplierPerformancePage(newPage);
  }, []);

  const handleSupplierPerformancePageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSupplierPerformancePageSize(parseInt(e.target.value, 10));
    setSupplierPerformancePage(0);
  }, []);

  const handlePurchaseOrderExportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setPurchaseOrderExportMenuAnchor(event.currentTarget);
  }, []);

  const handlePurchaseOrderExportMenuClose = useCallback(() => {
    setPurchaseOrderExportMenuAnchor(null);
  }, []);

  const handlePurchaseOrderExportCSV = useCallback(async () => {
    if (purchaseOrderReport) {
      await exportPurchaseOrderReportToCSV(purchaseOrderReport, dateRange);
    }
    handlePurchaseOrderExportMenuClose();
  }, [purchaseOrderReport, dateRange, handlePurchaseOrderExportMenuClose]);

  const handlePurchaseOrderExportExcel = useCallback(async () => {
    if (purchaseOrderReport) {
      await exportPurchaseOrderReportToExcel(purchaseOrderReport, dateRange);
    }
    handlePurchaseOrderExportMenuClose();
  }, [purchaseOrderReport, dateRange, handlePurchaseOrderExportMenuClose]);

  const handlePurchaseOrderExportPDF = useCallback(async () => {
    if (purchaseOrderReport) {
      await exportPurchaseOrderReportToPDF(purchaseOrderReport, dateRange, userId);
    }
    handlePurchaseOrderExportMenuClose();
  }, [purchaseOrderReport, dateRange, userId, handlePurchaseOrderExportMenuClose]);

  const handleSupplierPerformanceExportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setSupplierPerformanceExportMenuAnchor(event.currentTarget);
  }, []);

  const handleSupplierPerformanceExportMenuClose = useCallback(() => {
    setSupplierPerformanceExportMenuAnchor(null);
  }, []);

  const handleSupplierPerformanceExportCSV = useCallback(async () => {
    if (supplierPerformanceReport.length > 0) {
      await exportSupplierPerformanceReportToCSV(supplierPerformanceReport, dateRange);
    }
    handleSupplierPerformanceExportMenuClose();
  }, [supplierPerformanceReport, dateRange, handleSupplierPerformanceExportMenuClose]);

  const handleSupplierPerformanceExportExcel = useCallback(async () => {
    if (supplierPerformanceReport.length > 0) {
      await exportSupplierPerformanceReportToExcel(supplierPerformanceReport, dateRange);
    }
    handleSupplierPerformanceExportMenuClose();
  }, [supplierPerformanceReport, dateRange, handleSupplierPerformanceExportMenuClose]);

  const handleSupplierPerformanceExportPDF = useCallback(async () => {
    if (supplierPerformanceReport.length > 0) {
      await exportSupplierPerformanceReportToPDF(supplierPerformanceReport, dateRange, userId);
    }
    handleSupplierPerformanceExportMenuClose();
  }, [supplierPerformanceReport, dateRange, userId, handleSupplierPerformanceExportMenuClose]);

  // Memoize computed values
  const totalSupplierOrders = useMemo(() => 
    supplierPerformanceReport.reduce((sum, s) => sum + s.totalOrders, 0),
    [supplierPerformanceReport]
  );

  const totalSupplierValue = useMemo(() => 
    supplierPerformanceReport.reduce((sum, s) => sum + s.totalValue, 0),
    [supplierPerformanceReport]
  );

  const totalOutstanding = useMemo(() => 
    supplierPerformanceReport.reduce((sum, s) => sum + s.totalOutstanding, 0),
    [supplierPerformanceReport]
  );

  // Memoize additional sx objects
  const bodyTypographySx = useMemo(() => ({
    fontSize: '13px',
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

  const emptyStateBoxSx = useMemo(() => ({
    py: 4,
  }), []);

  const ordersByStatusCardSx = useMemo(() => ({
    mb: 3,
    ...cardSx,
  }), [cardSx]);

  const getOutstandingTypographySx = useCallback((outstanding: number) => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: outstanding > 0 ? 'warning.main' : 'success.main',
    fontWeight: 'bold',
  }), []);

  if (loading) {
    return (
      <Box sx={loadingBoxSx}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={paperSx}>
        <Tabs value={activeSubTab} onChange={handleSubTabChange} sx={tabsSx}>
          <Tab label="Purchase Orders" icon={<ShoppingCart />} iconPosition="start" />
          <Tab label="Supplier Performance" icon={<LocalShipping />} iconPosition="start" />
        </Tabs>

        {/* Purchase Orders Tab */}
        <TabPanel value={activeSubTab} index={0}>
          {purchaseOrderReport && (
            <Box>
              {/* Export Buttons */}
              <Box sx={exportButtonsBoxSx} className="no-print">
                <ButtonGroup variant="outlined" size="small" sx={buttonGroupSx}>
                  <Button startIcon={<Download />} onClick={handlePurchaseOrderExportMenuOpen}>
                    Export
                  </Button>
                </ButtonGroup>
                <Menu
                  anchorEl={purchaseOrderExportMenuAnchor}
                  open={Boolean(purchaseOrderExportMenuAnchor)}
                  onClose={handlePurchaseOrderExportMenuClose}
                >
                  <MenuItem onClick={handlePurchaseOrderExportCSV}>Export as CSV</MenuItem>
                  <MenuItem onClick={handlePurchaseOrderExportExcel}>Export as Excel</MenuItem>
                  <MenuItem onClick={handlePurchaseOrderExportPDF}>Export as PDF</MenuItem>
                </Menu>
              </Box>

              {/* Summary Cards */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Total Orders
                      </Typography>
                      <Typography variant="h4" color="primary" sx={h4TypographySx}>
                        {purchaseOrderReport.totalOrders}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Total Value
                      </Typography>
                      <Typography variant="h4" color="success.main" sx={h4TypographySx}>
                        {formatCurrency(purchaseOrderReport.totalValue)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Orders by Status */}
              <Card sx={ordersByStatusCardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Orders by Status
                  </Typography>
                  <TableContainer sx={tableContainerSx}>
                    <Table size="small" sx={tableSx}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Count</TableCell>
                          <TableCell align="right">Total Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {!purchaseOrderReport.ordersByStatus ||
                        purchaseOrderReport.ordersByStatus.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} align="center" sx={emptyStateBoxSx}>
                              <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                                No orders by status data available for the selected period.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          purchaseOrderReport.ordersByStatus.map((status) => (
                            <TableRow key={status.status}>
                              <TableCell sx={bodyTypographySx}>
                                <Chip label={status.status} size="small" sx={chipSx} />
                              </TableCell>
                              <TableCell align="right" sx={bodyTypographySx}>{status.count}</TableCell>
                              <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(status.value)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {purchaseOrderReport.ordersByStatusPagination && (
                    <TablePagination
                      component="div"
                      count={purchaseOrderReport.ordersByStatusPagination.total}
                      page={ordersByStatusPage}
                      onPageChange={handleOrdersByStatusPageChange}
                      rowsPerPage={ordersByStatusPageSize}
                      onRowsPerPageChange={handleOrdersByStatusPageSizeChange}
                      rowsPerPageOptions={[10, 20, 50, 100]}
                      sx={tablePaginationSx}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Orders Table */}
              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Purchase Orders
                  </Typography>
                  <TableContainer sx={tableContainerSx}>
                    <Table size="small" sx={tableSx}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Order Number</TableCell>
                          <TableCell>Supplier</TableCell>
                          <TableCell>Order Date</TableCell>
                          <TableCell>Expected Date</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {!purchaseOrderReport.orders || purchaseOrderReport.orders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={emptyStateBoxSx}>
                              <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                                No purchase orders available for the selected period.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          purchaseOrderReport.orders.map((order) => (
                            <TableRow key={order.orderNumber} hover>
                              <TableCell sx={bodyTypographySx}>{order.orderNumber}</TableCell>
                              <TableCell sx={bodyTypographySx}>{order.supplierName}</TableCell>
                              <TableCell sx={bodyTypographySx}>{order.orderDate.toLocaleDateString()}</TableCell>
                              <TableCell sx={bodyTypographySx}>
                                {order.expectedDate?.toLocaleDateString() || 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Chip label={order.status} size="small" sx={chipSx} />
                              </TableCell>
                              <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(order.total)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {purchaseOrderReport.ordersPagination && (
                    <TablePagination
                      component="div"
                      count={purchaseOrderReport.ordersPagination.total}
                      page={ordersPage}
                      onPageChange={handleOrdersPageChange}
                      rowsPerPage={ordersPageSize}
                      onRowsPerPageChange={handleOrdersPageSizeChange}
                      rowsPerPageOptions={[10, 20, 50, 100]}
                      sx={tablePaginationSx}
                    />
                  )}
                </CardContent>
              </Card>
            </Box>
          )}
        </TabPanel>

        {/* Supplier Performance Tab */}
        <TabPanel value={activeSubTab} index={1}>
          <Box>
            {/* Export Buttons */}
            <Box sx={exportButtonsBoxSx} className="no-print">
              <ButtonGroup variant="outlined" size="small" sx={buttonGroupSx}>
                <Button
                  startIcon={<Download />}
                  onClick={handleSupplierPerformanceExportMenuOpen}
                >
                  Export
                </Button>
              </ButtonGroup>
              <Menu
                anchorEl={supplierPerformanceExportMenuAnchor}
                open={Boolean(supplierPerformanceExportMenuAnchor)}
                onClose={handleSupplierPerformanceExportMenuClose}
              >
                <MenuItem
                  onClick={handleSupplierPerformanceExportCSV}
                >
                  Export as CSV
                </MenuItem>
                <MenuItem
                  onClick={handleSupplierPerformanceExportExcel}
                >
                  Export as Excel
                </MenuItem>
                <MenuItem
                  onClick={handleSupplierPerformanceExportPDF}
                >
                  Export as PDF
                </MenuItem>
              </Menu>
            </Box>

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                      Total Suppliers
                    </Typography>
                    <Typography variant="h4" color="primary" sx={h4TypographySx}>
                      {supplierPerformanceReport.length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                      Total Orders
                    </Typography>
                    <Typography variant="h4" color="primary" sx={h4TypographySx}>
                      {totalSupplierOrders}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                      Total Value
                    </Typography>
                    <Typography variant="h4" color="success.main" sx={h4TypographySx}>
                      {formatCurrency(totalSupplierValue)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                      Total Outstanding
                    </Typography>
                    <Typography variant="h4" color="warning.main" sx={h4TypographySx}>
                      {formatCurrency(totalOutstanding)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Supplier Performance Table */}
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                  Supplier Performance
                </Typography>
                <TableContainer sx={tableContainerSx}>
                  <Table size="small" sx={tableSx}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Supplier Name</TableCell>
                        <TableCell align="right">Total Orders</TableCell>
                        <TableCell align="right">Total Value</TableCell>
                        <TableCell align="right">Avg. Order Value</TableCell>
                        <TableCell align="right">Orders Received</TableCell>
                        <TableCell align="right">Orders Pending</TableCell>
                        <TableCell align="right">Total Paid</TableCell>
                        <TableCell align="right">Outstanding</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {supplierPerformanceReport.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={emptyStateBoxSx}>
                            <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                              No supplier performance data available for the selected period.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        supplierPerformanceReport.map((supplier) => (
                          <TableRow key={supplier.supplierId} hover>
                            <TableCell sx={bodyTypographySx}>{supplier.supplierName}</TableCell>
                            <TableCell align="right" sx={bodyTypographySx}>{supplier.totalOrders}</TableCell>
                            <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(supplier.totalValue)}</TableCell>
                            <TableCell align="right" sx={bodyTypographySx}>
                              {formatCurrency(supplier.averageOrderValue)}
                            </TableCell>
                            <TableCell align="right" sx={bodyTypographySx}>{supplier.ordersReceived}</TableCell>
                            <TableCell align="right" sx={bodyTypographySx}>{supplier.ordersPending}</TableCell>
                            <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(supplier.totalPaid)}</TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={getOutstandingTypographySx(supplier.totalOutstanding)}>
                                {formatCurrency(supplier.totalOutstanding)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {supplierPerformancePagination && (
                    <TablePagination
                      component="div"
                      count={supplierPerformancePagination.total}
                      page={supplierPerformancePage}
                      onPageChange={handleSupplierPerformancePageChange}
                      rowsPerPage={supplierPerformancePageSize}
                      onRowsPerPageChange={handleSupplierPerformancePageSizeChange}
                      rowsPerPageOptions={[10, 20, 50, 100]}
                      sx={tablePaginationSx}
                    />
                  )}
                </CardContent>
              </Card>
          </Box>
        </TabPanel>
      </Paper>
      <Toast toast={toast} onClose={hideToast} />
    </Box>
  );
};

export default PurchaseSupplierReportTab;

