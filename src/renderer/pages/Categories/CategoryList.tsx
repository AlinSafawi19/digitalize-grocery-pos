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
import { Add, Edit, Delete, ViewList, AccountTree, Refresh, Visibility } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { CategoryService, CategoryListOptions, CategoryWithChildren } from '../../services/category.service';
import MainLayout from '../../components/layout/MainLayout';
import CategoryTreeView from '../../components/categories/CategoryTreeView';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { ROUTES } from '../../utils/constants';
import { useNavigate } from 'react-router-dom';
import FilterHeader from '../../components/common/FilterHeader';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { usePermission } from '../../hooks/usePermission';

interface CategoryRowProps {
  category: CategoryWithChildren;
  onEdit: (category: CategoryWithChildren) => void;
  onDelete: (category: CategoryWithChildren) => void;
  onView: (category: CategoryWithChildren) => void;
  selected: boolean;
  onSelect: (categoryId: number) => void;
  canUpdate: boolean;
  canDelete: boolean;
}

/* eslint-disable react/prop-types */
const CategoryRow = memo<CategoryRowProps>(({ category, onEdit, onDelete, onView, selected, onSelect, canUpdate, canDelete }) => {
  const handleEdit = useCallback(() => {
    onEdit(category);
  }, [category, onEdit]);

  const handleDelete = useCallback(() => {
    onDelete(category);
  }, [category, onDelete]);

  const handleView = useCallback(() => {
    onView(category);
  }, [category, onView]);

  // Memoize sx prop objects
  const bodyTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const secondaryTypographySx = useMemo(() => ({
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
            onChange={() => onSelect(category.id)}
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
        <Typography variant="body2" fontWeight="medium" sx={bodyTypographySx}>
          {category.name}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={secondaryTypographySx}>
          {category.description || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        {category.parent ? (
          <Typography variant="body2" sx={bodyTypographySx}>
            {category.parent.name}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={secondaryTypographySx}>
            -
          </Typography>
        )}
      </TableCell>
      <TableCell align="center">
        <Tooltip title={`View ${category.name} - View detailed information about this category including description and product count.`}>
          <IconButton
            onClick={handleView}
            sx={viewIconButtonSx}
          >
            <Visibility />
          </IconButton>
        </Tooltip>
        {canUpdate && (
          <Tooltip title={`Edit ${category.name} - Modify category details such as name and description.`}>
            <IconButton
              onClick={handleEdit}
              sx={editIconButtonSx}
            >
              <Edit />
            </IconButton>
          </Tooltip>
        )}
        {canDelete && (
          <Tooltip title={`Delete ${category.name} - Permanently remove this category. Products in this category will need to be reassigned. This action cannot be undone.`}>
            <IconButton
              onClick={handleDelete}
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

CategoryRow.displayName = 'CategoryRow';

const CategoryList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  // Permission checks
  const canCreate = usePermission('categories.create');
  const canUpdate = usePermission('categories.update');
  const canDelete = usePermission('categories.delete');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithChildren | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadCategories = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const options: CategoryListOptions = {
        page: page + 1,
        pageSize,
        search: debouncedSearch || undefined,
      };

      const result = await CategoryService.getCategoriesList(options, user.id);
      if (result.success && result.categories) {
        setCategories(result.categories);
        setTotal(result.pagination?.totalItems || 0);
      } else {
        showToast(result.error || 'Failed to load categories', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, user?.id, showToast]);

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

  useEffect(() => {
    loadCategories();
    // Clear selection when filters or page change
    setSelectedCategories(new Set());
  }, [loadCategories]);

  const handleDeleteClick = useCallback((category: CategoryWithChildren) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!selectedCategory || !user?.id) return;

    setDeleting(true);
    try {
      const result = await CategoryService.deleteCategory(selectedCategory.id, user.id);
      if (result.success) {
        showToast('Category deleted successfully', 'success');
        setDeleteDialogOpen(false);
        setSelectedCategory(null);
        loadCategories();
      } else {
        showToast(result.error || 'Failed to delete category', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setDeleting(false);
    }
  }, [selectedCategory, user?.id, loadCategories, showToast]);

  const handleDeleteDialogClose = useCallback(() => {
    setDeleteDialogOpen(false);
    setSelectedCategory(null);
  }, []);

  const handleSelectCategory = useCallback((categoryId: number) => {
    setSelectedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedCategories((prev) => {
      if (prev.size === categories.length) {
        return new Set();
      } else {
        return new Set(categories.map((c) => c.id));
      }
    });
  }, [categories]);

  const handleBulkDelete = useCallback(() => {
    if (selectedCategories.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedCategories.size]);

  const confirmBulkDelete = useCallback(async () => {
    if (!user?.id || selectedCategories.size === 0) return;

    const selectedIds = Array.from(selectedCategories);
    let successCount = 0;

    setDeleting(true);
    try {
      // Delete categories one by one
      for (const id of selectedIds) {
        const result = await CategoryService.deleteCategory(id, user.id);
        if (result.success) {
          successCount++;
        }
      }

      // Update UI
      setCategories((prev) => prev.filter((c) => !selectedCategories.has(c.id)));
      setTotal((prev) => prev - successCount);
      setSelectedCategories(new Set());
      showToast(`Successfully deleted ${successCount} categor${successCount !== 1 ? 'ies' : 'y'}`, 'success');
    } catch (error) {
      console.error('Error deleting categories:', error);
      showToast('Failed to delete categories', 'error');
    } finally {
      setDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  }, [user?.id, selectedCategories, showToast]);

  const handleBulkDeleteDialogClose = useCallback(() => {
    if (!deleting) {
      setBulkDeleteDialogOpen(false);
    }
  }, [deleting]);

  const handleEdit = useCallback((category: CategoryWithChildren) => {
    navigate(`${ROUTES.CATEGORIES}/edit/${category.id}`);
  }, [navigate]);

  const handleView = useCallback((category: CategoryWithChildren) => {
    navigate(`${ROUTES.CATEGORIES}/view/${category.id}`);
  }, [navigate]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0); // Reset to first page when searching
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setPage(0);
  }, []);

  const handleCategorySelect = useCallback((category: { id: number; name: string; description: string | null; parentId: number | null; children?: unknown[] }) => {
    navigate(`${ROUTES.CATEGORIES}/edit/${category.id}`);
  }, [navigate]);

  const handleViewModeChange = useCallback((_: unknown, newMode: 'table' | 'tree' | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
      setPage(0);
    }
  }, []);

  const handleAddCategory = useCallback(() => {
    navigate(ROUTES.CATEGORIES_NEW);
  }, [navigate]);

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

  const toggleButtonGroupSx = useMemo(() => ({
    '& .MuiToggleButton-root': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textTransform: 'none',
      borderColor: '#c0c0c0',
      color: '#1a237e',
      padding: '8px 20px',
      minHeight: '44px',
      '&.Mui-selected': {
        backgroundColor: '#1a237e',
        color: '#ffffff',
        '&:hover': {
          backgroundColor: '#534bae',
        },
      },
      '&:hover': {
        backgroundColor: '#f5f5f5',
      },
    },
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

  const treePaperSx = useMemo(() => ({
    p: 2,
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

  const paginationSx = useMemo(() => ({
    borderTop: '1px solid',
    borderColor: '#e0e0e0',
    '& .MuiTablePagination-toolbar': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const tableContainerSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
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

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography variant="h4" component="h1" sx={titleTypographySx}>
            Categories
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              sx={toggleButtonGroupSx}
            >
              <ToggleButton value="table">
                <ViewList sx={{ mr: 1 }} />
                Table
              </ToggleButton>
              <ToggleButton value="tree">
                <AccountTree sx={{ mr: 1 }} />
                Tree
              </ToggleButton>
            </ToggleButtonGroup>
                {selectedCategories.size > 0 && viewMode === 'table' && canDelete && (
                  <Tooltip title={`Delete Selected Categories - Permanently delete ${selectedCategories.size} selected category/categories. Products in these categories will need to be reassigned. This action cannot be undone.`}>
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
                      Delete Selected ({selectedCategories.size})
                    </Button>
                  </Tooltip>
                )}
            <Tooltip title="Refresh Categories - Reload the category list to get the latest data from the database.">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadCategories}
                  disabled={loading}
                  sx={refreshButtonSx}
                >
                  Refresh
                </Button>
              </span>
            </Tooltip>
            {canCreate && (
              <Tooltip title="Add Category - Create a new product category to organize your products.">
                <span>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={handleAddCategory}
                    sx={addButtonSx}
                  >
                    Add Category
                  </Button>
                </span>
              </Tooltip>
            )}
          </Box>
        </Box>

        <FilterHeader
          searchPlaceholder="Search categories..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          onClear={handleClearFilters}
          fields={[]}
        />

        {viewMode === 'tree' ? (
          <Box>
            <Paper sx={treePaperSx}>
              {loading ? (
                <Box sx={loadingBoxSx}>
                  <CircularProgress />
                </Box>
              ) : (
                <CategoryTreeView
                  categories={categories}
                  onCategorySelect={handleCategorySelect}
                />
              )}
            </Paper>
            {!loading && (
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
            )}
          </Box>
        ) : (
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
                            indeterminate={selectedCategories.size > 0 && selectedCategories.size < categories.length}
                            checked={categories.length > 0 && selectedCategories.size === categories.length}
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
                      <TableCell>Parent Category</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canDelete ? 5 : 4} align="center">
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={emptyStateTypographySx}
                          >
                            No categories found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      categories.map((category) => (
                        <CategoryRow
                          key={category.id}
                          category={category}
                          onEdit={handleEdit}
                          onDelete={handleDeleteClick}
                          onView={handleView}
                          selected={selectedCategories.has(category.id)}
                          onSelect={handleSelectCategory}
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
                  onRowsPerPageChange={handlePageSizeChange}
                  rowsPerPageOptions={[10, 20, 50, 100]}
                  sx={paginationSx}
                />
              </>
            )}
          </TableContainer>
        )}
      </Box>
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Category"
        message={`Are you sure you want to delete "${selectedCategory?.name}"?`}
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
        title="Delete Categories"
        message={`Are you sure you want to delete ${selectedCategories.size} categor${selectedCategories.size > 1 ? 'ies' : 'y'}?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={deleting}
      />
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default CategoryList;

