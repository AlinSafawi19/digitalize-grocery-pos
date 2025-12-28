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
  Typography,
  CircularProgress,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  SelectChangeEvent,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Refresh,
  Notifications,
  NotificationsOff,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  AlertRuleService,
  AlertRule,
  AlertRuleType,
  AlertPriority,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
  AlertRuleConditions,
} from '../../services/alert-rule.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { usePermission } from '../../hooks/usePermission';
import { CategoryService } from '../../services/category.service';

const AlertRuleList: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const canManage = usePermission('alerts.manage');

  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<AlertRule | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    categoryId: number | null;
    ruleType: AlertRuleType;
    priority: AlertPriority;
    isActive: boolean;
    threshold?: number;
    daysBeforeExpiry?: number;
  }>({
    name: '',
    description: '',
    categoryId: null,
    ruleType: 'low_stock',
    priority: 'normal',
    isActive: true,
    threshold: 10,
    daysBeforeExpiry: 30,
  });

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const result = await AlertRuleService.getRules({
        page: page + 1,
        pageSize,
      });

      if (result.success && result.data) {
        setRules(result.data);
        setTotal(result.pagination?.total || 0);
      } else {
        showToast(result.error || 'Failed to load alert rules', 'error');
      }
    } catch (error) {
      showToast('An error occurred while loading alert rules', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, showToast]);

  const loadCategories = useCallback(async () => {
    try {
      const result = await CategoryService.getCategories();
      if (result.success && result.data) {
        setCategories(result.data);
      }
    } catch (error) {
      console.error('Error loading categories', error);
    }
  }, []);

  useEffect(() => {
    loadRules();
    loadCategories();
  }, [loadRules, loadCategories]);

  const handleAdd = useCallback(() => {
    setEditingRule(null);
    setFormData({
      name: '',
      description: '',
      categoryId: null,
      ruleType: 'low_stock',
      priority: 'normal',
      isActive: true,
      threshold: 10,
      daysBeforeExpiry: 30,
    });
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((rule: AlertRule) => {
    setEditingRule(rule);
    const conditions = AlertRuleService.parseConditions(rule.conditions);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      categoryId: rule.categoryId,
      ruleType: rule.ruleType as AlertRuleType,
      priority: rule.priority as AlertPriority,
      isActive: rule.isActive,
      threshold: conditions.threshold,
      daysBeforeExpiry: conditions.daysBeforeExpiry,
    });
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback((rule: AlertRule) => {
    setDeletingRule(rule);
    setDeleteDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!user?.id) return;

    try {
      const conditions: AlertRuleConditions = {};
      
      if (formData.ruleType === 'low_stock' || formData.ruleType === 'out_of_stock') {
        if (formData.threshold !== undefined) {
          conditions.threshold = formData.threshold;
        }
      }
      
      if (formData.ruleType === 'expiry_warning') {
        if (formData.daysBeforeExpiry !== undefined) {
          conditions.daysBeforeExpiry = formData.daysBeforeExpiry;
        }
      }

      if (editingRule) {
        const updateData: UpdateAlertRuleInput = {
          name: formData.name,
          description: formData.description || undefined,
          categoryId: formData.categoryId,
          ruleType: formData.ruleType,
          priority: formData.priority,
          isActive: formData.isActive,
          conditions,
        };

        const result = await AlertRuleService.updateRule(editingRule.id, updateData);
        if (result.success) {
          showToast('Alert rule updated successfully', 'success');
          setDialogOpen(false);
          loadRules();
        } else {
          showToast(result.error || 'Failed to update alert rule', 'error');
        }
      } else {
        const createData: CreateAlertRuleInput = {
          name: formData.name,
          description: formData.description || undefined,
          categoryId: formData.categoryId,
          ruleType: formData.ruleType,
          priority: formData.priority,
          isActive: formData.isActive,
          conditions,
          createdBy: user.id,
        };

        const result = await AlertRuleService.createRule(createData);
        if (result.success) {
          showToast('Alert rule created successfully', 'success');
          setDialogOpen(false);
          loadRules();
        } else {
          showToast(result.error || 'Failed to create alert rule', 'error');
        }
      }
    } catch (error) {
      showToast('An error occurred while saving alert rule', 'error');
    }
  }, [user, formData, editingRule, showToast, loadRules]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingRule) return;

    try {
      const result = await AlertRuleService.deleteRule(deletingRule.id);
      if (result.success) {
        showToast('Alert rule deleted successfully', 'success');
        setDeleteDialogOpen(false);
        setDeletingRule(null);
        loadRules();
      } else {
        showToast(result.error || 'Failed to delete alert rule', 'error');
      }
    } catch (error) {
      showToast('An error occurred while deleting alert rule', 'error');
    }
  }, [deletingRule, showToast, loadRules]);

  const handlePageChange = useCallback((_event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const getRuleTypeLabel = useCallback((ruleType: string) => {
    return AlertRuleService.getRuleTypeDisplayName(ruleType as AlertRuleType);
  }, []);

  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  }, []);

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
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  if (!canManage) {
    return (
      <MainLayout>
        <Box sx={containerBoxSx}>
          <Typography>You don't have permission to manage alert rules.</Typography>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography sx={titleTypographySx}>Alert Rules</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadRules}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAdd}
            >
              Add Rule
            </Button>
          </Box>
        </Box>

        <Paper>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography>No alert rules found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <Typography>{rule.name}</Typography>
                            {rule.description && (
                              <Typography variant="caption" color="text.secondary">
                                {rule.description}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{getRuleTypeLabel(rule.ruleType)}</TableCell>
                          <TableCell>
                            {rule.category ? rule.category.name : 'All Categories'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={AlertRuleService.getPriorityDisplayName(rule.priority as AlertPriority)}
                              color={getPriorityColor(rule.priority) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {rule.isActive ? (
                              <Chip icon={<Notifications />} label="Active" color="success" size="small" />
                            ) : (
                              <Chip icon={<NotificationsOff />} label="Inactive" color="default" size="small" />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton onClick={() => handleEdit(rule)} size="small">
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton onClick={() => handleDelete(rule)} size="small" color="error">
                                <Delete />
                              </IconButton>
                            </Tooltip>
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
                onPageChange={handlePageChange}
                rowsPerPage={pageSize}
                onRowsPerPageChange={handlePageSizeChange}
                rowsPerPageOptions={[10, 25, 50]}
              />
            </>
          )}
        </Paper>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingRule ? 'Edit Alert Rule' : 'Add Alert Rule'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              <TextField
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.categoryId || ''}
                  onChange={(e: SelectChangeEvent<number>) =>
                    setFormData({ ...formData, categoryId: e.target.value as number | null })
                  }
                  label="Category"
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Rule Type</InputLabel>
                <Select
                  value={formData.ruleType}
                  onChange={(e: SelectChangeEvent<AlertRuleType>) =>
                    setFormData({ ...formData, ruleType: e.target.value as AlertRuleType })
                  }
                  label="Rule Type"
                >
                  <MenuItem value="low_stock">Low Stock</MenuItem>
                  <MenuItem value="out_of_stock">Out of Stock</MenuItem>
                  <MenuItem value="expiry_warning">Expiry Warning</MenuItem>
                  <MenuItem value="price_change">Price Change</MenuItem>
                </Select>
              </FormControl>
              {(formData.ruleType === 'low_stock' || formData.ruleType === 'out_of_stock') && (
                <TextField
                  label="Threshold (Quantity)"
                  type="number"
                  value={formData.threshold || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, threshold: parseInt(e.target.value, 10) || undefined })
                  }
                  fullWidth
                />
              )}
              {formData.ruleType === 'expiry_warning' && (
                <TextField
                  label="Days Before Expiry"
                  type="number"
                  value={formData.daysBeforeExpiry || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, daysBeforeExpiry: parseInt(e.target.value, 10) || undefined })
                  }
                  fullWidth
                />
              )}
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e: SelectChangeEvent<AlertPriority>) =>
                    setFormData({ ...formData, priority: e.target.value as AlertPriority })
                  }
                  label="Priority"
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} variant="contained" disabled={!formData.name}>
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          title="Delete Alert Rule"
          message={`Are you sure you want to delete "${deletingRule?.name}"? This action cannot be undone.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setDeleteDialogOpen(false);
            setDeletingRule(null);
          }}
        />

        <Toast toast={toast} onClose={hideToast} />
      </Box>
    </MainLayout>
  );
};

export default AlertRuleList;

