import { ipcMain, dialog } from 'electron';
import { logger } from '../utils/logger';
import fs from 'fs-extra';
import path from 'path';
import {
  SupplierDocumentService,
  UploadDocumentInput,
  UpdateDocumentInput,
  SupplierDocumentListOptions,
} from '../services/supplier/supplier-document.service';

/**
 * Register supplier document management IPC handlers
 */
export function registerSupplierDocumentHandlers(): void {
  logger.info('Registering supplier document management IPC handlers...');

  /**
   * Get document by ID handler
   * IPC: supplierDocument:getById
   */
  ipcMain.handle('supplierDocument:getById', async (_event, documentId: number) => {
    try {
      const document = await SupplierDocumentService.getById(documentId);
      if (!document) {
        return {
          success: false,
          error: 'Document not found',
        };
      }

      return { success: true, document };
    } catch (error) {
      logger.error('Error in supplierDocument:getById handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get documents list handler
   * IPC: supplierDocument:getList
   */
  ipcMain.handle('supplierDocument:getList', async (_event, options: SupplierDocumentListOptions) => {
    try {
      const result = await SupplierDocumentService.getList(options);
      return {
        success: true,
        documents: result.documents,
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
      logger.error('Error in supplierDocument:getList handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get documents by supplier ID handler
   * IPC: supplierDocument:getBySupplierId
   */
  ipcMain.handle('supplierDocument:getBySupplierId', async (_event, supplierId: number) => {
    try {
      const documents = await SupplierDocumentService.getBySupplierId(supplierId);
      return { success: true, documents };
    } catch (error) {
      logger.error('Error in supplierDocument:getBySupplierId handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get expired documents handler
   * IPC: supplierDocument:getExpired
   */
  ipcMain.handle('supplierDocument:getExpired', async () => {
    try {
      const documents = await SupplierDocumentService.getExpiredDocuments();
      return { success: true, documents };
    } catch (error) {
      logger.error('Error in supplierDocument:getExpired handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get documents expiring soon handler
   * IPC: supplierDocument:getExpiringSoon
   */
  ipcMain.handle('supplierDocument:getExpiringSoon', async () => {
    try {
      const documents = await SupplierDocumentService.getExpiringSoonDocuments();
      return { success: true, documents };
    } catch (error) {
      logger.error('Error in supplierDocument:getExpiringSoon handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Show document file selection dialog
   * IPC: supplierDocument:showSelectDialog
   */
  ipcMain.handle('supplierDocument:showSelectDialog', async (_event) => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Document',
        filters: [
          { name: 'PDF', extensions: ['pdf'] },
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] },
          { name: 'Word Documents', extensions: ['doc', 'docx'] },
          { name: 'Excel Spreadsheets', extensions: ['xls', 'xlsx'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      return { success: true, filePath: result.filePaths[0] };
    } catch (error) {
      logger.error('Error in supplierDocument:showSelectDialog handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Copy file to temporary location for processing
   * IPC: supplierDocument:copyToTemp
   */
  ipcMain.handle('supplierDocument:copyToTemp', async (_event, sourcePath: string) => {
    try {
      const tempDir = path.join(require('os').tmpdir(), 'digitalize-pos-documents');
      await fs.ensureDir(tempDir);

      const fileName = path.basename(sourcePath);
      const tempPath = path.join(tempDir, `${Date.now()}_${fileName}`);

      await fs.copy(sourcePath, tempPath);

      return { success: true, tempPath };
    } catch (error) {
      logger.error('Error in supplierDocument:copyToTemp handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Upload document handler
   * IPC: supplierDocument:upload
   */
  ipcMain.handle('supplierDocument:upload', async (_event, input: UploadDocumentInput, uploadedById: number) => {
    try {
      const document = await SupplierDocumentService.uploadDocument(input, uploadedById);
      
      // Clean up temp file after upload
      if (input.filePath && input.filePath.includes('temp')) {
        try {
          await fs.remove(input.filePath);
        } catch (cleanupError) {
          logger.warn('Error cleaning up temp file', { filePath: input.filePath, error: cleanupError });
        }
      }

      return { success: true, document };
    } catch (error) {
      logger.error('Error in supplierDocument:upload handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Update document handler
   * IPC: supplierDocument:update
   */
  ipcMain.handle('supplierDocument:update', async (_event, documentId: number, input: UpdateDocumentInput, updatedById: number) => {
    try {
      const document = await SupplierDocumentService.update(documentId, input, updatedById);
      return { success: true, document };
    } catch (error) {
      logger.error('Error in supplierDocument:update handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Delete document handler
   * IPC: supplierDocument:delete
   */
  ipcMain.handle('supplierDocument:delete', async (_event, documentId: number, deletedById: number) => {
    try {
      await SupplierDocumentService.delete(documentId, deletedById);
      return { success: true };
    } catch (error) {
      logger.error('Error in supplierDocument:delete handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get document file path for serving/downloading
   * IPC: supplierDocument:getFilePath
   */
  ipcMain.handle('supplierDocument:getFilePath', async (_event, documentId: number) => {
    try {
      const filePath = await SupplierDocumentService.getDocumentFilePath(documentId);
      if (!filePath) {
        return {
          success: false,
          error: 'Document not found',
        };
      }
      return { success: true, filePath };
    } catch (error) {
      logger.error('Error in supplierDocument:getFilePath handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get document categories
   * IPC: supplierDocument:getCategories
   */
  ipcMain.handle('supplierDocument:getCategories', async () => {
    try {
      const categories = SupplierDocumentService.getCategories();
      return { success: true, categories };
    } catch (error) {
      logger.error('Error in supplierDocument:getCategories handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });
}

