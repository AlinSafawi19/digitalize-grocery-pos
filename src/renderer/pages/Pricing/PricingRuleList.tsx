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
  PricingRule,
  PricingRuleListOptions,
} from '../../services/pricing.service';
import MainLayout from '../../components/layout/MainLayout';
import FilterHeader from '../../components/common/FilterHeader';
import { formatDate, toBeirutTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { usePermission } from '../../hooks/usePermission';

const PricingRuleList: React.FC = () => {
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
  const [ruleToDelete, setRuleToDelete] = useState<number | null>(null);
  const [selectedRules, setSelectedRules] = useState<Set<number>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'startDate'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const loadRules = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const options: PricingRuleListOptions = {
        page: page + 1,
        pageSize,
        search: search || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        isActive: activeFilter,
        sortBy,
        sortOrder,
      };

      const result = await PricingService.getRules(options, user.id);
      if (result.success && result.rules) {
        setRules(result.rules);
        setTotal(result.pagination?.totalItems || 0);
      } else {
        showToast(result.error || 'Failed to load pricing rules', 'error');
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
    // Only load if on pricing rules tab
    if (activeTab === 0) {
      loadRules();
      // Clear selection when filters or page change
      setSelectedRules(new Set());
    }
  }, [activeTab, loadRules]);

  const handleDeleteClick = useCallback((id: number) => {
    setRuleToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteDialogClose = useCallback(() => {
    setDeleteDialogOpen(false);
    setRuleToDelete(null);
  }, []);

  const handleSelectRule = useCallback((ruleId: number) => {
    setSelectedRules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedRules((prev) => {
      if (prev.size === rules.length) {
        return new Set();
      } else {
        return new Set(rules.map((r) => r.id));
      }
    });
  }, [rules]);

  const handleBulkDelete = useCallback(() => {
    if (selectedRules.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedRules.size]);

  const confirmBulkDelete = useCallback(async () => {
    if (!user?.id || selectedRules.size === 0) return;

    const selectedIds = Array.from(selectedRules);
    let successCount = 0;

    setDeleting(true);
    try {
      // Delete rules one by one
      for (const id of selectedIds) {
        const result = await PricingService.deleteRule(id, user.id);
        if (result.success) {
          successCount++;
        }
      }

      // Update UI
      setRules((prev) => prev.filter((r) => !selectedRules.has(r.id)));
      setTotal((prev) => prev - successCount);
      setSelectedRules(new Set());
      showToast(`Successfully deleted ${successCount} pricing rule${successCount !== 1 ? 's' : ''}`, 'success');
    } catch (error) {
      console.error('Error deleting pricing rules:', error);
      showToast('Failed to delete pricing rules', 'error');
    } finally {
      setDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  }, [user?.id, selectedRules, showToast]);

  const handleBulkDeleteDialogClose = useCallback(() => {
    if (!deleting) {
      setBulkDeleteDialogOpen(false);
    }
  }, [deleting]);

  const confirmDelete = useCallback(() => {
    if (!user?.id || !ruleToDelete) return;

    setDeleting(true);
    PricingService.deleteRule(ruleToDelete, user.id)
      .then((result) => {
        if (result.success) {
          showToast('Pricing rule deleted successfully', 'success');
          loadRules();
          handleDeleteDialogClose();
        } else {
          showToast(result.error || 'Failed to delete pricing rule', 'error');
        }
      })
      .catch((err) => {
        showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
      })
      .finally(() => {
        setDeleting(false);
      });
  }, [user?.id, ruleToDelete, loadRules, showToast, handleDeleteDialogClose]);

  const getTypeLabel = useCallback((type: PricingRule['type']) => {
    const labels: Record<PricingRule['type'], string> = {
      percentage_discount: 'Percentage Discount',
      fixed_discount: 'Fixed Discount',
      quantity_based: 'Quantity Based',
      buy_x_get_y: 'Buy X Get Y',
      time_based: 'Time Based',
    };
    return labels[type] || type;
  }, []);

  const getDiscountDisplay = useCallback((rule: PricingRule) => {
    if (rule.discountType === 'percentage') {
      return `${rule.discountValue}%`;
    }
    return `$${rule.discountValue.toFixed(2)}`;
  }, []);

  const getTargetDisplay = useCallback((rule: PricingRule) => {
    if (rule.product) {
      return `Product: ${rule.product.name}`;
    }
    if (rule.category) {
      return `Category: ${rule.category.name}`;
    }
    return 'Store-wide';
  }, []);

  const isActive = useCallback((rule: PricingRule) => {
    if (!rule.isActive) return false;
    // Use Beirut timezone for comparison
    const now = toBeirutTime(new Date());
    if (!now) return false;
    
    if (rule.startDate) {
      const startDate = toBeirutTime(rule.startDate);
      if (startDate && startDate.isAfter(now)) return false;
    }
    
    if (rule.endDate) {
      const endDate = toBeirutTime(rule.endDate);
      if (endDate && endDate.isBefore(now)) return false;
    }
    
    return true;
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setTypeFilter('all');
    setActiveFilter(undefined);
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(0);
  }, []);

  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    if (newValue === 1) {
      navigate('/promotions');
    } else if (newValue === 2) {
      navigate('/pricing/history');
    } else {
      navigate('/pricing-rules');
    }
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    loadRules();
  }, [loadRules]);

  const handleAddNew = useCallback(() => {
    navigate(activeTab === 0 ? '/pricing-rules/new' : '/promotions/new');
  }, [activeTab, navigate]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  const handleTypeFilterChange = useCallback((value: unknown) => {
    setTypeFilter(value as string);
    setPage(0);
  }, []);

  const handleStatusFilterChange = useCallback((value: unknown) => {
    setActiveFilter(value === 'all' ? undefined : value === 'active');
    setPage(0);
  }, []);

  const handleSortByChange = useCallback((value: unknown) => {
    setSortBy(value as 'name' | 'createdAt' | 'startDate');
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

  const handleViewDetails = useCallback((id: number) => {
    navigate(`/pricing-rules/${id}`);
  }, [navigate]);

  const handleEdit = useCallback((id: number) => {
    navigate(`/pricing-rules/edit/${id}`);
  }, [navigate]);

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

  // Memoize filterFields array
  const filterFields = useMemo(() => [
    {
      type: 'select' as const,
      label: 'Type',
      value: typeFilter,
      onChange: handleTypeFilterChange,
      options: [
        { value: 'all', label: 'All Types' },
        { value: 'percentage_discount', label: 'Percentage Discount' },
        { value: 'fixed_discount', label: 'Fixed Discount' },
        { value: 'quantity_based', label: 'Quantity Based' },
        { value: 'buy_x_get_y', label: 'Buy X Get Y' },
        { value: 'time_based', label: 'Time Based' },
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
          {selectedRules.size > 0 && activeTab === 0 && canDelete && (
              <Tooltip title={`Delete Selected Pricing Rules - Permanently delete ${selectedRules.size} selected pricing rule(s). This action cannot be undone.`}>
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
                      padding: '6px 16px',
                      '&:hover': {
                        backgroundColor: '#c62828',
                      },
                    }}
                  >
                    Delete Selected ({selectedRules.size})
                  </Button>
                </span>
              </Tooltip>
            )}
            <Tooltip title="Refresh Pricing Rules - Reload the pricing rules list to get the latest data from the database.">
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
              <Tooltip title={activeTab === 0 ? "New Pricing Rule - Create a new pricing rule to automatically adjust product prices based on conditions like quantity, date, or customer type." : "New Promotion - Create a new promotion to offer discounts and special deals to customers."}>
                <span>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={handleAddNew}
                    sx={addButtonSx}
                  >
                    {activeTab === 0 ? 'New Pricing Rule' : 'New Promotion'}
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
                    {activeTab === 0 && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedRules.size > 0 && selectedRules.size < rules.length}
                          checked={rules.length > 0 && selectedRules.size === rules.length}
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
                    <TableCell>Type</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell>Discount</TableCell>
                    <TableCell>Min Quantity</TableCell>
                    <TableCell>Date Range</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={activeTab === 0 ? 9 : 8} align="center">
                        <Typography variant="body2" color="text.secondary" sx={emptyStateTypographySx}>
                          No pricing rules found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rules.map((rule) => (
                      <TableRow key={rule.id} hover>
                        {activeTab === 0 && (
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedRules.has(rule.id)}
                              onChange={() => handleSelectRule(rule.id)}
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
                            {rule.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={getTypeLabel(rule.type)} size="small" sx={chipSx} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={bodyTypographySx}>
                            {getTargetDisplay(rule)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={bodyTypographySx}>
                            {getDiscountDisplay(rule)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={bodyTypographySx}>
                            {rule.minQuantity}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {rule.startDate || rule.endDate ? (
                            <Typography variant="body2" sx={bodyTypographySx}>
                              {rule.startDate
                                ? formatDate(rule.startDate)
                                : 'No start'}
                              {' - '}
                              {rule.endDate
                                ? formatDate(rule.endDate)
                                : 'No end'}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={isActive(rule) ? 'Active' : 'Inactive'}
                            color={isActive(rule) ? 'success' : 'default'}
                            size="small"
                            icon={isActive(rule) ? <CheckCircle /> : <Cancel />}
                            sx={chipSx}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title={`View ${rule.name} - View detailed information about this pricing rule including conditions, actions, and status.`}>
                            <IconButton
                              size="small"
                              onClick={() => handleViewDetails(rule.id)}
                              sx={viewIconButtonSx}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {canUpdate && (
                            <Tooltip title={`Edit ${rule.name} - Modify this pricing rule's conditions, actions, and settings.`}>
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(rule.id)}
                                sx={editIconButtonSx}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canDelete && (
                            <Tooltip title={`Delete ${rule.name} - Permanently remove this pricing rule. This action cannot be undone.`}>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteClick(rule.id)}
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
        title="Delete Pricing Rule"
        message="Are you sure you want to delete this pricing rule? This action cannot be undone."
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
        title="Delete Pricing Rules"
        message={`Are you sure you want to delete ${selectedRules.size} pricing rule${selectedRules.size > 1 ? 's' : ''}?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={deleting}
      />
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default PricingRuleList;

