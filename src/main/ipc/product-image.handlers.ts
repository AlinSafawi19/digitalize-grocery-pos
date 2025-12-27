import { ipcMain, dialog } from 'electron';
import { logger } from '../utils/logger';
import fs from 'fs-extra';
import path from 'path';
import { IMAGES_DIR } from '../utils/constants';
import {
  ProductImageService,
  UploadImageInput,
  UpdateImageInput,
} from '../services/product-image/product-image.service';

/**
 * Register product image management IPC handlers
 */
export function registerProductImageHandlers(): void {
  logger.info('Registering product image management IPC handlers...');

  /**
   * Get product images handler
   * IPC: productImage:getByProductId
   */
  ipcMain.handle(
    'productImage:getByProductId',
    async (_event, productId: number) => {
      try {
        const images = await ProductImageService.getProductImages(productId);
        return { success: true, images };
      } catch (error) {
        logger.error('Error in productImage:getByProductId handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get image by ID handler
   * IPC: productImage:getById
   */
  ipcMain.handle(
    'productImage:getById',
    async (_event, id: number) => {
      try {
        const image = await ProductImageService.getById(id);
        if (!image) {
          return {
            success: false,
            error: 'Image not found',
          };
        }
        return { success: true, image };
      } catch (error) {
        logger.error('Error in productImage:getById handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Show image file selection dialog
   * IPC: productImage:showSelectDialog
   */
  ipcMain.handle(
    'productImage:showSelectDialog',
    async (_event) => {
      try {
        const result = await dialog.showOpenDialog({
          title: 'Select Product Image',
          filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
            { name: 'All Files', extensions: ['*'] },
          ],
          properties: ['openFile', 'multiSelections'],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, canceled: true };
        }

        return { success: true, filePaths: result.filePaths };
      } catch (error) {
        logger.error('Error in productImage:showSelectDialog handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Copy file to temporary location for processing
   * IPC: productImage:copyToTemp
   */
  ipcMain.handle(
    'productImage:copyToTemp',
    async (_event, sourcePath: string) => {
      try {
        const tempDir = path.join(require('os').tmpdir(), 'digitalize-pos-images');
        await fs.ensureDir(tempDir);

        const fileName = path.basename(sourcePath);
        const tempPath = path.join(tempDir, `${Date.now()}_${fileName}`);

        await fs.copy(sourcePath, tempPath);

        return { success: true, tempPath };
      } catch (error) {
        logger.error('Error in productImage:copyToTemp handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Upload image handler
   * IPC: productImage:upload
   */
  ipcMain.handle(
    'productImage:upload',
    async (_event, input: UploadImageInput, uploadedById: number) => {
      try {
        const result = await ProductImageService.uploadImage(input, uploadedById);
        
        // Clean up temp file after upload
        if (input.filePath && input.filePath.includes('temp')) {
          try {
            await fs.remove(input.filePath);
          } catch (cleanupError) {
            logger.warn('Error cleaning up temp file', { filePath: input.filePath, error: cleanupError });
          }
        }

        return result;
      } catch (error) {
        logger.error('Error in productImage:upload handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update image handler
   * IPC: productImage:update
   */
  ipcMain.handle(
    'productImage:update',
    async (_event, id: number, input: UpdateImageInput, updatedById: number) => {
      try {
        const result = await ProductImageService.updateImage(id, input, updatedById);
        return result;
      } catch (error) {
        logger.error('Error in productImage:update handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete image handler
   * IPC: productImage:delete
   */
  ipcMain.handle(
    'productImage:delete',
    async (_event, id: number, deletedById: number) => {
      try {
        const result = await ProductImageService.deleteImage(id, deletedById);
        return result;
      } catch (error) {
        logger.error('Error in productImage:delete handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Reorder images handler
   * IPC: productImage:reorder
   */
  ipcMain.handle(
    'productImage:reorder',
    async (_event, imageIds: number[], updatedById: number) => {
      try {
        const result = await ProductImageService.reorderImages(imageIds, updatedById);
        return result;
      } catch (error) {
        logger.error('Error in productImage:reorder handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get image file path handler
   * IPC: productImage:getImagePath
   */
  ipcMain.handle(
    'productImage:getImagePath',
    async (_event, relativePath: string) => {
      try {
        const fullPath = ProductImageService.getImagePath(relativePath);
        return { success: true, path: fullPath };
      } catch (error) {
        logger.error('Error in productImage:getImagePath handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get thumbnail path handler
   * IPC: productImage:getThumbnailPath
   */
  ipcMain.handle(
    'productImage:getThumbnailPath',
    async (_event, relativePath: string) => {
      try {
        const fullPath = ProductImageService.getThumbnailPath(relativePath);
        return { success: true, path: fullPath };
      } catch (error) {
        logger.error('Error in productImage:getThumbnailPath handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get image as data URL handler
   * IPC: productImage:getImageDataUrl
   */
  ipcMain.handle(
    'productImage:getImageDataUrl',
    async (_event, relativePath: string) => {
      try {
        const fullPath = path.join(IMAGES_DIR, relativePath);
        
        if (!(await fs.pathExists(fullPath))) {
          return {
            success: false,
            error: 'Image file not found',
          };
        }

        const imageBuffer = await fs.readFile(fullPath);
        const mimeType = relativePath.toLowerCase().endsWith('.png') ? 'image/png' :
                        relativePath.toLowerCase().endsWith('.webp') ? 'image/webp' :
                        relativePath.toLowerCase().endsWith('.gif') ? 'image/gif' :
                        'image/jpeg';
        
        const base64 = imageBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;

        return { success: true, dataUrl };
      } catch (error) {
        logger.error('Error in productImage:getImageDataUrl handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );
}

