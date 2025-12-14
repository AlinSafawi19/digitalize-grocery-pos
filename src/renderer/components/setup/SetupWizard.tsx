import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Grid,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { Image as ImageIcon, Delete as DeleteIcon } from '@mui/icons-material';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import {
  SettingsService,
  BusinessRules as BusinessRulesType,
  NotificationSettings as NotificationSettingsType,
  PrinterSettings as PrinterSettingsType,
} from '../../services/settings.service';
import { CurrencyService } from '../../services/currency.service';
import { useToast } from '../../hooks/useToast';
import Toast from '../common/Toast';

interface SetupWizardProps {
  open: boolean;
  onComplete: () => void;
  userId: number;
  passwordOnly?: boolean; // If true, only show password change step
}

interface StoreInfo {
  name: string;
  address: string;
  phone: string;
  logo?: string;
}

interface TaxConfig {
  defaultTaxRate: number;
  taxInclusive: boolean;
}

interface CurrencySettings {
  usdToLbp: number;
}

// Use types from settings service
type PrinterSettings = PrinterSettingsType;
type BusinessRules = BusinessRulesType;
type NotificationSettings = NotificationSettingsType;

const steps = [
  'Change Password',
  'Store Information',
  'Tax Configuration',
  'Currency Settings',
  'Printer Settings',
  'Business Rules',
  'Notifications',
];

