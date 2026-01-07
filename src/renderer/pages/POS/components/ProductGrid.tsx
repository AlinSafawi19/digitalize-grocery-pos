import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Chip,
  IconButton,
} from '@mui/material';
import { Image as ImageIcon, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { Product } from '../../../services/product.service';
import { formatCurrency } from '../../../utils/currency';
import { CurrencyService } from '../../../services/currency.service';
import { ProductImageService, ProductImage } from '../../../services/product-image.service';

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  onProductClick: (product: Product) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  loading,
  onProductClick,
}) => {
  // Memoize product click handler
  const handleProductClick = useCallback((product: Product) => {
    onProductClick(product);
  }, [onProductClick]);
  const [productDualCurrencies, setProductDualCurrencies] = useState<
    Record<number, { usd: number; lbp: number }>
  >({});
  const [productImages, setProductImages] = useState<
    Record<number, Array<{ image: ProductImage; dataUrl: string | null }>>
  >({});
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<number, number>>({});
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const loadingImagesRef = useRef<Set<number>>(new Set());
  const loadedProductIdsRef = useRef<Set<number>>(new Set());
  const autoChangeIntervalsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const pausedProductsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const loadProductCurrencies = async () => {
      // PERFORMANCE FIX: Use Promise.all() to execute all currency conversions in parallel
      // instead of sequential for...of loop. This reduces load time from 5-20s to 0.5-2s for 100+ products
      // PERFORMANCE FIX: Use cache to avoid redundant conversions
      const { getCachedConversion, setCachedConversion } = await import('../../../utils/currencyCache');
      
      const currencyPromises = products.map(async (product) => {
        try {
          // Check cache first
          let dualCurrency = getCachedConversion(product.price, product.currency || 'USD');
          
          if (!dualCurrency) {
            dualCurrency = await CurrencyService.getDualCurrencyAmounts(
              product.price,
              product.currency || 'USD'
            );
            // Cache the result
            setCachedConversion(product.price, product.currency || 'USD', dualCurrency);
          }
          
          return { productId: product.id, dualCurrency };
        } catch (error) {
          console.error('[POS ProductGrid] Error loading product currency:', {
            productId: product.id,
            productName: product.name,
            price: product.price,
            currency: product.currency,
            error,
          });
          return { productId: product.id, dualCurrency: null };
        }
      });

      // Execute all conversions in parallel
      const results = await Promise.all(currencyPromises);
      
      // Build currencies object from results
      const currencies: Record<number, { usd: number; lbp: number }> = {};
      results.forEach(({ productId, dualCurrency }) => {
        if (dualCurrency) {
          currencies[productId] = dualCurrency;
        }
      });
      
      setProductDualCurrencies(currencies);
    };

    if (products.length > 0) {
      loadProductCurrencies();
    } else {
      setProductDualCurrencies({});
    }
  }, [products]);

  // Load product images
  useEffect(() => {
    const loadProductImages = async () => {
      // Load images for products that don't have them yet
      const productsToLoad = products.filter(
        (p) => !loadedProductIdsRef.current.has(p.id) && !loadingImagesRef.current.has(p.id)
      );

      if (productsToLoad.length === 0) return;

      // Mark products as loading
      productsToLoad.forEach((p) => {
        loadingImagesRef.current.add(p.id);
      });
      setLoadingImages(new Set(loadingImagesRef.current));

      // Load images in parallel
      const imagePromises = productsToLoad.map(async (product) => {
        try {
          const images = await ProductImageService.getByProductId(product.id);
          if (images.length > 0) {
            // Sort images: primary first, then by displayOrder
            const sortedImages = [...images].sort((a, b) => {
              if (a.isPrimary) return -1;
              if (b.isPrimary) return 1;
              return (a.displayOrder || 0) - (b.displayOrder || 0);
            });

            // Load all image data URLs
            const imageDataPromises = sortedImages.map(async (img) => {
              const relativePath = img.thumbnailPath || img.filePath;
              const dataUrl = await ProductImageService.getImageDataUrl(relativePath);
              return {
                image: img,
                dataUrl,
              };
            });

            const imageData = await Promise.all(imageDataPromises);
            
            return {
              productId: product.id,
              images: imageData.filter((item) => item.dataUrl !== null),
            };
          }
          return { productId: product.id, images: [] };
        } catch (error) {
          console.error(`Error loading image for product ${product.id}:`, error);
          return { productId: product.id, images: [] };
        }
      });

      const results = await Promise.all(imagePromises);
      
      // Update state with loaded images
      setProductImages((prev) => {
        const updated = { ...prev };
        results.forEach((result) => {
          if (result.images && result.images.length > 0) {
            updated[result.productId] = result.images;
            // Set initial image index to 0
            setCurrentImageIndex((prevIndex) => ({
              ...prevIndex,
              [result.productId]: 0,
            }));
            loadedProductIdsRef.current.add(result.productId);
          } else {
            // Mark as loaded even if no image to avoid retrying
            loadedProductIdsRef.current.add(result.productId);
          }
          // Remove from loading set
          loadingImagesRef.current.delete(result.productId);
        });
        setLoadingImages(new Set(loadingImagesRef.current));
        return updated;
      });
    };

    if (products.length > 0) {
      loadProductImages();
    } else {
      // Clear images when no products
      setProductImages({});
      setCurrentImageIndex({});
      setLoadingImages(new Set());
      loadingImagesRef.current.clear();
      loadedProductIdsRef.current.clear();
    }
  }, [products]);

  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  }), []);

  const containerBoxSx = useMemo(() => ({
    p: { xs: 1, md: 2 },
  }), []);

  const emptyStateBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '50vh',
  }), []);

  const emptyStateTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const cardSx = useMemo(() => ({
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: 2,
    },
    '&:active': {
      transform: 'translateY(0px)',
      boxShadow: 1,
    },
    height: '100%',
    minHeight: { xs: 120, md: 140 },
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 2,
    border: '2px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
    touchAction: 'manipulation',
    overflow: 'hidden',
  }), []);

  const imageContainerSx = useMemo(() => ({
    width: '100%',
    height: { xs: 100, md: 120 },
    backgroundColor: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    '&:hover .image-nav-button': {
      opacity: 1,
    },
  }), []);

  const productImageSx = useMemo(() => ({
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  }), []);

  const navButtonSx = useMemo(() => ({
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    padding: '4px',
    minWidth: 'auto',
    width: '24px',
    height: '24px',
    opacity: 0,
    transition: 'opacity 0.2s',
    zIndex: 2,
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    '&.Mui-disabled': {
      opacity: 0.3,
    },
  }), []);

  const imageDotsSx = useMemo(() => ({
    position: 'absolute',
    bottom: 4,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 2,
    zIndex: 2,
  }), []);

  const getImageDotSx = useCallback((isActive: boolean) => ({
    width: isActive ? 8 : 6,
    height: isActive ? 8 : 6,
    borderRadius: '50%',
    backgroundColor: isActive ? '#1a237e' : 'rgba(255, 255, 255, 0.5)',
    border: isActive ? '1px solid #1a237e' : '1px solid rgba(0, 0, 0, 0.2)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  }), []);

  const handlePreviousImage = useCallback((productId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    // Temporarily pause auto-change when user manually navigates
    pausedProductsRef.current.add(productId);
    setTimeout(() => {
      pausedProductsRef.current.delete(productId);
    }, 5000); // Resume after 5 seconds
    
    setCurrentImageIndex((prev) => {
      const currentIndex = prev[productId] || 0;
      const images = productImages[productId] || [];
      if (images.length === 0) return prev;
      const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
      return { ...prev, [productId]: newIndex };
    });
  }, [productImages]);

  const handleNextImage = useCallback((productId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    // Temporarily pause auto-change when user manually navigates
    pausedProductsRef.current.add(productId);
    setTimeout(() => {
      pausedProductsRef.current.delete(productId);
    }, 5000); // Resume after 5 seconds
    
    setCurrentImageIndex((prev) => {
      const currentIndex = prev[productId] || 0;
      const images = productImages[productId] || [];
      if (images.length === 0) return prev;
      const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
      return { ...prev, [productId]: newIndex };
    });
  }, [productImages]);

  const handleDotClick = useCallback((productId: number, index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    // Temporarily pause auto-change when user manually navigates
    pausedProductsRef.current.add(productId);
    setTimeout(() => {
      pausedProductsRef.current.delete(productId);
    }, 5000); // Resume after 5 seconds
    
    setCurrentImageIndex((prev) => ({
      ...prev,
      [productId]: index,
    }));
  }, []);

  // Auto-change images for products with multiple images
  useEffect(() => {
    // Clear all existing intervals
    autoChangeIntervalsRef.current.forEach((interval) => {
      clearInterval(interval);
    });
    autoChangeIntervalsRef.current.clear();

    // Set up auto-change for products with multiple images
    Object.keys(productImages).forEach((productIdStr) => {
      const productId = parseInt(productIdStr, 10);
      const images = productImages[productId];
      
      if (images && images.length > 1) {
        const interval = setInterval(() => {
          // Skip if paused (e.g., user is hovering or manually navigating)
          if (pausedProductsRef.current.has(productId)) {
            return;
          }

          setCurrentImageIndex((prev) => {
            const currentIndex = prev[productId] || 0;
            const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
            return { ...prev, [productId]: newIndex };
          });
        }, 3000); // Change image every 3 seconds

        autoChangeIntervalsRef.current.set(productId, interval);
      }
    });

    // Cleanup on unmount
    return () => {
      autoChangeIntervalsRef.current.forEach((interval) => {
        clearInterval(interval);
      });
      autoChangeIntervalsRef.current.clear();
    };
  }, [productImages]);

  // Pause auto-change on hover
  const handleImageContainerMouseEnter = useCallback((productId: number) => {
    pausedProductsRef.current.add(productId);
  }, []);

  const handleImageContainerMouseLeave = useCallback((productId: number) => {
    pausedProductsRef.current.delete(productId);
  }, []);

  const cardContentSx = useMemo(() => ({
    flexGrow: 1,
    p: { xs: 1.5, md: 2 },
  }), []);

  const productNameTypographySx = useMemo(() => ({
    fontSize: { xs: '14px', md: '18px' },
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    mb: { xs: 1, md: 1.5 },
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    lineHeight: 1.4,
  }), []);

  const productCodeTypographySx = useMemo(() => ({
    fontSize: { xs: '12px', md: '14px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
    mb: { xs: 1, md: 1.5 },
  }), []);

  const chipSx = useMemo(() => ({
    mb: 1.5,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    borderColor: '#1a237e',
    color: '#1a237e',
    height: 36,
    padding: '8px 20px',
  }), []);

  const priceBoxSx = useMemo(() => ({
    mt: 'auto',
  }), []);

  const priceTypographySx = useMemo(() => ({
    fontSize: { xs: '16px', md: '20px' },
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const lbpTypographySx = useMemo(() => ({
    fontSize: { xs: '14px', md: '16px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  if (loading) {
    return (
      <Box sx={loadingBoxSx}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={containerBoxSx}>
      {/* Product Grid */}
      {products.length === 0 ? (
        <Box sx={emptyStateBoxSx}>
          <Typography sx={emptyStateTypographySx}>
            No products found
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={{ xs: 1, md: 2 }}>
          {products.map((product) => {
            const productImagesList = productImages[product.id] || [];
            const isLoadingImage = loadingImages.has(product.id);
            const currentIndex = currentImageIndex[product.id] || 0;
            const currentImage = productImagesList[currentIndex];
            const hasMultipleImages = productImagesList.length > 1;
            
            return (
              <Grid item xs={6} sm={4} md={3} key={product.id}>
                <Card sx={cardSx} onClick={() => handleProductClick(product)}>
                  {/* Product Image */}
                  <Box 
                    sx={imageContainerSx}
                    onMouseEnter={() => handleImageContainerMouseEnter(product.id)}
                    onMouseLeave={() => handleImageContainerMouseLeave(product.id)}
                  >
                    {isLoadingImage ? (
                      <CircularProgress size={24} />
                    ) : currentImage?.dataUrl ? (
                      <>
                        <Box
                          component="img"
                          src={currentImage.dataUrl}
                          alt={currentImage.image.altText || product.name}
                          sx={productImageSx}
                          onError={() => {
                            // Remove failed image from state
                            setProductImages((prev) => {
                              const updated = { ...prev };
                              if (updated[product.id]) {
                                updated[product.id] = updated[product.id].filter(
                                  (img) => img.image.id !== currentImage.image.id
                                );
                                if (updated[product.id].length === 0) {
                                  delete updated[product.id];
                                }
                              }
                              return updated;
                            });
                          }}
                        />
                        {/* Navigation buttons for multiple images */}
                        {hasMultipleImages && (
                          <>
                            <IconButton
                              className="image-nav-button"
                              sx={{ ...navButtonSx, left: 4 }}
                              onClick={(e) => handlePreviousImage(product.id, e)}
                              size="small"
                            >
                              <ChevronLeft fontSize="small" />
                            </IconButton>
                            <IconButton
                              className="image-nav-button"
                              sx={{ ...navButtonSx, right: 4 }}
                              onClick={(e) => handleNextImage(product.id, e)}
                              size="small"
                            >
                              <ChevronRight fontSize="small" />
                            </IconButton>
                            {/* Image dots indicator */}
                            <Box sx={imageDotsSx}>
                              {productImagesList.map((_, index) => (
                                <Box
                                  key={index}
                                  sx={getImageDotSx(index === currentIndex)}
                                  onClick={(e) => handleDotClick(product.id, index, e)}
                                />
                              ))}
                            </Box>
                          </>
                        )}
                      </>
                    ) : (
                      <ImageIcon sx={{ fontSize: 48, color: '#bdbdbd' }} />
                    )}
                  </Box>
                  <CardContent sx={cardContentSx}>
                    <Typography component="div" sx={productNameTypographySx}>
                      {product.name}
                    </Typography>
                  <Typography sx={productCodeTypographySx}>
                    {product.code}
                  </Typography>
                  {product.category && (
                    <Chip
                      label={product.category.name}
                      size="small"
                      sx={chipSx}
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  <Box sx={priceBoxSx}>
                    <Typography sx={priceTypographySx}>
                      {formatCurrency(product.price, product.currency || 'USD')}
                    </Typography>
                    {productDualCurrencies[product.id] && (
                      <Typography sx={lbpTypographySx}>
                        {productDualCurrencies[product.id].lbp.toFixed(0)} LBP
                      </Typography>
                    )}
                  </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

export default ProductGrid;

