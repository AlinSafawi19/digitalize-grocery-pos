import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Button,
  Box,
  LinearProgress,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  CloudDownload,
  SystemUpdate,
  CheckCircle,
} from '@mui/icons-material';
import { UpdateService, UpdateInfo, DownloadProgress } from '../../services/update.service';
import { useToast } from '../../hooks/useToast';

interface UpdateNotificationProps {
  onDismiss?: () => void;
}

export default function UpdateNotification({ onDismiss }: UpdateNotificationProps) {
  const { showToast } = useToast();
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState<UpdateInfo | null>(null);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Listen for update available
  useEffect(() => {
    const unsubscribe = UpdateService.onUpdateAvailable((info) => {
      setUpdateAvailable(info);
      showToast(`Update available: Version ${info.version}`, 'info');
    });

    return unsubscribe;
  }, [showToast]);

  // Listen for download progress
  useEffect(() => {
    const unsubscribe = UpdateService.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
    });

    return unsubscribe;
  }, []);

  // Listen for update downloaded
  useEffect(() => {
    const unsubscribe = UpdateService.onUpdateDownloaded((info) => {
      setUpdateDownloaded(info);
      setDownloading(false);
      setDownloadProgress(null);
      setInstallDialogOpen(true);
      showToast('Update downloaded successfully. Ready to install!', 'success');
    });

    return unsubscribe;
  }, [showToast]);

  const handleDownload = useCallback(async () => {
    if (!updateAvailable) return;

    setDownloading(true);
    setDownloadProgress(null);

    const result = await UpdateService.downloadUpdate();
    if (!result.success) {
      showToast(result.error || 'Failed to download update', 'error');
      setDownloading(false);
    }
  }, [updateAvailable, showToast]);

  const handleInstall = useCallback(async () => {
    setInstalling(true);
    const result = await UpdateService.installUpdate();
    if (!result.success) {
      showToast(result.error || 'Failed to install update', 'error');
      setInstalling(false);
    }
    // If successful, app will restart automatically
  }, [showToast]);

  const handleDismiss = useCallback(() => {
    setUpdateAvailable(null);
    onDismiss?.();
  }, [onDismiss]);

  const handleCloseInstallDialog = useCallback(() => {
    if (!installing) {
      setInstallDialogOpen(false);
    }
  }, [installing]);

  // Memoize snackbar sx
  const snackbarSx = useMemo(() => ({
    '& .MuiSnackbarContent-root': {
      minWidth: '400px',
      maxWidth: '600px',
    },
  }), []);

  // Memoize alert sx
  const alertSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #2196f3',
    borderLeft: '4px solid #2196f3',
    backgroundColor: '#e3f2fd',
    '& .MuiAlert-icon': {
      color: '#1976d2',
    },
  }), []);

  // Memoize button sx
  const downloadButtonSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#1a237e',
    padding: '6px 16px',
    '&:hover': {
      backgroundColor: '#283593',
    },
  }), []);

  const laterButtonSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    borderColor: '#c0c0c0',
    color: '#1a237e',
    padding: '6px 16px',
    '&:hover': {
      borderColor: '#1a237e',
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const installButtonSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#2e7d32',
    padding: '6px 16px',
    '&:hover': {
      backgroundColor: '#1b5e20',
    },
  }), []);

  return (
    <>
      {/* Update Available Notification */}
      <Snackbar
        open={!!updateAvailable && !downloading && !updateDownloaded}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={snackbarSx}
      >
        <Alert
          severity="info"
          icon={<SystemUpdate />}
          action={
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<CloudDownload />}
                onClick={handleDownload}
                sx={downloadButtonSx}
              >
                Download
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleDismiss}
                sx={laterButtonSx}
              >
                Later
              </Button>
            </Box>
          }
          sx={alertSx}
        >
          <AlertTitle sx={{ fontSize: '14px', fontWeight: 600, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            Update Available - Version {updateAvailable?.version}
          </AlertTitle>
          <Typography variant="body2" sx={{ fontSize: '13px', fontFamily: 'system-ui, -apple-system, sans-serif', mb: updateAvailable?.releaseNotes ? 1 : 0 }}>
            A new version is available. Download now to get the latest features and improvements.
          </Typography>
          {updateAvailable?.releaseNotes && (
            <Box sx={{ mt: 1, maxHeight: '150px', overflow: 'auto' }}>
              <Typography variant="caption" sx={{ fontSize: '11px', fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 600, display: 'block', mb: 0.5 }}>
                What&apos;s New:
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '11px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  whiteSpace: 'pre-line',
                  display: 'block',
                  color: '#616161',
                }}
              >
                {updateAvailable.releaseNotes.length > 200 
                  ? `${updateAvailable.releaseNotes.substring(0, 200)}...` 
                  : updateAvailable.releaseNotes}
              </Typography>
            </Box>
          )}
        </Alert>
      </Snackbar>

      {/* Download Progress Notification */}
      <Snackbar
        open={downloading && !!downloadProgress}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={snackbarSx}
      >
        <Alert
          severity="info"
          icon={<CloudDownload />}
          sx={alertSx}
        >
          <AlertTitle sx={{ fontSize: '14px', fontWeight: 600, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            Downloading Update...
          </AlertTitle>
          <Box sx={{ mt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={downloadProgress?.percent || 0}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: '#e0e0e0',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                },
              }}
            />
            <Typography variant="caption" sx={{ fontSize: '12px', fontFamily: 'system-ui, -apple-system, sans-serif', mt: 0.5, display: 'block' }}>
              {downloadProgress?.percent.toFixed(1)}% - {((downloadProgress?.bytesPerSecond || 0) / 1024 / 1024).toFixed(2)} MB/s
            </Typography>
          </Box>
        </Alert>
      </Snackbar>

      {/* Install Update Dialog */}
      <Dialog
        open={installDialogOpen}
        onClose={handleCloseInstallDialog}
        disableEscapeKeyDown={installing}
        PaperProps={{
          sx: {
            borderRadius: 0,
            border: '1px solid #c0c0c0',
          },
        }}
      >
        <DialogTitle sx={{ fontSize: '16px', fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 600 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle sx={{ color: '#2e7d32', fontSize: '24px' }} />
            Update Ready to Install
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ fontSize: '13px', fontFamily: 'system-ui, -apple-system, sans-serif', mb: 2 }}>
            Version {updateDownloaded?.version} has been downloaded successfully.
          </Typography>
          {updateDownloaded?.releaseNotes && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontSize: '13px', fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 600, mb: 1 }}>
                What&apos;s New:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '12px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  whiteSpace: 'pre-line',
                  maxHeight: '200px',
                  overflow: 'auto',
                }}
              >
                {updateDownloaded.releaseNotes}
              </Typography>
            </Box>
          )}
          <Typography variant="body2" sx={{ fontSize: '13px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#616161' }}>
            The application will restart after installation. Make sure to save your work.
          </Typography>
          {installing && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" sx={{ fontSize: '13px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                Installing update...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCloseInstallDialog}
            disabled={installing}
            variant="outlined"
            sx={laterButtonSx}
          >
            Install Later
          </Button>
          <Button
            onClick={handleInstall}
            disabled={installing}
            variant="contained"
            startIcon={installing ? <CircularProgress size={16} /> : <SystemUpdate />}
            sx={installButtonSx}
          >
            {installing ? 'Installing...' : 'Install & Restart'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

