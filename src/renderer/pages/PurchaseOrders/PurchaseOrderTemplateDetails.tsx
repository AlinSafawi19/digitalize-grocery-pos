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
  Button,
  CircularProgress,
  Chip,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Delete,
  FileCopy,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { RootState } from '../../store';
import {
  PurchaseOrderTemplateService,
  PurchaseOrderTemplate,
} from '../../services/purchase-order-template.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { ROUTES } from '../../utils/constants';
import { formatDate } from '../../utils/dateUtils';
import { usePermission } from '../../hooks/usePermission';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (amount: number) => currencyFormatter.format(amount);

const PurchaseOrderTemplateDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const canCreate = usePermission('purchase_orders.create');
  const canUpdate = usePermission('purchase_orders.update');
  const canDelete = usePermission('purchase_orders.delete');

  const [template, setTemplate] = useState<PurchaseOrderTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate(ROUTES.PURCHASE_ORDER_TEMPLATES);
      return;
    }

    const loadTemplate = async () => {
      setLoading(true);
      try {
        const result = await PurchaseOrderTemplateService.getById(parseInt(id));
        if (result.success && result.template) {
          setTemplate(result.template);
        } else {
          showToast(result.error || 'Failed to load template', 'error');
          navigate(ROUTES.PURCHASE_ORDER_TEMPLATES);
        }
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'An error occurred',
          'error'
        );
        navigate(ROUTES.PURCHASE_ORDER_TEMPLATES);
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [id, navigate, showToast]);

  const handleDelete = useCallback(async () => {
    if (!user?.id || !template || !canDelete) return;

    if (!window.confirm(`Are you sure you want to delete template "${template.name}"?`)) {
      return;
    }

    try {
      const result = await PurchaseOrderTemplateService.delete(template.id, user.id);
      if (result.success) {
        showToast('Template deleted successfully', 'success');
        navigate(ROUTES.PURCHASE_ORDER_TEMPLATES);
      } else {
        showToast(result.error || 'Failed to delete template', 'error');
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'An error occurred',
        'error'
      );
    }
  }, [user?.id, template, canDelete, navigate, showToast]);

  const handleCreateOrder = useCallback(async () => {
    if (!user?.id || !template || !canCreate) return;

    try {
      const result = await PurchaseOrderTemplateService.createOrderFromTemplate(
        template.id,
        user.id,
        null
      );

      if (result.success && result.orderInput) {
        navigate(ROUTES.PURCHASE_ORDERS_NEW, {
          state: {
            templateData: result.orderInput,
            templateName: template.name,
          },
        });
      } else {
        showToast(result.error || 'Failed to create order from template', 'error');
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'An error occurred',
        'error'
      );
    }
  }, [user?.id, template, canCreate, navigate, showToast]);

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (!template) {
    return null;
  }

  const total = template.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <MainLayout>
      <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            Template: {template.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => navigate(ROUTES.PURCHASE_ORDER_TEMPLATES)}
            >
              Back
            </Button>
            {canCreate && (
              <Button
                variant="contained"
                startIcon={<FileCopy />}
                onClick={handleCreateOrder}
                sx={{
                  backgroundColor: '#1a237e',
                  '&:hover': { backgroundColor: '#534bae' },
                }}
              >
                Create Order
              </Button>
            )}
            {canUpdate && (
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => navigate(ROUTES.PURCHASE_ORDER_TEMPLATES_EDIT.replace(':id', template.id.toString()))}
              >
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={handleDelete}
              >
                Delete
              </Button>
            )}
          </Box>
        </Box>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Template Information
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Name:</strong> {template.name}
                </Typography>
                {template.description && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Description:</strong> {template.description}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Supplier:</strong> {template.supplier.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Status:</strong>{' '}
                  <Chip
                    label={template.isActive ? 'Active' : 'Inactive'}
                    color={template.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Created by:</strong> {template.creator.username}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Created:</strong> {formatDate(template.createdAt)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Summary
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Total Items:</strong> {template.items.length}
                </Typography>
                <Typography variant="h5" color="primary" sx={{ mt: 2 }}>
                  <strong>Total Value:</strong> {formatCurrency(total)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Paper>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Template Items
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Quantity</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Unit Price</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Subtotal</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {template.items.map((item, index) => (
                  <TableRow key={index}>
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
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell>{item.notes || '-'}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Toast toast={toast} onClose={hideToast} />
      </Box>
    </MainLayout>
  );
};

export default PurchaseOrderTemplateDetails;

