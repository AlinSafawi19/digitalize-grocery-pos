import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Button,
  TextField,
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
  IconButton,
  Pagination,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
} from '@mui/material';
import {
  TransferWithinAStation,
  CheckCircle,
  Cancel,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Refresh,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import { ROUTES } from '../../utils/constants';
import MainLayout from '../../components/layout/MainLayout';
import { formatDate } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import {
  LicenseTransferService,
  LicenseTransferRecord,
  LicenseTransferStatus,
  InitiateLicenseTransferInput,
  CompleteLicenseTransferInput,
} from '../../services/license-transfer.service';

export default function LicenseTransferPage() {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<LicenseTransferRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<LicenseTransferStatus | 'all'>('all');
  
  // Initiate transfer dialog
  const [initiateDialogOpen, setInitiateDialogOpen] = useState(false);
  const [initiateLicenseKey, setInitiateLicenseKey] = useState('');
  const [initiateNotes, setInitiateNotes] = useState('');
  const [initiating, setInitiating] = useState(false);
  const [transferToken, setTransferToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  
  // Complete transfer dialog
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeTransferToken, setCompleteTransferToken] = useState('');
  const [completeLicenseKey, setCompleteLicenseKey] = useState('');
  const [completing, setCompleting] = useState(false);
  
  // Cancel transfer dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTransferId, setCancelTransferId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await LicenseTransferService.getTransferHistory({
        page,
        pageSize,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setTransfers(result.transfers);
      setTotal(result.total);
    } catch (err) {
      console.error('Error loading transfers:', err);
      showToast('Failed to load transfer history', 'error');
      setTransfers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, showToast]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  const handleInitiateTransfer = async () => {
    if (!initiateLicenseKey.trim()) {
      showToast('License key is required', 'error');
      return;
    }

    if (!user?.id) {
      showToast('User not found', 'error');
      return;
    }

    setInitiating(true);
    try {
      const input: InitiateLicenseTransferInput = {
        licenseKey: initiateLicenseKey.trim(),
        notes: initiateNotes.trim() || undefined,
      };

      const result = await LicenseTransferService.initiateTransfer(input, user.id);

      if (result.success) {
        showToast(result.message, 'success');
        setTransferToken(result.transferToken || null);
        setInitiateDialogOpen(false);
        setInitiateLicenseKey('');
        setInitiateNotes('');
        await loadTransfers();
      } else {
        showToast(result.message, 'error');
      }
    } catch (err) {
      console.error('Error initiating transfer:', err);
      showToast('Failed to initiate transfer', 'error');
    } finally {
      setInitiating(false);
    }
  };

  const handleCompleteTransfer = async () => {
    if (!completeTransferToken.trim()) {
      showToast('Transfer token is required', 'error');
      return;
    }

    if (!completeLicenseKey.trim()) {
      showToast('License key is required', 'error');
      return;
    }

    if (!user?.id) {
      showToast('User not found', 'error');
      return;
    }

    setCompleting(true);
    try {
      const input: CompleteLicenseTransferInput = {
        transferToken: completeTransferToken.trim(),
        licenseKey: completeLicenseKey.trim(),
      };

      const result = await LicenseTransferService.completeTransfer(input, user.id);

      if (result.success) {
        showToast(result.message, 'success');
        setCompleteDialogOpen(false);
        setCompleteTransferToken('');
        setCompleteLicenseKey('');
        await loadTransfers();
        // Navigate to license page after successful transfer
        setTimeout(() => {
          navigate(ROUTES.LICENSE);
        }, 2000);
      } else {
        showToast(result.message, 'error');
      }
    } catch (err) {
      console.error('Error completing transfer:', err);
      showToast('Failed to complete transfer', 'error');
    } finally {
      setCompleting(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!cancelTransferId) {
      return;
    }

    if (!user?.id) {
      showToast('User not found', 'error');
      return;
    }

    setCancelling(true);
    try {
      const result = await LicenseTransferService.cancelTransfer(
        cancelTransferId,
        user.id,
        cancelReason.trim() || undefined
      );

      if (result.success) {
        showToast(result.message, 'success');
        setCancelDialogOpen(false);
        setCancelTransferId(null);
        setCancelReason('');
        await loadTransfers();
      } else {
        showToast(result.message, 'error');
      }
    } catch (err) {
      console.error('Error cancelling transfer:', err);
      showToast('Failed to cancel transfer', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const getStatusColor = (status: LicenseTransferStatus) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'cancelled':
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatStatus = (status: LicenseTransferStatus) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            License Transfer
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<TransferWithinAStation />}
              onClick={() => setInitiateDialogOpen(true)}
            >
              Initiate Transfer
            </Button>
            <Button
              variant="outlined"
              startIcon={<CheckCircle />}
              onClick={() => setCompleteDialogOpen(true)}
            >
              Complete Transfer
            </Button>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadTransfers}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {/* Transfer Token Display (if just initiated) */}
        {transferToken && (
          <Alert
            severity="success"
            sx={{ mb: 3 }}
            action={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={copiedToken ? 'Copied!' : 'Copy token'}>
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(transferToken)}
                  >
                    {copiedToken ? <CheckIcon /> : <CopyIcon />}
                  </IconButton>
                </Tooltip>
                <Button size="small" onClick={() => setTransferToken(null)}>
                  Close
                </Button>
              </Box>
            }
          >
            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
              Transfer initiated successfully!
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Use this transfer token on the target device to complete the transfer:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                p: 1,
                borderRadius: 1,
                wordBreak: 'break-all',
              }}
            >
              {transferToken}
            </Typography>
          </Alert>
        )}

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value as LicenseTransferStatus | 'all')}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Transfer History Table */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>License Key</TableCell>
                  <TableCell>Source Device</TableCell>
                  <TableCell>Target Device</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Initiated At</TableCell>
                  <TableCell>Completed At</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : transfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No transfers found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  transfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>{transfer.id}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {transfer.licenseKey.substring(0, 12)}...
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {transfer.sourceMachineName || transfer.sourceHardwareId.substring(0, 8) + '...'}
                      </TableCell>
                      <TableCell>
                        {transfer.targetMachineName || transfer.targetHardwareId
                          ? (transfer.targetMachineName || transfer.targetHardwareId?.substring(0, 8) + '...')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={formatStatus(transfer.status)}
                          color={getStatusColor(transfer.status) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatDate(new Date(transfer.initiatedAt))}</TableCell>
                      <TableCell>
                        {transfer.completedAt ? formatDate(new Date(transfer.completedAt)) : '-'}
                      </TableCell>
                      <TableCell>
                        {transfer.status === 'pending' && (
                          <Tooltip title="Cancel transfer">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setCancelTransferId(transfer.id);
                                setCancelDialogOpen(true);
                              }}
                            >
                              <Cancel />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {total > pageSize && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <Pagination
                count={Math.ceil(total / pageSize)}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </Paper>

        {/* Initiate Transfer Dialog */}
        <Dialog open={initiateDialogOpen} onClose={() => setInitiateDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Initiate License Transfer</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              This will deactivate the license on this device. Make sure you have the transfer token before proceeding.
            </Alert>
            <TextField
              fullWidth
              label="License Key"
              value={initiateLicenseKey}
              onChange={(e) => setInitiateLicenseKey(e.target.value)}
              margin="normal"
              required
              helperText="Enter the license key to transfer"
            />
            <TextField
              fullWidth
              label="Notes (Optional)"
              value={initiateNotes}
              onChange={(e) => setInitiateNotes(e.target.value)}
              margin="normal"
              multiline
              rows={3}
              helperText="Add any notes about this transfer"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setInitiateDialogOpen(false)} disabled={initiating}>
              Cancel
            </Button>
            <Button
              onClick={handleInitiateTransfer}
              variant="contained"
              disabled={initiating || !initiateLicenseKey.trim()}
            >
              {initiating ? <CircularProgress size={20} /> : 'Initiate Transfer'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Complete Transfer Dialog */}
        <Dialog open={completeDialogOpen} onClose={() => setCompleteDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Complete License Transfer</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Enter the transfer token and license key to complete the transfer on this device.
            </Alert>
            <TextField
              fullWidth
              label="Transfer Token"
              value={completeTransferToken}
              onChange={(e) => setCompleteTransferToken(e.target.value)}
              margin="normal"
              required
              helperText="Enter the transfer token from the source device"
            />
            <TextField
              fullWidth
              label="License Key"
              value={completeLicenseKey}
              onChange={(e) => setCompleteLicenseKey(e.target.value)}
              margin="normal"
              required
              helperText="Enter the license key being transferred"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCompleteDialogOpen(false)} disabled={completing}>
              Cancel
            </Button>
            <Button
              onClick={handleCompleteTransfer}
              variant="contained"
              disabled={completing || !completeTransferToken.trim() || !completeLicenseKey.trim()}
            >
              {completing ? <CircularProgress size={20} /> : 'Complete Transfer'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Cancel Transfer Dialog */}
        <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Cancel License Transfer</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Are you sure you want to cancel this transfer? This action cannot be undone.
            </Alert>
            <TextField
              fullWidth
              label="Cancellation Reason (Optional)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              margin="normal"
              multiline
              rows={3}
              helperText="Provide a reason for cancelling this transfer"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>
              No, Keep Transfer
            </Button>
            <Button
              onClick={handleCancelTransfer}
              variant="contained"
              color="error"
              disabled={cancelling}
            >
              {cancelling ? <CircularProgress size={20} /> : 'Yes, Cancel Transfer'}
            </Button>
          </DialogActions>
        </Dialog>

        <Toast toast={toast} onClose={hideToast} />
      </Box>
    </MainLayout>
  );
}

