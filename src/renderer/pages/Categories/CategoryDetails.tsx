import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Chip,
  Paper,
} from '@mui/material';
import { ArrowBack, Edit } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { CategoryService, CategoryWithChildren } from '../../services/category.service';
import MainLayout from '../../components/layout/MainLayout';
import { ROUTES } from '../../utils/constants';
import { formatDateTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

// Memoized child category chip component to prevent unnecessary re-renders
interface CategoryChipProps {
  id: number;
  name: string;
  onClick: (id: number) => void;
}

// eslint-disable-next-line react/prop-types
const CategoryChip = memo<CategoryChipProps>(({ id, name, onClick }) => {
  const handleClick = useCallback(() => {
    onClick(id);
  }, [id, onClick]);

  // Memoize sx prop object
  const chipSx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
    height: '32px',
    '&:hover': {
      backgroundColor: '#e3f2fd',
      color: '#1a237e',
    },
  }), []);

  return (
    <Chip
      label={name}
      size="small"
      onClick={handleClick}
      clickable
      sx={chipSx}
    />
  );
});

CategoryChip.displayName = 'CategoryChip';

const CategoryDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Optimize useSelector to only select user.id to prevent unnecessary re-renders
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { toast, showToast, hideToast } = useToast();

  const [category, setCategory] = useState<CategoryWithChildren | null>(null);
  const [loading, setLoading] = useState(true);

  // Abort controller for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track request ID to handle race conditions
  const requestIdRef = useRef<number>(0);

  const loadCategory = useCallback(async () => {
    if (!id || !userId) {
      setLoading(false);
      return;
    }

    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Increment request ID to track this specific request
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);

    try {
      const categoryId = parseInt(id, 10);
      if (isNaN(categoryId)) {
        showToast('Invalid category ID', 'error');
        setLoading(false);
        return;
      }

      const result = await CategoryService.getCategoryById(categoryId, userId);
      
      // Check if this request was cancelled or if a newer request was made
      if (abortController.signal.aborted || currentRequestId !== requestIdRef.current) {
        return;
      }

      if (result.success && result.category) {
        setCategory(result.category);
      } else {
        showToast(result.error || 'Failed to load category', 'error');
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      // Check if this request is still current
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      // Only update loading state if this is still the current request
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [id, userId, showToast]);

  useEffect(() => {
    loadCategory();

    // Cleanup function to cancel pending requests on unmount or when dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [loadCategory]);

  const handleEdit = useCallback(() => {
    if (category) {
      navigate(`${ROUTES.CATEGORIES}/edit/${category.id}`);
    }
  }, [category, navigate]);

  // Memoize formatted dates to avoid recalculating on every render
  // Only depend on the actual date fields, not the entire category object
  const formattedCreatedAt = useMemo(() => {
    return category?.createdAt ? formatDateTime(category.createdAt) : '';
  }, [category?.createdAt]);

  const formattedUpdatedAt = useMemo(() => {
    return category?.updatedAt ? formatDateTime(category.updatedAt) : '';
  }, [category?.updatedAt]);

  // Memoize navigation handlers to prevent unnecessary re-renders
  const handleBackToCategories = useCallback(() => {
    navigate(ROUTES.CATEGORIES);
  }, [navigate]);

  const handleNavigateToParent = useCallback((parentId: number) => {
    navigate(`${ROUTES.CATEGORIES}/view/${parentId}`);
  }, [navigate]);

  const handleNavigateToChild = useCallback((childId: number) => {
    navigate(`${ROUTES.CATEGORIES}/view/${childId}`);
  }, [navigate]);

  // Memoize parent category navigation handler to prevent re-renders
  const handleParentClick = useMemo(() => {
    if (!category?.parent) return undefined;
    return () => handleNavigateToParent(category.parent!.id);
  }, [category?.parent, handleNavigateToParent]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  }), []);

  const containerBoxSx = useMemo(() => ({
    p: 2,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const backButtonSx = useMemo(() => ({
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

  const mainContainerBoxSx = useMemo(() => ({
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }), []);

  const backIconButtonSx = useMemo(() => ({
    mr: 2,
    padding: '8px',
    width: '48px',
    height: '48px',
    color: '#ffffff',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#ffffff',
    fontWeight: 600,
  }), []);

  const editButtonSx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    color: '#ffffff',
    padding: '8px 16px',
    minWidth: 'auto',
    minHeight: '40px',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
  }), []);

  const cardSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const categoryNameTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const descriptionTypographySx = useMemo(() => ({
    mt: 2,
    mb: 2,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const dividerSx = useMemo(() => ({
    my: 3,
    borderColor: '#e0e0e0',
  }), []);

  const labelTypographySx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const parentChipSx = useMemo(() => ({
    mt: 0.5,
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
    height: '32px',
    '&:hover': {
      backgroundColor: '#e3f2fd',
      color: '#1a237e',
    },
  }), []);

  const childrenBoxSx = useMemo(() => ({
    mt: 0.5,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 0.5,
  }), []);

  const sectionTitleTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const sectionDividerSx = useMemo(() => ({
    mb: 2,
    borderColor: '#e0e0e0',
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

  if (!category) {
    return (
      <MainLayout>
        <Box sx={containerBoxSx}>
          <Button
            startIcon={<ArrowBack sx={{ fontSize: '28px' }} />}
            onClick={handleBackToCategories}
            sx={backButtonSx}
          >
            Back to Categories
          </Button>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={mainContainerBoxSx}>
        <Paper elevation={0} sx={paperSx}>
          {/* Title Bar */}
          <Box sx={titleBarBoxSx}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton onClick={handleBackToCategories} sx={backIconButtonSx}>
                <ArrowBack />
              </IconButton>
              <Typography variant="h4" component="h1" fontWeight="bold" sx={titleTypographySx}>
              DigitalizePOS - {category.name}
              </Typography>
            </Box>
            <Button
              variant="text"
              startIcon={<Edit sx={{ fontSize: '24px' }} />}
              onClick={handleEdit}
              sx={editButtonSx}
            >
              Edit Category
            </Button>
          </Box>

          <Box sx={{ p: '24px' }}>

            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="h5" gutterBottom sx={categoryNameTypographySx}>
                      {category.name}
                    </Typography>
                    {category.description && (
                      <Typography variant="body1" sx={descriptionTypographySx}>
                        {category.description}
                      </Typography>
                    )}

                    <Divider sx={dividerSx} />

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                          Parent Category
                        </Typography>
                        {category.parent ? (
                          <Chip
                            label={category.parent.name}
                            size="small"
                            sx={parentChipSx}
                            onClick={handleParentClick}
                            clickable
                          />
                        ) : (
                          <Typography variant="body1" sx={[bodyTypographySx, { mt: 0.5 }]}>
                            -
                          </Typography>
                        )}
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                          Child Categories
                        </Typography>
                        {category.children && category.children.length > 0 ? (
                          <Box sx={childrenBoxSx}>
                            {category.children.map((child) => (
                              <CategoryChip
                                key={child.id}
                                id={child.id}
                                name={child.name}
                                onClick={handleNavigateToChild}
                              />
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body1" sx={[bodyTypographySx, { mt: 0.5 }]}>
                            -
                          </Typography>
                        )}
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                      Metadata
                    </Typography>
                    <Divider sx={sectionDividerSx} />
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                          Created At
                        </Typography>
                        <Typography variant="body2" sx={bodyTypographySx}>
                          {formattedCreatedAt}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                          Last Updated
                        </Typography>
                        <Typography variant="body2" sx={bodyTypographySx}>
                          {formattedUpdatedAt}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default CategoryDetails;

