import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  MenuItem,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { SupplierPaymentService, CreateSupplierPaymentInput } from '../../services/supplier-payment.service';
import { Supplier } from '../../services/product.service';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { useToast } from '../../hooks/useToast';

interface SupplierPaymentFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplier: Supplier | null;
  invoiceId?: number | null;
  userId: number;
}

export default function SupplierPaymentForm({
  open,
  onClose,
  onSuccess,
  supplier,
  invoiceId,
  userId,
}: SupplierPaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [formData, setFormData] = useState<CreateSupplierPaymentInput>({
    supplierId: supplier?.id || 0,
    purchaseInvoiceId: invoiceId || null,
    amount: 0,
    currency: 'USD',
    paymentDate: new Date(),
    paymentMethod: 'cash',
    referenceNumber: null,
    notes: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  useEffect(() => {
    if (open && supplier) {
      setFormData({
        supplierId: supplier.id,
        purchaseInvoiceId: invoiceId || null,
        amount: 0,
        currency: 'USD',
        paymentDate: new Date(),
        paymentMethod: 'cash',
        referenceNumber: null,
        notes: null,
      });
      setErrors({});
      loadInvoices();
    }
  }, [open, supplier, invoiceId]);

  const loadInvoices = async () => {
    if (!supplier) return;
    setLoadingInvoices(true);
    try {
      // Get purchase orders for this supplier and their invoices
      const result = await PurchaseOrderService.getPurchaseOrders({
        supplierId: supplier.id,
        page: 1,
        pageSize: 100,
      }, userId);
      if (result.success && result.purchaseOrders) {
        // Extract invoices from purchase orders
        const allInvoices: any[] = [];
        for (const po of result.purchaseOrders) {
          if (po.invoices) {
            allInvoices.push(...po.invoices);
          }
        }
        setInvoices(allInvoices);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleChange = (field: keyof CreateSupplierPaymentInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.supplierId || formData.supplierId <= 0) {
      newErrors.supplierId = 'Supplier is required';
    }
    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!formData.paymentDate) {
      newErrors.paymentDate = 'Payment date is required';
    }
    if (!formData.paymentMethod) {
      newErrors.paymentMethod = 'Payment method is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const result = await SupplierPaymentService.createPayment(formData, userId);
      if (result.success) {
        showToast('Payment recorded successfully', 'success');
        onSuccess();
        onClose();
      } else {
        showToast(result.error || 'Failed to record payment', 'error');
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'An error occurred',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 0,
        },
      }}
    >
      <DialogTitle>
        <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
          Record Supplier Payment
        </Typography>
        {supplier && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Supplier: {supplier.name}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <FormControl fullWidth error={!!errors.purchaseInvoiceId}>
            <InputLabel>Invoice (Optional)</InputLabel>
            <Select
              value={formData.purchaseInvoiceId || ''}
              onChange={(e) =>
                handleChange('purchaseInvoiceId', e.target.value || null)
              }
              disabled={loading || loadingInvoices}
              label="Invoice (Optional)"
            >
              <MenuItem value="">None (General Payment)</MenuItem>
              {invoices.map((invoice) => (
                <MenuItem key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} - {invoice.amount.toFixed(2)} {invoice.purchaseOrder?.currency || 'USD'} 
                  {invoice.status !== 'paid' && ` (${invoice.status})`}
                </MenuItem>
              ))}
            </Select>
            {errors.purchaseInvoiceId && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {errors.purchaseInvoiceId}
              </Typography>
            )}
          </FormControl>

          <TextField
            label="Amount *"
            type="number"
            value={formData.amount || ''}
            onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
            error={!!errors.amount}
            helperText={errors.amount || 'Enter the payment amount'}
            fullWidth
            disabled={loading}
            inputProps={{ min: 0, step: 0.01 }}
          />

          <FormControl fullWidth>
            <InputLabel>Currency</InputLabel>
            <Select
              value={formData.currency || 'USD'}
              onChange={(e) => handleChange('currency', e.target.value)}
              disabled={loading}
              label="Currency"
            >
              <MenuItem value="USD">USD</MenuItem>
              <MenuItem value="LBP">LBP</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Payment Date *"
            type="date"
            value={formData.paymentDate ? (formData.paymentDate instanceof Date ? formData.paymentDate.toISOString().split('T')[0] : new Date(formData.paymentDate).toISOString().split('T')[0]) : ''}
            onChange={(e) => handleChange('paymentDate', e.target.value ? new Date(e.target.value) : new Date())}
            error={!!errors.paymentDate}
            helperText={errors.paymentDate}
            fullWidth
            disabled={loading}
            InputLabelProps={{ shrink: true }}
          />

          <FormControl fullWidth error={!!errors.paymentMethod}>
            <InputLabel>Payment Method *</InputLabel>
            <Select
              value={formData.paymentMethod}
              onChange={(e) => handleChange('paymentMethod', e.target.value)}
              disabled={loading}
              label="Payment Method *"
            >
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
              <MenuItem value="check">Check</MenuItem>
              <MenuItem value="credit_card">Credit Card</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
            {errors.paymentMethod && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {errors.paymentMethod}
              </Typography>
            )}
          </FormControl>

          <TextField
            label="Reference Number"
            value={formData.referenceNumber || ''}
            onChange={(e) => handleChange('referenceNumber', e.target.value || null)}
            helperText="Check number, transaction ID, etc."
            fullWidth
            disabled={loading}
          />

          <TextField
            label="Notes"
            value={formData.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value || null)}
            multiline
            rows={3}
            fullWidth
            disabled={loading}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={loading || !supplier}
        >
          {loading ? <CircularProgress size={20} /> : 'Record Payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

