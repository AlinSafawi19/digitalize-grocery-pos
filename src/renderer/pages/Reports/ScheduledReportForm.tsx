import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Grid,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  IconButton,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { RootState } from '../../store';
import {
  ScheduledReportService,
  ScheduledReport,
  CreateScheduledReportInput,
  UpdateScheduledReportInput,
} from '../../services/report.service';
import MainLayout from '../../components/layout/MainLayout';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { dateToUTCISOString, utcDateStringToDate, getStartOfDayBeirut } from '../../utils/dateUtils';
import moment from 'moment-timezone';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { usePermission } from '../../hooks/usePermission';

const ALL_REPORT_TYPES = [
  { value: 'sales', label: 'Sales Report', requiredPermissions: ['reports.view', 'transactions.view'] },
  { value: 'inventory', label: 'Inventory Report', requiredPermissions: ['inventory.view'] },
  { value: 'financial', label: 'Financial Report', requiredPermissions: ['reports.view', 'transactions.view'] },
  { value: 'product', label: 'Product Performance Report', requiredPermissions: ['reports.view', 'products.view'] },
  { value: 'purchase', label: 'Purchase Order Report', requiredPermissions: ['purchase_orders.view'] },
  { value: 'supplier', label: 'Supplier Performance Report', requiredPermissions: ['suppliers.view'] },
];

const SCHEDULE_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'excel', label: 'Excel' },
  { value: 'pdf', label: 'PDF' },
];

const DATE_RANGE_TYPES = [
  { value: 'relative', label: 'Relative' },
  { value: 'fixed', label: 'Fixed Date Range' },
];

