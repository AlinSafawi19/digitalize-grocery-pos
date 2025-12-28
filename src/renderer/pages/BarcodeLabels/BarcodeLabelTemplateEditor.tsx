import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Save,
  Cancel,
  Preview,
  Add,
  Delete,
  Print,
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { RootState } from '../../store';
import {
  BarcodeLabelService,
  BarcodeLabelTemplate,
  CreateBarcodeLabelTemplateInput,
  UpdateBarcodeLabelTemplateInput,
  LabelLayout,
} from '../../services/barcode-label.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { usePermission } from '../../hooks/usePermission';
import { ROUTES } from '../../utils/constants';
import { ProductService } from '../../services/product.service';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`label-tabpanel-${index}`}
      aria-labelledby={`label-tab-${index}`}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const BarcodeLabelTemplateEditor: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const canManage = usePermission('barcode.manage');
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewProductId, setPreviewProductId] = useState<number | null>(null);
  const [previewHTML, setPreviewHTML] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    width: number;
    height: number;
    isDefault: boolean;
    isActive: boolean;
  }>({
    name: '',
    description: '',
    width: 4.0,
    height: 2.0,
    isDefault: false,
    isActive: true,
  });

  const [layout, setLayout] = useState<LabelLayout>(
    BarcodeLabelService.getDefaultTemplateData()
  );

  const loadTemplate = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const result = await BarcodeLabelService.getTemplateById(parseInt(id, 10));
      if (result.success && result.data) {
        const template = result.data;
        setFormData({
          name: template.name,
          description: template.description || '',
          width: template.width,
          height: template.height,
          isDefault: template.isDefault,
          isActive: template.isActive,
        });
        setLayout(BarcodeLabelService.parseTemplate(template.template));
      } else {
        showToast(result.error || 'Failed to load template', 'error');
        navigate(ROUTES.BARCODE_LABELS);
      }
    } catch (error) {
      showToast('An error occurred while loading template', 'error');
      navigate(ROUTES.BARCODE_LABELS);
    } finally {
      setLoading(false);
    }
  }, [id, showToast, navigate]);

  useEffect(() => {
    if (isEditing) {
      loadTemplate();
    }
  }, [isEditing, loadTemplate]);

  const handleSave = useCallback(async () => {
    if (!user?.id || !formData.name) return;

    setSaving(true);
    try {
      if (isEditing && id) {
        const updateData: UpdateBarcodeLabelTemplateInput = {
          name: formData.name,
          description: formData.description || undefined,
          width: formData.width,
          height: formData.height,
          template: layout,
          isDefault: formData.isDefault,
          isActive: formData.isActive,
        };

        const result = await BarcodeLabelService.updateTemplate(parseInt(id, 10), updateData);
        if (result.success) {
          showToast('Template updated successfully', 'success');
          navigate(ROUTES.BARCODE_LABELS);
        } else {
          showToast(result.error || 'Failed to update template', 'error');
        }
      } else {
        const createData: CreateBarcodeLabelTemplateInput = {
          name: formData.name,
          description: formData.description || undefined,
          width: formData.width,
          height: formData.height,
          template: layout,
          isDefault: formData.isDefault,
          isActive: formData.isActive,
          createdBy: user.id,
        };

        const result = await BarcodeLabelService.createTemplate(createData);
        if (result.success) {
          showToast('Template created successfully', 'success');
          navigate(ROUTES.BARCODE_LABELS);
        } else {
          showToast(result.error || 'Failed to create template', 'error');
        }
      }
    } catch (error) {
      showToast('An error occurred while saving template', 'error');
    } finally {
      setSaving(false);
    }
  }, [user, formData, layout, isEditing, id, showToast, navigate]);

  const handlePreview = useCallback(async () => {
    if (!previewProductId) {
      showToast('Please select a product for preview', 'warning');
      return;
    }

    const templateId = id ? parseInt(id, 10) : null;
    if (!templateId) {
      // For new templates, we need to save first or use a temporary template
      showToast('Please save the template first to preview', 'warning');
      return;
    }

    try {
      const result = await BarcodeLabelService.generateLabelHTML(templateId, previewProductId);
      if (result.success && result.data) {
        setPreviewHTML(result.data);
        setPreviewDialogOpen(true);
      } else {
        showToast(result.error || 'Failed to generate preview', 'error');
      }
    } catch (error) {
      showToast('An error occurred while generating preview', 'error');
    }
  }, [previewProductId, id, showToast]);

  const handlePrint = useCallback(() => {
    if (previewHTML) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(previewHTML);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  }, [previewHTML]);

  const handleAddElement = useCallback((type: LabelLayout['elements'][0]['type']) => {
    const newElement: LabelLayout['elements'][0] = {
      type,
      position: { x: 10, y: 10, width: 80 },
      style: {
        fontSize: 12,
        fontWeight: 'normal',
        textAlign: 'left',
        color: '#000000',
      },
    };

    if (type === 'barcode') {
      newElement.barcodeOptions = {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: true,
      };
    }

    setLayout({
      ...layout,
      elements: [...(layout.elements || []), newElement],
    });
  }, [layout]);

  const handleRemoveElement = useCallback((index: number) => {
    setLayout({
      ...layout,
      elements: layout.elements.filter((_, i) => i !== index),
    });
  }, [layout]);

  const handleElementChange = useCallback((
    index: number,
    field: string,
    value: unknown
  ) => {
    const newElements = [...layout.elements];
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      (newElements[index] as any)[parent] = {
        ...(newElements[index] as any)[parent],
        [child]: value,
      };
    } else {
      (newElements[index] as any)[field] = value;
    }
    setLayout({
      ...layout,
      elements: newElements,
    });
  }, [layout]);

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
          <Typography>You don't have permission to manage barcode label templates.</Typography>
        </Box>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography sx={titleTypographySx}>
            {isEditing ? 'Edit Barcode Label Template' : 'New Barcode Label Template'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Cancel />}
              onClick={() => navigate(ROUTES.BARCODE_LABELS)}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saving || !formData.name}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>

        <Paper>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="General" />
            <Tab label="Layout" />
            <Tab label="Preview" />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Width (inches)"
                  type="number"
                  value={formData.width}
                  onChange={(e) => setFormData({ ...formData, width: parseFloat(e.target.value) || 0 })}
                  fullWidth
                  inputProps={{ step: 0.1, min: 0.5, max: 10 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Height (inches)"
                  type="number"
                  value={formData.height}
                  onChange={(e) => setFormData({ ...formData, height: parseFloat(e.target.value) || 0 })}
                  fullWidth
                  inputProps={{ step: 0.1, min: 0.5, max: 10 }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    />
                  }
                  label="Set as Default Template"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>Add Elements</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
                <Button size="small" onClick={() => handleAddElement('barcode')}>Barcode</Button>
                <Button size="small" onClick={() => handleAddElement('product_name')}>Product Name</Button>
                <Button size="small" onClick={() => handleAddElement('product_code')}>Product Code</Button>
                <Button size="small" onClick={() => handleAddElement('price')}>Price</Button>
                <Button size="small" onClick={() => handleAddElement('text')}>Text</Button>
                <Button size="small" onClick={() => handleAddElement('image')}>Image</Button>
              </Box>
            </Box>

            <Box>
              <Typography variant="h6" gutterBottom>Elements</Typography>
              {layout.elements.length === 0 ? (
                <Typography color="text.secondary">No elements added. Click buttons above to add elements.</Typography>
              ) : (
                layout.elements.map((element, index) => (
                  <Paper key={index} sx={{ p: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle1">
                        Element {index + 1}: {element.type}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveElement(index)}
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField
                          label="X Position (%)"
                          type="number"
                          value={element.position.x}
                          onChange={(e) => handleElementChange(index, 'position.x', parseFloat(e.target.value) || 0)}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Y Position (%)"
                          type="number"
                          value={element.position.y}
                          onChange={(e) => handleElementChange(index, 'position.y', parseFloat(e.target.value) || 0)}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Width (%)"
                          type="number"
                          value={element.position.width || ''}
                          onChange={(e) => handleElementChange(index, 'position.width', parseFloat(e.target.value) || undefined)}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Height (%)"
                          type="number"
                          value={element.position.height || ''}
                          onChange={(e) => handleElementChange(index, 'position.height', parseFloat(e.target.value) || undefined)}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                      {element.type === 'text' && (
                        <Grid item xs={12}>
                          <TextField
                            label="Text Content"
                            value={element.content || ''}
                            onChange={(e) => handleElementChange(index, 'content', e.target.value)}
                            fullWidth
                            size="small"
                          />
                        </Grid>
                      )}
                      {element.type === 'barcode' && (
                        <>
                          <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Barcode Format</InputLabel>
                              <Select
                                value={element.barcodeOptions?.format || 'CODE128'}
                                onChange={(e: SelectChangeEvent) => handleElementChange(index, 'barcodeOptions.format', e.target.value)}
                                label="Barcode Format"
                              >
                                <MenuItem value="CODE128">CODE128</MenuItem>
                                <MenuItem value="EAN13">EAN-13</MenuItem>
                                <MenuItem value="EAN8">EAN-8</MenuItem>
                                <MenuItem value="UPC">UPC</MenuItem>
                                <MenuItem value="CODE39">CODE39</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={6}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={element.barcodeOptions?.displayValue !== false}
                                  onChange={(e) => handleElementChange(index, 'barcodeOptions.displayValue', e.target.checked)}
                                />
                              }
                              label="Show Value"
                            />
                          </Grid>
                        </>
                      )}
                    </Grid>
                  </Paper>
                ))
              )}
            </Box>
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <Box sx={{ mb: 3 }}>
              <TextField
                label="Product ID for Preview"
                type="number"
                value={previewProductId || ''}
                onChange={(e) => setPreviewProductId(parseInt(e.target.value, 10) || null)}
                fullWidth
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                startIcon={<Preview />}
                onClick={handlePreview}
                disabled={!previewProductId || !id}
              >
                Generate Preview
              </Button>
            </Box>
            {previewHTML && (
              <Box>
                <Typography variant="h6" gutterBottom>Preview</Typography>
                <Paper sx={{ p: 2, border: '1px solid #ccc' }}>
                  <div dangerouslySetInnerHTML={{ __html: previewHTML }} />
                </Paper>
              </Box>
            )}
          </TabPanel>
        </Paper>

        {/* Preview Dialog */}
        <Dialog
          open={previewDialogOpen}
          onClose={() => setPreviewDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Label Preview
            <IconButton
              onClick={handlePrint}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <Print />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {previewHTML && (
              <div dangerouslySetInnerHTML={{ __html: previewHTML }} />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
            <Button onClick={handlePrint} variant="contained" startIcon={<Print />}>
              Print
            </Button>
          </DialogActions>
        </Dialog>

        <Toast toast={toast} onClose={hideToast} />
      </Box>
    </MainLayout>
  );
};

export default BarcodeLabelTemplateEditor;

