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
import { ArrowBack, Edit } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ProductService, Product } from '../../services/product.service';
import ProductImageGallery from '../../components/product-image/ProductImageGallery';
import ProductImageUpload from '../../components/product-image/ProductImageUpload';
import { ProductImageService } from '../../services/product-image.service';
import MainLayout from '../../components/layout/MainLayout';
import { ROUTES } from '../../utils/constants';
import { formatDateTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Optimize useSelector to only select user.id to prevent unnecessary re-renders
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { toast, showToast, hideToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageCount, setImageCount] = useState(0);
  const [imageRefreshKey, setImageRefreshKey] = useState(0);

  // Abort controller for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track request ID to handle race conditions
  const requestIdRef = useRef<number>(0);

  const loadProduct = useCallback(async () => {
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
      const productId = parseInt(id, 10);
      if (isNaN(productId)) {
        showToast('Invalid product ID', 'error');
        setLoading(false);
        return;
      }

      const result = await ProductService.getProductById(productId, userId);

      // Check if this request was cancelled or if a newer request was made
      if (abortController.signal.aborted || currentRequestId !== requestIdRef.current) {
        return;
      }

      if (result.success && result.product) {
        const prod = result.product;
        setProduct(prod);
        // Load image count
        ProductImageService.getByProductId(prod.id).then((images) => {
          setImageCount(images.length);
        });
      } else {
        showToast(result.error || 'Failed to load product', 'error');
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
    loadProduct();

    // Cleanup function to cancel pending requests on unmount or when dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [loadProduct]);

  const handleEdit = useCallback(() => {
    if (product) {
      navigate(`${ROUTES.PRODUCTS}/edit/${product.id}`);
    }
  }, [product, navigate]);

  const handleNavigateBack = useCallback(() => {
    navigate(ROUTES.PRODUCTS);
  }, [navigate]);

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

  const productNameTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const codeTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
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

  const chipSx = useMemo(() => ({
    mt: 0.5,
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
    height: '32px',
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

  const priceTypographySx = useMemo(() => ({
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

  // Memoize formatted dates to avoid recalculating on every render
  const formattedCreatedAt = useMemo(() => {
    return product ? formatDateTime(product.createdAt) : '';
  }, [product]);

  const formattedUpdatedAt = useMemo(() => {
    return product ? formatDateTime(product.updatedAt) : '';
  }, [product]);

  // Memoize formatted prices to avoid recalculating on every render
  const formattedPrice = useMemo(() => {
    return product ? `${product.currency} ${product.price.toFixed(2)}` : '';
  }, [product]);

  const formattedCostPrice = useMemo(() => {
    return product && product.costPrice
      ? `${product.currency} ${product.costPrice.toFixed(2)}`
      : '-';
  }, [product]);

  if (loading) {
    return (
      <MainLayout>
        <Box sx={loadingBoxSx}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (!product) {
    return (
      <MainLayout>
        <Box sx={containerBoxSx}>
          <Button
            startIcon={<ArrowBack sx={{ fontSize: '28px' }} />}
            onClick={handleNavigateBack}
            sx={backButtonSx}
          >
            Back to Products
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
              <IconButton onClick={handleNavigateBack} sx={backIconButtonSx}>
                <ArrowBack />
              </IconButton>
              <Typography variant="h4" component="h1" fontWeight="bold" sx={titleTypographySx}>
              DigitalizePOS - {product.name}
              </Typography>
            </Box>
            <Button
              variant="text"
              startIcon={<Edit sx={{ fontSize: '24px' }} />}
              onClick={handleEdit}
              sx={editButtonSx}
            >
              Edit Product
            </Button>
          </Box>

          <Box sx={{ p: '24px' }}>

            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="h5" gutterBottom sx={productNameTypographySx}>
                      {product.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom sx={codeTypographySx}>
                      Barcode: {product.barcode || '-'}
                    </Typography>
                    {product.description && (
                      <Typography variant="body1" sx={descriptionTypographySx}>
                        {product.description}
                      </Typography>
                    )}

                    <Divider sx={dividerSx} />

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                          Unit
                        </Typography>
                        <Typography variant="body1" sx={bodyTypographySx}>
                          {product.unit}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                          Category
                        </Typography>
                        {product.category ? (
                          <Chip label={product.category.name} size="small" sx={chipSx} />
                        ) : (
                          <Typography variant="body1" sx={bodyTypographySx}>
                            -
                          </Typography>
                        )}
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                          Supplier
                        </Typography>
                        <Typography variant="body1" sx={bodyTypographySx}>
                          {product.supplier?.name || '-'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                      Pricing Information
                    </Typography>
                    <Divider sx={sectionDividerSx} />
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                          Selling Price
                        </Typography>
                        <Typography variant="h5" sx={priceTypographySx}>
                          {formattedPrice}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary" sx={labelTypographySx}>
                          Cost Price
                        </Typography>
                        <Typography variant="body1" sx={bodyTypographySx}>
                          {formattedCostPrice}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                <Card sx={metadataCardSx}>
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

                {/* Product Images */}
                <Card sx={metadataCardSx}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
                      Product Images
                    </Typography>
                    <Divider sx={sectionDividerSx} />
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <ProductImageUpload
                          productId={product.id}
                          onUploadComplete={() => {
                            setImageRefreshKey((prev) => prev + 1);
                            setImageCount((prev) => prev + 1);
                          }}
                          currentImageCount={imageCount}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <ProductImageGallery
                          key={imageRefreshKey}
                          productId={product.id}
                          onImageChange={() => {
                            setImageRefreshKey((prev) => prev + 1);
                            // Reload image count
                            ProductImageService.getByProductId(product.id).then((images) => {
                              setImageCount(images.length);
                            });
                          }}
                        />
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

export default ProductDetails;

