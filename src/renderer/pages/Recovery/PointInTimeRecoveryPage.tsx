import { useState, useEffect, useCallback } from 'react';
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  Checkbox,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import {
  Refresh,
  Add,
  Delete,
  Restore,
  Verified,
  History,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  RecoveryService,
  RecoveryPoint,
  CreateRecoveryPointInput,
} from '../../services/recovery.service';
import MainLayout from '../../components/layout/MainLayout';
import FilterHeader, { FilterField } from '../../components/common/FilterHeader';
import { formatDateTime, convertDateRangeToUTC } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

const PointInTimeRecoveryPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [recoveryPoints, setRecoveryPoints] = useState<RecoveryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // Filters
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isAutomaticFilter, setIsAutomaticFilter] = useState<boolean | ''>('');

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecoveryPoint, setSelectedRecoveryPoint] = useState<RecoveryPoint | null>(null);

  // Create dialog state
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createBackup, setCreateBackup] = useState(true);

  // Restore dialog state
  const [restoreBackupBefore, setRestoreBackupBefore] = useState(true);
  const [restoring, setRestoring] = useState(false);

  const loadRecoveryPoints = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(startDate, endDate);

      const result = await RecoveryService.getRecoveryPoints({
        page: page + 1,
        pageSize,
        startDate: startDateUTC || undefined,
        endDate: endDateUTC || undefined,
        isAutomatic: isAutomaticFilter !== '' ? (isAutomaticFilter as boolean) : undefined,
      });

      if (result.success && result.recoveryPoints) {
        setRecoveryPoints(result.recoveryPoints);
        setTotal(result.total || 0);
      } else {
        showToast(result.error || 'Failed to load recovery points', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, startDate, endDate, isAutomaticFilter, user?.id, showToast]);

  useEffect(() => {
    loadRecoveryPoints();
  }, [loadRecoveryPoints]);

  const handleCreateRecoveryPoint = async () => {
    if (!user?.id) return;

    try {
      const input: CreateRecoveryPointInput = {
        name: createName || undefined,
        description: createDescription || undefined,
        createBackup,
        userId: user.id,
        isAutomatic: false,
      };

      const result = await RecoveryService.createRecoveryPoint(input);

      if (result.success) {
        showToast('Recovery point created successfully', 'success');
        setCreateDialogOpen(false);
        setCreateName('');
        setCreateDescription('');
        setCreateBackup(true);
        loadRecoveryPoints();
      } else {
        showToast(result.error || 'Failed to create recovery point', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  };

  const handleRestore = async () => {
    if (!selectedRecoveryPoint || !user?.id) return;

    setRestoring(true);

    try {
      const result = await RecoveryService.restoreToPointInTime({
        recoveryPointId: selectedRecoveryPoint.id,
        createBackupBeforeRestore: restoreBackupBefore,
        userId: user.id,
      });

      if (result.success) {
        showToast('Database restored successfully. Please restart the application.', 'success');
        setRestoreDialogOpen(false);
        setSelectedRecoveryPoint(null);
        setRestoreBackupBefore(true);
        // Note: User should restart the app after restoration
      } else {
        showToast(result.message || 'Failed to restore database', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecoveryPoint) return;

    try {
      const result = await RecoveryService.deleteRecoveryPoint(selectedRecoveryPoint.id);

      if (result.success) {
        showToast('Recovery point deleted successfully', 'success');
        setDeleteDialogOpen(false);
        setSelectedRecoveryPoint(null);
        loadRecoveryPoints();
      } else {
        showToast(result.error || 'Failed to delete recovery point', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  };

  const handleVerifyIntegrity = async (recoveryPoint: RecoveryPoint) => {
    try {
      const result = await RecoveryService.verifyBackupIntegrity(recoveryPoint.id);
      showToast(result.message, result.valid ? 'success' : 'error');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  };

  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleClearFilters = useCallback(() => {
    setStartDate(null);
    setEndDate(null);
    setIsAutomaticFilter('');
  }, []);

  const filterFields: FilterField[] = [
    {
      label: 'Start Date',
      value: startDate,
      onChange: (value) => setStartDate(value as Date | null),
      type: 'date',
    },
    {
      label: 'End Date',
      value: endDate,
      onChange: (value) => setEndDate(value as Date | null),
      type: 'date',
    },
    {
      label: 'Type',
      value: isAutomaticFilter === '' ? '' : isAutomaticFilter ? 'automatic' : 'manual',
      onChange: (value) => {
        if (value === '') {
          setIsAutomaticFilter('');
        } else {
          setIsAutomaticFilter(value === 'automatic');
        }
      },
      type: 'select',
      options: [
        { value: '', label: 'All' },
        { value: 'automatic', label: 'Automatic' },
        { value: 'manual', label: 'Manual' },
      ],
    },
  ];

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <History />
              <Typography variant="h5">Point-in-Time Recovery</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadRecoveryPoints}
                disabled={loading}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Recovery Point
              </Button>
            </Box>
          </Box>

          <Alert severity="info" sx={{ mb: 2 }}>
            Recovery points allow you to restore your database to a specific point in time. 
            Create recovery points before making major changes or on a regular schedule.
          </Alert>

          <FilterHeader fields={filterFields} onClear={handleClearFilters} />

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Backup</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : recoveryPoints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No recovery points found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  recoveryPoints.map((rp) => (
                    <TableRow key={rp.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={rp.name ? 'medium' : 'normal'}>
                          {rp.name || 'Unnamed Recovery Point'}
                        </Typography>
                        {rp.description && (
                          <Typography variant="caption" color="text.secondary">
                            {rp.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(rp.timestamp)}</TableCell>
                      <TableCell>
                        <Chip
                          label={rp.isAutomatic ? 'Automatic' : 'Manual'}
                          size="small"
                          color={rp.isAutomatic ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        {rp.backupPath ? (
                          <Chip label="Available" size="small" color="success" />
                        ) : (
                          <Chip label="No Backup" size="small" color="default" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {rp.backupPath && (
                            <Tooltip title="Verify Backup Integrity">
                              <IconButton
                                size="small"
                                onClick={() => handleVerifyIntegrity(rp)}
                              >
                                <Verified fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Restore to This Point">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                setSelectedRecoveryPoint(rp);
                                setRestoreDialogOpen(true);
                              }}
                            >
                              <Restore fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setSelectedRecoveryPoint(rp);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
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
            onPageChange={handlePageChange}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handlePageSizeChange}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </Paper>
      </Box>

      {/* Create Recovery Point Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Recovery Point</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Name (Optional)"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Description (Optional)"
            value={createDescription}
            onChange={(e) => setCreateDescription(e.target.value)}
            margin="normal"
            multiline
            rows={3}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={createBackup}
                onChange={(e) => setCreateBackup(e.target.checked)}
              />
            }
            label="Create backup file for this recovery point"
          />
          <Alert severity="info" sx={{ mt: 2 }}>
            Creating a backup file allows for faster restoration. Without a backup file, 
            restoration may be limited.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateRecoveryPoint} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Restore to Point in Time</DialogTitle>
        <DialogContent>
          {selectedRecoveryPoint && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Warning: This will restore your database to the selected point in time.
                </Typography>
                <Typography variant="body2">
                  All changes made after {formatDateTime(selectedRecoveryPoint.timestamp)} will be lost.
                  It is recommended to create a backup of the current state before restoring.
                </Typography>
              </Alert>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Recovery Point: {selectedRecoveryPoint.name || 'Unnamed'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Timestamp: {formatDateTime(selectedRecoveryPoint.timestamp)}
                </Typography>
              </Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={restoreBackupBefore}
                    onChange={(e) => setRestoreBackupBefore(e.target.checked)}
                  />
                }
                label="Create backup of current state before restoring"
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)} disabled={restoring}>
            Cancel
          </Button>
          <Button
            onClick={handleRestore}
            variant="contained"
            color="warning"
            disabled={restoring}
            startIcon={restoring ? <CircularProgress size={16} /> : <Restore />}
          >
            {restoring ? 'Restoring...' : 'Restore'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Recovery Point</DialogTitle>
        <DialogContent>
          {selectedRecoveryPoint && (
            <Typography>
              Are you sure you want to delete the recovery point &quot;{selectedRecoveryPoint.name || 'Unnamed'}&quot;?
              This action cannot be undone.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default PointInTimeRecoveryPage;

