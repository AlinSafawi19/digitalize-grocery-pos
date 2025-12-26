import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Checkbox,
  Tooltip,
} from '@mui/material';
import { Visibility, Block, Refresh, Print } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { TransactionService, Transaction, TransactionListOptions } from '../../services/transaction.service';
import { UserService, User } from '../../services/user.service';
import { ReceiptService } from '../../services/receipt.service';
import { SettingsService } from '../../services/settings.service';
import MainLayout from '../../components/layout/MainLayout';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { formatLBPCurrency } from '../../utils/currency';
import { AuthState } from '../../store/slices/auth.slice';
import FilterHeader from '../../components/common/FilterHeader';
import { formatDateTime, convertDateRangeToUTC } from '../../utils/dateUtils';
import { ROUTES } from '../../utils/constants';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { usePermission } from '../../hooks/usePermission';

// Memoized TransactionRow component to prevent unnecessary re-renders
interface TransactionRowProps {
  transaction: Transaction;
  selected: boolean;
  canVoid: boolean;
  onSelect: (id: number) => void;
  onView: (transaction: Transaction) => void;
  onVoid: (transaction: Transaction) => void;
  onReprint: (transaction: Transaction) => void;
  reprinting: boolean;
  getStatusColor: (status: string) => string;
  getTypeColor: (type: string) => string;
}

