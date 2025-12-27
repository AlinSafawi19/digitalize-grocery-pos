import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  IconButton,
  Typography,
  Dialog,
  DialogContent,
  DialogTitle,
  Tooltip,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Delete,
  Star,
  StarBorder,
  Visibility,
  Close,
  Image as ImageIcon,
} from '@mui/icons-material';
import { ProductImageService, ProductImage } from '../../services/product-image.service';
import { useToast } from '../../hooks/useToast';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface ProductImageGalleryProps {
  productId: number;
  onImageChange?: () => void;
  maxImages?: number;
  showPrimaryBadge?: boolean;
}

const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({
  productId,
  onImageChange,
  maxImages,
  showPrimaryBadge = true,
}) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { showToast } = useToast();
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<ProductImage | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadImages = useCallback(async () => {
    if (!productId) return;

    setLoading(true);
    try {
      const result = await ProductImageService.getByProductId(productId);
      setImages(result);
    } catch (error) {
      console.error('Error loading product images', error);
      showToast('Failed to load product images', 'error');
    } finally {
      setLoading(false);
    }
  }, [productId, showToast]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleDelete = async (imageId: number) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;
    if (!user?.id) return;

    setDeleting(imageId);
    try {
      const result = await ProductImageService.delete(imageId, user.id);
      if (result.success) {
        showToast('Image deleted successfully', 'success');
        loadImages();
        onImageChange?.();
      } else {
        showToast(result.error || 'Failed to delete image', 'error');
      }
    } catch (error) {
      console.error('Error deleting image', error);
      showToast('Failed to delete image', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleSetPrimary = async (imageId: number) => {
    if (!user?.id) return;

    try {
      const result = await ProductImageService.update(
        imageId,
        { isPrimary: true },
        user.id
      );
      if (result.success) {
        showToast('Primary image updated', 'success');
        loadImages();
        onImageChange?.();
      } else {
        showToast(result.error || 'Failed to update primary image', 'error');
      }
    } catch (error) {
      console.error('Error setting primary image', error);
      showToast('Failed to update primary image', 'error');
    }
  };

  const handlePreview = (image: ProductImage) => {
    setSelectedImage(image);
    setPreviewOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (images.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', p: 3 }}>
        <ImageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No images uploaded yet
        </Typography>
      </Box>
    );
  }

  const displayImages = maxImages ? images.slice(0, maxImages) : images;

  return (
    <>
      <Grid container spacing={2}>
        {displayImages.map((image) => (
          <Grid item xs={6} sm={4} md={3} key={image.id}>
            <Paper
              sx={{
                position: 'relative',
                paddingTop: '100%', // Square aspect ratio
                overflow: 'hidden',
                cursor: 'pointer',
                '&:hover .image-overlay': {
                  opacity: 1,
                },
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f5f5f5',
                }}
              >
                <ImageThumbnail image={image} />
              </Box>

              {showPrimaryBadge && image.isPrimary && (
                <Chip
                  icon={<Star />}
                  label="Primary"
                  size="small"
                  color="primary"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    zIndex: 2,
                  }}
                />
              )}

              <Box
                className="image-overlay"
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  zIndex: 1,
                }}
              >
                <Tooltip title="View">
                  <IconButton
                    size="small"
                    onClick={() => handlePreview(image)}
                    sx={{ color: 'white' }}
                  >
                    <Visibility fontSize="small" />
                  </IconButton>
                </Tooltip>
                {!image.isPrimary && (
                  <Tooltip title="Set as Primary">
                    <IconButton
                      size="small"
                      onClick={() => handleSetPrimary(image.id)}
                      sx={{ color: 'white' }}
                    >
                      <StarBorder fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(image.id)}
                    disabled={deleting === image.id}
                    sx={{ color: 'white' }}
                  >
                    {deleting === image.id ? (
                      <CircularProgress size={16} sx={{ color: 'white' }} />
                    ) : (
                      <Delete fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Image Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {selectedImage?.fileName || 'Image Preview'}
            </Typography>
            <IconButton onClick={() => setPreviewOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedImage && (
            <Box sx={{ textAlign: 'center' }}>
              <ImagePreview image={selectedImage} />
              {selectedImage.altText && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {selectedImage.altText}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// Image Thumbnail Component
const ImageThumbnail: React.FC<{ image: ProductImage }> = ({ image }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        const relativePath = image.thumbnailPath || image.filePath;
        const dataUrl = await ProductImageService.getImageDataUrl(relativePath);
        if (dataUrl) {
          setImageUrl(dataUrl);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error loading thumbnail', err);
        setError(true);
      }
    };
    loadImage();
  }, [image]);

  if (error || !imageUrl) {
    return (
      <Box sx={{ textAlign: 'center', p: 2 }}>
        <ImageIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={imageUrl}
      alt={image.altText || image.fileName}
      sx={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
      onError={() => setError(true)}
    />
  );
};

// Image Preview Component
const ImagePreview: React.FC<{ image: ProductImage }> = ({ image }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        const dataUrl = await ProductImageService.getImageDataUrl(image.filePath);
        if (dataUrl) {
          setImageUrl(dataUrl);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error loading image', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    loadImage();
  }, [image]);

  if (loading) {
    return <CircularProgress />;
  }

  if (error || !imageUrl) {
    return (
      <Alert severity="error">Failed to load image</Alert>
    );
  }

  return (
    <Box
      component="img"
      src={imageUrl}
      alt={image.altText || image.fileName}
      sx={{
        maxWidth: '100%',
        maxHeight: '70vh',
        objectFit: 'contain',
      }}
      onError={() => setError(true)}
    />
  );
};

export default ProductImageGallery;

