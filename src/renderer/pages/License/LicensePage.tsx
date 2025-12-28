import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  AppBar,
  Toolbar,
} from '@mui/material';
import { CheckCircle, Error as ErrorIcon, ContentCopy as CopyIcon, Check as CheckIcon, Logout, ChatBubble as MessageCircle, Security, TransferWithinAStation, Assessment } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../../store';
import { logout } from '../../store/slices/auth.slice';
import { ROUTES } from '../../utils/constants';
import MainLayout from '../../components/layout/MainLayout';
import { formatDate } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

interface LicenseData {
  licenseKey: string;
  hardwareId: string;
  locationName?: string;
  locationAddress?: string;
  activatedAt: number;
  expiresAt: number;
  gracePeriodEnd: number;
  lastValidation: number;
  validationToken: string;
  version: number;
}

interface ValidationResult {
  valid: boolean;
  message: string;
  expiresAt?: Date;
  gracePeriodEnd?: Date;
  daysRemaining?: number;
}

interface Payment {
  id: number;
  amount: number;
  paymentDate: Date | string; // Can be Date or UTC string from API
  isAnnualSubscription?: boolean;
  paymentType?: 'initial' | 'annual' | 'user';
}

interface SubscriptionInfo {
  nextPaymentFee: number | null;
  nextPaymentDate: Date | null;
  currentSubscription: {
    annualFee: number;
    endDate: Date;
    status: string;
  } | null;
}

