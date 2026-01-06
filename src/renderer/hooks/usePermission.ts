import { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { PermissionService, clearPermissionCache } from '../services/permission.service';
import { getRoutePermissions } from '../utils/routePermissions';

// Cache for permission checks to avoid redundant checks and prevent flicker
const permissionCache = new Map<string, boolean>();

// Export function to clear permission cache
export function clearPermissionCacheLocal() {
  permissionCache.clear();
}

/**
 * Hook to check if user has a specific permission
 * Caches permission checks for performance and uses optimistic rendering to prevent flicker
 */
export function usePermission(permissionCode: string | string[]): boolean {
  const { user } = useSelector((state: RootState) => state.auth);
  const isCheckingRef = useRef(false);
  const lastCheckRef = useRef<{ userId: number | undefined; permissions: string[] }>({ userId: undefined, permissions: [] });
  const lastKnownValueRef = useRef<boolean | null>(null);

  const permissions = useMemo(() => {
    return Array.isArray(permissionCode) ? permissionCode : [permissionCode];
  }, [permissionCode]);

  // Helper to get cached or default permission value
  const getPermissionValue = (userId: number | undefined, perms: string[]): boolean => {
    if (!userId) return false;
    const cacheKey = `${userId}:${perms.sort().join(',')}`;
    const cached = permissionCache.get(cacheKey);
    if (cached !== undefined) {
      lastKnownValueRef.current = cached;
      return cached;
    }
    // If no permissions required, default to true (optimistic)
    const defaultValue = perms.length === 0 || perms[0] === '';
    // Store default in ref for optimistic rendering
    if (lastKnownValueRef.current === null) {
      lastKnownValueRef.current = defaultValue;
    }
    return defaultValue;
  };

  // Initialize state from cache or default - this prevents flicker
  const [hasPermission, setHasPermission] = useState<boolean>(() => {
    const value = getPermissionValue(user?.id, permissions);
    lastKnownValueRef.current = value;
    return value;
  });

  useEffect(() => {
    if (!user?.id) {
      const currentValue = false;
      if (lastKnownValueRef.current !== currentValue) {
        setHasPermission(currentValue);
      }
      lastKnownValueRef.current = false;
      lastCheckRef.current = { userId: undefined, permissions: [] };
      return;
    }

    // If no permissions required, allow access
    if (permissions.length === 0 || permissions[0] === '') {
      const newValue = true;
      if (lastKnownValueRef.current !== newValue) {
        setHasPermission(newValue);
      }
      lastKnownValueRef.current = newValue;
      return;
    }

    // Clear cache if user changed
    if (lastCheckRef.current.userId !== user.id && lastCheckRef.current.userId !== undefined) {
      permissionCache.clear();
      clearPermissionCache();
      lastKnownValueRef.current = null;
    }

    // Check cache first - if cached, use it immediately (synchronously)
    const permissionsKey = permissions.sort().join(',');
    const cacheKey = `${user.id}:${permissionsKey}`;
    const cached = permissionCache.get(cacheKey);
    if (cached !== undefined) {
      // Only update if different to avoid unnecessary re-renders
      if (lastKnownValueRef.current !== cached) {
        setHasPermission(cached);
      }
      lastKnownValueRef.current = cached;
      lastCheckRef.current = { userId: user.id, permissions };
      return;
    }

    // Skip if we're already checking the same permissions for the same user
    if (
      lastCheckRef.current.userId === user.id &&
      lastCheckRef.current.permissions.join(',') === permissionsKey &&
      isCheckingRef.current
    ) {
      return;
    }

    // Use last known value optimistically while checking (prevents flicker)
    // Only update if we have a previous value to use
    if (lastKnownValueRef.current !== null) {
      setHasPermission(lastKnownValueRef.current);
    }

    isCheckingRef.current = true;
    lastCheckRef.current = { userId: user.id, permissions };

    const checkPermissions = async () => {
      try {
        // Check if user has ALL required permissions
        const permissionChecks = await Promise.all(
          permissions.map(perm => PermissionService.userHasPermission(user.id, perm))
        );
        const hasAllPermissions = permissionChecks.every(check => check === true);
        setHasPermission(hasAllPermissions);
        permissionCache.set(cacheKey, hasAllPermissions);
        lastKnownValueRef.current = hasAllPermissions;
      } catch (error) {
        console.error('Error checking permissions:', error);
        const newValue = false;
        setHasPermission(newValue);
        permissionCache.set(cacheKey, newValue);
        lastKnownValueRef.current = newValue;
      } finally {
        isCheckingRef.current = false;
      }
    };

    checkPermissions();
  }, [user?.id, permissions]);

  return hasPermission;
}

/**
 * Hook to check if user has a specific permission with loading state
 * Returns both the permission status and whether it's currently being checked
 */
export function usePermissionWithLoading(permissionCode: string | string[]): { hasPermission: boolean; isLoading: boolean } {
  const { user } = useSelector((state: RootState) => state.auth);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isCheckingRef = useRef(false);
  const lastCheckRef = useRef<{ userId: number | undefined; permissions: string[] }>({ userId: undefined, permissions: [] });

  const permissions = useMemo(() => {
    return Array.isArray(permissionCode) ? permissionCode : [permissionCode];
  }, [permissionCode]);

  useEffect(() => {
    if (!user?.id) {
      setHasPermission(false);
      setIsLoading(false);
      lastCheckRef.current = { userId: undefined, permissions: [] };
      return;
    }

    // If no permissions required, allow access
    if (permissions.length === 0 || permissions[0] === '') {
      setHasPermission(true);
      setIsLoading(false);
      return;
    }

    // Check cache first
    const permissionsKey = permissions.sort().join(',');
    const cacheKey = `${user.id}:${permissionsKey}`;
    const cached = permissionCache.get(cacheKey);
    if (cached !== undefined) {
      setHasPermission(cached);
      setIsLoading(false);
      lastCheckRef.current = { userId: user.id, permissions };
      return;
    }

    // Skip if we're already checking the same permissions for the same user
    if (
      lastCheckRef.current.userId === user.id &&
      lastCheckRef.current.permissions.join(',') === permissionsKey &&
      isCheckingRef.current
    ) {
      return;
    }

    // Clear cache if user changed
    if (lastCheckRef.current.userId !== user.id) {
      permissionCache.clear();
      clearPermissionCache();
    }

    isCheckingRef.current = true;
    setIsLoading(true);
    lastCheckRef.current = { userId: user.id, permissions };

    const checkPermissions = async () => {
      try {
        // Check if user has ALL required permissions
        const permissionChecks = await Promise.all(
          permissions.map(perm => PermissionService.userHasPermission(user.id, perm))
        );
        const hasAllPermissions = permissionChecks.every(check => check === true);
        setHasPermission(hasAllPermissions);
        permissionCache.set(cacheKey, hasAllPermissions);
      } catch (error) {
        console.error('Error checking permissions:', error);
        setHasPermission(false);
        permissionCache.set(cacheKey, false);
      } finally {
        setIsLoading(false);
        isCheckingRef.current = false;
      }
    };

    checkPermissions();
  }, [user?.id, permissions]);

  return { hasPermission, isLoading };
}

// Cache for route permissions to avoid redundant checks
const routePermissionCache = new Map<string, boolean>();

// Export function to clear route permission cache
export function clearRoutePermissionCache() {
  routePermissionCache.clear();
}

/**
 * Hook to check if user can access a route
 * Optimized with caching to prevent UI flicker on navigation
 * Uses optimistic rendering - keeps previous value while checking
 */
export function useRoutePermission(route: string): boolean {
  const { user } = useSelector((state: RootState) => state.auth);
  const isCheckingRef = useRef(false);
  const lastCheckRef = useRef<{ userId: number | undefined; route: string }>({ userId: undefined, route: '' });
  const lastKnownValueRef = useRef<boolean | null>(null);
  
  // Helper to get cached or default permission value
  const getPermissionValue = (userId: number | undefined, currentRoute: string): boolean => {
    if (!userId) return false;
    const cacheKey = `${userId}:${currentRoute}`;
    const cached = routePermissionCache.get(cacheKey);
    if (cached !== undefined) {
      lastKnownValueRef.current = cached;
      return cached;
    }
    // If no permissions required, default to true (optimistic)
    const requiredPermissions = getRoutePermissions(currentRoute);
    const defaultValue = requiredPermissions.length === 0;
    // Store default in ref for optimistic rendering
    if (lastKnownValueRef.current === null) {
      lastKnownValueRef.current = defaultValue;
    }
    return defaultValue;
  };

  // Initialize state from cache or default - this prevents flicker
  const [hasPermission, setHasPermission] = useState<boolean>(() => {
    const value = getPermissionValue(user?.id, route);
    lastKnownValueRef.current = value;
    return value;
  });

  useEffect(() => {
    if (!user?.id) {
      const currentValue = false;
      if (lastKnownValueRef.current !== currentValue) {
        setHasPermission(currentValue);
      }
      lastKnownValueRef.current = false;
      lastCheckRef.current = { userId: undefined, route: '' };
      return;
    }

    // Clear cache if user changed
    if (lastCheckRef.current.userId !== user.id && lastCheckRef.current.userId !== undefined) {
      routePermissionCache.clear();
      clearPermissionCache();
      lastKnownValueRef.current = null;
    }

    // Check cache first - if cached, use it immediately (synchronously)
    const cacheKey = `${user.id}:${route}`;
    const cached = routePermissionCache.get(cacheKey);
    if (cached !== undefined) {
      // Only update if different to avoid unnecessary re-renders
      if (lastKnownValueRef.current !== cached) {
        setHasPermission(cached);
      }
      lastKnownValueRef.current = cached;
      lastCheckRef.current = { userId: user.id, route };
      return;
    }

    // Skip if we're already checking the same route for the same user
    if (
      lastCheckRef.current.userId === user.id &&
      lastCheckRef.current.route === route &&
      isCheckingRef.current
    ) {
      return;
    }

    // Use last known value optimistically while checking (prevents flicker)
    // Only update if we have a previous value to use
    if (lastKnownValueRef.current !== null) {
      setHasPermission(lastKnownValueRef.current);
    }

    isCheckingRef.current = true;
    lastCheckRef.current = { userId: user.id, route };

    const checkRoutePermission = async () => {
      try {
        const requiredPermissions = getRoutePermissions(route);
        
        // If no permissions required, allow access
        if (requiredPermissions.length === 0) {
          const newValue = true;
          setHasPermission(newValue);
          routePermissionCache.set(cacheKey, newValue);
          lastKnownValueRef.current = newValue;
          return;
        }

        // Check if user has ALL required permissions
        const permissionChecks = await Promise.all(
          requiredPermissions.map(perm => PermissionService.userHasPermission(user.id, perm))
        );
        const hasAllPermissions = permissionChecks.every(check => check === true);
        setHasPermission(hasAllPermissions);
        routePermissionCache.set(cacheKey, hasAllPermissions);
        lastKnownValueRef.current = hasAllPermissions;
      } catch (error) {
        console.error('Error checking route permissions:', error);
        const newValue = false;
        setHasPermission(newValue);
        routePermissionCache.set(cacheKey, newValue);
        lastKnownValueRef.current = newValue;
      } finally {
        isCheckingRef.current = false;
      }
    };

    checkRoutePermission();
  }, [user?.id, route]);

  return hasPermission;
}

