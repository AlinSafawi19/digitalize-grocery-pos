import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  InputAdornment,
  CircularProgress,
  Alert,
  IconButton,
  Grid,
} from '@mui/material';
import { SwapHoriz, Refresh, TrendingUp } from '@mui/icons-material';
import { CurrencyService } from '../../services/currency.service';
import { formatCurrency } from '../../utils/formatters';

const CurrencyConverter: React.FC = () => {
  const [usdAmount, setUsdAmount] = useState<string>('');
  const [lbpAmount, setLbpAmount] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<'usd' | 'lbp'>('usd');

  useEffect(() => {
    loadExchangeRate();
  }, []);

  const loadExchangeRate = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const rate = await CurrencyService.getExchangeRate();
      setExchangeRate(rate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exchange rate');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUsdChange = (value: string) => {
    setActiveField('usd');
    setUsdAmount(value);
    
    if (value === '') {
      setLbpAmount('');
      return;
    }

    const numValue = parseFloat(value);
    if (!isNaN(numValue) && exchangeRate) {
      const converted = numValue * exchangeRate;
      setLbpAmount(converted.toFixed(0));
    } else {
      setLbpAmount('');
    }
  };

  const handleLbpChange = (value: string) => {
    setActiveField('lbp');
    setLbpAmount(value);
    
    if (value === '') {
      setUsdAmount('');
      return;
    }

    const numValue = parseFloat(value);
    if (!isNaN(numValue) && exchangeRate) {
      const converted = numValue / exchangeRate;
      setUsdAmount(converted.toFixed(2));
    } else {
      setUsdAmount('');
    }
  };

  const handleSwap = () => {
    const tempUsd = usdAmount;
    const tempLbp = lbpAmount;
    setUsdAmount(tempLbp ? (parseFloat(tempLbp) / (exchangeRate || 1)).toFixed(2) : '');
    setLbpAmount(tempUsd ? (parseFloat(tempUsd) * (exchangeRate || 1)).toFixed(0) : '');
    setActiveField(activeField === 'usd' ? 'lbp' : 'usd');
  };

  const formatNumber = (value: string, isLbp: boolean): string => {
    if (!value) return '';
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return isLbp ? num.toLocaleString('en-US', { maximumFractionDigits: 0 }) : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {loading && exchangeRate === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <CircularProgress size={40} />
        </Box>
      ) : (
        <>
          {/* Exchange Rate Header */}
          {exchangeRate && (
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                mb: 3,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <TrendingUp sx={{ color: 'primary.main', fontSize: 28 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Current Exchange Rate
                    </Typography>
                    <Typography variant="h6" fontWeight={600} sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                      1 USD = {exchangeRate.toLocaleString('en-US')} LBP
                    </Typography>
                  </Box>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => loadExchangeRate(true)}
                  disabled={refreshing}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Refresh sx={{ fontSize: 24, color: refreshing ? 'text.disabled' : 'text.secondary' }} />
                </IconButton>
              </Box>
            </Paper>
          )}

          {/* Currency Conversion Cards */}
          <Grid container spacing={2} sx={{ flex: 1 }}>
            {/* USD Card */}
            <Grid item xs={12} sm={5.5}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  height: '100%',
                  border: '2px solid',
                  borderColor: activeField === 'usd' ? 'grey.400' : 'divider',
                  borderRadius: 2,
                  bgcolor: activeField === 'usd' ? 'grey.50' : 'background.paper',
                  transition: 'all 0.2s ease-in-out',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box sx={{ mb: 2 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontSize: '14px', fontWeight: 600, letterSpacing: 1 }}>
                    United States Dollar
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                    USD
                  </Typography>
                </Box>
                
                <TextField
                  type="text"
                  value={formatNumber(usdAmount, false)}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/,/g, '');
                    handleUsdChange(rawValue);
                  }}
                  fullWidth
                  placeholder="0.00"
                  autoFocus={activeField === 'usd'}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography variant="h6" fontWeight={600} sx={{ color: 'text.primary', minWidth: 40 }}>
                          $
                        </Typography>
                      </InputAdornment>
                    ),
                    sx: {
                      fontSize: '1.5rem',
                      fontWeight: 500,
                      fontFamily: 'monospace',
                      '& .MuiOutlinedInput-input': {
                        textAlign: 'right',
                        py: 2.5,
                        fontSize: '18px',
                      },
                      minHeight: '56px',
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                    },
                  }}
                />

                {usdAmount && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '14px' }}>
                      Amount
                    </Typography>
                    <Typography variant="h6" fontWeight={600} sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                      {formatCurrency(parseFloat(usdAmount), 'USD')}
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* Swap Button */}
            <Grid item xs={12} sm={1} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconButton
                onClick={handleSwap}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  width: 56,
                  height: 56,
                  padding: '8px',
                  border: '2px solid',
                  borderColor: 'primary.dark',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s ease-in-out',
                  '& .MuiSvgIcon-root': {
                    fontSize: '28px',
                  },
                }}
              >
                <SwapHoriz />
              </IconButton>
            </Grid>

            {/* LBP Card */}
            <Grid item xs={12} sm={5.5}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  height: '100%',
                  border: '2px solid',
                  borderColor: activeField === 'lbp' ? 'grey.400' : 'divider',
                  borderRadius: 2,
                  bgcolor: activeField === 'lbp' ? 'grey.50' : 'background.paper',
                  transition: 'all 0.2s ease-in-out',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box sx={{ mb: 2 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontSize: '14px', fontWeight: 600, letterSpacing: 1 }}>
                    Lebanese Pound
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                    LBP
                  </Typography>
                </Box>
                
                <TextField
                  type="text"
                  value={formatNumber(lbpAmount, true)}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/,/g, '');
                    handleLbpChange(rawValue);
                  }}
                  fullWidth
                  placeholder="0"
                  autoFocus={activeField === 'lbp'}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography variant="h6" fontWeight={600} sx={{ color: 'text.primary', minWidth: 50 }}>
                          LBP
                        </Typography>
                      </InputAdornment>
                    ),
                    sx: {
                      fontSize: '1.5rem',
                      fontWeight: 500,
                      fontFamily: 'monospace',
                      '& .MuiOutlinedInput-input': {
                        textAlign: 'right',
                        py: 2.5,
                        fontSize: '18px',
                      },
                      minHeight: '56px',
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                    },
                  }}
                />

                {lbpAmount && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '14px' }}>
                      Amount
                    </Typography>
                    <Typography variant="h6" fontWeight={600} sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                      {parseFloat(lbpAmount).toLocaleString('en-US')} LBP
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Conversion Summary */}
          {(usdAmount || lbpAmount) && exchangeRate && (
            <Paper
              elevation={0}
              sx={{
                mt: 3,
                p: 2.5,
                bgcolor: 'success.50',
                border: '1px solid',
                borderColor: 'success.main',
                borderRadius: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
                Conversion Summary
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
                {usdAmount && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      USD
                    </Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                      {formatCurrency(parseFloat(usdAmount), 'USD')}
                    </Typography>
                  </Box>
                )}
                {lbpAmount && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      LBP
                    </Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                      {parseFloat(lbpAmount).toLocaleString('en-US')} LBP
                    </Typography>
                  </Box>
                )}
                <Box sx={{ ml: 'auto' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    Rate
                  </Typography>
                  <Typography variant="body1" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                    1:{exchangeRate.toLocaleString('en-US')}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

export default CurrencyConverter;

