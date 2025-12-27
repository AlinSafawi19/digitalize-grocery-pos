import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  ReceiptTemplateService,
  CreateReceiptTemplateInput,
  UpdateReceiptTemplateInput,
  ReceiptTemplateListOptions,
} from '../services/receipt/receipt-template.service';

/**
 * Register receipt template management IPC handlers
 */
export function registerReceiptTemplateHandlers(): void {
  logger.info('Registering receipt template management IPC handlers...');

  /**
   * Get template by ID handler
   * IPC: receiptTemplate:getById
   */
  ipcMain.handle('receiptTemplate:getById', async (_event, templateId: number) => {
    try {
      const template = await ReceiptTemplateService.getById(templateId);
      if (!template) {
        return {
          success: false,
          error: 'Template not found',
        };
      }

      return { success: true, template };
    } catch (error) {
      logger.error('Error in receiptTemplate:getById handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get default template handler
   * IPC: receiptTemplate:getDefault
   */
  ipcMain.handle('receiptTemplate:getDefault', async () => {
    try {
      const template = await ReceiptTemplateService.getDefault();
      return { success: true, template };
    } catch (error) {
      logger.error('Error in receiptTemplate:getDefault handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get templates list handler
   * IPC: receiptTemplate:getList
   */
  ipcMain.handle('receiptTemplate:getList', async (_event, options: ReceiptTemplateListOptions) => {
    try {
      const result = await ReceiptTemplateService.getList(options);
      return {
        success: true,
        templates: result.templates,
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
      logger.error('Error in receiptTemplate:getList handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get active templates handler
   * IPC: receiptTemplate:getActiveTemplates
   */
  ipcMain.handle('receiptTemplate:getActiveTemplates', async () => {
    try {
      const templates = await ReceiptTemplateService.getActiveTemplates();
      return { success: true, templates };
    } catch (error) {
      logger.error('Error in receiptTemplate:getActiveTemplates handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Create template handler
   * IPC: receiptTemplate:create
   */
  ipcMain.handle('receiptTemplate:create', async (_event, input: CreateReceiptTemplateInput, requestedById: number) => {
    try {
      const template = await ReceiptTemplateService.create(input, requestedById);
      return { success: true, template };
    } catch (error) {
      logger.error('Error in receiptTemplate:create handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Update template handler
   * IPC: receiptTemplate:update
   */
  ipcMain.handle('receiptTemplate:update', async (_event, templateId: number, input: UpdateReceiptTemplateInput, requestedById: number) => {
    try {
      const template = await ReceiptTemplateService.update(templateId, input, requestedById);
      return { success: true, template };
    } catch (error) {
      logger.error('Error in receiptTemplate:update handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Delete template handler
   * IPC: receiptTemplate:delete
   */
  ipcMain.handle('receiptTemplate:delete', async (_event, templateId: number, requestedById: number) => {
    try {
      await ReceiptTemplateService.delete(templateId, requestedById);
      return { success: true };
    } catch (error) {
      logger.error('Error in receiptTemplate:delete handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Set template as default handler
   * IPC: receiptTemplate:setDefault
   */
  ipcMain.handle('receiptTemplate:setDefault', async (_event, templateId: number, requestedById: number) => {
    try {
      const template = await ReceiptTemplateService.setDefault(templateId, requestedById);
      return { success: true, template };
    } catch (error) {
      logger.error('Error in receiptTemplate:setDefault handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });
}

