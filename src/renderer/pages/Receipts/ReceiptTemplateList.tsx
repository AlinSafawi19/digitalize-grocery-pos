import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  CircularProgress,
  Alert,
  Tooltip,
  TablePagination,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Star,
  StarBorder,
  Visibility,
  ContentCopy,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ReceiptTemplateService, ReceiptTemplate } from '../../services/receipt-template.service';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import MainLayout from '../../components/layout/MainLayout';
import { formatDate } from '../../utils/formatters';

const ReceiptTemplateList: React.FC = () => {
  const navigate = useNavigate();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { toast, showToast, hideToast } = useToast();

  const [templates, setTemplates] = useState<ReceiptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<ReceiptTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ReceiptTemplateService.getTemplates({
        page: page + 1,
        pageSize,
      });
      if (result.success && result.templates) {
        setTemplates(result.templates);
        setTotal(result.pagination?.totalItems || 0);
      } else {
        showToast(result.error || 'Failed to load templates', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, showToast]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleSetDefault = async (templateId: number) => {
    if (!userId) return;

    try {
      const result = await ReceiptTemplateService.setDefaultTemplate(templateId, userId);
      if (result.success) {
        showToast('Default template updated', 'success');
        loadTemplates();
      } else {
        showToast(result.error || 'Failed to set default template', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  };

  const handleDeleteClick = (template: ReceiptTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete || !userId) return;

    try {
      const result = await ReceiptTemplateService.deleteTemplate(templateToDelete.id, userId);
      if (result.success) {
        showToast('Template deleted successfully', 'success');
        setDeleteDialogOpen(false);
        setTemplateToDelete(null);
        loadTemplates();
      } else {
        showToast(result.error || 'Failed to delete template', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  };

  const handleDuplicate = async (template: ReceiptTemplate) => {
    if (!userId) return;

    try {
      const templateData = ReceiptTemplateService.parseTemplate(template.template);
      const result = await ReceiptTemplateService.createTemplate({
        name: `${template.name} (Copy)`,
        description: template.description || undefined,
        template: templateData,
        isDefault: false,
        isActive: template.isActive,
      }, userId);

      if (result.success) {
        showToast('Template duplicated successfully', 'success');
        loadTemplates();
      } else {
        showToast(result.error || 'Failed to duplicate template', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Receipt Templates
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/receipts/templates/new')}
          >
            New Template
          </Button>
        </Box>

        {templates.length === 0 ? (
          <Alert severity="info">
            No templates found. Create a new template to get started.
          </Alert>
        ) : (
          <>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Default</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight="medium">
                            {template.name}
                          </Typography>
                          {template.isDefault && (
                            <Chip
                              label="Default"
                              size="small"
                              color="primary"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {template.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={template.isActive ? 'Active' : 'Inactive'}
                          size="small"
                          color={template.isActive ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={template.isDefault ? 'Default template' : 'Set as default'}>
                          <IconButton
                            size="small"
                            onClick={() => handleSetDefault(template.id)}
                            color={template.isDefault ? 'primary' : 'default'}
                          >
                            {template.isDefault ? <Star /> : <StarBorder />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatDate(template.createdAt)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Preview">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/receipts/templates/${template.id}/preview`)}
                            color="primary"
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/receipts/templates/${template.id}/edit`)}
                            color="primary"
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Duplicate">
                          <IconButton
                            size="small"
                            onClick={() => handleDuplicate(template)}
                            color="primary"
                          >
                            <ContentCopy />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(template)}
                            color="error"
                            disabled={template.isDefault}
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
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={pageSize}
              onRowsPerPageChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </>
        )}
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {templateToDelete?.name}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default ReceiptTemplateList;

