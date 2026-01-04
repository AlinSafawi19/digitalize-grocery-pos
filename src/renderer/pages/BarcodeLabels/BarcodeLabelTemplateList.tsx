import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  IconButton,
  Typography,
  CircularProgress,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Refresh,
  Star,
  StarBorder,
} from '@mui/icons-material';
import {
  BarcodeLabelService,
  BarcodeLabelTemplate,
} from '../../services/barcode-label.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { usePermission } from '../../hooks/usePermission';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';

const BarcodeLabelTemplateList: React.FC = () => {
  const { toast, showToast, hideToast } = useToast();
  const navigate = useNavigate();
  const canManage = usePermission('barcode.manage');

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<BarcodeLabelTemplate[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<BarcodeLabelTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const result = await BarcodeLabelService.getTemplates({
        page: page + 1,
        pageSize,
      });

      if (result.success && result.data) {
        setTemplates(result.data);
        setTotal(result.pagination?.total || 0);
      } else {
        showToast(result.error || 'Failed to load templates', 'error');
      }
    } catch {
      showToast('An error occurred while loading templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, showToast]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleAdd = useCallback(() => {
    navigate(ROUTES.BARCODE_LABELS_NEW);
  }, [navigate]);

  const handleEdit = useCallback((template: BarcodeLabelTemplate) => {
    navigate(`${ROUTES.BARCODE_LABELS_EDIT.replace(':id', template.id.toString())}`);
  }, [navigate]);

  const handleDelete = useCallback((template: BarcodeLabelTemplate) => {
    setDeletingTemplate(template);
    setDeleteDialogOpen(true);
  }, []);

  const handleSetDefault = useCallback(async (template: BarcodeLabelTemplate) => {
    try {
      const result = await BarcodeLabelService.setDefaultTemplate(template.id);
      if (result.success) {
        showToast('Default template updated', 'success');
        loadTemplates();
      } else {
        showToast(result.error || 'Failed to set default template', 'error');
      }
    } catch {
      showToast('An error occurred while setting default template', 'error');
    }
  }, [showToast, loadTemplates]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingTemplate) return;

    try {
      const result = await BarcodeLabelService.deleteTemplate(deletingTemplate.id);
      if (result.success) {
        showToast('Template deleted successfully', 'success');
        setDeleteDialogOpen(false);
        setDeletingTemplate(null);
        loadTemplates();
      } else {
        showToast(result.error || 'Failed to delete template', 'error');
      }
    } catch {
      showToast('An error occurred while deleting template', 'error');
    }
  }, [deletingTemplate, showToast, loadTemplates]);

  const handlePageChange = useCallback((_event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const containerBoxSx = useMemo(() => ({
    p: 3,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const headerBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 3,
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  if (!canManage) {
    return (
      <MainLayout>
        <Box sx={containerBoxSx}>
          <Typography>You don&apos;t have permission to manage barcode label templates.</Typography>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography sx={titleTypographySx}>Barcode Label Templates</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadTemplates}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAdd}
            >
              Add Template
            </Button>
          </Box>
        </Box>

        <Paper>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Default</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {templates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography>No templates found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      templates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <Typography>{template.name}</Typography>
                            {template.description && (
                              <Typography variant="caption" color="text.secondary">
                                {template.description}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {template.width}&quot; × {template.height}&quot;
                          </TableCell>
                          <TableCell>
                            {template.isActive ? (
                              <Chip label="Active" color="success" size="small" />
                            ) : (
                              <Chip label="Inactive" color="default" size="small" />
                            )}
                          </TableCell>
                          <TableCell>
                            {template.isDefault ? (
                              <Chip icon={<Star />} label="Default" color="primary" size="small" />
                            ) : (
                              <IconButton
                                size="small"
                                onClick={() => handleSetDefault(template)}
                                title="Set as Default"
                              >
                                <StarBorder />
                              </IconButton>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton onClick={() => handleEdit(template)} size="small">
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton onClick={() => handleDelete(template)} size="small" color="error">
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={total}
                page={page}
                onPageChange={handlePageChange}
                rowsPerPage={pageSize}
                onRowsPerPageChange={handlePageSizeChange}
                rowsPerPageOptions={[10, 25, 50]}
              />
            </>
          )}
        </Paper>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          title="Delete Template"
          message={`Are you sure you want to delete "${deletingTemplate?.name}"? This action cannot be undone.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setDeleteDialogOpen(false);
            setDeletingTemplate(null);
          }}
        />

        <Toast toast={toast} onClose={hideToast} />
      </Box>
    </MainLayout>
  );
};

export default BarcodeLabelTemplateList;

