import { ROUTES } from './constants';

/**
 * Maps routes to their required permissions
 * A route can require one or more permissions (user needs at least one)
 * If a route requires multiple permissions in an array, user needs ALL of them
 */
export const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  // Dashboard - accessible to all authenticated users
  [ROUTES.DASHBOARD]: [], // No permission required (all authenticated users)

  // Products
  [ROUTES.PRODUCTS]: 'products.view',
  [ROUTES.PRODUCTS_NEW]: 'products.create',
  [ROUTES.PRODUCTS_EDIT]: 'products.update',
  [ROUTES.PRODUCTS_VIEW]: 'products.view',

  // Categories
  [ROUTES.CATEGORIES]: 'categories.view',
  [ROUTES.CATEGORIES_NEW]: 'categories.create',
  [ROUTES.CATEGORIES_EDIT]: 'categories.update',
  [ROUTES.CATEGORIES_VIEW]: 'categories.view',

  // Transactions
  [ROUTES.POS]: 'transactions.create', // POS requires create transaction permission
  [ROUTES.TRANSACTIONS]: 'transactions.view',
  [ROUTES.TRANSACTIONS_VIEW]: 'transactions.view',

  // Inventory
  [ROUTES.INVENTORY]: 'inventory.view',
  [ROUTES.INVENTORY_MOVEMENTS]: 'inventory.view',
  [ROUTES.INVENTORY_LOW_STOCK]: 'inventory.view',
  [ROUTES.INVENTORY_ADJUST_STOCK]: 'inventory.update',
  [ROUTES.INVENTORY_REORDER_SUGGESTIONS]: 'inventory.view',

  // Purchase Orders
  [ROUTES.PURCHASE_ORDERS]: 'purchase_orders.view',
  [ROUTES.PURCHASE_ORDERS_NEW]: 'purchase_orders.create',
  [ROUTES.PURCHASE_ORDERS_VIEW]: 'purchase_orders.view',
  [ROUTES.PURCHASE_ORDERS_RECEIVE]: 'purchase_orders.update',

  // Suppliers
  [ROUTES.SUPPLIERS]: 'suppliers.view',
  [ROUTES.SUPPLIERS_NEW]: 'suppliers.create',
  [ROUTES.SUPPLIERS_EDIT]: 'suppliers.update',
  '/suppliers/:id': 'suppliers.view', // Supplier details

  // Users/Cashiers - only accessible by main user (check in App.tsx)
  [ROUTES.CASHIERS]: [], // Will be checked in component (main user only)
  [ROUTES.CASHIERS_NEW]: [], // Will be checked in component (main user only)
  [ROUTES.CASHIERS_EDIT]: [], // Will be checked in component (main user only)

  // Reports
  [ROUTES.REPORTS]: 'reports.view',
  [ROUTES.SCHEDULED_REPORTS]: 'reports.view',
  [ROUTES.SCHEDULED_REPORTS_NEW]: 'reports.view',
  [ROUTES.SCHEDULED_REPORTS_EDIT]: 'reports.view',

  // Analytics - typically requires reports permission
  [ROUTES.ANALYTICS]: 'reports.view',

  // Settings - only accessible by main user (check in component)
  [ROUTES.SETTINGS]: [], // Will be checked in component (main user only)

  // Profile - accessible to all authenticated users
  [ROUTES.PROFILE]: [],

  // Notifications - accessible to all authenticated users
  [ROUTES.NOTIFICATIONS]: [],

  // Backup and Logs - typically admin only (check in component)
  [ROUTES.BACKUP]: [], // Will be checked in component (main user only)
  [ROUTES.LOGS]: [], // Will be checked in component (main user only)
  [ROUTES.LOGS_VIEW]: [], // Will be checked in component (main user only)

  // Pricing
  [ROUTES.PRICING_RULES]: 'products.view', // Pricing rules are related to products
  [ROUTES.PRICING_RULES_NEW]: 'products.update',
  [ROUTES.PRICING_RULES_EDIT]: 'products.update',
  [ROUTES.PRICING_RULES_VIEW]: 'products.view',
  [ROUTES.PROMOTIONS]: 'products.view',
  [ROUTES.PROMOTIONS_NEW]: 'products.update',
  [ROUTES.PROMOTIONS_EDIT]: 'products.update',
  [ROUTES.PROMOTIONS_VIEW]: 'products.view',
  [ROUTES.PRICING_HISTORY]: 'products.view',
};

/**
 * Get required permissions for a route path
 * Handles dynamic routes like /products/edit/:id
 */
export function getRoutePermissions(pathname: string): string[] {
  // Try exact match first
  if (ROUTE_PERMISSIONS[pathname]) {
    const perms = ROUTE_PERMISSIONS[pathname];
    if (Array.isArray(perms)) {
      return perms.length === 0 ? [] : perms;
    }
    return perms ? [perms] : [];
  }

  // Try to match dynamic routes
  for (const [route, permissions] of Object.entries(ROUTE_PERMISSIONS)) {
    // Convert route pattern to regex (e.g., /products/edit/:id -> /products/edit/[^/]+)
    // Escape special regex characters first
    const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = escapedRoute.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    
    if (regex.test(pathname)) {
      if (Array.isArray(permissions)) {
        return permissions.length === 0 ? [] : permissions;
      }
      return permissions ? [permissions] : [];
    }
  }

  // No specific permissions required (empty array means accessible to all authenticated users)
  return [];
}

