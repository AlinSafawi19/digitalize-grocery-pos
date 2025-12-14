import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
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
  Typography,
  CircularProgress,
  Checkbox,
  Chip,
} from '@mui/material';
import { Add, Edit, Delete, Refresh } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { UserService, UserListOptions, User } from '../../services/user.service';
import MainLayout from '../../components/layout/MainLayout';
import { ROUTES } from '../../utils/constants';
import FilterHeader from '../../components/common/FilterHeader';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { formatDate } from '../../utils/dateUtils';

// Memoized CashierRow component to prevent unnecessary re-renders
interface CashierRowProps {
  cashier: User;
  onEdit: (cashier: User) => void;
  onDelete: (cashier: User) => void;
  selected: boolean;
  onSelect: (cashierId: number) => void;
}

/* eslint-disable react/prop-types */
const CashierRow = memo<CashierRowProps>(({ cashier, onEdit, onDelete, selected, onSelect }) => {
  // Memoize sx prop objects
  const nameTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const editIconButtonSx = useMemo(() => ({
    padding: '8px',
    width: '48px',
    height: '48px',
    color: '#1a237e',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
  }), []);

  const deleteIconButtonSx = useMemo(() => ({
    padding: '8px',
    width: '48px',
    height: '48px',
    color: '#d32f2f',
    '&:hover': {
      backgroundColor: '#ffebee',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
  }), []);

  return (
    <TableRow hover>
      <TableCell padding="checkbox">
        <Checkbox
          checked={selected}
          onChange={() => onSelect(cashier.id)}
          sx={{
            color: '#1a237e',
            '&.Mui-checked': {
              color: '#1a237e',
            },
          }}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight="medium" sx={nameTypographySx}>
          {cashier.username}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
          {cashier.phone || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip
          label={cashier.isActive ? 'Active' : 'Inactive'}
          color={cashier.isActive ? 'success' : 'default'}
          size="small"
          sx={{
            fontSize: '14px',
            height: '32px',
          }}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
          {formatDate(cashier.createdAt) || '-'}
        </Typography>
      </TableCell>
      <TableCell align="center">
        <IconButton
          onClick={() => onEdit(cashier)}
          title="Edit"
          sx={editIconButtonSx}
        >
          <Edit />
        </IconButton>
        <IconButton
          onClick={() => onDelete(cashier)}
          title="Delete"
          sx={deleteIconButtonSx}
        >
          <Delete />
        </IconButton>
      </TableCell>
    </TableRow>
  );
});
/* eslint-enable react/prop-types */

CashierRow.displayName = 'CashierRow';

const CashierList: React.FC = () => {
  const navigate = useNavigate();
  // Optimize useSelector to only subscribe to user.id
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { toast, showToast, hideToast } = useToast();

  const [cashiers, setCashiers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedCashiers, setSelectedCashiers] = useState<Set<number>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [userLimit, setUserLimit] = useState<number | null>(null);

  // Debounced search timeout ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load user limits
  const loadUserLimits = useCallback(async () => {
    try {
      const result = await UserService.getUserLimits();
      if (result.success) {
        setUserCount(result.userCount ?? null);
        setUserLimit(result.userLimit ?? null);
      }
    } catch (err) {
      // Silently fail - limits are not critical
      console.error('Failed to load user limits:', err);
    }
  }, []);

  // Memoized loadCashiers function
  const loadCashiers = useCallback(async () => {
    if (!userId) return;

    setLoading(true);

    try {
      const options: UserListOptions = {
        page: page + 1,
        pageSize,
        search: debouncedSearch || undefined,
      };

      const result = await UserService.getUsers(options, userId);
      if (result.success && result.users) {
        setCashiers(result.users);
        setTotal(result.total || 0);
      } else {
        showToast(result.error || 'Failed to load cashiers', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, page, pageSize, debouncedSearch, showToast]);

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  // Load user limits on mount
  useEffect(() => {
    loadUserLimits();
  }, [loadUserLimits]);

  // Load cashiers when dependencies change
  useEffect(() => {
    loadCashiers();
    // Clear selection when filters or page change
    setSelectedCashiers(new Set());
  }, [loadCashiers]);

  // Reload limits after delete
  const confirmDelete = useCallback(async () => {
    if (!selectedCashier || !userId) return;

    setDeleting(true);
    try {
      const result = await UserService.deleteUser(selectedCashier.id, userId);
      if (result.success) {
        setDeleteDialogOpen(false);
        setSelectedCashier(null);
        loadCashiers();
        loadUserLimits(); // Reload limits after deletion
        showToast('Cashier deleted successfully', 'success');
      } else {
        showToast(result.error || 'Failed to delete cashier', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setDeleting(false);
    }
  }, [selectedCashier, userId, loadCashiers, loadUserLimits, showToast]);

  // Memoized event handlers
  const handleDeleteClick = useCallback((cashier: User) => {
    setSelectedCashier(cashier);
    setDeleteDialogOpen(true);
  }, []);


  const handleEdit = useCallback((cashier: User) => {
    navigate(`${ROUTES.CASHIERS}/edit/${cashier.id}`);
  }, [navigate]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setPage(0);
  }, []);

  const handleRefresh = useCallback(() => {
    loadCashiers();
    loadUserLimits();
  }, [loadCashiers, loadUserLimits]);

  const handleAddCashier = useCallback(() => {
    navigate(ROUTES.CASHIERS_NEW);
  }, [navigate]);

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPageSize(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  const handleDeleteDialogClose = useCallback(() => {
    setDeleteDialogOpen(false);
    setSelectedCashier(null);
  }, []);

  const handleSelectCashier = useCallback((cashierId: number) => {
    setSelectedCashiers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cashierId)) {
        newSet.delete(cashierId);
      } else {
        newSet.add(cashierId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedCashiers((prev) => {
      if (prev.size === cashiers.length) {
        return new Set();
      } else {
        return new Set(cashiers.map((c) => c.id));
      }
    });
  }, [cashiers]);

  const handleBulkDelete = useCallback(() => {
    if (selectedCashiers.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedCashiers.size]);

  const confirmBulkDelete = useCallback(async () => {
    if (!userId || selectedCashiers.size === 0) return;

    const selectedIds = Array.from(selectedCashiers);
    let successCount = 0;

    setDeleting(true);
    try {
      // Delete cashiers one by one
      for (const id of selectedIds) {
        const result = await UserService.deleteUser(id, userId);
        if (result.success) {
          successCount++;
        }
      }

      // Update UI
      setCashiers((prev) => prev.filter((c) => !selectedCashiers.has(c.id)));
      setTotal((prev) => prev - successCount);
      setSelectedCashiers(new Set());
      loadUserLimits(); // Reload limits after bulk deletion
      showToast(`Successfully deleted ${successCount} cashier${successCount !== 1 ? 's' : ''}`, 'success');
    } catch (error) {
      console.error('Error deleting cashiers:', error);
      showToast('Failed to delete cashiers', 'error');
    } finally {
      setDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  }, [userId, selectedCashiers, loadUserLimits, showToast]);

  const handleBulkDeleteDialogClose = useCallback(() => {
    if (!deleting) {
      setBulkDeleteDialogOpen(false);
    }
  }, [deleting]);

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

  const addButtonSx = useMemo(() => ({
    backgroundColor: '#1a237e',
    color: '#ffffff',
    borderRadius: 0,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    padding: '8px 20px',
    minHeight: '44px',
    border: '1px solid #000051',
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: '#534bae',
      boxShadow: 'none',
    },
    '&:active': {
      backgroundColor: '#000051',
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
            <Typography variant="h4" component="h1" sx={titleTypographySx}>
              Cashiers
            </Typography>
            {userCount !== null && userLimit !== null && (
              <Typography
                variant="body2"
                sx={{
                  fontSize: '16px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: userCount >= userLimit ? '#d32f2f' : '#616161',
                  mt: 0.5,
                  fontWeight: userCount >= userLimit ? 600 : 400,
                }}
              >
                Users: {userCount} / {userLimit}
                {userCount >= userLimit && ' (Limit Reached)'}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
          {selectedCashiers.size > 0 && (
            <Button
              variant="contained"
              color="error"
              startIcon={<Delete />}
              onClick={handleBulkDelete}
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
              Delete Selected ({selectedCashiers.size})
            </Button>
          )}
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
              disabled={loading}
              sx={refreshButtonSx}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddCashier}
              sx={addButtonSx}
            >
              Add Cashier
            </Button>
          </Box>
        </Box>

        <FilterHeader
          searchPlaceholder="Search cashiers..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          onClear={handleClearFilters}
          fields={[]}
        />

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
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedCashiers.size > 0 && selectedCashiers.size < cashiers.length}
                        checked={cashiers.length > 0 && selectedCashiers.size === cashiers.length}
                        onChange={handleSelectAll}
                        sx={{
                          color: '#1a237e',
                          '&.Mui-checked': {
                            color: '#1a237e',
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>Username</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cashiers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={emptyStateTypographySx}
                        >
                          No cashiers found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    cashiers.map((cashier) => (
                      <CashierRow
                        key={cashier.id}
                        cashier={cashier}
                        onEdit={handleEdit}
                        onDelete={handleDeleteClick}
                        selected={selectedCashiers.has(cashier.id)}
                        onSelect={handleSelectCashier}
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
                onRowsPerPageChange={handleRowsPerPageChange}
                rowsPerPageOptions={[10, 20, 50, 100]}
                sx={paginationSx}
              />
            </>
          )}
        </TableContainer>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          title="Delete Cashier"
          message={
            <Typography variant="body1">
              Are you sure you want to delete &quot;{selectedCashier?.username}&quot;? This action cannot be undone.
            </Typography>
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={handleDeleteDialogClose}
          confirmColor="error"
          loading={deleting}
        />
        <ConfirmDialog
          open={bulkDeleteDialogOpen}
          onCancel={handleBulkDeleteDialogClose}
          onConfirm={confirmBulkDelete}
          title="Delete Cashiers"
          message={`Are you sure you want to delete ${selectedCashiers.size} cashier${selectedCashiers.size > 1 ? 's' : ''}?`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          confirmColor="error"
          loading={deleting}
        />
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default CashierList;

