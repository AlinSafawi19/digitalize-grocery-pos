import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  SelectChangeEvent,
  Typography,
  CircularProgress,
  Grid,
  IconButton,
  Tooltip,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
import { usePermissionWithLoading } from '../../hooks/usePermission';
import { CategoryService } from '../../services/category.service';
import { ROUTES } from '../../utils/constants';

const AlertRuleForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const { hasPermission: canManage, isLoading: isCheckingPermission } = usePermissionWithLoading('alerts.manage');

  const [loading, setLoading] = useState(false);
  const [loadingRule, setLoadingRule] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [rule, setRule] = useState<AlertRule | null>(null);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);

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

  const loadRule = useCallback(async () => {
    if (!id || !user?.id) return;

    setLoadingRule(true);
    try {
      const result = await AlertRuleService.getRuleById(parseInt(id, 10));
      if (result.success && result.data) {
        const ruleData = result.data;
        setRule(ruleData);
        setIsEditMode(true);
        const conditions = AlertRuleService.parseConditions(ruleData.conditions);
        setFormData({
          name: ruleData.name,
          description: ruleData.description || '',
          categoryId: ruleData.categoryId,
          ruleType: ruleData.ruleType as AlertRuleType,
          priority: ruleData.priority as AlertPriority,
          isActive: ruleData.isActive,
          threshold: conditions.threshold,
          daysBeforeExpiry: conditions.daysBeforeExpiry,
        });
      } else {
        showToast(result.error || 'Failed to load alert rule', 'error');
        navigate(ROUTES.ALERT_RULES);
      }
    } catch {
      showToast('An error occurred while loading alert rule', 'error');
      navigate(ROUTES.ALERT_RULES);
    } finally {
      setLoadingRule(false);
    }
  }, [id, user?.id, showToast, navigate]);

  const loadCategories = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await CategoryService.getAllCategories(user.id);
      if (result.success && result.categories) {
        setCategories(result.categories.map(cat => ({ id: cat.id, name: cat.name })));
      }
    } catch (error) {
      console.error('Error loading categories', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (id) {
      loadRule();
    }
    loadCategories();
  }, [id, loadRule, loadCategories]);

  const handleCancel = useCallback(() => {
    const returnPath = (location.state as { returnPath?: string })?.returnPath;
    navigate(returnPath || ROUTES.ALERT_RULES);
  }, [navigate, location.state]);

  const handleNavigateBack = useCallback(() => {
    const returnPath = (location.state as { returnPath?: string })?.returnPath;
    navigate(returnPath || ROUTES.ALERT_RULES);
  }, [navigate, location.state]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !canManage) return;

    if (!formData.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    setLoading(true);

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

      const returnPath = (location.state as { returnPath?: string })?.returnPath || ROUTES.ALERT_RULES;

      if (isEditMode && rule) {
        const updateData: UpdateAlertRuleInput = {
          name: formData.name,
          description: formData.description || undefined,
          categoryId: formData.categoryId,
          ruleType: formData.ruleType,
          priority: formData.priority,
          isActive: formData.isActive,
          conditions,
        };

        const result = await AlertRuleService.updateRule(rule.id, updateData);
        if (result.success) {
          showToast('Alert rule updated successfully', 'success');
          navigate(returnPath);
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
          navigate(returnPath);
        } else {
          showToast(result.error || 'Failed to create alert rule', 'error');
        }
      }
    } catch {
      showToast('An error occurred while saving alert rule', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, formData, isEditMode, rule, canManage, showToast, navigate, location.state]);

  if (isCheckingPermission) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (!canManage) {
    return (
      <MainLayout>
        <Box sx={{ p: 3 }}>
          <Typography>You don&apos;t have permission to manage alert rules.</Typography>
        </Box>
      </MainLayout>
    );
  }

  if (loadingRule) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Tooltip title="Go back">
            <IconButton onClick={handleNavigateBack} sx={{ mr: 2 }}>
              <ArrowBack />
            </IconButton>
          </Tooltip>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {isEditMode ? 'Edit Alert Rule' : 'Add Alert Rule'}
          </Typography>
        </Box>

        <Paper sx={{ p: 3 }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  fullWidth
                  required
                  autoFocus
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  fullWidth
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
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
              </Grid>

              <Grid item xs={12} sm={6}>
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
              </Grid>

              {(formData.ruleType === 'low_stock' || formData.ruleType === 'out_of_stock') && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Threshold (Quantity)"
                    type="number"
                    value={formData.threshold || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, threshold: parseInt(e.target.value, 10) || undefined })
                    }
                    fullWidth
                    inputProps={{ min: 0 }}
                  />
                </Grid>
              )}

              {formData.ruleType === 'expiry_warning' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Days Before Expiry"
                    type="number"
                    value={formData.daysBeforeExpiry || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, daysBeforeExpiry: parseInt(e.target.value, 10) || undefined })
                    }
                    fullWidth
                    inputProps={{ min: 1 }}
                  />
                </Grid>
              )}

              <Grid item xs={12} sm={6}>
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
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button onClick={handleCancel} disabled={loading}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="contained" disabled={loading || !formData.name.trim()}>
                    {loading ? <CircularProgress size={24} /> : 'Save'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Paper>

        <Toast toast={toast} onClose={hideToast} />
      </Box>
    </MainLayout>
  );
};

export default AlertRuleForm;

