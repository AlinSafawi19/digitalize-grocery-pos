import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Chip,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Paper,
} from '@mui/material';
import { ArrowBack, Block, Print } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { TransactionService, Transaction, TransactionItem, Payment } from '../../services/transaction.service';
import { ReceiptService } from '../../services/receipt.service';
import { ReceiptTemplateService } from '../../services/receipt-template.service';
import MainLayout from '../../components/layout/MainLayout';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { ROUTES } from '../../utils/constants';
import { formatDateTime } from '../../utils/dateUtils';
import { formatLBPCurrency } from '../../utils/currency';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

const TransactionDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { toast, showToast, hideToast } = useToast();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [reprintingReceipt, setReprintingReceipt] = useState(false);

  // Abort controller for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track request ID to handle race conditions
  const requestIdRef = useRef<number>(0);

  const loadTransaction = useCallback(async () => {
    if (!id || !userId) {
      setLoading(false);
      return;
    }

    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Increment request ID to track this specific request
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);

    try {
      const transactionId = parseInt(id, 10);
      if (isNaN(transactionId)) {
        showToast('Invalid transaction ID', 'error');
        setLoading(false);
        return;
      }

      const result = await TransactionService.getTransactionById(transactionId, userId);
      
      // Check if this request was cancelled or if a newer request was made
      if (abortController.signal.aborted || currentRequestId !== requestIdRef.current) {
        return;
      }

      if (result.success && result.transaction) {
        setTransaction(result.transaction);
      } else {
        showToast(result.error || 'Failed to load transaction', 'error');
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      // Check if this request is still current
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      // Only update loading state if this is still the current request
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [id, userId, showToast]);

  useEffect(() => {
    loadTransaction();

    // Cleanup function to cancel pending requests on unmount or when dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [loadTransaction]);

  // Memoize helper functions
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'voided':
        return 'error';
      default:
        return 'default';
    }
  }, []);

  const getTypeColor = useCallback((type: string) => {
    switch (type) {
      case 'sale':
        return 'primary';
      case 'return':
        return 'error';
      default:
        return 'default';
    }
  }, []);

  // Memoize event handlers
  const handleNavigateBack = useCallback(() => {
    navigate(ROUTES.TRANSACTIONS);
  }, [navigate]);

  const handleVoid = useCallback(() => {
    setVoidReason('');
    setVoidDialogOpen(true);
  }, []);

  const confirmVoid = useCallback(async () => {
    if (!transaction || !userId) return;

    setVoiding(true);
    try {
      const result = await TransactionService.voidTransaction(
        transaction.id,
        voidReason || undefined,
        userId
      );
      if (result.success) {
        setVoidDialogOpen(false);
        setVoidReason('');
        // Reload transaction to get updated status
        loadTransaction();
        showToast('Transaction voided successfully', 'success');
      } else {
        showToast(result.error || 'Failed to void transaction', 'error');
      }
    } catch {
      showToast('Failed to void transaction', 'error');
    } finally {
      setVoiding(false);
    }
  }, [transaction, voidReason, userId, loadTransaction, showToast]);

  const handleVoidDialogClose = useCallback(() => {
    setVoidDialogOpen(false);
    setVoidReason('');
  }, []);

  const handleVoidReasonChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVoidReason(e.target.value);
  }, []);

  const handleReprintReceipt = useCallback(async () => {
    if (!transaction || !userId) return;

    setReprintingReceipt(true);
    try {
      // Get printer name from receipt template
      const templateResult = await ReceiptTemplateService.getDefaultTemplate();
      let printerName: string | undefined = undefined;
      if (templateResult.success && templateResult.template) {
        try {
          const templateData = ReceiptTemplateService.parseTemplate(templateResult.template.template);
          printerName = templateData.printing?.printerName || undefined;
        } catch (error) {
          console.error('Failed to parse template for printer name:', error);
        }
      }

      const result = await ReceiptService.reprintReceipt(
        transaction.id,
        userId,
        printerName
      );

      if (result.success) {
        showToast('Receipt printed successfully', 'success');
      } else {
        showToast(result.error || 'Failed to print receipt', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to print receipt', 'error');
    } finally {
      setReprintingReceipt(false);
    }
  }, [transaction, userId, showToast]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  }), []);

  const containerBoxSx = useMemo(() => ({
    p: 2,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const backButtonSx = useMemo(() => ({
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

  const mainContainerBoxSx = useMemo(() => ({
    p: 3,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const paperSx = useMemo(() => ({
    padding: 0,
    width: '100%',
    border: '2px solid #c0c0c0',
    backgroundColor: '#ffffff',
    boxShadow: 'inset 1px 1px 0px 0px #ffffff, inset -1px -1px 0px 0px #808080',
  }), []);

  const titleBarBoxSx = useMemo(() => ({
    backgroundColor: '#1a237e',
    padding: '8px 12px',
    borderBottom: '1px solid #000051',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }), []);

  const backIconButtonSx = useMemo(() => ({
    padding: '4px',
    color: '#ffffff',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#ffffff',
    fontWeight: 600,
  }), []);

  const voidButtonSx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    color: '#ffffff',
    padding: '4px 8px',
    minWidth: 'auto',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
  }), []);

  const cardSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const sectionTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const dividerSx = useMemo(() => ({
    mb: 2,
    borderColor: '#e0e0e0',
  }), []);

  const labelTypographySx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const chipSx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const returnChipSx = useMemo(() => ({
    height: 20,
    fontSize: '10px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 700,
  }), []);

  const tableSx = useMemo(() => ({
    '& .MuiTableCell-root': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      borderColor: '#e0e0e0',
    },
    '& .MuiTableHead-root .MuiTableCell-root': {
      fontWeight: 600,
      backgroundColor: '#f5f5f5',
    },
    '& .MuiTableRow-root:hover': {
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const summaryBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    gap: 2,
    mb: 2,
  }), []);

  const summaryDividerSx = useMemo(() => ({
    my: 1,
    borderColor: '#e0e0e0',
  }), []);

  const totalTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const totalValueTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const captionTypographySx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const discountTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#2e7d32',
  }), []);

  if (loading) {
    return (
      <MainLayout>
        <Box sx={loadingBoxSx}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (!transaction) {
    return (
      <MainLayout>
        <Box sx={containerBoxSx}>
          <Button
            startIcon={<ArrowBack sx={{ fontSize: '18px' }} />}
            onClick={handleNavigateBack}
            sx={backButtonSx}
          >
            Back to Transactions
          </Button>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={mainContainerBoxSx}>
        <Paper elevation={0} sx={paperSx}>
          {/* Title Bar */}
          <Box sx={titleBarBoxSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={handleNavigateBack} sx={backIconButtonSx}>
                <ArrowBack sx={{ fontSize: '20px' }} />
            </IconButton>
              <Typography
                variant="h4"
                component="h1"
                fontWeight="bold"
                sx={titleTypographySx}
              >
              DigitalizePOS - Transaction Details
            </Typography>
          </Box>
          {transaction.status === 'completed' && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="text"
                startIcon={<Print sx={{ fontSize: '18px' }} />}
                onClick={handleReprintReceipt}
                disabled={reprintingReceipt}
                sx={voidButtonSx}
              >
                Reprint Receipt
              </Button>
              <Button
                variant="text"
                startIcon={<Block sx={{ fontSize: '18px' }} />}
                onClick={handleVoid}
                sx={voidButtonSx}
              >
                Void Transaction
              </Button>
            </Box>
          )}
        </Box>

          <Box sx={{ p: '24px' }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                  Transaction Information
                </Typography>
                <Divider sx={dividerSx} />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={labelTypographySx}>
                      Transaction Number
                    </Typography>
                    <Typography variant="body1" fontWeight="bold" sx={bodyTypographySx}>
                      {transaction.transactionNumber}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={labelTypographySx}>
                      Date
                    </Typography>
                    <Typography variant="body1" sx={bodyTypographySx}>
                      {formatDateTime(transaction.createdAt)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={labelTypographySx}>
                      Type
                    </Typography>
                    <Typography variant="body1">
                      <Chip
                        label={transaction.type.toUpperCase()}
                        size="small"
                        color={getTypeColor(transaction.type) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                        sx={chipSx}
                      />
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={labelTypographySx}>
                      Status
                    </Typography>
                    <Typography variant="body1">
                      <Chip
                        label={transaction.status.toUpperCase()}
                        size="small"
                        color={getStatusColor(transaction.status) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                        sx={chipSx}
                      />
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary" sx={labelTypographySx}>
                      Cashier
                    </Typography>
                    <Typography variant="body1" sx={bodyTypographySx}>
                      {transaction.cashier?.username || 'N/A'}
                    </Typography>
                  </Grid>
                  {transaction.notes && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary" sx={labelTypographySx}>
                        Notes
                      </Typography>
                      <Typography variant="body1" sx={bodyTypographySx} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {transaction.notes}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>

            <Card sx={[cardSx, { mt: 3 }]}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                  Items
                </Typography>
                <Divider sx={dividerSx} />
                <TableContainer>
                  <Table size="small" sx={tableSx}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Discount</TableCell>
                        <TableCell align="right">Tax</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transaction.items?.map((item: TransactionItem, index: number) => {
                        const isReturnItem = item.total < 0;
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={bodyTypographySx}>
                                {item.product?.name || item.productName || 'N/A'} ({item.product?.code || item.productCode || 'N/A'})
                                </Typography>
                                {isReturnItem && (
                                  <Chip
                                    label="RETURN"
                                    size="small"
                                    color="error"
                                    sx={returnChipSx}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={bodyTypographySx}>
                                {item.quantity}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={bodyTypographySx}>
                                ${item.unitPrice.toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={bodyTypographySx}>
                                ${item.discount.toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ color: isReturnItem ? '#d32f2f' : 'inherit' }}
                            >
                              <Typography variant="body2" sx={bodyTypographySx}>
                              ${item.tax.toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ color: isReturnItem ? '#d32f2f' : 'inherit', fontWeight: 'bold' }}
                            >
                              <Typography variant="body2" fontWeight="bold" sx={bodyTypographySx}>
                              ${item.total.toFixed(2)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {transaction.payments && transaction.payments.length > 0 && (
              <Card sx={[cardSx, { mt: 3 }]}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                    Payments
                  </Typography>
                  <Divider sx={dividerSx} />
                  {transaction.payments.map((payment: Payment, index: number) => (
                    <Box key={index} sx={{ mb: 1 }}>
                      <Typography variant="body2" sx={bodyTypographySx}>
                        Amount: ${payment.amount.toFixed(2)} | Received: ${payment.received.toFixed(2)}
                        {payment.change > 0 && ` | Change: $${payment.change.toFixed(2)}`}
                      </Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            )}
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                  Summary
                </Typography>
                <Divider sx={dividerSx} />
                <Box sx={summaryBoxSx}>
                  <Typography variant="body2" sx={bodyTypographySx}>
                    Subtotal:
                  </Typography>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={bodyTypographySx}>
                      ${transaction.subtotal.toFixed(2)}
                    </Typography>
                    {transaction.subtotalUsd !== undefined && transaction.subtotalLbp !== undefined && (
                      <Typography variant="caption" color="text.secondary" sx={captionTypographySx}>
                        {formatLBPCurrency({ usd: transaction.subtotalUsd, lbp: transaction.subtotalLbp })}
                      </Typography>
                    )}
                  </Box>
                </Box>
                {transaction.discount > 0 && (
                  <Box sx={summaryBoxSx}>
                    <Typography variant="body2" sx={discountTypographySx}>
                      Discount:
                    </Typography>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={discountTypographySx}>
                        -${transaction.discount.toFixed(2)}
                      </Typography>
                      {transaction.discountUsd !== undefined && transaction.discountLbp !== undefined && (
                        <Typography variant="caption" color="text.secondary" sx={captionTypographySx}>
                          -{formatLBPCurrency({ usd: transaction.discountUsd, lbp: transaction.discountLbp })}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                <Box sx={summaryBoxSx}>
                  <Typography variant="body2" sx={bodyTypographySx}>
                    Tax:
                  </Typography>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={bodyTypographySx}>
                      ${transaction.tax.toFixed(2)}
                    </Typography>
                    {transaction.taxUsd !== undefined && transaction.taxLbp !== undefined && (
                      <Typography variant="caption" color="text.secondary" sx={captionTypographySx}>
                        {formatLBPCurrency({ usd: transaction.taxUsd, lbp: transaction.taxLbp })}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Divider sx={summaryDividerSx} />
                <Box sx={summaryBoxSx}>
                  <Typography variant="h6" fontWeight="bold" sx={totalTitleTypographySx}>
                    Total:
                  </Typography>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h6" fontWeight="bold" sx={totalValueTypographySx}>
                      ${transaction.total.toFixed(2)}
                    </Typography>
                    {transaction.totalUsd !== undefined && transaction.totalLbp !== undefined && (
                      <Typography variant="caption" color="text.secondary" sx={captionTypographySx}>
                        {formatLBPCurrency({ usd: transaction.totalUsd, lbp: transaction.totalLbp })}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
          </Box>

        {/* Void Transaction Dialog */}
        <ConfirmDialog
          open={voidDialogOpen}
          title="Void Transaction"
          message={
            <Box>
              <Typography variant="body1" gutterBottom>
                Are you sure you want to void this transaction?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Transaction: {transaction?.transactionNumber}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Reason (optional)"
                value={voidReason}
                  onChange={handleVoidReasonChange}
                placeholder="Enter reason for voiding this transaction..."
              />
            </Box>
          }
          confirmLabel="Void"
          cancelLabel="Cancel"
          onConfirm={confirmVoid}
            onCancel={handleVoidDialogClose}
          confirmColor="error"
          loading={voiding}
        />
        </Paper>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default TransactionDetails;

