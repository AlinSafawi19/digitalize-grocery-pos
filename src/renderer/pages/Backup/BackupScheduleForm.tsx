import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Alert,
  Box,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  BackupSchedulerService,
  BackupSchedule,
  CreateBackupScheduleInput,
  UpdateBackupScheduleInput,
  ScheduleConfig,
} from '../../services/backup-scheduler.service';
import { BackupService, ExternalDriveInfo } from '../../services/backup.service';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { showFolderDialog } from '../../services/file.service';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Beirut';

const SCHEDULE_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

interface BackupScheduleFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingSchedule: BackupSchedule | null;
}

export default function BackupScheduleForm({
  open,
  onClose,
  onSuccess,
  editingSchedule,
}: BackupScheduleFormProps) {
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [externalDrives, setExternalDrives] = useState<ExternalDriveInfo[]>([]);
  const [loadingDrives, setLoadingDrives] = useState(false);

  const [formData, setFormData] = useState<CreateBackupScheduleInput>({
    name: '',
    scheduleType: 'daily',
    scheduleConfig: {
      time: '02:00',
    },
    destinationPath: '',
    isActive: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      loadExternalDrives();
      if (editingSchedule) {
        // Load editing schedule data
        const config = typeof editingSchedule.scheduleConfig === 'string'
          ? JSON.parse(editingSchedule.scheduleConfig)
          : editingSchedule.scheduleConfig;
        
        setFormData({
          name: editingSchedule.name,
          scheduleType: editingSchedule.scheduleType,
          scheduleConfig: config,
          destinationPath: editingSchedule.destinationPath,
          isActive: editingSchedule.isActive,
        });
      } else {
        // Reset form for new schedule
        setFormData({
          name: '',
          scheduleType: 'daily',
          scheduleConfig: {
            time: '02:00',
          },
          destinationPath: '',
          isActive: true,
        });
      }
      setErrors({});
    }
  }, [open, editingSchedule]);

  const loadExternalDrives = useCallback(async () => {
    setLoadingDrives(true);
    try {
      const result = await BackupService.getAvailableExternalDrives();
      if (result.success && result.drives) {
        setExternalDrives(result.drives.filter(d => d.isWritable));
      }
    } catch (error) {
      console.error('Error loading external drives:', error);
    } finally {
      setLoadingDrives(false);
    }
  }, []);

  const handleSelectDestination = useCallback(async () => {
    const destinationPath = await showFolderDialog(
      'Select Backup Destination on External Drive'
    );
    
    if (destinationPath) {
      setFormData(prev => ({ ...prev, destinationPath }));
      setErrors(prev => ({ ...prev, destinationPath: '' }));
    }
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Schedule name is required';
    }

    if (!formData.destinationPath.trim()) {
      newErrors.destinationPath = 'Destination path is required';
    }

    if (formData.scheduleType === 'weekly' && formData.scheduleConfig.dayOfWeek === undefined) {
      newErrors.dayOfWeek = 'Day of week is required for weekly schedule';
    }

    if (formData.scheduleType === 'monthly' && formData.scheduleConfig.dayOfMonth === undefined) {
      newErrors.dayOfMonth = 'Day of month is required for monthly schedule';
    }

    if (!formData.scheduleConfig.time) {
      newErrors.time = 'Time is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!user?.id) return;

    if (!validateForm()) {
      showToast('Please fix the form errors', 'error');
      return;
    }

    setLoading(true);
    try {
      if (editingSchedule) {
        // Update existing schedule
        const updateInput: UpdateBackupScheduleInput = {
          name: formData.name,
          scheduleType: formData.scheduleType,
          scheduleConfig: formData.scheduleConfig,
          destinationPath: formData.destinationPath,
          isActive: formData.isActive,
        };

        const result = await BackupSchedulerService.updateSchedule(
          editingSchedule.id,
          updateInput
        );

        if (result.success) {
          showToast('Backup schedule updated successfully', 'success');
          onSuccess();
        } else {
          showToast(result.error || 'Failed to update backup schedule', 'error');
        }
      } else {
        // Create new schedule
        const result = await BackupSchedulerService.createSchedule(formData, user.id);

        if (result.success) {
          showToast('Backup schedule created successfully', 'success');
          onSuccess();
        } else {
          showToast(result.error || 'Failed to create backup schedule', 'error');
        }
      }
    } catch (error) {
      showToast('Error saving backup schedule', 'error');
      console.error('Error saving schedule:', error);
    } finally {
      setLoading(false);
    }
  }, [formData, editingSchedule, user?.id, validateForm, showToast, onSuccess]);

  const handleScheduleTypeChange = useCallback((scheduleType: string) => {
    const newConfig: ScheduleConfig = { time: formData.scheduleConfig.time || '02:00' };
    
    if (scheduleType === 'weekly') {
      newConfig.dayOfWeek = 1; // Default to Monday
    } else if (scheduleType === 'monthly') {
      newConfig.dayOfMonth = 1; // Default to 1st of month
    }

    setFormData(prev => ({
      ...prev,
      scheduleType,
      scheduleConfig: newConfig,
    }));
  }, [formData.scheduleConfig.time]);

  const handleTimeChange = useCallback((time: Date | null) => {
    if (time) {
      // Interpret the time picker value as being in Beirut timezone
      // The time picker gives us a Date object, but we need to extract the time in Beirut timezone
      const beirutMoment = moment.tz(time, TIMEZONE);
      const timeString = beirutMoment.format('HH:mm');
      setFormData(prev => ({
        ...prev,
        scheduleConfig: {
          ...prev.scheduleConfig,
          time: timeString,
        },
      }));
      setErrors(prev => ({ ...prev, time: '' }));
    }
  }, []);

  const dialogPaperSx = useMemo(() => ({
    borderRadius: 0,
    border: '2px solid #c0c0c0',
    minWidth: 600,
  }), []);

  const dialogTitleSx = useMemo(() => ({
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#1a237e',
    color: '#ffffff',
    padding: '8px 12px',
  }), []);

  const dialogContentSx = useMemo(() => ({
    p: 3,
    backgroundColor: '#ffffff',
  }), []);

  const dialogActionsSx = useMemo(() => ({
    p: 2,
    backgroundColor: '#f5f5f5',
    borderTop: '1px solid #c0c0c0',
  }), []);

  const timeValue = useMemo(() => {
    if (formData.scheduleConfig.time) {
      // Create a moment in Beirut timezone with the specified time
      const [hours, minutes] = formData.scheduleConfig.time.split(':').map(Number);
      return moment.tz(TIMEZONE).hour(hours).minute(minutes).second(0).millisecond(0).toDate();
    }
    // Default to 2:00 AM in Beirut timezone
    return moment.tz(TIMEZONE).hour(2).minute(0).second(0).millisecond(0).toDate();
  }, [formData.scheduleConfig.time]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={dialogTitleSx}>
          {editingSchedule ? 'Edit Backup Schedule' : 'Create Backup Schedule'}
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 0 }}>
            <Typography variant="body2">
              Scheduled backups will automatically create backups at the specified time. 
              Make sure an external drive is connected when the backup is scheduled to run, 
              otherwise the backup will be skipped.
            </Typography>
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Schedule Name"
                value={formData.name}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, name: e.target.value }));
                  setErrors(prev => ({ ...prev, name: '' }));
                }}
                fullWidth
                required
                error={!!errors.name}
                helperText={errors.name || 'Give this schedule a descriptive name (e.g., "Daily Backup at 2 AM")'}
                sx={{ '& .MuiInputBase-root': { borderRadius: 0 } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Schedule Type</InputLabel>
                <Select
                  value={formData.scheduleType}
                  onChange={(e) => handleScheduleTypeChange(e.target.value)}
                  label="Schedule Type"
                  sx={{ borderRadius: 0 }}
                >
                  {SCHEDULE_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, ml: 1.75 }}>
                  {formData.scheduleType === 'daily' && 'Backup runs every day at the specified time'}
                  {formData.scheduleType === 'weekly' && 'Backup runs once per week on the selected day'}
                  {formData.scheduleType === 'monthly' && 'Backup runs once per month on the selected day'}
                </Typography>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TimePicker
                label="Backup Time (Asia/Beirut)"
                value={timeValue}
                onChange={handleTimeChange}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    error: !!errors.time,
                    helperText: errors.time || 'Time when the backup will run in Asia/Beirut timezone (recommended: off-hours like 2:00 AM)',
                    sx: { '& .MuiInputBase-root': { borderRadius: 0 } },
                  },
                }}
              />
            </Grid>

            {formData.scheduleType === 'weekly' && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Day of Week</InputLabel>
                  <Select
                    value={formData.scheduleConfig.dayOfWeek ?? 1}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        scheduleConfig: {
                          ...prev.scheduleConfig,
                          dayOfWeek: Number(e.target.value),
                        },
                      }));
                      setErrors(prev => ({ ...prev, dayOfWeek: '' }));
                    }}
                    label="Day of Week"
                    sx={{ borderRadius: 0 }}
                    error={!!errors.dayOfWeek}
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <MenuItem key={day.value} value={day.value}>
                        {day.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, ml: 1.75 }}>
                    Select which day of the week the backup should run
                  </Typography>
                </FormControl>
              </Grid>
            )}

            {formData.scheduleType === 'monthly' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Day of Month"
                  type="number"
                  value={formData.scheduleConfig.dayOfMonth ?? 1}
                  onChange={(e) => {
                    const day = Math.max(1, Math.min(31, Number(e.target.value)));
                    setFormData(prev => ({
                      ...prev,
                      scheduleConfig: {
                        ...prev.scheduleConfig,
                        dayOfMonth: day,
                      },
                    }));
                    setErrors(prev => ({ ...prev, dayOfMonth: '' }));
                  }}
                  fullWidth
                  required
                  inputProps={{ min: 1, max: 31 }}
                  error={!!errors.dayOfMonth}
                  helperText={errors.dayOfMonth || 'Day of month (1-31). If the month has fewer days, backup runs on the last day of that month'}
                  sx={{ '& .MuiInputBase-root': { borderRadius: 0 } }}
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <Box display="flex" gap={1} alignItems="flex-start">
                <TextField
                  label="Destination Path (External Drive)"
                  value={formData.destinationPath}
                  fullWidth
                  required
                  error={!!errors.destinationPath}
                  helperText={errors.destinationPath || 'Path on external drive where backups will be saved'}
                  sx={{ '& .MuiInputBase-root': { borderRadius: 0 } }}
                  InputProps={{
                    readOnly: true,
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={handleSelectDestination}
                  sx={{ mt: 1, borderRadius: 0, minWidth: 120 }}
                >
                  Browse
                </Button>
              </Box>
            </Grid>

            {externalDrives.length > 0 && (
              <Grid item xs={12}>
                <Alert severity="info" sx={{ borderRadius: 0 }}>
                  <Typography variant="body2" fontWeight={600} mb={1}>
                    Available External Drives:
                  </Typography>
                  {externalDrives.map((drive) => (
                    <Typography key={drive.driveLetter} variant="body2">
                      • {drive.driveLetter} - {drive.label} ({Math.round(drive.freeSpace / 1024 / 1024 / 1024)} GB free)
                    </Typography>
                  ))}
                </Alert>
              </Grid>
            )}

            {externalDrives.length === 0 && !loadingDrives && (
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ borderRadius: 0 }}>
                  <Typography variant="body2" fontWeight={600} mb={0.5}>
                    No External Drive Detected
                  </Typography>
                  <Typography variant="body2">
                    Please connect a USB drive or external hard disk before creating a backup schedule. 
                    Backups require an external drive to ensure your data is safe if your computer&apos;s hard disk fails.
                    <br />
                    <strong>Note:</strong> If no external drive is connected when a scheduled backup runs, 
                    the backup will be skipped and you&apos;ll receive a notification.
                  </Typography>
                </Alert>
              </Grid>
            )}

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, isActive: e.target.checked }))
                    }
                  />
                }
                label="Enable this schedule"
              />
              <Typography variant="caption" color="textSecondary" sx={{ ml: 4.5, display: 'block', mt: -1 }}>
                Disabled schedules will not run until re-enabled. You can toggle this later from the schedule list.
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button
            onClick={onClose}
            variant="outlined"
            disabled={loading}
            sx={{ textTransform: 'none', borderRadius: 0 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || externalDrives.length === 0}
            sx={{ textTransform: 'none', borderRadius: 0, backgroundColor: '#1a237e' }}
          >
            {loading ? 'Saving...' : editingSchedule ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
      <Toast toast={toast} onClose={hideToast} />
    </>
  );
}

