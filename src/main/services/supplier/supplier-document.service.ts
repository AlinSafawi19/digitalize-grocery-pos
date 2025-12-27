import { SupplierDocument, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';
import { SUPPLIER_DOCUMENTS_DIR } from '../../utils/constants';
import fs from 'fs-extra';
import path from 'path';
import { randomBytes } from 'crypto';

export interface SupplierDocumentWithRelations extends SupplierDocument {
  supplier: {
    id: number;
    name: string;
  };
}

export interface UploadDocumentInput {
  supplierId: number;
  filePath: string; // Temporary file path from upload
  fileName: string;
  category?: string;
  description?: string;
  expiryDate?: Date | null;
}

export interface UpdateDocumentInput {
  category?: string;
  description?: string;
  expiryDate?: Date | null;
}

export interface SupplierDocumentListOptions {
  supplierId?: number;
  category?: string;
  expiredOnly?: boolean;
  expiringSoon?: boolean; // Documents expiring within 30 days
  page?: number;
  pageSize?: number;
  search?: string;
}

// Document processing constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const DOCUMENT_CATEGORIES = [
  'contract',
  'invoice',
  'certificate',
  'license',
  'agreement',
  'other',
];

/**
 * Supplier Document Service
 * Handles supplier document upload, storage, and management
 */
export class SupplierDocumentService {
  /**
   * Ensure documents directory exists
   */
  private static async ensureDocumentsDirectory(): Promise<void> {
    await fs.ensureDir(SUPPLIER_DOCUMENTS_DIR);
  }

