import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Chip,
  ChipProps,
  Typography,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  SelectChangeEvent,
  Autocomplete,
} from '@mui/material';
import { Search, Refresh, Warehouse } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import {
  InventoryService,
  StockMovement,
  StockMovementListOptions,
} from '../../services/inventory.service';
import { UserService, User } from '../../services/user.service';
import MainLayout from '../../components/layout/MainLayout';
import { ROUTES } from '../../utils/constants';
import { formatDateTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

const StockMovementHistory: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [cashierFilter, setCashierFilter] = useState<number | ''>('');
  const [users, setUsers] = useState<User[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userHasMore, setUserHasMore] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const userSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [sortBy, setSortBy] = useState<'timestamp' | 'quantity' | 'type'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const loadUsers = useCallback(async (page: number, reset: boolean = false, search: string = '') => {
    if (!user?.id) return;
    
    setUserLoading(true);
    try {
      const result = await UserService.getUsers(
        { page, pageSize: 50, isActive: true, search: search || undefined },
        user.id
      );
      if (result.success && result.users) {
        if (reset) {
          setUsers(result.users);
        } else {
          setUsers((prev) => [...prev, ...result.users!]);
        }
        // Check if there are more pages based on pagination info
        const pageSize = 50;
        const total = result.total || 0;
        const loadedCount = reset ? result.users.length : (page - 1) * pageSize + result.users.length;
        setUserHasMore(loadedCount < total);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setUserLoading(false);
    }
  }, [user?.id]);

  const loadMovements = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const options: StockMovementListOptions = {
        page: page + 1,
        pageSize,
        type: typeFilter || undefined,
        userId: cashierFilter || undefined,
        sortBy,
        sortOrder,
      };

      const result = await InventoryService.getStockMovements(options, user.id);
      if (result.success && result.movements) {
        // Filter by search if provided
        let filteredMovements = result.movements;
        if (search) {
          const searchLower = search.toLowerCase();
          filteredMovements = result.movements.filter(
            (m) =>
              m.product.name.toLowerCase().includes(searchLower) ||
              m.product.code.toLowerCase().includes(searchLower) ||
              (m.reason && m.reason.toLowerCase().includes(searchLower))
          );
        }
        setMovements(filteredMovements);
        setTotal(search ? filteredMovements.length : result.total || 0);
      } else {
        showToast(result.error || 'Failed to load stock movements', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, cashierFilter, sortBy, sortOrder, user?.id, search, showToast]);

  // Debounce user search
  useEffect(() => {
    if (userSearchTimeoutRef.current) {
      clearTimeout(userSearchTimeoutRef.current);
    }
    userSearchTimeoutRef.current = setTimeout(() => {
      setDebouncedUserSearch(userSearch);
    }, 300);

    return () => {
      if (userSearchTimeoutRef.current) {
        clearTimeout(userSearchTimeoutRef.current);
      }
    };
  }, [userSearch]);

  // Load initial users
  useEffect(() => {
    if (user?.id) {
      setUserPage(1);
      loadUsers(1, true, '');
    }
  }, [user?.id, loadUsers]);

  // Reset and reload when debounced search changes
  useEffect(() => {
    if (user?.id) {
      setUserPage(1);
      loadUsers(1, true, debouncedUserSearch);
    }
  }, [debouncedUserSearch, user?.id, loadUsers]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 0) {
        loadMovements();
      } else {
        setPage(0);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [search, loadMovements, page]);

  const handleRefresh = useCallback(() => {
    loadMovements();
  }, [loadMovements]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const handleTypeFilterChange = useCallback((e: SelectChangeEvent<string>) => {
    setTypeFilter(e.target.value);
    setPage(0);
  }, []);

  const handleCashierFilterChange = useCallback((value: unknown) => {
    const newValue = value as User | null;
    setCashierFilter(newValue ? newValue.id : '');
    setPage(0);
  }, []);

  const handleUserScroll = useCallback((event: React.UIEvent<HTMLUListElement>) => {
    const listboxNode = event.currentTarget;
    if (
      listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 10 &&
      userHasMore &&
      !userLoading
    ) {
      const nextPage = userPage + 1;
      setUserPage(nextPage);
      loadUsers(nextPage, false, debouncedUserSearch);
    }
  }, [userHasMore, userLoading, userPage, debouncedUserSearch, loadUsers]);

  const handleSortByChange = useCallback((e: SelectChangeEvent<'timestamp' | 'quantity' | 'type'>) => {
    setSortBy(e.target.value as 'timestamp' | 'quantity' | 'type');
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

  const getTypeColor = useCallback((type: string) => {
    switch (type) {
      case 'sale':
        return 'error';
      case 'return':
        return 'success';
      case 'purchase':
        return 'primary';
      case 'adjustment':
        return 'default';
      case 'damage':
      case 'expiry':
        return 'warning';
      default:
        return 'default';
    }
  }, []);

  const getTypeLabel = useCallback((type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }, []);

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

  const emptyStateTypographySx = useMemo(() => ({
    py: 4,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const timestampTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
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

  const typeChipSx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const quantityTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const reasonTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const cashierTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const userTextFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      height: '40px',
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
      fontFamily: 'system-ui, -apple-system, sans-serif',
      transform: 'translate(14px, 9px) scale(1)',
      '&.MuiInputLabel-shrink': {
        transform: 'translate(14px, -9px) scale(0.75)',
      },
    },
  }), []);

  const listboxPropsSx = useMemo(() => ({
    style: { maxHeight: 300 },
  }), []);

  // Memoize user value to prevent unnecessary re-renders
  const userValue = useMemo(() => {
    return cashierFilter ? users.find((u) => u.id === cashierFilter) || null : null;
  }, [cashierFilter, users]);

  const getOptionLabel = useCallback((option: unknown) => {
    const user = option as User;
    return user.username || '';
  }, []);

  const isOptionEqualToValue = useCallback((option: unknown, value: unknown) => {
    const userOption = option as User;
    const userValue = value as User;
    return userOption.id === userValue.id;
  }, []);

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
              Stock Movement History
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={subtitleTypographySx}>
              View all stock movements and adjustments
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

        {/* Filters */}
        <Paper sx={filtersPaperSx}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by product name, code, or reason..."
                value={search}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: '#616161', fontSize: '18px' }} />,
                }}
                sx={searchTextFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel sx={inputLabelSx}>Type</InputLabel>
                <Select
                  value={typeFilter}
                  label="Type"
                  onChange={handleTypeFilterChange}
                  sx={selectSx}
                >
                  <MenuItem value="" sx={menuItemSx}>All Types</MenuItem>
                  <MenuItem value="sale" sx={menuItemSx}>Sale</MenuItem>
                  <MenuItem value="return" sx={menuItemSx}>Return</MenuItem>
                  <MenuItem value="purchase" sx={menuItemSx}>Purchase</MenuItem>
                  <MenuItem value="adjustment" sx={menuItemSx}>Adjustment</MenuItem>
                  <MenuItem value="damage" sx={menuItemSx}>Damage</MenuItem>
                  <MenuItem value="expiry" sx={menuItemSx}>Expiry</MenuItem>
                  <MenuItem value="transfer" sx={menuItemSx}>Transfer</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Autocomplete
                fullWidth
                size="small"
                options={users}
                value={userValue}
                onChange={(_, newValue) => handleCashierFilterChange(newValue)}
                onInputChange={(_, newInputValue) => {
                  // If the input value matches the selected user's username, clear the search
                  // This prevents searching when autocomplete reopens with selected value
                  if (userValue && userValue.username === newInputValue) {
                    setUserSearch('');
                  } else {
                    setUserSearch(newInputValue);
                  }
                }}
                onOpen={() => {
                  setUserSearch('');
                  setUserPage(1);
                  loadUsers(1, true, '');
                }}
                getOptionLabel={getOptionLabel}
                isOptionEqualToValue={isOptionEqualToValue}
                loading={userLoading && (users.length === 0 || userSearch !== '')}
                clearOnBlur={false}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Cashier"
                    placeholder="All Cashiers"
                    InputLabelProps={{
                      ...params.InputLabelProps,
                      shrink: !!userValue,
                    }}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {userLoading && (users.length === 0 || userSearch !== '') ? (
                            <CircularProgress color="inherit" size={20} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                    sx={userTextFieldSx}
                  />
                )}
                ListboxProps={{
                  onScroll: handleUserScroll,
                  ...listboxPropsSx,
                }}
                noOptionsText="No cashiers found"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel sx={inputLabelSx}>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={handleSortByChange}
                  sx={selectSx}
                >
                  <MenuItem value="timestamp" sx={menuItemSx}>Date</MenuItem>
                  <MenuItem value="quantity" sx={menuItemSx}>Quantity</MenuItem>
                  <MenuItem value="type" sx={menuItemSx}>Type</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
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

        {/* Movements Table */}
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
                    <TableCell>Date & Time</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Cashier</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {movements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary" sx={emptyStateTypographySx}>
                          No stock movements found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    movements.map((movement) => {
                      const typeColor = getTypeColor(movement.type);
                      const quantityColor = movement.quantity >= 0 ? '#2e7d32' : '#d32f2f';
                      
                      return (
                        <TableRow key={movement.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={timestampTypographySx}>
                              {formatDateTime(movement.timestamp)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium" sx={productNameTypographySx}>
                              {movement.product.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" sx={codeTypographySx}>
                              {movement.product.code}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getTypeLabel(movement.type)}
                              size="small"
                              color={typeColor as ChipProps['color']}
                              sx={typeChipSx}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              fontWeight="bold"
                              sx={[quantityTypographySx, { color: quantityColor }]}
                            >
                              {movement.quantity >= 0 ? '+' : ''}
                              {movement.quantity.toFixed(2)} {movement.product.unit}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" sx={reasonTypographySx}>
                              {movement.reason || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" sx={cashierTypographySx}>
                              {movement.user?.username || '-'}
                            </Typography>
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

export default StockMovementHistory;

