import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  Cancel,
  LocalShipping,
  HourglassEmpty,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { RootState } from '../../store';
import {
  StockTransferService,
  StockTransfer,
} from '../../services/stock-transfer.service';
import MainLayout from '../../components/layout/MainLayout';
import { formatDate } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { usePermission } from '../../hooks/usePermission';

const statusConfig = {
  pending: { color: 'warning' as const, label: 'Pending', icon: <HourglassEmpty /> },
  in_transit: { color: 'info' as const, label: 'In Transit', icon: <LocalShipping /> },
  completed: { color: 'success' as const, label: 'Completed', icon: <CheckCircle /> },
  cancelled: { color: 'error' as const, label: 'Cancelled', icon: <Cancel /> },
};

const StockTransferDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { showToast } = useToast();
  const canUpdate = usePermission('inventory.update');

  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [receivedQuantities, setReceivedQuantities] = useState<{ [itemId: number]: number }>({});

  const loadTransfer = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const result = await StockTransferService.getById(Number(id));
      if (result) {
        setTransfer(result);
        // Initialize received quantities with expected quantities
        const initialQuantities: { [itemId: number]: number } = {};
        result.items.forEach((item) => {
          initialQuantities[item.id] = item.quantity;
        });
        setReceivedQuantities(initialQuantities);
      } else {
        showToast('Stock transfer not found', 'error');
        navigate('/stock-transfers');
      }
    } catch (error) {
      console.error('Error loading stock transfer', error);
      showToast('Failed to load stock transfer', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, showToast]);

  useEffect(() => {
    loadTransfer();
  }, [loadTransfer]);

  const handleComplete = async () => {
    if (!transfer || !user?.id) return;

    setCompleting(true);
    try {
      const receivedItems = transfer.items.map((item) => ({
        itemId: item.id,
        receivedQuantity: receivedQuantities[item.id] || 0,
      }));

      const result = await StockTransferService.complete(transfer.id, receivedItems, user.id);
      if (result.success) {
        showToast('Stock transfer completed successfully', 'success');
        setCompleteDialogOpen(false);
        loadTransfer();
      } else {
        showToast(result.error || 'Failed to complete stock transfer', 'error');
      }
    } catch (error) {
      console.error('Error completing stock transfer', error);
      showToast('Failed to complete stock transfer', 'error');
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async () => {
    if (!transfer || !user?.id) return;

    if (!window.confirm('Are you sure you want to cancel this transfer?')) return;

    setCompleting(true);
    try {
      const result = await StockTransferService.cancel(transfer.id, user.id);
      if (result.success) {
        showToast('Stock transfer cancelled successfully', 'success');
        loadTransfer();
      } else {
        showToast(result.error || 'Failed to cancel stock transfer', 'error');
      }
    } catch (error) {
      console.error('Error cancelling stock transfer', error);
      showToast('Failed to cancel stock transfer', 'error');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (!transfer) {
    return (
      <MainLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">Stock transfer not found</Alert>
        </Box>
      </MainLayout>
    );
  }

  const status = statusConfig[transfer.status];
  const canComplete = transfer.status === 'pending' || transfer.status === 'in_transit';
  const canCancel = transfer.status === 'pending' || transfer.status === 'in_transit';

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/stock-transfers')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" fontWeight="bold">
            Stock Transfer Details
          </Typography>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Transfer Information</Typography>
                <Chip
                  icon={status.icon}
                  label={status.label}
                  color={status.color}
                  sx={{ fontSize: '13px', fontWeight: 500 }}
                />
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Transfer Number
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {transfer.transferNumber}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {status.label}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    From Location
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {transfer.fromLocation.name}
                    {transfer.fromLocation.code && ` (${transfer.fromLocation.code})`}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    To Location
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {transfer.toLocation.name}
                    {transfer.toLocation.code && ` (${transfer.toLocation.code})`}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Requested By
                  </Typography>
                  <Typography variant="body1">
                    {transfer.requester.username}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Requested Date
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(transfer.requestedAt)}
                  </Typography>
                </Grid>

                {transfer.completedAt && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Completed Date
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(transfer.completedAt)}
                    </Typography>
                  </Grid>
                )}

                {transfer.notes && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Notes
                    </Typography>
                    <Typography variant="body1">{transfer.notes}</Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" mb={2}>
                Transfer Items
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>Quantity</TableCell>
                      {transfer.status === 'completed' && <TableCell>Received</TableCell>}
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transfer.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {item.product.name}
                          </Typography>
                          {item.product.code && (
                            <Typography variant="caption" color="text.secondary">
                              Code: {item.product.code}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{item.quantity}</Typography>
                        </TableCell>
                        {transfer.status === 'completed' && (
                          <TableCell>
                            <Typography variant="body2" color={item.receivedQuantity === item.quantity ? 'success.main' : 'warning.main'}>
                              {item.receivedQuantity}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {item.notes || '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" mb={2}>
                Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {canComplete && canUpdate && (
                  <Button
                    variant="contained"
                    startIcon={<CheckCircle />}
                    onClick={() => setCompleteDialogOpen(true)}
                    fullWidth
                    sx={{ backgroundColor: '#1a237e', '&:hover': { backgroundColor: '#283593' } }}
                  >
                    Complete Transfer
                  </Button>
                )}
                {canCancel && canUpdate && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Cancel />}
                    onClick={handleCancel}
                    fullWidth
                    disabled={completing}
                  >
                    Cancel Transfer
                  </Button>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Complete Transfer Dialog */}
        <Dialog open={completeDialogOpen} onClose={() => setCompleteDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Complete Stock Transfer</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Enter the received quantities for each item. Adjust if the actual received quantity differs from the expected quantity.
            </Alert>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Expected</TableCell>
                    <TableCell>Received</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transfer.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product.name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={receivedQuantities[item.id] || 0}
                          onChange={(e) =>
                            setReceivedQuantities({
                              ...receivedQuantities,
                              [item.id]: parseFloat(e.target.value) || 0,
                            })
                          }
                          inputProps={{ min: 0, max: item.quantity, step: 0.01 }}
                          size="small"
                          fullWidth
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCompleteDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleComplete}
              variant="contained"
              disabled={completing}
              sx={{ backgroundColor: '#1a237e', '&:hover': { backgroundColor: '#283593' } }}
            >
              {completing ? <CircularProgress size={24} /> : 'Complete Transfer'}
            </Button>
          </DialogActions>
        </Dialog>

        <Toast />
      </Box>
    </MainLayout>
  );
};

export default StockTransferDetails;

