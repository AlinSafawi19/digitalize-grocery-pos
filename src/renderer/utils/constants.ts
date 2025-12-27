// Frontend constants

export const APP_NAME = 'digitalize-grocery-pos';
export const APP_VERSION = '1.0.0';

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Date formats
export const DATE_FORMAT = 'yyyy-MM-dd';
export const DATETIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';
export const TIME_FORMAT = 'HH:mm:ss';

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  LICENSE_ACTIVATION: '/license-activation',
  DASHBOARD: '/dashboard',
  POS: '/pos',
  PRODUCTS: '/products',
  PRODUCTS_NEW: '/products/new',
  PRODUCTS_EDIT: '/products/edit/:id',
  PRODUCTS_VIEW: '/products/view/:id',
  CATEGORIES: '/categories',
  CATEGORIES_NEW: '/categories/new',
  CATEGORIES_EDIT: '/categories/edit/:id',
  CATEGORIES_VIEW: '/categories/view/:id',
  SUPPLIERS: '/suppliers',
  SUPPLIERS_NEW: '/suppliers/new',
  SUPPLIERS_EDIT: '/suppliers/edit/:id',
  INVENTORY: '/inventory',
  INVENTORY_MOVEMENTS: '/inventory/movements',
  INVENTORY_LOW_STOCK: '/inventory/low-stock',
  INVENTORY_ADJUST_STOCK: '/inventory/adjust/:productId',
  INVENTORY_REORDER_SUGGESTIONS: '/inventory/reorder-suggestions',
  INVENTORY_BATCH_SCAN: '/inventory/batch-scan',
  PURCHASE_ORDERS: '/purchase-orders',
  PURCHASE_ORDERS_NEW: '/purchase-orders/new',
  PURCHASE_ORDERS_VIEW: '/purchase-orders/:id',
  PURCHASE_ORDERS_RECEIVE: '/purchase-orders/:id/receive',
  PURCHASE_ORDER_TEMPLATES: '/purchase-orders/templates',
  PURCHASE_ORDER_TEMPLATES_NEW: '/purchase-orders/templates/new',
  PURCHASE_ORDER_TEMPLATES_EDIT: '/purchase-orders/templates/edit/:id',
  PURCHASE_ORDER_TEMPLATES_VIEW: '/purchase-orders/templates/:id',
  STOCK_TRANSFERS: '/stock-transfers',
  STOCK_TRANSFERS_NEW: '/stock-transfers/new',
  STOCK_TRANSFERS_VIEW: '/stock-transfers/:id',
  PRICING_RULES: '/pricing-rules',
  PRICING_RULES_NEW: '/pricing-rules/new',
  PRICING_RULES_EDIT: '/pricing-rules/edit/:id',
  PRICING_RULES_VIEW: '/pricing-rules/:id',
  PROMOTIONS: '/promotions',
  PROMOTIONS_NEW: '/promotions/new',
  PROMOTIONS_EDIT: '/promotions/edit/:id',
  PROMOTIONS_VIEW: '/promotions/:id',
  PRICING_HISTORY: '/pricing/history',
  TRANSACTIONS: '/transactions',
  TRANSACTIONS_VIEW: '/transactions/view/:id',
  REPORTS: '/reports',
  SCHEDULED_REPORTS: '/reports/scheduled',
  SCHEDULED_REPORTS_NEW: '/reports/scheduled/new',
  SCHEDULED_REPORTS_EDIT: '/reports/scheduled/edit/:id',
  ANALYTICS: '/analytics',
  NOTIFICATIONS: '/notifications',
  SETTINGS: '/settings',
  PROFILE: '/profile',
  LICENSE: '/license',
  LICENSE_EXPIRED: '/license-expired',
  ACCESS_DENIED: '/access-denied',
  BACKUP: '/backup',
  LOGS: '/logs',
  LOGS_VIEW: '/logs/view/:id',
  CASHIERS: '/cashiers',
  CASHIERS_NEW: '/cashiers/new',
  CASHIERS_EDIT: '/cashiers/edit/:id',
} as const;

