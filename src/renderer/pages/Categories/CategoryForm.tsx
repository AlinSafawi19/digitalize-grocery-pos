import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Button,
  TextField,
  Box,
  Grid,
  Autocomplete,
  CircularProgress,
  Paper,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { RootState } from '../../store';
import { CategoryService, CreateCategoryInput, CategoryWithChildren } from '../../services/category.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

const CategoryForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [category, setCategory] = useState<CategoryWithChildren | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
  }>({});
  
  // Parent category pagination state
  const [parentCategories, setParentCategories] = useState<CategoryWithChildren[]>([]);
  const [parentCategoryLoading, setParentCategoryLoading] = useState(false);
  const [parentCategoryPage, setParentCategoryPage] = useState(1);
  const [parentCategoryHasMore, setParentCategoryHasMore] = useState(true);
  const [parentCategorySearch, setParentCategorySearch] = useState('');

  const [formData, setFormData] = useState<CreateCategoryInput>({
    name: '',
    description: '',
    parentId: null,
  });

  // Initial form data for change detection
  const [initialFormData, setInitialFormData] = useState<CreateCategoryInput>({
    name: '',
    description: '',
    parentId: null,
  });

  // Debounced search state
  const [debouncedParentCategorySearch, setDebouncedParentCategorySearch] = useState('');
  const parentCategorySearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if autocomplete dropdown is open
  const parentCategoryAutocompleteOpenRef = useRef(false);
  
  // Control autocomplete open state for programmatic opening
  const [parentCategoryAutocompleteOpen, setParentCategoryAutocompleteOpen] = useState(false);
  
  // Flag to track if we should move to next field after selection
  const shouldMoveAfterParentCategorySelectRef = useRef(false);

  // Track if parent category autocomplete has been "visited" (opened at least once)
  // Once visited, Enter when closed will trigger form submission instead of opening again
  const parentCategoryVisitedRef = useRef(false);

  // Use ref to access current category without including it in dependencies
  const categoryRef = useRef(category);
  useEffect(() => {
    categoryRef.current = category;
  }, [category]);

  const loadParentCategories = useCallback(async (page: number, reset: boolean = false, search: string = '') => {
    if (!user?.id) return;
    
    setParentCategoryLoading(true);
    try {
      const result = await CategoryService.getCategoriesList(
        { page, pageSize: 50, search },
        user.id
      );
      if (result.success && result.categories) {
        // Filter out the current category to prevent circular reference
        const currentCategory = categoryRef.current;
        const filtered = result.categories.filter((cat) => !currentCategory || cat.id !== currentCategory.id);
        if (reset) {
          setParentCategories(filtered);
        } else {
          setParentCategories((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newItems = filtered.filter((c) => !existingIds.has(c.id));
            return [...prev, ...newItems];
          });
        }
        setParentCategoryHasMore(result.pagination?.hasNextPage ?? false);
      }
    } catch (err) {
      console.error('Failed to load parent categories:', err);
    } finally {
      setParentCategoryLoading(false);
    }
  }, [user?.id]);

  // Debounce parent category search
  useEffect(() => {
    if (parentCategorySearchTimeoutRef.current) {
      clearTimeout(parentCategorySearchTimeoutRef.current);
    }
    parentCategorySearchTimeoutRef.current = setTimeout(() => {
      setDebouncedParentCategorySearch(parentCategorySearch);
    }, 300);

    return () => {
      if (parentCategorySearchTimeoutRef.current) {
        clearTimeout(parentCategorySearchTimeoutRef.current);
      }
    };
  }, [parentCategorySearch]);

  // Load category if editing
  useEffect(() => {
    if (id && user?.id) {
      setIsEditMode(true);
      setLoadingCategory(true);
      CategoryService.getCategoryById(parseInt(id), user.id)
        .then((result) => {
          if (result.success && result.category) {
            const cat = result.category;
            setCategory(cat);
            const loadedFormData = {
              name: cat.name,
              description: cat.description || '',
              parentId: cat.parentId,
            };
            setFormData(loadedFormData);
            setInitialFormData(loadedFormData);
            
            // If editing and has a parent, ensure the parent is loaded
            if (cat.parentId && cat.parent) {
              const parentCategory = cat.parent as CategoryWithChildren;
              setParentCategories((prev) => {
                const exists = prev.some((c) => c.id === cat.parentId);
                if (!exists) {
                  return [parentCategory, ...prev];
                }
                return prev;
              });
            }
            
            // Load initial parent categories (filtering out current category)
            const loadCategories = async () => {
              if (!user?.id) return;
              setParentCategoryLoading(true);
              try {
                const result = await CategoryService.getCategoriesList(
                  { page: 1, pageSize: 50, search: '' },
                  user.id
                );
                if (result.success && result.categories) {
                  // Filter out the current category to prevent circular reference
                  const filtered = result.categories.filter((c) => c.id !== cat.id);
                  setParentCategories(filtered);
                  setParentCategoryHasMore(result.pagination?.hasNextPage ?? false);
                }
              } catch (err) {
                console.error('Failed to load parent categories:', err);
              } finally {
                setParentCategoryLoading(false);
              }
            };
            loadCategories();
          } else {
            showToast(result.error || 'Failed to load category', 'error');
          }
        })
        .catch((err) => {
          showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
        })
        .finally(() => {
          setLoadingCategory(false);
        });
    } else {
      setIsEditMode(false);
      setCategory(null);
      setFormData({
        name: '',
        description: '',
        parentId: null,
        });
    }
  }, [id, user?.id, showToast]);

  // Load initial parent categories for new category
  useEffect(() => {
    if (user?.id && !isEditMode && !id) {
      setParentCategoryPage(1);
      loadParentCategories(1, true, '');
    }
  }, [user?.id, isEditMode, id, loadParentCategories]);

  // Reset and reload when debounced search changes
  useEffect(() => {
    if (user?.id) {
      setParentCategoryPage(1);
      loadParentCategories(1, true, debouncedParentCategorySearch);
    }
  }, [debouncedParentCategorySearch, user?.id, loadParentCategories]);

  const validateForm = useCallback((): boolean => {
    const errors: {
      name?: string;
    } = {};

    // Validate category name
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Category name is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData.name]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setFormData((prev) => ({ ...prev, name: newValue }));
    setFieldErrors((prev) => {
      if (prev.name) {
        return { ...prev, name: undefined };
      }
      return prev;
    });
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, description: e.target.value || null }));
  }, []);

  const handleParentCategoryChange = useCallback((_: unknown, newValue: CategoryWithChildren | null) => {
    setFormData((prev) => ({ ...prev, parentId: newValue ? newValue.id : null }));
    // Set flag to move to next field after dropdown closes
    if (newValue !== null) {
      shouldMoveAfterParentCategorySelectRef.current = true;
    }
  }, []);

  const handleCancel = useCallback(() => {
    const returnPath = (location.state as { returnPath?: string })?.returnPath;
    navigate(returnPath || '/categories');
  }, [navigate, location.state]);

  const handleNavigateBack = useCallback(() => {
    const returnPath = (location.state as { returnPath?: string })?.returnPath;
    navigate(returnPath || '/categories');
  }, [navigate, location.state]);

  // Keyboard navigation handlers
  const handleNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const descriptionInput = document.getElementById('category-description');
      descriptionInput?.focus();
    }
  }, []);

  const handleDescriptionKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // For multiline, Shift+Enter creates new line, Enter moves to next field
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const parentCategoryInput = document.getElementById('category-parent');
      parentCategoryInput?.focus();
    }
  }, []);

  const handleParentCategoryKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // If dropdown is open, close it and trigger form submission
      if (parentCategoryAutocompleteOpenRef.current) {
        e.preventDefault();
        parentCategoryVisitedRef.current = true;
        setParentCategoryAutocompleteOpen(false);
        setTimeout(() => {
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }, 0);
      } else if (parentCategoryVisitedRef.current) {
        // If dropdown is closed and was previously visited, trigger form submission
        e.preventDefault();
        const form = document.querySelector('form');
        if (form) {
          form.requestSubmit();
        }
      } else {
        // If dropdown is closed and not visited yet, open it
        e.preventDefault();
        parentCategoryVisitedRef.current = true;
        setParentCategoryAutocompleteOpen(true);
      }
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setFieldErrors({});

    // Get return path from location state
    const currentReturnPath = (location.state as { returnPath?: string })?.returnPath;

    try {
      if (isEditMode && category) {
        // Check if values have changed
        if (
          formData.name === initialFormData.name &&
          formData.description === initialFormData.description &&
          formData.parentId === initialFormData.parentId
        ) {
          showToast('No changes made', 'info');
          return;
        }

        // Update
        const result = await CategoryService.updateCategory(category.id, formData, user.id);
        if (result.success) {
          setInitialFormData(formData);
          showToast('Category updated successfully', 'success');
          navigate(currentReturnPath || '/categories');
        } else {
          showToast(result.error || 'Failed to update category', 'error');
        }
      } else {
        // Create
        const result = await CategoryService.createCategory(formData, user.id);
        if (result.success) {
          showToast('Category created successfully', 'success');
          navigate(currentReturnPath || '/categories');
        } else {
          showToast(result.error || 'Failed to create category', 'error');
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.id, isEditMode, category, formData, initialFormData, navigate, validateForm, showToast, location.state]);

  // Memoize parent category value to prevent unnecessary re-renders
  // Use a Map for O(1) lookup instead of O(n) find
  const parentCategoriesMap = useMemo(() => {
    return new Map(parentCategories.map((cat) => [cat.id, cat]));
  }, [parentCategories]);

  const parentCategoryValue = useMemo(() => {
    if (!formData.parentId) return null;
    return parentCategoriesMap.get(formData.parentId) || null;
  }, [parentCategoriesMap, formData.parentId]);

  // Handle parent category input change - ignore if it matches selected value's name
  const handleParentCategoryInputChange = useCallback((_: unknown, newInputValue: string) => {
    // If the input value matches the selected parent category's name, clear the search
    // This prevents searching when autocomplete reopens with selected value
    if (parentCategoryValue && parentCategoryValue.name === newInputValue) {
      setParentCategorySearch('');
    } else {
      setParentCategorySearch(newInputValue);
    }
  }, [parentCategoryValue]);

  // Handle parent category autocomplete open - clear search and reload all options
  const handleParentCategoryOpen = useCallback(() => {
    parentCategoryAutocompleteOpenRef.current = true;
    setParentCategoryAutocompleteOpen(true);
    parentCategoryVisitedRef.current = true;
    setParentCategorySearch('');
    setParentCategoryPage(1);
    loadParentCategories(1, true, '');
  }, [loadParentCategories]);

  const handleParentCategoryClose = useCallback((_?: React.SyntheticEvent, reason?: string) => {
    parentCategoryAutocompleteOpenRef.current = false;
    setParentCategoryAutocompleteOpen(false);
    // Trigger form submission if a selection was made (reason will be 'selectOption' when an option is selected)
    if (shouldMoveAfterParentCategorySelectRef.current || reason === 'selectOption') {
      shouldMoveAfterParentCategorySelectRef.current = false;
      // Use setTimeout to ensure the dropdown is fully closed before submitting
      setTimeout(() => {
        const form = document.querySelector('form');
        if (form) {
          form.requestSubmit();
        }
      }, 0);
    }
  }, []);

  // Memoize Autocomplete callbacks to prevent unnecessary re-renders
  const getOptionLabel = useCallback((option: CategoryWithChildren) => option.name || '', []);
  const isOptionEqualToValue = useCallback((option: CategoryWithChildren, value: CategoryWithChildren | null) => {
    if (!value) return false;
    return option.id === value.id;
  }, []);

  // Memoize loading condition
  const autocompleteLoading = useMemo(() => {
    return parentCategoryLoading && (parentCategories.length === 0 || parentCategorySearch !== '');
  }, [parentCategoryLoading, parentCategories.length, parentCategorySearch]);

  // Memoize scroll handler for infinite scroll
  const handleAutocompleteScroll = useCallback((event: React.UIEvent<HTMLUListElement>) => {
    const listboxNode = event.currentTarget;
    if (
      listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 10 &&
      parentCategoryHasMore &&
      !parentCategoryLoading
    ) {
      const nextPage = parentCategoryPage + 1;
      setParentCategoryPage(nextPage);
      loadParentCategories(nextPage, false, debouncedParentCategorySearch);
    }
  }, [parentCategoryHasMore, parentCategoryLoading, parentCategoryPage, debouncedParentCategorySearch, loadParentCategories]);

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
    '& .MuiFormHelperText-root': {
      fontSize: '14px',
    },
  }), []);

  const textFieldMultilineSx = useMemo(() => ({
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

  const autocompleteTextFieldSx = useMemo(() => ({
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

  const listboxPropsSx = useMemo(() => ({
    maxHeight: 300,
  }), []);

  if (loadingCategory) {
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
              <IconButton onClick={handleNavigateBack} sx={backIconButtonSx}>
                <ArrowBack sx={{ fontSize: '20px' }} />
              </IconButton>
              <Typography variant="h4" fontWeight="bold" sx={titleTypographySx}>
              DigitalizePOS - {isEditMode ? 'Edit Category' : 'New Category'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ p: '24px' }}>

            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                    Category Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Tooltip title="Category Name - Enter the name of the category. This name will be used to organize products and can be displayed on receipts and reports. This is a required field.">
                        <TextField
                          fullWidth
                          id="category-name"
                          label="Category Name *"
                          value={formData.name}
                          onChange={handleNameChange}
                          onKeyDown={handleNameKeyDown}
                          error={!!fieldErrors.name}
                          helperText={fieldErrors.name}
                          disabled={loading}
                          tabIndex={1}
                          autoFocus
                          sx={textFieldSx}
                        />
                      </Tooltip>
                    </Grid>
                    <Grid item xs={12}>
                      <Tooltip title="Description - Enter a description for this category. This is optional but helpful for organizing and identifying categories.">
                        <TextField
                          fullWidth
                          id="category-description"
                          label="Description"
                          value={formData.description}
                          onChange={handleDescriptionChange}
                          onKeyDown={handleDescriptionKeyDown}
                          multiline
                          rows={3}
                          disabled={loading}
                          tabIndex={2}
                          sx={textFieldMultilineSx}
                        />
                      </Tooltip>
                    </Grid>
                    <Grid item xs={12}>
                      <Tooltip title="Parent Category - Select a parent category to create a subcategory. Leave empty to create a root category. Categories can be organized hierarchically for better product organization.">
                        <Autocomplete
                          id="category-parent"
                          options={parentCategories}
                          value={parentCategoryValue}
                          onChange={handleParentCategoryChange}
                          onInputChange={handleParentCategoryInputChange}
                          open={parentCategoryAutocompleteOpen}
                          onOpen={handleParentCategoryOpen}
                          onClose={handleParentCategoryClose}
                          getOptionLabel={getOptionLabel}
                          isOptionEqualToValue={isOptionEqualToValue}
                          loading={autocompleteLoading}
                          disabled={loading}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Parent Category"
                              placeholder="None (Root Category)"
                              disabled={loading}
                              onKeyDown={handleParentCategoryKeyDown}
                              tabIndex={3}
                              InputLabelProps={{
                                ...params.InputLabelProps,
                                shrink: !!parentCategoryValue,
                              }}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {autocompleteLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                  {params.InputProps.endAdornment}
                                </>
                              ),
                            }}
                            sx={autocompleteTextFieldSx}
                          />
                        )}
                        ListboxProps={{
                          onScroll: handleAutocompleteScroll,
                          style: listboxPropsSx,
                        }}
                        noOptionsText="No categories found"
                      />
                      </Tooltip>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>

              <Box sx={buttonsBoxSx}>
                <Button
                  onClick={handleCancel}
                  disabled={loading}
                  tabIndex={4}
                  sx={cancelButtonSx}
                >
                  Cancel
                </Button>
                <Button
                  id="category-submit"
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  tabIndex={5}
                  sx={submitButtonSx}
                >
                  {loading ? 'Saving...' : isEditMode ? 'Update Category' : 'Create Category'}
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

export default CategoryForm;

