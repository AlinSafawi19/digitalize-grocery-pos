import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Grid,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Usb,
  FolderOpen,
  Info as InfoIcon,
  Schedule,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { BackupService } from '../../services/backup.service';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import MainLayout from '../../components/layout/MainLayout';
import { showFolderDialog, showOpenDialog } from '../../services/file.service';
import {
  startBackupOperation,
  completeBackupOperation,
  setBackupOperationError,
} from '../../store/slices/backup.slice';
import BackupScheduleList from './BackupScheduleList';

export default function BackupPage() {
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const dispatch = useDispatch<AppDispatch>();
  const { isInProgress } = useSelector((state: RootState) => state.backup);
  const [restoreFromExternalDialogOpen, setRestoreFromExternalDialogOpen] = useState(false);
  const [selectedBackupPath, setSelectedBackupPath] = useState<string | null>(null);
  const [selectedBackupFilename, setSelectedBackupFilename] = useState<string>('');
  const [activeTab, setActiveTab] = useState(0);

  const handleBackupToExternal = useCallback(async () => {
    if (!user?.id) return;

    // Show folder selection dialog with clear messaging about external drive requirement
    const destinationPath = await showFolderDialog(
      'Select Backup Destination - MUST be USB Drive or External Hard Disk'
    );
    
    if (!destinationPath) {
      // User cancelled
      return;
    }

    // Start non-blocking backup operation
    dispatch(
      startBackupOperation({
        type: 'backup',
        message: `Validating external drive and creating backup to ${destinationPath}...`,
      })
    );

    // Run backup in background (non-blocking)
    // The service will validate that the destination is on an external drive
    BackupService.createBackupToExternal(destinationPath, {}, user.id)
      .then((result) => {
        if (result.success && result.backup) {
          dispatch(completeBackupOperation());
          showToast(
            `Backup created successfully on external drive! Location: ${destinationPath}`,
            'success'
          );
        } else {
          const errorMessage = result.error || 'Failed to create backup on external drive';
          dispatch(setBackupOperationError(errorMessage));
          showToast(errorMessage, 'error');
        }
      })
      .catch((error) => {
        console.error('Error creating backup to external drive:', error);
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Failed to create backup on external drive';
        dispatch(setBackupOperationError(errorMessage));
        showToast(errorMessage, 'error');
      });
  }, [user?.id, dispatch, showToast]);

  const handleRestoreFromExternal = useCallback(async () => {
    if (!user?.id) return;

    // Show file selection dialog to choose backup file from external drive
    const result = await showOpenDialog({
      title: 'Select Backup File from External Drive',
      filters: [
        { name: 'Database Backup', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return;
    }

    const backupPath = result.filePaths[0];
    // Extract filename more efficiently
    const filename = backupPath.split(/[/\\]/).pop() || 'external-backup.db';
    setSelectedBackupPath(backupPath);
    setSelectedBackupFilename(filename);
    setRestoreFromExternalDialogOpen(true);
  }, [user?.id]);

  const handleRestoreFromExternalConfirm = useCallback(async () => {
    if (!user?.id || !selectedBackupPath) return;

    const backupPath = selectedBackupPath;
    const backupFilename = selectedBackupFilename;

    setRestoreFromExternalDialogOpen(false);
    setSelectedBackupPath(null);
    setSelectedBackupFilename('');

    // Start non-blocking restore operation
    dispatch(
      startBackupOperation({
        type: 'restore',
        message: `Restoring database from ${backupFilename}...`,
      })
    );

    // Run restore in background (non-blocking)
    BackupService.restoreBackup(backupPath, user.id)
      .then((result) => {
        if (result.success) {
          dispatch(completeBackupOperation());
          showToast(
            'Database restored successfully from external drive. Please restart the application.',
            'success'
          );
        } else {
          const errorMessage = result.error || 'Failed to restore backup from external drive';
          dispatch(setBackupOperationError(errorMessage));
          showToast(errorMessage, 'error');
        }
      })
      .catch((error) => {
        console.error('Error restoring backup from external drive:', error);
        const errorMessage = 'Failed to restore backup from external drive';
        dispatch(setBackupOperationError(errorMessage));
        showToast(errorMessage, 'error');
      });
  }, [user?.id, selectedBackupPath, selectedBackupFilename, dispatch, showToast]);

  // Memoize sx prop objects to avoid recreation on every render
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
    fontSize: { xs: '20px', sm: '24px', md: '28px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const infoAlertSx = useMemo(() => ({
    mb: 3,
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    backgroundColor: '#e3f2fd',
  }), []);

  const infoTitleTypographySx = useMemo(() => ({
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    mb: 1,
  }), []);

  const infoBodyTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const paperSx = useMemo(() => ({
    p: 3,
    textAlign: 'center',
    height: '100%',
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const iconSx = useMemo(() => ({
    fontSize: 48,
    mb: 2,
  }), []);

  const backupIconSx = useMemo(() => ({
    ...iconSx,
    color: '#1a237e',
  }), [iconSx]);

  const restoreIconSx = useMemo(() => ({
    ...iconSx,
    color: '#7b1fa2',
  }), [iconSx]);

  const cardTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    mb: 1,
  }), []);

  const cardBodyTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
    mb: 3,
  }), []);

  const backupButtonSx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#1a237e',
    padding: '8px 20px',
    minHeight: '44px',
    '&:hover': {
      backgroundColor: '#283593',
    },
  }), []);

  const restoreButtonSx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#7b1fa2',
    padding: '8px 20px',
    minHeight: '44px',
    '&:hover': {
      backgroundColor: '#6a1b9a',
    },
  }), []);

  const dialogPaperSx = useMemo(() => ({
    borderRadius: 0,
    border: '2px solid #c0c0c0',
    boxShadow: 'inset 1px 1px 0px 0px #ffffff, inset -1px -1px 0px 0px #808080',
  }), []);

  const dialogTitleSx = useMemo(() => ({
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#1a237e',
    color: '#ffffff',
    padding: '8px 12px',
    borderBottom: '1px solid #000051',
  }), []);

  const dialogContentSx = useMemo(() => ({
    p: 3,
    backgroundColor: '#ffffff',
  }), []);

  const dialogContentTextSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const dialogWarningAlertSx = useMemo(() => ({
    mt: 2,
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    backgroundColor: '#fff3e0',
  }), []);

  const dialogActionsSx = useMemo(() => ({
    p: 2,
    backgroundColor: '#f5f5f5',
    borderTop: '1px solid #c0c0c0',
  }), []);

  const dialogCancelButtonSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    borderColor: '#c0c0c0',
    color: '#1a237e',
    '&:hover': {
      borderColor: '#1a237e',
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const dialogConfirmButtonSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#1a237e',
    '&:hover': {
      backgroundColor: '#283593',
    },
  }), []);

  const gridContainerSx = useMemo(() => ({
    mb: 3,
  }), []);

  const handleDialogClose = useCallback(() => {
    setRestoreFromExternalDialogOpen(false);
    setSelectedBackupPath(null);
    setSelectedBackupFilename('');
  }, []);

  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography variant="h4" fontWeight="bold" sx={titleTypographySx}>Backup & Restore</Typography>
        </Box>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            mb: 3,
            borderBottom: '1px solid #c0c0c0',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '14px',
              minHeight: 48,
            },
          }}
        >
          <Tab icon={<Usb />} iconPosition="start" label="Manual Backup" />
          <Tab icon={<Schedule />} iconPosition="start" label="Scheduled Backups" />
        </Tabs>

        {/* Tab Content */}
        {activeTab === 0 && (
          <>
            {/* Information Alert */}
            <Alert severity="warning" icon={<InfoIcon />} sx={infoAlertSx}>
              <Typography sx={infoTitleTypographySx}>
                ⚠️ External Drive Required for Backup
              </Typography>
              <Typography sx={infoBodyTypographySx}>
                <strong>Important:</strong> Backups must be saved to an external drive (USB flash drive or external hard disk). 
                Backups cannot be saved to the same drive where the application is installed. 
                This ensures your data is safe if your computer&apos;s hard disk fails. 
                Please connect a USB drive or external hard disk before creating a backup.
              </Typography>
            </Alert>

            {/* Action Buttons */}
            <Grid container spacing={3} sx={gridContainerSx}>
          <Grid item xs={12} md={6}>
            <Paper sx={paperSx}>
              <Usb sx={backupIconSx} />
              <Typography sx={cardTitleTypographySx}>
                Backup to External Drive (Required)
              </Typography>
              <Typography sx={cardBodyTypographySx}>
                Create a backup on your USB flash drive or external hard disk. 
                <strong> The backup must be saved to an external drive - it cannot be saved to your computer&apos;s main hard disk.</strong>
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<Usb />}
                onClick={handleBackupToExternal}
                disabled={isInProgress}
                fullWidth
                sx={backupButtonSx}
              >
                Export to External Drive
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={paperSx}>
              <FolderOpen sx={restoreIconSx} />
              <Typography sx={cardTitleTypographySx}>
                Restore from External Drive
              </Typography>
              <Typography sx={cardBodyTypographySx}>
                Restore your database from a backup file on external drive
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<FolderOpen />}
                onClick={handleRestoreFromExternal}
                disabled={isInProgress}
                fullWidth
                sx={restoreButtonSx}
              >
                Import from External Drive
              </Button>
            </Paper>
          </Grid>
        </Grid>
          </>
        )}

        {activeTab === 1 && (
          <>
            <Alert severity="info" icon={<InfoIcon />} sx={infoAlertSx}>
              <Typography sx={infoTitleTypographySx}>
                📅 Automated Backup Schedules
              </Typography>
              <Typography sx={infoBodyTypographySx}>
                Configure automated backups that run at scheduled times. Scheduled backups require an external drive to be connected when they run.
                If no external drive is available, the backup will be skipped and you&apos;ll receive a notification.
                You can create multiple schedules (e.g., daily, weekly) and enable/disable them as needed.
              </Typography>
            </Alert>
            <BackupScheduleList />
          </>
        )}

        {/* Restore from External Drive Dialog */}
        <Dialog
          open={restoreFromExternalDialogOpen}
          onClose={handleDialogClose}
          aria-labelledby="restore-external-dialog-title"
          PaperProps={{
            sx: dialogPaperSx,
          }}
        >
          <DialogTitle id="restore-external-dialog-title" sx={dialogTitleSx}>
            Restore from External Drive
          </DialogTitle>
          <DialogContent sx={dialogContentSx}>
            <DialogContentText sx={dialogContentTextSx}>
              Are you sure you want to restore the database from this backup file? This will replace
              your current database with the backup. A backup of your current database will be
              created automatically before restoring.
            </DialogContentText>
            {selectedBackupPath && (
              <Alert severity="warning" sx={dialogWarningAlertSx}>
                <strong>Backup File:</strong> {selectedBackupFilename}
                <br />
                <strong>Location:</strong> {selectedBackupPath}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={dialogActionsSx}>
            <Button
              onClick={handleDialogClose}
              variant="outlined"
              sx={dialogCancelButtonSx}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestoreFromExternalConfirm}
              variant="contained"
              sx={dialogConfirmButtonSx}
            >
              Restore
            </Button>
          </DialogActions>
        </Dialog>
      </Box>

      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
}
