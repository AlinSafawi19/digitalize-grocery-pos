import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  SupplierContactService,
  CreateSupplierContactInput,
  UpdateSupplierContactInput,
  SupplierContactListOptions,
} from '../services/supplier/supplier-contact.service';

/**
 * Register supplier contact management IPC handlers
 */
export function registerSupplierContactHandlers(): void {
  logger.info('Registering supplier contact management IPC handlers...');

  /**
   * Get contact by ID handler
   * IPC: supplierContact:getById
   */
  ipcMain.handle('supplierContact:getById', async (_event, contactId: number) => {
    try {
      const contact = await SupplierContactService.getById(contactId);
      if (!contact) {
        return {
          success: false,
          error: 'Contact not found',
        };
      }

      return { success: true, contact };
    } catch (error) {
      logger.error('Error in supplierContact:getById handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get contacts list handler
   * IPC: supplierContact:getList
   */
  ipcMain.handle('supplierContact:getList', async (_event, options: SupplierContactListOptions) => {
    try {
      const result = await SupplierContactService.getList(options);
      return {
        success: true,
        contacts: result.contacts,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          totalItems: result.total,
          totalPages: result.totalPages,
          hasNextPage: result.page < result.totalPages,
          hasPreviousPage: result.page > 1,
        },
      };
    } catch (error) {
      logger.error('Error in supplierContact:getList handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get contacts by supplier ID handler
   * IPC: supplierContact:getBySupplierId
   */
  ipcMain.handle('supplierContact:getBySupplierId', async (_event, supplierId: number) => {
    try {
      const contacts = await SupplierContactService.getBySupplierId(supplierId);
      return { success: true, contacts };
    } catch (error) {
      logger.error('Error in supplierContact:getBySupplierId handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Create contact handler
   * IPC: supplierContact:create
   */
  ipcMain.handle('supplierContact:create', async (_event, input: CreateSupplierContactInput, requestedById: number) => {
    try {
      const contact = await SupplierContactService.create(input, requestedById);
      return { success: true, contact };
    } catch (error) {
      logger.error('Error in supplierContact:create handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Update contact handler
   * IPC: supplierContact:update
   */
  ipcMain.handle('supplierContact:update', async (_event, contactId: number, input: UpdateSupplierContactInput, requestedById: number) => {
    try {
      const contact = await SupplierContactService.update(contactId, input, requestedById);
      return { success: true, contact };
    } catch (error) {
      logger.error('Error in supplierContact:update handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Delete contact handler
   * IPC: supplierContact:delete
   */
  ipcMain.handle('supplierContact:delete', async (_event, contactId: number, requestedById: number) => {
    try {
      await SupplierContactService.delete(contactId, requestedById);
      return { success: true };
    } catch (error) {
      logger.error('Error in supplierContact:delete handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Set contact as primary handler
   * IPC: supplierContact:setPrimary
   */
  ipcMain.handle('supplierContact:setPrimary', async (_event, contactId: number, requestedById: number) => {
    try {
      const contact = await SupplierContactService.setPrimary(contactId, requestedById);
      return { success: true, contact };
    } catch (error) {
      logger.error('Error in supplierContact:setPrimary handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });
}

