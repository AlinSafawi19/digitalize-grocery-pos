import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  BarcodeLabelService,
  CreateBarcodeLabelTemplateInput,
  UpdateBarcodeLabelTemplateInput,
} from '../services/barcode/barcode-label.service';

/**
 * Register barcode label IPC handlers
 */
export function registerBarcodeLabelHandlers(): void {
  logger.info('Registering barcode label IPC handlers...');

  /**
   * Create barcode label template handler
   * IPC: barcodeLabel:createTemplate
   */
  ipcMain.handle(
    'barcodeLabel:createTemplate',
    async (_event, input: CreateBarcodeLabelTemplateInput) => {
      try {
        const template = await BarcodeLabelService.createTemplate(input);
        return {
          success: true,
          data: template,
        };
      } catch (error) {
        logger.error('Error in barcodeLabel:createTemplate handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get template by ID handler
   * IPC: barcodeLabel:getTemplateById
   */
  ipcMain.handle(
    'barcodeLabel:getTemplateById',
    async (_event, id: number) => {
      try {
        const template = await BarcodeLabelService.getTemplateById(id);
        return {
          success: true,
          data: template,
        };
      } catch (error) {
        logger.error('Error in barcodeLabel:getTemplateById handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get templates handler
   * IPC: barcodeLabel:getTemplates
   */
  ipcMain.handle(
    'barcodeLabel:getTemplates',
    async (
      _event,
      options?: {
        isActive?: boolean;
        isDefault?: boolean;
        page?: number;
        pageSize?: number;
      }
    ) => {
      try {
        const result = await BarcodeLabelService.getTemplates(options);
        return {
          success: true,
          data: result.templates,
          pagination: result.pagination,
        };
      } catch (error) {
        logger.error('Error in barcodeLabel:getTemplates handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update template handler
   * IPC: barcodeLabel:updateTemplate
   */
  ipcMain.handle(
    'barcodeLabel:updateTemplate',
    async (_event, id: number, input: UpdateBarcodeLabelTemplateInput) => {
      try {
        const template = await BarcodeLabelService.updateTemplate(id, input);
        return {
          success: true,
          data: template,
        };
      } catch (error) {
        logger.error('Error in barcodeLabel:updateTemplate handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete template handler
   * IPC: barcodeLabel:deleteTemplate
   */
  ipcMain.handle(
    'barcodeLabel:deleteTemplate',
    async (_event, id: number) => {
      try {
        await BarcodeLabelService.deleteTemplate(id);
        return {
          success: true,
        };
      } catch (error) {
        logger.error('Error in barcodeLabel:deleteTemplate handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Set default template handler
   * IPC: barcodeLabel:setDefaultTemplate
   */
  ipcMain.handle(
    'barcodeLabel:setDefaultTemplate',
    async (_event, id: number) => {
      try {
        const template = await BarcodeLabelService.setDefaultTemplate(id);
        return {
          success: true,
          data: template,
        };
      } catch (error) {
        logger.error('Error in barcodeLabel:setDefaultTemplate handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get default template handler
   * IPC: barcodeLabel:getDefaultTemplate
   */
  ipcMain.handle(
    'barcodeLabel:getDefaultTemplate',
    async () => {
      try {
        const template = await BarcodeLabelService.getDefaultTemplate();
        return {
          success: true,
          data: template,
        };
      } catch (error) {
        logger.error('Error in barcodeLabel:getDefaultTemplate handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Generate label HTML handler
   * IPC: barcodeLabel:generateLabelHTML
   */
  ipcMain.handle(
    'barcodeLabel:generateLabelHTML',
    async (_event, templateId: number, productId: number) => {
      try {
        const html = await BarcodeLabelService.generateLabelHTML(templateId, productId);
        return {
          success: true,
          data: html,
        };
      } catch (error) {
        logger.error('Error in barcodeLabel:generateLabelHTML handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  logger.info('Barcode label IPC handlers registered');
}

