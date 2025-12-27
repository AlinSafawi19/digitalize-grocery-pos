import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Alert,
  Paper,
  IconButton,
  TextField,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  CloudUpload,
  Image as ImageIcon,
  Close,
} from '@mui/icons-material';
import { ProductImageService, ProductImage } from '../../services/product-image.service';
import { useToast } from '../../hooks/useToast';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface ProductImageUploadProps {
  productId: number;
  onUploadComplete?: (image: ProductImage) => void;
  maxImages?: number;
  currentImageCount?: number;
}

const ProductImageUpload: React.FC<ProductImageUploadProps> = ({
  productId,
  onUploadComplete,
  maxImages,
  currentImageCount = 0,
}) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ path: string; name: string }>>([]);
  const [altText, setAltText] = useState('');
  const [setAsPrimary, setSetAsPrimary] = useState(false);

  const handleSelectFiles = useCallback(async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('productImage:showSelectDialog');
      
      if (result.success && result.filePaths) {
        const files = result.filePaths.map((filePath: string) => ({
          path: filePath,
          name: filePath.split(/[/\\]/).pop() || 'Unknown',
        }));
        setSelectedFiles(files);
      }
    } catch (error) {
      console.error('Error selecting files', error);
      showToast('Failed to select files', 'error');
    }
  }, [showToast]);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(async () => {
    if (!user?.id || selectedFiles.length === 0) return;

    // Check max images limit
    if (maxImages && currentImageCount + selectedFiles.length > maxImages) {
      showToast(`Maximum ${maxImages} images allowed. Please remove some images first.`, 'error');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const totalFiles = selectedFiles.length;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress(((i + 1) / totalFiles) * 100);

        try {
          // Copy file to temp location
          const tempResult = await window.electron.ipcRenderer.invoke(
            'productImage:copyToTemp',
            file.path
          );

          if (!tempResult.success || !tempResult.tempPath) {
            errorCount++;
            continue;
          }

          // Upload image
          const uploadResult = await ProductImageService.upload(
            {
              productId,
              filePath: tempResult.tempPath,
              fileName: file.name,
              altText: altText || undefined,
              isPrimary: setAsPrimary && i === 0, // Only set first as primary if checkbox is checked
            },
            user.id
          );

          if (uploadResult.success && uploadResult.image) {
            successCount++;
            onUploadComplete?.(uploadResult.image);
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error('Error uploading file', file.name, error);
          errorCount++;
        }
      }

      setUploadProgress(100);

      if (successCount > 0) {
        showToast(
          `Successfully uploaded ${successCount} image(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
          successCount === totalFiles ? 'success' : 'warning'
        );
      } else {
        showToast('Failed to upload images', 'error');
      }

      // Reset form
      setSelectedFiles([]);
      setAltText('');
      setSetAsPrimary(false);
    } catch (error) {
      console.error('Error in upload process', error);
      showToast('Failed to upload images', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [productId, selectedFiles, altText, setAsPrimary, user?.id, onUploadComplete, showToast, maxImages, currentImageCount]);

  const canUpload = selectedFiles.length > 0 && !uploading && user?.id;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Upload Product Images
      </Typography>

      {maxImages && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {currentImageCount} / {maxImages} images uploaded
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<CloudUpload />}
          onClick={handleSelectFiles}
          disabled={uploading}
          fullWidth
          sx={{ py: 2 }}
        >
          Select Images
        </Button>
      </Box>

      {selectedFiles.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Selected Files:
          </Typography>
          {selectedFiles.map((file, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1,
                mb: 1,
                backgroundColor: '#f5f5f5',
                borderRadius: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <ImageIcon fontSize="small" color="action" />
                <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {file.name}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => handleRemoveFile(index)}
                disabled={uploading}
              >
                <Close fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      <TextField
        fullWidth
        label="Alt Text (Optional)"
        value={altText}
        onChange={(e) => setAltText(e.target.value)}
        placeholder="Describe the image for accessibility"
        sx={{ mb: 2 }}
        disabled={uploading}
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={setAsPrimary}
            onChange={(e) => setSetAsPrimary(e.target.checked)}
            disabled={uploading}
          />
        }
        label="Set first image as primary"
        sx={{ mb: 2 }}
      />

      {uploading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={uploadProgress} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            Uploading... {Math.round(uploadProgress)}%
          </Typography>
        </Box>
      )}

      <Button
        variant="contained"
        onClick={handleUpload}
        disabled={!canUpload}
        fullWidth
        sx={{ backgroundColor: '#1a237e', '&:hover': { backgroundColor: '#283593' } }}
      >
        {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} Image(s)`}
      </Button>
    </Paper>
  );
};

export default ProductImageUpload;

