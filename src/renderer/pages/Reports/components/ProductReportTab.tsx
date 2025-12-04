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
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  TablePagination,
} from '@mui/material';
import { ShoppingBag, TrendingUp, History, Download } from '@mui/icons-material';
import { ReportService, ProductPerformanceReport, DateRange } from '../../../services/report.service';
import { formatCurrency, formatPercentage } from '../../../utils/formatters';
import {
  exportProductPerformanceReportToCSV,
  exportProductPerformanceReportToExcel,
  exportProductPerformanceReportToPDF,
} from '../../../utils/exportUtils';
import { convertDateRangeToUTC } from '../../../utils/dateUtils';
import { useToast } from '../../../hooks/useToast';
import Toast from '../../../components/common/Toast';

interface ProductReportTabProps {
  dateRange: DateRange;
  userId: number;
}

const ProductReportTab: React.FC<ProductReportTabProps> = ({ dateRange, userId }) => {
  const { toast, showToast, hideToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ProductPerformanceReport[]>([]);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [sortBy, setSortBy] = useState<'revenue' | 'profit' | 'quantity'>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const loadReport = useCallback(async () => {
    setLoading(true);

    try {
      // Convert date range from Beirut timezone to UTC for API
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(
        dateRange.startDate,
        dateRange.endDate
      );

      const result = await ReportService.getProductPerformanceReport(
        {
          startDate: startDateUTC!,
          endDate: endDateUTC!,
          page: page + 1, // Convert from 0-based to 1-based
          pageSize,
        },
        userId
      );

      if (result.success && result.data) {
        setReportData(result.data.products);
        setPagination(result.data.pagination);
      } else {
        showToast(result.error || 'Failed to load product performance report', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange, userId, page, pageSize, showToast]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    p: 4,
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

  const handleExportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setExportMenuAnchor(event.currentTarget);
  }, []);

  const handleExportMenuClose = useCallback(() => {
    setExportMenuAnchor(null);
  }, []);

  const handleExportCSV = useCallback(async () => {
    if (reportData.length > 0) {
      await exportProductPerformanceReportToCSV(reportData, dateRange);
    }
    handleExportMenuClose();
  }, [reportData, dateRange, handleExportMenuClose]);

  const handleExportExcel = useCallback(async () => {
    if (reportData.length > 0) {
      await exportProductPerformanceReportToExcel(reportData, dateRange);
    }
    handleExportMenuClose();
  }, [reportData, dateRange, handleExportMenuClose]);

  const handleExportPDF = useCallback(async () => {
    if (reportData.length > 0) {
      await exportProductPerformanceReportToPDF(reportData, dateRange, userId);
    }
    handleExportMenuClose();
  }, [reportData, dateRange, userId, handleExportMenuClose]);

  const handleSortByChange = useCallback((e: SelectChangeEvent) => {
    setSortBy(e.target.value as 'revenue' | 'profit' | 'quantity');
  }, []);

  const handleSortOrderChange = useCallback((e: SelectChangeEvent) => {
    setSortOrder(e.target.value as 'asc' | 'desc');
  }, []);

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPageSize(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  // Memoize computed values
  const totalRevenue = useMemo(() => 
    reportData.reduce((sum, p) => sum + p.totalRevenue, 0),
    [reportData]
  );

  const totalProfit = useMemo(() => 
    reportData.reduce((sum, p) => sum + p.profit, 0),
    [reportData]
  );

  const totalQuantity = useMemo(() => 
    reportData.reduce((sum, p) => sum + p.totalQuantitySold, 0),
    [reportData]
  );

  // Sort data
  const sortedData = useMemo(() => {
    return [...reportData].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'revenue':
          aValue = a.totalRevenue;
          bValue = b.totalRevenue;
          break;
        case 'profit':
          aValue = a.profit;
          bValue = b.profit;
          break;
        case 'quantity':
          aValue = a.totalQuantitySold;
          bValue = b.totalQuantitySold;
          break;
        default:
          aValue = a.totalRevenue;
          bValue = b.totalRevenue;
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [reportData, sortBy, sortOrder]);

  // Memoize additional sx objects
  const headerBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 2,
  }), []);

  const sortControlsBoxSx = useMemo(() => ({
    display: 'flex',
    gap: 2,
    alignItems: 'center',
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const h6TypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const h4TypographySx = useMemo(() => ({
    fontSize: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const h6BoldTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const cardHeaderBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    mb: 1,
  }), []);

  const emptyStateBoxSx = useMemo(() => ({
    py: 4,
  }), []);

  const getProfitTypographySx = useCallback((profit: number) => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: profit >= 0 ? 'success.main' : 'error.main',
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
      {/* Export Buttons and Sort Controls */}
      <Box sx={headerBoxSx}>
        <Box sx={sortControlsBoxSx}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Sort By</InputLabel>
            <Select value={sortBy} label="Sort By" onChange={handleSortByChange} sx={selectTextFieldSx}>
              <MenuItem value="revenue">Revenue</MenuItem>
              <MenuItem value="profit">Profit</MenuItem>
              <MenuItem value="quantity">Quantity</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Order</InputLabel>
            <Select value={sortOrder} label="Order" onChange={handleSortOrderChange} sx={selectTextFieldSx}>
              <MenuItem value="desc">Descending</MenuItem>
              <MenuItem value="asc">Ascending</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <ButtonGroup variant="outlined" size="small" sx={buttonGroupSx}>
          <Button startIcon={<Download />} onClick={handleExportMenuOpen}>
            Export
          </Button>
        </ButtonGroup>
        <Menu anchorEl={exportMenuAnchor} open={Boolean(exportMenuAnchor)} onClose={handleExportMenuClose}>
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
                <ShoppingBag color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                  Total Products
                </Typography>
              </Box>
              <Typography variant="h4" color="primary" sx={h4TypographySx}>
                {reportData.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={cardSx}>
            <CardContent>
              <Box sx={cardHeaderBoxSx}>
                <TrendingUp color="success" sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                  Total Revenue
                </Typography>
              </Box>
              <Typography variant="h4" color="success.main" sx={h4TypographySx}>
                {formatCurrency(totalRevenue)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={cardSx}>
            <CardContent>
              <Box sx={cardHeaderBoxSx}>
                <TrendingUp color="info" sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                  Total Profit
                </Typography>
              </Box>
              <Typography variant="h4" color="info.main" sx={h4TypographySx}>
                {formatCurrency(totalProfit)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={cardSx}>
            <CardContent>
              <Box sx={cardHeaderBoxSx}>
                <History color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="bold" sx={h6TypographySx}>
                  Total Quantity
                </Typography>
              </Box>
              <Typography variant="h4" color="primary" sx={h4TypographySx}>
                {totalQuantity}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Product Performance Table */}
      <Card sx={cardSx}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
            Product Performance
          </Typography>
          <TableContainer sx={tableContainerSx}>
            <Table size="small" sx={tableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Product Code</TableCell>
                  <TableCell>Product Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Quantity Sold</TableCell>
                  <TableCell align="right">Revenue</TableCell>
                  <TableCell align="right">Cost</TableCell>
                  <TableCell align="right">Profit</TableCell>
                  <TableCell align="right">Profit Margin</TableCell>
                  <TableCell align="right">Avg. Price</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={emptyStateBoxSx}>
                      <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                        No product performance data available for the selected period.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((product) => (
                    <TableRow key={product.productId} hover>
                      <TableCell sx={bodyTypographySx}>{product.productCode}</TableCell>
                      <TableCell sx={bodyTypographySx}>{product.productName}</TableCell>
                      <TableCell sx={bodyTypographySx}>{product.categoryName || 'N/A'}</TableCell>
                      <TableCell align="right" sx={bodyTypographySx}>{product.totalQuantitySold}</TableCell>
                      <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(product.totalRevenue)}</TableCell>
                      <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(product.totalCost)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={getProfitTypographySx(product.profit)}>
                          {formatCurrency(product.profit)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={bodyTypographySx}>{formatPercentage(product.profitMargin)}</TableCell>
                      <TableCell align="right" sx={bodyTypographySx}>{formatCurrency(product.averagePrice)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              </Table>
            </TableContainer>
            {pagination && (
              <TablePagination
                component="div"
                count={pagination.total}
                page={page}
                onPageChange={handlePageChange}
                rowsPerPage={pageSize}
                onRowsPerPageChange={handlePageSizeChange}
                rowsPerPageOptions={[10, 20, 50, 100]}
                sx={tablePaginationSx}
              />
            )}
          </CardContent>
        </Card>
      <Toast toast={toast} onClose={hideToast} />
    </Box>
  );
};

export default ProductReportTab;

