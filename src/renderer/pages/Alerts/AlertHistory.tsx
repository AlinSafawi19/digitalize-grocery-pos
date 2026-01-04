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
  Typography,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material';
import {
  Refresh,
  CheckCircle,
  FilterList,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  AlertRuleService,
  AlertHistoryItem,
} from '../../services/alert-rule.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { formatDate } from '../../utils/formatters';
import { usePermission } from '../../hooks/usePermission';

const AlertHistory: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const canViewAlerts = usePermission('alerts.view');
  const canManageAlerts = usePermission('alerts.manage');
  const canView = canViewAlerts || canManageAlerts;

  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertHistoryItem[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [filterResolved, setFilterResolved] = useState<string>('all'); // 'all', 'resolved', 'unresolved'

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const options: {
        isResolved?: boolean;
        page?: number;
        pageSize?: number;
      } = {
        page: page + 1,
        pageSize,
      };

      if (filterResolved === 'resolved') {
        options.isResolved = true;
      } else if (filterResolved === 'unresolved') {
        options.isResolved = false;
      }

      const result = await AlertRuleService.getAlertHistory(options);

      if (result.success && result.data) {
        setAlerts(result.data);
        setTotal(result.pagination?.total || 0);
      } else {
        showToast(result.error || 'Failed to load alert history', 'error');
      }
    } catch {
      showToast('An error occurred while loading alert history', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterResolved, showToast]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleResolve = useCallback(async (alertId: number) => {
    if (!user?.id) return;

    try {
      const result = await AlertRuleService.resolveAlert(alertId, user.id);
      if (result.success) {
        showToast('Alert resolved successfully', 'success');
        loadAlerts();
      } else {
        showToast(result.error || 'Failed to resolve alert', 'error');
      }
    } catch {
      showToast('An error occurred while resolving alert', 'error');
    }
  }, [user, showToast, loadAlerts]);

  const handlePageChange = useCallback((_event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleFilterChange = useCallback((event: SelectChangeEvent<string>) => {
    setFilterResolved(event.target.value);
    setPage(0);
  }, []);

  const getSeverityColor = useCallback((severity: string) => {
    switch (severity) {
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

  if (!canView) {
    return (
      <MainLayout>
        <Box sx={containerBoxSx}>
          <Typography>You don&apos;t have permission to view alert history.</Typography>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography sx={titleTypographySx}>Alert History</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterResolved}
                onChange={handleFilterChange}
                label="Status"
                startAdornment={<FilterList sx={{ mr: 1 }} />}
              >
                <MenuItem value="all">All Alerts</MenuItem>
                <MenuItem value="unresolved">Unresolved</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadAlerts}
              disabled={loading}
            >
              Refresh
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
                      <TableCell>Date</TableCell>
                      <TableCell>Alert Rule</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Message</TableCell>
                      <TableCell>Severity</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {alerts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Typography>No alerts found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      alerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell>{formatDate(alert.createdAt)}</TableCell>
                          <TableCell>
                            {alert.alertRule?.name || 'Unknown Rule'}
                          </TableCell>
                          <TableCell>
                            {alert.product?.name || '-'}
                          </TableCell>
                          <TableCell>
                            {alert.category?.name || '-'}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{alert.message}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={AlertRuleService.getPriorityDisplayName(alert.severity)}
                              color={getSeverityColor(alert.severity) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {alert.isResolved ? (
                              <Chip
                                icon={<CheckCircle />}
                                label="Resolved"
                                color="success"
                                size="small"
                              />
                            ) : (
                              <Chip label="Active" color="warning" size="small" />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {!alert.isResolved && (
                              <Tooltip title="Mark as Resolved">
                                <IconButton
                                  onClick={() => handleResolve(alert.id)}
                                  size="small"
                                  color="success"
                                >
                                  <CheckCircle />
                                </IconButton>
                              </Tooltip>
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
                rowsPerPageOptions={[10, 20, 50]}
              />
            </>
          )}
        </Paper>

        <Toast toast={toast} onClose={hideToast} />
      </Box>
    </MainLayout>
  );
};

export default AlertHistory;

