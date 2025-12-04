import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import { registerLicenseHandlers } from './license.handlers';
import { registerAuthHandlers } from './auth.handlers';
import { registerUserHandlers } from './user.handlers';
import { registerProductHandlers } from './product.handlers';
import { registerCategoryHandlers } from './category.handlers';
import { registerSupplierHandlers } from './supplier.handlers';
import { registerTransactionHandlers } from './transaction.handlers';
import { registerReceiptHandlers } from './receipt.handlers';
import { registerFileHandlers } from './file.handlers';
import { registerInventoryHandlers } from './inventory.handlers';
import { registerPurchaseOrderHandlers } from './purchase-order.handlers';
import { registerPricingHandlers } from './pricing.handlers';
import { registerReportsHandlers } from './reports.handlers';
import { registerReportSchedulerHandlers } from './report-scheduler.handlers';
import { registerNotificationHandlers } from './notifications.handlers';
import { registerSettingsHandlers } from './settings.handlers';
import { registerBackupHandlers } from './backup.handlers';
import { registerCurrencyHandlers } from './currency.handlers';
import { registerAuditLogHandlers } from './audit-log.handlers';
import { registerPermissionHandlers } from './permission.handlers';
import { registerCashDrawerHandlers } from './cash-drawer.handlers';
import { registerSyncHandlers } from './sync.handlers';

/**
 * Register all IPC handlers
 * This file serves as the entry point for all IPC handlers
 */
export function registerIpcHandlers(): void {
  logger.info('Registering IPC handlers...');

  // Test ping handler
  ipcMain.handle('ping', async () => {
    return 'pong - IPC communication working!';
  });

  // Register handlers
  registerLicenseHandlers();
  registerAuthHandlers();
  registerUserHandlers();
  registerProductHandlers();
  registerCategoryHandlers();
  registerSupplierHandlers();
  registerTransactionHandlers();
  registerReceiptHandlers();
  registerFileHandlers();
  registerInventoryHandlers();
  registerPurchaseOrderHandlers();
  registerPricingHandlers();
  registerReportsHandlers();
  registerReportSchedulerHandlers();
  registerNotificationHandlers();
  registerSettingsHandlers();
  registerBackupHandlers();
  registerCurrencyHandlers();
  registerAuditLogHandlers();
  registerPermissionHandlers();
  registerCashDrawerHandlers();
  registerSyncHandlers();

  logger.info('IPC handlers registered');
}