const RELATIVE_DATE_RANGES = [
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'last90days', label: 'Last 90 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisYear', label: 'This Year' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const ScheduledReportForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  // Permission checks
  const canViewTransactions = usePermission('transactions.view');
  const canViewReports = usePermission('reports.view');
  const canViewInventory = usePermission('inventory.view');
  const canViewProducts = usePermission('products.view');
  const canViewPurchaseOrders = usePermission('purchase_orders.view');
  const canViewSuppliers = usePermission('suppliers.view');

  // Filter report types based on permissions
  const availableReportTypes = useMemo(() => {
    return ALL_REPORT_TYPES.filter((type) => {
      // User needs at least one of the required permissions
      return type.requiredPermissions.some((perm) => {
        switch (perm) {
          case 'reports.view':
            return canViewReports;
          case 'transactions.view':
            return canViewTransactions;
          case 'inventory.view':
            return canViewInventory;
          case 'products.view':
            return canViewProducts;
          case 'purchase_orders.view':
            return canViewPurchaseOrders;
          case 'suppliers.view':
            return canViewSuppliers;
          default:
            return false;
        }
      });
    });
  }, [canViewReports, canViewTransactions, canViewInventory, canViewProducts, canViewPurchaseOrders, canViewSuppliers]);

  const [loading, setLoading] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [report, setReport] = useState<ScheduledReport | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    time?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  // Get default report type (first available, or 'sales' if available)
  const getDefaultReportType = useCallback(() => {
    if (availableReportTypes.length === 0) {
      return 'sales'; // Fallback, but should not happen if user has reports.view
    }
    // Prefer 'sales' if available, otherwise use first available
    const salesType = availableReportTypes.find((t) => t.value === 'sales');
    return salesType ? 'sales' : availableReportTypes[0].value;
  }, [availableReportTypes]);

  const [formData, setFormData] = useState<CreateScheduledReportInput>({
    name: '',
    reportType: getDefaultReportType(),
    scheduleType: 'daily',
    scheduleConfig: {
      time: '09:00',
    },
    dateRangeType: 'relative',
    dateRangeConfig: {
      type: 'relative',
      relativeType: 'last30days',
    },
    exportFormat: 'pdf',
  });

  // Initial form data for change detection
  const [initialFormData, setInitialFormData] = useState<CreateScheduledReportInput>({
    name: '',
    reportType: getDefaultReportType(),
    scheduleType: 'daily',
    scheduleConfig: {
      time: '09:00',
    },
    dateRangeType: 'relative',
    dateRangeConfig: {
      type: 'relative',
      relativeType: 'last30days',
    },
    exportFormat: 'pdf',
  });

  // Update formData reportType if current one is not available (for new reports)
  useEffect(() => {
    if (!isEditMode && availableReportTypes.length > 0) {
      const currentTypeAvailable = availableReportTypes.some((t) => t.value === formData.reportType);
      if (!currentTypeAvailable) {
        const defaultType = getDefaultReportType();
        setFormData((prev) => ({ ...prev, reportType: defaultType }));
      }
    }
  }, [availableReportTypes, isEditMode, formData.reportType, getDefaultReportType]);

  // Load report if editing
  useEffect(() => {
    if (id && user?.id) {
      setIsEditMode(true);
      setLoadingReport(true);
      // Load all reports and find the one with matching ID
      ScheduledReportService.getScheduledReports(user.id, { page: 1, pageSize: 1000 })
        .then((result) => {
          if (result.success && result.data) {
            const foundReport = result.data.find((r) => r.id === parseInt(id));
            if (foundReport) {
              setReport(foundReport);
              const loadedFormData = {
                name: foundReport.name,
                reportType: foundReport.reportType,
                scheduleType: foundReport.scheduleType,
                scheduleConfig: foundReport.scheduleConfig,
                dateRangeType: foundReport.dateRangeType,
                dateRangeConfig: foundReport.dateRangeConfig,
                exportFormat: foundReport.exportFormat,
                exportPath: foundReport.exportPath || undefined,
              };
              setFormData(loadedFormData);
              setInitialFormData(loadedFormData);
            } else {
              showToast('Scheduled report not found', 'error');
              navigate('/reports?tab=6');
            }
          } else {
            showToast(result.error || 'Failed to load scheduled report', 'error');
            navigate('/reports?tab=6');
          }
        })
        .catch((err) => {
          showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
          navigate('/reports?tab=6');
        })
        .finally(() => {
          setLoadingReport(false);
        });
    } else {
      setIsEditMode(false);
      setReport(null);
      const defaultType = getDefaultReportType();
      setFormData({
        name: '',
        reportType: defaultType,
        scheduleType: 'daily',
        scheduleConfig: {
          time: '09:00',
        },
        dateRangeType: 'relative',
        dateRangeConfig: {
          type: 'relative',
          relativeType: 'last30days',
        },
        exportFormat: 'pdf',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id, getDefaultReportType]);

  const validateForm = useCallback((): boolean => {
    const errors: {
      name?: string;
      time?: string;
      startDate?: string;
      endDate?: string;
    } = {};

    // Validate name
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Report name is required';
    }

    // Validate time
    if (!formData.scheduleConfig.time || formData.scheduleConfig.time.trim() === '') {
      errors.time = 'Time is required';
    }

    // Validate report type permission (only for new reports or when changing type)
    if (!isEditMode || (isEditMode && formData.reportType !== report?.reportType)) {
      const reportTypeAvailable = availableReportTypes.some((t) => t.value === formData.reportType);
      if (!reportTypeAvailable) {
        showToast('You do not have permission to create this type of report', 'error');
        return false;
      }
    }

    // Validate fixed date range if applicable
    if (formData.dateRangeType === 'fixed') {
      if (!formData.dateRangeConfig?.startDate || formData.dateRangeConfig.startDate.trim() === '') {
        errors.startDate = 'Start date is required';
      }

      if (!formData.dateRangeConfig?.endDate || formData.dateRangeConfig.endDate.trim() === '') {
        errors.endDate = 'End date is required';
      }

      // Validate date range
      if (
        formData.dateRangeConfig?.startDate &&
        formData.dateRangeConfig?.endDate &&
        new Date(formData.dateRangeConfig.startDate) > new Date(formData.dateRangeConfig.endDate)
      ) {
        errors.endDate = 'End date must be after start date';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, isEditMode, report, availableReportTypes, showToast]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setFieldErrors({});

    try {
      if (isEditMode && report) {
        // Check if values have changed (using JSON.stringify for deep comparison of nested objects)
        if (
          formData.name === initialFormData.name &&
          formData.reportType === initialFormData.reportType &&
          formData.scheduleType === initialFormData.scheduleType &&
          formData.dateRangeType === initialFormData.dateRangeType &&
          formData.exportFormat === initialFormData.exportFormat &&
          formData.exportPath === initialFormData.exportPath &&
          JSON.stringify(formData.scheduleConfig) === JSON.stringify(initialFormData.scheduleConfig) &&
          JSON.stringify(formData.dateRangeConfig) === JSON.stringify(initialFormData.dateRangeConfig)
        ) {
          showToast('No changes made', 'info');
          return;
        }

        // Update
        const result = await ScheduledReportService.updateScheduledReport(
          report.id,
          formData as UpdateScheduledReportInput,
          user.id
        );
        if (result.success) {
          setInitialFormData(formData);
          showToast('Scheduled report updated successfully', 'success');
          navigate('/reports?tab=6');
        } else {
          showToast(result.error || 'Failed to update scheduled report', 'error');
        }
      } else {
        // Create
        const result = await ScheduledReportService.createScheduledReport(formData, user.id);
        if (result.success) {
          showToast('Scheduled report created successfully', 'success');
          navigate('/reports?tab=6');
        } else {
          showToast(result.error || 'Failed to create scheduled report', 'error');
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.id, isEditMode, report, formData, initialFormData, showToast, navigate, validateForm]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    backgroundColor: '#f5f5f5',
  }), []);

  const containerBoxSx = useMemo(() => ({
    p: 3,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const mainPaperSx = useMemo(() => ({
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
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#ffffff',
    fontWeight: 600,
  }), []);

  const formContentBoxSx = useMemo(() => ({
    p: 3,
  }), []);

  const paperSx = useMemo(() => ({
    p: 3,
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const sectionTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 600,
    mb: 2,
  }), []);

  const textFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '44px',
      '& input': {
        padding: '10px 14px',
      },
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
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiFormHelperText-root': {
      fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const selectTextFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '44px',
      '& input': {
        padding: '10px 14px',
      },
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
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const datePickerTextFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '44px',
      '& input': {
        padding: '10px 14px',
      },
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
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiFormHelperText-root': {
      fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const formControlLabelSx = useMemo(() => ({
    '& .MuiFormControlLabel-label': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const buttonBoxSx = useMemo(() => ({
    display: 'flex',
    gap: 2,
    justifyContent: 'flex-end',
    mt: 3,
  }), []);

  const cancelButtonSx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    borderColor: '#c0c0c0',
    color: '#1a237e',
    padding: '8px 20px',
    minHeight: '44px',
    '&:hover': {
      borderColor: '#1a237e',
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const submitButtonSx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#1a237e',
    padding: '8px 20px',
    minHeight: '44px',
    '&:hover': {
      backgroundColor: '#283593',
    },
  }), []);

  // Memoize onChange handlers to prevent function recreation
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
    setFieldErrors((prev) => (prev.name ? { ...prev, name: undefined } : prev));
  }, []);

  const handleReportTypeChange = useCallback((e: { target: { value: string } }) => {
    setFormData((prev) => ({ ...prev, reportType: e.target.value }));
  }, []);

  const handleExportFormatChange = useCallback((e: { target: { value: string } }) => {
    setFormData((prev) => ({ ...prev, exportFormat: e.target.value }));
  }, []);

  const handleScheduleTypeChange = useCallback((e: { target: { value: string } }) => {
    setFormData((prev) => ({
      ...prev,
      scheduleType: e.target.value,
      scheduleConfig: {
        ...prev.scheduleConfig,
        dayOfWeek: undefined,
        dayOfMonth: undefined,
      },
    }));
  }, []);

  const handleTimeChange = useCallback((newValue: Date | null) => {
    if (newValue) {
      const beirutMoment = moment.tz(newValue, 'Asia/Beirut');
      const timeString = beirutMoment.format('HH:mm');
      setFormData((prev) => ({
        ...prev,
        scheduleConfig: { ...prev.scheduleConfig, time: timeString },
      }));
      setFieldErrors((prev) => (prev.time ? { ...prev, time: undefined } : prev));
    }
  }, []);

  const handleDayOfWeekChange = useCallback((e: { target: { value: unknown } }) => {
    setFormData((prev) => ({
      ...prev,
      scheduleConfig: {
        ...prev.scheduleConfig,
        dayOfWeek: e.target.value as number,
      },
    }));
  }, []);

  const handleDayOfMonthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      scheduleConfig: {
        ...prev.scheduleConfig,
        dayOfMonth: parseInt(e.target.value) || 1,
      },
    }));
  }, []);

  const handleDateRangeTypeChange = useCallback((e: { target: { value: string } }) => {
    setFormData((prev) => ({
      ...prev,
      dateRangeType: e.target.value,
      dateRangeConfig:
        e.target.value === 'relative'
          ? { type: 'relative', relativeType: 'last30days' }
          : { type: 'fixed' },
    }));
  }, []);

  const handleRelativeDateRangeChange = useCallback((e: { target: { value: string } }) => {
    setFormData((prev) => ({
      ...prev,
      dateRangeConfig: {
        type: 'relative',
        relativeType: e.target.value as 'last7days' | 'last30days' | 'last90days' | 'thisMonth' | 'lastMonth' | 'thisYear',
      },
    }));
  }, []);

  const handleStartDateChange = useCallback((newValue: Date | null) => {
    if (newValue) {
      const newStartDate = dateToUTCISOString(newValue);
      if (newStartDate) {
        setFormData((prev) => {
          const endDate = prev.dateRangeConfig?.endDate;
          // Clear start date error
          setFieldErrors((errPrev) => {
            const newErrors = errPrev.startDate ? { ...errPrev, startDate: undefined } : errPrev;
            // Clear end date error if dates are now valid
            if (errPrev.endDate && endDate && newValue <= (utcDateStringToDate(endDate) || new Date())) {
              return { ...newErrors, endDate: undefined };
            }
            return newErrors;
          });
          return {
            ...prev,
            dateRangeConfig: {
              type: 'fixed' as const,
              startDate: newStartDate,
              endDate,
            },
          };
        });
      }
    }
  }, []);

  const handleEndDateChange = useCallback((newValue: Date | null) => {
    if (newValue) {
      const newEndDate = dateToUTCISOString(newValue);
      if (newEndDate) {
        setFormData((prev) => {
          const startDate = prev.dateRangeConfig?.startDate;
          // Validate and update errors
          setFieldErrors((errPrev) => {
            const newErrors = errPrev.endDate ? { ...errPrev, endDate: undefined } : errPrev;
            // Validate against start date
            if (startDate && newValue < (utcDateStringToDate(startDate) || new Date())) {
              return { ...newErrors, endDate: 'End date must be after start date' };
            }
            return newErrors;
          });
          return {
            ...prev,
            dateRangeConfig: {
              type: 'fixed' as const,
              startDate,
              endDate: newEndDate,
            },
          };
        });
      }
    }
  }, []);

  const handleActiveToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      isActive: e.target.checked,
    } as CreateScheduledReportInput & { isActive: boolean }));
  }, []);

  const handleCancel = useCallback(() => {
    navigate('/reports?tab=6');
  }, [navigate]);

  const handleBack = useCallback(() => {
    navigate('/reports?tab=6');
  }, [navigate]);

  // Memoize time value conversion
  const timeValue = useMemo(() => {
    return formData.scheduleConfig.time
      ? moment.tz(formData.scheduleConfig.time, 'HH:mm', 'Asia/Beirut').toDate()
      : getStartOfDayBeirut();
  }, [formData.scheduleConfig.time]);

  // Memoize date values
  const startDateValue = useMemo(() => {
    return formData.dateRangeConfig?.startDate
      ? utcDateStringToDate(formData.dateRangeConfig.startDate)
      : null;
  }, [formData.dateRangeConfig?.startDate]);

  const endDateValue = useMemo(() => {
    return formData.dateRangeConfig?.endDate
      ? utcDateStringToDate(formData.dateRangeConfig.endDate)
      : null;
  }, [formData.dateRangeConfig?.endDate]);

  if (loadingReport) {
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
        <Paper sx={mainPaperSx}>
          <Box sx={titleBarBoxSx}>
            <IconButton onClick={handleBack} sx={backIconButtonSx}>
              <ArrowBack />
            </IconButton>
            <Typography sx={titleTypographySx}>
              {isEditMode ? 'Edit Scheduled Report' : 'Schedule New Report'}
            </Typography>
          </Box>

          <Box sx={formContentBoxSx}>

            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Paper sx={paperSx}>
                    <Typography sx={sectionTitleTypographySx}>
                      Report Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          label="Report Name *"
                          value={formData.name}
                          onChange={handleNameChange}
                          fullWidth
                          error={!!fieldErrors.name}
                          helperText={fieldErrors.name}
                          sx={textFieldSx}
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Report Type</InputLabel>
                          <Select
                            value={formData.reportType}
                            label="Report Type"
                            onChange={handleReportTypeChange}
                            sx={selectTextFieldSx}
                            disabled={availableReportTypes.length === 0}
                          >
                            {availableReportTypes.length === 0 ? (
                              <MenuItem value="" disabled>
                                No report types available (insufficient permissions)
                              </MenuItem>
                            ) : (
                              availableReportTypes.map((type) => (
                                <MenuItem key={type.value} value={type.value}>
                                  {type.label}
                                </MenuItem>
                              ))
                            )}
                            {/* In edit mode, show current report type even if not available (read-only) */}
                            {isEditMode && report && !availableReportTypes.some((t) => t.value === report.reportType) && (
                              <MenuItem value={report.reportType} disabled>
                                {ALL_REPORT_TYPES.find((t) => t.value === report.reportType)?.label || report.reportType} (No permission)
                              </MenuItem>
                            )}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Export Format</InputLabel>
                          <Select
                            value={formData.exportFormat}
                            label="Export Format"
                            onChange={handleExportFormatChange}
                            sx={selectTextFieldSx}
                          >
                            {EXPORT_FORMATS.map((format) => (
                              <MenuItem key={format.value} value={format.value}>
                                {format.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper sx={paperSx}>
                    <Typography sx={sectionTitleTypographySx}>
                      Schedule Configuration
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Schedule Type</InputLabel>
                          <Select
                            value={formData.scheduleType}
                            label="Schedule Type"
                            onChange={handleScheduleTypeChange}
                            sx={selectTextFieldSx}
                          >
                            {SCHEDULE_TYPES.map((type) => (
                              <MenuItem key={type.value} value={type.value}>
                                {type.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <TimePicker
                          label="Time *"
                          value={timeValue}
                          onChange={handleTimeChange}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              error: !!fieldErrors.time,
                              helperText: fieldErrors.time,
                              sx: datePickerTextFieldSx,
                            },
                          }}
                        />
                      </Grid>

                      {formData.scheduleType === 'weekly' && (
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth>
                            <InputLabel>Day of Week</InputLabel>
                            <Select
                              value={formData.scheduleConfig.dayOfWeek ?? 1}
                              label="Day of Week"
                              onChange={handleDayOfWeekChange}
                              sx={selectTextFieldSx}
                            >
                              {DAYS_OF_WEEK.map((day) => (
                                <MenuItem key={day.value} value={day.value}>
                                  {day.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      )}

                      {formData.scheduleType === 'monthly' && (
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Day of Month"
                            type="number"
                            value={formData.scheduleConfig.dayOfMonth ?? 1}
                            onChange={handleDayOfMonthChange}
                            fullWidth
                            inputProps={{ min: 1, max: 31 }}
                            sx={textFieldSx}
                          />
                        </Grid>
                      )}
                    </Grid>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper sx={paperSx}>
                    <Typography sx={sectionTitleTypographySx}>
                      Date Range Configuration
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Date Range Type</InputLabel>
                          <Select
                            value={formData.dateRangeType}
                            label="Date Range Type"
                            onChange={handleDateRangeTypeChange}
                            sx={selectTextFieldSx}
                          >
                            {DATE_RANGE_TYPES.map((type) => (
                              <MenuItem key={type.value} value={type.value}>
                                {type.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      {formData.dateRangeType === 'relative' && (
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth>
                            <InputLabel>Relative Date Range</InputLabel>
                            <Select
                              value={formData.dateRangeConfig?.relativeType || 'last30days'}
                              label="Relative Date Range"
                              onChange={handleRelativeDateRangeChange}
                              sx={selectTextFieldSx}
                            >
                              {RELATIVE_DATE_RANGES.map((range) => (
                                <MenuItem key={range.value} value={range.value}>
                                  {range.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      )}

                      {formData.dateRangeType === 'fixed' && (
                        <>
                          <Grid item xs={12} md={6}>
                            <DateTimePicker
                              label="Start Date *"
                              value={startDateValue}
                              onChange={handleStartDateChange}
                              slotProps={{
                                textField: {
                                  fullWidth: true,
                                  error: !!fieldErrors.startDate,
                                  helperText: fieldErrors.startDate,
                                  sx: datePickerTextFieldSx,
                                },
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <DateTimePicker
                              label="End Date *"
                              value={endDateValue}
                              onChange={handleEndDateChange}
                              slotProps={{
                                textField: {
                                  fullWidth: true,
                                  error: !!fieldErrors.endDate,
                                  helperText: fieldErrors.endDate,
                                  sx: datePickerTextFieldSx,
                                },
                              }}
                            />
                          </Grid>
                        </>
                      )}
                    </Grid>
                  </Paper>
                </Grid>

                {isEditMode && report && (
                  <Grid item xs={12}>
                    <Paper sx={paperSx}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={report.isActive}
                            onChange={handleActiveToggle}
                          />
                        }
                        label="Active"
                        sx={formControlLabelSx}
                      />
                    </Paper>
                  </Grid>
                )}
              </Grid>

              <Box sx={buttonBoxSx}>
                <Button
                  variant="outlined"
                  onClick={handleCancel}
                  disabled={loading}
                  sx={cancelButtonSx}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={submitButtonSx}
                >
                  {loading ? 'Saving...' : isEditMode ? 'Update Scheduled Report' : 'Create Scheduled Report'}
                </Button>
              </Box>
            </form>
          </Box>
        </Paper>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default ScheduledReportForm;

