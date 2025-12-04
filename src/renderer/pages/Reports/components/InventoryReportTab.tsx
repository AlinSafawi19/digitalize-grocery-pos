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
  Chip,
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  Paper,
  Tabs,
  Tab,
  Select,
  FormControl,
  InputLabel,
  TablePagination,
} from '@mui/material';
import {
  Inventory,
  Warning,
  Cancel,
  Download,
  SwapHoriz,
  EventBusy,
} from '@mui/icons-material';
import {
  ReportService,
  InventoryReportData,
  StockMovementReportData,
  ExpiryReportData,
} from '../../../services/report.service';
import { formatCurrency } from '../../../utils/formatters';
import {
  exportInventoryReportToCSV,
  exportInventoryReportToExcel,
  exportInventoryReportToPDF,
  exportStockMovementReportToCSV,
  exportStockMovementReportToExcel,
  exportStockMovementReportToPDF,
  exportExpiryReportToCSV,
  exportExpiryReportToExcel,
  exportExpiryReportToPDF,
} from '../../../utils/exportUtils';
import { convertDateRangeToUTC, formatDateTime } from '../../../utils/dateUtils';
import { useToast } from '../../../hooks/useToast';
import Toast from '../../../components/common/Toast';

interface InventoryReportTabProps {
  dateRange: { startDate: Date; endDate: Date };
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
    <div role="tabpanel" hidden={value !== index} id={`inventory-tabpanel-${index}`} {...other}>
      {value === index && <Box sx={tabPanelBoxSx}>{children}</Box>}
    </div>
  );
};

