import React, { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { QrCodeScanner, Search, CheckCircle, Clear, Category, AttachMoney, Business, Description } from '@mui/icons-material';
import { ProductService, Product } from '../../services/product.service';
import { formatCurrency } from '../../utils/formatters';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { AuthState } from '../../store/slices/auth.slice';

const BarcodeLookup: React.FC = () => {
  const [barcode, setBarcode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useSelector((state: RootState): AuthState => state.auth);

  const handleSearch = async () => {
    if (!barcode.trim() || !user?.id) {
      setError('Please enter a barcode');
      return;
    }

    setLoading(true);
    setError(null);
    setProduct(null);

    try {
      const result = await ProductService.getProductByBarcode(barcode.trim(), user.id);
      if (result.success && result.product) {
        setProduct(result.product);
      } else {
        setError(result.error || 'Product not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setBarcode('');
    setProduct(null);
    setError(null);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Search Section */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="overline" sx={{ fontSize: '14px', fontWeight: 600, letterSpacing: 1, color: 'text.secondary', mb: 1.5, display: 'block' }}>
          Barcode Lookup
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <TextField
            fullWidth
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Scan or enter barcode"
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <QrCodeScanner sx={{ color: 'text.secondary', fontSize: 24 }} />
                </InputAdornment>
              ),
              endAdornment: barcode && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleClear}
                    sx={{ mr: -1 }}
                  >
                    <Clear sx={{ fontSize: 24 }} />
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                fontSize: '16px',
                fontFamily: 'monospace',
                '& .MuiOutlinedInput-input': {
                  py: 2,
                  fontSize: '16px',
                },
                minHeight: '56px',
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  borderColor: 'grey.400',
                },
                '&.Mui-focused': {
                  borderColor: 'primary.main',
                  bgcolor: 'background.paper',
                },
              },
            }}
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loading || !barcode.trim()}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Search />}
            sx={{
              minWidth: 120,
              minHeight: '56px',
              height: 'auto',
              alignSelf: 'stretch',
              textTransform: 'none',
              fontSize: '16px',
              fontWeight: 600,
              boxShadow: 'none',
              '&:hover': {
                boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)',
              },
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{
            borderRadius: 1,
            '& .MuiAlert-icon': {
              fontSize: 24,
            },
          }}
        >
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Searching for product...
            </Typography>
          </Box>
        </Box>
      )}

      {product && (
        <Paper
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 2.5,
              bgcolor: 'success.main',
              color: 'success.contrastText',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <CheckCircle sx={{ fontSize: 28 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={700}>
                Product Found
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '14px' }}>
                Barcode: {product.barcode}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={handleClear}
              sx={{
                color: 'inherit',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              <Clear />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
            <Grid container spacing={3}>
              {/* Main Product Info */}
              <Grid item xs={12}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="overline" sx={{ fontSize: '14px', fontWeight: 600, letterSpacing: 1, color: 'text.secondary', mb: 1, display: 'block' }}>
                    Product Name
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ fontFamily: 'system-ui' }}>
                    {product.name}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                  <AttachMoney sx={{ color: 'success.main', fontSize: 20, mt: 0.5 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ fontSize: '14px', fontWeight: 600, letterSpacing: 0.5, color: 'text.secondary', textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                      Price
                    </Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ color: 'success.main' }}>
                      {formatCurrency(product.price, product.currency || 'USD')}
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              {product.category && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                    <Category sx={{ color: 'info.main', fontSize: 20, mt: 0.5 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: 0.5, color: 'text.secondary', textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                        Category
                      </Typography>
                      <Chip
                        label={product.category.name}
                        size="small"
                        sx={{
                          bgcolor: 'info.50',
                          color: 'info.main',
                          fontWeight: 600,
                          border: '1px solid',
                          borderColor: 'info.main',
                        }}
                      />
                    </Box>
                  </Box>
                </Grid>
              )}

              {product.supplier && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                    <Business sx={{ color: 'warning.main', fontSize: 20, mt: 0.5 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: 0.5, color: 'text.secondary', textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                        Supplier
                      </Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {product.supplier.name}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              )}

              {product.description && (
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mt: 2 }}>
                    <Description sx={{ color: 'text.secondary', fontSize: 20, mt: 0.5 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: 0.5, color: 'text.secondary', textTransform: 'uppercase', display: 'block', mb: 1 }}>
                        Description
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {product.description}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Box>

          {/* Footer Actions */}
          <Box
            sx={{
              p: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'grey.50',
            }}
          >
            <Button
              fullWidth
              variant="outlined"
              onClick={handleClear}
              startIcon={<Clear />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderColor: 'divider',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'primary.50',
                },
              }}
            >
              Clear & Search Another
            </Button>
          </Box>
        </Paper>
      )}

      {!product && !error && !loading && (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            bgcolor: 'grey.50',
            border: '1px dashed',
            borderColor: 'grey.300',
            borderRadius: 2,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'grey.100',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <QrCodeScanner sx={{ fontSize: 40, color: 'grey.400' }} />
          </Box>
          <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
            Barcode Lookup
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
            Enter or scan a barcode above to look up product information
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default BarcodeLookup;

