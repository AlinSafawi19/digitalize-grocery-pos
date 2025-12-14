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
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useSelector } from 'react-redux';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { RootState } from '../../store';
import { SupplierService, CreateSupplierInput } from '../../services/supplier.service';
import { Supplier } from '../../services/product.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

const SupplierForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  // Optimize useSelector to only subscribe to user.id
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { toast, showToast, hideToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingSupplier, setLoadingSupplier] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
  }>({});

  const [formData, setFormData] = useState<CreateSupplierInput>({
    name: '',
    contact: '',
    email: '',
    phone: '',
    address: '',
  });

  // Initial form data for change detection
  const [initialFormData, setInitialFormData] = useState<CreateSupplierInput>({
    name: '',
    contact: '',
    email: '',
    phone: '',
    address: '',
  });

  // Ref to track if component is mounted (for cleanup)
  const isMountedRef = useRef(true);

  // Load supplier if editing
  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;

    if (id && userId) {
      setIsEditMode(true);
      setLoadingSupplier(true);
      SupplierService.getSupplierById(parseInt(id), userId)
        .then((result) => {
          if (cancelled || !isMountedRef.current) return;
          
          if (result.success && result.supplier) {
            const sup = result.supplier;
            setSupplier(sup);
            const loadedFormData = {
              name: sup.name,
              contact: sup.contact || '',
              email: sup.email || '',
              phone: sup.phone || '',
              address: sup.address || '',
            };
            setFormData(loadedFormData);
            setInitialFormData(loadedFormData);
          } else {
            showToast(result.error || 'Failed to load supplier', 'error');
          }
        })
        .catch((err) => {
          if (cancelled || !isMountedRef.current) return;
          showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
        })
        .finally(() => {
          if (!cancelled && isMountedRef.current) {
            setLoadingSupplier(false);
          }
        });
    } else {
      setIsEditMode(false);
      setSupplier(null);
      setFormData({
        name: '',
        contact: '',
        email: '',
        phone: '',
        address: '',
      });
    }

    return () => {
      cancelled = true;
      isMountedRef.current = false;
    };
  }, [id, userId, showToast]);

  const validateForm = useCallback((): boolean => {
    const errors: {
      name?: string;
      phone?: string;
    } = {};

    // Validate supplier name
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Supplier name is required';
    }

    // Validate phone
    if (!formData.phone || formData.phone.trim() === '') {
      errors.phone = 'Phone is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData.name, formData.phone]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setFieldErrors({});

    try {
      if (isEditMode && supplier) {
        // Check if values have changed
        if (
          formData.name === initialFormData.name &&
          formData.contact === initialFormData.contact &&
          formData.email === initialFormData.email &&
          formData.phone === initialFormData.phone &&
          formData.address === initialFormData.address
        ) {
          showToast('No changes made', 'info');
          return;
        }

        // Update
        const result = await SupplierService.updateSupplier(supplier.id, formData, userId);
        if (result.success) {
          setInitialFormData(formData);
          showToast('Supplier updated successfully', 'success');
          const returnPath = (location.state as { returnPath?: string })?.returnPath;
          navigate(returnPath || '/suppliers');
        } else {
          showToast(result.error || 'Failed to update supplier', 'error');
        }
      } else {
        // Create
        const result = await SupplierService.createSupplier(formData, userId);
        if (result.success) {
          showToast('Supplier created successfully', 'success');
          const returnPath = (location.state as { returnPath?: string })?.returnPath;
          navigate(returnPath || '/suppliers');
        } else {
          showToast(result.error || 'Failed to create supplier', 'error');
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, validateForm, isEditMode, supplier, formData, initialFormData, navigate, showToast, location.state]);

  // Memoized navigation handlers
  const handleBack = useCallback(() => {
    const returnPath = (location.state as { returnPath?: string })?.returnPath;
    navigate(returnPath || '/suppliers');
  }, [navigate, location.state]);

  const handleCancel = useCallback(() => {
    const returnPath = (location.state as { returnPath?: string })?.returnPath;
    navigate(returnPath || '/suppliers');
  }, [navigate, location.state]);

  // Keyboard navigation handlers
  const handleNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const contactInput = document.getElementById('supplier-contact');
      contactInput?.focus();
    }
  }, []);

  const handleContactKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const emailInput = document.getElementById('supplier-email');
      emailInput?.focus();
    }
  }, []);

  const handleEmailKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const phoneInput = document.getElementById('supplier-phone');
      phoneInput?.focus();
    }
  }, []);


  const handleAddressKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // For multiline, Shift+Enter creates new line, Enter triggers form submission
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = document.querySelector('form');
      if (form) {
        form.requestSubmit();
      }
    }
  }, []);

  // Memoized form field handlers with functional updates
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, name: value }));
    setFieldErrors((prev) => {
      if (prev.name) {
        const newErrors = { ...prev };
        delete newErrors.name;
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handleContactChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, contact: e.target.value || null }));
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, email: e.target.value || null }));
  }, []);

  const handlePhoneChange = useCallback((value: string | undefined) => {
    const phoneValue = value || '';
    setFormData((prev) => ({ ...prev, phone: phoneValue }));
    setFieldErrors((prev) => {
      if (prev.phone) {
        const newErrors = { ...prev };
        delete newErrors.phone;
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handleAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, address: e.target.value || null }));
  }, []);

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
      minHeight: '44px',
      '& input': {
        padding: '10px 14px',
      },
    },
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

  if (loadingSupplier) {
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
              DigitalizePOS - {isEditMode ? 'Edit Supplier' : 'New Supplier'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ p: '24px' }}>

            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                    Supplier Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        id="supplier-name"
                        label="Supplier Name *"
                        value={formData.name}
                        onChange={handleNameChange}
                        onKeyDown={handleNameKeyDown}
                        error={!!fieldErrors.name}
                        helperText={fieldErrors.name}
                        disabled={loading}
                        tabIndex={1}
                        autoFocus
                        sx={textFieldWithHelperSx}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        id="supplier-contact"
                        label="Contact Person"
                        value={formData.contact}
                        onChange={handleContactChange}
                        onKeyDown={handleContactKeyDown}
                        disabled={loading}
                        tabIndex={2}
                        sx={textFieldSx}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        id="supplier-email"
                        label="Email"
                        type="text"
                        value={formData.email}
                        onChange={handleEmailChange}
                        onKeyDown={handleEmailKeyDown}
                        disabled={loading}
                        tabIndex={3}
                        sx={textFieldSx}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box>
                        <Typography variant="body2" sx={{ mb: 1, fontSize: '16px', color: fieldErrors.phone ? 'error.main' : 'text.secondary' }}>
                          Phone *
                        </Typography>
                        <PhoneInput
                          international
                          defaultCountry="LB"
                          value={(formData.phone || undefined) as string | undefined}
                          onChange={handlePhoneChange}
                          disabled={loading}
                          className="mui-phone-input"
                          style={{
                            '--PhoneInputInput-height': '44px',
                            '--PhoneInputInput-fontSize': '16px',
                          } as React.CSSProperties}
                        />
                        {fieldErrors.phone && (
                          <Typography variant="caption" sx={{ color: 'error.main', fontSize: '14px', mt: 0.5, display: 'block' }}>
                            {fieldErrors.phone}
                          </Typography>
                        )}
                        <style>{`
                          .mui-phone-input {
                            width: 100%;
                          }
                          .mui-phone-input .PhoneInputInput {
                            width: 100%;
                            height: 44px;
                            padding: 10px 14px;
                            font-size: 16px;
                            border: 1px solid ${fieldErrors.phone ? '#d32f2f' : '#c0c0c0'};
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
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        id="supplier-address"
                        label="Address"
                        value={formData.address}
                        onChange={handleAddressChange}
                        onKeyDown={handleAddressKeyDown}
                        multiline
                        rows={3}
                        disabled={loading}
                        tabIndex={5}
                        sx={textFieldSx}
                      />
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>

              <Box sx={buttonsBoxSx}>
                <Button
                  onClick={handleCancel}
                  disabled={loading}
                  tabIndex={6}
                  sx={cancelButtonSx}
                >
                  Cancel
                </Button>
                <Button
                  id="supplier-submit"
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  tabIndex={7}
                  sx={submitButtonSx}
                >
                  {loading ? 'Saving...' : isEditMode ? 'Update Supplier' : 'Create Supplier'}
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

export default SupplierForm;