  /**
   * Validate document file
   */
  private static async validateDocumentFile(filePath: string): Promise<{
    valid: boolean;
    error?: string;
    mimeType?: string;
    size?: number;
  }> {
    try {
      const stats = await fs.stat(filePath);
      
      // Check file size
      if (stats.size > MAX_FILE_SIZE) {
        return {
          valid: false,
          error: `File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        };
      }

      // Check if file exists
      if (!(await fs.pathExists(filePath))) {
        return {
          valid: false,
          error: 'File not found',
        };
      }

      // Get file extension to determine MIME type
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypeMap: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };

      const mimeType = mimeTypeMap[ext];
      if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
        return {
          valid: false,
          error: `Unsupported file type. Supported types: PDF, Images (JPEG, PNG), Word, Excel`,
        };
      }

      return {
        valid: true,
        mimeType,
        size: stats.size,
      };
    } catch (error) {
      logger.error('Error validating document file', { filePath, error });
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Error validating file',
      };
    }
  }

  /**
   * Generate unique file name
   */
  private static generateUniqueFileName(originalFileName: string): string {
    const ext = path.extname(originalFileName);
    const baseName = path.basename(originalFileName, ext);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const randomSuffix = randomBytes(8).toString('hex');
    const timestamp = Date.now();
    return `${sanitizedBaseName}_${timestamp}_${randomSuffix}${ext}`;
  }

  /**
   * Get document by ID
   */
  static async getById(id: number): Promise<SupplierDocument | null> {
    try {
      const prisma = databaseService.getClient();
      const document = await prisma.supplierDocument.findUnique({
        where: { id },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      return document;
    } catch (error) {
      logger.error('Error getting supplier document by ID', { id, error });
      throw error;
    }
  }

  /**
   * Get documents list with pagination and filtering
   */
  static async getList(options: SupplierDocumentListOptions = {}): Promise<{
    documents: SupplierDocument[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const {
        supplierId,
        category,
        expiredOnly,
        expiringSoon,
        page = 1,
        pageSize = 20,
        search,
      } = options;

      const skip = (page - 1) * pageSize;

      // Build where clause
      const where: Prisma.SupplierDocumentWhereInput = {};
      if (supplierId) {
        where.supplierId = supplierId;
      }
      if (category) {
        where.category = category;
      }
      if (expiredOnly) {
        where.expiryDate = {
          lt: new Date(),
        };
      }
      if (expiringSoon) {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        where.expiryDate = {
          gte: new Date(),
          lte: thirtyDaysFromNow,
        };
      }
      if (search) {
        where.OR = [
          { fileName: { contains: search } },
          { description: { contains: search } },
          { category: { contains: search } },
        ];
      }

      // Get documents and total count
      const [documents, total] = await Promise.all([
        prisma.supplierDocument.findMany({
          where,
          orderBy: { uploadedAt: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.supplierDocument.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        documents,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting supplier documents list', { options, error });
      throw error;
    }
  }

  /**
   * Get all documents for a supplier
   */
  static async getBySupplierId(supplierId: number): Promise<SupplierDocument[]> {
    try {
      const prisma = databaseService.getClient();
      const documents = await prisma.supplierDocument.findMany({
        where: { supplierId },
        orderBy: { uploadedAt: 'desc' },
      });
      return documents;
    } catch (error) {
      logger.error('Error getting documents by supplier ID', { supplierId, error });
      throw error;
    }
  }

  /**
   * Get expired documents
   */
  static async getExpiredDocuments(): Promise<SupplierDocument[]> {
    try {
      const prisma = databaseService.getClient();
      const documents = await prisma.supplierDocument.findMany({
        where: {
          expiryDate: {
            lt: new Date(),
          },
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { expiryDate: 'asc' },
      });
      return documents;
    } catch (error) {
      logger.error('Error getting expired documents', { error });
      throw error;
    }
  }

  /**
   * Get documents expiring soon (within 30 days)
   */
  static async getExpiringSoonDocuments(): Promise<SupplierDocument[]> {
    try {
      const prisma = databaseService.getClient();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      const documents = await prisma.supplierDocument.findMany({
        where: {
          expiryDate: {
            gte: new Date(),
            lte: thirtyDaysFromNow,
          },
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { expiryDate: 'asc' },
      });
      return documents;
    } catch (error) {
      logger.error('Error getting expiring soon documents', { error });
      throw error;
    }
  }

  /**
   * Upload document
   */
  static async uploadDocument(input: UploadDocumentInput, userId: number): Promise<SupplierDocument> {
    try {
      const prisma = databaseService.getClient();

      // Validate required fields
      if (!input.supplierId) {
        throw new Error('Supplier ID is required');
      }

      // Check if supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id: input.supplierId },
      });
      if (!supplier) {
        throw new Error(`Supplier with ID ${input.supplierId} not found`);
      }

      // Validate file
      const validation = await this.validateDocumentFile(input.filePath);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid file');
      }

      // Ensure documents directory exists
      await this.ensureDocumentsDirectory();

      // Generate unique file name and path
      const uniqueFileName = this.generateUniqueFileName(input.fileName);
      const supplierDir = path.join(SUPPLIER_DOCUMENTS_DIR, `supplier_${input.supplierId}`);
      await fs.ensureDir(supplierDir);
      const finalFilePath = path.join(supplierDir, uniqueFileName);

      // Copy file to final location
      await fs.copy(input.filePath, finalFilePath);

      // Get relative path for storage
      const relativePath = path.relative(SUPPLIER_DOCUMENTS_DIR, finalFilePath);

      // Create document record
      const document = await prisma.supplierDocument.create({
        data: {
          supplierId: input.supplierId,
          fileName: input.fileName,
          filePath: relativePath,
          category: input.category || 'other',
          mimeType: validation.mimeType || null,
          size: validation.size || null,
          expiryDate: input.expiryDate || null,
          description: input.description || null,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'create',
        entity: 'supplier_document',
        entityId: document.id,
        details: JSON.stringify({ fileName: document.fileName, supplierId: document.supplierId }),
      });

      logger.info('Supplier document uploaded successfully', { id: document.id, fileName: document.fileName });
      return document;
    } catch (error) {
      logger.error('Error uploading supplier document', { input, error });
      throw error;
    }
  }

  /**
   * Update document
   */
  static async update(
    id: number,
    input: UpdateDocumentInput,
    userId: number
  ): Promise<SupplierDocument> {
    try {
      const prisma = databaseService.getClient();

      // Check if document exists
      const existing = await prisma.supplierDocument.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Document with ID ${id} not found`);
      }

      // Update document
      const document = await prisma.supplierDocument.update({
        where: { id },
        data: {
          ...(input.category !== undefined && { category: input.category }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.expiryDate !== undefined && { expiryDate: input.expiryDate }),
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'update',
        entity: 'supplier_document',
        entityId: document.id,
        details: JSON.stringify({ fileName: document.fileName, supplierId: document.supplierId }),
      });

      logger.info('Supplier document updated successfully', { id: document.id, fileName: document.fileName });
      return document;
    } catch (error) {
      logger.error('Error updating supplier document', { id, input, error });
      throw error;
    }
  }

  /**
   * Delete document
   */
  static async delete(id: number, userId: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      // Check if document exists
      const document = await prisma.supplierDocument.findUnique({
        where: { id },
      });
      if (!document) {
        throw new Error(`Document with ID ${id} not found`);
      }

      // Delete file from filesystem
      const fullPath = path.join(SUPPLIER_DOCUMENTS_DIR, document.filePath);
      if (await fs.pathExists(fullPath)) {
        await fs.remove(fullPath);
      }

      // Delete document record
      await prisma.supplierDocument.delete({
        where: { id },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'delete',
        entity: 'supplier_document',
        entityId: id,
        details: JSON.stringify({ fileName: document.fileName, supplierId: document.supplierId }),
      });

      logger.info('Supplier document deleted successfully', { id, fileName: document.fileName });
    } catch (error) {
      logger.error('Error deleting supplier document', { id, error });
      throw error;
    }
  }

  /**
   * Get document file path for serving
   */
  static async getDocumentFilePath(id: number): Promise<string | null> {
    try {
      const prisma = databaseService.getClient();
      const document = await prisma.supplierDocument.findUnique({
        where: { id },
        select: { filePath: true },
      });
      if (!document) {
        return null;
      }
      return path.join(SUPPLIER_DOCUMENTS_DIR, document.filePath);
    } catch (error) {
      logger.error('Error getting document file path', { id, error });
      throw error;
    }
  }

  /**
   * Get document categories
   */
  static getCategories(): string[] {
    return DOCUMENT_CATEGORIES;
  }
}

