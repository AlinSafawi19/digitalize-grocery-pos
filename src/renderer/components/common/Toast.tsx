import React, { useEffect, useCallback, useMemo, memo } from 'react';
import {
  Box,
  Typography,
  AlertColor,
} from '@mui/material';

export interface ToastState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

interface ToastProps {
  toast: ToastState;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  // Memoize onClose to prevent effect from re-running unnecessarily
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Auto-close after 6 seconds
  useEffect(() => {
    if (toast.open) {
      const timer = setTimeout(() => {
        handleClose();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [toast.open, handleClose]);

  const containerSx = useMemo(
    () => ({
      position: 'fixed' as const,
      top: 16,
      right: 16,
      zIndex: 1400, // Above most content
      borderRadius: 0,
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
      border: '2px solid #000',
      minWidth: '300px',
      maxWidth: '400px',
      backgroundColor: '#fff',
      padding: '16px',
      display: toast.open ? 'flex' : 'none',
      alignItems: 'center',
    }),
    [toast.open]
  );

  const typographySx = useMemo(
    () => ({
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#000',
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-word' as const,
      lineHeight: 1.5,
      margin: 0,
    }),
    []
  );

  if (!toast.open) {
    return null;
  }

  return (
    <Box sx={containerSx}>
      <Typography variant="body1" sx={typographySx}>
        {toast.message}
      </Typography>
    </Box>
  );
};

export default memo(Toast);

