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
  Tooltip,
} from '@mui/material';
import { Add, Edit, Delete, Visibility, Refresh } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { SupplierService, SupplierListOptions } from '../../services/supplier.service';
import { Supplier } from '../../services/product.service';
import MainLayout from '../../components/layout/MainLayout';
import { ROUTES } from '../../utils/constants';
import FilterHeader from '../../components/common/FilterHeader';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { usePermission } from '../../hooks/usePermission';

// Memoized SupplierRow component to prevent unnecessary re-renders
interface SupplierRowProps {
  supplier: Supplier;
  onView: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  selected: boolean;
  onSelect: (supplierId: number) => void;
  canUpdate: boolean;
  canDelete: boolean;
}

/* eslint-disable react/prop-types */
const SupplierRow = memo<SupplierRowProps>(({ supplier, onView, onEdit, onDelete, selected, onSelect, canUpdate, canDelete }) => {
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

  const viewIconButtonSx = useMemo(() => ({
    padding: '8px',
    width: '48px',
    height: '48px',
    color: '#616161',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
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
      {canDelete && (
        <TableCell padding="checkbox">
          <Checkbox
            checked={selected}
            onChange={() => onSelect(supplier.id)}
            sx={{
              color: '#1a237e',
              '&.Mui-checked': {
                color: '#1a237e',
              },
            }}
          />
        </TableCell>
      )}
      <TableCell>
        <Typography variant="body2" fontWeight="medium" sx={nameTypographySx}>
          {supplier.name}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
          {supplier.contact || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
          {supplier.email || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
          {supplier.phone || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
          {supplier.address || '-'}
        </Typography>
      </TableCell>
      <TableCell align="center">
        <Tooltip title={`View ${supplier.name} - View detailed information about this supplier including contact details and purchase history.`}>
          <IconButton
            onClick={() => onView(supplier)}
            sx={viewIconButtonSx}
          >
            <Visibility />
          </IconButton>
        </Tooltip>
        {canUpdate && (
          <Tooltip title={`Edit ${supplier.name} - Modify supplier details such as name, contact information, and address.`}>
            <IconButton
              onClick={() => onEdit(supplier)}
              sx={editIconButtonSx}
            >
              <Edit />
            </IconButton>
          </Tooltip>
        )}
        {canDelete && (
          <Tooltip title={`Delete ${supplier.name} - Permanently remove this supplier from the system. Products associated with this supplier will need to be updated. This action cannot be undone.`}>
            <IconButton
              onClick={() => onDelete(supplier)}
              sx={deleteIconButtonSx}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
});
/* eslint-enable react/prop-types */

SupplierRow.displayName = 'SupplierRow';

const SupplierList: React.FC = () => {
  const navigate = useNavigate();
  // Optimize useSelector to only subscribe to user.id
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { toast, showToast, hideToast } = useToast();

  // Permission checks
  const canCreate = usePermission('suppliers.create');
  const canUpdate = usePermission('suppliers.update');
  const canDelete = usePermission('suppliers.delete');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<number>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Debounced search timeout ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized loadSuppliers function
  const loadSuppliers = useCallback(async () => {
    if (!userId) return;

    setLoading(true);

    try {
      const options: SupplierListOptions = {
        page: page + 1,
        pageSize,
        search: debouncedSearch || undefined,
      };

      const result = await SupplierService.getSuppliers(options, userId);
      if (result.success && result.suppliers) {
        setSuppliers(result.suppliers);
        setTotal(result.pagination?.totalItems || 0);
      } else {
        showToast(result.error || 'Failed to load suppliers', 'error');
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

  // Load suppliers when dependencies change
  useEffect(() => {
    loadSuppliers();
    // Clear selection when filters or page change
    setSelectedSuppliers(new Set());
  }, [loadSuppliers]);

  // Memoized event handlers
  const handleDeleteClick = useCallback((supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!selectedSupplier || !userId) return;

    setDeleting(true);
    try {
      const result = await SupplierService.deleteSupplier(selectedSupplier.id, userId);
      if (result.success) {
        setDeleteDialogOpen(false);
        setSelectedSupplier(null);
        loadSuppliers();
        showToast('Supplier deleted successfully', 'success');
      } else {
        showToast(result.error || 'Failed to delete supplier', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setDeleting(false);
    }
  }, [selectedSupplier, userId, loadSuppliers, showToast]);

  const handleEdit = useCallback((supplier: Supplier) => {
    navigate(`${ROUTES.SUPPLIERS}/edit/${supplier.id}`);
  }, [navigate]);

  const handleView = useCallback((supplier: Supplier) => {
    navigate(`/suppliers/${supplier.id}`);
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
    loadSuppliers();
  }, [loadSuppliers]);

  const handleAddSupplier = useCallback(() => {
    navigate(ROUTES.SUPPLIERS_NEW);
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
    setSelectedSupplier(null);
  }, []);

  const handleSelectSupplier = useCallback((supplierId: number) => {
    setSelectedSuppliers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(supplierId)) {
        newSet.delete(supplierId);
      } else {
        newSet.add(supplierId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedSuppliers((prev) => {
      if (prev.size === suppliers.length) {
        return new Set();
      } else {
        return new Set(suppliers.map((s) => s.id));
      }
    });
  }, [suppliers]);

  const handleBulkDelete = useCallback(() => {
    if (selectedSuppliers.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedSuppliers.size]);

  const confirmBulkDelete = useCallback(async () => {
    if (!userId || selectedSuppliers.size === 0) return;

    const selectedIds = Array.from(selectedSuppliers);
    let successCount = 0;

    setDeleting(true);
    try {
      // Delete suppliers one by one
      for (const id of selectedIds) {
        const result = await SupplierService.deleteSupplier(id, userId);
        if (result.success) {
          successCount++;
        }
      }

      // Update UI
      setSuppliers((prev) => prev.filter((s) => !selectedSuppliers.has(s.id)));
      setTotal((prev) => prev - successCount);
      setSelectedSuppliers(new Set());
      showToast(`Successfully deleted ${successCount} supplier${successCount !== 1 ? 's' : ''}`, 'success');
    } catch (error) {
      console.error('Error deleting suppliers:', error);
      showToast('Failed to delete suppliers', 'error');
    } finally {
      setDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  }, [userId, selectedSuppliers, showToast]);

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
          <Typography variant="h4" component="h1" sx={titleTypographySx}>
            Suppliers
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
          {selectedSuppliers.size > 0 && canDelete && (
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
              Delete Selected ({selectedSuppliers.size})
            </Button>
          )}
            <Tooltip title="Refresh Suppliers - Reload the supplier list to get the latest data from the database.">
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={handleRefresh}
                disabled={loading}
                sx={refreshButtonSx}
              >
                Refresh
              </Button>
            </Tooltip>
            {canCreate && (
              <Tooltip title="Add Supplier - Create a new supplier with contact information and address details.">
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleAddSupplier}
                  sx={addButtonSx}
                >
                  Add Supplier
                </Button>
              </Tooltip>
            )}
          </Box>
        </Box>

        <FilterHeader
          searchPlaceholder="Search suppliers..."
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
                    {canDelete && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedSuppliers.size > 0 && selectedSuppliers.size < suppliers.length}
                          checked={suppliers.length > 0 && selectedSuppliers.size === suppliers.length}
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
                    <TableCell>Name</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {suppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canDelete ? 7 : 6} align="center">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={emptyStateTypographySx}
                        >
                          No suppliers found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    suppliers.map((supplier) => (
                      <SupplierRow
                        key={supplier.id}
                        supplier={supplier}
                        onView={handleView}
                        onEdit={handleEdit}
                        onDelete={handleDeleteClick}
                        selected={selectedSuppliers.has(supplier.id)}
                        onSelect={handleSelectSupplier}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
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
          title="Delete Supplier"
          message={
            <Typography variant="body1">
              Are you sure you want to delete &quot;{selectedSupplier?.name}&quot;? This action cannot be undone.
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
          title="Delete Suppliers"
          message={`Are you sure you want to delete ${selectedSuppliers.size} supplier${selectedSuppliers.size > 1 ? 's' : ''}?`}
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

export default SupplierList;

