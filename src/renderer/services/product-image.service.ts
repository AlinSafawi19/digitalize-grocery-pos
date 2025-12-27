import { ipcRenderer } from 'electron';
import { Product } from './product.service';

// Product Image Types
export interface ProductImage {
  id: number;
  productId: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  thumbnailPath: string | null;
  isPrimary: boolean;
  displayOrder: number;
  altText: string | null;
  uploadedById: number;
  createdAt: Date;
  updatedAt: Date;
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
  filePath: string;
  fileName: string;
  altText?: string;
  isPrimary?: boolean;
}

export interface UpdateImageInput {
  altText?: string;
  isPrimary?: boolean;
  displayOrder?: number;
}

/**
 * Product Image Service
 * Handles product image operations from renderer process
 */
export class ProductImageService {
  /**
   * Get product images
   */
  static async getByProductId(productId: number): Promise<ProductImage[]> {
    try {
      const result = await ipcRenderer.invoke('productImage:getByProductId', productId);
      if (result.success && result.images) {
        return result.images;
      }
      return [];
    } catch (error) {
      console.error('Error getting product images', error);
      return [];
    }
  }

  /**
   * Get image by ID
   */
  static async getById(id: number): Promise<ProductImage | null> {
    try {
      const result = await ipcRenderer.invoke('productImage:getById', id);
      if (result.success && result.image) {
        return result.image;
      }
      return null;
    } catch (error) {
      console.error('Error getting product image by ID', error);
      return null;
    }
  }

  /**
   * Upload image
   */
  static async upload(
    input: UploadImageInput,
    uploadedById: number
  ): Promise<{ success: boolean; image?: ProductImage; error?: string }> {
    try {
      const result = await ipcRenderer.invoke('productImage:upload', input, uploadedById);
      return result;
    } catch (error) {
      console.error('Error uploading product image', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload image',
      };
    }
  }

  /**
   * Update image
   */
  static async update(
    id: number,
    input: UpdateImageInput,
    updatedById: number
  ): Promise<{ success: boolean; image?: ProductImage; error?: string }> {
    try {
      const result = await ipcRenderer.invoke('productImage:update', id, input, updatedById);
      return result;
    } catch (error) {
      console.error('Error updating product image', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update image',
      };
    }
  }

  /**
   * Delete image
   */
  static async delete(
    id: number,
    deletedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await ipcRenderer.invoke('productImage:delete', id, deletedById);
      return result;
    } catch (error) {
      console.error('Error deleting product image', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete image',
      };
    }
  }

  /**
   * Reorder images
   */
  static async reorder(
    imageIds: number[],
    updatedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await ipcRenderer.invoke('productImage:reorder', imageIds, updatedById);
      return result;
    } catch (error) {
      console.error('Error reordering product images', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reorder images',
      };
    }
  }

  /**
   * Get image file path
   */
  static async getImagePath(relativePath: string): Promise<string | null> {
    try {
      const result = await ipcRenderer.invoke('productImage:getImagePath', relativePath);
      if (result.success && result.path) {
        return result.path;
      }
      return null;
    } catch (error) {
      console.error('Error getting image path', error);
      return null;
    }
  }

  /**
   * Get thumbnail path
   */
  static async getThumbnailPath(relativePath: string): Promise<string | null> {
    try {
      const result = await ipcRenderer.invoke('productImage:getThumbnailPath', relativePath);
      if (result.success && result.path) {
        return result.path;
      }
      return null;
    } catch (error) {
      console.error('Error getting thumbnail path', error);
      return null;
    }
  }

  /**
   * Get image as data URL (for Electron compatibility)
   */
  static async getImageDataUrl(relativePath: string): Promise<string | null> {
    try {
      const result = await ipcRenderer.invoke('productImage:getImageDataUrl', relativePath);
      if (result.success && result.dataUrl) {
        return result.dataUrl;
      }
      return null;
    } catch (error) {
      console.error('Error getting image data URL', error);
      return null;
    }
  }

  /**
   * Convert file path to file:// URL for display in img tags
   * @deprecated Use getImageDataUrl instead for better Electron compatibility
   */
  static getImageUrl(filePath: string): string {
    // For Electron, we need to use file:// protocol
    // Replace backslashes with forward slashes for URLs
    const normalizedPath = filePath.replace(/\\/g, '/');
    // Ensure it starts with file://
    if (!normalizedPath.startsWith('file://')) {
      // On Windows, we need to add the drive letter format
      if (normalizedPath.match(/^[A-Z]:/)) {
        return `file:///${normalizedPath}`;
      }
      return `file://${normalizedPath}`;
    }
    return normalizedPath;
  }
}

