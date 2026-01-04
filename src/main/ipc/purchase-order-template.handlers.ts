import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  PurchaseOrderTemplateService,
  CreatePurchaseOrderTemplateInput,
  UpdatePurchaseOrderTemplateInput,
  PurchaseOrderTemplateListOptions,
} from '../services/purchase-order/purchase-order-template.service';

/**
 * Register purchase order template IPC handlers
 */
export function registerPurchaseOrderTemplateHandlers(): void {
  logger.info('Registering purchase order template IPC handlers...');

  /**
   * Create template handler
   * IPC: purchase-order-template:create
   */
  ipcMain.handle(
    'purchase-order-template:create',
    async (_event, input: CreatePurchaseOrderTemplateInput, createdById: number) => {
      try {
        const template = await PurchaseOrderTemplateService.createTemplate(input, createdById);
        return {
          success: true,
          template,
        };
      } catch (error) {
        logger.error('Error in purchase-order-template:create handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update template handler
   * IPC: purchase-order-template:update
   */
  ipcMain.handle(
    'purchase-order-template:update',
    async (
      _event,
      templateId: number,
      input: UpdatePurchaseOrderTemplateInput,
      updatedById: number
    ) => {
      try {
        const template = await PurchaseOrderTemplateService.updateTemplate(
          templateId,
          input,
          updatedById
        );
        return {
          success: true,
          template,
        };
      } catch (error) {
        logger.error('Error in purchase-order-template:update handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete template handler
   * IPC: purchase-order-template:delete
   */
  ipcMain.handle(
    'purchase-order-template:delete',
    async (_event, templateId: number, deletedById: number) => {
      try {
        await PurchaseOrderTemplateService.deleteTemplate(templateId, deletedById);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in purchase-order-template:delete handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get template by ID handler
   * IPC: purchase-order-template:getById
   */
  ipcMain.handle('purchase-order-template:getById', async (_event, templateId: number) => {
    try {
      const template = await PurchaseOrderTemplateService.getTemplateById(templateId);
      if (!template) {
        return {
          success: false,
          error: 'Template not found',
        };
      }
      return {
        success: true,
        template,
      };
    } catch (error) {
      logger.error('Error in purchase-order-template:getById handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get templates list handler
   * IPC: purchase-order-template:getList
   */
  ipcMain.handle(
    'purchase-order-template:getList',
    async (_event, options: PurchaseOrderTemplateListOptions) => {
      try {
        const result = await PurchaseOrderTemplateService.getTemplates(options);
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        logger.error('Error in purchase-order-template:getList handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Create order from template handler
   * IPC: purchase-order-template:createOrderFromTemplate
   */
  ipcMain.handle(
    'purchase-order-template:createOrderFromTemplate',
    async (
      _event,
      templateId: number,
      createdById: number,
      expectedDate: Date | null | undefined
    ) => {
      try {
        const result = await PurchaseOrderTemplateService.createOrderFromTemplate(
          templateId,
          createdById,
          expectedDate
        );
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        logger.error('Error in purchase-order-template:createOrderFromTemplate handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );
}

