import { ProductImage, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';
import { IMAGES_DIR } from '../../utils/constants';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import { randomBytes } from 'crypto';

export interface ProductImageWithRelations extends ProductImage {
  product: {
    id: number;
    name: string;
    code: string | null;
  };
  uploader: {
    id: number;
    username: string;
  };
}

export interface UploadImageInput {
  productId: number;
  filePath: string; // Temporary file path from upload
  fileName: string;
  altText?: string;
  isPrimary?: boolean;
}

export interface UpdateImageInput {
  altText?: string;
  isPrimary?: boolean;
  displayOrder?: number;
}

export interface ProductImageListOptions {
  productId?: number;
  includeInactive?: boolean;
}

// Image processing constants
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DIMENSION = 2048; // Max width or height
const THUMBNAIL_SIZE = 300; // Thumbnail width/height
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Product Image Service
 * Handles product image upload, storage, optimization, and management
 */
export class ProductImageService {
  /**
   * Ensure images directory exists
   */
  private static async ensureImagesDirectory(): Promise<void> {
    await fs.ensureDir(IMAGES_DIR);
    await fs.ensureDir(path.join(IMAGES_DIR, 'thumbnails'));
  }

  /**
   * Validate image file
   */
  private static async validateImageFile(filePath: string): Promise<{
    valid: boolean;
    error?: string;
    metadata?: sharp.Metadata;
  }> {
    try {
      const stats = await fs.stat(filePath);
      
      // Check file size
      if (stats.size > MAX_IMAGE_SIZE) {
        return {
          valid: false,
          error: `Image file is too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
        };
      }

      // Check if file exists
      if (!(await fs.pathExists(filePath))) {
        return {
          valid: false,
          error: 'Image file not found',
        };
      }

      // Get image metadata
      const metadata = await sharp(filePath).metadata();
      
      // Check MIME type
      if (metadata.format && !ALLOWED_MIME_TYPES.includes(`image/${metadata.format}`)) {
        return {
          valid: false,
          error: `Unsupported image format. Supported formats: JPEG, PNG, WebP, GIF`,
        };
      }

      // Check dimensions
      if (metadata.width && metadata.width > MAX_DIMENSION) {
        return {
          valid: false,
          error: `Image width exceeds maximum of ${MAX_DIMENSION}px`,
        };
      }

      if (metadata.height && metadata.height > MAX_DIMENSION) {
        return {
          valid: false,
          error: `Image height exceeds maximum of ${MAX_DIMENSION}px`,
        };
      }

      return {
        valid: true,
        metadata,
      };
    } catch (error) {
      logger.error('Error validating image file', { filePath, error });
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to validate image',
      };
    }
  }

  /**
   * Process and save image
   */
  private static async processAndSaveImage(
    sourcePath: string,
    productId: number,
    fileName: string
  ): Promise<{ imagePath: string; thumbnailPath: string; width: number; height: number; fileSize: number }> {
    await this.ensureImagesDirectory();

    // Generate unique filename
    const fileExt = path.extname(fileName);
    const uniqueId = randomBytes(16).toString('hex');
    const uniqueFileName = `${uniqueId}${fileExt}`;
    const imagePath = path.join(IMAGES_DIR, uniqueFileName);
    const thumbnailPath = path.join(IMAGES_DIR, 'thumbnails', `thumb_${uniqueFileName}`);

    // Get original metadata
    const metadata = await sharp(sourcePath).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // Process and save main image (resize if needed, optimize)
    const image = sharp(sourcePath);
    
    // Resize if too large
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      await image
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(imagePath);
    } else {
      // Just optimize without resizing
      await image
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(imagePath);
    }

    // Generate thumbnail
    await sharp(sourcePath)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    const imageStats = await fs.stat(imagePath);

    return {
      imagePath: uniqueFileName, // Store relative path
      thumbnailPath: `thumbnails/thumb_${uniqueFileName}`, // Store relative path
      width,
      height,
      fileSize: imageStats.size,
    };
  }

  /**
   * Upload and save product image
   */
  static async uploadImage(
    input: UploadImageInput,
    uploadedById: number
  ): Promise<{ success: boolean; image?: ProductImageWithRelations; error?: string }> {
    try {
      const prisma = databaseService.getClient();
      const { productId, filePath, fileName, altText, isPrimary = false } = input;

      // Validate product exists
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      // Validate image file
      const validation = await this.validateImageFile(filePath);
      if (!validation.valid || !validation.metadata) {
        return {
          success: false,
          error: validation.error || 'Invalid image file',
        };
      }

      // Process and save image
      const imageData = await this.processAndSaveImage(
        filePath,
        productId,
        fileName
      );

      // Get current max display order for this product
      const maxOrder = await prisma.productImage.aggregate({
        where: { productId },
        _max: { displayOrder: true },
      });

      const nextDisplayOrder = (maxOrder._max.displayOrder || 0) + 1;

      // If setting as primary, unset other primary images for this product
      if (isPrimary) {
        await prisma.productImage.updateMany({
          where: {
            productId,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      // Create image record
      const image = await prisma.productImage.create({
        data: {
          productId,
          fileName,
          filePath: imageData.imagePath,
          fileSize: imageData.fileSize,
          mimeType: `image/${validation.metadata.format || 'jpeg'}`,
          width: imageData.width,
          height: imageData.height,
          thumbnailPath: imageData.thumbnailPath,
          isPrimary,
          displayOrder: nextDisplayOrder,
          altText: altText || undefined,
          uploadedById,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          uploader: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      // Log audit
      await AuditLogService.log({
        userId: uploadedById,
        action: 'create',
        entity: 'product_image',
        entityId: image.id,
        details: JSON.stringify({
          productId,
          fileName,
          isPrimary,
        }),
      });

      logger.info('Product image uploaded', {
        imageId: image.id,
        productId,
        fileName,
      });

      return {
        success: true,
        image: image as ProductImageWithRelations,
      };
    } catch (error) {
      logger.error('Error uploading product image', { input, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get product images
   */
  static async getProductImages(
    productId: number
  ): Promise<ProductImageWithRelations[]> {
    try {
      const prisma = databaseService.getClient();
      const images = await prisma.productImage.findMany({
        where: { productId },
        orderBy: [
          { isPrimary: 'desc' },
          { displayOrder: 'asc' },
          { createdAt: 'asc' },
        ],
        include: {
          product: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          uploader: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return images as ProductImageWithRelations[];
    } catch (error) {
      logger.error('Error getting product images', { productId, error });
      throw error;
    }
  }

  /**
   * Get image by ID
   */
  static async getById(id: number): Promise<ProductImageWithRelations | null> {
    try {
      const prisma = databaseService.getClient();
      const image = await prisma.productImage.findUnique({
        where: { id },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          uploader: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return image as ProductImageWithRelations | null;
    } catch (error) {
      logger.error('Error getting product image by ID', { id, error });
      throw error;
    }
  }

  /**
   * Update image
   */
  static async updateImage(
    id: number,
    input: UpdateImageInput,
    updatedById: number
  ): Promise<{ success: boolean; image?: ProductImageWithRelations; error?: string }> {
    try {
      const prisma = databaseService.getClient();
      const { isPrimary, displayOrder, altText } = input;

      // Get existing image
      const existingImage = await prisma.productImage.findUnique({
        where: { id },
      });

      if (!existingImage) {
        return {
          success: false,
          error: 'Image not found',
        };
      }

      // If setting as primary, unset other primary images for this product
      if (isPrimary && !existingImage.isPrimary) {
        await prisma.productImage.updateMany({
          where: {
            productId: existingImage.productId,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      // Update image
      const updateData: Prisma.ProductImageUpdateInput = {};
      if (altText !== undefined) updateData.altText = altText;
      if (isPrimary !== undefined) updateData.isPrimary = isPrimary;
      if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

      const image = await prisma.productImage.update({
        where: { id },
        data: updateData,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          uploader: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      // Log audit
      await AuditLogService.log({
        userId: updatedById,
        action: 'update',
        entity: 'product_image',
        entityId: id,
        details: JSON.stringify({
          changes: updateData,
        }),
      });

      logger.info('Product image updated', { imageId: id, updateData });
      return {
        success: true,
        image: image as ProductImageWithRelations,
      };
    } catch (error) {
      logger.error('Error updating product image', { id, input, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete image
   */
  static async deleteImage(
    id: number,
    deletedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const prisma = databaseService.getClient();

      // Get existing image
      const existingImage = await prisma.productImage.findUnique({
        where: { id },
      });

      if (!existingImage) {
        return {
          success: false,
          error: 'Image not found',
        };
      }

      // Delete image files
      try {
        const imagePath = path.join(IMAGES_DIR, existingImage.filePath);
        const thumbnailPath = path.join(IMAGES_DIR, existingImage.thumbnailPath || '');

        if (await fs.pathExists(imagePath)) {
          await fs.remove(imagePath);
        }

        if (existingImage.thumbnailPath && (await fs.pathExists(thumbnailPath))) {
          await fs.remove(thumbnailPath);
        }
      } catch (fileError) {
        logger.warn('Error deleting image files', { id, error: fileError });
        // Continue with database deletion even if file deletion fails
      }

      // Delete database record
      await prisma.productImage.delete({
        where: { id },
      });

      // Log audit
      await AuditLogService.log({
        userId: deletedById,
        action: 'delete',
        entity: 'product_image',
        entityId: id,
        details: JSON.stringify({
          productId: existingImage.productId,
          fileName: existingImage.fileName,
        }),
      });

      logger.info('Product image deleted', { imageId: id });
      return {
        success: true,
      };
    } catch (error) {
      logger.error('Error deleting product image', { id, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Reorder images
   */
  static async reorderImages(
    imageIds: number[],
    updatedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const prisma = databaseService.getClient();

      // Update display order for each image
      await prisma.$transaction(
        imageIds.map((imageId, index) =>
          prisma.productImage.update({
            where: { id: imageId },
            data: { displayOrder: index + 1 },
          })
        )
      );

      // Log audit
      await AuditLogService.log({
        userId: updatedById,
        action: 'update',
        entity: 'product_image',
        entityId: 0,
        details: JSON.stringify({
          action: 'reorder',
          imageIds,
        }),
      });

      logger.info('Product images reordered', { imageIds });
      return {
        success: true,
      };
    } catch (error) {
      logger.error('Error reordering product images', { imageIds, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get image file path (full path for serving)
   */
  static getImagePath(relativePath: string): string {
    return path.join(IMAGES_DIR, relativePath);
  }

  /**
   * Get thumbnail path (full path for serving)
   */
  static getThumbnailPath(relativePath: string): string {
    return path.join(IMAGES_DIR, relativePath);
  }
}

