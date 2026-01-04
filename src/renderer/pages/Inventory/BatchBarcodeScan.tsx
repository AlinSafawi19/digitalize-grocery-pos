import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  LinearProgress,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  QrCodeScanner,
  Delete,
  CheckCircle,
  Error,
  Warning,
  FileDownload,
  Refresh,
  PlayArrow,
  Stop,
  ContentCopy,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  BatchBarcodeScanService,
  BatchScanResult,
  BatchScanOptions,
} from '../../services/batch-barcode-scan.service';
import { useToast } from '../../hooks/useToast';
import MainLayout from '../../components/layout/MainLayout';
import { formatDateTime } from '../../utils/dateUtils';
import { ROUTES } from '../../utils/constants';
import { useNavigate } from 'react-router-dom';

type ScanOperation = 'inventory_count' | 'stock_adjustment' | 'product_lookup' | 'bulk_import';

export default function BatchBarcodeScan() {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { showToast } = useToast();

  const [operation, setOperation] = useState<ScanOperation>('product_lookup');
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [autoValidate, setAutoValidate] = useState(true);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<BatchScanResult | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper function to get error message
  const getErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof Error) {
      return (error as Error).message;
    }
    return 'An error occurred';
  }, []);

  // Auto-focus input when component mounts or scanning starts
  useEffect(() => {
    if (isScanning && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isScanning]);

  // Refresh batch result periodically
  useEffect(() => {
    if (!batchId || !isScanning) return;

    const interval = setInterval(async () => {
      const result = await BatchBarcodeScanService.getBatchResult(batchId);
      if (result.success && result.result) {
        setBatchResult(result.result);
      }
    }, 500); // Refresh every 500ms

    return () => clearInterval(interval);
  }, [batchId, isScanning]);

  const startScanning = useCallback(async () => {
    if (!user?.id) {
      showToast('User not authenticated', 'error');
      return;
    }

    setLoading(true);
    try {
      const options: BatchScanOptions = {
        operation,
        allowDuplicates,
        autoValidate,
      };

      const result = await BatchBarcodeScanService.startBatch(options);
      if (result.success && result.batchId) {
        setBatchId(result.batchId);
        setIsScanning(true);
        setBatchResult(null);
        setBarcodeInput('');
        showToast('Batch scanning started', 'success');
        // Focus input after a short delay
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      } else {
        showToast(result.error || 'Failed to start batch scan', 'error');
      }
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.id, operation, allowDuplicates, autoValidate, showToast, getErrorMessage]);

  const stopScanning = useCallback(async () => {
    if (!batchId) return;

    setLoading(true);
    try {
      const result = await BatchBarcodeScanService.completeBatch(batchId);
      if (result.success && result.result) {
        setBatchResult(result.result);
        setIsScanning(false);
        showToast('Batch scanning completed', 'success');
      } else {
        showToast(result.error || 'Failed to complete batch scan', 'error');
      }
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [batchId, showToast, getErrorMessage]);

  const cancelScanning = useCallback(async () => {
    if (!batchId) return;

    setLoading(true);
    try {
      const result = await BatchBarcodeScanService.cancelBatch(batchId);
      if (result.success) {
        setBatchId(null);
        setBatchResult(null);
        setIsScanning(false);
        setBarcodeInput('');
        showToast('Batch scanning cancelled', 'info');
      } else {
        showToast(result.error || 'Failed to cancel batch scan', 'error');
      }
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [batchId, showToast, getErrorMessage]);

  const handleBarcodeSubmit = useCallback(
    async (barcode: string) => {
      if (!barcode.trim() || !batchId || !user?.id || !isScanning) return;

      try {
        const options: BatchScanOptions = {
          operation,
          allowDuplicates,
          autoValidate,
        };

        const result = await BatchBarcodeScanService.scanBarcode(
          batchId,
          barcode.trim(),
          options,
          user.id
        );

        if (result.success && result.item) {
          // Refresh batch result
          const batchResult = await BatchBarcodeScanService.getBatchResult(batchId);
          if (batchResult.success && batchResult.result) {
            setBatchResult(batchResult.result);
          }

          // Clear input and focus for next scan
          setBarcodeInput('');
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus();
            }
          }, 50);

          // Show feedback based on status
          if (result.item.status === 'success') {
            // Success feedback is shown via the table update
          } else if (result.item.status === 'duplicate') {
            showToast('Barcode already scanned', 'warning');
          } else if (result.item.status === 'error') {
            showToast(result.item.error || 'Scan failed', 'error');
          }
        } else {
          showToast(result.error || 'Failed to scan barcode', 'error');
        }
      } catch (error: unknown) {
        showToast(getErrorMessage(error), 'error');
      }
    },
    [batchId, user?.id, isScanning, operation, allowDuplicates, autoValidate, showToast, getErrorMessage]
  );

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && barcodeInput.trim()) {
        handleBarcodeSubmit(barcodeInput);
      }
    },
    [barcodeInput, handleBarcodeSubmit]
  );

  const handleRemoveItem = useCallback(
    async (barcode: string) => {
      if (!batchId) return;

      try {
        const result = await BatchBarcodeScanService.removeItem(batchId, barcode);
        if (result.success) {
          // Refresh batch result
          const batchResult = await BatchBarcodeScanService.getBatchResult(batchId);
          if (batchResult.success && batchResult.result) {
            setBatchResult(batchResult.result);
          }
          showToast('Item removed', 'success');
        } else {
          showToast(result.error || 'Failed to remove item', 'error');
        }
      } catch (error: unknown) {
        showToast(getErrorMessage(error), 'error');
      }
    },
    [batchId, showToast, getErrorMessage]
  );

  const handleExportCSV = useCallback(async () => {
    if (!batchId) return;

    try {
      const result = await BatchBarcodeScanService.exportToCSV(batchId);
      if (result.success && result.csv) {
        setCsvData(result.csv);
        setExportDialogOpen(true);
      } else {
        showToast(result.error || 'Failed to export CSV', 'error');
      }
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    }
  }, [batchId, showToast, getErrorMessage]);

  const handleCopyCSV = useCallback(() => {
    navigator.clipboard.writeText(csvData);
    showToast('CSV data copied to clipboard', 'success');
  }, [csvData, showToast]);

  const handleDownloadCSV = useCallback(() => {
    if (!csvData || !batchResult) return;

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_scan_${batchResult.id}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV file downloaded', 'success');
  }, [csvData, batchResult, showToast]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'duplicate':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string): React.ReactElement | undefined => {
    switch (status) {
      case 'success':
        return <CheckCircle fontSize="small" />;
      case 'error':
        return <Error fontSize="small" />;
      case 'duplicate':
        return <Warning fontSize="small" />;
      default:
        return undefined;
    }
  };

  const containerBoxSx = useMemo(
    () => ({
      p: 3,
      backgroundColor: '#f5f5f5',
      minHeight: '100vh',
    }),
    []
  );

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            Batch Barcode Scanning
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate(ROUTES.INVENTORY)}
            sx={{ textTransform: 'none' }}
          >
            Back to Inventory
          </Button>
        </Box>

        {/* Configuration */}
        {!isScanning && (
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Scan Configuration
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="operation-select-label">Operation</InputLabel>
                  <Select
                    labelId="operation-select-label"
                    value={operation}
                    label="Operation"
                    onChange={(e) => setOperation(e.target.value as ScanOperation)}
                  >
                    <MenuItem value="product_lookup">Product Lookup</MenuItem>
                    <MenuItem value="inventory_count">Inventory Count</MenuItem>
                    <MenuItem value="stock_adjustment">Stock Adjustment</MenuItem>
                    <MenuItem value="bulk_import">Bulk Import</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={allowDuplicates}
                        onChange={(e) => setAllowDuplicates(e.target.checked)}
                      />
                    }
                    label="Allow Duplicate Barcodes"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={autoValidate}
                        onChange={(e) => setAutoValidate(e.target.checked)}
                      />
                    }
                    label="Auto-Validate Barcodes"
                  />
                </Box>
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={startScanning}
                disabled={loading}
                sx={{
                  backgroundColor: '#1a237e',
                  '&:hover': { backgroundColor: '#534bae' },
                }}
              >
                Start Scanning
              </Button>
            </Box>
          </Paper>
        )}

        {/* Scanning Interface */}
        {isScanning && (
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Scanning in Progress</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Stop />}
                  onClick={stopScanning}
                  disabled={loading}
                >
                  Complete
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={cancelScanning}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
            <TextField
              fullWidth
              inputRef={inputRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Scan or type barcode and press Enter..."
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <QrCodeScanner />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            {batchResult && (
              <Box>
                <LinearProgress
                  variant="determinate"
                  value={
                    batchResult.totalScanned > 0
                      ? (batchResult.successful / batchResult.totalScanned) * 100
                      : 0
                  }
                  sx={{ mb: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Success Rate: {batchResult.totalScanned > 0
                    ? ((batchResult.successful / batchResult.totalScanned) * 100).toFixed(1)
                    : 0}%
                </Typography>
              </Box>
            )}
          </Paper>
        )}

        {/* Summary Cards */}
        {batchResult && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Scanned
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {batchResult.totalScanned}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Successful
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {batchResult.successful}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Failed
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="error.main">
                    {batchResult.failed}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Duplicates
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {batchResult.duplicates}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Scanned Items Table */}
        {batchResult && batchResult.items.length > 0 && (
          <Paper>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Scanned Items</Typography>
              {!isScanning && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<FileDownload />}
                    onClick={handleExportCSV}
                  >
                    Export CSV
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={startScanning}
                  >
                    New Scan
                  </Button>
                </Box>
              )}
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Barcode</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Product Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Quantity</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Error</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                    {isScanning && <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batchResult.items.map((item, index) => (
                    <TableRow key={`${item.barcode}-${index}`} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {item.barcode}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {item.productName || '-'}
                      </TableCell>
                      <TableCell>
                        {item.quantity || 1}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(item.status)}
                          label={item.status.toUpperCase()}
                          color={getStatusColor(item.status) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {item.error && (
                          <Typography variant="body2" color="error" sx={{ maxWidth: 200 }}>
                            {item.error}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(item.timestamp)}
                        </Typography>
                      </TableCell>
                      {isScanning && (
                        <TableCell>
                          <Tooltip title="Remove Item">
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveItem(item.barcode)}
                              color="error"
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* Empty State */}
        {batchResult && batchResult.items.length === 0 && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <QrCodeScanner sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No items scanned yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start scanning barcodes to see them appear here
            </Typography>
          </Paper>
        )}

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Export Scan Results</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              multiline
              rows={10}
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              sx={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExportDialogOpen(false)}>Close</Button>
            <Button startIcon={<ContentCopy />} onClick={handleCopyCSV}>
              Copy
            </Button>
            <Button startIcon={<FileDownload />} onClick={handleDownloadCSV} variant="contained">
              Download
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </MainLayout>
  );
}

