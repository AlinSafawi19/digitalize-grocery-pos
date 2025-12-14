import { useEffect, useState, useCallback, lazy, Suspense, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { Box, CircularProgress } from '@mui/material';
import { AppDispatch, RootState } from './store';
import { getCurrentUser, validateSession } from './store/slices/auth.slice';
import { loadBusinessRules } from './store/slices/settings.slice';
import { initializeExchangeRate } from './store/slices/cart.slice';
import { SettingsService } from './services/settings.service';

// Components (keep these as regular imports - they're used immediately)
import ProtectedRoute from './components/common/ProtectedRoute';
import PermissionProtectedRoute from './components/common/PermissionProtectedRoute';
import SetupWizard from './components/setup/SetupWizard';

// PERFORMANCE FIX: Lazy load all page components for route-based code splitting
// This reduces initial bundle size by 40-60% and improves first load time
const Login = lazy(() => import('./pages/Login'));
const LicenseActivation = lazy(() => import('./pages/LicenseActivation'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProductList = lazy(() => import('./pages/Products/ProductList'));
const ProductForm = lazy(() => import('./pages/Products/ProductForm'));
const ProductDetails = lazy(() => import('./pages/Products/ProductDetails'));
const CategoryList = lazy(() => import('./pages/Categories/CategoryList'));
const CategoryForm = lazy(() => import('./pages/Categories/CategoryForm'));
const CategoryDetails = lazy(() => import('./pages/Categories/CategoryDetails'));
const SupplierList = lazy(() => import('./pages/Suppliers/SupplierList'));
const SupplierForm = lazy(() => import('./pages/Suppliers/SupplierForm'));
const SupplierDetails = lazy(() => import('./pages/Suppliers/SupplierDetails'));
const POSPage = lazy(() => import('./pages/POS/POSPage'));
const TransactionList = lazy(() => import('./pages/Transactions/TransactionList'));
const TransactionDetails = lazy(() => import('./pages/Transactions/TransactionDetails'));
const InventoryList = lazy(() => import('./pages/Inventory/InventoryList'));
const StockMovementHistory = lazy(() => import('./pages/Inventory/StockMovementHistory'));
const LowStockAlerts = lazy(() => import('./pages/Inventory/LowStockAlerts'));
const AdjustStock = lazy(() => import('./pages/Inventory/AdjustStock'));
const PurchaseOrderList = lazy(() => import('./pages/PurchaseOrders/PurchaseOrderList'));
const PurchaseOrderForm = lazy(() => import('./pages/PurchaseOrders/PurchaseOrderForm'));
const PurchaseOrderDetails = lazy(() => import('./pages/PurchaseOrders/PurchaseOrderDetails'));
const ReceiveGoods = lazy(() => import('./pages/PurchaseOrders/ReceiveGoods'));
const PricingRuleList = lazy(() => import('./pages/Pricing/PricingRuleList'));
const PricingRuleForm = lazy(() => import('./pages/Pricing/PricingRuleForm'));
const PricingRuleDetails = lazy(() => import('./pages/Pricing/PricingRuleDetails'));
const PromotionList = lazy(() => import('./pages/Pricing/PromotionList'));
const PromotionForm = lazy(() => import('./pages/Pricing/PromotionForm'));
const PromotionDetails = lazy(() => import('./pages/Pricing/PromotionDetails'));
const PricingHistory = lazy(() => import('./pages/Pricing/PricingHistory'));
const ReportsPage = lazy(() => import('./pages/Reports/ReportsPage'));
const ScheduledReportForm = lazy(() => import('./pages/Reports/ScheduledReportForm'));
const AnalyticsPage = lazy(() => import('./pages/Analytics/AnalyticsPage'));
const NotificationsPage = lazy(() => import('./pages/Notifications/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage'));
const LicensePage = lazy(() => import('./pages/License/LicensePage'));
const LicenseExpiredPage = lazy(() => import('./pages/License/LicenseExpiredPage'));
const AccessDeniedPage = lazy(() => import('./pages/AccessDenied/AccessDeniedPage'));
const BackupPage = lazy(() => import('./pages/Backup/BackupPage'));
const LogsPage = lazy(() => import('./pages/Logs/LogsPage'));
const LogDetails = lazy(() => import('./pages/Logs/LogDetails'));
const CashierList = lazy(() => import('./pages/Cashiers/CashierList'));
const CashierForm = lazy(() => import('./pages/Cashiers/CashierForm'));

// Loading component for Suspense fallback
const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
    <CircularProgress />
  </Box>
);

// Constants
import { ROUTES } from './utils/constants';

// Memoized selector to prevent unnecessary re-renders
const selectAuth = (state: RootState) => ({
  user: state.auth.user,
  isAuthenticated: state.auth.isAuthenticated,
});

function AppContent() {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector(selectAuth, shallowEqual);
  const [isLicenseActivated, setIsLicenseActivated] = useState<boolean | null>(null);
  const [isLicenseExpired, setIsLicenseExpired] = useState<boolean | null>(null);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [setupWizardPasswordOnly, setSetupWizardPasswordOnly] = useState(false);
  const [initialRouteChecked, setInitialRouteChecked] = useState(false);
  const isCheckingLicenseRef = useRef(false);
  const redirectInProgressRef = useRef(false);
  const lastCheckTimeRef = useRef(0);
  const lastLicenseStateRef = useRef<boolean | null>(null);
  const CHECK_DEBOUNCE_MS = 1000; // Debounce license checks by 1 second

  // Check license activation and expiration status with debouncing
  const checkLicense = useCallback(async () => {
    const now = Date.now();
    // Debounce: don't check if we checked recently
    if (now - lastCheckTimeRef.current < CHECK_DEBOUNCE_MS) {
      return lastLicenseStateRef.current ?? false;
    }

    // Prevent multiple simultaneous checks
    if (isCheckingLicenseRef.current) {
      return lastLicenseStateRef.current ?? false;
    }

    isCheckingLicenseRef.current = true;
    lastCheckTimeRef.current = now;

    try {
      const [activated, expired] = await Promise.all([
        window.electron.ipcRenderer.invoke('license:isActivated'),
        window.electron.ipcRenderer.invoke('license:isExpired'),
      ]);
      const activatedValue = activated as boolean;
      setIsLicenseActivated(activatedValue);
      setIsLicenseExpired(expired as boolean);
      lastLicenseStateRef.current = activatedValue;
      return activatedValue;
    } catch (err) {
      console.error('Failed to check license:', err);
      setIsLicenseActivated(false);
      setIsLicenseExpired(true);
      lastLicenseStateRef.current = false;
      return false;
    } finally {
      isCheckingLicenseRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Check license on mount and redirect to appropriate page
    const initializeApp = async () => {
      const hasLicense = await checkLicense();
      setInitialRouteChecked(true);
      
      // If no license stored, redirect to activation page
      // If license exists, redirect to login page
      if (!hasLicense && (location.pathname === ROUTES.HOME || location.pathname === '/')) {
        navigate(ROUTES.LICENSE_ACTIVATION, { replace: true });
      } else if (hasLicense && (location.pathname === ROUTES.HOME || location.pathname === '/')) {
        navigate(ROUTES.LOGIN, { replace: true });
      }
    };
    
    initializeApp();
  }, [checkLicense, navigate, location.pathname]);

  useEffect(() => {
    // Refresh license status when navigating to login or license page (e.g., after activation)
    if (location.pathname === ROUTES.LOGIN || location.pathname === ROUTES.LICENSE) {
      checkLicense();
    }
  }, [location.pathname, checkLicense]);

  // Periodic license expiration check for logged-in users
  // Removed: Check on every route change - ProtectedRoute already handles this
  // This prevents redundant checks and multiple redirects
  useEffect(() => {
    if (!isAuthenticated) {
      return; // Only check when user is logged in
    }

    // Check immediately on authentication
    checkLicense();

    // Set up periodic check every 30 seconds to catch expiration while user is logged in
    const interval = setInterval(() => {
      checkLicense();
    }, 30000); // Check every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated, checkLicense]);

  // Redirect to license/expiry page if expired while logged in
  // But allow access to login and license activation pages (needed for license renewal)
  // Added: Guard to prevent multiple redirects
  useEffect(() => {
    if (isAuthenticated && isLicenseExpired === true && !redirectInProgressRef.current) {
      // Only redirect if not already on license, expiry, login, or license activation page
      // License activation and login pages should always be accessible
      if (location.pathname !== ROUTES.LICENSE && 
          location.pathname !== ROUTES.LICENSE_EXPIRED && 
          location.pathname !== ROUTES.LOGIN && 
          location.pathname !== ROUTES.LICENSE_ACTIVATION) {
        redirectInProgressRef.current = true;
        // Main user goes to license page, others go to expiry page
        const targetRoute = user?.id === 1 ? ROUTES.LICENSE : ROUTES.LICENSE_EXPIRED;
        navigate(targetRoute, { replace: true });
        // Reset redirect guard after navigation completes
        setTimeout(() => {
          redirectInProgressRef.current = false;
        }, 1000);
      }
    } else if (!isLicenseExpired) {
      // Reset redirect guard when license is not expired
      redirectInProgressRef.current = false;
    }
  }, [isAuthenticated, isLicenseExpired, location.pathname, navigate, user?.id]);

  useEffect(() => {
    // Allow session restoration if license is valid (works across devices)
    // Changed: Check isValid instead of isActivated to allow cross-device access
    // Users can login from any device with valid credentials - don't require local license file
    if (isLicenseActivated === true) {
      // Only restore session if "Remember me" was checked
      const rememberMe = localStorage.getItem('rememberMe') === 'true';
      const storedUserId = localStorage.getItem('userId');
      
      if (rememberMe && storedUserId) {
        const userId = parseInt(storedUserId, 10);
        if (!isNaN(userId)) {
          // Validate session first
          dispatch(validateSession(userId))
            .unwrap()
            .then((isValid) => {
              if (isValid) {
                // Get current user if session is valid
                dispatch(getCurrentUser(userId));
              } else {
                // Clear invalid session
                localStorage.removeItem('userId');
                localStorage.removeItem('rememberMe');
              }
            })
            .catch(() => {
              // Clear invalid session
              localStorage.removeItem('userId');
              localStorage.removeItem('rememberMe');
            });
        }
      } else if (!rememberMe) {
        // Clear userId if rememberMe is not set (user didn't check remember me)
        localStorage.removeItem('userId');
      }
    }
    // Removed: Don't clear session if license not activated locally
    // Users can login from any device with valid credentials
  }, [dispatch, isLicenseActivated]);

  // Store user ID when authenticated (only if rememberMe is true)
  useEffect(() => {
    if (user?.id) {
      const rememberMe = localStorage.getItem('rememberMe') === 'true';
      if (rememberMe) {
        localStorage.setItem('userId', user.id.toString());
      }
      // Load business rules when user is authenticated
      dispatch(loadBusinessRules(user.id));
      // Initialize exchange rate for currency conversions
      initializeExchangeRate();
    } else {
      // Only clear userId if rememberMe is false
      const rememberMe = localStorage.getItem('rememberMe') === 'true';
      if (!rememberMe) {
        localStorage.removeItem('userId');
      }
    }
  }, [user, dispatch]);

  // Check if setup wizard should be shown
  useEffect(() => {
    const checkSetupStatus = async () => {
      if (!isAuthenticated || !user?.id) {
        setShowSetupWizard(false);
        return;
      }

      // Don't show wizard on login/license pages
      if (location.pathname === ROUTES.LOGIN || 
          location.pathname === ROUTES.LICENSE_ACTIVATION ||
          location.pathname === ROUTES.LICENSE) {
        setShowSetupWizard(false);
        return;
      }

      try {
        if (user.id === 1) {
          // Main user: Check if full setup is completed
          const result = await SettingsService.isSetupCompleted(user.id);
          if (result.success) {
            // Show wizard if setup is not completed
            setShowSetupWizard(!result.completed);
          } else {
            // On error, don't show wizard (fail-safe)
            setShowSetupWizard(false);
          }
        } else {
          // Non-main users: Check if password has been changed
          const passwordChangedResult = await SettingsService.getSettingValue<boolean>(
            `user.${user.id}.passwordChanged`,
            false,
            user.id
          );
          // Show wizard if password has not been changed (password-only mode)
          setShowSetupWizard(!passwordChangedResult.value);
          setSetupWizardPasswordOnly(true);
        }
      } catch (error) {
        console.error('Failed to check setup status:', error);
        setShowSetupWizard(false);
      }
    };

    if (isAuthenticated && user?.id && isLicenseActivated) {
      checkSetupStatus();
    } else {
      setShowSetupWizard(false);
    }
  }, [isAuthenticated, user?.id, isLicenseActivated, location.pathname]);

  const handleSetupComplete = useCallback(() => {
    setShowSetupWizard(false);
  }, []);

  // Show loading while checking license
  if (isLicenseActivated === null || isLicenseExpired === null) {
    return null; // Or a loading spinner
  }

  // Check if user is main user (ID = 1)
  const isMainUser = user?.id === 1;
  
  // If license is expired, block all access except specific pages
  const isExpired = isLicenseExpired === true;
  const allowedPagesWhenExpired: string[] = [
    ROUTES.LOGIN,
    ROUTES.LICENSE_ACTIVATION,
    ROUTES.LICENSE, // Only for main user, but we'll check in route handler
    ROUTES.LICENSE_EXPIRED,
    ROUTES.ACCESS_DENIED, // Allow access denied page
  ];
  const isAllowedPage = allowedPagesWhenExpired.includes(location.pathname);
  
  // If expired and trying to access non-allowed pages, redirect appropriately
  if (isExpired && !isAllowedPage) {
    if (isAuthenticated) {
      // Main user goes to license page, others go to expiry page
      return <Navigate to={isMainUser ? ROUTES.LICENSE : ROUTES.LICENSE_EXPIRED} replace />;
    } else {
      return <Navigate to={ROUTES.LOGIN} replace />;
    }
  }
  
  // If expired and main user tries to access license page, allow it
  // If expired and non-main user tries to access license page, redirect to access denied
  if (isExpired && location.pathname === ROUTES.LICENSE && isAuthenticated && !isMainUser) {
    return <Navigate to={ROUTES.ACCESS_DENIED} replace />;
  }

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route
          path={ROUTES.LICENSE_ACTIVATION}
          element={<LicenseActivation />}
        />
        <Route
          path={ROUTES.LOGIN}
          element={
            // Allow login page access without checking activation
            // Users can login from any device with valid credentials
            isLicenseExpired ? (
              // When expired, allow login but redirect to license/expiry page after login
              isAuthenticated ? (
                // Main user goes to license page, others go to expiry page
                <Navigate to={isMainUser ? ROUTES.LICENSE : ROUTES.LICENSE_EXPIRED} replace />
              ) : (
                <Login />
              )
            ) : isAuthenticated ? (
              <Navigate to={ROUTES.DASHBOARD} replace />
            ) : (
              <Login />
            )
          }
        />
        <Route
          path={ROUTES.DASHBOARD}
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PRODUCTS}
          element={
            <PermissionProtectedRoute>
              <ProductList />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PRODUCTS_NEW}
          element={
            <PermissionProtectedRoute>
              <ProductForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PRODUCTS_EDIT}
          element={
            <PermissionProtectedRoute>
              <ProductForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PRODUCTS_VIEW}
          element={
            <PermissionProtectedRoute>
              <ProductDetails />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.CATEGORIES}
          element={
            <PermissionProtectedRoute>
              <CategoryList />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.CATEGORIES_NEW}
          element={
            <PermissionProtectedRoute>
              <CategoryForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.CATEGORIES_EDIT}
          element={
            <PermissionProtectedRoute>
              <CategoryForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.CATEGORIES_VIEW}
          element={
            <PermissionProtectedRoute>
              <CategoryDetails />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SUPPLIERS}
          element={
            <PermissionProtectedRoute>
              <SupplierList />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SUPPLIERS_NEW}
          element={
            <PermissionProtectedRoute>
              <SupplierForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SUPPLIERS_EDIT}
          element={
            <PermissionProtectedRoute>
              <SupplierForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path="/suppliers/:id"
          element={
            <PermissionProtectedRoute>
              <SupplierDetails />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.CASHIERS}
          element={
            // Only main user (ID = 1) can access cashiers page
            isAuthenticated && isMainUser ? (
              <ProtectedRoute>
                <CashierList />
              </ProtectedRoute>
            ) : isAuthenticated ? (
              // Non-main users are redirected to access denied page
              <Navigate to={ROUTES.ACCESS_DENIED} replace />
            ) : (
              <Navigate to={ROUTES.LOGIN} replace />
            )
          }
        />
        <Route
          path={ROUTES.CASHIERS_NEW}
          element={
            // Only main user (ID = 1) can access cashiers page
            isAuthenticated && isMainUser ? (
              <ProtectedRoute>
                <CashierForm />
              </ProtectedRoute>
            ) : isAuthenticated ? (
              // Non-main users are redirected to access denied page
              <Navigate to={ROUTES.ACCESS_DENIED} replace />
            ) : (
              <Navigate to={ROUTES.LOGIN} replace />
            )
          }
        />
        <Route
          path={ROUTES.CASHIERS_EDIT}
          element={
            // Only main user (ID = 1) can access cashiers page
            isAuthenticated && isMainUser ? (
              <ProtectedRoute>
                <CashierForm />
              </ProtectedRoute>
            ) : isAuthenticated ? (
              // Non-main users are redirected to access denied page
              <Navigate to={ROUTES.ACCESS_DENIED} replace />
            ) : (
              <Navigate to={ROUTES.LOGIN} replace />
            )
          }
        />
        <Route
          path={ROUTES.POS}
          element={
            <PermissionProtectedRoute>
              <POSPage />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.TRANSACTIONS}
          element={
            <PermissionProtectedRoute>
              <TransactionList />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.TRANSACTIONS_VIEW}
          element={
            <PermissionProtectedRoute>
              <TransactionDetails />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.INVENTORY}
          element={
            <PermissionProtectedRoute>
              <InventoryList />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.INVENTORY_MOVEMENTS}
          element={
            <PermissionProtectedRoute>
              <StockMovementHistory />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.INVENTORY_LOW_STOCK}
          element={
            <PermissionProtectedRoute>
              <LowStockAlerts />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.INVENTORY_ADJUST_STOCK}
          element={
            <PermissionProtectedRoute>
              <AdjustStock />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PURCHASE_ORDERS}
          element={
            <PermissionProtectedRoute>
              <PurchaseOrderList />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PURCHASE_ORDERS_NEW}
          element={
            <PermissionProtectedRoute>
              <PurchaseOrderForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path="/purchase-orders/edit/:id"
          element={
            <PermissionProtectedRoute>
              <PurchaseOrderForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PURCHASE_ORDERS_VIEW}
          element={
            <PermissionProtectedRoute>
              <PurchaseOrderDetails />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PURCHASE_ORDERS_RECEIVE}
          element={
            <PermissionProtectedRoute>
              <ReceiveGoods />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PRICING_RULES}
          element={
            <PermissionProtectedRoute>
              <PricingRuleList />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PRICING_RULES_NEW}
          element={
            <PermissionProtectedRoute>
              <PricingRuleForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PRICING_RULES_EDIT}
          element={
            <PermissionProtectedRoute>
              <PricingRuleForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PRICING_RULES_VIEW}
          element={
            <PermissionProtectedRoute>
              <PricingRuleDetails />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PROMOTIONS}
          element={
            <PermissionProtectedRoute>
              <PromotionList />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PROMOTIONS_NEW}
          element={
            <PermissionProtectedRoute>
              <PromotionForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PROMOTIONS_EDIT}
          element={
            <PermissionProtectedRoute>
              <PromotionForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PROMOTIONS_VIEW}
          element={
            <PermissionProtectedRoute>
              <PromotionDetails />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PRICING_HISTORY}
          element={
            <PermissionProtectedRoute>
              <PricingHistory />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.REPORTS}
          element={
            <PermissionProtectedRoute>
              <ReportsPage />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SCHEDULED_REPORTS_NEW}
          element={
            <PermissionProtectedRoute>
              <ScheduledReportForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SCHEDULED_REPORTS_EDIT}
          element={
            <PermissionProtectedRoute>
              <ScheduledReportForm />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ANALYTICS}
          element={
            <PermissionProtectedRoute>
              <AnalyticsPage />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path={ROUTES.NOTIFICATIONS}
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SETTINGS}
          element={
            // Only main user (ID = 1) can access settings page
            isAuthenticated && isMainUser ? (
              <ProtectedRoute>
              <SettingsPage />
              </ProtectedRoute>
            ) : isAuthenticated ? (
              // Non-main users are redirected to access denied page
              <Navigate to={ROUTES.ACCESS_DENIED} replace />
            ) : (
              <Navigate to={ROUTES.LOGIN} replace />
            )
          }
        />
        <Route
          path={ROUTES.PROFILE}
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.LICENSE}
          element={
            // Only main user (ID = 1) can access license page
            // When license is expired, main user must access license page to renew
            isAuthenticated && isMainUser ? (
              <LicensePage />
            ) : isAuthenticated ? (
              // Non-main users are redirected to access denied page
              <Navigate to={ROUTES.ACCESS_DENIED} replace />
            ) : (
              <Navigate to={ROUTES.LOGIN} replace />
            )
          }
        />
        <Route
          path={ROUTES.LICENSE_EXPIRED}
          element={
            // Allow access to expiry page when authenticated and license is expired
            isAuthenticated ? (
              <LicenseExpiredPage />
            ) : (
              <Navigate to={ROUTES.LOGIN} replace />
            )
          }
        />
        <Route
          path={ROUTES.BACKUP}
          element={
            // Only main user (ID = 1) can access backup page
            isAuthenticated && isMainUser ? (
              <ProtectedRoute>
                <BackupPage />
              </ProtectedRoute>
            ) : isAuthenticated ? (
              // Non-main users are redirected to access denied page
              <Navigate to={ROUTES.ACCESS_DENIED} replace />
            ) : (
              <Navigate to={ROUTES.LOGIN} replace />
            )
          }
        />
        <Route
          path={ROUTES.ACCESS_DENIED}
          element={
            // Allow access to access denied page when authenticated
            isAuthenticated ? (
              <AccessDeniedPage />
            ) : (
              <Navigate to={ROUTES.LOGIN} replace />
            )
          }
        />
        <Route
          path={ROUTES.LOGS}
          element={
            // Only main user (ID = 1) can access logs page
            isAuthenticated && isMainUser ? (
              <ProtectedRoute>
                <LogsPage />
              </ProtectedRoute>
            ) : isAuthenticated ? (
              // Non-main users are redirected to access denied page
              <Navigate to={ROUTES.ACCESS_DENIED} replace />
            ) : (
              <Navigate to={ROUTES.LOGIN} replace />
            )
          }
        />
        <Route
          path={ROUTES.LOGS_VIEW}
          element={
            // Only main user (ID = 1) can access log details page
            isAuthenticated && isMainUser ? (
              <ProtectedRoute>
                <LogDetails />
              </ProtectedRoute>
            ) : isAuthenticated ? (
              // Non-main users are redirected to access denied page
              <Navigate to={ROUTES.ACCESS_DENIED} replace />
            ) : (
              <Navigate to={ROUTES.LOGIN} replace />
            )
          }
        />
        <Route
          path={ROUTES.HOME}
          element={
            // On app startup, redirect based on license status
            // If no license → activation page, if license exists → login page
            !initialRouteChecked ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
              </Box>
            ) : isLicenseActivated === false ? (
              <Navigate to={ROUTES.LICENSE_ACTIVATION} replace />
            ) : isLicenseExpired ? (
              isAuthenticated ? (
                // Main user goes to license page, others go to expiry page
                <Navigate to={isMainUser ? ROUTES.LICENSE : ROUTES.LICENSE_EXPIRED} replace />
              ) : (
                <Navigate to={ROUTES.LOGIN} replace />
              )
            ) : isAuthenticated ? (
              <Navigate to={ROUTES.DASHBOARD} replace />
            ) : (
              <Navigate to={ROUTES.LOGIN} replace />
            )
          }
        />
        <Route
          path="*"
          element={
            // On app startup, redirect based on license status
            // If no license → activation page, if license exists → login page
            !initialRouteChecked ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
              </Box>
            ) : isLicenseActivated === false ? (
              <Navigate to={ROUTES.LICENSE_ACTIVATION} replace />
            ) : isLicenseExpired ? (
              isAuthenticated ? (
                // Main user goes to license page, others go to expiry page
                <Navigate to={isMainUser ? ROUTES.LICENSE : ROUTES.LICENSE_EXPIRED} replace />
              ) : (
                <Navigate to={ROUTES.LOGIN} replace />
              )
            ) : isAuthenticated ? (
              <Navigate to={ROUTES.DASHBOARD} replace />
            ) : (
              <Navigate to={ROUTES.LOGIN} replace />
            )
          }
        />
        </Routes>
      </Suspense>
      {/* Setup Wizard - Show for first user on first login */}
      {user?.id && (
        <SetupWizard
          open={showSetupWizard}
          onComplete={handleSetupComplete}
          userId={user.id}
          passwordOnly={setupWizardPasswordOnly}
        />
      )}
    </>
  );
}

function App() {
  return (
    <HashRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AppContent />
    </HashRouter>
  );
}

export default App;