export default function LicensePage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [licenseData, setLicenseData] = useState<LicenseData | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  const handleLogout = useCallback(async () => {
    if (user?.id) {
      await dispatch(logout(user.id));
      navigate(ROUTES.LOGIN);
    }
  }, [user?.id, dispatch, navigate]);

  const loadPaymentHistory = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const payments = await window.electron.ipcRenderer.invoke('license:getPaymentHistory');
      setPaymentHistory((payments as Payment[]) || []);
    } catch (err) {
      console.error('Error loading payment history:', err);
      setPaymentHistory([]);
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  const loadSubscriptionInfo = useCallback(async () => {
    try {
      const info = await window.electron.ipcRenderer.invoke('license:getSubscriptionInfo');
      setSubscriptionInfo(info as SubscriptionInfo | null);
    } catch (err) {
      console.error('Error loading subscription info:', err);
      setSubscriptionInfo(null);
    }
  }, []);

  const loadLicenseInfo = useCallback(async () => {
    setLoading(true);

    try {
      // Check if license is expired
      const expired = await window.electron.ipcRenderer.invoke('license:isExpired');
      setIsExpired(expired as boolean);

      // Get license status
      const status = await window.electron.ipcRenderer.invoke('license:getStatus');
      
      if (!status) {
        showToast('No license found. Please activate a license.', 'warning');
        setLoading(false);
        return;
      }

      setLicenseData(status as LicenseData | null);

      // Validate license to get current status
      try {
        const validation = await window.electron.ipcRenderer.invoke('license:validate');
        setValidationResult(validation as ValidationResult | null);
      } catch (err) {
        console.error('Error validating license:', err);
        // Continue even if validation fails
      }

      // Load payment history and subscription info
      loadPaymentHistory();
      loadSubscriptionInfo();
    } catch (err) {
      console.error('Error loading license info:', err);
      showToast('Failed to load license information', 'error');
    } finally {
      setLoading(false);
    }
  }, [loadPaymentHistory, loadSubscriptionInfo, showToast]);

  useEffect(() => {
    loadLicenseInfo();
  }, [loadLicenseInfo]);

  const getStatusColor = useCallback((): 'success' | 'warning' | 'error' => {
    if (!validationResult) return 'warning';
    if (!validationResult.valid) return 'error';
    
    const now = Date.now();
    if (licenseData) {
      if (now > licenseData.gracePeriodEnd) return 'error';
      if (now > licenseData.expiresAt) return 'warning';
    }
    
    return 'success';
  }, [validationResult, licenseData]);

  const getStatusText = useCallback((): string => {
    if (!validationResult) return 'Unknown';
    if (!validationResult.valid) return 'Invalid';
    
    if (licenseData) {
      const now = Date.now();
      if (now > licenseData.gracePeriodEnd) return 'Expired';
      if (now > licenseData.expiresAt) return 'Grace Period';
    }
    
    return 'Active';
  }, [validationResult, licenseData]);

  const handleCopyLicenseKey = useCallback(async () => {
    if (!licenseData) return;
    
    try {
      await navigator.clipboard.writeText(licenseData.licenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy license key:', err);
    }
  }, [licenseData]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  }), []);

  const containerBoxSx = useMemo(() => ({
    p: 3,
    backgroundColor: '#f5f5f5',
    minHeight: isExpired ? '100vh' : 'auto',
  }), [isExpired]);

  const paperSx = useMemo(() => ({
    padding: 0,
    width: '100%',
    border: '2px solid #c0c0c0',
    backgroundColor: '#ffffff',
    boxShadow: 'inset 1px 1px 0px 0px #ffffff, inset -1px -1px 0px 0px #808080',
  }), []);

  const titleBarSx = useMemo(() => ({
    backgroundColor: '#1a237e',
    padding: '8px 12px',
    borderBottom: '1px solid #000051',
  }), []);

  const titleTypographySx = useMemo(() => ({
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const infoAlertSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #90caf9',
    backgroundColor: '#e3f2fd',
    '& .MuiAlert-icon': {
      color: '#1565c0',
    },
  }), []);

  const validationAlertSx = useMemo(() => ({
    mb: 3,
    borderRadius: 0,
  }), []);

  const sectionTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const labelTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const licenseKeyBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    bgcolor: '#f5f5f5',
    p: 1,
    borderRadius: 0,
    border: '1px solid #e0e0e0',
  }), []);

  const licenseKeyTypographySx = useMemo(() => ({
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    flexGrow: 1,
  }), []);

  const copyButtonSx = useMemo(() => ({
    padding: '4px',
    '&:hover': {
      backgroundColor: 'rgba(26, 35, 126, 0.08)',
    },
  }), []);

  const chipSx = useMemo(() => ({
    fontSize: '12px',
    height: '24px',
    borderRadius: 0,
  }), []);

  const tableCellSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    border: '1px solid #e0e0e0',
  }), []);

  const tableHeadCellSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 600,
    border: '1px solid #e0e0e0',
  }), []);

  const tableRowSx = useMemo(() => ({
    '&:hover': {
      backgroundColor: '#f9f9f9',
    },
  }), []);

  // Memoize computed values to avoid recalculation on every render
  // This must be called unconditionally before any early returns
  // No grace period - expiration is exact end date
  const { now, effectiveExpiryDate, effectiveDaysRemaining } = useMemo(() => {
    if (!licenseData) {
      return {
        now: Date.now(),
        effectiveExpiryDate: 0,
        effectiveDaysRemaining: 0,
      };
    }
    
    const currentTime = Date.now();
    const expiryDays = Math.ceil((licenseData.expiresAt - currentTime) / (1000 * 60 * 60 * 24));
    
    // No grace period - expiration is exact end date
    return {
      now: currentTime,
      effectiveExpiryDate: licenseData.expiresAt,
      effectiveDaysRemaining: expiryDays,
    };
  }, [licenseData]);

  // Footer styles (matching MainLayout)
  const footerPaperSx = useMemo(() => ({
    position: 'sticky',
    bottom: 0,
    width: '100%',
    backgroundColor: '#f5f5f5',
    color: '#333333',
    py: 1,
    px: 3,
    zIndex: 1000,
    borderTop: '1px solid #e0e0e0',
  }), []);

  const footerBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  }), []);

  const footerTypographySx = useMemo(() => ({
    fontWeight: 500,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const footerLinkBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  }), []);

  const footerLinkTypographySx = useMemo(() => ({
    color: 'inherit',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    '&:hover': {
      textDecoration: 'underline',
    },
  }), []);

  // Helper component to conditionally wrap with MainLayout
  const ContentWrapper = ({ children }: { children: React.ReactNode }) => {
    if (isExpired) {
      return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {/* Simple header with logout button when expired */}
          <AppBar position="static" elevation={0} sx={{ backgroundColor: '#1a237e' }}>
            <Toolbar sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 600, fontSize: '13px' }}>
              DigitalizePOS - License Information
              </Typography>
              {user && (
                <Button
                  color="inherit"
                  startIcon={<Logout />}
                  onClick={handleLogout}
                  sx={{
                    fontSize: '13px',
                    textTransform: 'none',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  Logout
                </Button>
              )}
            </Toolbar>
          </AppBar>
          <Box sx={{ flexGrow: 1 }}>
            {children}
          </Box>
          {/* Contact administrator Footer - Always Visible */}
          <Paper
            component="footer"
            elevation={0}
            sx={footerPaperSx}
          >
            <Box sx={footerBoxSx}>
              <Typography variant="body2" sx={footerTypographySx}>
                Contact Administrator:
              </Typography>
              <Box sx={footerLinkBoxSx}>
                <MessageCircle sx={{ fontSize: 16 }} />
                <Typography
                  variant="body2"
                  component="a"
                  href="https://wa.me/96181943475"
                  sx={footerLinkTypographySx}
                >
                  +96181943475
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      );
    }
    return <MainLayout>{children}</MainLayout>;
  };

  if (loading) {
    return (
      <ContentWrapper>
        <Box sx={loadingBoxSx}>
          <CircularProgress />
        </Box>
      </ContentWrapper>
    );
  }

  if (!licenseData) {
    return (
      <ContentWrapper>
        <Box sx={containerBoxSx}>
          <Paper elevation={0} sx={paperSx}>
            <Box sx={titleBarSx}>
              <Typography variant="body2" sx={titleTypographySx}>
              DigitalizePOS - License Information
              </Typography>
            </Box>
            <Box sx={{ padding: '24px' }}>
              <Alert severity="info" sx={infoAlertSx}>
                <Typography variant="body2" sx={{ fontSize: '13px' }}>
                  No license information available.
                </Typography>
              </Alert>
            </Box>
          </Paper>
        </Box>
        <Toast toast={toast} onClose={hideToast} />
      </ContentWrapper>
    );
  }

  return (
    <ContentWrapper>
      <Box sx={containerBoxSx}>
        <Paper elevation={0} sx={paperSx}>
          {/* Title Bar */}
          <Box sx={titleBarSx}>
            <Typography variant="body2" sx={titleTypographySx}>
              DigitalizePOS - License Information
            </Typography>
          </Box>

          <Box sx={{ padding: '24px' }}>
            {validationResult && (
              <Alert
                severity={validationResult.valid ? 'success' : 'error'}
                sx={[
                  validationAlertSx,
                  {
                    border: validationResult.valid ? '1px solid #81c784' : '1px solid #e57373',
                    backgroundColor: validationResult.valid ? '#e8f5e9' : '#ffebee',
                    '& .MuiAlert-icon': {
                      color: validationResult.valid ? '#2e7d32' : '#c62828',
                    },
                  },
                ]}
              >
                <Typography variant="body2" sx={{ fontSize: '13px' }}>
                  {validationResult.message}
                </Typography>
                {validationResult.daysRemaining !== undefined && validationResult.daysRemaining > 0 && (
                  <Typography variant="body2" sx={{ mt: 1, fontSize: '13px' }}>
                    {validationResult.daysRemaining} days remaining
                  </Typography>
                )}
              </Alert>
            )}
          <Grid container spacing={3}>
            {/* License Status & Expiry */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={sectionTitleTypographySx}
                >
                  License Status
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Security />}
                    onClick={() => navigate(ROUTES.LICENSE_VALIDATION_AUDIT)}
                    sx={{ fontSize: '12px' }}
                  >
                    View Validation Audit Logs
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<TransferWithinAStation />}
                    onClick={() => navigate(ROUTES.LICENSE_TRANSFER)}
                    sx={{ fontSize: '12px' }}
                  >
                    Transfer License
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Assessment />}
                    onClick={() => navigate(ROUTES.LICENSE_USAGE_STATISTICS)}
                    sx={{ fontSize: '12px' }}
                  >
                    Usage Statistics
                  </Button>
                </Box>
              </Box>
              <Divider sx={{ mb: 2, borderColor: '#e0e0e0' }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography
                variant="body2"
                color="text.secondary"
                gutterBottom
                sx={labelTypographySx}
              >
                Status
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  icon={validationResult?.valid ? <CheckCircle /> : <ErrorIcon />}
                  label={getStatusText()}
                  color={getStatusColor()}
                  size="small"
                />
                {effectiveDaysRemaining > 0 && (
                  <Chip
                    label={`${effectiveDaysRemaining} days remaining`}
                    color={effectiveDaysRemaining <= 30 ? 'warning' : 'default'}
                    size="small"
                  />
                )}
                {effectiveDaysRemaining <= 0 && (
                  <Chip
                    label="Expired"
                    color="error"
                    size="small"
                  />
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography
                variant="body2"
                color="text.secondary"
                gutterBottom
                sx={labelTypographySx}
              >
                Expires On
              </Typography>
              <Typography variant="body1" sx={bodyTypographySx}>
                {formatDate(new Date(effectiveExpiryDate))}
                {now > licenseData.expiresAt && now <= licenseData.gracePeriodEnd && (
                  <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 0.5 }}>
                    (Grace period - expires {formatDate(new Date(licenseData.gracePeriodEnd))})
                  </Typography>
                )}
              </Typography>
            </Grid>
            {subscriptionInfo?.nextPaymentFee && (
              <Grid item xs={12} md={6}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  gutterBottom
                  sx={labelTypographySx}
                >
                  Next Payment Fee
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="h6" color="primary.main" fontWeight="bold">
                    ${subscriptionInfo.nextPaymentFee.toFixed(2)}
                  </Typography>
                  {subscriptionInfo.nextPaymentDate && (
                    <Typography variant="body2" color="text.secondary">
                      (Due {formatDate(subscriptionInfo.nextPaymentDate)})
                    </Typography>
                  )}
                </Box>
              </Grid>
            )}

            {/* Payment QR Code and Instructions */}
            {subscriptionInfo?.nextPaymentFee && (
              <>
                <Grid item xs={12} sx={{ mt: 1 }}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={sectionTitleTypographySx}
                  >
                    Payment Information
                  </Typography>
                  <Divider sx={{ mb: 2, borderColor: '#e0e0e0' }} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      border: '2px solid #1a237e',
                      borderRadius: 0,
                      textAlign: 'center',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <Typography
                      variant="h5"
                      color="primary.main"
                      fontWeight="bold"
                      gutterBottom
                      sx={{ fontSize: '24px' }}
                    >
                      ${subscriptionInfo.nextPaymentFee.toFixed(2)}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                      sx={{ mb: 2, fontSize: '13px' }}
                    >
                      {subscriptionInfo.nextPaymentFee === 350
                        ? 'Initial License Payment'
                        : 'Annual Subscription Payment'}
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: '#f5f5f5',
                        p: 2,
                        mb: 2,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: 0,
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      <Box
                        component="img"
                        src={
                          subscriptionInfo.nextPaymentFee === 350
                            ? 'https://downloads.digitalizepos.com/qr-code-350.jpg'
                            : 'https://downloads.digitalizepos.com/qr-code-50.jpg'
                        }
                        alt={`QR Code for $${subscriptionInfo.nextPaymentFee.toFixed(2)} payment`}
                        sx={{
                          width: '200px',
                          height: '200px',
                          objectFit: 'contain',
                        }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#616161' }}>
                      Scan to pay ${subscriptionInfo.nextPaymentFee.toFixed(2)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Alert severity="info" sx={{ ...infoAlertSx, mb: 2 }}>
                    <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600, mb: 1 }}>
                      How to Pay with QR Code:
                    </Typography>
                    <Box component="ol" sx={{ pl: 2, m: 0, fontSize: '13px' }}>
                      <Box component="li" sx={{ mb: 1 }}>
                        Open your payment app (banking app, mobile wallet, etc.)
                      </Box>
                      <Box component="li" sx={{ mb: 1 }}>
                        Select &quot;Scan QR Code&quot; or &quot;Pay with QR&quot;
                      </Box>
                      <Box component="li" sx={{ mb: 1 }}>
                        Scan the appropriate QR code above ({subscriptionInfo.nextPaymentFee === 350 ? '$350 for initial license' : '$50 for annual subscription'})
                      </Box>
                      <Box component="li" sx={{ mb: 1 }}>
                        The payment amount is already set in the QR code - just confirm the payment
                      </Box>
                      <Box component="li" sx={{ mb: 1 }}>
                        Complete the transfer
                      </Box>
                      <Box component="li" sx={{ mb: 1 }}>
                        Send payment confirmation screenshot via whatsapp:{' '}
                        <Typography
                          component="a"
                          href="https://wa.me/96181943475"
                          sx={{
                            color: '#1565c0',
                            textDecoration: 'underline',
                            fontWeight: 600,
                          }}
                        >
                          +961 81 943 475
                        </Typography>
                      </Box>
                      <Box component="li">License activated upon confirmation</Box>
                    </Box>
                  </Alert>
                  <Alert severity="success" sx={{ ...infoAlertSx, mt: 2 }}>
                    <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600, mb: 1 }}>
                      Payment Confirmation
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '13px' }}>
                      After payment, send confirmation via whatsapp to{' '}
                      <Typography
                        component="a"
                        href="https://wa.me/96181943475"
                        sx={{
                          color: '#1565c0',
                          textDecoration: 'underline',
                          fontWeight: 600,
                        }}
                      >
                        +961 81 943 475
                      </Typography>
                      {' '}with your license key/order number, date, amount, and screenshot (for QR payments).
                    </Typography>
                  </Alert>
                  {subscriptionInfo.nextPaymentFee === 50 && (
                    <Alert severity="success" sx={infoAlertSx}>
                      <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600, mb: 1 }}>
                        Renewal Information:
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '13px' }}>
                        Annual subscriptions are $50/year. You&apos;ll receive a renewal notice before expiration. 
                        Payment is made via QR code scanning - simply scan the $50 QR code to renew. 
                        Your license will be extended for another year upon payment confirmation.
                      </Typography>
                    </Alert>
                  )}
                </Grid>
              </>
            )}

            {/* License Key */}
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={sectionTitleTypographySx}
              >
                License Key
              </Typography>
              <Divider sx={{ mb: 2, borderColor: '#e0e0e0' }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography
                variant="body2"
                color="text.secondary"
                gutterBottom
                sx={labelTypographySx}
              >
                License Key
              </Typography>
              <Box sx={licenseKeyBoxSx}>
                <Typography variant="body1" sx={licenseKeyTypographySx}>
                  {licenseData.licenseKey}
                </Typography>
                <IconButton
                  onClick={handleCopyLicenseKey}
                  color="primary"
                  size="small"
                  title="Copy license key"
                  sx={copyButtonSx}
                >
                  {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
                </IconButton>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography
                variant="body2"
                color="text.secondary"
                gutterBottom
                sx={labelTypographySx}
              >
                Hardware ID
              </Typography>
              <Box sx={licenseKeyBoxSx}>
                <Typography variant="body1" sx={licenseKeyTypographySx}>
                  {licenseData.hardwareId}
                </Typography>
              </Box>
            </Grid>

            {/* Location Information */}
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={sectionTitleTypographySx}
              >
                Registered Location
              </Typography>
              <Divider sx={{ mb: 2, borderColor: '#e0e0e0' }} />
            </Grid>
            {licenseData.locationName && (
              <Grid item xs={12} md={6}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  gutterBottom
                  sx={labelTypographySx}
                >
                  Location Name
                </Typography>
                <Typography variant="body1" sx={bodyTypographySx}>
                  {licenseData.locationName}
                </Typography>
              </Grid>
            )}
            {licenseData.locationAddress && (
              <Grid item xs={12} md={licenseData.locationName ? 6 : 12}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  gutterBottom
                  sx={labelTypographySx}
                >
                  Location Address
                </Typography>
                <Typography variant="body1" sx={bodyTypographySx}>
                  {licenseData.locationAddress}
                </Typography>
              </Grid>
            )}
            {!licenseData.locationName && !licenseData.locationAddress && (
              <Grid item xs={12}>
                <Alert severity="info" sx={infoAlertSx}>
                  <Typography variant="body2" sx={{ fontSize: '13px' }}>
                    No location information available.
                  </Typography>
                </Alert>
              </Grid>
            )}

            {/* Activation Date */}
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={sectionTitleTypographySx}
              >
                Activation Details
              </Typography>
              <Divider sx={{ mb: 2, borderColor: '#e0e0e0' }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography
                variant="body2"
                color="text.secondary"
                gutterBottom
                sx={labelTypographySx}
              >
                Activated On
              </Typography>
              <Typography variant="body1" sx={bodyTypographySx}>
                {formatDate(new Date(licenseData.activatedAt))}
              </Typography>
            </Grid>

            {/* Payment History */}
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={sectionTitleTypographySx}
              >
                Payment History
              </Typography>
              <Divider sx={{ mb: 2, borderColor: '#e0e0e0' }} />
              {loadingPayments ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : paymentHistory.length === 0 ? (
                <Alert severity="info" sx={infoAlertSx}>
                  <Typography variant="body2" sx={{ fontSize: '13px' }}>
                    No payment history available.
                  </Typography>
                </Alert>
              ) : (
                <TableContainer>
                  <Table size="small" sx={{ border: '1px solid #e0e0e0' }}>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                        <TableCell sx={tableHeadCellSx}>
                          Date
                        </TableCell>
                        <TableCell align="right" sx={tableHeadCellSx}>
                          Amount
                        </TableCell>
                        <TableCell align="center" sx={tableHeadCellSx}>
                          Type
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paymentHistory.map((payment) => (
                        <TableRow key={payment.id} sx={tableRowSx}>
                          <TableCell sx={tableCellSx}>
                            {formatDate(payment.paymentDate)}
                          </TableCell>
                          <TableCell align="right" sx={tableCellSx}>
                            ${payment.amount.toFixed(2)}
                          </TableCell>
                          <TableCell align="center" sx={tableCellSx}>
                            <Chip
                              label={
                                payment.paymentType === 'user' 
                                  ? 'User' 
                                  : payment.paymentType === 'annual' 
                                  ? 'Annual' 
                                  : payment.paymentType === 'initial'
                                  ? 'Initial'
                                  : payment.isAnnualSubscription 
                                  ? 'Annual' 
                                  : 'Initial'
                              }
                              size="small"
                              color={
                                payment.paymentType === 'user'
                                  ? 'success'
                                  : payment.paymentType === 'annual' || payment.isAnnualSubscription
                                  ? 'primary'
                                  : 'default'
                              }
                              sx={chipSx}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Grid>
          </Grid>
          </Box>
        </Paper>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </ContentWrapper>
  );
}

