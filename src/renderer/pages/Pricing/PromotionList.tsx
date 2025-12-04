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
  Checkbox,
} from '@mui/material';
import {
  Add,
  Visibility,
  Edit,
  Delete,
  CheckCircle,
  Cancel,
  History,
  Refresh,
} from '@mui/icons-material';
import { Tabs, Tab } from '@mui/material';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { RootState } from '../../store';
import {
  PricingService,
  Promotion,
  PromotionListOptions,
} from '../../services/pricing.service';
import MainLayout from '../../components/layout/MainLayout';
import { formatDate, toBeirutTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FilterHeader from '../../components/common/FilterHeader';
import { usePermission } from '../../hooks/usePermission';

const PromotionList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  // Permission checks
  const canCreate = usePermission('pricing.create');
  const canUpdate = usePermission('pricing.update');
  const canDelete = usePermission('pricing.delete');
  const [activeTab, setActiveTab] = useState(location.pathname.includes('/promotions') ? 1 : 0);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState<number | null>(null);
  const [selectedPromotions, setSelectedPromotions] = useState<Set<number>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'startDate'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const loadPromotions = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const options: PromotionListOptions = {
        page: page + 1,
        pageSize,
        search: search || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        isActive: activeFilter,
        sortBy,
        sortOrder,
      };

      const result = await PricingService.getPromotions(options, user.id);
      if (result.success && result.promotions) {
        setPromotions(result.promotions);
        setTotal(result.pagination?.totalItems || 0);
      } else {
        showToast(result.error || 'Failed to load promotions', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, typeFilter, activeFilter, sortBy, sortOrder, user?.id, showToast]);

  useEffect(() => {
    // Update tab based on URL
    const isPromotions = location.pathname.includes('/promotions');
    setActiveTab(isPromotions ? 1 : 0);
  }, [location.pathname]);

  useEffect(() => {
    // Only load if on promotions tab
    if (activeTab === 1) {
      loadPromotions();
      // Clear selection when filters or page change
      setSelectedPromotions(new Set());
    }
  }, [activeTab, loadPromotions]);

  const handleDeleteClick = useCallback((id: number) => {
    setPromotionToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteDialogClose = useCallback(() => {
    setDeleteDialogOpen(false);
    setPromotionToDelete(null);
  }, []);

  const handleSelectPromotion = useCallback((promotionId: number) => {
    setSelectedPromotions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(promotionId)) {
        newSet.delete(promotionId);
      } else {
        newSet.add(promotionId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedPromotions((prev) => {
      if (prev.size === promotions.length) {
        return new Set();
      } else {
        return new Set(promotions.map((p) => p.id));
      }
    });
  }, [promotions]);

  const handleBulkDelete = useCallback(() => {
    if (selectedPromotions.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedPromotions.size]);

  const confirmBulkDelete = useCallback(async () => {
    if (!user?.id || selectedPromotions.size === 0) return;

    const selectedIds = Array.from(selectedPromotions);
    let successCount = 0;

    setDeleting(true);
    try {
      // Delete promotions one by one
      for (const id of selectedIds) {
        const result = await PricingService.deletePromotion(id, user.id);
        if (result.success) {
          successCount++;
        }
      }

      // Update UI
      setPromotions((prev) => prev.filter((p) => !selectedPromotions.has(p.id)));
      setTotal((prev) => prev - successCount);
      setSelectedPromotions(new Set());
      showToast(`Successfully deleted ${successCount} promotion${successCount !== 1 ? 's' : ''}`, 'success');
    } catch (error) {
      console.error('Error deleting promotions:', error);
      showToast('Failed to delete promotions', 'error');
    } finally {
      setDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  }, [user?.id, selectedPromotions, showToast]);

  const handleBulkDeleteDialogClose = useCallback(() => {
    if (!deleting) {
      setBulkDeleteDialogOpen(false);
    }
  }, [deleting]);

  const confirmDelete = useCallback(() => {
    if (!user?.id || !promotionToDelete) return;

    setDeleting(true);
    PricingService.deletePromotion(promotionToDelete, user.id)
      .then((result) => {
        if (result.success) {
          showToast('Promotion deleted successfully', 'success');
          loadPromotions();
          handleDeleteDialogClose();
        } else {
          showToast(result.error || 'Failed to delete promotion', 'error');
        }
      })
      .catch((err) => {
        showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
      })
      .finally(() => {
        setDeleting(false);
      });
  }, [user?.id, promotionToDelete, loadPromotions, showToast, handleDeleteDialogClose]);

  const getTypeLabel = useCallback((type: Promotion['type']) => {
    const labels: Record<Promotion['type'], string> = {
      product_promotion: 'Product Promotion',
      category_promotion: 'Category Promotion',
      store_wide: 'Store-wide',
    };
    return labels[type] || type;
  }, []);

  const isActive = useCallback((promotion: Promotion) => {
    if (!promotion.isActive) return false;
    // Use Beirut timezone for comparison
    const now = toBeirutTime(new Date());
    if (!now) return false;
    
    const startDate = toBeirutTime(promotion.startDate);
    const endDate = toBeirutTime(promotion.endDate);
    
    if (!startDate || !endDate) return false;
    
    return (startDate.isBefore(now) || startDate.isSame(now)) && (endDate.isAfter(now) || endDate.isSame(now));
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
    mb: 2,
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const buttonBoxSx = useMemo(() => ({
    display: 'flex',
    gap: 1,
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
  }), []);

  const addButtonSx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#1a237e',
    padding: '8px 20px',
    minHeight: '44px',
    '&:hover': {
      backgroundColor: '#000051',
    },
  }), []);

  const tabsSx = useMemo(() => ({
    mb: 3,
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
    '& .MuiTableRow-root:hover': {
      backgroundColor: '#f9f9f9',
    },
  }), []);

  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    p: 4,
  }), []);

  const emptyStateTypographySx = useMemo(() => ({
    py: 4,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const chipSx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const viewIconButtonSx = useMemo(() => ({
    padding: '4px',
    color: '#616161',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const editIconButtonSx = useMemo(() => ({
    padding: '4px',
    color: '#1a237e',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const deleteIconButtonSx = useMemo(() => ({
    padding: '4px',
    color: '#d32f2f',
    '&:hover': {
      backgroundColor: '#ffebee',
    },
  }), []);

  const tablePaginationSx = useMemo(() => ({
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


  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    if (newValue === 0) {
      navigate('/pricing-rules');
    } else if (newValue === 2) {
      navigate('/pricing/history');
    } else {
      navigate('/promotions');
    }
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    loadPromotions();
  }, [loadPromotions]);

  const handleAddNew = useCallback(() => {
    navigate('/promotions/new');
  }, [navigate]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setTypeFilter('all');
    setActiveFilter(undefined);
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(0);
  }, []);

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPageSize(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  const handleViewDetails = useCallback((id: number) => {
    navigate(`/promotions/${id}`);
  }, [navigate]);

  const handleEdit = useCallback((id: number) => {
    navigate(`/promotions/edit/${id}`);
  }, [navigate]);

  const handleTypeFilterChange = useCallback((value: unknown) => {
    setTypeFilter(value as string);
    setPage(0);
  }, []);

  const handleStatusFilterChange = useCallback((value: unknown) => {
    const val = value as string;
    setActiveFilter(val === 'all' ? undefined : val === 'active');
    setPage(0);
  }, []);

  const handleSortByChange = useCallback((value: unknown) => {
    setSortBy(value as 'name' | 'createdAt' | 'startDate');
  }, []);

  const handleSortOrderChange = useCallback((value: unknown) => {
    setSortOrder(value as 'asc' | 'desc');
  }, []);

  // Memoize filterFields array with memoized handlers
  const filterFields = useMemo(() => [
    {
      type: 'select' as const,
      label: 'Type',
      value: typeFilter,
      onChange: handleTypeFilterChange,
      options: [
        { value: 'all', label: 'All Types' },
        { value: 'product_promotion', label: 'Product' },
        { value: 'category_promotion', label: 'Category' },
        { value: 'store_wide', label: 'Store-wide' },
      ],
      gridSize: { xs: 12, md: 2 },
    },
    {
      type: 'select' as const,
      label: 'Status',
      value: activeFilter === undefined ? 'all' : activeFilter ? 'active' : 'inactive',
      onChange: handleStatusFilterChange,
      options: [
        { value: 'all', label: 'All' },
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
      gridSize: { xs: 12, md: 2 },
    },
    {
      type: 'select' as const,
      label: 'Sort By',
      value: sortBy,
      onChange: handleSortByChange,
      options: [
        { value: 'name', label: 'Name' },
        { value: 'createdAt', label: 'Created Date' },
        { value: 'startDate', label: 'Start Date' },
      ],
      gridSize: { xs: 12, md: 2 },
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
      gridSize: { xs: 12, md: 2 },
    },
  ], [typeFilter, activeFilter, sortBy, sortOrder, handleTypeFilterChange, handleStatusFilterChange, handleSortByChange, handleSortOrderChange]);

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography sx={titleTypographySx}>Pricing & Promotions</Typography>
          <Box sx={buttonBoxSx}>
          {selectedPromotions.size > 0 && activeTab === 1 && canDelete && (
              <Tooltip title={`Delete Selected Promotions - Permanently delete ${selectedPromotions.size} selected promotion(s). This action cannot be undone.`}>
                <span>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<Delete sx={{ fontSize: '18px' }} />}
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
                    Delete Selected ({selectedPromotions.size})
                  </Button>
                </span>
              </Tooltip>
            )}
            <Tooltip title="Refresh Promotions - Reload the promotions list to get the latest data from the database.">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={handleRefresh}
                  disabled={loading}
                  sx={refreshButtonSx}
                >
                  Refresh
                </Button>
              </span>
            </Tooltip>
            {canCreate && (
              <Tooltip title="New Promotion - Create a new promotion to offer discounts and special deals to customers.">
                <span>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={handleAddNew}
                    sx={addButtonSx}
                  >
                    New Promotion
                  </Button>
                </span>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Tabs value={activeTab} onChange={handleTabChange} sx={tabsSx}>
          <Tab label="Pricing Rules" />
          <Tab label="Promotions" />
          <Tab label="History" icon={<History />} iconPosition="start" />
        </Tabs>

        <FilterHeader
          searchPlaceholder="Search by name..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          onClear={handleClearFilters}
          fields={filterFields}
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
                    {activeTab === 1 && canDelete && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedPromotions.size > 0 && selectedPromotions.size < promotions.length}
                          checked={promotions.length > 0 && selectedPromotions.size === promotions.length}
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
                    <TableCell>Description</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Pricing Rules</TableCell>
                    <TableCell>Date Range</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {promotions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={activeTab === 1 ? (canDelete ? 8 : 7) : 7} align="center">
                        <Typography variant="body2" color="text.secondary" sx={emptyStateTypographySx}>
                          No promotions found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    promotions.map((promotion) => (
                      <TableRow key={promotion.id} hover>
                        {activeTab === 1 && canDelete && (
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedPromotions.has(promotion.id)}
                              onChange={() => handleSelectPromotion(promotion.id)}
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
                          <Typography variant="body2" sx={bodyTypographySx}>
                            {promotion.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                            {promotion.description || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={getTypeLabel(promotion.type)} size="small" sx={chipSx} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`${promotion.pricingRulesCount || 0} rules`}
                            size="small"
                            color={promotion.pricingRulesCount && promotion.pricingRulesCount > 0 ? 'primary' : 'default'}
                            variant={promotion.pricingRulesCount && promotion.pricingRulesCount > 0 ? 'filled' : 'outlined'}
                            sx={chipSx}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={bodyTypographySx}>
                            {formatDate(promotion.startDate)}
                            {' - '}
                            {formatDate(promotion.endDate)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={isActive(promotion) ? 'Active' : 'Inactive'}
                            color={isActive(promotion) ? 'success' : 'default'}
                            size="small"
                            icon={isActive(promotion) ? <CheckCircle /> : <Cancel />}
                            sx={chipSx}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title={`View ${promotion.name} - View detailed information about this promotion including discount details, validity period, and status.`}>
                            <IconButton
                              size="small"
                              onClick={() => handleViewDetails(promotion.id)}
                              sx={viewIconButtonSx}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {canUpdate && (
                            <Tooltip title={`Edit ${promotion.name} - Modify this promotion's discount, validity period, and conditions.`}>
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(promotion.id)}
                                sx={editIconButtonSx}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canDelete && (
                            <Tooltip title={`Delete ${promotion.name} - Permanently remove this promotion. This action cannot be undone.`}>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteClick(promotion.id)}
                                sx={deleteIconButtonSx}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
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
                sx={tablePaginationSx}
              />
            </>
          )}
        </TableContainer>
      </Box>
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Promotion"
        message="Are you sure you want to delete this promotion? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={handleDeleteDialogClose}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={deleting}
      />
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onCancel={handleBulkDeleteDialogClose}
        onConfirm={confirmBulkDelete}
        title="Delete Promotions"
        message={`Are you sure you want to delete ${selectedPromotions.size} promotion${selectedPromotions.size > 1 ? 's' : ''}?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={deleting}
      />
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default PromotionList;

