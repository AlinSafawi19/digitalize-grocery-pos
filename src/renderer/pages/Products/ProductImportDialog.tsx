import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  Warning,
} from '@mui/icons-material';
import { ProductImportExportService, ImportPreview } from '../../services/product-import-export.service';
import { useToast } from '../../hooks/useToast';

interface ProductImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  userId: number;
}

export default function ProductImportDialog({
  open,
  onClose,
  onImportComplete,
  userId,
}: ProductImportDialogProps) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const hasOpenedFileDialog = useRef(false);

  const handleSelectFile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await ProductImportExportService.showImportDialog();
      
      if (result.canceled) {
        setLoading(false);
        // Don't close dialog if user cancels - let them try again or close manually
        return;
      }

      if (!result.success || !result.filePath) {
        setError(result.error || 'Failed to select file');
        setLoading(false);
        return;
      }

      setFilePath(result.filePath);
      
      // Generate preview
      const previewResult = await ProductImportExportService.generateImportPreview(result.filePath);
      
      if (!previewResult.success || !previewResult.preview) {
        setError(previewResult.error || 'Failed to generate preview');
        setLoading(false);
        return;
      }

      setPreview(previewResult.preview);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      // Reset state when dialog opens
      setFilePath(null);
      setPreview(null);
      setLoading(false);
      setImporting(false);
      setImportProgress('');
      setError(null);
      hasOpenedFileDialog.current = false;
      
      // Auto-open file dialog only once when dialog first opens
      if (!hasOpenedFileDialog.current) {
        hasOpenedFileDialog.current = true;
        handleSelectFile();
      }
    } else {
      // Reset flag when dialog closes
      hasOpenedFileDialog.current = false;
    }
  }, [open, handleSelectFile]);

  const handleImport = async () => {
    if (!filePath || !preview || preview.summary.valid === 0) {
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setImportProgress('Starting import...');

      const result = await ProductImportExportService.importFromFile(
        filePath,
        userId,
        (progress) => {
          setImportProgress(progress.message);
        }
      );

      if (result.success) {
        showToast(
          `Import completed: ${result.successCount} succeeded, ${result.failedCount} failed`,
          'success'
        );
        onImportComplete();
        onClose();
      } else {
        const errorMsg = result.errors.length > 0 
          ? `Import failed: ${result.errors[0].error}` 
          : 'Import failed';
        setError(errorMsg);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setImporting(false);
      setImportProgress('');
    }
  };

  const handleClose = () => {
    if (!importing) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 0,
        },
      }}
    >
      <DialogTitle>
        <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
          Import Products
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Import products from a CSV or Excel file. Review the preview below before importing.
        </Typography>
      </DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Loading file...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {importing && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {importProgress}
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {preview && !loading && (
          <Box>
            {/* Summary */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Import Summary
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={`Total Rows: ${preview.summary.total}`}
                  color="default"
                  variant="outlined"
                />
                <Chip
                  label={`Valid: ${preview.summary.valid}`}
                  color="success"
                  icon={<CheckCircle />}
                />
                <Chip
                  label={`Invalid: ${preview.summary.invalid}`}
                  color="error"
                  icon={<ErrorIcon />}
                />
              </Box>
            </Box>

            {/* Errors */}
            {preview.errors.length > 0 && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Validation Errors ({preview.errors.length})
                </Typography>
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {preview.errors.map((err, idx) => (
                    <Typography key={idx} variant="body2" sx={{ mb: 0.5 }}>
                      Row {err.row}: {err.error}
                    </Typography>
                  ))}
                </Box>
              </Alert>
            )}

            {/* Preview Table */}
            {preview.products.length > 0 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Preview ({preview.products.length} products)
                </Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Row</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Barcode</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Supplier</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Price</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Quantity</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Reorder Level</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preview.products.slice(0, 50).map((item, idx) => {
                        const supplierId = (item.data as Record<string, unknown>).supplierId as number | null | undefined;
                        return (
                        <TableRow key={idx}>
                          <TableCell>{item.row}</TableCell>
                          <TableCell>{item.data.barcode || '-'}</TableCell>
                          <TableCell>{item.data.name}</TableCell>
                          <TableCell>{item.data.categoryId ? `ID: ${item.data.categoryId}` : '-'}</TableCell>
                          <TableCell>{supplierId ? `ID: ${supplierId}` : '-'}</TableCell>
                          <TableCell align="right">{item.data.price.toFixed(2)} {item.data.currency}</TableCell>
                          <TableCell>{item.data.unit}</TableCell>
                          <TableCell align="right">{item.data.quantity ?? 0}</TableCell>
                          <TableCell align="right">{item.data.reorderLevel ?? 0}</TableCell>
                          <TableCell>
                            {item.warnings.length > 0 ? (
                              <Chip
                                label="Warning"
                                color="warning"
                                size="small"
                                icon={<Warning />}
                              />
                            ) : (
                              <Chip
                                label="Valid"
                                color="success"
                                size="small"
                                icon={<CheckCircle />}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                {preview.products.length > 50 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Showing first 50 products. Total: {preview.products.length}
                  </Typography>
                )}
              </Box>
            )}

            {preview.summary.valid === 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                No valid products to import. Please fix the errors and try again.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={handleClose} disabled={importing}>
          Cancel
        </Button>
        <Button
          onClick={handleSelectFile}
          disabled={importing}
          variant="outlined"
        >
          Select Different File
        </Button>
        <Button
          onClick={handleImport}
          disabled={!preview || preview.summary.valid === 0 || importing}
          variant="contained"
          color="primary"
        >
          {importing ? 'Importing...' : `Import ${preview?.summary.valid || 0} Products`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

