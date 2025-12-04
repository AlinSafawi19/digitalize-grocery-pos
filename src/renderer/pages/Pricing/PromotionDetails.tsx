import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Chip,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Paper,
} from '@mui/material';
import { ArrowBack, Edit, CheckCircle, Cancel } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { PricingService, Promotion } from '../../services/pricing.service';
import MainLayout from '../../components/layout/MainLayout';
import { ROUTES } from '../../utils/constants';
import { formatDateTime, formatDate, toBeirutTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

const PromotionDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { toast, showToast, hideToast } = useToast();

  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);

  const loadPromotion = useCallback(async () => {
    if (!id || !userId) {
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const currentRequestId = ++requestIdRef.current;

    setLoading(true);

    try {
      const promotionId = parseInt(id, 10);
      if (isNaN(promotionId)) {
        showToast('Invalid promotion ID', 'error');
        setLoading(false);
        return;
      }

      const result = await PricingService.getPromotion(promotionId, userId);
      
      if (abortController.signal.aborted || currentRequestId !== requestIdRef.current) {
        return;
      }

      if (result.success && result.promotion) {
        setPromotion(result.promotion);
      } else {
        showToast(result.error || 'Failed to load promotion', 'error');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [id, userId, showToast]);

  useEffect(() => {
    loadPromotion();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [loadPromotion]);

  const handleEdit = useCallback(() => {
    if (promotion) {
      navigate(`${ROUTES.PROMOTIONS}/edit/${promotion.id}`);
    }
  }, [promotion, navigate]);

  const formattedCreatedAt = useMemo(() => {
    return promotion ? formatDateTime(promotion.createdAt) : '';
  }, [promotion]);

  const formattedUpdatedAt = useMemo(() => {
    return promotion ? formatDateTime(promotion.updatedAt) : '';
  }, [promotion]);

  const formattedStartDate = useMemo(() => {
    return promotion ? formatDate(promotion.startDate) : '';
  }, [promotion]);

  const formattedEndDate = useMemo(() => {
    return promotion ? formatDate(promotion.endDate) : '';
  }, [promotion]);

  const getTypeLabel = useCallback((type: Promotion['type']) => {
    const labels: Record<Promotion['type'], string> = {
      product_promotion: 'Product Promotion',
      category_promotion: 'Category Promotion',
      store_wide: 'Store-wide',
    };
    return labels[type] || type;
  }, []);

  const isActive = useCallback((promotion: Promotion) => {
    if (!promotion.isActive) return false;
    const now = toBeirutTime(new Date());
    if (!now) return false;
    
    const startDate = toBeirutTime(promotion.startDate);
    const endDate = toBeirutTime(promotion.endDate);
    
    if (!startDate || !endDate) return false;
    
    return (startDate.isBefore(now) || startDate.isSame(now)) && (endDate.isAfter(now) || endDate.isSame(now));
  }, []);

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
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    borderColor: '#c0c0c0',
    color: '#1a237e',
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
    padding: '4px',
    color: '#ffffff',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#ffffff',
    fontWeight: 600,
  }), []);

  const editButtonSx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    color: '#ffffff',
    padding: '4px 8px',
    minWidth: 'auto',
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

  const promotionNameTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const dividerSx = useMemo(() => ({
    my: 3,
    borderColor: '#e0e0e0',
  }), []);

  const descriptionDividerSx = useMemo(() => ({
    my: 2,
    borderColor: '#e0e0e0',
  }), []);

  const descriptionTypographySx = useMemo(() => ({
    mb: 2,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const labelTypographySx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const chipSx = useMemo(() => ({
    mt: 0.5,
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const sectionTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const sectionDividerSx = useMemo(() => ({
    mb: 2,
    borderColor: '#e0e0e0',
  }), []);

  const metadataCardSx = useMemo(() => ({
    mt: 2,
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const handleNavigateBack = useCallback(() => {
    navigate(ROUTES.PROMOTIONS);
  }, [navigate]);

  const duration = useMemo(() => {
    if (!promotion) return '-';
    const start = toBeirutTime(promotion.startDate);
    const end = toBeirutTime(promotion.endDate);
    if (start && end) {
      const days = end.diff(start, 'days');
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    return '-';
  }, [promotion]);

  const titleBarContentBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
  }), []);

  const contentBoxSx = useMemo(() => ({
    p: 3,
  }), []);

  const promotionHeaderBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    mb: 2,
  }), []);

  const bodyTypographyWithMarginSx = useMemo(() => ({
    ...bodyTypographySx,
    mt: 0.5,
  }), [bodyTypographySx]);

  if (loading) {
    return (
      <MainLayout>
        <Box sx={loadingBoxSx}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (!promotion) {
    return (
      <MainLayout>
        <Box sx={containerBoxSx}>
          <Button startIcon={<ArrowBack />} onClick={handleNavigateBack} sx={backButtonSx}>
            Back to Promotions
          </Button>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={mainContainerBoxSx}>
        <Paper sx={paperSx}>
          <Box sx={titleBarBoxSx}>
            <Box sx={titleBarContentBoxSx}>
              <IconButton onClick={handleNavigateBack} sx={backIconButtonSx}>
                <ArrowBack />
              </IconButton>
              <Typography sx={titleTypographySx}>
                Promotion Details
              </Typography>
            </Box>
            <Button startIcon={<Edit />} onClick={handleEdit} sx={editButtonSx}>
              Edit Promotion
            </Button>
          </Box>

          <Box sx={contentBoxSx}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Box sx={promotionHeaderBoxSx}>
                      <Typography sx={promotionNameTypographySx}>
                        {promotion.name}
                      </Typography>
                      <Chip
                        label={isActive(promotion) ? 'Active' : 'Inactive'}
                        color={isActive(promotion) ? 'success' : 'default'}
                        icon={isActive(promotion) ? <CheckCircle /> : <Cancel />}
                        sx={chipSx}
                      />
                    </Box>

                    {promotion.description && (
                      <>
                        <Divider sx={descriptionDividerSx} />
                        <Typography variant="body1" sx={descriptionTypographySx}>
                          {promotion.description}
                        </Typography>
                      </>
                    )}

                    <Divider sx={dividerSx} />

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography sx={labelTypographySx}>
                          Type
                        </Typography>
                        <Chip label={getTypeLabel(promotion.type)} size="small" sx={chipSx} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography sx={labelTypographySx}>
                          Start Date
                        </Typography>
                        <Typography sx={bodyTypographyWithMarginSx}>
                          {formattedStartDate}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography sx={labelTypographySx}>
                          End Date
                        </Typography>
                        <Typography sx={bodyTypographyWithMarginSx}>
                          {formattedEndDate}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography sx={labelTypographySx}>
                          Duration
                        </Typography>
                        <Typography sx={bodyTypographyWithMarginSx}>
                          {duration}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography sx={sectionTitleTypographySx}>
                      Status Information
                    </Typography>
                    <Divider sx={sectionDividerSx} />
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography sx={labelTypographySx}>
                          Active Status
                        </Typography>
                        <Chip
                          label={promotion.isActive ? 'Enabled' : 'Disabled'}
                          color={promotion.isActive ? 'success' : 'default'}
                          size="small"
                          sx={chipSx}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Typography sx={labelTypographySx}>
                          Current Status
                        </Typography>
                        <Chip
                          label={isActive(promotion) ? 'Active' : 'Inactive'}
                          color={isActive(promotion) ? 'success' : 'default'}
                          size="small"
                          sx={chipSx}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                <Card sx={metadataCardSx}>
                  <CardContent>
                    <Typography sx={sectionTitleTypographySx}>
                      Metadata
                    </Typography>
                    <Divider sx={sectionDividerSx} />
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography sx={labelTypographySx}>
                          Created At
                        </Typography>
                        <Typography sx={bodyTypographySx}>
                          {formattedCreatedAt}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography sx={labelTypographySx}>
                          Last Updated
                        </Typography>
                        <Typography sx={bodyTypographySx}>
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

export default PromotionDetails;

