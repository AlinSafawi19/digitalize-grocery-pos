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
  TextField,
  Button,
  IconButton,
  Chip,
  Typography,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Tooltip,
  Card,
  CardContent,
  Tabs,
  Tab,
  SelectChangeEvent,
} from '@mui/material';
import { Search, Edit, Warning, Refresh, Warehouse, Cancel } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import {
  InventoryService,
  InventoryItem,
  InventoryListOptions,
} from '../../services/inventory.service';
import MainLayout from '../../components/layout/MainLayout';
import { ROUTES } from '../../utils/constants';
import { formatDateTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

const LowStockAlerts: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'productName' | 'quantity' | 'reorderLevel' | 'lastUpdated'>('productName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [outOfStockCount, setOutOfStockCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'lowStock' | 'outOfStock'>('lowStock');

  const loadItems = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const options: Omit<InventoryListOptions, 'lowStockOnly' | 'outOfStockOnly'> = {
        page: page + 1,
        pageSize,
        search: search || undefined,
        sortBy,
        sortOrder,
      };

      const result =
        activeTab === 'outOfStock'
          ? await InventoryService.getOutOfStockItems(options, user.id)
          : await InventoryService.getLowStockItems(options, user.id);

      if (result.success && result.items) {
        setItems(result.items);
        setTotal(result.total || 0);
        if (activeTab === 'outOfStock') {
          setOutOfStockCount(result.total || 0);
        } else {
          setLowStockCount(result.total || 0);
        }
      } else {
        showToast(result.error || `Failed to load ${activeTab === 'outOfStock' ? 'out of stock' : 'low stock'} items`, 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, sortBy, sortOrder, activeTab, user?.id, showToast]);

  const loadCounts = useCallback(async () => {
    try {
      const [lowStockResult, outOfStockResult] = await Promise.all([
        InventoryService.getLowStockCount(),
        InventoryService.getOutOfStockCount(),
      ]);
      if (lowStockResult.success) {
        setLowStockCount(lowStockResult.count || 0);
      }
      if (outOfStockResult.success) {
        setOutOfStockCount(outOfStockResult.count || 0);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load stock counts', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const handleRefresh = useCallback(() => {
    loadItems();
    loadCounts();
  }, [loadItems, loadCounts]);

  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: 'lowStock' | 'outOfStock') => {
    setActiveTab(newValue);
    setPage(0); // Reset to first page when switching tabs
  }, []);

  const handleAdjustStock = useCallback((item: InventoryItem) => {
    navigate(ROUTES.INVENTORY_ADJUST_STOCK.replace(':productId', item.productId.toString()));
  }, [navigate]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(0);
  }, []);

  const handleSortByChange = useCallback((e: SelectChangeEvent<'productName' | 'quantity' | 'reorderLevel' | 'lastUpdated'>) => {
    setSortBy(e.target.value as 'productName' | 'quantity' | 'reorderLevel' | 'lastUpdated');
  }, []);

  const handleSortOrderChange = useCallback((e: SelectChangeEvent<'asc' | 'desc'>) => {
    setSortOrder(e.target.value as 'asc' | 'desc');
  }, []);

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPageSize(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  const handleNavigateToInventory = useCallback(() => {
    navigate(ROUTES.INVENTORY);
  }, [navigate]);

  const getStockStatus = useCallback((item: InventoryItem): { color: 'error' | 'warning'; label: string } => {
    if (item.quantity <= 0) {
      return {
        color: 'error',
        label: 'Out of Stock',
      };
    } else {
      return {
        color: 'warning',
        label: 'Low Stock',
      };
    }
  }, []);

  const getStockPercentage = useCallback((item: InventoryItem): number => {
    if (item.reorderLevel === 0) return 0;
    return Math.min(100, (item.quantity / item.reorderLevel) * 100);
  }, []);

  // Memoize empty state messages
  const emptyStateTitle = useMemo(() => {
    return activeTab === 'outOfStock' ? 'No out of stock items found' : 'No low stock items found';
  }, [activeTab]);

  const emptyStateSubtitle = useMemo(() => {
    return activeTab === 'outOfStock'
      ? 'All products have stock available'
      : 'All products are adequately stocked';
  }, [activeTab]);

  // Memoize tab labels
  const lowStockTabLabel = useMemo(() => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Warning sx={{ fontSize: '18px' }} />
      Low Stock ({lowStockCount})
    </Box>
  ), [lowStockCount]);

  const outOfStockTabLabel = useMemo(() => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Cancel sx={{ fontSize: '18px' }} />
      Out of Stock ({outOfStockCount})
    </Box>
  ), [outOfStockCount]);

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

  const inventoryButtonSx = useMemo(() => ({
    fontSize: '16px',
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
  }), []);

  const lowStockCardSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#fff3e0',
    borderLeft: '4px solid #ed6c02',
  }), []);

  const outOfStockCardSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffebee',
    borderLeft: '4px solid #d32f2f',
  }), []);

  const cardContentBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }), []);

  const lowStockTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#ed6c02',
  }), []);

  const lowStockCountTypographySx = useMemo(() => ({
    fontSize: { xs: '32px', sm: '40px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#ed6c02',
  }), []);

  const outOfStockTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#d32f2f',
  }), []);

  const outOfStockCountTypographySx = useMemo(() => ({
    fontSize: { xs: '32px', sm: '40px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#d32f2f',
  }), []);

  const cardBodyTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const tabsPaperSx = useMemo(() => ({
    mb: 2,
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const tabsSx = useMemo(() => ({
    borderBottom: '1px solid #e0e0e0',
    '& .MuiTab-root': {
      textTransform: 'none',
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '48px',
      '&.Mui-selected': {
        color: '#1a237e',
      },
    },
    '& .MuiTabs-indicator': {
      backgroundColor: '#1a237e',
    },
  }), []);

  const filtersPaperSx = useMemo(() => ({
    p: 2,
    mb: 2,
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const searchTextFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '13px',
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
    },
  }), []);

  const inputLabelSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const selectSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: '#c0c0c0',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#1a237e',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#1a237e',
    },
  }), []);

  const menuItemSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
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

  const emptyStateBoxSx = useMemo(() => ({
    py: 4,
  }), []);

  const emptyStateTitleTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const emptyStateSubtitleTypographySx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const productNameTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const codeTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const categoryChipSx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const quantityTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const reorderLevelTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const stockLevelBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  }), []);

  const progressBarContainerSx = useMemo(() => ({
    width: 100,
    height: 8,
    bgcolor: '#e0e0e0',
    borderRadius: 0,
    overflow: 'hidden',
  }), []);

  const progressBarSx = useMemo(() => ({
    height: '100%',
  }), []);

  const stockPercentageTypographySx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const statusChipSx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const lastUpdatedTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const editIconButtonSx = useMemo(() => ({
    padding: '4px',
    color: '#1a237e',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
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
          <Box>
            <Typography variant="h4" gutterBottom fontWeight="bold" sx={titleTypographySx}>
              Stock Alerts
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={subtitleTypographySx}>
              Products that need restocking
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<Refresh sx={{ fontSize: '18px' }} />}
              onClick={handleRefresh}
              disabled={loading}
              sx={refreshButtonSx}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<Warehouse sx={{ fontSize: '18px' }} />}
              onClick={handleNavigateToInventory}
              sx={inventoryButtonSx}
            >
              View All Inventory
            </Button>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Card sx={lowStockCardSx}>
              <CardContent>
                <Box sx={cardContentBoxSx}>
                  <Box>
                    <Typography variant="h6" fontWeight="bold" gutterBottom sx={lowStockTitleTypographySx}>
                      Low Stock
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={lowStockCountTypographySx}>
                      {loading ? <CircularProgress size={32} /> : lowStockCount}
                    </Typography>
                    <Typography variant="body2" sx={cardBodyTypographySx}>
                      {lowStockCount === 1 ? 'product needs' : 'products need'} restocking
                    </Typography>
                  </Box>
                  <Warning sx={{ fontSize: 60, opacity: 0.8, color: '#ed6c02' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={outOfStockCardSx}>
              <CardContent>
                <Box sx={cardContentBoxSx}>
                  <Box>
                    <Typography variant="h6" fontWeight="bold" gutterBottom sx={outOfStockTitleTypographySx}>
                      Out of Stock
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={outOfStockCountTypographySx}>
                      {loading ? <CircularProgress size={32} /> : outOfStockCount}
                    </Typography>
                    <Typography variant="body2" sx={cardBodyTypographySx}>
                      {outOfStockCount === 1 ? 'product is' : 'products are'} completely out
                    </Typography>
                  </Box>
                  <Cancel sx={{ fontSize: 60, opacity: 0.8, color: '#d32f2f' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={tabsPaperSx}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="stock alert tabs"
            sx={tabsSx}
          >
            <Tab label={lowStockTabLabel} value="lowStock" />
            <Tab label={outOfStockTabLabel} value="outOfStock" />
          </Tabs>
        </Paper>

        {/* Filters */}
        <Paper sx={filtersPaperSx}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by product name, code, or barcode..."
                value={search}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: '#616161', fontSize: '18px' }} />,
                }}
                sx={searchTextFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={inputLabelSx}>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={handleSortByChange}
                  sx={selectSx}
                >
                  <MenuItem value="productName" sx={menuItemSx}>Product Name</MenuItem>
                  <MenuItem value="quantity" sx={menuItemSx}>Quantity</MenuItem>
                  <MenuItem value="reorderLevel" sx={menuItemSx}>Reorder Level</MenuItem>
                  <MenuItem value="lastUpdated" sx={menuItemSx}>Last Updated</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={inputLabelSx}>Order</InputLabel>
                <Select
                  value={sortOrder}
                  label="Order"
                  onChange={handleSortOrderChange}
                  sx={selectSx}
                >
                  <MenuItem value="asc" sx={menuItemSx}>Ascending</MenuItem>
                  <MenuItem value="desc" sx={menuItemSx}>Descending</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Low Stock Items Table */}
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
                    <TableCell>Product</TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Current Stock</TableCell>
                    <TableCell align="right">Reorder Level</TableCell>
                    <TableCell>Stock Level</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Last Updated</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <Box sx={emptyStateBoxSx}>
                          <Typography
                            variant="body1"
                            color="text.secondary"
                            gutterBottom
                            sx={emptyStateTitleTypographySx}
                          >
                            {emptyStateTitle}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={emptyStateSubtitleTypographySx}
                          >
                            {emptyStateSubtitle}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => {
                      const status = getStockStatus(item);
                      const stockPercentage = getStockPercentage(item);
                      const quantityColor = status.color === 'error' ? '#d32f2f' : '#ed6c02';
                      const progressBarColor = status.color === 'error' ? '#d32f2f' : '#ed6c02';
                      
                      return (
                        <TableRow key={item.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium" sx={productNameTypographySx}>
                              {item.product.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" sx={codeTypographySx}>
                              {item.product.code}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {item.product.category ? (
                              <Chip
                                label={item.product.category.name}
                                size="small"
                                sx={categoryChipSx}
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary" sx={codeTypographySx}>
                                -
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              fontWeight="bold"
                              sx={[quantityTypographySx, { color: quantityColor }]}
                            >
                              {item.quantity.toFixed(2)} {item.product.unit}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary" sx={reorderLevelTypographySx}>
                              {item.reorderLevel.toFixed(2)} {item.product.unit}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={stockLevelBoxSx}>
                              <Box sx={progressBarContainerSx}>
                                <Box
                                  sx={[
                                    progressBarSx,
                                    {
                                    width: `${stockPercentage}%`,
                                      bgcolor: progressBarColor,
                                    },
                                  ]}
                                />
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={stockPercentageTypographySx}>
                                {stockPercentage.toFixed(0)}%
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={<Warning sx={{ fontSize: '16px' }} />}
                              label={status.label}
                              size="small"
                              color={status.color}
                              sx={statusChipSx}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" sx={lastUpdatedTypographySx}>
                              {formatDateTime(item.lastUpdated)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Adjust Stock">
                              <IconButton
                                size="small"
                                onClick={() => handleAdjustStock(item)}
                                sx={editIconButtonSx}
                              >
                                <Edit sx={{ fontSize: '18px' }} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
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

export default LowStockAlerts;

