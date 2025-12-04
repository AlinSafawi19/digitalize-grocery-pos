import { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector, shallowEqual } from 'react-redux';
import type { RootState } from '../../store';
import { Box } from '@mui/material';
import { ROUTES } from '../../utils/constants';
import { getRoutePermissions } from '../../utils/routePermissions';
import { PermissionService, clearPermissionCache } from '../../services/permission.service';
import ProtectedRoute from './ProtectedRoute';

interface PermissionProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string | string[]; // Optional: override route permissions
}

// Optimized selector - only subscribes to the fields we need
const selectAuth = (state: RootState) => ({
  isAuthenticated: state.auth.isAuthenticated,
  isLoading: state.auth.isLoading,
  user: state.auth.user,
});

/* eslint-disable react/prop-types */
const PermissionProtectedRoute: React.FC<PermissionProtectedRouteProps> = ({ 
  children, 
  requiredPermission 
}) => {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useSelector(selectAuth, shallowEqual);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const isCheckingRef = useRef(false);
  const lastCheckRef = useRef<{ userId: number | undefined; route: string; permissions: string[] }>({
    userId: undefined,
    route: '',
    permissions: [],
  });

  // Get required permissions for this route
  const requiredPermissions = useMemo(() => {
    if (requiredPermission) {
      return Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    }
    return getRoutePermissions(location.pathname);
  }, [location.pathname, requiredPermission]);

  // Check permissions with caching and debouncing
  const checkPermissions = useCallback(async () => {
    if (!user?.id) {
      setHasPermission(false);
      setIsCheckingPermission(false);
      lastCheckRef.current = { userId: undefined, route: '', permissions: [] };
      return;
    }

    // If no permissions required, allow access (for routes like dashboard, profile)
    if (requiredPermissions.length === 0) {
      setHasPermission(true);
      setIsCheckingPermission(false);
      return;
    }

    // Skip if we're already checking the same permissions for the same route and user
    const permissionsKey = requiredPermissions.sort().join(',');
    if (
      lastCheckRef.current.userId === user.id &&
      lastCheckRef.current.route === location.pathname &&
      lastCheckRef.current.permissions.join(',') === permissionsKey &&
      isCheckingRef.current
    ) {
      return;
    }

    // Clear cache if user changed
    if (lastCheckRef.current.userId !== user.id) {
      clearPermissionCache();
    }

    isCheckingRef.current = true;
    setIsCheckingPermission(true);
    lastCheckRef.current = { userId: user.id, route: location.pathname, permissions: requiredPermissions };

    try {
      // Check if user has at least one of the required permissions
      // If multiple permissions are required, user needs ALL of them
      const permissionChecks = await Promise.all(
        requiredPermissions.map(perm => PermissionService.userHasPermission(user.id, perm))
      );

      // User needs ALL required permissions (if multiple are specified)
      const hasAllPermissions = permissionChecks.every(check => check === true);
      setHasPermission(hasAllPermissions);
    } catch (error) {
      console.error('Error checking permissions:', error);
      setHasPermission(false);
    } finally {
      setIsCheckingPermission(false);
      isCheckingRef.current = false;
    }
  }, [user?.id, requiredPermissions, location.pathname]);

  useEffect(() => {
    if (isAuthenticated && user) {
      checkPermissions();
    } else {
      setHasPermission(false);
      setIsCheckingPermission(false);
      lastCheckRef.current = { userId: undefined, route: '', permissions: [] };
    }
  }, [isAuthenticated, user, checkPermissions]);

  // If user doesn't have required permissions, redirect to access denied
  if (!hasPermission && hasPermission !== null && !isLoading && !isCheckingPermission) {
    return <Navigate to={ROUTES.ACCESS_DENIED} replace />;
  }

  // Wrap in ProtectedRoute to ensure authentication and license checks
  // Only show loading overlay if we're actually checking (not just initial null state)
  // This prevents UI flicker when navigating between pages
  const shouldShowLoading = (isLoading || (isCheckingPermission && isCheckingRef.current)) && hasPermission === null;
  
  return (
    <ProtectedRoute>
      {children}
      {shouldShowLoading && (
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
    </ProtectedRoute>
  );
};
/* eslint-enable react/prop-types */

// Memoize the component to prevent re-renders when props haven't changed
export default memo(PermissionProtectedRoute);