const InventoryReportTab: React.FC<InventoryReportTabProps> = ({ dateRange, userId }) => {
  const { toast, showToast, hideToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<InventoryReportData | null>(null);
  const [stockMovementData, setStockMovementData] = useState<StockMovementReportData | null>(null);
  const [expiryData, setExpiryData] = useState<ExpiryReportData | null>(null);
  const [inventorySummaryExportMenuAnchor, setInventorySummaryExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [stockMovementExportMenuAnchor, setStockMovementExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [expiryExportMenuAnchor, setExpiryExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [stockMovementLoading, setStockMovementLoading] = useState(false);
  const [expiryLoading, setExpiryLoading] = useState(false);
  const [movementFilter, setMovementFilter] = useState<{ productId?: number; type?: string }>({});
  const [stockMovementPage, setStockMovementPage] = useState(0);
  const [stockMovementPageSize, setStockMovementPageSize] = useState(20);
  const [expiryPage, setExpiryPage] = useState(0);
  const [expiryPageSize, setExpiryPageSize] = useState(20);
  const [inventoryPage, setInventoryPage] = useState(0);
  const [inventoryPageSize, setInventoryPageSize] = useState(20);

  const loadReport = useCallback(async () => {
    setLoading(true);

    try {
      const result = await ReportService.getInventoryReport(
        {
          page: inventoryPage + 1, // Convert from 0-based to 1-based
          pageSize: inventoryPageSize,
        },
        userId
      );

      if (result.success && result.data) {
        setReportData(result.data);
      } else {
        showToast(result.error || 'Failed to load inventory report', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, inventoryPage, inventoryPageSize, showToast]);

  const loadStockMovementReport = useCallback(async () => {
    setStockMovementLoading(true);
    try {
      // Convert date range from Beirut timezone to UTC for API
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(
        dateRange.startDate,
        dateRange.endDate
      );

      const result = await ReportService.getStockMovementReport(
        {
          startDate: startDateUTC!,
          endDate: endDateUTC!,
          productId: movementFilter.productId,
          type: movementFilter.type,
          page: stockMovementPage + 1, // Convert from 0-based to 1-based
          pageSize: stockMovementPageSize,
        },
        userId
      );
      if (result.success && result.data) {
        setStockMovementData(result.data);
      }
    } catch (err) {
      console.error('Error loading stock movement report', err);
    } finally {
      setStockMovementLoading(false);
    }
  }, [dateRange, userId, movementFilter, stockMovementPage, stockMovementPageSize]);

  const loadExpiryReport = useCallback(async () => {
    setExpiryLoading(true);
    try {
      const result = await ReportService.getExpiryReport(
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          page: expiryPage + 1, // Convert from 0-based to 1-based
          pageSize: expiryPageSize,
        },
        userId
      );
      if (result.success && result.data) {
        setExpiryData(result.data);
      }
    } catch (err) {
      console.error('Error loading expiry report', err);
    } finally {
      setExpiryLoading(false);
    }
  }, [dateRange, userId, expiryPage, expiryPageSize]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (activeSubTab === 1) {
      loadStockMovementReport();
    } else if (activeSubTab === 2) {
      loadExpiryReport();
    }
  }, [activeSubTab, loadStockMovementReport, loadExpiryReport]);

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

  const selectTextFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '13px',
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
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const handleSubTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setActiveSubTab(newValue);
  }, []);

  const handleExportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setInventorySummaryExportMenuAnchor(event.currentTarget);
  }, []);

  const handleExportMenuClose = useCallback(() => {
    setInventorySummaryExportMenuAnchor(null);
  }, []);

  const handleExportCSV = useCallback(async () => {
    if (reportData) {
      await exportInventoryReportToCSV(reportData);
    }
    handleExportMenuClose();
  }, [reportData, handleExportMenuClose]);

  const handleExportExcel = useCallback(async () => {
    if (reportData) {
      await exportInventoryReportToExcel(reportData);
    }
    handleExportMenuClose();
  }, [reportData, handleExportMenuClose]);

  const handleExportPDF = useCallback(async () => {
    if (reportData) {
      await exportInventoryReportToPDF(reportData, userId);
    }
    handleExportMenuClose();
  }, [reportData, userId, handleExportMenuClose]);

  const handleStockMovementExportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setStockMovementExportMenuAnchor(event.currentTarget);
  }, []);

  const handleStockMovementExportMenuClose = useCallback(() => {
    setStockMovementExportMenuAnchor(null);
  }, []);

  const handleStockMovementExportCSV = useCallback(() => {
    if (stockMovementData) {
      exportStockMovementReportToCSV(stockMovementData, dateRange);
    }
    handleStockMovementExportMenuClose();
  }, [stockMovementData, dateRange, handleStockMovementExportMenuClose]);

  const handleStockMovementExportExcel = useCallback(async () => {
    if (stockMovementData) {
      await exportStockMovementReportToExcel(stockMovementData, dateRange);
    }
    handleStockMovementExportMenuClose();
  }, [stockMovementData, dateRange, handleStockMovementExportMenuClose]);

  const handleStockMovementExportPDF = useCallback(async () => {
    if (stockMovementData) {
      await exportStockMovementReportToPDF(stockMovementData, dateRange, userId);
    }
    handleStockMovementExportMenuClose();
  }, [stockMovementData, dateRange, userId, handleStockMovementExportMenuClose]);

  const handleExpiryExportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setExpiryExportMenuAnchor(event.currentTarget);
  }, []);

  const handleExpiryExportMenuClose = useCallback(() => {
    setExpiryExportMenuAnchor(null);
  }, []);

  const handleExpiryExportCSV = useCallback(() => {
    if (expiryData) {
      exportExpiryReportToCSV(expiryData, dateRange);
    }
    handleExpiryExportMenuClose();
  }, [expiryData, dateRange, handleExpiryExportMenuClose]);

  const handleExpiryExportExcel = useCallback(async () => {
    if (expiryData) {
      await exportExpiryReportToExcel(expiryData, dateRange);
    }
    handleExpiryExportMenuClose();
  }, [expiryData, dateRange, handleExpiryExportMenuClose]);

  const handleExpiryExportPDF = useCallback(async () => {
    if (expiryData) {
      await exportExpiryReportToPDF(expiryData, dateRange, userId);
    }
    handleExpiryExportMenuClose();
  }, [expiryData, dateRange, userId, handleExpiryExportMenuClose]);

  const handleMovementTypeChange = useCallback((e: { target: { value: unknown } }) => {
    setMovementFilter((prev) => ({ ...prev, type: e.target.value as string || undefined }));
  }, []);

  const handleInventoryPageChange = useCallback((_: unknown, newPage: number) => {
    setInventoryPage(newPage);
  }, []);

  const handleInventoryPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInventoryPageSize(parseInt(e.target.value, 10));
    setInventoryPage(0);
  }, []);

  const handleStockMovementPageChange = useCallback((_: unknown, newPage: number) => {
    setStockMovementPage(newPage);
  }, []);

  const handleStockMovementPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setStockMovementPageSize(parseInt(e.target.value, 10));
    setStockMovementPage(0);
  }, []);

  const handleExpiryPageChange = useCallback((_: unknown, newPage: number) => {
    setExpiryPage(newPage);
  }, []);

  const handleExpiryPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setExpiryPageSize(parseInt(e.target.value, 10));
    setExpiryPage(0);
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'expired':
        return 'error';
      case 'expiring_soon':
        return 'warning';
      case 'expiring_later':
        return 'info';
      default:
        return 'default';
    }
  }, []);

  const getStatusLabel = useCallback((status: string) => {
    switch (status) {
      case 'expired':
        return 'Expired';
      case 'expiring_soon':
        return 'Expiring Soon';
      case 'expiring_later':
        return 'Expiring Later';
      default:
        return 'No Expiry';
    }
  }, []);

  const getExpiryRowSx = useCallback((status: string) => ({
    backgroundColor:
      status === 'expired'
        ? 'error.light'
        : status === 'expiring_soon'
        ? 'warning.light'
        : 'transparent',
    '&:hover': {
      backgroundColor:
        status === 'expired'
          ? 'error.light'
          : status === 'expiring_soon'
          ? 'warning.light'
          : 'action.hover',
    },
  }), []);

  const getDaysUntilExpirySx = useCallback((daysUntilExpiry: number | null) => {
    if (daysUntilExpiry === null) {
      return { fontSize: '13px', fontFamily: 'system-ui, -apple-system, sans-serif' };
    }
    return {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: daysUntilExpiry < 0
        ? 'error.main'
        : daysUntilExpiry <= 30
        ? 'warning.main'
        : 'text.primary',
      fontWeight: daysUntilExpiry <= 30 ? 'bold' : 'normal',
    };
  }, []);

  // Memoize additional sx objects
  const emptyStateTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const emptyStateBoxSx = useMemo(() => ({
    py: 4,
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

  const stockMovementHeaderBoxSx = useMemo(() => ({
    mb: 2,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }), []);

  const expiryHeaderBoxSx = useMemo(() => ({
    mb: 2,
    display: 'flex',
    justifyContent: 'flex-end',
  }), []);

  const getQuantityTableCellSx = useCallback((quantity: number) => ({
    color: quantity >= 0 ? 'success.main' : 'error.main',
    fontWeight: 'bold',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const expiryDescriptionTypographySx = useMemo(() => ({
    mb: 2,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const expiredQuantityTypographySx = useMemo(() => ({
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
            No inventory data available.
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
          <Tab label="Inventory Summary" icon={<Inventory />} iconPosition="start" />
          <Tab label="Stock Movement" icon={<SwapHoriz />} iconPosition="start" />
          <Tab label="Expiry Report" icon={<EventBusy />} iconPosition="start" />
        </Tabs>

        {/* Inventory Summary Tab */}
        <TabPanel value={activeSubTab} index={0}>
          {loading ? (
            <Box sx={loadingBoxSx}>
              <CircularProgress />
            </Box>
          ) : !reportData ? (
            <Box sx={loadingBoxSx}>
              <Typography sx={emptyStateTypographySx}>
                No inventory data available.
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
                  anchorEl={inventorySummaryExportMenuAnchor}
                  open={Boolean(inventorySummaryExportMenuAnchor)}
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
                        <Inventory color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                          Total Products
                        </Typography>
                      </Box>
                      <Typography variant="h4" color="primary" sx={h4TypographySx}>
                        {reportData.totalProducts}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Box sx={cardHeaderBoxSx}>
                        <Inventory color="success" sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                          Stock Value
                        </Typography>
                      </Box>
                      <Typography variant="h4" color="success.main" sx={h4TypographySx}>
                        {formatCurrency(reportData.totalStockValue)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Box sx={cardHeaderBoxSx}>
                        <Warning color="warning" sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                          Low Stock
                        </Typography>
                      </Box>
                      <Typography variant="h4" color="warning.main" sx={h4TypographySx}>
                        {reportData.lowStockItems}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Box sx={cardHeaderBoxSx}>
                        <Cancel color="error" sx={{ mr: 1 }} />
                        <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                          Out of Stock
                        </Typography>
                      </Box>
                      <Typography variant="h4" color="error.main" sx={h4TypographySx}>
                        {reportData.outOfStockItems}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Inventory Items Table */}
              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Inventory Items
                  </Typography>
                  <TableContainer sx={tableContainerSx}>
                    <Table size="small" sx={tableSx}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Product Code</TableCell>
                          <TableCell>Product Name</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                          <TableCell align="right">Reorder Level</TableCell>
                          <TableCell align="right">Unit Price</TableCell>
                          <TableCell align="right">Stock Value</TableCell>
                          <TableCell align="center">Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {!reportData.items || reportData.items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center">
                              <Typography variant="body2" color="text.secondary" sx={emptyStateBoxSx}>
                                No inventory items found
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          reportData.items.map((item) => {
                            const isLowStock = item.quantity <= item.reorderLevel && item.quantity > 0;
                            const isOutOfStock = item.quantity <= 0;

                            return (
                              <TableRow key={item.productId}>
                                <TableCell sx={bodyTypographySx}>{item.productCode}</TableCell>
                                <TableCell sx={bodyTypographySx}>{item.productName}</TableCell>
                                <TableCell sx={bodyTypographySx}>{item.categoryName || 'N/A'}</TableCell>
                                <TableCell align="right" sx={bodyTypographySx}>{item.quantity}</TableCell>
                                <TableCell align="right" sx={bodyTypographySx}>{item.reorderLevel}</TableCell>
                                <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(item.unitPrice)}</TableCell>
                                <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(item.stockValue)}</TableCell>
                                <TableCell align="center">
                                  {isOutOfStock ? (
                                    <Chip label="Out of Stock" color="error" size="small" sx={chipSx} />
                                  ) : isLowStock ? (
                                    <Chip label="Low Stock" color="warning" size="small" sx={chipSx} />
                                  ) : (
                                    <Chip label="In Stock" color="success" size="small" sx={chipSx} />
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {reportData.pagination && (
                    <TablePagination
                      component="div"
                      count={reportData.pagination.total}
                      page={inventoryPage}
                      onPageChange={handleInventoryPageChange}
                      rowsPerPage={inventoryPageSize}
                      onRowsPerPageChange={handleInventoryPageSizeChange}
                      rowsPerPageOptions={[10, 20, 50, 100]}
                      sx={tablePaginationSx}
                    />
                  )}
                </CardContent>
              </Card>
            </Box>
          )}
        </TabPanel>

        {/* Stock Movement Tab */}
        <TabPanel value={activeSubTab} index={1}>
          <Box sx={stockMovementHeaderBoxSx}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Movement Type</InputLabel>
              <Select
                value={movementFilter.type || ''}
                label="Movement Type"
                onChange={handleMovementTypeChange}
                sx={selectTextFieldSx}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="sale">Sale</MenuItem>
                <MenuItem value="return">Return</MenuItem>
                <MenuItem value="adjustment">Adjustment</MenuItem>
                <MenuItem value="purchase">Purchase</MenuItem>
                <MenuItem value="damage">Damage</MenuItem>
                <MenuItem value="expiry">Expiry</MenuItem>
                <MenuItem value="transfer">Transfer</MenuItem>
              </Select>
            </FormControl>
            {stockMovementData && (
              <Box className="no-print">
                <ButtonGroup variant="outlined" size="small" sx={buttonGroupSx}>
                  <Button startIcon={<Download />} onClick={handleStockMovementExportMenuOpen}>
                    Export
                  </Button>
                </ButtonGroup>
                <Menu
                  anchorEl={stockMovementExportMenuAnchor}
                  open={Boolean(stockMovementExportMenuAnchor)}
                  onClose={handleStockMovementExportMenuClose}
                >
                  <MenuItem onClick={handleStockMovementExportCSV}>Export as CSV</MenuItem>
                  <MenuItem onClick={handleStockMovementExportExcel}>Export as Excel</MenuItem>
                  <MenuItem onClick={handleStockMovementExportPDF}>Export as PDF</MenuItem>
                </Menu>
              </Box>
            )}
          </Box>
          {stockMovementLoading ? (
            <Box sx={loadingBoxSx}>
              <CircularProgress />
            </Box>
          ) : stockMovementData ? (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Total Movements
                      </Typography>
                      <Typography variant="h4" color="primary" sx={h4TypographySx}>
                        {stockMovementData.summary.totalMovements}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Total Additions
                      </Typography>
                      <Typography variant="h4" color="success.main" sx={h4TypographySx}>
                        {stockMovementData.summary.totalAdditions.toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Total Deductions
                      </Typography>
                      <Typography variant="h4" color="error.main" sx={h4TypographySx}>
                        {stockMovementData.summary.totalDeductions.toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Stock Movements
                  </Typography>
                  <TableContainer sx={tableContainerSx}>
                    <Table size="small" sx={tableSx}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Product Code</TableCell>
                          <TableCell>Product Name</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                          <TableCell>Reason</TableCell>
                          <TableCell>User</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stockMovementData.movements.map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell sx={bodyTypographySx}>{formatDateTime(movement.timestamp)}</TableCell>
                            <TableCell sx={bodyTypographySx}>{movement.productCode}</TableCell>
                            <TableCell sx={bodyTypographySx}>{movement.productName}</TableCell>
                            <TableCell sx={bodyTypographySx}>{movement.categoryName || 'N/A'}</TableCell>
                            <TableCell>
                              <Chip label={movement.type} size="small" sx={chipSx} />
                            </TableCell>
                            <TableCell align="right" sx={getQuantityTableCellSx(movement.quantity)}>
                              {movement.quantity >= 0 ? '+' : ''}
                              {movement.quantity.toFixed(2)}
                            </TableCell>
                            <TableCell sx={bodyTypographySx}>{movement.reason || 'N/A'}</TableCell>
                            <TableCell sx={bodyTypographySx}>{movement.userName || 'System'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {stockMovementData.pagination && (
                    <TablePagination
                      component="div"
                      count={stockMovementData.pagination.total}
                      page={stockMovementPage}
                      onPageChange={handleStockMovementPageChange}
                      rowsPerPage={stockMovementPageSize}
                      onRowsPerPageChange={handleStockMovementPageSizeChange}
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
                No stock movement data available.
              </Typography>
            </Box>
          )}
        </TabPanel>

        {/* Expiry Report Tab */}
        <TabPanel value={activeSubTab} index={2}>
          {expiryData && (
            <Box sx={expiryHeaderBoxSx} className="no-print">
              <ButtonGroup variant="outlined" size="small" sx={buttonGroupSx}>
                <Button startIcon={<Download />} onClick={handleExpiryExportMenuOpen}>
                  Export
                </Button>
              </ButtonGroup>
              <Menu
                anchorEl={expiryExportMenuAnchor}
                open={Boolean(expiryExportMenuAnchor)}
                onClose={handleExpiryExportMenuClose}
              >
                <MenuItem onClick={handleExpiryExportCSV}>Export as CSV</MenuItem>
                <MenuItem onClick={handleExpiryExportExcel}>Export as Excel</MenuItem>
                <MenuItem onClick={handleExpiryExportPDF}>Export as PDF</MenuItem>
              </Menu>
            </Box>
          )}
          {expiryLoading ? (
            <Box sx={loadingBoxSx}>
              <CircularProgress />
            </Box>
          ) : expiryData ? (
            <Box>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Products with Expiry
                      </Typography>
                      <Typography variant="h4" color="primary" sx={h4TypographySx}>
                        {expiryData.summary.totalProductsWithExpiry}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Expired Products
                      </Typography>
                      <Typography variant="h4" color="error.main" sx={h4TypographySx}>
                        {expiryData.summary.totalExpiredProducts}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Expiring Soon
                      </Typography>
                      <Typography variant="h4" color="warning.main" sx={h4TypographySx}>
                        {expiryData.summary.totalExpiringSoon}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                        Within 30 days
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                        Products at Risk
                      </Typography>
                      <Typography variant="h4" color="warning.main" sx={h4TypographySx}>
                        {expiryData.summary.productsAtRisk}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                        Low stock with expiry dates
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Products with Expiry Dates
                  </Typography>
                  <Typography variant="body2" sx={expiryDescriptionTypographySx}>
                    This report shows products with expiry dates from inventory. Products are sorted by urgency (expired first, then expiring soon).
                  </Typography>
                  <TableContainer sx={tableContainerSx}>
                    <Table size="small" sx={tableSx}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Product Code</TableCell>
                          <TableCell>Product Name</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell align="right">Current Stock</TableCell>
                          <TableCell>Expiry Date</TableCell>
                          <TableCell>Days Until Expiry</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Historical Expired</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {expiryData.products.map((product) => (
                            <TableRow key={product.productId} sx={getExpiryRowSx(product.expiryStatus)}>
                            <TableCell sx={bodyTypographySx}>{product.productCode}</TableCell>
                            <TableCell sx={bodyTypographySx}>{product.productName}</TableCell>
                            <TableCell sx={bodyTypographySx}>{product.categoryName || 'N/A'}</TableCell>
                            <TableCell align="right" sx={bodyTypographySx}>{product.currentStock.toFixed(2)}</TableCell>
                            <TableCell sx={bodyTypographySx}>
                              {product.expiryDate
                                ? product.expiryDate.toLocaleDateString()
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {product.daysUntilExpiry !== null ? (
                                <Typography variant="body2" sx={getDaysUntilExpirySx(product.daysUntilExpiry)}>
                                  {product.daysUntilExpiry < 0
                                    ? `Expired ${Math.abs(product.daysUntilExpiry)} days ago`
                                    : `${product.daysUntilExpiry} days`}
                                </Typography>
                              ) : (
                                <Typography sx={bodyTypographySx}>N/A</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={getStatusLabel(product.expiryStatus)}
                                color={getStatusColor(product.expiryStatus)}
                                size="small"
                                sx={chipSx}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {product.totalExpiredQuantity > 0 ? (
                                <Typography variant="body2" color="error.main" fontWeight="bold" sx={expiredQuantityTypographySx}>
                                  {product.totalExpiredQuantity.toFixed(2)}
                                </Typography>
                              ) : (
                                <Typography sx={bodyTypographySx}>-</Typography>
                              )}
                            </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {expiryData.pagination && (
                    <TablePagination
                      component="div"
                      count={expiryData.pagination.total}
                      page={expiryPage}
                      onPageChange={handleExpiryPageChange}
                      rowsPerPage={expiryPageSize}
                      onRowsPerPageChange={handleExpiryPageSizeChange}
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
                No expiry data available.
              </Typography>
            </Box>
          )}
        </TabPanel>
      </Paper>
      <Toast toast={toast} onClose={hideToast} />
    </Box>
  );
};

export default InventoryReportTab;

