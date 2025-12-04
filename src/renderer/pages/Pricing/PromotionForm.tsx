import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Grid,
  Typography,
  CircularProgress,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Switch,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
} from '@mui/material';
import { ArrowBack, Add } from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { RootState } from '../../store';
import {
  PricingService,
  CreatePromotionInput,
  UpdatePromotionInput,
  PricingRule,
} from '../../services/pricing.service';
import MainLayout from '../../components/layout/MainLayout';
import { fromBeirutToUTC, utcDateToDate } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

const PromotionForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingPromotion, setLoadingPromotion] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    startDate?: string;
    endDate?: string;
  }>({});
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);

  const [formData, setFormData] = useState<CreatePromotionInput>({
    name: '',
    description: null,
    type: 'store_wide',
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    isActive: true,
  });

  // Initial form data for change detection
  const [initialFormData, setInitialFormData] = useState<CreatePromotionInput>({
    name: '',
    description: null,
    type: 'store_wide',
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isActive: true,
  });

  // Load promotion if editing
  useEffect(() => {
    if (id && user?.id) {
      setIsEditMode(true);
      setLoadingPromotion(true);
      PricingService.getPromotion(parseInt(id), user.id)
        .then((result) => {
          if (result.success && result.promotion) {
            const promotion = result.promotion;
            const startDate = utcDateToDate(promotion.startDate);
            const endDate = utcDateToDate(promotion.endDate);
            const loadedFormData = {
              name: promotion.name,
              description: promotion.description,
              type: promotion.type,
              startDate: startDate || new Date(),
              endDate: endDate || new Date(),
              isActive: promotion.isActive,
            };
            setFormData(loadedFormData);
            setInitialFormData(loadedFormData);
            // Load associated pricing rules
            if (promotion.pricingRules) {
              setPricingRules(promotion.pricingRules);
            }
          } else {
            showToast(result.error || 'Failed to load promotion', 'error');
          }
        })
        .catch((err) => {
          showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
        })
        .finally(() => {
          setLoadingPromotion(false);
        });
    }
  }, [id, user?.id, showToast]);

  const validateForm = useCallback((): boolean => {
    const errors: {
      name?: string;
      startDate?: string;
      endDate?: string;
    } = {};

    // Validate name
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Name is required';
    }

    // Validate start date
    if (!formData.startDate) {
      errors.startDate = 'Start date is required';
    }

    // Validate end date
    if (!formData.endDate) {
      errors.endDate = 'End date is required';
    }

    // Validate date range
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      errors.endDate = 'End date must be after start date';
    }

    setFieldErrors((prev) => ({ ...prev, ...errors }));
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    // Check if values have changed (only in edit mode)
    if (isEditMode && id) {
      // Compare dates by converting to UTC for comparison
      const currentStartDate = fromBeirutToUTC(formData.startDate) || formData.startDate;
      const currentEndDate = fromBeirutToUTC(formData.endDate) || formData.endDate;
      const initialStartDate = fromBeirutToUTC(initialFormData.startDate) || initialFormData.startDate;
      const initialEndDate = fromBeirutToUTC(initialFormData.endDate) || initialFormData.endDate;

      // Compare dates by timestamp
      const startDateChanged = currentStartDate.getTime() !== initialStartDate.getTime();
      const endDateChanged = currentEndDate.getTime() !== initialEndDate.getTime();

      if (
        formData.name === initialFormData.name &&
        formData.description === initialFormData.description &&
        formData.type === initialFormData.type &&
        !startDateChanged &&
        !endDateChanged &&
        formData.isActive === initialFormData.isActive
      ) {
        showToast('No changes made', 'info');
        return;
      }
    }

    setLoading(true);
    setFieldErrors({});

    try {
      // Convert dates from Beirut timezone to UTC before saving
      const submitData: CreatePromotionInput = {
        ...formData,
        startDate: fromBeirutToUTC(formData.startDate) || formData.startDate,
        endDate: fromBeirutToUTC(formData.endDate) || formData.endDate,
      };

      let result;
      if (isEditMode && id) {
        const updateInput: UpdatePromotionInput = submitData;
        result = await PricingService.updatePromotion(parseInt(id), updateInput, user.id);
      } else {
        result = await PricingService.createPromotion(submitData, user.id);
      }

      if (result.success) {
        if (isEditMode) {
          setInitialFormData(formData);
        }
        showToast(isEditMode ? 'Promotion updated successfully' : 'Promotion created successfully', 'success');
        navigate('/promotions');
      } else {
        showToast(result.error || 'Failed to save promotion', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [formData, initialFormData, user?.id, isEditMode, id, navigate, showToast, validateForm]);

  const handleNavigateBack = useCallback(() => {
    navigate('/promotions');
  }, [navigate]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
    setFieldErrors((prev) => {
      if (prev.name) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { name, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, []);

  const handleTypeChange = useCallback((e: { target: { value: unknown } }) => {
    setFormData((prev) => ({
      ...prev,
      type: e.target.value as CreatePromotionInput['type'],
    }));
    // Set flag to move to next field after dropdown closes
    typeSelectWasOpenedRef.current = true;
  }, []);

  // Keyboard navigation handlers
  const handleNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const typeInput = document.getElementById('promotion-type');
      typeInput?.focus();
    }
  }, []);

  const handleDescriptionKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // For multiline, Shift+Enter creates new line, Enter moves to next field
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const startDateInput = document.getElementById('promotion-start-date');
      startDateInput?.focus();
    }
  }, []);

  const handleStartDateKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const endDateInput = document.getElementById('promotion-end-date');
      endDateInput?.focus();
    }
  }, []);

  const handleEndDateKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const activeToggle = document.getElementById('promotion-active-toggle');
      activeToggle?.focus();
    }
  }, []);

  const handleIsActiveKeyDown = useCallback((e: React.KeyboardEvent<HTMLLabelElement>) => {
    // Allow Enter to trigger save button without toggling
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      // Use setTimeout to ensure the event is fully processed
      setTimeout(() => {
        const submitButton = document.getElementById('promotion-submit') as HTMLButtonElement | null;
        if (submitButton && !submitButton.disabled) {
          submitButton.click();
        } else {
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }
      }, 0);
      return;
    }
    // Prevent default toggle behavior on Space - only allow arrow keys
    if (e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Toggle with arrow keys (left = false, right = true)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      const newValue = e.key === 'ArrowRight';
      setFormData((prev) => ({ ...prev, isActive: newValue }));
      // If toggle is activated (toggled on), trigger save button
      if (newValue) {
        setTimeout(() => {
          const submitButton = document.getElementById('promotion-submit') as HTMLButtonElement | null;
          if (submitButton && !submitButton.disabled) {
            submitButton.click();
          } else {
            const form = document.querySelector('form');
            if (form) {
              form.requestSubmit();
            }
          }
        }, 0);
      }
    }
  }, []);

  // Handlers for select open/close
  const handleTypeSelectOpen = useCallback(() => {
    typeSelectOpenRef.current = true;
    setTypeSelectOpen(true);
    typeSelectWasOpenedRef.current = true;
  }, []);

  const handleTypeSelectClose = useCallback(() => {
    const wasOpened = typeSelectWasOpenedRef.current;
    typeSelectOpenRef.current = false;
    setTypeSelectOpen(false);
    if (wasOpened) {
      typeSelectWasOpenedRef.current = false;
      setTimeout(() => {
        const descriptionInput = document.getElementById('promotion-description');
        descriptionInput?.focus();
      }, 0);
    }
  }, []);

  const handleTypeMenuItemClick = useCallback((event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setTypeSelectOpen(false);
    setTimeout(() => {
      const descriptionInput = document.getElementById('promotion-description');
      descriptionInput?.focus();
    }, 0);
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, description: e.target.value || null }));
  }, []);

  const handleStartDateChange = useCallback((newValue: Date | null) => {
    const newStartDate = newValue || new Date();
    setFormData((prev) => ({
      ...prev,
      startDate: newStartDate,
    }));
    setFieldErrors((prev) => {
      const updated = { ...prev };
      if (updated.startDate) {
        delete updated.startDate;
      }
      // Clear end date error if dates are now valid
      if (updated.endDate && formData.endDate && newStartDate <= formData.endDate) {
        delete updated.endDate;
      }
      return updated;
    });
  }, [formData.endDate]);

  const handleEndDateChange = useCallback((newValue: Date | null) => {
    const newEndDate = newValue || new Date();
    setFormData((prev) => ({
      ...prev,
      endDate: newEndDate,
    }));
    setFieldErrors((prev) => {
      const updated = { ...prev };
      if (updated.endDate) {
        delete updated.endDate;
      }
      // Validate against start date
      if (formData.startDate && newEndDate < formData.startDate) {
        updated.endDate = 'End date must be after start date';
      }
      return updated;
    });
  }, [formData.startDate]);

  const handleIsActiveChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setFormData((prev) => ({ ...prev, isActive: newValue }));
    // If toggle is activated (toggled on), trigger save button
    if (newValue) {
      setTimeout(() => {
        const submitButton = document.getElementById('promotion-submit') as HTMLButtonElement | null;
        if (submitButton && !submitButton.disabled) {
          submitButton.click();
        } else {
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }
      }, 0);
    }
  }, []);

  // Track if select dropdown is open
  const typeSelectOpenRef = useRef(false);
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);
  const typeSelectWasOpenedRef = useRef(false);

  const handleCancel = useCallback(() => {
    navigate('/promotions');
  }, [navigate]);

  const handleAddRule = useCallback(() => {
    navigate('/pricing-rules/new', { state: { promotionId: id ? parseInt(id) : undefined } });
  }, [id, navigate]);

  const handleEditRule = useCallback((ruleId: number) => {
    navigate(`/pricing-rules/edit/${ruleId}`);
  }, [navigate]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  }), []);

  const containerBoxSx = useMemo(() => ({
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
    alignItems: 'center',
  }), []);

  const backIconButtonSx = useMemo(() => ({
    mr: 2,
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

  const formContentBoxSx = useMemo(() => ({
    p: 3,
  }), []);

  const textFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '& fieldset': {
        borderColor: '#c0c0c0',
        borderWidth: '1px',
      },
      '&:hover fieldset': {
        borderColor: '#1a237e',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#1a237e',
        borderWidth: '1px',
      },
    },
    '& .MuiInputLabel-root': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiFormHelperText-root': {
      fontSize: '12px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const textFieldMultilineSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '& fieldset': {
        borderColor: '#c0c0c0',
        borderWidth: '1px',
      },
      '&:hover fieldset': {
        borderColor: '#1a237e',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#1a237e',
        borderWidth: '1px',
      },
    },
    '& .MuiInputLabel-root': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const selectTextFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '& fieldset': {
        borderColor: '#c0c0c0',
        borderWidth: '1px',
      },
      '&:hover fieldset': {
        borderColor: '#1a237e',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#1a237e',
        borderWidth: '1px',
      },
    },
    '& .MuiInputLabel-root': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const datePickerTextFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '& fieldset': {
        borderColor: '#c0c0c0',
        borderWidth: '1px',
      },
      '&:hover fieldset': {
        borderColor: '#1a237e',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#1a237e',
        borderWidth: '1px',
      },
    },
    '& .MuiInputLabel-root': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const formControlLabelSx = useMemo(() => ({
    '& .MuiFormControlLabel-label': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const dividerSx = useMemo(() => ({
    my: 2,
    borderColor: '#e0e0e0',
  }), []);

  const sectionTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const emptyStateTypographySx = useMemo(() => ({
    py: 2,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const addRuleButtonSx = useMemo(() => ({
    fontSize: '12px',
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

  const tableContainerSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const tableSx = useMemo(() => ({
    '& .MuiTableCell-head': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: 600,
      backgroundColor: '#f5f5f5',
      borderBottom: '2px solid #c0c0c0',
    },
    '& .MuiTableCell-body': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const chipSx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const tableIconButtonSx = useMemo(() => ({
    padding: '4px',
    color: '#1a237e',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const buttonBoxSx = useMemo(() => ({
    display: 'flex',
    gap: 2,
    justifyContent: 'flex-end',
  }), []);

  const cancelButtonSx = useMemo(() => ({
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

  const submitButtonSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#1a237e',
    '&:hover': {
      backgroundColor: '#000051',
    },
  }), []);

  const rulesHeaderBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 2,
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  if (loadingPromotion) {
    return (
      <MainLayout>
        <Box sx={loadingBoxSx}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Paper sx={paperSx}>
          <Box sx={titleBarBoxSx}>
            <IconButton onClick={handleNavigateBack} sx={backIconButtonSx}>
              <ArrowBack />
            </IconButton>
            <Typography sx={titleTypographySx}>
              {isEditMode ? 'Edit Promotion' : 'New Promotion'}
            </Typography>
          </Box>

          <Box sx={formContentBoxSx}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  id="promotion-name"
                  label="Name *"
                  value={formData.name}
                  onChange={handleNameChange}
                  onKeyDown={handleNameKeyDown}
                  error={!!fieldErrors.name}
                  helperText={fieldErrors.name}
                  tabIndex={1}
                  autoFocus
                  sx={textFieldSx}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    id="promotion-type"
                    value={formData.type}
                    label="Type"
                    onChange={handleTypeChange}
                    open={typeSelectOpen}
                    onOpen={handleTypeSelectOpen}
                    onClose={handleTypeSelectClose}
                    tabIndex={2}
                    sx={selectTextFieldSx}
                  >
                    <MenuItem value="product_promotion" onClick={(e) => handleTypeMenuItemClick(e)}>Product Promotion</MenuItem>
                    <MenuItem value="category_promotion" onClick={(e) => handleTypeMenuItemClick(e)}>Category Promotion</MenuItem>
                    <MenuItem value="store_wide" onClick={(e) => handleTypeMenuItemClick(e)}>Store-wide</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  id="promotion-description"
                  label="Description"
                  value={formData.description || ''}
                  onChange={handleDescriptionChange}
                  onKeyDown={handleDescriptionKeyDown}
                  multiline
                  rows={3}
                  tabIndex={3}
                  sx={textFieldMultilineSx}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Start Date *"
                  value={formData.startDate}
                  onChange={handleStartDateChange}
                  slotProps={{
                    textField: {
                      id: 'promotion-start-date',
                      fullWidth: true,
                      error: !!fieldErrors.startDate,
                      helperText: fieldErrors.startDate,
                      onKeyDown: handleStartDateKeyDown,
                      tabIndex: 4,
                      sx: datePickerTextFieldSx,
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="End Date *"
                  value={formData.endDate}
                  onChange={handleEndDateChange}
                  slotProps={{
                    textField: {
                      id: 'promotion-end-date',
                      fullWidth: true,
                      error: !!fieldErrors.endDate,
                      helperText: fieldErrors.endDate,
                      onKeyDown: handleEndDateKeyDown,
                      tabIndex: 5,
                      sx: datePickerTextFieldSx,
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      id="promotion-active-toggle"
                      checked={formData.isActive}
                      onChange={handleIsActiveChange}
                      tabIndex={6}
                    />
                  }
                  label="Active"
                  sx={formControlLabelSx}
                  onKeyDown={handleIsActiveKeyDown}
                />
              </Grid>

              {isEditMode && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={dividerSx} />
                    <Box sx={rulesHeaderBoxSx}>
                      <Typography sx={sectionTitleTypographySx}>Associated Pricing Rules</Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Add />}
                        onClick={handleAddRule}
                        sx={addRuleButtonSx}
                      >
                        Add Rule
                      </Button>
                    </Box>
                    {pricingRules.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={emptyStateTypographySx}>
                        No pricing rules linked to this promotion. Create pricing rules and link them to this promotion.
                      </Typography>
                    ) : (
                      <TableContainer sx={tableContainerSx}>
                        <Table size="small" sx={tableSx}>
                          <TableHead>
                            <TableRow>
                              <TableCell>Name</TableCell>
                              <TableCell>Type</TableCell>
                              <TableCell>Discount</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell align="right">Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {pricingRules.map((rule) => (
                              <TableRow key={rule.id}>
                                <TableCell>
                                  <Typography sx={bodyTypographySx}>
                                    {rule.name}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip label={rule.type.replace('_', ' ')} size="small" sx={chipSx} />
                                </TableCell>
                                <TableCell>
                                  <Typography sx={bodyTypographySx}>
                                    {rule.discountType === 'percentage'
                                      ? `${rule.discountValue}%`
                                      : `$${rule.discountValue}`}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={rule.isActive ? 'Active' : 'Inactive'}
                                    color={rule.isActive ? 'success' : 'default'}
                                    size="small"
                                    sx={chipSx}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditRule(rule.id)}
                                    sx={tableIconButtonSx}
                                  >
                                    <ArrowBack sx={{ transform: 'rotate(180deg)' }} fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Grid>
                </>
              )}

              <Grid item xs={12}>
                <Box sx={buttonBoxSx}>
                  <Button
                    variant="outlined"
                    onClick={handleCancel}
                    disabled={loading}
                    tabIndex={7}
                    sx={cancelButtonSx}
                  >
                    Cancel
                  </Button>
                  <Button
                    id="promotion-submit"
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    tabIndex={8}
                    sx={submitButtonSx}
                  >
                    {loading ? <CircularProgress size={20} /> : 'Save Promotion'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
          </Box>
        </Paper>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default PromotionForm;

