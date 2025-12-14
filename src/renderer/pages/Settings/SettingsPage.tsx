import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  TextField,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Tooltip,
} from '@mui/material';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import {
  Store,
  Receipt,
  Print,
  Business,
  Notifications as NotificationsIcon,
  CurrencyExchange,
  Backup as BackupIcon,
  VpnKey,
  Image as ImageIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState, AppDispatch } from '../../store';
import { SettingsService } from '../../services/settings.service';
import { CurrencyService } from '../../services/currency.service';
import MainLayout from '../../components/layout/MainLayout';
import { playNotificationSound } from '../../utils/notificationSound';
import { AuthState } from '../../store/slices/auth.slice';
import { setBusinessRules as setBusinessRulesAction } from '../../store/slices/settings.slice';
import { ROUTES } from '../../utils/constants';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: '24px' }}>{children}</Box>}
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState): AuthState => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Field errors for each tab
  const [storeInfoErrors, setStoreInfoErrors] = useState<{
    name?: string;
  }>({});
  const [taxConfigErrors, setTaxConfigErrors] = useState<{
    defaultTaxRate?: string;
  }>({});
  const [currencyErrors, setCurrencyErrors] = useState<{
    usdToLbp?: string;
  }>({});

  // Store Information
  const [storeInfo, setStoreInfo] = useState<{
    name: string;
    address: string;
    phone: string;
    logo?: string;
  }>({
    name: '',
    address: '',
    phone: '',
    logo: '',
  });

  // Tax Configuration
  const [taxConfig, setTaxConfig] = useState({
    defaultTaxRate: 0,
    taxInclusive: false,
  });


  // Business Rules (needed for receipt preview calculation)
  const [businessRules, setBusinessRules] = useState({
    roundingMethod: 'round',
    allowNegativeStock: false,
  });

  // Currency Settings (needed for receipt preview)
  const [currencySettings, setCurrencySettings] = useState({
    usdToLbp: 89000, // Default fallback, will be replaced when settings load
  });

  // Printer Settings (needed for receipt preview)
  const [printerSettings, setPrinterSettings] = useState({
    paperWidth: 80,
    autoPrint: true,
    printerName: '',
  });


  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    soundEnabled: true,
    soundVolume: 0.5,
    enabledTypes: [] as string[],
    priorityFilter: 'all',
  });

  // Initial values for change detection
  const [initialStoreInfo, setInitialStoreInfo] = useState<{
    name: string;
    address: string;
    phone: string;
    logo?: string;
  }>({
    name: '',
    address: '',
    phone: '',
    logo: '',
  });
  const [initialTaxConfig, setInitialTaxConfig] = useState({
    defaultTaxRate: 0,
    taxInclusive: false,
  });
  const [initialPrinterSettings, setInitialPrinterSettings] = useState({
    paperWidth: 80,
    autoPrint: true,
    printerName: '',
  });
  const [initialBusinessRules, setInitialBusinessRules] = useState({
    roundingMethod: 'round',
    allowNegativeStock: false,
  });
  const [initialNotificationSettings, setInitialNotificationSettings] = useState({
    soundEnabled: true,
    soundVolume: 0.5,
    enabledTypes: [] as string[],
    priorityFilter: 'all',
  });
  const [initialCurrencySettings, setInitialCurrencySettings] = useState({
    usdToLbp: 89000,
  });

  const loadAllSettings = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const [
        storeInfoResult,
        taxConfigResult,
        printerSettingsResult,
        businessRulesResult,
        notificationSettingsResult,
        exchangeRate,
      ] = await Promise.all([
        SettingsService.getStoreInfo(user.id),
        SettingsService.getTaxConfig(user.id),
        SettingsService.getPrinterSettings(user.id),
        SettingsService.getBusinessRules(user.id),
        SettingsService.getNotificationSettings(user.id),
        CurrencyService.getExchangeRate(),
      ]);

      if (storeInfoResult.success && storeInfoResult.storeInfo) {
        const loadedStoreInfo = {
          name: storeInfoResult.storeInfo.name,
          address: storeInfoResult.storeInfo.address,
          phone: storeInfoResult.storeInfo.phone,
          logo: storeInfoResult.storeInfo.logo || '',
        };
        setStoreInfo(loadedStoreInfo);
        setInitialStoreInfo(loadedStoreInfo);
      }
      if (taxConfigResult.success && taxConfigResult.taxConfig) {
        setTaxConfig(taxConfigResult.taxConfig);
        setInitialTaxConfig(taxConfigResult.taxConfig);
      }
      if (printerSettingsResult.success && printerSettingsResult.printerSettings) {
        const minPaperWidth = 58; // Minimum paper width in mm
        const loadedSettings = {
          ...printerSettingsResult.printerSettings,
          paperWidth: Math.max(minPaperWidth, printerSettingsResult.printerSettings.paperWidth || 80),
          printerName: printerSettingsResult.printerSettings.printerName || '',
        };
        setPrinterSettings(loadedSettings);
        setInitialPrinterSettings(loadedSettings);
      }
      if (businessRulesResult.success && businessRulesResult.businessRules) {
        setBusinessRules(businessRulesResult.businessRules);
        setInitialBusinessRules(businessRulesResult.businessRules);
      }
      if (notificationSettingsResult.success && notificationSettingsResult.notificationSettings) {
        setNotificationSettings(notificationSettingsResult.notificationSettings);
        setInitialNotificationSettings(notificationSettingsResult.notificationSettings);
      }
      // Load exchange rate
      const currencySettingsValue = { usdToLbp: exchangeRate };
      setCurrencySettings(currencySettingsValue);
      setInitialCurrencySettings(currencySettingsValue);
    } catch (error) {
      console.error('Error loading settings:', error);
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.id, showToast]);

  useEffect(() => {
    if (user?.id) {
      loadAllSettings();
    }
  }, [user?.id, loadAllSettings]);

  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  const validateStoreInfo = useCallback((): boolean => {
    const errors: { name?: string } = {};

    if (!storeInfo.name || storeInfo.name.trim() === '') {
      errors.name = 'Store name is required';
    }

    setStoreInfoErrors(errors);
    return Object.keys(errors).length === 0;
  }, [storeInfo.name]);

  const handleSaveStoreInfo = useCallback(async () => {
    if (!user?.id) return;

    if (!validateStoreInfo()) {
      return;
    }

    // Check if values have changed
    if (
      storeInfo.name === initialStoreInfo.name &&
      storeInfo.address === initialStoreInfo.address &&
      storeInfo.phone === initialStoreInfo.phone &&
      storeInfo.logo === initialStoreInfo.logo
    ) {
      showToast('No changes made', 'info');
      return;
    }

    setSaving(true);
    try {
      const result = await SettingsService.setStoreInfo(storeInfo, user.id);
      if (result.success) {
        setStoreInfoErrors({});
        setInitialStoreInfo(storeInfo);
        showToast('Successfully updated', 'success');
      } else {
        showToast(result.error || 'Failed to save store information', 'error');
      }
    } catch (error) {
      console.error('Error saving store info:', error);
      showToast('Failed to save store information', 'error');
    } finally {
      setSaving(false);
    }
  }, [user?.id, validateStoreInfo, storeInfo, initialStoreInfo, showToast]);

  const validateTaxConfig = useCallback((): boolean => {
    const errors: { defaultTaxRate?: string } = {};

    if (taxConfig.defaultTaxRate === undefined || taxConfig.defaultTaxRate === null || taxConfig.defaultTaxRate < 0 || taxConfig.defaultTaxRate > 100) {
      errors.defaultTaxRate = 'Default tax rate is required and must be between 0 and 100';
    }

    setTaxConfigErrors(errors);
    return Object.keys(errors).length === 0;
  }, [taxConfig.defaultTaxRate]);

  const handleSaveTaxConfig = useCallback(async () => {
    if (!user?.id) return;

    if (!validateTaxConfig()) {
      return;
    }

    // Check if values have changed
    if (
      taxConfig.defaultTaxRate === initialTaxConfig.defaultTaxRate &&
      taxConfig.taxInclusive === initialTaxConfig.taxInclusive
    ) {
      showToast('No changes made', 'info');
      return;
    }

    setSaving(true);
    try {
      const result = await SettingsService.setTaxConfig(taxConfig, user.id);
      if (result.success) {
        setTaxConfigErrors({});
        setInitialTaxConfig(taxConfig);
        showToast('Successfully updated', 'success');
      } else {
        showToast(result.error || 'Failed to save tax configuration', 'error');
      }
    } catch (error) {
      console.error('Error saving tax config:', error);
      showToast('Failed to save tax configuration', 'error');
    } finally {
      setSaving(false);
    }
  }, [user?.id, validateTaxConfig, taxConfig, initialTaxConfig, showToast]);


  const handleSavePrinterSettings = useCallback(async () => {
    if (!user?.id) return;

    // Check if values have changed
    if (
      printerSettings.paperWidth === initialPrinterSettings.paperWidth &&
      printerSettings.autoPrint === initialPrinterSettings.autoPrint &&
      printerSettings.printerName === initialPrinterSettings.printerName
    ) {
      showToast('No changes made', 'info');
      return;
    }

    setSaving(true);
    try {
      const result = await SettingsService.setPrinterSettings(printerSettings, user.id);
      if (result.success) {
        setInitialPrinterSettings(printerSettings);
        showToast('Successfully updated', 'success');
      } else {
        showToast(result.error || 'Failed to save printer settings', 'error');
      }
    } catch (error) {
      console.error('Error saving printer settings:', error);
      showToast('Failed to save printer settings', 'error');
    } finally {
      setSaving(false);
    }
  }, [user?.id, printerSettings, initialPrinterSettings, showToast]);


  const handleSaveBusinessRules = useCallback(async () => {
    if (!user?.id) return;

    // Check if values have changed
    if (
      businessRules.roundingMethod === initialBusinessRules.roundingMethod &&
      businessRules.allowNegativeStock === initialBusinessRules.allowNegativeStock
    ) {
      showToast('No changes made', 'info');
      return;
    }

    setSaving(true);
    try {
      const result = await SettingsService.setBusinessRules(businessRules, user.id);
      if (result.success) {
        // Update Redux store with new business rules
        dispatch(setBusinessRulesAction(businessRules));
        setInitialBusinessRules(businessRules);
        showToast('Successfully updated', 'success');
      } else {
        showToast(result.error || 'Failed to save business rules', 'error');
      }
    } catch (error) {
      console.error('Error saving business rules:', error);
      showToast('Failed to save business rules', 'error');
    } finally {
      setSaving(false);
    }
  }, [user?.id, businessRules, initialBusinessRules, dispatch, showToast]);

  const handleSaveNotificationSettings = useCallback(async () => {
    if (!user?.id) return;

    // Check if values have changed
    if (
      notificationSettings.soundEnabled === initialNotificationSettings.soundEnabled &&
      notificationSettings.soundVolume === initialNotificationSettings.soundVolume &&
      JSON.stringify(notificationSettings.enabledTypes) === JSON.stringify(initialNotificationSettings.enabledTypes) &&
      notificationSettings.priorityFilter === initialNotificationSettings.priorityFilter
    ) {
      showToast('No changes made', 'info');
      return;
    }

    setSaving(true);
    try {
      const result = await SettingsService.setNotificationSettings(notificationSettings, user.id);
      if (result.success) {
        setInitialNotificationSettings(notificationSettings);
        showToast('Successfully updated', 'success');
      } else {
        showToast(result.error || 'Failed to save notification settings', 'error');
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
      showToast('Failed to save notification settings', 'error');
    } finally {
      setSaving(false);
    }
  }, [user?.id, notificationSettings, initialNotificationSettings, showToast]);

  const handleTestSound = useCallback(async () => {
    // Ensure we have a valid volume (default to 0.5 if not set or if 0)
    const volume = notificationSettings.soundVolume && notificationSettings.soundVolume > 0 
      ? notificationSettings.soundVolume 
      : 0.5;
    
    if (!notificationSettings.soundEnabled) {
      showToast('Please enable notification sounds first', 'warning');
      return;
    }
    
    try {
      await playNotificationSound(volume);
    } catch (error) {
      console.error('Error playing test sound:', error);
      showToast('Failed to play test sound. Please check your browser audio settings.', 'error');
    }
  }, [notificationSettings.soundEnabled, notificationSettings.soundVolume, showToast]);

  const validateCurrencySettings = useCallback((): boolean => {
    const errors: { usdToLbp?: string } = {};

    if (currencySettings.usdToLbp === undefined || currencySettings.usdToLbp === null || currencySettings.usdToLbp <= 0) {
      errors.usdToLbp = 'Exchange rate is required and must be greater than 0';
    }

    setCurrencyErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currencySettings.usdToLbp]);

  const handleSaveCurrencySettings = useCallback(async () => {
    if (!user?.id) return;

    if (!validateCurrencySettings()) {
      return;
    }

    // Check if values have changed
    if (currencySettings.usdToLbp === initialCurrencySettings.usdToLbp) {
      showToast('No changes made', 'info');
      return;
    }

    setSaving(true);
    try {
      await CurrencyService.setExchangeRate(currencySettings.usdToLbp, user.id);
      setCurrencyErrors({});
      setInitialCurrencySettings(currencySettings);
      showToast('Successfully updated', 'success');
    } catch (error) {
      console.error('Error saving currency settings:', error);
      showToast('Failed to save currency settings', 'error');
    } finally {
      setSaving(false);
    }
  }, [user?.id, validateCurrencySettings, currencySettings, initialCurrencySettings, showToast]);

  // Memoize onChange handlers for store info
  const handleStoreNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStoreInfo((prev) => ({ ...prev, name: e.target.value }));
    if (storeInfoErrors.name) {
      setStoreInfoErrors((prev) => ({ ...prev, name: undefined }));
    }
  }, [storeInfoErrors.name]);

  const handleStoreAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStoreInfo((prev) => ({ ...prev, address: e.target.value }));
  }, []);

  const handleStorePhoneChange = useCallback((value: string | undefined) => {
    setStoreInfo((prev) => ({ ...prev, phone: value || '' }));
  }, []);

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

  // Memoize onChange handlers for tax config
  const handleTaxRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTaxConfig((prev) => ({ ...prev, defaultTaxRate: parseFloat(e.target.value) || 0 }));
    if (taxConfigErrors.defaultTaxRate) {
      setTaxConfigErrors((prev) => ({ ...prev, defaultTaxRate: undefined }));
    }
  }, [taxConfigErrors.defaultTaxRate]);

  const handleTaxInclusiveChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTaxConfig((prev) => ({ ...prev, taxInclusive: e.target.checked }));
  }, []);

  // Memoize onChange handlers for other settings

  const handlePaperWidthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const minPaperWidth = 58; // Minimum paper width in mm
    const value = parseInt(e.target.value) || minPaperWidth;
    const clampedValue = Math.max(minPaperWidth, value);
    setPrinterSettings((prev) => ({
      ...prev,
      paperWidth: clampedValue,
    }));
  }, []);

  const handleAutoPrintChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPrinterSettings((prev) => ({ ...prev, autoPrint: e.target.checked }));
  }, []);

  const handlePrinterNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPrinterSettings((prev) => ({ ...prev, printerName: e.target.value }));
  }, []);


  const handleRoundingMethodChange = useCallback((e: { target: { value: string } }) => {
    setBusinessRules((prev) => ({ ...prev, roundingMethod: e.target.value }));
  }, []);

  const handleAllowNegativeStockChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBusinessRules((prev) => ({ ...prev, allowNegativeStock: e.target.checked }));
  }, []);

  const handleSoundEnabledChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNotificationSettings((prev) => ({ ...prev, soundEnabled: e.target.checked }));
  }, []);

  const handleSoundVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNotificationSettings((prev) => ({
      ...prev,
      soundVolume: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0.5)),
    }));
  }, []);

  const handlePriorityFilterChange = useCallback((e: { target: { value: string } }) => {
    setNotificationSettings((prev) => ({ ...prev, priorityFilter: e.target.value }));
  }, []);

  const handleCurrencyRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = parseFloat(e.target.value);
    const newValue = isNaN(inputValue) || inputValue <= 0 
      ? Math.max(1, currencySettings.usdToLbp || 89000)
      : inputValue;
    setCurrencySettings({ usdToLbp: newValue });
    if (currencyErrors.usdToLbp) {
      setCurrencyErrors((prev) => ({ ...prev, usdToLbp: undefined }));
    }
  }, [currencySettings.usdToLbp, currencyErrors.usdToLbp]);

  const handleNavigateToLicense = useCallback(() => {
    // Only main user (ID = 1) can access license page
    if (user?.id !== 1) {
      navigate(ROUTES.ACCESS_DENIED);
      return;
    }
    navigate(ROUTES.LICENSE);
  }, [navigate, user?.id]);

  const handleNavigateToBackup = useCallback(() => {
    // Only main user (ID = 1) can access backup page
    if (user?.id !== 1) {
      navigate(ROUTES.ACCESS_DENIED);
      return;
    }
    navigate(ROUTES.BACKUP);
  }, [navigate, user?.id]);

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

  const titleBarSx = useMemo(() => ({
    backgroundColor: '#1a237e',
    padding: '8px 12px',
    borderBottom: '1px solid #000051',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }), []);

  const titleTypographySx = useMemo(() => ({
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const headerButtonSx = useMemo(() => ({
    textTransform: 'none',
    color: '#ffffff',
    fontSize: '16px',
    padding: '8px 20px',
    minWidth: 'auto',
    minHeight: '44px',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
  }), []);

  const tabsSx = useMemo(() => ({
    borderBottom: '1px solid #e0e0e0',
    '& .MuiTab-root': {
      textTransform: 'none',
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '48px',
      '&.Mui-selected': {
        color: '#1a237e',
      },
    },
    '& .MuiTabs-indicator': {
      backgroundColor: '#1a237e',
    },
    '& .MuiTabs-scrollButtons': {
      color: '#1a237e',
      '&.Mui-disabled': {
        opacity: 0.3,
      },
    },
  }), []);

  const sectionTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const textFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '16px',
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
    },
  }), []);

  const saveButtonSx = useMemo(() => ({
    backgroundColor: '#1a237e',
    color: '#ffffff',
    borderRadius: 0,
    padding: '8px 20px',
    minHeight: '44px',
    fontSize: '16px',
    fontWeight: 500,
    textTransform: 'none',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    border: '1px solid #000051',
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: '#534bae',
      boxShadow: 'none',
    },
    '&:active': {
      backgroundColor: '#000051',
    },
    '&:disabled': {
      backgroundColor: '#e0e0e0',
      color: '#9e9e9e',
      border: '1px solid #c0c0c0',
    },
  }), []);

  const infoAlertSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #90caf9',
    backgroundColor: '#e3f2fd',
    '& .MuiAlert-icon': {
      color: '#1565c0',
    },
  }), []);

  if (loading) {
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
        <Paper elevation={0} sx={paperSx}>
          {/* Title Bar */}
          <Box sx={titleBarSx}>
            <Typography variant="body2" sx={titleTypographySx}>
            DigitalizePOS - Settings
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {user?.id === 1 && (
                <>
                  <Tooltip title="License Management - View and manage your DigitalizePOS license, activation status, and subscription details.">
                    <span>
                      <Button
                        variant="text"
                        startIcon={<VpnKey />}
                        onClick={handleNavigateToLicense}
                        sx={headerButtonSx}
                      >
                        License
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title="Backup & Restore - Create backups of your data or restore from a previous backup. Essential for data protection and recovery.">
                    <span>
                      <Button
                        variant="text"
                        startIcon={<BackupIcon />}
                        onClick={handleNavigateToBackup}
                        sx={headerButtonSx}
                      >
                        Backup & Restore
                      </Button>
                    </span>
                  </Tooltip>
                </>
              )}
            </Box>
          </Box>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="settings tabs"
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={tabsSx}
          >
            <Tab
              icon={<Store />}
              iconPosition="start"
              label="Store Information"
              id="settings-tab-0"
              aria-controls="settings-tabpanel-0"
            />
            <Tab
              icon={<Receipt />}
              iconPosition="start"
              label="Tax Configuration"
              id="settings-tab-1"
              aria-controls="settings-tabpanel-1"
            />
            <Tab
              icon={<Print />}
              iconPosition="start"
              label="Printer"
              id="settings-tab-2"
              aria-controls="settings-tabpanel-2"
            />
            <Tab
              icon={<Business />}
              iconPosition="start"
              label="Business Rules"
              id="settings-tab-3"
              aria-controls="settings-tabpanel-3"
            />
            <Tab
              icon={<NotificationsIcon />}
              iconPosition="start"
              label="Notifications"
              id="settings-tab-4"
              aria-controls="settings-tabpanel-4"
            />
            <Tab
              icon={<CurrencyExchange />}
              iconPosition="start"
              label="Currency"
              id="settings-tab-5"
              aria-controls="settings-tabpanel-5"
            />
          </Tabs>

          {/* Store Information Tab */}
          <TabPanel value={activeTab} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={sectionTitleTypographySx}
                >
                  Store Information
                </Typography>
                <Divider sx={{ mb: 3, borderColor: '#e0e0e0' }} />
              </Grid>
              <Grid item xs={12}>
                <Tooltip title="Store Name - Enter the official name of your store. This will appear on receipts, reports, and other documents. Required field.">
                  <TextField
                    fullWidth
                    label="Store Name *"
                    value={storeInfo.name}
                    onChange={handleStoreNameChange}
                    error={!!storeInfoErrors.name}
                    helperText={storeInfoErrors.name}
                    disabled={saving}
                    sx={textFieldSx}
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12}>
                <Tooltip title="Address - Enter your store's physical address. This will appear on receipts and reports. Optional field.">
                  <TextField
                    fullWidth
                    label="Address"
                    value={storeInfo.address}
                    onChange={handleStoreAddressChange}
                    multiline
                    rows={3}
                    disabled={saving}
                    sx={textFieldSx}
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12} md={6}>
                <Tooltip title="Phone - Enter your store's contact phone number. This will appear on receipts and reports. Optional field.">
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontSize: '16px', color: 'text.secondary' }}>
                      Phone
                    </Typography>
                    <PhoneInput
                      international
                      defaultCountry="LB"
                      value={storeInfo.phone}
                      onChange={handleStorePhoneChange}
                      disabled={saving}
                      className="mui-phone-input"
                      style={{
                        '--PhoneInputInput-height': '44px',
                        '--PhoneInputInput-fontSize': '16px',
                      } as React.CSSProperties}
                    />
                    <style>{`
                      .mui-phone-input {
                        width: 100%;
                      }
                      .mui-phone-input .PhoneInputInput {
                        width: 100%;
                        height: 44px;
                        padding: 10px 14px;
                        font-size: 16px;
                        border: 1px solid #c0c0c0;
                        border-radius: 0;
                        font-family: inherit;
                        background-color: #ffffff;
                      }
                      .mui-phone-input .PhoneInputInput:focus {
                        border-color: #1a237e;
                        border-width: 1px;
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
                  sx={{ fontSize: '13px', fontWeight: 600, fontFamily: 'system-ui, -apple-system, sans-serif', mb: 1 }}
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
                        backgroundColor: '#ffffff',
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
                        <Button
                          variant="outlined"
                          startIcon={<DeleteIcon />}
                          onClick={handleRemoveLogo}
                          disabled={saving}
                          sx={{
                            textTransform: 'none',
                            fontSize: '13px',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            borderColor: '#c0c0c0',
                            color: '#616161',
                            '&:hover': {
                              borderColor: '#d32f2f',
                              color: '#d32f2f',
                              backgroundColor: 'rgba(211, 47, 47, 0.04)',
                            },
                          }}
                        >
                          Remove Logo
                        </Button>
                      </Tooltip>
                    </Box>
                  )}
                  <Tooltip title="Upload Logo - Select an image file (JPG, PNG, GIF) up to 2MB to use as your store logo on receipts and reports.">
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<ImageIcon />}
                      disabled={saving}
                      sx={{
                        textTransform: 'none',
                        fontSize: '13px',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        borderColor: '#c0c0c0',
                        color: '#616161',
                        '&:hover': {
                          borderColor: '#1a237e',
                          color: '#1a237e',
                          backgroundColor: 'rgba(26, 35, 126, 0.04)',
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
                  </Tooltip>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '12px',
                      color: '#616161',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  >
                    Recommended: PNG or JPG format, max 2MB. Logo will be displayed on receipts and other documents.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Tooltip title={saving ? "Saving store information..." : "Save Store Information - Save your store name, address, phone number, and logo. This information will appear on receipts and reports."}>
                  <Button
                    variant="contained"
                    onClick={handleSaveStoreInfo}
                    disabled={saving}
                    sx={saveButtonSx}
                  >
                    {saving ? 'Saving...' : 'Save Store Information'}
                  </Button>
                </Tooltip>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Tax Configuration Tab */}
          <TabPanel value={activeTab} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={sectionTitleTypographySx}
                >
                  Tax Configuration
                </Typography>
                <Divider sx={{ mb: 3, borderColor: '#e0e0e0' }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Tooltip title="Default Tax Rate - Enter the default tax percentage (0-100) that will be applied to all products unless overridden. This rate is used when calculating taxes on transactions. Required field.">
                  <TextField
                    fullWidth
                    label="Default Tax Rate (%) *"
                    type="number"
                    value={taxConfig.defaultTaxRate}
                    onChange={handleTaxRateChange}
                    onFocus={(e) => {
                      if (taxConfig.defaultTaxRate === 0) {
                        e.target.select();
                      }
                    }}
                    inputProps={{ min: 0, max: 100, step: 0.01 }}
                    error={!!taxConfigErrors.defaultTaxRate}
                    helperText={taxConfigErrors.defaultTaxRate}
                    disabled={saving}
                    sx={textFieldSx}
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12} md={6}>
                <Tooltip title="Tax Inclusive Pricing - When enabled, product prices already include tax. When disabled, tax is added at checkout. This affects how prices are displayed and calculated throughout the system.">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={taxConfig.taxInclusive}
                        onChange={handleTaxInclusiveChange}
                        disabled={saving}
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: '13px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        Tax Inclusive Pricing
                      </Typography>
                    }
                  />
                </Tooltip>
                <Typography
                  variant="caption"
                  display="block"
                  color="text.secondary"
                  sx={{
                    mt: 1,
                    fontSize: '12px',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    color: '#616161',
                  }}
                >
                  When enabled, product prices include tax. When disabled, tax is added at checkout.
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Tooltip title={saving ? "Saving tax configuration..." : "Save Tax Configuration - Save your default tax rate and tax inclusive pricing settings. These settings affect how taxes are calculated on all transactions."}>
                  <Button
                    variant="contained"
                    onClick={handleSaveTaxConfig}
                    disabled={saving}
                    sx={saveButtonSx}
                  >
                    {saving ? 'Saving...' : 'Save Tax Configuration'}
                  </Button>
                </Tooltip>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Printer Settings Tab */}
          <TabPanel value={activeTab} index={2}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={sectionTitleTypographySx}
                >
                  Printer Settings
                </Typography>
                <Divider sx={{ mb: 3, borderColor: '#e0e0e0' }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Tooltip title="Printer Name - Enter the exact name of your printer as it appears in Windows Printers. Leave empty to use the default system printer. The printer name must match exactly for the system to find it.">
                  <TextField
                    fullWidth
                    label="Printer Name"
                    value={printerSettings.printerName || ''}
                    onChange={handlePrinterNameChange}
                    placeholder="Leave empty for default printer"
                    helperText="Enter the exact name of your printer (as shown in Windows Printers). Leave empty to use the default printer."
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12} md={6}>
                <Tooltip title="Paper Width - Enter the width of your receipt paper in millimeters. Common sizes are 58mm (narrow) and 80mm (standard). Range: 58-110mm. This affects how text is formatted on receipts.">
                  <TextField
                    fullWidth
                    label="Paper Width (mm)"
                    type="number"
                    value={printerSettings.paperWidth}
                    onChange={handlePaperWidthChange}
                    inputProps={{ min: 58, max: 110, step: 1 }}
                    helperText="Minimum: 58mm, Maximum: 110mm"
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12}>
                <Tooltip title="Auto Print Receipts - When enabled, receipts will automatically print after completing a transaction. When disabled, you'll need to manually print receipts.">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={printerSettings.autoPrint}
                        onChange={handleAutoPrintChange}
                      />
                    }
                    label="Auto Print Receipts"
                  />
                </Tooltip>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                  Automatically print receipts after completing transactions.
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Tooltip title={saving ? "Saving printer settings..." : "Save Printer Settings - Save your printer name, paper width, and auto-print preferences. These settings control how receipts are printed."}>
                  <Button
                    variant="contained"
                    onClick={handleSavePrinterSettings}
                    disabled={saving}
                    sx={saveButtonSx}
                  >
                    {saving ? 'Saving...' : 'Save Printer Settings'}
                  </Button>
                </Tooltip>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Business Rules Tab */}
          <TabPanel value={activeTab} index={3}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={sectionTitleTypographySx}
                >
                  Business Rules
                </Typography>
                <Divider sx={{ mb: 3, borderColor: '#e0e0e0' }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Tooltip title="Rounding Method - Select how monetary amounts should be rounded: Round (nearest), Floor (always down), Ceil (always up), or No Rounding. This affects final transaction totals.">
                  <FormControl fullWidth>
                    <InputLabel>Rounding Method</InputLabel>
                    <Select
                      value={businessRules.roundingMethod}
                      label="Rounding Method"
                      onChange={handleRoundingMethodChange}
                    >
                      <MenuItem value="round">Round</MenuItem>
                      <MenuItem value="floor">Floor (Round Down)</MenuItem>
                      <MenuItem value="ceil">Ceil (Round Up)</MenuItem>
                      <MenuItem value="none">No Rounding</MenuItem>
                    </Select>
                  </FormControl>
                </Tooltip>
              </Grid>
              <Grid item xs={12}>
                <Tooltip title="Allow Negative Stock - When enabled, products can be sold even when stock is below zero (overselling). When disabled, sales will be blocked when stock is insufficient. Use this to control inventory management behavior.">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={businessRules.allowNegativeStock}
                        onChange={handleAllowNegativeStockChange}
                      />
                    }
                    label="Allow Negative Stock"
                  />
                </Tooltip>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                  When enabled, products can be sold even when stock is below zero. When disabled,
                  sales will be blocked when stock is insufficient.
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Tooltip title={saving ? "Saving business rules..." : "Save Business Rules - Save your rounding method and negative stock settings. These rules affect how calculations and inventory are handled throughout the system."}>
                  <Button
                    variant="contained"
                    onClick={handleSaveBusinessRules}
                    disabled={saving}
                    sx={saveButtonSx}
                  >
                    {saving ? 'Saving...' : 'Save Business Rules'}
                  </Button>
                </Tooltip>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Notification Settings Tab */}
          <TabPanel value={activeTab} index={4}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={sectionTitleTypographySx}
                >
                  Notification Settings
                </Typography>
                <Divider sx={{ mb: 3, borderColor: '#e0e0e0' }} />
              </Grid>
              <Grid item xs={12}>
                <Tooltip title="Enable Notification Sounds - When enabled, the system will play a sound when new notifications arrive. You can adjust the volume and priority filter below.">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationSettings.soundEnabled}
                        onChange={handleSoundEnabledChange}
                      />
                    }
                    label="Enable Notification Sounds"
                  />
                </Tooltip>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                  Play a sound when new notifications arrive.
                </Typography>
              </Grid>
              {notificationSettings.soundEnabled && (
                <>
                  <Grid item xs={12} md={6}>
                    <Tooltip title="Sound Volume - Set the volume level for notification sounds (0.0 to 1.0). 0.0 is silent, 1.0 is maximum volume. Use the Test Sound button to preview.">
                      <TextField
                        fullWidth
                        label="Sound Volume"
                        type="number"
                        value={notificationSettings.soundVolume}
                        onChange={handleSoundVolumeChange}
                        inputProps={{ min: 0, max: 1, step: 0.1 }}
                      />
                    </Tooltip>
                    <Tooltip title="Test Sound - Play a preview of the notification sound at the current volume level to verify your settings.">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleTestSound}
                        sx={{ mt: 1 }}
                      >
                        Test Sound
                      </Button>
                    </Tooltip>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Tooltip title="Priority Filter - Select which notification priority levels should trigger sounds. Only notifications matching the selected priority or higher will play sounds. Lower priority notifications will still appear but silently.">
                      <FormControl fullWidth>
                        <InputLabel>Priority Filter</InputLabel>
                        <Select
                          value={notificationSettings.priorityFilter}
                          label="Priority Filter"
                          onChange={handlePriorityFilterChange}
                        >
                          <MenuItem value="all">All Priorities</MenuItem>
                          <MenuItem value="urgent">Urgent Only</MenuItem>
                          <MenuItem value="high">High and Urgent</MenuItem>
                          <MenuItem value="normal">Normal, High, and Urgent</MenuItem>
                        </Select>
                      </FormControl>
                    </Tooltip>
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                      Only play sounds for notifications matching the selected priority level or higher.
                    </Typography>
                  </Grid>
                </>
              )}
              <Grid item xs={12}>
                <Tooltip title={saving ? "Saving notification settings..." : "Save Notification Settings - Save your notification sound preferences including volume level and priority filter."}>
                  <Button
                    variant="contained"
                    onClick={handleSaveNotificationSettings}
                    disabled={saving}
                    sx={saveButtonSx}
                  >
                    {saving ? 'Saving...' : 'Save Notification Settings'}
                  </Button>
                </Tooltip>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Currency Settings Tab */}
          <TabPanel value={activeTab} index={5}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={sectionTitleTypographySx}
                >
                  Currency Configuration
                </Typography>
                <Divider sx={{ mb: 3, borderColor: '#e0e0e0' }} />
                <Alert severity="info" sx={[infoAlertSx, { mb: 3 }]}>
                  Configure the exchange rate between USD and LBP. This rate is used throughout the
                  system for currency conversion.
                </Alert>
              </Grid>
              <Grid item xs={12} md={6}>
                <Tooltip title="USD to LBP Exchange Rate - Enter the current exchange rate from US Dollars to Lebanese Pounds. This rate is used throughout the system for currency conversion in transactions, reports, and displays. Update this regularly to reflect current market rates. Required field.">
                  <TextField
                    fullWidth
                    label="USD to LBP Exchange Rate *"
                    type="number"
                    value={currencySettings.usdToLbp}
                    onChange={handleCurrencyRateChange}
                    helperText={currencyErrors.usdToLbp || `1 USD = X LBP (current: 1 USD = ${currencySettings.usdToLbp.toLocaleString()} LBP)`}
                    inputProps={{ min: 1, step: 1 }}
                    error={!!currencyErrors.usdToLbp}
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Current Exchange Rate:
                  </Typography>
                  <Typography variant="body1">
                    1 USD = {currencySettings.usdToLbp.toLocaleString()} LBP
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Tooltip title={saving ? "Saving currency settings..." : "Save Currency Settings - Save the USD to LBP exchange rate. This rate is used for all currency conversions throughout the system."}>
                  <Button
                    variant="contained"
                    onClick={handleSaveCurrencySettings}
                    disabled={saving}
                    sx={saveButtonSx}
                  >
                    {saving ? 'Saving...' : 'Save Currency Settings'}
                  </Button>
                </Tooltip>
              </Grid>
            </Grid>
          </TabPanel>
        </Paper>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
}

