import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  TextField,
  Divider,
} from '@mui/material';
import {
  Build,
  Storage,
  Refresh,
  History,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { SystemMaintenanceService, MaintenanceOperation, DatabaseStats, SystemMaintenance, MaintenanceResult } from '../../services/system-maintenance.service';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import MainLayout from '../../components/layout/MainLayout';
import { formatDate } from '../../utils/formatters';

const SystemMaintenancePage: React.FC = () => {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { toast, showToast, hideToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [operations, setOperations] = useState<MaintenanceOperation[]>([]);
  const [history, setHistory] = useState<SystemMaintenance[]>([]);
  const [runningOperation, setRunningOperation] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<MaintenanceOperation | null>(null);
  const [daysToKeep, setDaysToKeep] = useState(90);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResult, operationsResult, historyResult] = await Promise.all([
        SystemMaintenanceService.getDatabaseStats(),
        SystemMaintenanceService.getAvailableOperations(),
        SystemMaintenanceService.getHistory({ pageSize: 10 }),
      ]);

      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats);
      }

      if (operationsResult.success && operationsResult.operations) {
        setOperations(operationsResult.operations);
      }

      if (historyResult.success) {
        setHistory(historyResult.operations || []);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunOperation = (operation: MaintenanceOperation) => {
    setSelectedOperation(operation);
    setConfirmDialogOpen(true);
  };

  const handleConfirmOperation = async () => {
    if (!selectedOperation || !userId) return;

    setConfirmDialogOpen(false);
    setRunningOperation(selectedOperation.type);

    try {
      let result: MaintenanceResult;

      switch (selectedOperation.type) {
        case 'database_optimization':
          result = await SystemMaintenanceService.optimizeDatabase(userId);
          break;
        case 'vacuum':
          result = await SystemMaintenanceService.vacuumDatabase(userId);
          break;
        case 'analyze':
          result = await SystemMaintenanceService.analyzeDatabase(userId);
          break;
        case 'cleanup_old_audit_logs':
          result = await SystemMaintenanceService.cleanupOldAuditLogs(userId, daysToKeep);
          break;
        case 'cleanup_old_sessions':
          result = await SystemMaintenanceService.cleanupExpiredSessions(userId);
          break;
        default:
          showToast('Unknown operation type', 'error');
          setRunningOperation(null);
          return;
      }

      if (result.success) {
        showToast(result.message, 'success');
        await loadData(); // Refresh stats and history
      } else {
        showToast(result.error || result.message || 'Operation failed', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setRunningOperation(null);
    }
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatDuration = (ms: number | null | undefined): string => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const refreshButtonSx = {
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
  };

  const tableSx = {
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
  };

  if (loading && !stats) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography 
            variant="h4" 
            component="h1"
            fontWeight="bold"
            sx={{
              fontSize: { xs: '20px', sm: '24px', md: '28px' },
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            System Maintenance
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadData}
            disabled={loading}
            sx={refreshButtonSx}
          >
            Refresh
          </Button>
        </Box>

        {/* Database Statistics */}
        {stats && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Storage color="primary" />
                    <Typography variant="h6">Database Size</Typography>
                  </Box>
                  <Typography variant="h4">{stats.sizeFormatted}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Build color="primary" />
                    <Typography variant="h6">Tables</Typography>
                  </Box>
                  <Typography variant="h4">{stats.tableCount}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <History color="primary" />
                    <Typography variant="h6">Total Records</Typography>
                  </Box>
                  <Typography variant="h4">{stats.totalRecords.toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Schedule color="primary" />
                    <Typography variant="h6">Last Vacuum</Typography>
                  </Box>
                  <Typography variant="body1">
                    {stats.lastVacuum ? formatDate(stats.lastVacuum) : 'Never'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Maintenance Operations */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Available Operations
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            {operations.map((operation) => (
              <Grid item xs={12} md={6} key={operation.type}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                      <Box>
                        <Typography variant="h6">{operation.name}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {operation.description}
                        </Typography>
                        {operation.estimatedDuration && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            Estimated: {operation.estimatedDuration}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Button
                      variant="contained"
                      fullWidth
                      sx={{ mt: 2 }}
                      onClick={() => handleRunOperation(operation)}
                      disabled={runningOperation !== null}
                      startIcon={runningOperation === operation.type ? <CircularProgress size={16} /> : <Build />}
                    >
                      {runningOperation === operation.type ? 'Running...' : 'Run Operation'}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* Maintenance History */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Maintenance History
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {history.length === 0 ? (
            <Alert severity="info">No maintenance operations recorded yet.</Alert>
          ) : (
            <TableContainer>
              <Table sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Operation</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Performed By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {operations.find((o) => o.type === op.operationType)?.name || op.operationType}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={op.status}
                          size="small"
                          color={getStatusColor(op.status)}
                          icon={op.status === 'completed' ? <CheckCircle /> : op.status === 'failed' ? <ErrorIcon /> : undefined}
                        />
                      </TableCell>
                      <TableCell>{formatDate(op.startedAt)}</TableCell>
                      <TableCell>{formatDuration(op.duration)}</TableCell>
                      <TableCell>{op.performer?.username || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {runningOperation && (
          <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1300 }}>
            <LinearProgress />
            <Box sx={{ p: 2, bgcolor: 'background.paper', boxShadow: 3 }}>
              <Typography variant="body2">
                Running {operations.find((o) => o.type === runningOperation)?.name || runningOperation}...
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Confirm Operation</DialogTitle>
        <DialogContent>
          {selectedOperation && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Are you sure you want to run <strong>{selectedOperation.name}</strong>?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {selectedOperation.description}
              </Typography>
              {selectedOperation.type === 'cleanup_old_audit_logs' && (
                <TextField
                  label="Days to Keep"
                  type="number"
                  value={daysToKeep}
                  onChange={(e) => setDaysToKeep(parseInt(e.target.value) || 90)}
                  fullWidth
                  sx={{ mt: 2 }}
                  inputProps={{ min: 1, max: 365 }}
                />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmOperation} variant="contained" color="primary">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default SystemMaintenancePage;

