import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Grid,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ProductService } from '../../services/product.service';
import { ProductImageService } from '../../services/product-image.service';
import ProductImageUpload from '../../components/product-image/ProductImageUpload';
import ProductImageGallery from '../../components/product-image/ProductImageGallery';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { ROUTES } from '../../utils/constants';

const ProductImageManagement: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const user = useSelector((state: RootState) => state.auth.user);
  const { toast, showToast, hideToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<{ id: number; name: string } | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const [imageRefreshKey, setImageRefreshKey] = useState(0);

  useEffect(() => {
    const loadProduct = async () => {
      if (!id || !user?.id) return;

      setLoading(true);
      try {
        const productId = parseInt(id);
        const result = await ProductService.getProductById(productId, user.id);
        if (result.success && result.product) {
          setProduct(result.product);
          // Load initial image count
          const images = await ProductImageService.getByProductId(productId);
          setImageCount(images.length);
        } else {
          showToast(result.error || 'Failed to load product', 'error');
          navigate(ROUTES.PRODUCTS);
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
        navigate(ROUTES.PRODUCTS);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [id, user?.id, navigate, showToast]);

  const handleNavigateBack = useCallback(() => {
    navigate(`${ROUTES.PRODUCTS}/edit/${id}`);
  }, [navigate, id]);

  const handleUploadComplete = useCallback(() => {
    setImageRefreshKey((prev) => prev + 1);
    setImageCount((prev) => prev + 1);
  }, []);

  const handleImageChange = useCallback(() => {
    setImageRefreshKey((prev) => prev + 1);
    if (product) {
      ProductImageService.getByProductId(product.id).then((images) => {
        setImageCount(images.length);
      });
    }
  }, [product]);

  // Memoize sx prop objects
  const containerBoxSx = {
    p: 3,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  };

  const paperSx = {
    padding: 0,
    width: '100%',
    border: '2px solid #c0c0c0',
    backgroundColor: '#ffffff',
    boxShadow: 'inset 1px 1px 0px 0px #ffffff, inset -1px -1px 0px 0px #808080',
  };

  const titleBarBoxSx = {
    backgroundColor: '#1a237e',
    padding: '8px 12px',
    borderBottom: '1px solid #000051',
  };

  const backIconButtonSx = {
    mr: 2,
    padding: '4px',
    color: '#ffffff',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
  };

  const titleTypographySx = {
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#ffffff',
    fontWeight: 600,
  };

  const sectionTitleTypographySx = {
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    mb: 2,
  };

  const loadingBoxSx = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  };

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
          <Alert severity="error">Product not found</Alert>
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
                DigitalizePOS - Manage Product Images
              </Typography>
            </Box>
          </Box>

          <Box sx={{ p: '24px' }}>
            <Typography variant="h6" gutterBottom sx={sectionTitleTypographySx}>
              {product.name} - Images
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <ProductImageUpload
                  productId={product.id}
                  onUploadComplete={handleUploadComplete}
                  currentImageCount={imageCount}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <ProductImageGallery
                  key={imageRefreshKey}
                  productId={product.id}
                  onImageChange={handleImageChange}
                />
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default ProductImageManagement;

