import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Button,
  TextField,
  Box,
  Grid,
  Paper,
  Typography,
  IconButton,
  CircularProgress,
  FormControlLabel,
  Switch,
  Checkbox,
  FormGroup,
  Divider,
  Collapse,
} from '@mui/material';
import { ArrowBack, ExpandMore, ExpandLess } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { RootState } from '../../store';
import { UserService, CreateUserInput, UpdateUserInput, User } from '../../services/user.service';
import { PermissionService, Permission } from '../../services/permission.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { ROUTES } from '../../utils/constants';

const CashierForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  // Optimize useSelector to only subscribe to user.id
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { toast, showToast, hideToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingCashier, setLoadingCashier] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [cashier, setCashier] = useState<User | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [userLimit, setUserLimit] = useState<number | null>(null);
  const [canCreate, setCanCreate] = useState<boolean>(true);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<number>>(new Set());
  const [initialPermissionIds, setInitialPermissionIds] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const [formData, setFormData] = useState<CreateUserInput & { confirmPassword?: string; isActive?: boolean }>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    isActive: true,
  });

  // Initial form data for change detection
  const [initialFormData, setInitialFormData] = useState<CreateUserInput & { confirmPassword?: string; isActive?: boolean }>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    isActive: true,
  });

  // Ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef(true);

  // Load all permissions (excluding users and permissions management categories)
  const loadAllPermissions = useCallback(async () => {
    try {
      setLoadingPermissions(true);
      const result = await PermissionService.getAllPermissions();
      if (result.success && result.permissions) {
        // Filter out permissions related to users and permissions management
        // These should only be available to the main user
        const filteredPermissions = result.permissions.filter(
          (p) => p.category !== 'users' && p.category !== 'permissions'
        );
        setAllPermissions(filteredPermissions);
        // Expand all categories by default
        const categories = new Set(filteredPermissions.map(p => p.category || 'Other').filter(Boolean));
        setExpandedCategories(categories);
      }
    } catch (err) {
      console.error('Failed to load permissions:', err);
    } finally {
      setLoadingPermissions(false);
    }
  }, []);

  // Load user permissions when editing
  const loadUserPermissions = useCallback(async (userId: number) => {
    try {
      const result = await PermissionService.getUserPermissions(userId);
      if (result.success && result.permissions) {
        const permissionIds = new Set(result.permissions.map(p => p.id));
        setSelectedPermissionIds(permissionIds);
        setInitialPermissionIds(new Set(permissionIds));
      }
    } catch (err) {
      console.error('Failed to load user permissions:', err);
    }
  }, []);

  // Load user limits (only in create mode)
  const loadUserLimits = useCallback(async () => {
    if (isEditMode) return; // Don't check limits when editing
    
    try {
      const result = await UserService.getUserLimits();
      if (result.success) {
        setUserCount(result.userCount ?? null);
        setUserLimit(result.userLimit ?? null);
        setCanCreate(result.canCreate ?? true);
      }
    } catch (err) {
      // Silently fail - limits check will happen on backend anyway
      console.error('Failed to load user limits:', err);
    }
  }, [isEditMode]);


  // Load all permissions on mount
  useEffect(() => {
    loadAllPermissions();
  }, [loadAllPermissions]);

  // Set default cashier permissions when in create mode and permissions are loaded
  useEffect(() => {
    if (!isEditMode && allPermissions.length > 0 && selectedPermissionIds.size === 0) {
      const defaultCashierCodes = PermissionService.getDefaultCashierPermissionCodes();
      const defaultPermissionIds = allPermissions
        .filter(p => defaultCashierCodes.includes(p.code))
        .map(p => p.id);
      
      if (defaultPermissionIds.length > 0) {
        setSelectedPermissionIds(new Set(defaultPermissionIds));
        setInitialPermissionIds(new Set(defaultPermissionIds));
      }
    }
  }, [isEditMode, allPermissions, selectedPermissionIds.size]);

  // Load cashier if editing
  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;

    if (id && userId) {
      setIsEditMode(true);
      setLoadingCashier(true);
      UserService.getUserById(parseInt(id))
        .then((result) => {
          if (cancelled || !isMountedRef.current) return;
          
          if (result.success && result.user) {
            const usr = result.user;
            setCashier(usr);
            const loadedFormData = {
              username: usr.username,
              email: usr.email || '',
              password: '',
              confirmPassword: '',
              isActive: usr.isActive,
            };
            setFormData(loadedFormData);
            setInitialFormData(loadedFormData);
            // Load user permissions
            loadUserPermissions(usr.id);
          } else {
            showToast(result.error || 'Failed to load cashier', 'error');
          }
        })
        .catch((err) => {
          if (cancelled || !isMountedRef.current) return;
          showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
        })
        .finally(() => {
          if (!cancelled && isMountedRef.current) {
            setLoadingCashier(false);
          }
        });
    } else {
      setIsEditMode(false);
      setCashier(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        isActive: true,
      });
      // Reset permissions - default cashier permissions will be set by useEffect
      setSelectedPermissionIds(new Set());
      setInitialPermissionIds(new Set());
      // Load limits when in create mode
      loadUserLimits();
    }

    return () => {
      cancelled = true;
      isMountedRef.current = false;
    };
  }, [id, userId, showToast, loadUserLimits, loadUserPermissions]);

  // Load limits when component mounts in create mode
  useEffect(() => {
    if (!isEditMode) {
      loadUserLimits();
    }
  }, [isEditMode, loadUserLimits]);

  const validateForm = useCallback((): boolean => {
    const errors: {
      username?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    // Validate username
    if (!formData.username || formData.username.trim() === '') {
      errors.username = 'Username is required';
    } else if (formData.username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters long';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username.trim())) {
      errors.username = 'Username can only contain letters, numbers, and underscores';
    }

    // Validate email (optional but must be valid if provided)
    if (formData.email && formData.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
    }

    // Validate password
    if (!isEditMode) {
      // Password required for new cashiers
      if (!formData.password || formData.password.trim() === '') {
        errors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        errors.password = 'Password must be at least 6 characters long';
      }

      // Validate confirm password
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    } else {
      // Password optional for editing, but if provided, must be valid
      if (formData.password && formData.password.trim() !== '') {
        if (formData.password.length < 6) {
          errors.password = 'Password must be at least 6 characters long';
        }
        if (formData.password !== formData.confirmPassword) {
          errors.confirmPassword = 'Passwords do not match';
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, isEditMode]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    // Check user limit before creating (only in create mode)
    if (!isEditMode) {
      if (!canCreate) {
        showToast(
          userCount !== null && userLimit !== null
            ? `User limit reached (${userCount}/${userLimit}). Cannot create more cashiers.`
            : 'User limit reached. Cannot create more cashiers.',
          'error'
        );
        return;
      }
    }

    setLoading(true);
    setFieldErrors({});

    try {
      if (isEditMode && cashier) {
        // Check if values have changed
        const permissionsChanged = 
          selectedPermissionIds.size !== initialPermissionIds.size ||
          Array.from(selectedPermissionIds).some(id => !initialPermissionIds.has(id)) ||
          Array.from(initialPermissionIds).some(id => !selectedPermissionIds.has(id));
        
        const hasChanges = 
          formData.username !== initialFormData.username ||
          formData.email !== initialFormData.email ||
          (formData.password && formData.password.trim() !== '') ||
          formData.isActive !== initialFormData.isActive ||
          permissionsChanged;

        if (!hasChanges) {
          showToast('No changes made', 'info');
          setLoading(false);
          return;
        }

        // Update
        const updateInput: UpdateUserInput = {
          username: formData.username !== initialFormData.username ? formData.username : undefined,
          email: formData.email !== initialFormData.email ? (formData.email || null) : undefined,
          password: formData.password && formData.password.trim() !== '' ? formData.password : undefined,
          isActive: formData.isActive !== initialFormData.isActive ? formData.isActive : undefined,
          permissionIds: Array.from(selectedPermissionIds),
        };

        const result = await UserService.updateUser(cashier.id, updateInput, userId);
        if (result.success) {
          setInitialFormData(formData);
          setInitialPermissionIds(new Set(selectedPermissionIds));
          showToast('Cashier updated successfully', 'success');
          navigate(ROUTES.CASHIERS);
        } else {
          showToast(result.error || 'Failed to update cashier', 'error');
        }
      } else {
        // Create
        const createInput: CreateUserInput = {
          username: formData.username.trim(),
          email: formData.email && formData.email.trim() !== '' ? formData.email.trim() : null,
          password: formData.password,
          permissionIds: selectedPermissionIds.size > 0 ? Array.from(selectedPermissionIds) : undefined,
        };

        const result = await UserService.createUser(createInput, userId);
        if (result.success) {
          showToast('Cashier created successfully', 'success');
          navigate(ROUTES.CASHIERS);
        } else {
          showToast(result.error || 'Failed to create cashier', 'error');
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, validateForm, isEditMode, cashier, formData, initialFormData, navigate, showToast, canCreate, userCount, userLimit, selectedPermissionIds, initialPermissionIds]);

  // Memoized navigation handlers
  const handleBack = useCallback(() => {
    navigate(ROUTES.CASHIERS);
  }, [navigate]);

  const handleCancel = useCallback(() => {
    navigate(ROUTES.CASHIERS);
  }, [navigate]);

  // Keyboard navigation handlers
  const handleUsernameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const emailInput = document.getElementById('cashier-email');
      emailInput?.focus();
    }
  }, []);

  const handleEmailKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const passwordInput = document.getElementById('cashier-password');
      passwordInput?.focus();
    }
  }, []);

  const handlePasswordKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const confirmPasswordInput = document.getElementById('cashier-confirm-password');
      confirmPasswordInput?.focus();
    }
  }, []);

  const handleConfirmPasswordKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If in edit mode, focus the Active switch if it exists, otherwise submit
      if (isEditMode) {
        const activeSwitch = document.querySelector('input[type="checkbox"]');
        if (activeSwitch) {
          (activeSwitch as HTMLElement).focus();
        } else {
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }
      } else {
        // In create mode, submit the form
        const form = document.querySelector('form');
        if (form) {
          form.requestSubmit();
        }
      }
    }
  }, [isEditMode]);

  // Memoized form field handlers
  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, username: value }));
    setFieldErrors((prev) => {
      if (prev.username) {
        const newErrors = { ...prev };
        delete newErrors.username;
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, email: value }));
    setFieldErrors((prev) => {
      if (prev.email) {
        const newErrors = { ...prev };
        delete newErrors.email;
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, password: value }));
    setFieldErrors((prev) => {
      if (prev.password) {
        const newErrors = { ...prev };
        delete newErrors.password;
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, confirmPassword: value }));
    setFieldErrors((prev) => {
      if (prev.confirmPassword) {
        const newErrors = { ...prev };
        delete newErrors.confirmPassword;
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handleIsActiveChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, isActive: e.target.checked }));
  }, []);

  const handlePermissionToggle = useCallback((permissionId: number) => {
    setSelectedPermissionIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return newSet;
    });
  }, []);

  const handleCategoryToggle = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};
    allPermissions.forEach((permission) => {
      const category = permission.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(permission);
    });
    return grouped;
  }, [allPermissions]);


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

  const sectionTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    mb: 2,
  }), []);

  const textFieldWithHelperSx = useMemo(() => ({
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
      minHeight: '44px',
      '& input': {
        padding: '10px 14px',
      },
    },
    '& .MuiFormHelperText-root': {
      fontSize: '14px',
    },
  }), []);

  const buttonsBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 2,
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
    '&:disabled': {
      borderColor: '#e0e0e0',
      color: '#9e9e9e',
    },
  }), []);

  const submitButtonSx = useMemo(() => ({
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

  if (loadingCashier) {
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
          <Box sx={titleBarBoxSx}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton onClick={handleBack} sx={backIconButtonSx}>
                <ArrowBack sx={{ fontSize: '20px' }} />
              </IconButton>
              <Typography variant="h4" fontWeight="bold" sx={titleTypographySx}>
              DigitalizePOS - {isEditMode ? 'Edit Cashier' : 'New Cashier'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ p: '24px' }}>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                    Cashier Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        id="cashier-username"
                        label="Username *"
                        value={formData.username}
                        onChange={handleUsernameChange}
                        onKeyDown={handleUsernameKeyDown}
                        error={!!fieldErrors.username}
                        helperText={fieldErrors.username}
                        disabled={loading}
                        tabIndex={1}
                        autoFocus
                        sx={textFieldWithHelperSx}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        id="cashier-email"
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={handleEmailChange}
                        onKeyDown={handleEmailKeyDown}
                        error={!!fieldErrors.email}
                        helperText={fieldErrors.email}
                        disabled={loading}
                        tabIndex={2}
                        sx={textFieldWithHelperSx}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        id="cashier-password"
                        label={isEditMode ? 'New Password (leave blank to keep current)' : 'Password *'}
                        type="password"
                        value={formData.password}
                        onChange={handlePasswordChange}
                        onKeyDown={handlePasswordKeyDown}
                        error={!!fieldErrors.password}
                        helperText={fieldErrors.password}
                        disabled={loading}
                        tabIndex={3}
                        sx={textFieldWithHelperSx}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        id="cashier-confirm-password"
                        label={isEditMode ? 'Confirm New Password' : 'Confirm Password *'}
                        type="password"
                        value={formData.confirmPassword}
                        onChange={handleConfirmPasswordChange}
                        onKeyDown={handleConfirmPasswordKeyDown}
                        error={!!fieldErrors.confirmPassword}
                        helperText={fieldErrors.confirmPassword}
                        disabled={loading}
                        tabIndex={4}
                        sx={textFieldWithHelperSx}
                      />
                    </Grid>
                    {isEditMode && (
                      <Grid item xs={12}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.isActive}
                              onChange={handleIsActiveChange}
                              disabled={loading}
                            />
                          }
                          label="Active"
                        />
                      </Grid>
                    )}
                    {!isEditMode && userCount !== null && userLimit !== null && (
                      <Grid item xs={12}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '16px',
      minHeight: '44px',
      '& input': {
        padding: '10px 14px',
      },
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            color: userCount >= userLimit ? '#d32f2f' : '#616161',
                            fontWeight: userCount >= userLimit ? 600 : 400,
                            p: 1.5,
                            backgroundColor: userCount >= userLimit ? '#ffebee' : '#f5f5f5',
                            borderRadius: 1,
                            border: userCount >= userLimit ? '1px solid #d32f2f' : '1px solid #e0e0e0',
                          }}
                        >
                          {userCount >= userLimit
                            ? `⚠️ User limit reached (${userCount}/${userLimit}). Cannot create more cashiers.`
                            : `Users: ${userCount} / ${userLimit}${userLimit - userCount === 1 ? ' (1 slot remaining)' : ` (${userLimit - userCount} slots remaining)`}`}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Grid>

                {/* Permissions Section */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                    Permissions
                  </Typography>
                  {loadingPermissions ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : allPermissions.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      No permissions available
                    </Typography>
                  ) : (
                    <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2 }}>
                      {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                        <Box key={category} sx={{ mb: 2 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              cursor: 'pointer',
                              p: 1,
                              borderRadius: 1,
                              '&:hover': {
                                backgroundColor: '#f5f5f5',
                              },
                            }}
                            onClick={() => handleCategoryToggle(category)}
                          >
                            {expandedCategories.has(category) ? (
                              <ExpandLess sx={{ fontSize: '20px', color: '#1a237e', mr: 1 }} />
                            ) : (
                              <ExpandMore sx={{ fontSize: '20px', color: '#1a237e', mr: 1 }} />
                            )}
                            <Typography
                              variant="subtitle1"
                              sx={{
                                fontWeight: 600,
                                fontSize: '16px',
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                color: '#1a237e',
                              }}
                            >
                              {category}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                ml: 1,
                                color: '#616161',
                                fontSize: '14px',
                              }}
                            >
                              ({permissions.filter(p => selectedPermissionIds.has(p.id)).length} / {permissions.length} selected)
                            </Typography>
                          </Box>
                          <Collapse in={expandedCategories.has(category)}>
                            <FormGroup sx={{ pl: 4, pt: 1 }}>
                              {permissions.map((permission) => (
                                <FormControlLabel
                                  key={permission.id}
                                  control={
                                    <Checkbox
                                      checked={selectedPermissionIds.has(permission.id)}
                                      onChange={() => handlePermissionToggle(permission.id)}
                                      disabled={loading}
                                      sx={{
                                        color: '#1a237e',
                                        '&.Mui-checked': {
                                          color: '#1a237e',
                                        },
                                      }}
                                    />
                                  }
                                  label={
                                    <Box>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontSize: '14px',
                                          fontFamily: 'system-ui, -apple-system, sans-serif',
                                          fontWeight: 500,
                                        }}
                                      >
                                        {permission.name}
                                      </Typography>
                                      {permission.description && (
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontSize: '12px',
                                            color: '#616161',
                                            display: 'block',
                                          }}
                                        >
                                          {permission.description}
                                        </Typography>
                                      )}
                                    </Box>
                                  }
                                />
                              ))}
                            </FormGroup>
                          </Collapse>
                          {Object.keys(permissionsByCategory).indexOf(category) < Object.keys(permissionsByCategory).length - 1 && (
                            <Divider sx={{ mt: 2 }} />
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Grid>
              </Grid>

              <Box sx={buttonsBoxSx}>
                <Button
                  onClick={handleCancel}
                  disabled={loading}
                  tabIndex={5}
                  sx={cancelButtonSx}
                >
                  Cancel
                </Button>
                <Button
                  id="cashier-submit"
                  type="submit"
                  variant="contained"
                  disabled={loading || (!isEditMode && !canCreate)}
                  tabIndex={6}
                  sx={submitButtonSx}
                >
                  {loading ? 'Saving...' : isEditMode ? 'Update Cashier' : 'Create Cashier'}
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

export default CashierForm;

