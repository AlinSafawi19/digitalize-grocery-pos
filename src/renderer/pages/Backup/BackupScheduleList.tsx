import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Schedule,
  CheckCircle,
  Error,
  Warning,
  ToggleOn,
  ToggleOff,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  BackupSchedulerService,
  BackupSchedule,
} from '../../services/backup-scheduler.service';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import BackupScheduleForm from './BackupScheduleForm';
import { formatDateTime } from '../../utils/dateUtils';

const STATUS_COLORS: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  success: 'success',
  failed: 'error',
  skipped: 'warning',
};

const getStatusIcon = (status: string): React.ReactElement | null => {
  switch (status) {
    case 'success':
      return <CheckCircle fontSize="small" />;
    case 'failed':
      return <Error fontSize="small" />;
    case 'skipped':
      return <Warning fontSize="small" />;
    default:
      return null;
  }
};

export default function BackupScheduleList() {
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BackupSchedule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<BackupSchedule | null>(null);
  const [triggeringScheduleId, setTriggeringScheduleId] = useState<number | null>(null);

  const loadSchedules = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const result = await BackupSchedulerService.getSchedules(user.id);
      if (result.success && result.schedules) {
        setSchedules(result.schedules);
      } else {
        showToast(result.error || 'Failed to load backup schedules', 'error');
      }
    } catch (error) {
      showToast('Error loading backup schedules', 'error');
      console.error('Error loading schedules:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, showToast]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleCreateSchedule = useCallback(() => {
    setEditingSchedule(null);
    setFormOpen(true);
  }, []);

  const handleEditSchedule = useCallback((schedule: BackupSchedule) => {
    setEditingSchedule(schedule);
    setFormOpen(true);
  }, []);

  const handleDeleteSchedule = useCallback((schedule: BackupSchedule) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!scheduleToDelete) return;

    try {
      const result = await BackupSchedulerService.deleteSchedule(scheduleToDelete.id);
      if (result.success) {
        showToast('Backup schedule deleted successfully', 'success');
        await loadSchedules();
      } else {
        showToast(result.error || 'Failed to delete backup schedule', 'error');
      }
    } catch (error) {
      showToast('Error deleting backup schedule', 'error');
      console.error('Error deleting schedule:', error);
    } finally {
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
    }
  }, [scheduleToDelete, loadSchedules, showToast]);

  const handleToggleSchedule = useCallback(async (schedule: BackupSchedule) => {
    try {
      const result = await BackupSchedulerService.toggleSchedule(schedule.id);
      if (result.success) {
        showToast(
          `Backup schedule ${schedule.isActive ? 'disabled' : 'enabled'} successfully`,
          'success'
        );
        await loadSchedules();
      } else {
        showToast(result.error || 'Failed to toggle backup schedule', 'error');
      }
    } catch (error) {
      showToast('Error toggling backup schedule', 'error');
      console.error('Error toggling schedule:', error);
    }
  }, [loadSchedules, showToast]);

  const handleTriggerBackup = useCallback(async (schedule: BackupSchedule) => {
    setTriggeringScheduleId(schedule.id);
    try {
      const result = await BackupSchedulerService.triggerBackup(schedule.id);
      if (result.success) {
        showToast('Backup triggered successfully. Check notifications for status.', 'success');
        await loadSchedules();
      } else {
        showToast(result.error || 'Failed to trigger backup', 'error');
      }
    } catch (error) {
      showToast('Error triggering backup', 'error');
      console.error('Error triggering backup:', error);
    } finally {
      setTriggeringScheduleId(null);
    }
  }, [loadSchedules, showToast]);

  const handleFormClose = useCallback(() => {
    setFormOpen(false);
    setEditingSchedule(null);
  }, []);

  const handleFormSuccess = useCallback(async () => {
    handleFormClose();
    await loadSchedules();
  }, [handleFormClose, loadSchedules]);

  const formatNextRun = useCallback((nextRunAt: Date | string | null) => {
    if (!nextRunAt) return 'Not scheduled';
    // Convert UTC date from server to Beirut timezone for display
    return formatDateTime(nextRunAt, 'MMM DD, YYYY HH:mm') + ' (Beirut)';
  }, []);

  const formatLastRun = useCallback((lastRunAt: Date | string | null) => {
    if (!lastRunAt) return 'Never';
    // Convert UTC date from server to Beirut timezone for display
    return formatDateTime(lastRunAt, 'MMM DD, YYYY HH:mm') + ' (Beirut)';
  }, []);

  const formatScheduleDetails = useCallback((schedule: BackupSchedule) => {
    try {
      const config = typeof schedule.scheduleConfig === 'string'
        ? JSON.parse(schedule.scheduleConfig)
        : schedule.scheduleConfig;

      switch (schedule.scheduleType) {
        case 'daily':
          return `Daily at ${config.time || '02:00'}`;
        case 'weekly': {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const dayOfWeek = config.dayOfWeek !== undefined ? config.dayOfWeek : 1;
          return `Weekly on ${days[dayOfWeek]} at ${config.time || '02:00'}`;
        }
        case 'monthly': {
          const dayOfMonth = config.dayOfMonth !== undefined ? config.dayOfMonth : 1;
          return `Monthly on day ${dayOfMonth} at ${config.time || '02:00'}`;
        }
        case 'custom':
          return `Custom: ${config.cronExpression || 'N/A'}`;
        default:
          return 'Unknown';
      }
    } catch {
      return 'Invalid schedule';
    }
  }, []);

  const tableContainerSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
  }), []);

  const headerBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 2,
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '18px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const addButtonSx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#1a237e',
    '&:hover': {
      backgroundColor: '#283593',
    },
  }), []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={headerBoxSx}>
        <Typography sx={titleTypographySx}>Scheduled Backups</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreateSchedule}
          sx={addButtonSx}
        >
          Create Schedule
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2, borderRadius: 0 }}>
        <Typography variant="body2" fontWeight={600} mb={0.5}>
          About Scheduled Backups:
        </Typography>
        <Typography variant="body2" component="div">
          • Backups run automatically at the scheduled time
          <br />
          • An external drive must be connected when the backup runs
          <br />
          • If no external drive is available, the backup will be skipped and you&apos;ll receive a notification
          <br />
          • You can manually trigger a backup at any time using the &quot;Trigger Now&quot; button
          <br />
          • Disabled schedules will not run until re-enabled
        </Typography>
      </Alert>

      {schedules.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 0 }}>
          <Typography variant="body2" fontWeight={600} mb={0.5}>
            No backup schedules configured
          </Typography>
          <Typography variant="body2">
            Create a schedule to enable automated backups. Scheduled backups ensure your data is backed up regularly without manual intervention.
          </Typography>
        </Alert>
      ) : (
        <TableContainer component={Paper} sx={tableContainerSx}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Schedule</TableCell>
                <TableCell>Destination</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Run</TableCell>
                <TableCell>Next Run</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Schedule fontSize="small" />
                      <Typography variant="body2" fontWeight={500}>
                        {schedule.name}
                      </Typography>
                      {!schedule.isActive && (
                        <Chip label="Disabled" size="small" color="default" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatScheduleDetails(schedule)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {schedule.destinationPath}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {schedule.lastRunStatus ? (
                      (() => {
                        const statusIcon = getStatusIcon(schedule.lastRunStatus);
                        return (
                          <Chip
                            {...(statusIcon ? { icon: statusIcon } : {})}
                            label={schedule.lastRunStatus}
                            size="small"
                            color={STATUS_COLORS[schedule.lastRunStatus] || 'default'}
                          />
                        );
                      })()
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        Not run yet
                      </Typography>
                    )}
                    {schedule.lastRunError && (
                      <Tooltip title={schedule.lastRunError}>
                        <IconButton size="small" sx={{ ml: 1 }}>
                          <Error fontSize="small" color="error" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatLastRun(schedule.lastRunAt)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatNextRun(schedule.nextRunAt)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" gap={0.5} justifyContent="flex-end">
                      <Tooltip title={schedule.isActive ? 'Disable' : 'Enable'}>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleSchedule(schedule)}
                          color={schedule.isActive ? 'primary' : 'default'}
                        >
                          {schedule.isActive ? <ToggleOn /> : <ToggleOff />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Trigger Now">
                        <IconButton
                          size="small"
                          onClick={() => handleTriggerBackup(schedule)}
                          disabled={triggeringScheduleId === schedule.id}
                          color="primary"
                        >
                          {triggeringScheduleId === schedule.id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <PlayArrow />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleEditSchedule(schedule)}
                          color="primary"
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteSchedule(schedule)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Schedule Form Dialog */}
      <BackupScheduleForm
        open={formOpen}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        editingSchedule={editingSchedule}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 0,
            border: '2px solid #c0c0c0',
          },
        }}
      >
        <DialogTitle sx={{ backgroundColor: '#1a237e', color: '#ffffff', fontSize: '14px' }}>
          Delete Backup Schedule
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography>
            Are you sure you want to delete the backup schedule &quot;{scheduleToDelete?.name}&quot;?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
            sx={{ textTransform: 'none', borderRadius: 0 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            sx={{ textTransform: 'none', borderRadius: 0 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Toast toast={toast} onClose={hideToast} />
    </Box>
  );
}

