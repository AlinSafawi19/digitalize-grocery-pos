import React, { ReactNode, useCallback, useMemo, useState, useEffect } from 'react';
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Paper,
  Tooltip,
} from '@mui/material';
import { AccountCircle, Logout, Dashboard as DashboardIcon, Inventory, Category, LocalShipping, PointOfSale, Receipt, Warehouse, ShoppingCart, LocalOffer, Assessment, Analytics, History, Settings, MoreVert, Backup as BackupIcon, VpnKey, People, ChatBubble as MessageCircle, SwapHoriz, Build, Notifications, QrCode } from '@mui/icons-material';
import NotificationCenter from '../NotificationCenter/NotificationCenter';
import BackupOperationBanner from '../common/BackupOperationBanner';
import HelpersPanel from '../helpers/HelpersPanel';
import SyncStatusIndicator from '../common/SyncStatusIndicator';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { logout, AuthState } from '../../store/slices/auth.slice';
import { ROUTES } from '../../utils/constants';
import { useRoutePermission } from '../../hooks/usePermission';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState): AuthState => state.auth);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [moreMenuEl, setMoreMenuEl] = React.useState<null | HTMLElement>(null);
  const [isLicenseExpired, setIsLicenseExpired] = useState<boolean>(false);

  // Permission checks for navigation items
  const canAccessPOS = useRoutePermission(ROUTES.POS);
  const canAccessProducts = useRoutePermission(ROUTES.PRODUCTS);
  const canAccessCategories = useRoutePermission(ROUTES.CATEGORIES);
  const canAccessTransactions = useRoutePermission(ROUTES.TRANSACTIONS);
  const canAccessInventory = useRoutePermission(ROUTES.INVENTORY);
  const canAccessReports = useRoutePermission(ROUTES.REPORTS);
  const canAccessSuppliers = useRoutePermission(ROUTES.SUPPLIERS);
  // Cashiers page is only accessible by main user (ID = 1)
  const canAccessCashiers = user?.id === 1;
  const canAccessPurchaseOrders = useRoutePermission(ROUTES.PURCHASE_ORDERS);
  const canAccessStockTransfers = useRoutePermission(ROUTES.STOCK_TRANSFERS);
  const canAccessPricing = useRoutePermission(ROUTES.PRICING_RULES);
  const canAccessAnalytics = useRoutePermission(ROUTES.ANALYTICS);
  const canAccessSettings = useRoutePermission(ROUTES.SETTINGS);

  // Check license expiration status
  useEffect(() => {
    const checkExpiration = async () => {
      try {
        const expired = await window.electron.ipcRenderer.invoke('license:isExpired');
        setIsLicenseExpired(expired as boolean);
        if (expired) {
          // Main user (ID = 1) goes to license page, others go to expiry page
          const isMainUser = user?.id === 1;
          const targetRoute = isMainUser ? ROUTES.LICENSE : ROUTES.LICENSE_EXPIRED;
          navigate(targetRoute, { replace: true });
        }
      } catch (err) {
        console.error('Failed to check license expiration:', err);
        setIsLicenseExpired(true);
      }
    };

    checkExpiration();
    // Check periodically every 30 seconds
    const interval = setInterval(checkExpiration, 30000);
    return () => clearInterval(interval);
  }, [navigate, user?.id]);

  const isActiveRoute = useCallback((route: string) => {
    return location.pathname === route || location.pathname.startsWith(route + '/');
  }, [location.pathname]);

  const isPricingRoute = useCallback(() => {
    return (
      isActiveRoute(ROUTES.PRICING_RULES) ||
      isActiveRoute(ROUTES.PROMOTIONS) ||
      location.pathname.startsWith('/pricing')
    );
  }, [isActiveRoute, location.pathname]);

  const handleMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleMoreMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMoreMenuEl(event.currentTarget);
  }, []);

  const handleMoreMenuClose = useCallback(() => {
    setMoreMenuEl(null);
  }, []);

  const handleLogout = useCallback(async () => {
    if (user?.id) {
      await dispatch(logout(user.id));
      navigate(ROUTES.LOGIN);
    }
    handleClose();
  }, [user?.id, dispatch, navigate, handleClose]);

  // Helper function to check if navigation should be blocked
  const shouldBlockNavigation = useCallback(() => {
    return isLicenseExpired;
  }, [isLicenseExpired]);

  // Helper function to get the correct route when license is expired
  const getExpiredLicenseRoute = useCallback(() => {
    // Main user (ID = 1) goes to license page, others go to expiry page
    const isMainUser = user?.id === 1;
    return isMainUser ? ROUTES.LICENSE : ROUTES.LICENSE_EXPIRED;
  }, [user?.id]);

  const handleSettings = useCallback(() => {
    // Only main user (ID = 1) can access settings page
    if (user?.id !== 1) {
      navigate(ROUTES.ACCESS_DENIED, { replace: true });
      handleClose();
      return;
    }
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.SETTINGS);
    handleClose();
  }, [navigate, handleClose, shouldBlockNavigation, getExpiredLicenseRoute, user?.id]);

  const handleProfile = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.PROFILE);
    handleClose();
  }, [navigate, handleClose, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleLicense = useCallback(() => {
    // Only main user can access license page
    const isMainUser = user?.id === 1;
    if (isMainUser) {
      navigate(ROUTES.LICENSE);
    } else {
      navigate(ROUTES.ACCESS_DENIED);
    }
    handleClose();
  }, [navigate, handleClose, user?.id]);

  // Memoize navigation handlers
  const handleNavigateToPOS = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.POS);
  }, [navigate, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToHome = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.HOME);
  }, [navigate, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToDashboard = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.DASHBOARD);
  }, [navigate, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToProducts = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.PRODUCTS);
  }, [navigate, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToCategories = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.CATEGORIES);
  }, [navigate, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToTransactions = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.TRANSACTIONS);
  }, [navigate, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToInventory = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.INVENTORY);
  }, [navigate, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToReports = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.REPORTS);
  }, [navigate, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToSuppliers = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.SUPPLIERS);
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToCashiers = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.CASHIERS);
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToPurchaseOrders = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.PURCHASE_ORDERS);
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToStockTransfers = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.STOCK_TRANSFERS);
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToPricing = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.PRICING_RULES);
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToAnalytics = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.ANALYTICS);
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToLogs = useCallback(() => {
    // Only main user (ID = 1) can access logs page
    if (user?.id !== 1) {
      navigate(ROUTES.ACCESS_DENIED, { replace: true });
      handleMoreMenuClose();
      return;
    }
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.LOGS);
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, shouldBlockNavigation, getExpiredLicenseRoute, user?.id]);

  const handleNavigateToSettingsFromMenu = useCallback(() => {
    // Only main user (ID = 1) can access settings page
    if (user?.id !== 1) {
      navigate(ROUTES.ACCESS_DENIED, { replace: true });
      handleMoreMenuClose();
      return;
    }
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.SETTINGS);
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, shouldBlockNavigation, getExpiredLicenseRoute, user?.id]);

  const handleNavigateToBackup = useCallback(() => {
    // Only main user (ID = 1) can access backup page
    if (user?.id !== 1) {
      navigate(ROUTES.ACCESS_DENIED, { replace: true });
      handleMoreMenuClose();
      return;
    }
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.BACKUP);
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, shouldBlockNavigation, getExpiredLicenseRoute, user?.id]);

  const handleNavigateToSystemMaintenance = useCallback(() => {
    // Only main user (ID = 1) can access system maintenance page
    if (user?.id !== 1) {
      navigate(ROUTES.ACCESS_DENIED, { replace: true });
      handleMoreMenuClose();
      return;
    }
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.SYSTEM_MAINTENANCE);
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, shouldBlockNavigation, getExpiredLicenseRoute, user?.id]);


  const handleNavigateToAlertRules = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.ALERT_RULES);
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToAlertHistory = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.ALERT_HISTORY);
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToBarcodeLabels = useCallback(() => {
    if (shouldBlockNavigation()) {
      navigate(getExpiredLicenseRoute(), { replace: true });
      return;
    }
    navigate(ROUTES.BARCODE_LABELS);
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, shouldBlockNavigation, getExpiredLicenseRoute]);

  const handleNavigateToLicenseFromMenu = useCallback(() => {
    // Only main user can access license page
    const isMainUser = user?.id === 1;
    if (isMainUser) {
      navigate(ROUTES.LICENSE);
    } else {
      navigate(ROUTES.ACCESS_DENIED);
    }
    handleMoreMenuClose();
  }, [navigate, handleMoreMenuClose, user?.id]);

  // Memoize computed route states
  const routeStates = useMemo(() => ({
    isPOSActive: isActiveRoute(ROUTES.POS),
    isDashboardActive: isActiveRoute(ROUTES.DASHBOARD),
    isProductsActive: isActiveRoute(ROUTES.PRODUCTS),
    isCategoriesActive: isActiveRoute(ROUTES.CATEGORIES),
    isTransactionsActive: isActiveRoute(ROUTES.TRANSACTIONS),
    isInventoryActive: isActiveRoute(ROUTES.INVENTORY),
    isReportsActive: isActiveRoute(ROUTES.REPORTS),
    isSuppliersActive: isActiveRoute(ROUTES.SUPPLIERS),
    isCashiersActive: isActiveRoute(ROUTES.CASHIERS),
    isPurchaseOrdersActive: isActiveRoute(ROUTES.PURCHASE_ORDERS),
    isStockTransfersActive: isActiveRoute(ROUTES.STOCK_TRANSFERS),
    isPricingActive: isPricingRoute(),
    isAnalyticsActive: isActiveRoute(ROUTES.ANALYTICS),
    isLogsActive: isActiveRoute(ROUTES.LOGS),
    isSettingsActive: isActiveRoute(ROUTES.SETTINGS),
    isBackupActive: isActiveRoute(ROUTES.BACKUP),
    isLicenseActive: isActiveRoute(ROUTES.LICENSE),
    isSystemMaintenanceActive: isActiveRoute(ROUTES.SYSTEM_MAINTENANCE),
    isAlertRulesActive: isActiveRoute(ROUTES.ALERT_RULES),
    isAlertHistoryActive: isActiveRoute(ROUTES.ALERT_HISTORY),
    isBarcodeLabelsActive: isActiveRoute(ROUTES.BARCODE_LABELS),
  }), [isActiveRoute, isPricingRoute]);

  // Memoize getHeaderButtonStyles function
  const getHeaderButtonStyles = useCallback((_route: string, isActive: boolean) => ({
    textTransform: 'none',
    fontWeight: isActive ? 600 : 500,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    px: 2,
    py: 1,
    borderRadius: 0,
    border: 'none',
    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
    minHeight: '44px',
    '&:hover': {
      backgroundColor: isActive ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
    },
    '&:active': {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
  }), []);

  // Memoize sx prop objects to avoid recreation on every render
  const containerBoxSx = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  }), []);

  const appBarSx = useMemo(() => ({
    backgroundColor: '#1a237e',
    borderBottom: '1px solid #000051',
    boxShadow: 'none',
  }), []);

  const toolbarSx = useMemo(() => ({
    gap: { xs: 0.5, sm: 1 },
    px: { xs: '8px !important', sm: '12px !important' },
    py: { xs: '6px !important', sm: '8px !important' },
    minHeight: { xs: '56px !important', sm: '64px !important' },
    flexWrap: { xs: 'nowrap', md: 'wrap' },
    overflowX: { xs: 'auto', md: 'visible' },
    '&::-webkit-scrollbar': {
      height: '4px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: '2px',
    },
  }), []);

  const logoBoxSx = useMemo(() => ({
    height: { xs: 48, sm: 52, md: 56 },
    marginRight: { xs: 1, sm: 2 },
    flexShrink: 0,
    cursor: 'pointer',
    padding: { xs: '6px', sm: '8px' },
    '&:hover': {
      opacity: 0.8,
    },
  }), []);

  const spacerBoxSx = useMemo(() => ({
    flexGrow: 1,
    minWidth: { xs: '8px', sm: '16px' },
  }), []);

  const iconButtonSx = useMemo(() => ({
    padding: '8px',
    width: '48px',
    height: '48px',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
  }), []);

  const moreMenuButtonSx = useMemo(() => ({
    color: 'inherit',
    padding: '8px',
    width: '48px',
    height: '48px',
    flexShrink: 0,
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
  }), []);

  const menuPaperSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
    mt: 0.5,
    '& .MuiMenuItem-root': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '10px 16px',
      minHeight: '44px',
      '&:hover': {
        backgroundColor: '#f5f5f5',
      },
      '&.Mui-selected': {
        backgroundColor: '#e3f2fd',
        '&:hover': {
          backgroundColor: '#e3f2fd',
        },
      },
    },
  }), []);

  const accountButtonSx = useMemo(() => ({
    textTransform: 'none',
    border: 'none',
    fontSize: { xs: '14px', sm: '16px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: { xs: '8px', sm: '8px 16px' },
    minHeight: '44px',
    flexShrink: 0,
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    '& .MuiButton-startIcon': {
      marginRight: { xs: 0, sm: '8px' },
    },
  }), []);

  const containerSx = useMemo(() => ({
    flexGrow: 1,
    py: 1,
    px: 1,
  }), []);

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
    fontSize: '16px',
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
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    '&:hover': {
      textDecoration: 'underline',
    },
  }), []);

  return (
    <Box sx={containerBoxSx}>
      <BackupOperationBanner />
      <AppBar position="static" sx={appBarSx}>
        <Toolbar sx={toolbarSx}>
          <Box
            component="img"
            src="https://downloads.digitalizepos.com/grocery-logo-white.svg"
            alt="DigitalizePOS"
            sx={logoBoxSx}
            onClick={handleNavigateToHome}
          />
          <Box sx={spacerBoxSx} />
          {canAccessPOS && (
            <>
              <Tooltip title="Point of Sale - Process sales transactions, returns, and manage the shopping cart">
                <Button
                  color="inherit"
                  startIcon={<PointOfSale sx={{ fontSize: { xs: '24px', sm: '28px' } }} />}
                  onClick={handleNavigateToPOS}
                  sx={[
                    getHeaderButtonStyles(ROUTES.POS, routeStates.isPOSActive),
                    {
                      backgroundColor: routeStates.isPOSActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                      fontWeight: routeStates.isPOSActive ? 700 : 500,
                      display: { xs: 'none', sm: 'flex' },
                      '& .MuiButton-startIcon': {
                        marginRight: { xs: 0, sm: '6px' },
                      },
                    },
                  ]}
                >
                  POS
                </Button>
              </Tooltip>
              <Tooltip title="Point of Sale - Process sales transactions, returns, and manage the shopping cart">
                <IconButton
                  color="inherit"
                  onClick={handleNavigateToPOS}
                  sx={[
                    iconButtonSx,
                    {
                      display: { xs: 'flex', sm: 'none' },
                      backgroundColor: routeStates.isPOSActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                    },
                  ]}
                >
                  <PointOfSale />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title="Dashboard - View overview statistics, quick actions, and recent activity">
            <Button
              color="inherit"
                  startIcon={<DashboardIcon sx={{ fontSize: { xs: '24px', sm: '28px' } }} />}
              onClick={handleNavigateToDashboard}
              sx={[
                getHeaderButtonStyles(ROUTES.DASHBOARD, routeStates.isDashboardActive),
                {
                  display: { xs: 'none', md: 'flex' },
                  '& .MuiButton-startIcon': {
                    marginRight: { xs: 0, sm: '6px' },
                  },
                },
              ]}
            >
              Dashboard
            </Button>
          </Tooltip>
          <Tooltip title="Dashboard - View overview statistics, quick actions, and recent activity">
            <IconButton
              color="inherit"
              onClick={handleNavigateToDashboard}
              sx={[
                iconButtonSx,
                {
                  display: { xs: 'flex', md: 'none' },
                  backgroundColor: routeStates.isDashboardActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                },
              ]}
            >
              <DashboardIcon />
            </IconButton>
          </Tooltip>
          {canAccessProducts && (
            <>
              <Tooltip title="Products - View, add, edit, and manage all products in your store">
                <Button
                  color="inherit"
                  startIcon={<Inventory sx={{ fontSize: { xs: '24px', sm: '28px' } }} />}
                  onClick={handleNavigateToProducts}
                  sx={[
                    getHeaderButtonStyles(ROUTES.PRODUCTS, routeStates.isProductsActive),
                    {
                      display: { xs: 'none', md: 'flex' },
                      '& .MuiButton-startIcon': {
                        marginRight: { xs: 0, sm: '6px' },
                      },
                    },
                  ]}
                >
                  Products
                </Button>
              </Tooltip>
              <Tooltip title="Products - View, add, edit, and manage all products in your store">
                <IconButton
                  color="inherit"
                  onClick={handleNavigateToProducts}
                  sx={[
                    iconButtonSx,
                    {
                      display: { xs: 'flex', md: 'none' },
                      backgroundColor: routeStates.isProductsActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                    },
                  ]}
                >
                  <Inventory />
                </IconButton>
              </Tooltip>
            </>
          )}
          {canAccessCategories && (
            <>
              <Tooltip title="Categories - View, add, edit, and manage product categories">
                <Button
                  color="inherit"
                  startIcon={<Category sx={{ fontSize: { xs: '24px', sm: '28px' } }} />}
                  onClick={handleNavigateToCategories}
                  sx={[
                    getHeaderButtonStyles(ROUTES.CATEGORIES, routeStates.isCategoriesActive),
                    {
                      display: { xs: 'none', lg: 'flex' },
                      '& .MuiButton-startIcon': {
                        marginRight: { xs: 0, sm: '6px' },
                      },
                    },
                  ]}
                >
                  Categories
                </Button>
              </Tooltip>
              <Tooltip title="Categories - View, add, edit, and manage product categories">
                <IconButton
                  color="inherit"
                  onClick={handleNavigateToCategories}
                  sx={[
                    iconButtonSx,
                    {
                      display: { xs: 'flex', lg: 'none' },
                      backgroundColor: routeStates.isCategoriesActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                    },
                  ]}
                >
                  <Category />
                </IconButton>
              </Tooltip>
            </>
          )}
          {canAccessTransactions && (
            <>
              <Tooltip title="Transactions - View, search, and manage all sales and return transactions">
                <Button
                  color="inherit"
                  startIcon={<Receipt sx={{ fontSize: { xs: '24px', sm: '28px' } }} />}
                  onClick={handleNavigateToTransactions}
                  sx={[
                    getHeaderButtonStyles(ROUTES.TRANSACTIONS, routeStates.isTransactionsActive),
                    {
                      display: { xs: 'none', lg: 'flex' },
                      '& .MuiButton-startIcon': {
                        marginRight: { xs: 0, sm: '6px' },
                      },
                    },
                  ]}
                >
                  Transactions
                </Button>
              </Tooltip>
              <Tooltip title="Transactions - View, search, and manage all sales and return transactions">
                <IconButton
                  color="inherit"
                  onClick={handleNavigateToTransactions}
                  sx={[
                    iconButtonSx,
                    {
                      display: { xs: 'flex', lg: 'none' },
                      backgroundColor: routeStates.isTransactionsActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                    },
                  ]}
                >
                  <Receipt />
                </IconButton>
              </Tooltip>
            </>
          )}
          {canAccessInventory && (
            <>
              <Tooltip title="Inventory - View stock levels, adjust quantities, and manage product inventory">
                <Button
                  color="inherit"
                  startIcon={<Warehouse sx={{ fontSize: { xs: '24px', sm: '28px' } }} />}
                  onClick={handleNavigateToInventory}
                  sx={[
                    getHeaderButtonStyles(ROUTES.INVENTORY, routeStates.isInventoryActive),
                    {
                      display: { xs: 'none', lg: 'flex' },
                      '& .MuiButton-startIcon': {
                        marginRight: { xs: 0, sm: '6px' },
                      },
                    },
                  ]}
                >
                  Inventory
                </Button>
              </Tooltip>
              <Tooltip title="Inventory - View stock levels, adjust quantities, and manage product inventory">
                <IconButton
                  color="inherit"
                  onClick={handleNavigateToInventory}
                  sx={[
                    iconButtonSx,
                    {
                      display: { xs: 'flex', lg: 'none' },
                      backgroundColor: routeStates.isInventoryActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                    },
                  ]}
                >
                  <Warehouse />
                </IconButton>
              </Tooltip>
            </>
          )}
          {canAccessReports && (
            <>
              <Tooltip title="Reports - Generate and view sales, inventory, financial, and other business reports">
                <Button
                  color="inherit"
                  startIcon={<Assessment sx={{ fontSize: { xs: '24px', sm: '28px' } }} />}
                  onClick={handleNavigateToReports}
                  sx={[
                    getHeaderButtonStyles(ROUTES.REPORTS, routeStates.isReportsActive),
                    {
                      display: { xs: 'none', lg: 'flex' },
                      '& .MuiButton-startIcon': {
                        marginRight: { xs: 0, sm: '6px' },
                      },
                    },
                  ]}
                >
                  Reports
                </Button>
              </Tooltip>
              <Tooltip title="Reports - Generate and view sales, inventory, financial, and other business reports">
                <IconButton
                  color="inherit"
                  onClick={handleNavigateToReports}
                  sx={[
                    iconButtonSx,
                    {
                      display: { xs: 'flex', lg: 'none' },
                      backgroundColor: routeStates.isReportsActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                    },
                  ]}
                >
                  <Assessment />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title="More Options - Access additional sections including Suppliers, Cashiers, Purchase Orders, Pricing, Analytics, and Settings">
            <IconButton
              color="inherit"
              onClick={handleMoreMenu}
              sx={moreMenuButtonSx}
            >
              <MoreVert sx={{ fontSize: { xs: '24px', sm: '28px' } }} />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={moreMenuEl}
            open={Boolean(moreMenuEl)}
            onClose={handleMoreMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            PaperProps={{
              sx: menuPaperSx,
            }}
          >
            {canAccessSuppliers && (
              <MenuItem
                onClick={handleNavigateToSuppliers}
                selected={routeStates.isSuppliersActive}
              >
                <LocalShipping sx={{ mr: 1, fontSize: '24px' }} />
                Suppliers
              </MenuItem>
            )}
            {canAccessCashiers && (
              <MenuItem
                onClick={handleNavigateToCashiers}
                selected={routeStates.isCashiersActive}
              >
                <People sx={{ mr: 1, fontSize: '24px' }} />
                Cashiers
              </MenuItem>
            )}
            {canAccessPurchaseOrders && (
              <MenuItem
                onClick={handleNavigateToPurchaseOrders}
                selected={routeStates.isPurchaseOrdersActive}
              >
                <ShoppingCart sx={{ mr: 1, fontSize: '24px' }} />
                Purchase Orders
              </MenuItem>
            )}
            {canAccessStockTransfers && (
              <MenuItem
                onClick={handleNavigateToStockTransfers}
                selected={routeStates.isStockTransfersActive}
              >
                <SwapHoriz sx={{ mr: 1, fontSize: '24px' }} />
                Stock Transfers
              </MenuItem>
            )}
            {canAccessPricing && (
              <MenuItem
                onClick={handleNavigateToPricing}
                selected={routeStates.isPricingActive}
              >
                <LocalOffer sx={{ mr: 1, fontSize: '24px' }} />
                Pricing
              </MenuItem>
            )}
            {canAccessAnalytics && (
              <MenuItem
                onClick={handleNavigateToAnalytics}
                selected={routeStates.isAnalyticsActive}
              >
                <Analytics sx={{ mr: 1, fontSize: '24px' }} />
                Analytics
              </MenuItem>
            )}
            {user?.id === 1 && (
              <MenuItem
                onClick={handleNavigateToLogs}
                selected={routeStates.isLogsActive}
              >
                <History sx={{ mr: 1, fontSize: '24px' }} />
                Logs
              </MenuItem>
            )}
            {canAccessSettings && (
              <MenuItem
                onClick={handleNavigateToSettingsFromMenu}
                selected={routeStates.isSettingsActive}
              >
                <Settings sx={{ mr: 1, fontSize: '18px' }} />
                Settings
              </MenuItem>
            )}
            <MenuItem
              onClick={handleNavigateToAlertRules}
              selected={routeStates.isAlertRulesActive}
            >
              <Notifications sx={{ mr: 1, fontSize: '18px' }} />
              Alert Rules
            </MenuItem>
            <MenuItem
              onClick={handleNavigateToAlertHistory}
              selected={routeStates.isAlertHistoryActive}
            >
              <History sx={{ mr: 1, fontSize: '18px' }} />
              Alert History
            </MenuItem>
            <MenuItem
              onClick={handleNavigateToBarcodeLabels}
              selected={routeStates.isBarcodeLabelsActive}
            >
              <QrCode sx={{ mr: 1, fontSize: '18px' }} />
              Barcode Labels
            </MenuItem>
            {user?.id === 1 && (
              <MenuItem
                onClick={handleNavigateToBackup}
                selected={routeStates.isBackupActive}
              >
                <BackupIcon sx={{ mr: 1, fontSize: '24px' }} />
                Backup & Restore
              </MenuItem>
            )}
            {user?.id === 1 && (
              <MenuItem
                onClick={handleNavigateToSystemMaintenance}
                selected={routeStates.isSystemMaintenanceActive}
              >
                <Build sx={{ mr: 1, fontSize: '24px' }} />
                System Maintenance
              </MenuItem>
            )}
            {user?.id === 1 && (
              <MenuItem
                onClick={handleNavigateToLicenseFromMenu}
                selected={routeStates.isLicenseActive}
              >
                <VpnKey sx={{ mr: 1, fontSize: '24px' }} />
                License
              </MenuItem>
            )}
          </Menu>
          <NotificationCenter />
          <SyncStatusIndicator />
          <Tooltip title={`Account Menu - Access your profile, settings, and logout options. Logged in as ${user?.username || 'user'}`}>
            <Button
              size="large"
              aria-label="account menu"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
              startIcon={<AccountCircle sx={{ fontSize: { xs: '24px', sm: '28px' } }} />}
              sx={accountButtonSx}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                {user?.username}
              </Box>
            </Button>
          </Tooltip>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            PaperProps={{
              sx: menuPaperSx,
            }}
          >
            <MenuItem onClick={handleProfile}>
              <AccountCircle sx={{ mr: 1, fontSize: '24px' }} />
              Profile
            </MenuItem>
            {user?.id === 1 && (
              <MenuItem onClick={handleLicense}>
                <VpnKey sx={{ mr: 1, fontSize: '24px' }} />
                License
              </MenuItem>
            )}
            {canAccessSettings && (
              <MenuItem onClick={handleSettings}>
                <Settings sx={{ mr: 1, fontSize: '24px' }} />
                Settings
              </MenuItem>
            )}
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1, fontSize: '24px' }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Container maxWidth={false} sx={containerSx}>
        {children}
      </Container>
      {/* Contact administrator Footer - Always Visible */}
      <Paper
        component="footer"
        elevation={0}
        sx={footerPaperSx}
      >
        <Box sx={footerBoxSx}>
          <Typography variant="body2" sx={footerTypographySx}>
            Contact administrator:
          </Typography>
          <Box sx={footerLinkBoxSx}>
            <MessageCircle sx={{ fontSize: 20 }} />
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
      {/* Helpers Panel - Floating Helper Tools */}
      <HelpersPanel />
    </Box>
  );
}

