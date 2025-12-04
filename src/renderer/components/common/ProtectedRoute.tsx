import { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector, shallowEqual } from 'react-redux';
import type { RootState } from '../../store';
import { Box } from '@mui/material';
import { ROUTES } from '../../utils/constants';

interface ProtectedRouteProps {
  children: ReactNode;
}

// Optimized selector - only subscribes to the fields we need
const selectAuth = (state: RootState) => ({
  isAuthenticated: state.auth.isAuthenticated,
  isLoading: state.auth.isLoading,
  user: state.auth.user,
});

// eslint-disable-next-line react/prop-types
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  // Use optimized selector with shallowEqual to prevent unnecessary re-renders
  const { isAuthenticated, isLoading, user } = useSelector(selectAuth, shallowEqual);
  const [isLicenseActivated, setIsLicenseActivated] = useState<boolean | null>(null);
  const [isLicenseExpired, setIsLicenseExpired] = useState<boolean | null>(null);
  const isCheckingLicenseRef = useRef(false);
  const lastCheckTimeRef = useRef(0);
  const CHECK_DEBOUNCE_MS = 1000; // Debounce license checks by 1 second

  // Memoize the license check function to prevent recreation on every render
  // Added debouncing to prevent multiple simultaneous checks
  const checkLicense = useCallback(async () => {
    const now = Date.now();
    // Debounce: don't check if we checked recently
    if (now - lastCheckTimeRef.current < CHECK_DEBOUNCE_MS) {
      return;
    }

    // Prevent multiple simultaneous checks
    if (isCheckingLicenseRef.current) {
      return;
    }

    isCheckingLicenseRef.current = true;
    lastCheckTimeRef.current = now;

    try {
      // Check if license is expired (this works across devices)
      // For activation check, we use isValid which validates online if needed
      const [expired, valid] = await Promise.all([
        window.electron.ipcRenderer.invoke('license:isExpired'),
        window.electron.ipcRenderer.invoke('license:isValid'),
      ]);
      
      // License is considered "activated" if it's valid (works across devices)
      // This allows users to login from any device with valid credentials
      setIsLicenseActivated(typeof valid === 'boolean' ? valid : false);
      setIsLicenseExpired(typeof expired === 'boolean' ? expired : true);
    } catch (err) {
      console.error('Failed to check license:', err);
      setIsLicenseActivated(false);
      setIsLicenseExpired(true);
    } finally {
      isCheckingLicenseRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Check license activation status on mount
    // Only check once on mount, not on every authentication change
    // This prevents redundant checks when navigating between protected routes
    checkLicense();

    // If user is authenticated, set up periodic check to catch expiration while logged in
    // Note: Periodic check is already handled in App.tsx, so we can reduce frequency here
    if (isAuthenticated) {
      // Set up periodic check every 60 seconds (less frequent than App.tsx to avoid conflicts)
      const interval = setInterval(() => {
        checkLicense();
      }, 60000); // Check every 60 seconds

      return () => {
        clearInterval(interval);
      };
    }
  }, [checkLicense, isAuthenticated]);

  // Memoize loading state check to prevent unnecessary recalculations
  const isChecking = useMemo(
    () => isLicenseActivated === null || isLicenseExpired === null || isLoading,
    [isLicenseActivated, isLicenseExpired, isLoading]
  );

  // Memoize navigation conditions to prevent unnecessary re-renders
  // Changed: Only check expiration, not activation (users can login from any device)
  // License activation check removed - users with valid credentials can access
  const shouldRedirectToLicense = useMemo(
    () => isLicenseExpired === true, // Only check expiration, not activation
    [isLicenseExpired]
  );

  const shouldRedirectToLogin = useMemo(
    () => !isAuthenticated || !user,
    [isAuthenticated, user]
  );

  // License must be activated and not expired
  if (shouldRedirectToLicense) {
    // If license is expired, redirect appropriately based on user role
    if (isLicenseExpired === true && isLicenseActivated === true) {
      // Main user (ID = 1) goes to license page, others go to expiry page
      const isMainUser = user?.id === 1;
      return <Navigate to={isMainUser ? ROUTES.LICENSE : ROUTES.LICENSE_EXPIRED} replace />;
    }
    return <Navigate to={ROUTES.LICENSE_ACTIVATION} replace />;
  }

  if (shouldRedirectToLogin) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // Show loading overlay while checking, but render children so they're visible underneath
  return (
    <>
      {children}
      {isChecking && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
};

// Memoize the component to prevent re-renders when props haven't changed
export default memo(ProtectedRoute);

