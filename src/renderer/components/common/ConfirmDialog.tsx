import React, { ReactNode, useMemo, memo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmColor?: 'primary' | 'error' | 'warning';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmColor = 'primary',
  loading = false,
}) => {
  const confirmButtonColor = useMemo(() => {
    switch (confirmColor) {
      case 'error':
        return '#d32f2f';
      case 'warning':
        return '#ed6c02';
      default:
        return '#1976d2';
    }
  }, [confirmColor]);

  const confirmButtonHoverColor = useMemo(() => {
    switch (confirmColor) {
      case 'error':
        return '#c62828';
      case 'warning':
        return '#e65100';
      default:
        return '#1565c0';
    }
  }, [confirmColor]);

  const handleConfirm = useCallback(() => {
    if (!loading) {
      onConfirm();
    }
  }, [onConfirm, loading]);

  const handleCancel = useCallback(() => {
    if (!loading) {
      onCancel();
    }
  }, [onCancel, loading]);

  // Memoize style objects to prevent recreation on every render
  const paperProps = useMemo(
    () => ({
      sx: {
        borderRadius: 0,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        border: '2px solid #000',
        minWidth: '300px',
        maxWidth: '400px',
        padding: 0,
      },
    }),
    []
  );

  const backdropProps = useMemo(
    () => ({
      sx: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
      },
    }),
    []
  );

  const dialogTitleSx = useMemo(
    () => ({
      padding: '20px',
      paddingBottom: '12px',
      backgroundColor: '#fff',
      borderBottom: '1px solid #d0d0d0',
    }),
    []
  );

  const titleTypographySx = useMemo(
    () => ({
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#000',
      fontWeight: 500,
      margin: 0,
    }),
    []
  );

  const dialogContentSx = useMemo(
    () => ({
      padding: '16px',
      paddingBottom: '12px',
      backgroundColor: '#fff',
      minHeight: '48px',
    }),
    []
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

  const dialogActionsSx = useMemo(
    () => ({
      padding: '8px 12px',
      backgroundColor: '#f0f0f0',
      borderTop: '1px solid #d0d0d0',
      justifyContent: 'flex-end',
      gap: '8px',
    }),
    []
  );

  const cancelButtonSx = useMemo(
    () => ({
      minWidth: '100px',
      minHeight: '40px',
      padding: '8px 20px',
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#e1e1e1',
      color: '#000',
      border: '1px solid #adadad',
      borderRadius: '2px',
      textTransform: 'none',
      fontWeight: 600,
      boxShadow: 'none',
      '&:hover': {
        backgroundColor: '#e5f1fb',
        borderColor: '#0078d4',
      },
      '&:focus': {
        outline: '1px dotted #000',
        outlineOffset: '-4px',
      },
      '&:disabled': {
        backgroundColor: '#f5f5f5',
        color: '#9e9e9e',
        borderColor: '#d0d0d0',
      },
    }),
    []
  );

  const confirmButtonSx = useMemo(
    () => ({
      minWidth: '100px',
      minHeight: '40px',
      padding: '8px 20px',
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: confirmButtonColor,
      color: '#fff',
      border: '1px solid #000',
      borderRadius: '2px',
      textTransform: 'none',
      fontWeight: 600,
      boxShadow: 'none',
      '&:hover': {
        backgroundColor: confirmButtonHoverColor,
      },
      '&:focus': {
        outline: '1px dotted #000',
        outlineOffset: '-4px',
      },
      '&:disabled': {
        backgroundColor: '#d0d0d0',
        color: '#9e9e9e',
        borderColor: '#adadad',
      },
    }),
    [confirmButtonColor, confirmButtonHoverColor]
  );

  const isStringMessage = typeof message === 'string';

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="xs"
      PaperProps={paperProps}
      BackdropProps={backdropProps}
    >
      <DialogTitle sx={dialogTitleSx}>
        <Typography sx={titleTypographySx}>{title}</Typography>
      </DialogTitle>
      <DialogContent sx={dialogContentSx}>
        {isStringMessage ? (
          <Typography variant="body1" sx={messageTypographySx}>
            {message}
          </Typography>
        ) : (
          message
        )}
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={handleCancel} disabled={loading} sx={cancelButtonSx}>
          {cancelLabel}
        </Button>
        <Button onClick={handleConfirm} autoFocus disabled={loading} sx={confirmButtonSx}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default memo(ConfirmDialog);

