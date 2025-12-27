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
import {
  Add,
  Visibility,
  Edit,
  Delete,
  Refresh,
  FileCopy,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import {
  PurchaseOrderTemplateService,
  PurchaseOrderTemplate,
  PurchaseOrderTemplateListOptions,
} from '../../services/purchase-order-template.service';
import MainLayout from '../../components/layout/MainLayout';
import FilterHeader from '../../components/common/FilterHeader';
import { formatDate } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { usePermission } from '../../hooks/usePermission';
import { ROUTES } from '../../utils/constants';

const PurchaseOrderTemplateList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const canCreate = usePermission('purchase_orders.create');
  const canUpdate = usePermission('purchase_orders.update');
  const canDelete = usePermission('purchase_orders.delete');

  const [templates, setTemplates] = useState<PurchaseOrderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<number | ''>('');
  const [activeFilter, setActiveFilter] = useState<boolean | ''>('');

  const loadTemplates = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const options: PurchaseOrderTemplateListOptions = {
        page: page + 1,
        pageSize,
        search: search || undefined,
        supplierId: supplierFilter || undefined,
        isActive: activeFilter === '' ? undefined : activeFilter,
      };

      const result = await PurchaseOrderTemplateService.getList(options);
      if (result.success && result.templates) {
        setTemplates(result.templates);
        setTotal(result.total || 0);
      } else {
        showToast(result.error || 'Failed to load templates', 'error');
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'An error occurred',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id, page, pageSize, search, supplierFilter, activeFilter, showToast]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleDelete = useCallback(
    async (template: PurchaseOrderTemplate) => {
      if (!user?.id || !canDelete) return;

      if (!window.confirm(`Are you sure you want to delete template "${template.name}"?`)) {
        return;
      }

      try {
        const result = await PurchaseOrderTemplateService.delete(template.id, user.id);
        if (result.success) {
          showToast('Template deleted successfully', 'success');
          loadTemplates();
        } else {
          showToast(result.error || 'Failed to delete template', 'error');
        }
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'An error occurred',
          'error'
        );
      }
    },
    [user?.id, canDelete, showToast, loadTemplates]
  );

  const handleCreateOrder = useCallback(
    async (template: PurchaseOrderTemplate) => {
      if (!user?.id || !canCreate) return;

      try {
        const result = await PurchaseOrderTemplateService.createOrderFromTemplate(
          template.id,
          null,
          user.id
        );

        if (result.success && result.orderInput) {
          // Navigate to purchase order form with pre-filled data
          navigate(ROUTES.PURCHASE_ORDERS_NEW, {
            state: {
              templateData: result.orderInput,
              templateName: template.name,
            },
          });
        } else {
          showToast(result.error || 'Failed to create order from template', 'error');
        }
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'An error occurred',
          'error'
        );
      }
    },
    [user?.id, canCreate, navigate, showToast]
  );

  const filterOptions = useMemo(
    () => [
      {
        type: 'text' as const,
        label: 'Search',
        value: search,
        onChange: (value: string) => setSearch(value),
        placeholder: 'Search templates...',
        gridSize: { xs: 12, sm: 6, md: 4 },
      },
      {
        type: 'select' as const,
        label: 'Status',
        value: activeFilter === '' ? '' : activeFilter ? 'active' : 'inactive',
        onChange: (value: string) =>
          setActiveFilter(value === '' ? '' : value === 'active'),
        options: [
          { value: '', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
        gridSize: { xs: 12, sm: 6, md: 2 },
      },
    ],
    [search, activeFilter]
  );

  const containerBoxSx = useMemo(
    () => ({
      p: 3,
      backgroundColor: '#f5f5f5',
      minHeight: '100vh',
    }),
    []
  );

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            Purchase Order Templates
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh Templates - Reload the list of purchase order templates.">
              <span>
                <IconButton onClick={loadTemplates} disabled={loading}>
                  <Refresh />
                </IconButton>
              </span>
            </Tooltip>
            {canCreate && (
              <Tooltip title="Create Template - Create a new reusable purchase order template.">
                <span>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => navigate(ROUTES.PURCHASE_ORDER_TEMPLATES_NEW)}
                    sx={{
                      backgroundColor: '#1a237e',
                      '&:hover': { backgroundColor: '#534bae' },
                    }}
                  >
                    New Template
                  </Button>
                </span>
              </Tooltip>
            )}
          </Box>
        </Box>

        <FilterHeader filters={filterOptions} />

        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Supplier</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Items</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Created By</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No templates found. Create your first template to get started!
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((template) => (
                    <TableRow key={template.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {template.name}
                        </Typography>
                        {template.description && (
                          <Typography variant="caption" color="text.secondary">
                            {template.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{template.supplier.name}</TableCell>
                      <TableCell>{template.items.length} items</TableCell>
                      <TableCell>
                        <Chip
                          label={template.isActive ? 'Active' : 'Inactive'}
                          color={template.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{template.creator.username}</TableCell>
                      <TableCell>{formatDate(template.createdAt)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="View Template">
                            <IconButton
                              size="small"
                              onClick={() =>
                                navigate(ROUTES.PURCHASE_ORDER_TEMPLATES_VIEW.replace(':id', template.id.toString()))
                              }
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {canCreate && (
                            <Tooltip title="Create Order from Template">
                              <IconButton
                                size="small"
                                onClick={() => handleCreateOrder(template)}
                                color="primary"
                              >
                                <FileCopy fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canUpdate && (
                            <Tooltip title="Edit Template">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  navigate(ROUTES.PURCHASE_ORDER_TEMPLATES_EDIT.replace(':id', template.id.toString()))
                                }
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canDelete && (
                            <Tooltip title="Delete Template">
                              <IconButton
                                size="small"
                                onClick={() => handleDelete(template)}
                                color="error"
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </Paper>

        <Toast toast={toast} onClose={hideToast} />
      </Box>
    </MainLayout>
  );
};

export default PurchaseOrderTemplateList;