/* eslint-disable react/prop-types */
const TransactionRow = memo<TransactionRowProps>(
  ({ transaction, selected, canVoid, onSelect, onView, onVoid, onReprint, reprinting, getStatusColor, getTypeColor }) => {
    // Memoize sx prop objects
    const chipSx = useMemo(
      () => ({
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: 500,
      }),
      []
    );

    const captionTypographySx = useMemo(
      () => ({
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#616161',
      }),
      []
    );

    const statusColor = useMemo(() => getStatusColor(transaction.status), [transaction.status, getStatusColor]);
    const typeColor = useMemo(() => getTypeColor(transaction.type), [transaction.type, getTypeColor]);

    return (
      <TableRow hover>
        {canVoid && (
          <TableCell padding="checkbox">
            {transaction.status === 'completed' ? (
              <Checkbox
                checked={selected}
                onChange={() => onSelect(transaction.id)}
                sx={{
                  color: '#1a237e',
                  '&.Mui-checked': {
                    color: '#1a237e',
                  },
                }}
              />
            ) : null}
          </TableCell>
        )}
        <TableCell>
          <Typography variant="body2" sx={{ fontSize: '16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {transaction.transactionNumber}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontSize: '16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {formatDateTime(transaction.createdAt)}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            label={transaction.type.toUpperCase()}
            size="small"
            color={typeColor as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
            sx={chipSx}
          />
        </TableCell>
        <TableCell>
          <Chip
            label={transaction.status.toUpperCase()}
            size="small"
            color={statusColor as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
            sx={chipSx}
          />
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontSize: '16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {transaction.cashier?.username || 'N/A'}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Box>
            <Typography variant="body2" sx={{ fontSize: '16px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1a237e' }}>
              ${transaction.subtotal.toFixed(2)}
            </Typography>
            {transaction.subtotalUsd !== undefined && transaction.subtotalLbp !== undefined && (
              <Typography variant="caption" color="text.secondary" sx={captionTypographySx}>
                {formatLBPCurrency({ usd: transaction.subtotalUsd, lbp: transaction.subtotalLbp })}
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell align="right">
          <Box>
            <Typography variant="body2" sx={{ fontSize: '16px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1a237e' }}>
              ${transaction.tax.toFixed(2)}
            </Typography>
            {transaction.taxUsd !== undefined && transaction.taxLbp !== undefined && (
              <Typography variant="caption" color="text.secondary" sx={captionTypographySx}>
                {formatLBPCurrency({ usd: transaction.taxUsd, lbp: transaction.taxLbp })}
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell align="right">
          <Box>
            <Typography variant="body2" sx={{ fontSize: '16px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1a237e' }}>
              ${transaction.discount.toFixed(2)}
            </Typography>
            {transaction.discountUsd !== undefined && transaction.discountLbp !== undefined && (
              <Typography variant="caption" color="text.secondary" sx={captionTypographySx}>
                {formatLBPCurrency({ usd: transaction.discountUsd, lbp: transaction.discountLbp })}
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell align="right">
          <Box>
            <Typography variant="body2" sx={{ fontSize: '16px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1a237e' }}>
              ${transaction.total.toFixed(2)}
            </Typography>
            {transaction.totalUsd !== undefined && transaction.totalLbp !== undefined && (
              <Typography variant="caption" color="text.secondary" sx={captionTypographySx}>
                {formatLBPCurrency({ usd: transaction.totalUsd, lbp: transaction.totalLbp })}
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell align="center">
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
            <Tooltip title={`View Transaction ${transaction.transactionNumber} - View detailed information including items, payments, and transaction history.`}>
              <IconButton size="small" onClick={() => onView(transaction)} sx={{ padding: '8px', color: '#616161' }}>
                <Visibility />
              </IconButton>
            </Tooltip>
            {transaction.status === 'completed' && (
              <Tooltip title={`Reprint Receipt ${transaction.transactionNumber} - Generate and print a receipt for this transaction.`}>
                <span>
                  <IconButton 
                    size="small" 
                    onClick={() => onReprint(transaction)} 
                    disabled={reprinting}
                    sx={{ padding: '8px', color: '#1a237e' }}
                  >
                    <Print />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {transaction.status === 'completed' && canVoid && (
              <Tooltip title={`Void Transaction ${transaction.transactionNumber} - Cancel this transaction. This action cannot be undone and will reverse all transaction effects including inventory changes.`}>
                <IconButton size="small" onClick={() => onVoid(transaction)} sx={{ padding: '8px', color: '#d32f2f' }}>
                  <Block />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </TableCell>
      </TableRow>
    );
  }
);
/* eslint-enable react/prop-types */

TransactionRow.displayName = 'TransactionRow';

const TransactionList: React.FC = () => {
  const { user } = useSelector((state: RootState): AuthState => state.auth);
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();

  // Permission checks
  const canVoid = usePermission('transactions.void');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'voided' | ''>('');
  const [typeFilter, setTypeFilter] = useState<'sale' | 'return' | ''>('');
  const [cashierFilter, setCashierFilter] = useState<number | ''>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<'createdAt' | 'total' | 'transactionNumber'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Users list for filter with pagination
  const [users, setUsers] = useState<User[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userHasMore, setUserHasMore] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const userSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [bulkVoidDialogOpen, setBulkVoidDialogOpen] = useState(false);
  const [bulkVoidReason, setBulkVoidReason] = useState('');
  const [reprintingReceipt, setReprintingReceipt] = useState<number | null>(null);

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

  const loadTransactions = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      // Convert date range from Beirut timezone to UTC for API
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(startDate, endDate);
      
      const options: TransactionListOptions = {
        page: page + 1,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        cashierId: cashierFilter || undefined,
        startDate: startDateUTC || undefined,
        endDate: endDateUTC || undefined,
        sortBy,
        sortOrder,
      };

      const result = await TransactionService.getTransactionHistory(options, user.id);
      if (result.success && result.transactions) {
        setTransactions(result.transactions);
        setTotal(result.total || 0);
      } else {
        showToast(result.error || 'Failed to load transactions', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, typeFilter, cashierFilter, startDate, endDate, sortBy, sortOrder, user?.id, showToast]);

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
    loadTransactions();
    // Clear selection when filters or page change
    setSelectedTransactions(new Set());
  }, [loadTransactions]);

  // Memoize helper functions
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'voided':
        return 'error';
      default:
        return 'default';
    }
  }, []);

  const getTypeColor = useCallback((type: string) => {
    switch (type) {
      case 'sale':
        return 'primary';
      case 'return':
        return 'error';
      default:
        return 'default';
    }
  }, []);

  // Memoize event handlers
  const handleViewDetails = useCallback((transaction: Transaction) => {
    navigate(`${ROUTES.TRANSACTIONS}/view/${transaction.id}`);
  }, [navigate]);

  const handleVoid = useCallback((transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setVoidReason('');
    setVoidDialogOpen(true);
  }, []);

  const confirmVoid = useCallback(async () => {
    if (!selectedTransaction || !user?.id) return;

    setVoiding(true);
    try {
      const result = await TransactionService.voidTransaction(
        selectedTransaction.id,
        voidReason || undefined,
        user.id
      );
      if (result.success) {
        setVoidDialogOpen(false);
        setSelectedTransaction(null);
        setVoidReason('');
        loadTransactions();
        showToast('Transaction voided successfully', 'success');
      } else {
        showToast(result.error || 'Failed to void transaction', 'error');
      }
    } catch {
      showToast('Failed to void transaction', 'error');
    } finally {
      setVoiding(false);
    }
  }, [selectedTransaction, voidReason, user?.id, loadTransactions, showToast]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setCashierFilter('');
    setUserSearch('');
    setStartDate(null);
    setEndDate(null);
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(0);
  }, []);

  const handleVoidDialogClose = useCallback(() => {
    setVoidDialogOpen(false);
    setVoidReason('');
    setSelectedTransaction(null);
  }, []);

  const handleVoidReasonChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVoidReason(e.target.value);
  }, []);

  const handleSelectTransaction = useCallback((transactionId: number) => {
    setSelectedTransactions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    // Only select completed transactions that can be voided
    const voidableTransactions = transactions.filter((t) => t.status === 'completed');
    setSelectedTransactions((prev) => {
      if (prev.size === voidableTransactions.length) {
        return new Set();
      } else {
        return new Set(voidableTransactions.map((t) => t.id));
      }
    });
  }, [transactions]);

  const handleBulkVoid = useCallback(() => {
    if (selectedTransactions.size === 0) return;
    setBulkVoidReason('');
    setBulkVoidDialogOpen(true);
  }, [selectedTransactions.size]);

  const confirmBulkVoid = useCallback(async () => {
    if (!user?.id || selectedTransactions.size === 0) return;

    const selectedIds = Array.from(selectedTransactions);
    let successCount = 0;

    setVoiding(true);
    try {
      // Void transactions one by one
      for (const id of selectedIds) {
        const result = await TransactionService.voidTransaction(
          id,
          bulkVoidReason || undefined,
          user.id
        );
        if (result.success) {
          successCount++;
        }
      }

      // Reload transactions to show updated status
      setSelectedTransactions(new Set());
      setBulkVoidDialogOpen(false);
      setBulkVoidReason('');
      loadTransactions();
      showToast(`Successfully voided ${successCount} transaction${successCount !== 1 ? 's' : ''}`, 'success');
    } catch (error) {
      console.error('Error voiding transactions:', error);
      showToast('Failed to void transactions', 'error');
    } finally {
      setVoiding(false);
    }
  }, [user?.id, selectedTransactions, bulkVoidReason, loadTransactions, showToast]);

  const handleBulkVoidDialogClose = useCallback(() => {
    if (!voiding) {
      setBulkVoidDialogOpen(false);
      setBulkVoidReason('');
    }
  }, [voiding]);

  const handleBulkVoidReasonChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBulkVoidReason(e.target.value);
  }, []);

  const handleReprintReceipt = useCallback(async (transaction: Transaction) => {
    if (!user?.id) return;

    setReprintingReceipt(transaction.id);
    try {
      // Get printer settings
      const printerResult = await SettingsService.getPrinterSettings(user.id);
      const printerName = printerResult.printerSettings?.printerName;

      const result = await ReceiptService.reprintReceipt(
        transaction.id,
        user.id,
        printerName
      );

      if (result.success) {
        showToast('Receipt printed successfully', 'success');
      } else {
        showToast(result.error || 'Failed to print receipt', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to print receipt', 'error');
    } finally {
      setReprintingReceipt(null);
    }
  }, [user?.id, showToast]);

  // Memoize cashier value to prevent unnecessary re-renders
  const cashierValue = useMemo(() => {
    return cashierFilter ? users.find((u) => u.id === cashierFilter) || null : null;
  }, [cashierFilter, users]);

  // Memoize filter field handlers
  const handleCashierChange = useCallback((newValue: unknown): void => {
    const user = newValue as User | null;
    setCashierFilter(user ? user.id : '');
    setPage(0);
  }, []);

  // Handle cashier input change - ignore if it matches selected value's name
  const handleCashierInputChange = useCallback((value: string) => {
    // If the input value matches the selected cashier's username, clear the search
    // This prevents searching when autocomplete reopens with selected value
    if (cashierValue && (cashierValue as User).username === value) {
      setUserSearch('');
    } else {
      setUserSearch(value);
    }
  }, [cashierValue]);

  // Handle cashier autocomplete open - clear search and reload all options
  const handleCashierOpen = useCallback(() => {
    setUserSearch('');
    setUserPage(1);
    loadUsers(1, true, '');
  }, [loadUsers]);

  const handleStatusFilterChange = useCallback((value: unknown) => {
    setStatusFilter(value as 'pending' | 'completed' | 'voided' | '');
    setPage(0);
  }, []);

  const handleTypeFilterChange = useCallback((value: unknown) => {
    setTypeFilter(value as 'sale' | 'return' | '');
    setPage(0);
  }, []);

  const handleSortByChange = useCallback((value: unknown) => {
    setSortBy(value as 'createdAt' | 'total' | 'transactionNumber');
    setPage(0);
  }, []);

  const handleSortOrderChange = useCallback((value: unknown) => {
    setSortOrder(value as 'asc' | 'desc');
    setPage(0);
  }, []);

  const handleStartDateChange = useCallback((value: unknown): void => {
    setStartDate(value as Date | null);
    setPage(0);
  }, []);

  const handleEndDateChange = useCallback((value: unknown): void => {
    setEndDate(value as Date | null);
    setPage(0);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPageSize(parseInt(e.target.value, 10));
    setPage(0);
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
      borderColor: '#e0e0e0',
      padding: '12px 16px',
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
            <Typography
              variant="h4"
              gutterBottom
              fontWeight="bold"
              sx={titleTypographySx}
            >
              Transactions
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={subtitleTypographySx}
            >
              View and manage all transactions
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {selectedTransactions.size > 0 && canVoid && (
              <Tooltip title={`Void Selected Transactions - Cancel ${selectedTransactions.size} selected transaction(s). This action cannot be undone and will reverse the transaction effects.`}>
                <span>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<Block />}
                    onClick={handleBulkVoid}
                    sx={{
                      fontSize: '16px',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      textTransform: 'none',
                      borderRadius: 0,
                      backgroundColor: '#d32f2f',
                      padding: '8px 20px',
                      minHeight: '44px',
                      '&:hover': {
                        backgroundColor: '#c62828',
                      },
                    }}
                  >
                    Void Selected ({selectedTransactions.size})
                  </Button>
                </span>
              </Tooltip>
            )}
            <Tooltip title="Refresh Transactions - Reload the transaction list to get the latest data from the database.">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadTransactions}
                  disabled={loading}
                  sx={refreshButtonSx}
                >
                  Refresh
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* Filters */}
        <FilterHeader
          searchPlaceholder="Search by transaction number..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          onClear={handleClearFilters}
          fields={[
            {
              type: 'autocomplete' as const,
              label: 'Cashier',
              placeholder: 'All Cashiers',
              value: cashierValue,
              onChange: handleCashierChange,
              autocompleteOptions: users,
              getOptionLabel: (option: unknown) => (option as User).username || '',
              isOptionEqualToValue: (option: unknown, value: unknown) => (option as User).id === (value as User).id,
              loading: userLoading && (users.length === 0 || userSearch !== ''),
              onInputChange: handleCashierInputChange,
              onOpen: handleCashierOpen,
              renderInput: (params: unknown) => {
                const autocompleteParams = params as {
                  InputLabelProps?: Record<string, unknown>;
                  InputProps?: {
                    endAdornment?: React.ReactNode;
                  };
                } & React.ComponentProps<typeof TextField>;
                return (
                  <TextField
                    {...autocompleteParams}
                    label="Cashier"
                    placeholder="All Cashiers"
                    size="small"
                    fullWidth
                    InputLabelProps={{
                      ...autocompleteParams.InputLabelProps,
                      shrink: !!cashierValue,
                    }}
                    InputProps={{
                      ...autocompleteParams.InputProps,
                      endAdornment: (
                        <>
                          {userLoading && (users.length === 0 || userSearch !== '') ? <CircularProgress color="inherit" size={20} /> : null}
                          {autocompleteParams.InputProps?.endAdornment}
                        </>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        height: '40px',
                        '& fieldset': {
                          borderColor: 'rgba(0, 0, 0, 0.23)',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        transform: 'translate(14px, 9px) scale(1)',
                        '&.MuiInputLabel-shrink': {
                          transform: 'translate(14px, -9px) scale(0.75)',
                        },
                      },
                    }}
                  />
                );
              },
              ListboxProps: {
                onScroll: (event: React.UIEvent<HTMLUListElement>) => {
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
                },
                style: { maxHeight: 300 },
              },
              noOptionsText: 'No cashiers found',
              gridSize: { xs: 12, sm: 6, md: 2 },
            },
            {
              type: 'select',
              label: 'Status',
              value: statusFilter,
              onChange: handleStatusFilterChange,
              options: [
                { value: '', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'completed', label: 'Completed' },
                { value: 'voided', label: 'Voided' },
              ],
              gridSize: { xs: 12, sm: 6, md: 2 },
            },
            {
              type: 'select',
              label: 'Type',
              value: typeFilter,
              onChange: handleTypeFilterChange,
              options: [
                { value: '', label: 'All' },
                { value: 'sale', label: 'Sale' },
                { value: 'return', label: 'Return' },
              ],
              gridSize: { xs: 12, sm: 6, md: 2 },
            },
            {
              type: 'select',
              label: 'Sort By',
              value: sortBy,
              onChange: handleSortByChange,
              options: [
                { value: 'createdAt', label: 'Date' },
                { value: 'total', label: 'Total' },
                { value: 'transactionNumber', label: 'Number' },
              ],
              gridSize: { xs: 12, sm: 6, md: 2 },
            },
            {
              type: 'select',
              label: 'Order',
              value: sortOrder,
              onChange: handleSortOrderChange,
              options: [
                { value: 'asc', label: 'Ascending' },
                { value: 'desc', label: 'Descending' },
              ],
              gridSize: { xs: 12, sm: 6, md: 2 },
            },
            {
              type: 'date',
              label: 'Start Date',
              value: startDate,
              onChange: handleStartDateChange,
              gridSize: { xs: 12, sm: 6, md: 2 },
            },
            {
              type: 'date',
              label: 'End Date',
              value: endDate,
              onChange: handleEndDateChange,
              gridSize: { xs: 12, sm: 6, md: 2 },
            },
          ]}
        />

        {/* Transactions Table */}
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
                    {canVoid && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={
                            selectedTransactions.size > 0 &&
                            selectedTransactions.size < transactions.filter((t) => t.status === 'completed').length
                          }
                          checked={
                            transactions.filter((t) => t.status === 'completed').length > 0 &&
                            selectedTransactions.size === transactions.filter((t) => t.status === 'completed').length
                          }
                          onChange={handleSelectAll}
                          sx={{
                            color: '#1a237e',
                            '&.Mui-checked': {
                              color: '#1a237e',
                            },
                          }}
                        />
                      </TableCell>
                    )}
                    <TableCell>Transaction #</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Cashier</TableCell>
                    <TableCell align="right">Subtotal</TableCell>
                    <TableCell align="right">Tax</TableCell>
                    <TableCell align="right">Discount</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canVoid ? 11 : 10} align="center">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={emptyStateTypographySx}
                        >
                          No transactions found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction) => (
                      <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        selected={selectedTransactions.has(transaction.id)}
                        canVoid={canVoid}
                        onSelect={handleSelectTransaction}
                        onView={handleViewDetails}
                        onVoid={handleVoid}
                        onReprint={handleReprintReceipt}
                        reprinting={reprintingReceipt === transaction.id}
                        getStatusColor={getStatusColor}
                        getTypeColor={getTypeColor}
                      />
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

        {/* Void Transaction Dialog */}
        <ConfirmDialog
          open={voidDialogOpen}
          title="Void Transaction"
          message={
            <Box>
              <Typography variant="body1" gutterBottom>
                Are you sure you want to void this transaction?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Transaction: {selectedTransaction?.transactionNumber}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Reason (optional)"
                value={voidReason}
                onChange={handleVoidReasonChange}
                placeholder="Enter reason for voiding this transaction..."
              />
            </Box>
          }
          confirmLabel="Void"
          cancelLabel="Cancel"
          onConfirm={confirmVoid}
          onCancel={handleVoidDialogClose}
          confirmColor="error"
          loading={voiding}
        />
        {/* Bulk Void Transactions Dialog */}
        <ConfirmDialog
          open={bulkVoidDialogOpen}
          title="Void Transactions"
          message={
            <Box>
              <Typography variant="body1" gutterBottom>
                Are you sure you want to void {selectedTransactions.size} transaction{selectedTransactions.size > 1 ? 's' : ''}?
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Reason (optional)"
                value={bulkVoidReason}
                onChange={handleBulkVoidReasonChange}
                placeholder="Enter reason for voiding these transactions..."
                sx={{ mt: 2 }}
              />
            </Box>
          }
          confirmLabel="Void"
          cancelLabel="Cancel"
          onConfirm={confirmBulkVoid}
          onCancel={handleBulkVoidDialogClose}
          confirmColor="error"
          loading={voiding}
        />
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default TransactionList;

