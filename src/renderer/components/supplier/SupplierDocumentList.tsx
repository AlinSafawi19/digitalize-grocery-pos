import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Tooltip,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Download,
  Description,
  CalendarToday,
  Category,
  Warning,
} from '@mui/icons-material';
import { SupplierDocumentService, SupplierDocument, UpdateDocumentInput } from '../../services/supplier-document.service';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';

interface SupplierDocumentListProps {
  supplierId: number;
  userId: number;
  onDocumentChange?: () => void;
}

const SupplierDocumentList: React.FC<SupplierDocumentListProps> = ({
  supplierId,
  userId,
  onDocumentChange,
}) => {
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<SupplierDocument | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<SupplierDocument | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  // Form state
  const [formData, setFormData] = useState<UpdateDocumentInput>({
    category: '',
    description: '',
    expiryDate: null,
  });

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await SupplierDocumentService.getDocumentsBySupplierId(supplierId);
      if (result.success && result.documents) {
        setDocuments(result.documents);
      } else {
        showToast(result.error || 'Failed to load documents', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [supplierId, showToast]);

  const loadCategories = useCallback(async () => {
    try {
      const result = await SupplierDocumentService.getCategories();
      if (result.success && result.categories) {
        setCategories(result.categories);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
    loadCategories();
  }, [loadDocuments, loadCategories]);

  const handleUploadClick = async () => {
    try {
      // Show file selection dialog
      const selectResult = await SupplierDocumentService.showSelectDialog();
      if (!selectResult.success || selectResult.canceled || !selectResult.filePath) {
        return;
      }

      // Copy to temp location
      const copyResult = await SupplierDocumentService.copyToTemp(selectResult.filePath);
      if (!copyResult.success || !copyResult.tempPath) {
        showToast(copyResult.error || 'Failed to prepare file', 'error');
        return;
      }

      const fileName = selectResult.filePath.split(/[/\\]/).pop() || 'document';
      
      // Open upload form
      setFormData({
        category: 'other',
        description: '',
        expiryDate: null,
      });
      setEditingDocument(null);
      setFormOpen(true);
      
      // Store temp path for upload
      (window as typeof window & { __tempDocumentPath?: string; __tempDocumentFileName?: string }).__tempDocumentPath = copyResult.tempPath;
      (window as typeof window & { __tempDocumentPath?: string; __tempDocumentFileName?: string }).__tempDocumentFileName = fileName;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  };

  const handleOpenEditForm = (document: SupplierDocument) => {
    setEditingDocument(document);
    setFormData({
      category: document.category || '',
      description: document.description || '',
      expiryDate: document.expiryDate ? new Date(document.expiryDate) : null,
    });
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingDocument(null);
    setFormData({
      category: '',
      description: '',
      expiryDate: null,
    });
    delete (window as typeof window & { __tempDocumentPath?: string; __tempDocumentFileName?: string }).__tempDocumentPath;
    delete (window as typeof window & { __tempDocumentPath?: string; __tempDocumentFileName?: string }).__tempDocumentFileName;
  };

  const handleSubmit = async () => {
    try {
      if (editingDocument) {
        // Update existing document
        const result = await SupplierDocumentService.updateDocument(
          editingDocument.id,
          formData,
          userId
        );
        if (result.success) {
          showToast('Document updated successfully', 'success');
          handleCloseForm();
          loadDocuments();
          onDocumentChange?.();
        } else {
          showToast(result.error || 'Failed to update document', 'error');
        }
      } else {
        // Upload new document
        const tempPath = (window as typeof window & { __tempDocumentPath?: string; __tempDocumentFileName?: string }).__tempDocumentPath;
        const fileName = (window as typeof window & { __tempDocumentPath?: string; __tempDocumentFileName?: string }).__tempDocumentFileName;
        
        if (!tempPath || !fileName) {
          showToast('File not selected', 'error');
          return;
        }

        setUploading(true);
        const uploadInput = {
          supplierId,
          filePath: tempPath,
          fileName,
          category: formData.category || 'other',
          description: formData.description ?? undefined,
          expiryDate: formData.expiryDate ?? undefined,
        };

        const result = await SupplierDocumentService.uploadDocument(uploadInput, userId);
        if (result.success) {
          showToast('Document uploaded successfully', 'success');
          handleCloseForm();
          loadDocuments();
          onDocumentChange?.();
        } else {
          showToast(result.error || 'Failed to upload document', 'error');
        }
        setUploading(false);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
      setUploading(false);
    }
  };

  const handleDownload = async (document: SupplierDocument) => {
    try {
      const result = await SupplierDocumentService.getDocumentFilePath(document.id);
      if (result.success && result.filePath) {
        // Open file using Electron shell API
        if (window.electron?.shell?.openPath) {
          await window.electron.shell.openPath(result.filePath);
        } else if (window.electron?.shell?.showItemInFolder) {
          window.electron.shell.showItemInFolder(result.filePath);
        } else {
          showToast('File opened: ' + result.filePath, 'info');
        }
      } else {
        showToast(result.error || 'Failed to get document path', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  };

  const handleDeleteClick = (document: SupplierDocument) => {
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;

    try {
      const result = await SupplierDocumentService.deleteDocument(documentToDelete.id, userId);
      if (result.success) {
        showToast('Document deleted successfully', 'success');
        setDeleteDialogOpen(false);
        setDocumentToDelete(null);
        loadDocuments();
        onDocumentChange?.();
      } else {
        showToast(result.error || 'Failed to delete document', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  };

  const isExpired = (expiryDate: Date | null | undefined): boolean => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const isExpiringSoon = (expiryDate: Date | null | undefined): boolean => {
    if (!expiryDate) return false;
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiry = new Date(expiryDate);
    return expiry >= new Date() && expiry <= thirtyDaysFromNow;
  };

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Documents</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleUploadClick}
        >
          Upload Document
        </Button>
      </Box>

      {documents.length === 0 ? (
        <Alert severity="info">No documents found. Upload a document to get started.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>File Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Uploaded</TableCell>
                <TableCell>Expiry Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Description sx={{ fontSize: 20, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {document.fileName}
                        </Typography>
                        {document.description && (
                          <Typography variant="caption" color="text.secondary">
                            {document.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {document.category ? (
                      <Chip
                        label={document.category}
                        size="small"
                        icon={<Category sx={{ fontSize: 16 }} />}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatFileSize(document.size)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatDate(document.uploadedAt)}</Typography>
                  </TableCell>
                  <TableCell>
                    {document.expiryDate ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography
                          variant="body2"
                          color={isExpired(document.expiryDate) ? 'error' : isExpiringSoon(document.expiryDate) ? 'warning.main' : 'text.primary'}
                        >
                          {formatDate(document.expiryDate)}
                        </Typography>
                        {isExpired(document.expiryDate) && (
                          <Tooltip title="Expired">
                            <Warning sx={{ fontSize: 16, color: 'error.main' }} />
                          </Tooltip>
                        )}
                        {isExpiringSoon(document.expiryDate) && !isExpired(document.expiryDate) && (
                          <Tooltip title="Expiring soon">
                            <Warning sx={{ fontSize: 16, color: 'warning.main' }} />
                          </Tooltip>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        onClick={() => handleDownload(document)}
                        color="primary"
                      >
                        <Download />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEditForm(document)}
                        color="primary"
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(document)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Document Form Dialog */}
      <Dialog open={formOpen} onClose={handleCloseForm} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingDocument ? 'Edit Document' : 'Upload Document'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {editingDocument && (
              <TextField
                label="File Name"
                value={editingDocument.fileName}
                disabled
                fullWidth
              />
            )}
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                label="Category"
              >
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Description"
              multiline
              rows={3}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
            />
            <TextField
              label="Expiry Date"
              type="date"
              value={formData.expiryDate ? new Date(formData.expiryDate).toISOString().split('T')[0] : ''}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value ? new Date(e.target.value) : null })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm} disabled={uploading}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={uploading}>
            {uploading ? <CircularProgress size={20} /> : editingDocument ? 'Update' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Document</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {documentToDelete?.fileName}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SupplierDocumentList;

