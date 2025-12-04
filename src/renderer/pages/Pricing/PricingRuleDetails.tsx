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
import { useAppSelector } from '../../store/hooks';
import { PricingService, PricingRule } from '../../services/pricing.service';
import MainLayout from '../../components/layout/MainLayout';
import { ROUTES } from '../../utils/constants';
import { formatDateTime, formatDate, toBeirutTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

const PricingRuleDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = useAppSelector((state) => state.auth.user?.id);
  const { toast, showToast, hideToast } = useToast();

  const [rule, setRule] = useState<PricingRule | null>(null);
  const [loading, setLoading] = useState(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);

  const loadRule = useCallback(async () => {
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
      const ruleId = parseInt(id, 10);
      if (isNaN(ruleId)) {
        showToast('Invalid pricing rule ID', 'error');
        setLoading(false);
        return;
      }

      const result = await PricingService.getRule(ruleId, userId);
      
      if (abortController.signal.aborted || currentRequestId !== requestIdRef.current) {
        return;
      }

      if (result.success && result.rule) {
        setRule(result.rule);
      } else {
        showToast(result.error || 'Failed to load pricing rule', 'error');
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
    loadRule();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [loadRule]);

  const handleEdit = useCallback(() => {
    if (rule) {
      navigate(`${ROUTES.PRICING_RULES}/edit/${rule.id}`);
    }
  }, [rule, navigate]);

  const handleNavigateBack = useCallback(() => {
    navigate(ROUTES.PRICING_RULES);
  }, [navigate]);

  const formattedCreatedAt = useMemo(() => {
    return rule ? formatDateTime(rule.createdAt) : '';
  }, [rule]);

  const formattedUpdatedAt = useMemo(() => {
    return rule ? formatDateTime(rule.updatedAt) : '';
  }, [rule]);

  const formattedStartDate = useMemo(() => {
    return rule?.startDate ? formatDate(rule.startDate) : 'No start date';
  }, [rule]);

  const formattedEndDate = useMemo(() => {
    return rule?.endDate ? formatDate(rule.endDate) : 'No end date';
  }, [rule]);

  const getTypeLabel = useCallback((type: PricingRule['type']) => {
    const labels: Record<PricingRule['type'], string> = {
      percentage_discount: 'Percentage Discount',
      fixed_discount: 'Fixed Discount',
      quantity_based: 'Quantity Based',
      buy_x_get_y: 'Buy X Get Y',
      time_based: 'Time Based',
    };
    return labels[type] || type;
  }, []);

  const getDiscountDisplay = useCallback((rule: PricingRule) => {
    if (rule.discountType === 'percentage') {
      return `${rule.discountValue}%`;
    }
    return `$${rule.discountValue.toFixed(2)}`;
  }, []);

  const getTargetDisplay = useCallback((rule: PricingRule) => {
    if (rule.product) {
      return `Product: ${rule.product.name}`;
    }
    if (rule.category) {
      return `Category: ${rule.category.name}`;
    }
    return 'Store-wide';
  }, []);

  const isActive = useCallback((rule: PricingRule) => {
    if (!rule.isActive) return false;
    const now = toBeirutTime(new Date());
    if (!now) return false;
    
    if (rule.startDate) {
      const startDate = toBeirutTime(rule.startDate);
      if (startDate && startDate.isAfter(now)) return false;
    }
    
    if (rule.endDate) {
      const endDate = toBeirutTime(rule.endDate);
      if (endDate && endDate.isBefore(now)) return false;
    }
    
    return true;
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

  const ruleNameTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const dividerSx = useMemo(() => ({
    my: 3,
    borderColor: '#e0e0e0',
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

  const discountTypographySx = useMemo(() => ({
    fontSize: { xs: '20px', sm: '24px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
    fontWeight: 600,
  }), []);

  const metadataCardSx = useMemo(() => ({
    mt: 2,
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const titleBarContentBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
  }), []);

  const contentBoxSx = useMemo(() => ({
    p: 3,
  }), []);

  const ruleHeaderBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    mb: 2,
  }), []);

  const bodyTypographyWithMarginSx = useMemo(() => ({
    ...bodyTypographySx,
    mt: 0.5,
  }), [bodyTypographySx]);

  const discountTypographyWithMarginSx = useMemo(() => ({
    ...discountTypographySx,
    mt: 0.5,
  }), [discountTypographySx]);

  if (loading) {
    return (
      <MainLayout>
        <Box sx={loadingBoxSx}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (!rule) {
    return (
      <MainLayout>
        <Box sx={containerBoxSx}>
          <Button startIcon={<ArrowBack />} onClick={handleNavigateBack} sx={backButtonSx}>
            Back to Pricing Rules
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
                Pricing Rule Details
              </Typography>
            </Box>
            <Button startIcon={<Edit />} onClick={handleEdit} sx={editButtonSx}>
              Edit Rule
            </Button>
          </Box>

          <Box sx={contentBoxSx}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Box sx={ruleHeaderBoxSx}>
                      <Typography sx={ruleNameTypographySx}>
                        {rule.name}
                      </Typography>
                      <Chip
                        label={isActive(rule) ? 'Active' : 'Inactive'}
                        color={isActive(rule) ? 'success' : 'default'}
                        icon={isActive(rule) ? <CheckCircle /> : <Cancel />}
                        sx={chipSx}
                      />
                    </Box>

                    <Divider sx={dividerSx} />

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography sx={labelTypographySx}>
                          Type
                        </Typography>
                        <Chip label={getTypeLabel(rule.type)} size="small" sx={chipSx} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography sx={labelTypographySx}>
                          Target
                        </Typography>
                        <Typography sx={bodyTypographyWithMarginSx}>
                          {getTargetDisplay(rule)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography sx={labelTypographySx}>
                          Discount
                        </Typography>
                        <Typography sx={discountTypographyWithMarginSx}>
                          {getDiscountDisplay(rule)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography sx={labelTypographySx}>
                          Minimum Quantity
                        </Typography>
                        <Typography sx={bodyTypographyWithMarginSx}>
                          {rule.minQuantity || 'No minimum'}
                        </Typography>
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
                          label={rule.isActive ? 'Enabled' : 'Disabled'}
                          color={rule.isActive ? 'success' : 'default'}
                          size="small"
                          sx={chipSx}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Typography sx={labelTypographySx}>
                          Current Status
                        </Typography>
                        <Chip
                          label={isActive(rule) ? 'Active' : 'Inactive'}
                          color={isActive(rule) ? 'success' : 'default'}
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

export default PricingRuleDetails;

