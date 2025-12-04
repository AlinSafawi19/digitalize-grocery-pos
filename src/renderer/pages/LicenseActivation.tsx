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
  Divider,
  IconButton,
  Checkbox,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import { ContentCopy as CopyIcon, Check as CheckIcon, Download as DownloadIcon } from '@mui/icons-material';
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
  const [copied, setCopied] = useState<'username' | 'password' | null>(null);
  const [credentialsConfirmed, setCredentialsConfirmed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    licenseKey?: string;
  }>({});
  const [hasExistingLicense, setHasExistingLicense] = useState<boolean | null>(null);
  const [existingLicenseKey, setExistingLicenseKey] = useState<string | null>(null);
  const [checkingLicense, setCheckingLicense] = useState(true);

  const handleCopy = useCallback(async (text: string, type: 'username' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

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
    // If credentials were shown, require confirmation
    if (activationResult?.userCredentials && !credentialsConfirmed) {
      return;
    }
    // Navigate to login page - no need to verify activation
    // License was just activated, so navigation should work
    window.location.href = ROUTES.LOGIN;
  }, [activationResult, credentialsConfirmed]);

  const handleLicenseKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLicenseKey(e.target.value);
    if (fieldErrors.licenseKey) {
      setFieldErrors((prev) => ({ ...prev, licenseKey: undefined }));
    }
  }, [fieldErrors.licenseKey]);

  const handleCredentialsConfirmedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentialsConfirmed(e.target.checked);
  }, []);


  const handleCopyUsername = useCallback(() => {
    if (activationResult?.userCredentials) {
      handleCopy(activationResult.userCredentials.username, 'username');
    }
  }, [activationResult?.userCredentials, handleCopy]);

  const handleCopyPassword = useCallback(() => {
    if (activationResult?.userCredentials) {
      handleCopy(activationResult.userCredentials.password, 'password');
    }
  }, [activationResult?.userCredentials, handleCopy]);

  const handleDownloadCredentials = useCallback(() => {
    if (!activationResult?.userCredentials) return;

    const credentialsText = `DigitalizePOS - Login Credentials\n\nUsername: ${activationResult.userCredentials.username}\nPassword: ${activationResult.userCredentials.password}\n\nPlease keep this information secure.\n\nGenerated on: ${new Date().toLocaleString()}`;
    
    const blob = new Blob([credentialsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `digitalizePOS-credentials-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [activationResult?.userCredentials]);

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

  const warningAlertSx = useMemo(() => ({
    mb: 3,
    borderRadius: 0,
    border: '1px solid #ffb74d',
    backgroundColor: '#fff3e0',
    '& .MuiAlert-icon': {
      color: '#f57c00',
    },
  }), []);

  const warningTitleTypographySx = useMemo(() => ({
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const credentialBoxSx = useMemo(() => ({
    bgcolor: '#f5f5f5',
    p: 2,
    borderRadius: 0,
    mb: 2,
    border: '1px solid #e0e0e0',
  }), []);

  const credentialLabelTypographySx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const credentialValueTypographySx = useMemo(() => ({
    fontFamily: 'monospace',
    flexGrow: 1,
    fontWeight: 'bold',
    fontSize: '14px',
  }), []);

  const copyButtonSx = useMemo(() => ({
    padding: '4px',
    '&:hover': {
      backgroundColor: 'rgba(26, 35, 126, 0.08)',
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

  const confirmationBoxSx = useMemo(() => ({
    mt: 3,
    p: 2,
    bgcolor: '#f5f5f5',
    borderRadius: 0,
    border: '1px solid #e0e0e0',
  }), []);

  const checkboxSx = useMemo(() => ({
    padding: '4px',
    '& .MuiSvgIcon-root': {
      fontSize: '18px',
    },
  }), []);

  const confirmationLabelTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
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

  // Check for saved credentials if activation was successful but no credentials shown
  useEffect(() => {
    if (activationResult?.success && !activationResult.userCredentials) {
      // Check if there are saved credentials that weren't shown
      window.electron.ipcRenderer.invoke('license:getCredentials').then((result) => {
        const typedResult = result as {
          success: boolean;
          credentials?: UserCredentials;
        };
        if (typedResult.success && typedResult.credentials) {
          setActivationResult((prev) => {
            if (prev && !prev.userCredentials) {
              return {
                ...prev,
                userCredentials: typedResult.credentials,
              };
            }
            return prev;
          });
        }
      }).catch(() => {
        // Silently fail - credentials might not exist
      });
    }
  }, [activationResult]);

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
                  src="/logo.svg"
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

              {activationResult.userCredentials && (
                <>
                  <Divider sx={{ my: 3, borderColor: '#e0e0e0' }} />
                  <Box sx={{ mb: 3 }}>
                    <Alert severity="warning" sx={warningAlertSx}>
                      <Typography
                        variant="h6"
                        gutterBottom
                        sx={warningTitleTypographySx}
                      >
                        CRITICAL: Save Your Login Credentials Now
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '13px' }}>
                        An account has been created for you. <strong>You must save these credentials before continuing.</strong> If you lose them, you may not be able to log in to the application.
                      </Typography>
                    </Alert>

                    <Box sx={credentialBoxSx}>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        gutterBottom
                        sx={credentialLabelTypographySx}
                      >
                        Username
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body1"
                          sx={credentialValueTypographySx}
                        >
                          {activationResult.userCredentials.username}
                        </Typography>
                        <Tooltip title={copied === 'username' ? "Username copied!" : "Copy Username - Copy the username to your clipboard"}>
                          <IconButton
                            onClick={handleCopyUsername}
                            color="primary"
                            size="small"
                            sx={copyButtonSx}
                          >
                            {copied === 'username' ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download Credentials - Download your credentials as a text file">
                          <IconButton
                            onClick={handleDownloadCredentials}
                            color="primary"
                            size="small"
                            sx={copyButtonSx}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Box sx={credentialBoxSx}>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        gutterBottom
                        sx={credentialLabelTypographySx}
                      >
                        Password
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body1"
                          sx={credentialValueTypographySx}
                        >
                          {activationResult.userCredentials.password}
                        </Typography>
                        <Tooltip title={copied === 'password' ? "Password copied!" : "Copy Password - Copy the password to your clipboard"}>
                          <IconButton
                            onClick={handleCopyPassword}
                            color="primary"
                            size="small"
                            sx={copyButtonSx}
                          >
                            {copied === 'password' ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download Credentials - Download your credentials as a text file">
                          <IconButton
                            onClick={handleDownloadCredentials}
                            color="primary"
                            size="small"
                            sx={copyButtonSx}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Alert severity="info" sx={infoAlertSx}>
                      <Typography variant="body2" sx={{ fontSize: '13px' }}>
                        <strong>Email Sent:</strong> We&apos;ve also sent these credentials to your email address for your records.
                      </Typography>
                    </Alert>

                    <Alert severity="info" sx={infoAlertSx}>
                      <Typography variant="body2" sx={{ fontSize: '13px' }}>
                        <strong>Security Note:</strong> Please change your password after your first login for better security.
                      </Typography>
                    </Alert>

                    <Box sx={confirmationBoxSx}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={credentialsConfirmed}
                            onChange={handleCredentialsConfirmedChange}
                            color="primary"
                            sx={checkboxSx}
                          />
                        }
                        label={
                          <Typography
                            variant="body2"
                            sx={confirmationLabelTypographySx}
                          >
                            <strong>I have saved my credentials</strong> (username and password)
                          </Typography>
                        }
                      />
                    </Box>
                  </Box>
                </>
              )}

              {activationResult?.success && !activationResult.userCredentials && (
                <Box sx={{ mb: 3 }}>
                  <Alert severity="info" sx={infoAlertSx}>
                    <Typography variant="body2" gutterBottom sx={{ fontSize: '13px' }}>
                      <strong>Please check your email.</strong> We&apos;ve sent you an email with your login credentials.
                    </Typography>
                  </Alert>
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
                <Tooltip title={activationResult.userCredentials && !credentialsConfirmed ? "Please confirm that you have saved your credentials" : "Continue to Login - Proceed to the login page to sign in with your new credentials"}>
                  <span>
                    <Button
                      onClick={handleContinue}
                      variant="contained"
                      size="large"
                      disabled={activationResult.userCredentials && !credentialsConfirmed}
                      sx={continueButtonSx}
                    >
                      Continue to Login
                    </Button>
                  </span>
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
                src="/logo.svg"
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

