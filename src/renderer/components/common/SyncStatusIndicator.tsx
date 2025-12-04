import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Tooltip,
  Menu,
  Typography,
  Box,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
} from '@mui/material';
import {
  Sync,
  SyncDisabled,
  CheckCircle,
  Refresh,
} from '@mui/icons-material';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { formatDateTime } from '../../utils/dateUtils';

const SyncStatusIndicator: React.FC = () => {
  const { syncStatus, loading, refreshSyncStatus, processQueue } = useSyncStatus(10000); // Update every 10 seconds
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleManualSync = async () => {
    await processQueue();
    handleClose();
  };

  const getStatusIcon = () => {
    if (loading) {
      return <CircularProgress size={20} sx={{ color: 'white' }} />;
    }

    if (syncStatus.hasPendingOperations) {
      return <SyncDisabled sx={{ fontSize: 20, color: '#ff9800' }} />;
    }

    return <CheckCircle sx={{ fontSize: 20, color: '#4caf50' }} />;
  };

  const getStatusTooltip = () => {
    if (loading) {
      return 'Checking sync status...';
    }

    if (syncStatus.hasPendingOperations) {
      return `${syncStatus.pendingCount} operation(s) pending sync`;
    }

    return 'All operations synced';
  };

  const getOperationTypeLabel = (type: string) => {
    switch (type) {
      case 'incrementUserCount':
        return 'User Created';
      case 'decrementUserCount':
        return 'User Deleted';
      case 'syncUserCount':
        return 'User Count Sync';
      default:
        return type;
    }
  };

  return (
    <>
      <Tooltip title={getStatusTooltip()}>
        <IconButton
          color="inherit"
          onClick={handleClick}
          sx={{
            ml: 1,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <Badge
            badgeContent={syncStatus.hasPendingOperations ? syncStatus.pendingCount : 0}
            color="warning"
            max={99}
          >
            {getStatusIcon()}
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            minWidth: 320,
            maxWidth: 400,
            mt: 1,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
              Sync Status
            </Typography>
            <IconButton
              size="small"
              onClick={refreshSyncStatus}
              disabled={loading}
              sx={{ ml: 1 }}
            >
              <Refresh sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : syncStatus.hasPendingOperations ? (
            <>
              <Chip
                icon={<SyncDisabled />}
                label={`${syncStatus.pendingCount} Pending`}
                color="warning"
                size="small"
                sx={{ mb: 2 }}
              />

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Operations waiting to sync:
              </Typography>

              <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                {syncStatus.operations.map((operation, index) => (
                  <React.Fragment key={operation.id}>
                    {index > 0 && <Divider />}
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {getOperationTypeLabel(operation.type)}
                            </Typography>
                            {operation.retryCount > 0 && (
                              <Chip
                                label={`Retry ${operation.retryCount}`}
                                size="small"
                                color="warning"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(operation.createdAt)}
                          </Typography>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>

              <Button
                fullWidth
                variant="contained"
                startIcon={<Sync />}
                onClick={handleManualSync}
                sx={{ mt: 2 }}
                size="small"
              >
                Sync Now
              </Button>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Operations will sync automatically when connection is restored.
              </Typography>
            </>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CheckCircle sx={{ color: '#4caf50', fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 500 }}>
                  All operations synced
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                All pending operations have been successfully synced with the license server.
              </Typography>
            </>
          )}
        </Box>
      </Menu>
    </>
  );
};

export default SyncStatusIndicator;

