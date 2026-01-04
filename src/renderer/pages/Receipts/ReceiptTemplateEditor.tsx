import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  FormControlLabel,
  Checkbox,
  Switch,
  Divider,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Save,
  Cancel,
  Preview,
  ArrowBack,
} from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ReceiptTemplateService, ReceiptTemplateData } from '../../services/receipt-template.service';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import MainLayout from '../../components/layout/MainLayout';
import ReceiptPreviewDialog from '../../components/common/ReceiptPreviewDialog';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const ReceiptTemplateEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { toast, showToast, hideToast } = useToast();

  const isEditMode = id !== undefined && id !== 'new';
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [templateData, setTemplateData] = useState<ReceiptTemplateData>(
    ReceiptTemplateService.getDefaultTemplateData()
  );

  const loadTemplate = useCallback(async () => {
    if (!id || id === 'new' || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const templateId = parseInt(id, 10);
      if (isNaN(templateId)) {
        showToast('Invalid template ID', 'error');
        navigate('/settings?tab=6');
        return;
      }

      const result = await ReceiptTemplateService.getTemplateById(templateId);
      if (result.success && result.template) {
        const template = result.template;
        setName(template.name);
        setDescription(template.description || '');
        setIsDefault(template.isDefault);
        setIsActive(template.isActive);
        setTemplateData(ReceiptTemplateService.parseTemplate(template.template));
      } else {
        showToast(result.error || 'Failed to load template', 'error');
        navigate('/settings?tab=6');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, userId, navigate, showToast]);

  useEffect(() => {
    if (isEditMode) {
      loadTemplate();
    } else if (id === 'new' || id === undefined) {
      // Ensure loading is false for new templates
      setLoading(false);
    }
  }, [id, isEditMode, loadTemplate]);

  const handleSave = async () => {
    if (!userId) return;

    if (!name.trim()) {
      showToast('Template name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        description: description.trim() || undefined,
        template: templateData,
        isDefault,
        isActive,
      };

      let result;
      if (isEditMode && id) {
        const templateId = parseInt(id, 10);
        result = await ReceiptTemplateService.updateTemplate(templateId, input, userId);
      } else {
        result = await ReceiptTemplateService.createTemplate(input, userId);
      }

      if (result.success) {
        showToast(isEditMode ? 'Template updated successfully' : 'Template created successfully', 'success');
        navigate('/settings?tab=6');
      } else {
        showToast(result.error || 'Failed to save template', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setSaving(false);
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/settings?tab=6')}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h4" component="h1">
              {isEditMode ? 'Edit Template' : 'New Template'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Preview />}
              onClick={() => setPreviewOpen(true)}
            >
              Preview
            </Button>
            <Button
              variant="outlined"
              startIcon={<Cancel />}
              onClick={() => navigate('/settings?tab=6')}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <Save />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>

        <Paper sx={{ p: 3 }}>
          {/* Basic Information */}
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Template Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                }
                label="Set as default template"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>

          {/* Template Sections */}
          <Typography variant="h6" gutterBottom>
            Template Configuration
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Items" />
            <Tab label="Totals" />
            <Tab label="Footer" />
            <Tab label="Printing" />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={templateData.items?.showHeaders !== false}
                      onChange={(e) => setTemplateData({
                        ...templateData,
                        items: { ...templateData.items, showHeaders: e.target.checked },
                      })}
                    />
                  }
                  label="Show column headers"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={templateData.items?.showSeparator !== false}
                      onChange={(e) => setTemplateData({
                        ...templateData,
                        items: { ...templateData.items, showSeparator: e.target.checked },
                      })}
                    />
                  }
                  label="Show separator line"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Visible Columns
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={templateData.items?.columns?.description !== false}
                      onChange={(e) => setTemplateData({
                        ...templateData,
                        items: {
                          ...templateData.items,
                          columns: { ...templateData.items?.columns, description: e.target.checked },
                        },
                      })}
                    />
                  }
                  label="Description"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={templateData.items?.columns?.quantity !== false}
                      onChange={(e) => setTemplateData({
                        ...templateData,
                        items: {
                          ...templateData.items,
                          columns: { ...templateData.items?.columns, quantity: e.target.checked },
                        },
                      })}
                    />
                  }
                  label="Quantity"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={templateData.items?.columns?.unitPrice !== false}
                      onChange={(e) => setTemplateData({
                        ...templateData,
                        items: {
                          ...templateData.items,
                          columns: { ...templateData.items?.columns, unitPrice: e.target.checked },
                        },
                      })}
                    />
                  }
                  label="Unit Price"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={templateData.items?.columns?.total !== false}
                      onChange={(e) => setTemplateData({
                        ...templateData,
                        items: {
                          ...templateData.items,
                          columns: { ...templateData.items?.columns, total: e.target.checked },
                        },
                      })}
                    />
                  }
                  label="Total"
                />
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={templateData.totals?.showSubtotal !== false}
                      onChange={(e) => setTemplateData({
                        ...templateData,
                        totals: { ...templateData.totals, showSubtotal: e.target.checked },
                      })}
                    />
                  }
                  label="Show Subtotal"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={templateData.totals?.showDiscount !== false}
                      onChange={(e) => setTemplateData({
                        ...templateData,
                        totals: { ...templateData.totals, showDiscount: e.target.checked },
                      })}
                    />
                  }
                  label="Show Discount"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={templateData.totals?.showTax !== false}
                      onChange={(e) => setTemplateData({
                        ...templateData,
                        totals: { ...templateData.totals, showTax: e.target.checked },
                      })}
                    />
                  }
                  label="Show Tax"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={templateData.totals?.showTotalUSD !== false}
                      onChange={(e) => setTemplateData({
                        ...templateData,
                        totals: { ...templateData.totals, showTotalUSD: e.target.checked },
                      })}
                    />
                  }
                  label="Show Total (USD)"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={templateData.totals?.showTotalLBP !== false}
                      onChange={(e) => setTemplateData({
                        ...templateData,
                        totals: { ...templateData.totals, showTotalLBP: e.target.checked },
                      })}
                    />
                  }
                  label="Show Total (LBP)"
                />
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Thank You Message"
                  multiline
                  rows={2}
                  value={templateData.footer?.thankYouMessage || ''}
                  onChange={(e) => setTemplateData({
                    ...templateData,
                    footer: { ...templateData.footer, thankYouMessage: e.target.value },
                  })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={templateData.footer?.showCashier !== false}
                      onChange={(e) => setTemplateData({
                        ...templateData,
                        footer: { ...templateData.footer, showCashier: e.target.checked },
                      })}
                    />
                  }
                  label="Show Cashier Name"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Custom Footer Text"
                  multiline
                  rows={3}
                  value={templateData.footer?.customText || ''}
                  onChange={(e) => setTemplateData({
                    ...templateData,
                    footer: { ...templateData.footer, customText: e.target.value },
                  })}
                  fullWidth
                  placeholder="Additional text to display in footer"
                />
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Paper Width (mm)"
                  type="number"
                  value={templateData.printing?.paperWidth || 80}
                  onChange={(e) => setTemplateData({
                    ...templateData,
                    printing: { ...templateData.printing, paperWidth: parseInt(e.target.value) || 80 },
                  })}
                  fullWidth
                  inputProps={{ min: 50, max: 120 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Printer Name"
                  value={templateData.printing?.printerName || ''}
                  onChange={(e) => setTemplateData({
                    ...templateData,
                    printing: { ...templateData.printing, printerName: e.target.value },
                  })}
                  fullWidth
                  placeholder="Leave empty for default printer"
                  helperText="Enter the exact name of your printer (as shown in Windows Printers). Leave empty to use the default printer."
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={templateData.printing?.autoPrint !== false}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTemplateData({
                        ...templateData,
                        printing: { ...templateData.printing, autoPrint: e.target.checked },
                      })}
                    />
                  }
                  label="Auto Print Receipts"
                />
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                  Automatically print receipts after completing transactions when using this template.
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={templateData.printing?.autoOpenCashDrawer || false}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTemplateData({
                        ...templateData,
                        printing: { ...templateData.printing, autoOpenCashDrawer: e.target.checked },
                      })}
                    />
                  }
                  label="Auto Open Cash Drawer"
                />
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                  Automatically open the cash drawer when a transaction completes. The cash drawer must be connected to your receipt printer via the RJ-11 port.
                </Typography>
              </Grid>
            </Grid>
          </TabPanel>
        </Paper>
      </Box>

      {/* Preview Dialog */}
      <ReceiptPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        templateData={templateData}
      />

      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default ReceiptTemplateEditor;

