import { Box, CircularProgress, Typography } from '@mui/material';
import { useSelector, shallowEqual } from 'react-redux';
import { useMemo, memo } from 'react';
import { RootState } from '../../store';
import { Backup as BackupIcon, SettingsBackupRestore as RestoreIcon } from '@mui/icons-material';

function BackupOperationBanner() {
  const { isInProgress, operationType, message, error } = useSelector(
    (state: RootState) => state.backup,
    shallowEqual
  );

  const isBackup = useMemo(() => operationType === 'backup', [operationType]);
  const backgroundColor = useMemo(() => (error ? '#ffebee' : '#fff'), [error]);
  const borderColor = useMemo(() => (error ? '#d32f2f' : '#000'), [error]);
  const iconColor = useMemo(() => (error ? '#d32f2f' : '#000'), [error]);
  const titleText = useMemo(
    () =>
      error
        ? `${isBackup ? 'Backup' : 'Restore'} Failed`
        : `${isBackup ? 'Backing up' : 'Restoring'} database...`,
    [error, isBackup]
  );
  const hasMessage = error || message;

  // Memoize style objects to prevent recreation on every render
  const containerSx = useMemo(
    () => ({
      position: 'fixed' as const,
      top: 16,
      right: 16,
      zIndex: 1300, // Above most content but below modals
      borderRadius: 0,
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
      border: `2px solid ${borderColor}`,
      backgroundColor: backgroundColor,
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      minWidth: '300px',
      maxWidth: '400px',
    }),
    [borderColor, backgroundColor]
  );

  const iconBoxSx = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '24px',
    }),
    []
  );

  const progressSx = useMemo(() => ({ color: '#000' }), []);
  const backupIconSx = useMemo(() => ({ fontSize: 20, color: iconColor }), [iconColor]);
  const restoreIconSx = useMemo(() => ({ fontSize: 20, color: iconColor }), [iconColor]);

  const titleTypographySx = useMemo(
    () => ({
      fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#000',
      fontWeight: 500,
      margin: 0,
      marginBottom: hasMessage ? '4px' : 0,
    }),
    [hasMessage]
  );

  const messageTypographySx = useMemo(
    () => ({
      fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#000',
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-word' as const,
      lineHeight: 1.4,
      margin: 0,
    }),
    []
  );

  if (!isInProgress && !error) {
    return null;
  }

  return (
    <Box sx={containerSx}>
      <Box sx={iconBoxSx}>
        {isInProgress ? (
          <CircularProgress size={20} sx={progressSx} />
        ) : isBackup ? (
          <BackupIcon sx={backupIconSx} />
        ) : (
          <RestoreIcon sx={restoreIconSx} />
        )}
      </Box>
      <Box sx={{ flexGrow: 1 }}>
        <Typography sx={titleTypographySx}>{titleText}</Typography>
        {hasMessage && (
          <Typography sx={messageTypographySx}>{error || message}</Typography>
        )}
      </Box>
    </Box>
  );
}

export default memo(BackupOperationBanner);

