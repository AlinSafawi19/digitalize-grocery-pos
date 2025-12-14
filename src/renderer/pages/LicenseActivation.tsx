import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { ROUTES } from '../utils/constants';
import { useToast } from '../hooks/useToast';
import Toast from '../components/common/Toast';

interface UserCredentials {
  username: string;
  password: string;
}

interface ActivationInput {
  licenseKey: string;
}

const LicenseActivation: React.FC = () => {
  const { toast, showToast, hideToast } = useToast();
  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activationResult, setActivationResult] = useState<{
    success: boolean;
    message: string;
    userCredentials?: UserCredentials;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    licenseKey?: string;
  }>({});
  const [hasExistingLicense, setHasExistingLicense] = useState<boolean | null>(null);
  const [existingLicenseKey, setExistingLicenseKey] = useState<string | null>(null);
  const [checkingLicense, setCheckingLicense] = useState(true);


  const validateForm = useCallback((): boolean => {
    const errors: {
      licenseKey?: string;
    } = {};

    // Validate license key
    if (!licenseKey || licenseKey.trim() === '') {
      errors.licenseKey = 'License key is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [licenseKey]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    // Check if trying to activate a different license
    if (hasExistingLicense && existingLicenseKey) {
      // Normalize both license keys for comparison (remove dashes and convert to uppercase)
      const normalizedExistingKey = existingLicenseKey.trim().toUpperCase().replace(/-/g, '');
      const normalizedNewKey = licenseKey.trim().toUpperCase().replace(/-/g, '');
      
      // If it's a different license, block activation
      if (normalizedExistingKey !== normalizedNewKey) {
        showToast('A different license is already activated on this device. You cannot activate a different license on the same device. If you need more users, please contact your license supplier.', 'error');
        return;
      }
      // If it's the same license, allow reactivation (server will handle it)
    }

    // Prevent activation if a license is already activated (but allow same license reactivation)
    if (hasExistingLicense && !existingLicenseKey) {
      showToast('A license is already activated on this device. If you need more users, please contact your license supplier.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const activationInput: ActivationInput = {
        licenseKey: licenseKey.trim(),
      };

      const result = await window.electron.ipcRenderer.invoke('license:activate', activationInput) as {
        success: boolean;
        message: string;
        userCredentials?: UserCredentials;
      };

      if (result.success) {
        setActivationResult({
          success: true,
          message: result.message,
          userCredentials: result.userCredentials,
        });
      } else {
        showToast(result.message || 'License activation failed', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to activate license', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [validateForm, licenseKey, showToast, hasExistingLicense, existingLicenseKey]);

  const handleContinue = useCallback(() => {
    // Navigate to login page - no need to verify activation
    // License was just activated, so navigation should work
    window.location.href = ROUTES.LOGIN;
  }, []);

  const handleLicenseKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLicenseKey(e.target.value);
    if (fieldErrors.licenseKey) {
      setFieldErrors((prev) => ({ ...prev, licenseKey: undefined }));
    }
  }, [fieldErrors.licenseKey]);


  // Memoize sx prop objects to avoid recreation on every render
  const containerSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    py: 4,
    px: 2,
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
  }), []);

  const titleTypographySx = useMemo(() => ({
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const logoBoxSx = useMemo(() => ({
    height: 50,
    mb: 2,
    maxWidth: '100%',
  }), []);

  const headingTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const subtitleTypographySx = useMemo(() => ({
    mt: 1,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const successAlertSx = useMemo(() => ({
    width: '100%',
    mt: 2,
    borderRadius: 0,
    border: '1px solid #81c784',
    backgroundColor: '#e8f5e9',
    '& .MuiAlert-icon': {
      color: '#2e7d32',
    },
  }), []);

  const infoAlertSx = useMemo(() => ({
    mb: 2,
    borderRadius: 0,
    border: '1px solid #90caf9',
    backgroundColor: '#e3f2fd',
    '& .MuiAlert-icon': {
      color: '#1565c0',
    },
  }), []);

  const continueButtonSx = useMemo(() => ({
    backgroundColor: '#1a237e',
    color: '#ffffff',
    borderRadius: 0,
    padding: '8px 16px',
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

  const textFieldSx = useMemo(() => ({
    mb: 2,
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

  const submitButtonSx = useMemo(() => ({
    mt: 2,
    mb: 2,
    py: 1.5,
    backgroundColor: '#1a237e',
    color: '#ffffff',
    borderRadius: 0,
    fontSize: '16px',
    fontWeight: 500,
    textTransform: 'none',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '8px 20px',
    minHeight: '44px',
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

  // Credentials are sent via WhatsApp only, not displayed in UI

  // Check if a license is already activated when component mounts
  useEffect(() => {
    const checkExistingLicense = async () => {
      try {
        setCheckingLicense(true);
        const status = await window.electron.ipcRenderer.invoke('license:getStatus') as {
          licenseKey?: string;
          hardwareId?: string;
          locationName?: string;
          locationAddress?: string;
          activatedAt?: number;
          expiresAt?: number;
          gracePeriodEnd?: number;
          lastValidation?: number;
          validationToken?: string;
          version?: number;
        } | null;
        
        if (status && status.licenseKey) {
          setHasExistingLicense(true);
          setExistingLicenseKey(status.licenseKey);
        } else {
          setHasExistingLicense(false);
          setExistingLicenseKey(null);
        }
      } catch (error) {
        console.error('Error checking existing license', error);
        setHasExistingLicense(false);
        setExistingLicenseKey(null);
      } finally {
        setCheckingLicense(false);
      }
    };

    checkExistingLicense();
  }, []);

  if (activationResult?.success) {
    return (
      <Box sx={containerSx}>
        <Container component="main" maxWidth="md">
          <Paper elevation={0} sx={paperSx}>
            {/* Title Bar */}
            <Box sx={titleBarSx}>
              <Typography variant="body2" sx={titleTypographySx}>
                DigitalizePOS - License Activation
              </Typography>
            </Box>

            <Box sx={{ padding: '24px' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                <Box
                  component="img"
                  src="./logo.svg"
                  alt="DigitalizePOS"
                  sx={logoBoxSx}
                />
                <Typography
                  component="h1"
                  variant="h4"
                  gutterBottom
                  sx={headingTypographySx}
                >
                  License Activated Successfully!
                </Typography>
                <Alert severity="success" sx={successAlertSx}>
                  <Typography variant="body2" sx={{ fontSize: '13px' }}>
                    {activationResult.message}
                  </Typography>
                </Alert>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Alert severity="info" sx={infoAlertSx}>
                  <Typography variant="body2" gutterBottom sx={{ fontSize: '13px' }}>
                    <strong>Please check your WhatsApp.</strong> We&apos;ve sent you a WhatsApp message with your login credentials.
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '13px', mt: 1 }}>
                    <strong>Security Note:</strong> Please change your password after your first login for better security.
                  </Typography>
                </Alert>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
                <Tooltip title="Continue to Login - Proceed to the login page to sign in with your credentials">
                  <Button
                    onClick={handleContinue}
                    variant="contained"
                    size="large"
                    sx={continueButtonSx}
                  >
                    Continue to Login
                  </Button>
                </Tooltip>
              </Box>
            </Box>
          </Paper>
        </Container>
        <Toast toast={toast} onClose={hideToast} />
      </Box>
    );
  }

  return (
    <Box sx={containerSx}>
      <Container component="main" maxWidth="sm">
        <Paper elevation={0} sx={paperSx}>
          {/* Title Bar */}
          <Box sx={titleBarSx}>
            <Typography variant="body2" sx={titleTypographySx}>
            DigitalizePOS - License Activation
            </Typography>
          </Box>

          <Box sx={{ padding: '24px' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
              <Box
                component="img"
                src="./logo.svg"
                alt="DigitalizePOS"
                sx={logoBoxSx}
              />
              <Typography
                component="h1"
                variant="h4"
                gutterBottom
                sx={headingTypographySx}
              >
                Activate License
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={subtitleTypographySx}
              >
                Enter your license key to activate
              </Typography>
            </Box>

            {checkingLicense ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {hasExistingLicense && existingLicenseKey && (
                  <Alert severity="info" sx={infoAlertSx}>
                    <Typography variant="body2" sx={{ fontSize: '13px' }}>
                      <strong>License already activated:</strong> This device has a license activated. You can reactivate the same license if needed, but you cannot activate a different license on the same device.
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '13px', mt: 1 }}>
                      If you need more users, please contact your license supplier to add more users to your existing license.
                    </Typography>
                  </Alert>
                )}
                <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  margin="normal"
                  fullWidth
                  id="licenseKey"
                  label="License Key *"
                  name="licenseKey"
                  autoComplete="off"
                  autoFocus
                  value={licenseKey}
                  onChange={handleLicenseKeyChange}
                  error={!!fieldErrors.licenseKey}
                  helperText={fieldErrors.licenseKey}
                  disabled={isLoading}
                  placeholder="XXXX-XXXX-XXXX-XXXX *"
                  sx={textFieldSx}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={submitButtonSx}
                  disabled={isLoading}
                >
                  {isLoading ? <CircularProgress size={20} sx={{ color: '#ffffff' }} /> : 'Activate License'}
                </Button>
                </Box>
              </>
            )}

          </Box>
        </Paper>
      </Container>
      <Toast toast={toast} onClose={hideToast} />
    </Box>
  );
};

export default LicenseActivation;

