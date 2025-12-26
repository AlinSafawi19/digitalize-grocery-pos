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
  Collapse,
  Link,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import { HelpOutline, ChatBubble as MessageCircle } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { login, clearError } from '../store/slices/auth.slice';
import { AppDispatch, RootState } from '../store';
import { ROUTES } from '../utils/constants';
import { useToast } from '../hooks/useToast';
import Toast from '../components/common/Toast';

const Login: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, error, user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
  }>({});

  useEffect(() => {
    if (isAuthenticated) {
      // Check if license is expired before redirecting
      const checkLicenseAndRedirect = async () => {
        try {
          const expired = await window.electron.ipcRenderer.invoke('license:isExpired');
          if (expired) {
            // Main user (ID = 1) goes to license page, others go to expiry page
            const isMainUser = user?.id === 1;
            const targetRoute = isMainUser ? ROUTES.LICENSE : ROUTES.LICENSE_EXPIRED;
            navigate(targetRoute);
          } else {
            navigate(ROUTES.DASHBOARD);
          }
        } catch (err) {
          console.error('Failed to check license expiration:', err);
          // Default to dashboard on error
          navigate(ROUTES.DASHBOARD);
        }
      };
      checkLicenseAndRedirect();
    }
  }, [isAuthenticated, navigate, user?.id]);

  // Show auth state error in toast
  useEffect(() => {
    if (error) {
      showToast(error, 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]); // showToast is stable from useCallback, no need to include it

  useEffect(() => {
    // Clear error when component mounts
    dispatch(clearError());

    // Check license status first - if no license, redirect to activation
    const checkLicenseAndRedirect = async () => {
      try {
        const isActivated = await window.electron.ipcRenderer.invoke('license:isActivated') as boolean;
        if (!isActivated) {
          // No license activated - redirect to activation page
          navigate(ROUTES.LICENSE_ACTIVATION, { replace: true });
          return;
        }
      } catch (err) {
        console.error('Failed to check license:', err);
        // On error, assume no license and redirect to activation
        navigate(ROUTES.LICENSE_ACTIVATION, { replace: true });
        return;
      }

      // Only check for users if license is activated
      // Check if users exist
      const checkUsers = async () => {
        try {
          const result = await window.electron.ipcRenderer.invoke('user:hasUsers') as {
            success: boolean;
            hasUsers?: boolean;
            error?: string;
          };
          if (result.success) {
            setHasUsers(result.hasUsers ?? null);
          }
        } catch (err) {
          console.error('Failed to check users:', err);
        }
      };

      // Check immediately
      checkUsers();

      // If navigating from license activation, check again after a short delay
      // to ensure user creation has completed
      if (location.state && (location.state as { refreshUsers?: boolean }).refreshUsers) {
        setTimeout(() => {
          checkUsers();
        }, 500);
      }

      // Also check when page becomes visible (user might have activated license in another tab/window)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          checkUsers();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    };

    checkLicenseAndRedirect();
  }, [dispatch, location.state, navigate]);

  const validateForm = useCallback((): boolean => {
    const errors: {
      username?: string;
      password?: string;
    } = {};

    // Validate username
    if (!username || username.trim() === '') {
      errors.username = 'Username is required';
    }

    // Validate password
    if (!password || password.trim() === '') {
      errors.password = 'Password is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [username, password]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    try {
      await dispatch(
        login({
          username: username.trim(),
          password,
          rememberMe: true,
        })
      ).unwrap();
      // Navigation will happen automatically via useEffect
    } catch {
      const errorMessage = error || 'Login failed';
      showToast(errorMessage, 'error');
    }
  }, [validateForm, username, password, dispatch, error, showToast]);

  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    if (fieldErrors.username) {
      setFieldErrors((prev) => ({ ...prev, username: undefined }));
    }
  }, [fieldErrors.username]);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
  }, [fieldErrors.password]);

  const handleUsernameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const passwordInput = document.getElementById('password');
      passwordInput?.focus();
    }
  }, []);

  const handlePasswordKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.closest('form');
      if (form) {
        form.requestSubmit();
      }
    }
  }, []);

  const handleTogglePassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleToggleHelp = useCallback(() => {
    setShowHelp((prev) => !prev);
  }, []);


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

  const subtitleTypographySx = useMemo(() => ({
    color: '#616161',
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
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

  const helpButtonSx = useMemo(() => ({
    fontSize: '14px',
    textTransform: 'none',
    minWidth: 'auto',
    minHeight: '40px',
    padding: '8px 16px',
  }), []);

  const warningAlertSx = useMemo(() => ({
    mb: 2,
    borderRadius: 0,
    border: '1px solid #ffb74d',
    backgroundColor: '#fff3e0',
    '& .MuiAlert-icon': {
      color: '#f57c00',
    },
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
    },
  }), []);

  const showPasswordLinkSx = useMemo(() => ({
    textDecoration: 'underline',
    cursor: 'pointer',
    color: '#1a237e',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '8px 12px',
    border: 'none',
    background: 'none',
    marginRight: '-8px',
    minHeight: '40px',
    '&:hover': {
      color: '#534bae',
      textDecoration: 'underline',
    },
  }), []);

  const submitButtonSx = useMemo(() => ({
    mt: 1,
    mb: 2,
    backgroundColor: '#1a237e',
    color: '#ffffff',
    borderRadius: 0,
    padding: '8px 20px',
    minHeight: '44px',
    fontSize: '16px',
    fontWeight: 600,
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
    '&:focus-visible': {
      outline: '2px solid #1a237e',
      outlineOffset: '2px',
    },
  }), []);

  return (
    <Box sx={containerSx}>
      <Container component="main" maxWidth="xs">
        <Paper elevation={0} sx={paperSx}>
          {/* Title Bar */}
          <Box sx={titleBarSx}>
            <Typography variant="body2" sx={titleTypographySx}>
            DigitalizePOS - Sign In
            </Typography>
          </Box>

          <Box sx={{ padding: '24px' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
              <Box
                component="img"
                src="https://downloads.digitalizepos.com/grocery-logo.svg"
                alt="DigitalizePOS"
                sx={logoBoxSx}
              />
              <Typography variant="body2" sx={subtitleTypographySx}>
                Sign in to your account
              </Typography>
            </Box>

            {hasUsers === false && (
              <Alert
                severity="info"
                sx={infoAlertSx}
                icon={<HelpOutline />}
                action={
                  <Tooltip title={showHelp ? "Hide Help - Close the help information" : "Show Help - Display instructions for first-time setup and license activation"}>
                    <Button
                      color="inherit"
                      size="small"
                      onClick={handleToggleHelp}
                      sx={helpButtonSx}
                    >
                      {showHelp ? 'Hide' : 'Show Help'}
                    </Button>
                  </Tooltip>
                }
              >
                <Typography variant="body2" sx={{ fontSize: '16px' }}>
                  No users found. You may need to activate your license first.
                </Typography>
              </Alert>
            )}

            <Collapse in={showHelp && hasUsers === false}>
              <Alert severity="warning" sx={warningAlertSx}>
                <Typography variant="body2" gutterBottom sx={{ fontSize: '16px', fontWeight: 600 }}>
                  First Time Setup:
                </Typography>
                <Typography variant="body2" component="div" sx={{ fontSize: '16px' }}>
                  If you just activated your license, your account credentials were shown on the activation screen.
                  <br />
                  <br />
                  <strong>Note:</strong> If you&apos;ve lost your credentials, you may need to contact administrator.
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                    <MessageCircle sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography
                      variant="body2"
                      component="a"
                      href="https://wa.me/96181943475"
                      sx={{
                        color: 'primary.main',
                        textDecoration: 'none',
                        fontWeight: 500,
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      +96181943475
                    </Typography>
                  </Box>
                </Typography>
              </Alert>
            </Collapse>

            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                margin="normal"
                fullWidth
                id="username"
                label="Username *"
                name="username"
                autoComplete="username"
                autoFocus
                tabIndex={1}
                value={username}
                onChange={handleUsernameChange}
                onKeyDown={handleUsernameKeyDown}
                error={!!fieldErrors.username}
                helperText={fieldErrors.username}
                disabled={isLoading}
                sx={textFieldSx}
              />
              <TextField
                margin="normal"
                fullWidth
                name="password"
                label="Password *"
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="current-password"
                tabIndex={2}
                value={password}
                onChange={handlePasswordChange}
                onKeyDown={handlePasswordKeyDown}
                error={!!fieldErrors.password}
                helperText={fieldErrors.password}
                disabled={isLoading}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Link
                        component="button"
                        type="button"
                        variant="body2"
                        onClick={handleTogglePassword}
                        onMouseDown={(e) => e.preventDefault()}
                        sx={showPasswordLinkSx}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </Link>
                    </InputAdornment>
                  ),
                }}
                sx={textFieldSx}
              />
              <Tooltip title={isLoading ? "Signing in..." : "Sign In - Log in to your DigitalizePOS account using your username and password. Make sure your license is activated."}>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  tabIndex={3}
                  sx={submitButtonSx}
                  disabled={isLoading}
                >
                  {isLoading ? <CircularProgress size={24} sx={{ color: '#ffffff' }} /> : 'Sign In'}
                </Button>
              </Tooltip>
            </Box>

          </Box>
        </Paper>
      </Container>
      <Toast toast={toast} onClose={hideToast} />
    </Box>
  );
};

export default Login;

