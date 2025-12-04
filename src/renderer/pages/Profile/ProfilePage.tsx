import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Divider,
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { AuthState, setUser } from '../../store/slices/auth.slice';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

interface UpdateProfileResult {
  success: boolean;
  user?: { username: string };
  error?: string;
}

export default function ProfilePage() {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState): AuthState => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const [saving, setSaving] = useState(false);

  // Form state
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Error state
  const [usernameError, setUsernameError] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  // Initialize form with current user data
  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
    }
  }, [user]);

  const validateUsername = useCallback((value: string): boolean => {
    if (!value || value.trim().length === 0) {
      setUsernameError('Username is required');
      return false;
    }
    if (value.trim().length < 3) {
      setUsernameError('Username must be at least 3 characters long');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value.trim())) {
      setUsernameError('Username can only contain letters, numbers, and underscores');
      return false;
    }
    setUsernameError('');
    return true;
  }, []);

  const validatePassword = useCallback((): boolean => {
    let isValid = true;

    if (newPassword) {
      if (!currentPassword) {
        setCurrentPasswordError('Current password is required to change password');
        isValid = false;
      } else {
        setCurrentPasswordError('');
      }

      if (newPassword.length < 6) {
        setNewPasswordError('New password must be at least 6 characters long');
        isValid = false;
      } else {
        setNewPasswordError('');
      }

      if (newPassword !== confirmPassword) {
        setConfirmPasswordError('Passwords do not match');
        isValid = false;
      } else {
        setConfirmPasswordError('');
      }
    } else {
      setCurrentPasswordError('');
      setNewPasswordError('');
      setConfirmPasswordError('');
    }

    return isValid;
  }, [newPassword, currentPassword, confirmPassword]);

  const handleSave = useCallback(async () => {
    // Validate username
    if (!validateUsername(username)) {
      return;
    }

    // Validate password if new password is provided
    if (newPassword && !validatePassword()) {
      return;
    }

    if (!user?.id) {
      showToast('User information not available', 'error');
      return;
    }

    setSaving(true);

    try {
      const updates: {
        username?: string;
        currentPassword?: string;
        newPassword?: string;
      } = {};

      // Only include username if it changed
      if (username.trim() !== user.username) {
        updates.username = username.trim();
      }

      // Only include password if new password is provided
      if (newPassword) {
        updates.currentPassword = currentPassword;
        updates.newPassword = newPassword;
      }

      // If no changes, show message
      if (Object.keys(updates).length === 0) {
        showToast('No changes to save', 'info');
        setSaving(false);
        return;
      }

      const result = await window.electron.ipcRenderer.invoke('user:updateProfile', updates, user.id) as UpdateProfileResult;

      if (result.success) {
        // Update Redux store with new username
        if (result.user) {
          dispatch(
            setUser({
              ...user,
              username: result.user.username,
            })
          );
        }

        showToast('Profile updated successfully', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showToast(result.error || 'Failed to update profile', 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  }, [username, newPassword, currentPassword, user, validateUsername, validatePassword, dispatch, showToast]);

  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    if (usernameError) {
      validateUsername(value);
    }
  }, [usernameError, validateUsername]);

  const handleUsernameBlur = useCallback(() => {
    validateUsername(username);
  }, [username, validateUsername]);

  const handleCurrentPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentPassword(e.target.value);
    if (currentPasswordError) {
      setCurrentPasswordError('');
    }
  }, [currentPasswordError]);

  const handleNewPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewPassword(value);
    if (newPasswordError) {
      setNewPasswordError('');
    }
    // Clear confirm password error if passwords match
    if (value === confirmPassword && confirmPasswordError) {
      setConfirmPasswordError('');
    }
  }, [newPasswordError, confirmPassword, confirmPasswordError]);

  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (confirmPasswordError) {
      if (value === newPassword) {
        setConfirmPasswordError('');
      } else {
        setConfirmPasswordError('Passwords do not match');
      }
    }
  }, [confirmPasswordError, newPassword]);

  const handleConfirmPasswordBlur = useCallback(() => {
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
    }
  }, [newPassword, confirmPassword]);

  const handleReset = useCallback(() => {
    setUsername(user?.username || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setUsernameError('');
    setCurrentPasswordError('');
    setNewPasswordError('');
    setConfirmPasswordError('');
  }, [user?.username]);

  // Keyboard navigation handlers
  const handleUsernameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const currentPasswordInput = document.getElementById('profile-current-password');
      currentPasswordInput?.focus();
    }
  }, []);

  const handleCurrentPasswordKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newPasswordInput = document.getElementById('profile-new-password');
      newPasswordInput?.focus();
    }
  }, []);

  const handleNewPasswordKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const confirmPasswordInput = document.getElementById('profile-confirm-password');
      confirmPasswordInput?.focus();
    }
  }, []);

  const handleConfirmPasswordKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const saveButton = document.getElementById('profile-save') as HTMLButtonElement | null;
      if (saveButton && !saveButton.disabled) {
        saveButton.click();
      }
    }
  }, []);

  // Memoize sx prop objects to avoid recreation on every render
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
  }), []);

  const titleTypographySx = useMemo(() => ({
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const sectionTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const subtitleTypographySx = useMemo(() => ({
    mb: 2,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const textFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '13px',
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
    },
    '& .MuiFormHelperText-root': {
      fontSize: '12px',
    },
  }), []);

  const saveButtonSx = useMemo(() => ({
    backgroundColor: '#1a237e',
    color: '#ffffff',
    borderRadius: 0,
    padding: '8px 16px',
    fontSize: '13px',
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
    '&:focus-visible': {
      outline: '2px solid #1a237e',
      outlineOffset: '2px',
    },
  }), []);

  const resetButtonSx = useMemo(() => ({
    borderRadius: 0,
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    textTransform: 'none',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    border: '1px solid #c0c0c0',
    color: '#212121',
    backgroundColor: '#ffffff',
    '&:hover': {
      backgroundColor: '#f5f5f5',
      borderColor: '#1a237e',
    },
    '&:disabled': {
      backgroundColor: '#f5f5f5',
      color: '#9e9e9e',
      borderColor: '#e0e0e0',
    },
    '&:focus-visible': {
      outline: '2px solid #1a237e',
      outlineOffset: '2px',
    },
  }), []);

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Paper elevation={0} sx={paperSx}>
          {/* Title Bar */}
          <Box sx={titleBarSx}>
            <Typography variant="body2" sx={titleTypographySx}>
            DigitalizePOS - Profile Settings
            </Typography>
          </Box>

          <Box sx={{ padding: '24px' }}>
            <Grid container spacing={3}>
              {/* Username Section */}
              <Grid item xs={12}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={sectionTitleTypographySx}
                >
                  Username
                </Typography>
                <Divider sx={{ mb: 2, borderColor: '#e0e0e0' }} />
              </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="profile-username"
                label="Username"
                value={username}
                onChange={handleUsernameChange}
                onBlur={handleUsernameBlur}
                onKeyDown={handleUsernameKeyDown}
                error={!!usernameError}
                helperText={usernameError || 'Username must be at least 3 characters and contain only letters, numbers, and underscores'}
                disabled={saving}
                tabIndex={1}
                autoFocus
                sx={textFieldSx}
              />
            </Grid>

            {/* Password Section */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={sectionTitleTypographySx}
              >
                Change Password
              </Typography>
              <Divider sx={{ mb: 2, borderColor: '#e0e0e0' }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={subtitleTypographySx}
              >
                Leave password fields empty if you don&apos;t want to change your password.
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="profile-current-password"
                type="password"
                label="Current Password"
                value={currentPassword}
                onChange={handleCurrentPasswordChange}
                onKeyDown={handleCurrentPasswordKeyDown}
                error={!!currentPasswordError}
                helperText={currentPasswordError}
                disabled={saving}
                tabIndex={2}
                sx={textFieldSx}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="profile-new-password"
                type="password"
                label="New Password"
                value={newPassword}
                onChange={handleNewPasswordChange}
                onKeyDown={handleNewPasswordKeyDown}
                error={!!newPasswordError}
                helperText={newPasswordError || 'Password must be at least 6 characters long'}
                disabled={saving}
                tabIndex={3}
                sx={textFieldSx}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="profile-confirm-password"
                type="password"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                onBlur={handleConfirmPasswordBlur}
                onKeyDown={handleConfirmPasswordKeyDown}
                error={!!confirmPasswordError}
                helperText={confirmPasswordError}
                disabled={saving}
                tabIndex={4}
                sx={textFieldSx}
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, mt: 2, paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
                <Button
                  id="profile-save"
                  variant="contained"
                  onClick={handleSave}
                  disabled={saving}
                  startIcon={saving ? <CircularProgress size={20} sx={{ color: '#ffffff' }} /> : null}
                  tabIndex={5}
                  sx={saveButtonSx}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  disabled={saving}
                  tabIndex={6}
                  sx={resetButtonSx}
                >
                  Reset
                </Button>
              </Box>
            </Grid>
          </Grid>
          </Box>
        </Paper>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
}

