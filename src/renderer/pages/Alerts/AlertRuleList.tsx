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
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Refresh,
  Notifications,
  NotificationsOff,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  AlertRuleService,
  AlertRule,
  AlertRuleType,
  AlertPriority,
} from '../../services/alert-rule.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { ROUTES } from '../../utils/constants';
import { usePermission } from '../../hooks/usePermission';

const AlertRuleList: React.FC = () => {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();

  // Permission checks
  const canManage = usePermission('alerts.manage');

  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<AlertRule | null>(null);

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
    } catch {
      showToast('An error occurred while loading alert rules', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, showToast]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleAdd = useCallback(() => {
    navigate(ROUTES.ALERT_RULES_NEW, { state: { returnPath: ROUTES.ALERT_RULES } });
  }, [navigate]);

  const handleEdit = useCallback((rule: AlertRule) => {
    navigate(ROUTES.ALERT_RULES_EDIT.replace(':id', rule.id.toString()), { 
      state: { returnPath: ROUTES.ALERT_RULES } 
    });
  }, [navigate]);

  const handleDelete = useCallback((rule: AlertRule) => {
    setDeletingRule(rule);
    setDeleteDialogOpen(true);
  }, []);

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
    } catch {
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
            {canManage && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAdd}
              >
                Add Rule
              </Button>
            )}
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
                      {canManage && <TableCell align="right">Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canManage ? 6 : 5} align="center">
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
                              color={getPriorityColor(rule.priority) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
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
                            {canManage && (
                              <>
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
                              </>
                            )}
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