const SetupWizard: React.FC<SetupWizardProps> = ({ open, onComplete, userId, passwordOnly = false }) => {
  const { toast, showToast, hideToast } = useToast();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form data
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({
    name: '',
    address: '',
    phone: '',
    logo: '',
  });

  const [taxConfig, setTaxConfig] = useState<TaxConfig>({
    defaultTaxRate: 0,
    taxInclusive: false,
  });

  const [currencySettings, setCurrencySettings] = useState<CurrencySettings>({
    usdToLbp: 89000,
  });

  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>({
    printerName: '',
    paperWidth: 80,
    autoPrint: true,
  } as PrinterSettings);

  const [businessRules, setBusinessRules] = useState<BusinessRules>({
    roundingMethod: 'round',
    allowNegativeStock: false,
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    soundEnabled: true,
    soundVolume: 0.5,
    enabledTypes: [],
    priorityFilter: 'all',
  });

  const [cashDrawerSettings, setCashDrawerSettings] = useState<{ autoOpen: boolean }>({
    autoOpen: false,
  });

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Field errors
  const [errors, setErrors] = useState<{
    storeName?: string;
    taxRate?: string;
    exchangeRate?: string;
    paperWidth?: string;
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // Refs for keyboard navigation
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const storeNameRef = useRef<HTMLInputElement>(null);
  const storeAddressRef = useRef<HTMLTextAreaElement>(null);
  const storePhoneRef = useRef<HTMLInputElement>(null);
  const taxRateRef = useRef<HTMLInputElement>(null);
  const exchangeRateRef = useRef<HTMLInputElement>(null);
  const printerNameRef = useRef<HTMLInputElement>(null);
  const paperWidthRef = useRef<HTMLInputElement>(null);
  const soundVolumeRef = useRef<HTMLInputElement>(null);

  // Focus first input when step changes
  useEffect(() => {
    if (open && !loading) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        switch (activeStep) {
          case 0:
            currentPasswordRef.current?.focus();
            break;
          case 1:
            storeNameRef.current?.focus();
            break;
          case 2:
            taxRateRef.current?.focus();
            break;
          case 3:
            exchangeRateRef.current?.focus();
            break;
          case 4:
            printerNameRef.current?.focus();
            break;
          case 5:
            // Business Rules - no text input, focus first select
            break;
          case 6:
            // Notifications - focus sound volume if enabled
            if (notificationSettings.soundEnabled) {
              soundVolumeRef.current?.focus();
            }
            break;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeStep, open, loading, notificationSettings.soundEnabled]);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const [
        storeInfoResult,
        taxConfigResult,
        printerSettingsResult,
        businessRulesResult,
        notificationSettingsResult,
        cashDrawerSettingsResult,
        exchangeRate,
      ] = await Promise.all([
        SettingsService.getStoreInfo(userId),
        SettingsService.getTaxConfig(userId),
        SettingsService.getPrinterSettings(userId),
        SettingsService.getBusinessRules(userId),
        SettingsService.getNotificationSettings(userId),
        SettingsService.getCashDrawerSettings(userId),
        CurrencyService.getExchangeRate(),
      ]);

      if (storeInfoResult.success && storeInfoResult.storeInfo) {
        setStoreInfo({
          name: storeInfoResult.storeInfo.name || '',
          address: storeInfoResult.storeInfo.address || '',
          phone: storeInfoResult.storeInfo.phone || '',
          logo: storeInfoResult.storeInfo.logo || '',
        });
      }

      if (taxConfigResult.success && taxConfigResult.taxConfig) {
        setTaxConfig({
          defaultTaxRate: taxConfigResult.taxConfig.defaultTaxRate || 0,
          taxInclusive: taxConfigResult.taxConfig.taxInclusive || false,
        });
      }

      if (printerSettingsResult.success && printerSettingsResult.printerSettings) {
        const minPaperWidth = 58;
        setPrinterSettings({
          printerName: printerSettingsResult.printerSettings.printerName || '',
          paperWidth: Math.max(minPaperWidth, printerSettingsResult.printerSettings.paperWidth || 80),
          autoPrint: printerSettingsResult.printerSettings.autoPrint ?? true,
        });
      }

      if (businessRulesResult.success && businessRulesResult.businessRules) {
        setBusinessRules({
          ...businessRulesResult.businessRules,
          roundingMethod: businessRulesResult.businessRules.roundingMethod || 'round',
        });
      }

      if (notificationSettingsResult.success && notificationSettingsResult.notificationSettings) {
        setNotificationSettings({
          ...notificationSettingsResult.notificationSettings,
          priorityFilter: notificationSettingsResult.notificationSettings.priorityFilter || 'all',
          enabledTypes: notificationSettingsResult.notificationSettings.enabledTypes || [],
        });
      }

      if (cashDrawerSettingsResult.success && cashDrawerSettingsResult.cashDrawerSettings) {
        setCashDrawerSettings({
          autoOpen: cashDrawerSettingsResult.cashDrawerSettings.autoOpen || false,
        });
      }

      setCurrencySettings({
        usdToLbp: exchangeRate || 89000,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, showToast]);

  // Load existing settings and reset password fields when wizard opens
  useEffect(() => {
    if (open) {
      loadSettings();
      // Reset password fields when wizard opens
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    }
  }, [open, loadSettings]);

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: typeof errors = {};

    if (step === 0) {
      // Password change validation
      if (!currentPassword) {
        newErrors.currentPassword = 'Current password is required';
      }
      if (!newPassword) {
        newErrors.newPassword = 'New password is required';
      } else if (newPassword.length < 6) {
        newErrors.newPassword = 'New password must be at least 6 characters long';
      }
      if (!confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your new password';
      } else if (newPassword !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    } else if (step === 1) {
      // Store Information validation
      if (!storeInfo.name.trim()) {
        newErrors.storeName = 'Store name is required';
      }
    } else if (step === 2) {
      // Tax Configuration validation
      if (taxConfig.defaultTaxRate < 0 || taxConfig.defaultTaxRate > 100) {
        newErrors.taxRate = 'Tax rate must be between 0 and 100';
      }
    } else if (step === 3) {
      // Currency Settings validation
      if (currencySettings.usdToLbp <= 0) {
        newErrors.exchangeRate = 'Exchange rate must be greater than 0';
      }
    } else if (step === 4) {
      // Printer Settings validation
      if (printerSettings.paperWidth < 58 || printerSettings.paperWidth > 110) {
        newErrors.paperWidth = 'Paper width must be between 58mm and 110mm';
      }
    }
    // Steps 5, 6 don't require validation (all optional settings)

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentPassword, newPassword, confirmPassword, storeInfo, taxConfig, currencySettings, printerSettings]);

  const handleNext = useCallback(async () => {
    if (!validateStep(activeStep)) {
      return;
    }

    // If we're on the password step (step 0), save the password before proceeding
    if (activeStep === 0 && currentPassword && newPassword) {
      try {
        setSaving(true);
        const passwordResult = await window.electron.ipcRenderer.invoke(
          'user:updateProfile',
          {
            currentPassword,
            newPassword,
          },
          userId
        ) as { success: boolean; error?: string };

        if (!passwordResult.success) {
          showToast(passwordResult.error || 'Failed to change password', 'error');
          setSaving(false);
          return;
        }

        showToast('Password changed successfully', 'success');
        
        // If password-only mode, mark password as changed and complete setup
        if (passwordOnly) {
          try {
            await SettingsService.setSetting(
              {
                key: `user.${userId}.passwordChanged`,
                value: 'true',
                type: 'boolean',
                description: 'User password change status',
              },
              userId
            );
            setSaving(false);
            onComplete();
            return;
          } catch (error) {
            console.error('Failed to save password change status:', error);
            // Continue anyway - password was changed successfully, complete setup
            setSaving(false);
            onComplete();
            return;
          }
        }
        
        setSaving(false);
      } catch (error) {
        console.error('Failed to change password:', error);
        showToast('Failed to change password. Please try again.', 'error');
        setSaving(false);
        return;
      }
    }

    // If password-only mode and on password step, don't proceed to next step
    if (passwordOnly && activeStep === 0) {
      return;
    }

    setActiveStep((prevStep) => prevStep + 1);
  }, [validateStep, activeStep, currentPassword, newPassword, passwordOnly, userId, onComplete, showToast]);

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleLogoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size must be less than 2MB', 'error');
      return;
    }

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        setStoreInfo((prev) => ({ ...prev, logo: base64String }));
      };
      reader.onerror = () => {
        showToast('Failed to read image file', 'error');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error reading logo file:', error);
      showToast('Failed to read image file', 'error');
    }
  }, [showToast]);

  const handleRemoveLogo = useCallback(() => {
    setStoreInfo((prev) => ({ ...prev, logo: '' }));
  }, []);

  const handleComplete = useCallback(async () => {
    if (!validateStep(activeStep)) {
      return;
    }

    try {
      setSaving(true);

      // Save all settings
      const [
        storeResult,
        taxResult,
        printerResult,
        businessRulesResult,
        notificationResult,
        cashDrawerResult,
        setupResult,
      ] = await Promise.all([
        SettingsService.setStoreInfo(
          {
            name: storeInfo.name,
            address: storeInfo.address,
            phone: storeInfo.phone,
            logo: storeInfo.logo,
          },
          userId
        ),
        SettingsService.setTaxConfig(
          {
            defaultTaxRate: taxConfig.defaultTaxRate,
            taxInclusive: taxConfig.taxInclusive,
          },
          userId
        ),
        SettingsService.setPrinterSettings(printerSettings, userId),
        SettingsService.setBusinessRules(businessRules, userId),
        SettingsService.setNotificationSettings(notificationSettings, userId),
        SettingsService.setCashDrawerSettings(cashDrawerSettings, userId),
        // Mark setup as completed
        SettingsService.setSetting(
          {
            key: 'setup.completed',
            value: 'true',
            type: 'boolean',
            description: 'Setup wizard completion status',
          },
          userId
        ),
      ]);

      // Check if any operation failed
      if (
        !storeResult.success ||
        !taxResult.success ||
        !printerResult.success ||
        !businessRulesResult.success ||
        !notificationResult.success ||
        !cashDrawerResult.success ||
        !setupResult.success
      ) {
        throw new Error('Some settings failed to save');
      }

      // Set exchange rate (returns void, throws on error)
      await CurrencyService.setExchangeRate(currencySettings.usdToLbp, userId);

      showToast('Setup completed successfully!', 'success');
      onComplete();
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('Failed to save settings. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }, [
    storeInfo,
    taxConfig,
    currencySettings,
    printerSettings,
    businessRules,
    notificationSettings,
    cashDrawerSettings,
    activeStep,
    userId,
    onComplete,
    showToast,
    validateStep,
  ]);

  // Handle Enter key to move to next input or trigger button
  const handleKeyDown = useCallback((e: React.KeyboardEvent, nextRef?: React.RefObject<HTMLElement>, isLastInStep?: boolean) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      if (isLastInStep) {
        // Trigger the Next/Complete button action
        if ((passwordOnly && activeStep === 0) || activeStep === steps.length - 1) {
          // Complete button
          if (!saving) {
            if (passwordOnly && activeStep === 0) {
              handleNext();
            } else {
              handleComplete();
            }
          }
        } else {
          // Next button
          if (!saving) {
            handleNext();
          }
        }
      } else if (nextRef?.current) {
        nextRef.current.focus();
      }
    }
  }, [activeStep, passwordOnly, saving, handleNext, handleComplete]);

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Please change your password to secure your account. This is required for your first login.
            </Alert>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  id="setup-current-password"
                  type="password"
                  label="Current Password *"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (errors.currentPassword) {
                      setErrors({ ...errors, currentPassword: undefined });
                    }
                  }}
                  onKeyDown={(e) => handleKeyDown(e, newPasswordRef)}
                  inputRef={currentPasswordRef}
                  error={!!errors.currentPassword}
                  helperText={errors.currentPassword}
                  disabled={saving}
                  size="medium"
                  autoFocus
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontSize: '18px',
                      minHeight: 56,
                      '& input': {
                        padding: '16px 14px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '16px',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  id="setup-new-password"
                  type="password"
                  label="New Password *"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (errors.newPassword) {
                      setErrors({ ...errors, newPassword: undefined });
                    }
                    // Clear confirm password error if passwords match
                    if (e.target.value === confirmPassword && errors.confirmPassword) {
                      setErrors({ ...errors, confirmPassword: undefined });
                    }
                  }}
                  onKeyDown={(e) => handleKeyDown(e, confirmPasswordRef)}
                  inputRef={newPasswordRef}
                  error={!!errors.newPassword}
                  helperText={errors.newPassword || 'Password must be at least 6 characters long'}
                  disabled={saving}
                  size="medium"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontSize: '18px',
                      minHeight: 56,
                      '& input': {
                        padding: '16px 14px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '16px',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  id="setup-confirm-password"
                  type="password"
                  label="Confirm New Password *"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) {
                      if (e.target.value === newPassword) {
                        setErrors({ ...errors, confirmPassword: undefined });
                      } else {
                        setErrors({ ...errors, confirmPassword: 'Passwords do not match' });
                      }
                    }
                  }}
                  onKeyDown={(e) => handleKeyDown(e, undefined, true)}
                  inputRef={confirmPasswordRef}
                  onBlur={() => {
                    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
                      setErrors({ ...errors, confirmPassword: 'Passwords do not match' });
                    }
                  }}
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword}
                  disabled={saving}
                  size="medium"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontSize: '18px',
                      minHeight: 56,
                      '& input': {
                        padding: '16px 14px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '16px',
                    },
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ mt: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Please provide your store information. This will be used on receipts and reports.
            </Alert>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Tooltip title="Store Name - Enter the official name of your store. This will appear on receipts and reports. This is a required field.">
                  <TextField
                    fullWidth
                    label="Store Name *"
                    value={storeInfo.name}
                    onChange={(e) =>
                      setStoreInfo({ ...storeInfo, name: e.target.value })
                    }
                    onKeyDown={(e) => handleKeyDown(e, storeAddressRef)}
                    inputRef={storeNameRef}
                    error={!!errors.storeName}
                    helperText={errors.storeName}
                    disabled={saving}
                    size="medium"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '18px',
                        minHeight: 56,
                        '& input': {
                          padding: '16px 14px',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '16px',
                      },
                    }}
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12}>
                <Tooltip title="Store Address - Enter your store's physical address. This will appear on receipts and reports. This is optional.">
                  <TextField
                    fullWidth
                    label="Store Address"
                    value={storeInfo.address}
                    onChange={(e) =>
                      setStoreInfo({ ...storeInfo, address: e.target.value })
                    }
                    onKeyDown={(e) => {
                      // For multiline, only move to next on Ctrl+Enter or Shift+Enter
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        storePhoneRef.current?.focus();
                      }
                    }}
                    inputRef={storeAddressRef}
                    multiline
                    rows={3}
                    disabled={saving}
                    size="medium"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '18px',
                        '& textarea': {
                          padding: '16px 14px',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '16px',
                      },
                    }}
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12}>
                <Tooltip title="Phone Number - Enter your store's contact phone number. This will appear on receipts and reports. This is optional.">
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontSize: '16px', color: 'text.secondary' }}>
                      Phone Number
                    </Typography>
                    <PhoneInput
                      international
                      defaultCountry="LB"
                      value={storeInfo.phone}
                      onChange={(value) =>
                        setStoreInfo({ ...storeInfo, phone: value || '' })
                      }
                      disabled={saving}
                      style={{
                        '--PhoneInputInput-height': '56px',
                        '--PhoneInputInput-fontSize': '18px',
                      } as React.CSSProperties}
                      className="mui-phone-input"
                    />
                    <style>{`
                      .mui-phone-input {
                        width: 100%;
                      }
                      .mui-phone-input .PhoneInputInput {
                        width: 100%;
                        height: 56px;
                        padding: 16px 14px;
                        font-size: 18px;
                        border: 1px solid rgba(0, 0, 0, 0.23);
                        border-radius: 4px;
                        font-family: inherit;
                      }
                      .mui-phone-input .PhoneInputInput:focus {
                        border-color: #1976d2;
                        border-width: 2px;
                        outline: none;
                      }
                      .mui-phone-input .PhoneInputInput:disabled {
                        background-color: rgba(0, 0, 0, 0.06);
                        cursor: not-allowed;
                      }
                      .mui-phone-input .PhoneInputCountry {
                        margin-right: 8px;
                      }
                    `}</style>
                  </Box>
                </Tooltip>
              </Grid>
              <Grid item xs={12}>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    mb: 1,
                  }}
                >
                  Store Logo
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {storeInfo.logo && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 2,
                        border: '1px solid #c0c0c0',
                        borderRadius: 1,
                        backgroundColor: '#fafafa',
                      }}
                    >
                      <Box
                        component="img"
                        src={storeInfo.logo}
                        alt="Store Logo"
                        sx={{
                          maxWidth: '150px',
                          maxHeight: '150px',
                          objectFit: 'contain',
                          border: '1px solid #e0e0e0',
                          borderRadius: 1,
                        }}
                      />
                      <Tooltip title="Remove Logo - Delete the uploaded store logo. You can upload a new one later.">
                        <span>
                          <Button
                            variant="outlined"
                            startIcon={<DeleteIcon />}
                            onClick={handleRemoveLogo}
                            disabled={saving}
                            size="large"
                            sx={{
                              textTransform: 'none',
                              fontSize: '16px',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              borderColor: '#c0c0c0',
                              color: '#616161',
                              minHeight: 48,
                              padding: '12px 24px',
                              fontWeight: 600,
                              '&:hover': {
                                borderColor: '#d32f2f',
                                color: '#d32f2f',
                                backgroundColor: 'rgba(211, 47, 47, 0.04)',
                              },
                              '& .MuiSvgIcon-root': {
                                fontSize: 20,
                              },
                            }}
                          >
                            Remove Logo
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  )}
                  <Tooltip title="Upload Logo - Select an image file (JPG, PNG, GIF) up to 2MB to use as your store logo on receipts and reports.">
                    <span>
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<ImageIcon />}
                        disabled={saving}
                        size="large"
                        sx={{
                          textTransform: 'none',
                          fontSize: '16px',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          borderColor: '#c0c0c0',
                          color: '#616161',
                          minHeight: 48,
                          padding: '12px 24px',
                          fontWeight: 600,
                          '&:hover': {
                            borderColor: '#1a237e',
                            color: '#1a237e',
                            backgroundColor: 'rgba(26, 35, 126, 0.04)',
                          },
                          '& .MuiSvgIcon-root': {
                            fontSize: 20,
                          },
                        }}
                      >
                        {storeInfo.logo ? 'Change Logo' : 'Upload Logo'}
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={handleLogoChange}
                        />
                      </Button>
                    </span>
                  </Tooltip>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '12px',
                      color: '#616161',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  >
                    Upload a logo image (max 2MB). Supported formats: JPG, PNG, GIF
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ mt: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Configure your tax settings. You can change these later in Settings.
            </Alert>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Tooltip title="Default Tax Rate - Enter the default tax percentage (0-100) that will be applied to all products unless overridden. This rate is used when calculating taxes on transactions.">
                  <TextField
                    fullWidth
                    label="Default Tax Rate (%)"
                    type="number"
                    value={taxConfig.defaultTaxRate}
                    onChange={(e) =>
                      setTaxConfig({
                        ...taxConfig,
                        defaultTaxRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    onKeyDown={(e) => handleKeyDown(e, undefined, true)}
                    inputRef={taxRateRef}
                    onFocus={(e) => {
                      if (taxConfig.defaultTaxRate === 0) {
                        e.target.select();
                      }
                    }}
                    error={!!errors.taxRate}
                    helperText={errors.taxRate || 'Enter the default tax rate percentage (0-100)'}
                    inputProps={{ min: 0, max: 100, step: 0.01 }}
                    disabled={saving}
                    size="medium"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '18px',
                        minHeight: 56,
                        '& input': {
                          padding: '16px 14px',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '16px',
                      },
                    }}
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12}>
                <Tooltip title="Tax Inclusive Pricing - When enabled, product prices already include tax. When disabled, tax is added at checkout. This affects how prices are displayed and calculated throughout the system.">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={taxConfig.taxInclusive}
                        onChange={(e) =>
                          setTaxConfig({
                            ...taxConfig,
                            taxInclusive: e.target.checked,
                          })
                        }
                        disabled={saving}
                      />
                    }
                    label="Tax is included in prices"
                  />
                </Tooltip>
              </Grid>
            </Grid>
          </Box>
        );

      case 3:
        return (
          <Box sx={{ mt: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Set the USD to LBP exchange rate. This is used for currency conversions.
            </Alert>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Tooltip title="USD to LBP Exchange Rate - Enter the current exchange rate from US Dollars to Lebanese Pounds. This rate is used throughout the system for currency conversion in transactions, reports, and displays. Update this regularly to reflect current market rates. This is a required field.">
                  <TextField
                    fullWidth
                    label="USD to LBP Exchange Rate *"
                    type="number"
                    value={currencySettings.usdToLbp}
                    onChange={(e) =>
                      setCurrencySettings({
                        ...currencySettings,
                        usdToLbp: parseFloat(e.target.value) || 0,
                      })
                    }
                    onKeyDown={(e) => handleKeyDown(e, undefined, true)}
                    inputRef={exchangeRateRef}
                    error={!!errors.exchangeRate}
                    helperText={
                      errors.exchangeRate || 'Enter the exchange rate (1 USD = X LBP)'
                    }
                    inputProps={{ min: 1, step: 1 }}
                    disabled={saving}
                    size="medium"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '18px',
                        minHeight: 56,
                        '& input': {
                          padding: '16px 14px',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '16px',
                      },
                    }}
                  />
                </Tooltip>
              </Grid>
            </Grid>
          </Box>
        );

      case 4:
        return (
          <Box sx={{ mt: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Configure your printer settings. These settings affect how receipts are printed.
            </Alert>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Tooltip title="Printer Name - Enter the exact name of your printer as it appears in Windows Printers. Leave empty to use the default system printer. The printer name must match exactly for the system to find it.">
                  <TextField
                    fullWidth
                    label="Printer Name"
                    value={printerSettings.printerName}
                    onChange={(e) =>
                      setPrinterSettings({
                        ...printerSettings,
                        printerName: e.target.value,
                      })
                    }
                    onKeyDown={(e) => handleKeyDown(e, paperWidthRef)}
                    inputRef={printerNameRef}
                    placeholder="Leave empty for default printer"
                    helperText="Enter the exact name of your printer (as shown in Windows Printers). Leave empty to use the default printer."
                    disabled={saving}
                    size="medium"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '18px',
                        minHeight: 56,
                        '& input': {
                          padding: '16px 14px',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '16px',
                      },
                    }}
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Paper Width (mm) *"
                  type="number"
                  value={printerSettings.paperWidth}
                  onChange={(e) =>
                    setPrinterSettings({
                      ...printerSettings,
                      paperWidth: parseFloat(e.target.value) || 80,
                    })
                  }
                  onKeyDown={(e) => handleKeyDown(e, undefined, true)}
                  inputRef={paperWidthRef}
                  error={!!errors.paperWidth}
                  helperText={errors.paperWidth || 'Minimum: 58mm, Maximum: 110mm'}
                  inputProps={{ min: 58, max: 110, step: 1 }}
                  disabled={saving}
                  size="medium"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontSize: '18px',
                      minHeight: 56,
                      '& input': {
                        padding: '16px 14px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '16px',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={printerSettings.autoPrint}
                      onChange={(e) =>
                        setPrinterSettings({
                          ...printerSettings,
                          autoPrint: e.target.checked,
                        })
                      }
                      disabled={saving}
                    />
                  }
                  label="Auto Print Receipts"
                />
                <Typography
                  variant="caption"
                  display="block"
                  color="text.secondary"
                  sx={{ mt: 1, fontSize: '12px' }}
                >
                  Automatically print receipts after completing transactions.
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={cashDrawerSettings.autoOpen}
                      onChange={(e) =>
                        setCashDrawerSettings({
                          autoOpen: e.target.checked,
                        })
                      }
                      disabled={saving}
                    />
                  }
                  label="Auto Open Cash Drawer"
                />
                <Typography
                  variant="caption"
                  display="block"
                  color="text.secondary"
                  sx={{ mt: 1, fontSize: '12px' }}
                >
                  Automatically open the cash drawer when a transaction completes. The cash drawer must be connected to your receipt printer via the RJ-11 port.
                </Typography>
              </Grid>
            </Grid>
          </Box>
        );

      case 5:
        return (
          <Box sx={{ mt: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Configure business rules that affect how your store operates.
            </Alert>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel sx={{ fontSize: '16px' }}>Rounding Method</InputLabel>
                  <Select
                    value={businessRules.roundingMethod}
                    label="Rounding Method"
                    onChange={(e) =>
                      setBusinessRules({
                        ...businessRules,
                        roundingMethod: e.target.value,
                      })
                    }
                    disabled={saving}
                    size="medium"
                    sx={{
                      fontSize: '18px',
                      minHeight: 56,
                      '& .MuiSelect-select': {
                        padding: '16px 14px',
                      },
                    }}
                  >
                    <MenuItem value="round" sx={{ fontSize: '16px', minHeight: 48 }}>Round</MenuItem>
                    <MenuItem value="floor" sx={{ fontSize: '16px', minHeight: 48 }}>Floor (Round Down)</MenuItem>
                    <MenuItem value="ceil" sx={{ fontSize: '16px', minHeight: 48 }}>Ceil (Round Up)</MenuItem>
                    <MenuItem value="none" sx={{ fontSize: '16px', minHeight: 48 }}>No Rounding</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={businessRules.allowNegativeStock}
                      onChange={(e) =>
                        setBusinessRules({
                          ...businessRules,
                          allowNegativeStock: e.target.checked,
                        })
                      }
                      disabled={saving}
                    />
                  }
                  label="Allow Negative Stock"
                />
                <Typography
                  variant="caption"
                  display="block"
                  color="text.secondary"
                  sx={{ mt: 1, fontSize: '12px' }}
                >
                  When enabled, products can be sold even when stock is below zero. When disabled,
                  sales will be blocked when stock is insufficient.
                </Typography>
              </Grid>
            </Grid>
          </Box>
        );

      case 6:
        return (
          <Box sx={{ mt: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Configure notification settings. These affect how you receive notifications in the system.
            </Alert>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.soundEnabled}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          soundEnabled: e.target.checked,
                        })
                      }
                      disabled={saving}
                    />
                  }
                  label="Enable Notification Sounds"
                />
                <Typography
                  variant="caption"
                  display="block"
                  color="text.secondary"
                  sx={{ mt: 1, fontSize: '12px' }}
                >
                  Play a sound when new notifications arrive.
                </Typography>
              </Grid>
              {notificationSettings.soundEnabled && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Sound Volume"
                      type="number"
                      value={notificationSettings.soundVolume}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          soundVolume: parseFloat(e.target.value) || 0.5,
                        })
                      }
                      onKeyDown={(e) => handleKeyDown(e, undefined, true)}
                      inputRef={soundVolumeRef}
                      inputProps={{ min: 0, max: 1, step: 0.1 }}
                      helperText="Volume level (0.0 to 1.0)"
                      disabled={saving}
                      size="medium"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          fontSize: '18px',
                          minHeight: 56,
                          '& input': {
                            padding: '16px 14px',
                          },
                        },
                        '& .MuiInputLabel-root': {
                          fontSize: '16px',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel sx={{ fontSize: '16px' }}>Priority Filter</InputLabel>
                      <Select
                        value={notificationSettings.priorityFilter}
                        label="Priority Filter"
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            priorityFilter: e.target.value,
                          })
                        }
                        disabled={saving}
                        size="medium"
                        sx={{
                          fontSize: '18px',
                          minHeight: 56,
                          '& .MuiSelect-select': {
                            padding: '16px 14px',
                          },
                        }}
                      >
                        <MenuItem value="all" sx={{ fontSize: '16px', minHeight: 48 }}>All Priorities</MenuItem>
                        <MenuItem value="urgent" sx={{ fontSize: '16px', minHeight: 48 }}>Urgent Only</MenuItem>
                        <MenuItem value="high" sx={{ fontSize: '16px', minHeight: 48 }}>High and Urgent</MenuItem>
                        <MenuItem value="normal" sx={{ fontSize: '16px', minHeight: 48 }}>Normal, High, and Urgent</MenuItem>
                      </Select>
                    </FormControl>
                    <Typography
                      variant="caption"
                      display="block"
                      color="text.secondary"
                      sx={{ mt: 1, fontSize: '12px' }}
                    >
                      Only play sounds for notifications matching the selected priority level or higher.
                    </Typography>
                  </Grid>
                </>
              )}
            </Grid>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Dialog
        open={open}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown
        PaperProps={{
          sx: {
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle>
          <Typography variant="h5" component="div" fontWeight="bold">
            {passwordOnly ? 'Change Password' : "Welcome! Let's set up your store"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {passwordOnly 
              ? 'Please change your password to secure your account'
              : 'Complete these steps to get started with DigitalizePOS'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {!passwordOnly && (
                <Stepper activeStep={activeStep} sx={{ mt: 2, mb: 4 }}>
                  {steps.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              )}
              {passwordOnly && (
                <Box sx={{ mt: 2, mb: 4 }}>
                  <Typography variant="h6" gutterBottom>
                    Change Password
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Please change your password to secure your account
                  </Typography>
                </Box>
              )}
              {renderStepContent(activeStep)}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Tooltip title={activeStep === 0 ? "You're on the first step" : "Go back to the previous setup step to review or change your settings."}>
            <span>
              <Button 
                onClick={handleBack} 
                disabled={activeStep === 0 || saving || loading}
                size="large"
                sx={{
                  minHeight: 56,
                  fontSize: '18px',
                  padding: '12px 32px',
                  fontWeight: 600,
                }}
              >
                Back
              </Button>
            </span>
          </Tooltip>
          <Box sx={{ flex: '1 1 auto' }} />
          {(passwordOnly && activeStep === 0) || activeStep === steps.length - 1 ? (
            <Tooltip title={saving ? "Saving..." : passwordOnly ? "Change Password - Save your new password and complete setup" : "Complete Setup - Save all your settings and finish the setup wizard. You can change these settings later in the Settings page."}>
              <span>
                <Button
                  onClick={passwordOnly && activeStep === 0 ? handleNext : handleComplete}
                  variant="contained"
                  disabled={saving}
                  size="large"
                  sx={{
                    minHeight: 56,
                    fontSize: '18px',
                    padding: '12px 32px',
                    fontWeight: 600,
                  }}
                >
                  {saving ? 'Saving...' : passwordOnly ? 'Change Password' : 'Complete Setup'}
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Tooltip title="Next Step - Continue to the next setup step. Make sure all required fields are filled correctly.">
              <span>
                <Button 
                  onClick={handleNext} 
                  variant="contained" 
                  disabled={saving}
                  size="large"
                  sx={{
                    minHeight: 56,
                    fontSize: '18px',
                    padding: '12px 32px',
                    fontWeight: 600,
                  }}
                >
                  Next
                </Button>
              </span>
            </Tooltip>
          )}
        </DialogActions>
      </Dialog>
      <Toast toast={toast} onClose={hideToast} />
    </>
  );
};

export default SetupWizard;

