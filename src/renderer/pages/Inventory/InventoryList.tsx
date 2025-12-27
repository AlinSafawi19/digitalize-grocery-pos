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
  IconButton,
  Chip,
  Typography,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { Edit, Warning, CheckCircle, Cancel, History, Refresh, ShoppingCart } from '@mui/icons-material';
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
import FilterHeader from '../../components/common/FilterHeader';
import { formatDateTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { usePermission } from '../../hooks/usePermission';

const InventoryList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  // Permission checks
  const canUpdate = usePermission('inventory.update');

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'productName' | 'quantity' | 'reorderLevel' | 'lastUpdated'>('productName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const loadInventory = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const options: InventoryListOptions = {
        page: page + 1,
        pageSize,
        search: search || undefined,
        lowStockOnly,
        outOfStockOnly,
        sortBy,
        sortOrder,
      };

      const result = await InventoryService.getList(options, user.id);
      if (result.success && result.items) {
        setItems(result.items);
        setTotal(result.total || 0);
      } else {
        showToast(result.error || 'Failed to load inventory', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, lowStockOnly, outOfStockOnly, sortBy, sortOrder, user?.id, showToast]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handleAdjustStock = useCallback((item: InventoryItem) => {
    navigate(ROUTES.INVENTORY_ADJUST_STOCK.replace(':productId', item.productId.toString()));
  }, [navigate]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setLowStockOnly(false);
    setOutOfStockOnly(false);
    setSortBy('productName');
    setSortOrder('asc');
    setPage(0);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  const handleFilterChange = useCallback((value: unknown) => {
    const filterValue = value as string;
    setLowStockOnly(filterValue === 'lowStock');
    setOutOfStockOnly(filterValue === 'outOfStock');
    setPage(0);
  }, []);

  const handleSortByChange = useCallback((value: unknown) => {
    setSortBy(value as 'productName' | 'quantity' | 'reorderLevel' | 'lastUpdated');
  }, []);

  const handleSortOrderChange = useCallback((value: unknown) => {
    setSortOrder(value as 'asc' | 'desc');
  }, []);

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPageSize(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  const handleNavigateToLowStock = useCallback(() => {
    navigate(ROUTES.INVENTORY_LOW_STOCK);
  }, [navigate]);

  const handleNavigateToMovements = useCallback(() => {
    navigate(ROUTES.INVENTORY_MOVEMENTS);
  }, [navigate]);

  const handleNavigateToReorderSuggestions = useCallback(() => {
    navigate(ROUTES.INVENTORY_REORDER_SUGGESTIONS);
  }, [navigate]);

  const getStockStatus = useCallback((item: InventoryItem): { color: 'success' | 'warning' | 'error'; label: string; icon: React.ReactElement } => {
    if (item.quantity <= 0) {
      return {
        color: 'error',
        label: 'Out of Stock',
        icon: <Cancel fontSize="small" />,
      };
    } else if (item.quantity <= item.reorderLevel) {
      return {
        color: 'warning',
        label: 'Low Stock',
        icon: <Warning fontSize="small" />,
      };
    } else {
      return {
        color: 'success',
        label: 'In Stock',
        icon: <CheckCircle fontSize="small" />,
      };
    }
  }, []);

  // Memoize filter value
  const filterValue = useMemo(() => {
    return outOfStockOnly ? 'outOfStock' : lowStockOnly ? 'lowStock' : 'all';
  }, [outOfStockOnly, lowStockOnly]);

  // Memoize filter fields array
  const filterFields = useMemo(() => [
    {
      type: 'select' as const,
      label: 'Filter',
      value: filterValue,
      onChange: handleFilterChange,
      options: [
        { value: 'all', label: 'All Items' },
        { value: 'lowStock', label: 'Low Stock Only' },
        { value: 'outOfStock', label: 'Out of Stock Only' },
      ],
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'select' as const,
      label: 'Sort By',
      value: sortBy,
      onChange: handleSortByChange,
      options: [
        { value: 'productName', label: 'Product Name' },
        { value: 'quantity', label: 'Quantity' },
        { value: 'reorderLevel', label: 'Reorder Level' },
        { value: 'lastUpdated', label: 'Last Updated' },
      ],
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'select' as const,
      label: 'Order',
      value: sortOrder,
      onChange: handleSortOrderChange,
      options: [
        { value: 'asc', label: 'Ascending' },
        { value: 'desc', label: 'Descending' },
      ],
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
  ], [filterValue, sortBy, sortOrder, handleFilterChange, handleSortByChange, handleSortOrderChange]);

  // Memoize empty state message
  const emptyStateMessage = useMemo(() => {
    if (outOfStockOnly) return 'No out of stock items found';
    if (lowStockOnly) return 'No low stock items found';
    return 'No inventory items found';
  }, [outOfStockOnly, lowStockOnly]);

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

  const lowStockButtonSx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    borderColor: '#ed6c02',
    color: '#ed6c02',
    padding: '8px 20px',
    minHeight: '44px',
    '&:hover': {
      borderColor: '#ed6c02',
      backgroundColor: '#fff3e0',
    },
  }), []);

  const movementsButtonSx = useMemo(() => ({
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
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '12px 16px',
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
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const productNameTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const codeTypographySx = useMemo(() => ({
    fontSize: '16px',
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
    color: '#1a237e',
  }), []);

  const reorderLevelTypographySx = useMemo(() => ({
    fontSize: '13px',
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
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Box>
            <Typography variant="h4" gutterBottom fontWeight="bold" sx={titleTypographySx}>
              Inventory Management
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={subtitleTypographySx}>
              View and manage stock levels for all products
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Tooltip title="Refresh Inventory - Reload the inventory list to get the latest stock levels from the database.">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<Refresh sx={{ fontSize: '18px' }} />}
                  onClick={loadInventory}
                  disabled={loading}
                  sx={refreshButtonSx}
                >
                  Refresh
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Low Stock Alerts - View products that are running low on stock and need to be restocked.">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<Warning sx={{ fontSize: '18px' }} />}
                  onClick={handleNavigateToLowStock}
                  sx={lowStockButtonSx}
                >
                  Low Stock Alerts
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Movement History - View a complete history of all stock movements including sales, purchases, adjustments, and transfers.">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<History sx={{ fontSize: '18px' }} />}
                  onClick={handleNavigateToMovements}
                  sx={movementsButtonSx}
                >
                  Movement History
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Reorder Suggestions - View AI-powered reorder suggestions based on sales velocity and stock levels.">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<ShoppingCart sx={{ fontSize: '18px' }} />}
                  onClick={handleNavigateToReorderSuggestions}
                  sx={movementsButtonSx}
                >
                  Reorder Suggestions
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* Filters */}
        <FilterHeader
          searchPlaceholder="Search by product name, code, or barcode..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          onClear={handleClearFilters}
          fields={filterFields}
        />

        {/* Inventory Table */}
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
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Reorder Level</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Last Updated</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={emptyStateTypographySx}
                        >
                          {emptyStateMessage}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => {
                      const status = getStockStatus(item);
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
                            <Typography variant="body2" fontWeight="bold" sx={quantityTypographySx}>
                              {item.quantity.toFixed(2)} {item.product.unit}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary" sx={reorderLevelTypographySx}>
                              {item.reorderLevel.toFixed(2)} {item.product.unit}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={status.icon}
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
                            {canUpdate && (
                              <Tooltip title={`Adjust Stock for ${item.product.name} - Manually adjust the stock quantity for this product. Use this to correct inventory discrepancies or record physical counts.`}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleAdjustStock(item)}
                                  sx={editIconButtonSx}
                                >
                                  <Edit sx={{ fontSize: '18px' }} />
                                </IconButton>
                              </Tooltip>
                            )}
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

export default InventoryList;

