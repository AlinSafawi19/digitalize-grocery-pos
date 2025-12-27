import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Warning,
  Payment,
  Refresh,
  Visibility,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { SupplierPaymentService, PaymentReminder } from '../../services/supplier-payment.service';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/currency';
import SupplierPaymentForm from './SupplierPaymentForm';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface PaymentRemindersProps {
  daysOverdue?: number;
  showActions?: boolean;
  maxItems?: number;
}

export default function PaymentReminders({
  daysOverdue,
  showActions = true,
  maxItems,
}: PaymentRemindersProps) {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { showToast } = useToast();
  const [reminders, setReminders] = useState<PaymentReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);

  const loadReminders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await SupplierPaymentService.getPaymentReminders(daysOverdue);
      if (result.success && result.reminders) {
        let remindersList = result.reminders;
        if (maxItems) {
          remindersList = remindersList.slice(0, maxItems);
        }
        setReminders(remindersList);
      } else {
        showToast(result.error || 'Failed to load payment reminders', 'error');
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'An error occurred',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [daysOverdue, maxItems, showToast]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const handleRecordPayment = useCallback((supplierId: number, invoiceId: number) => {
    setSelectedSupplierId(supplierId);
    setSelectedInvoiceId(invoiceId);
    setPaymentFormOpen(true);
  }, []);

  const handlePaymentSuccess = useCallback(() => {
    loadReminders();
    setPaymentFormOpen(false);
    setSelectedInvoiceId(null);
    setSelectedSupplierId(null);
  }, [loadReminders]);

  const handleViewSupplier = useCallback((supplierId: number) => {
    navigate(`/suppliers/${supplierId}`);
  }, [navigate]);

  const getDaysOverdueColor = (days: number): 'error' | 'warning' | 'info' => {
    if (days > 30) return 'error';
    if (days > 14) return 'warning';
    return 'info';
  };

  const getDaysOverdueLabel = (days: number): string => {
    if (days === 1) return '1 day overdue';
    return `${days} days overdue`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (reminders.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Warning sx={{ color: '#ed6c02' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Payment Reminders
            </Typography>
            {showActions && (
              <IconButton size="small" onClick={loadReminders} sx={{ ml: 'auto' }}>
                <Refresh />
              </IconButton>
            )}
          </Box>
          <Alert severity="success">
            No overdue invoices. All payments are up to date!
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const totalOverdue = reminders.reduce((sum, r) => sum + r.outstandingAmount, 0);

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning sx={{ color: '#d32f2f' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Payment Reminders
            </Typography>
            <Chip
              label={`${reminders.length} Overdue`}
              color="error"
              size="small"
            />
          </Box>
          {showActions && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton size="small" onClick={loadReminders}>
                <Refresh />
              </IconButton>
            </Box>
          )}
        </Box>

        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight="medium">
            Total Overdue Amount: {formatCurrency(totalOverdue)}
          </Typography>
        </Alert>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Supplier</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Invoice</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Outstanding</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Due Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                {showActions && <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {reminders.map((reminder) => (
                <TableRow key={`${reminder.supplierId}-${reminder.invoiceId}`} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {reminder.supplierName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {reminder.invoiceNumber}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {formatCurrency(reminder.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, color: '#d32f2f' }}
                    >
                      {formatCurrency(reminder.outstandingAmount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(reminder.dueDate)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getDaysOverdueLabel(reminder.daysOverdue)}
                      color={getDaysOverdueColor(reminder.daysOverdue)}
                      size="small"
                    />
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Record Payment">
                          <IconButton
                            size="small"
                            onClick={() =>
                              handleRecordPayment(reminder.supplierId, reminder.invoiceId)
                            }
                            sx={{ color: '#2e7d32' }}
                          >
                            <Payment fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Supplier">
                          <IconButton
                            size="small"
                            onClick={() => handleViewSupplier(reminder.supplierId)}
                            sx={{ color: '#1a237e' }}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {maxItems && reminders.length >= maxItems && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/suppliers?tab=reminders')}
              size="small"
            >
              View All Reminders
            </Button>
          </Box>
        )}
      </CardContent>

      <SupplierPaymentForm
        open={paymentFormOpen}
        onClose={() => {
          setPaymentFormOpen(false);
          setSelectedInvoiceId(null);
          setSelectedSupplierId(null);
        }}
        onSuccess={handlePaymentSuccess}
        supplier={selectedSupplierId ? { id: selectedSupplierId } as any : null}
        invoiceId={selectedInvoiceId}
        userId={user?.id || 0}
      />
    </Card>
  );
}

