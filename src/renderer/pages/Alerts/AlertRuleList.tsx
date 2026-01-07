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
    minHeight: '100vh',
  }), []);

  const headerBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 3,
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
  }), []);

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography variant="h4" fontWeight="bold" sx={titleTypographySx}>Alert Rules</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadRules}
              disabled={loading}
              sx={refreshButtonSx}
            >
              Refresh
            </Button>
            {canManage && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAdd}
                sx={addButtonSx}
              >
                Add Rule
              </Button>
            )}
          </Box>
        </Box>

        <TableContainer component={Paper} sx={tableContainerSx}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Table sx={tableSx}>
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
        </TableContainer>

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

