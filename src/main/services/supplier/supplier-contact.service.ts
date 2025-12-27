import { SupplierContact, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';

export interface CreateSupplierContactInput {
  supplierId: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

export interface UpdateSupplierContactInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

export interface SupplierContactListOptions {
  supplierId?: number;
  page?: number;
  pageSize?: number;
  search?: string;
}

/**
 * Supplier Contact Service
 * Handles supplier contact person operations
 */
export class SupplierContactService {
  /**
   * Get contact by ID
   */
  static async getById(id: number): Promise<SupplierContact | null> {
    try {
      const prisma = databaseService.getClient();
      const contact = await prisma.supplierContact.findUnique({
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
      return contact;
    } catch (error) {
      logger.error('Error getting supplier contact by ID', { id, error });
      throw error;
    }
  }

  /**
   * Get contacts list with pagination and filtering
   */
  static async getList(options: SupplierContactListOptions = {}): Promise<{
    contacts: SupplierContact[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const {
        supplierId,
        page = 1,
        pageSize = 20,
        search,
      } = options;

      const skip = (page - 1) * pageSize;

      // Build where clause
      const where: Prisma.SupplierContactWhereInput = {};
      if (supplierId) {
        where.supplierId = supplierId;
      }
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
          { role: { contains: search } },
        ];
      }

      // Get contacts and total count
      const [contacts, total] = await Promise.all([
        prisma.supplierContact.findMany({
          where,
          orderBy: [
            { isPrimary: 'desc' },
            { name: 'asc' },
          ],
          skip,
          take: pageSize,
        }),
        prisma.supplierContact.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        contacts,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting supplier contacts list', { options, error });
      throw error;
    }
  }

  /**
   * Get all contacts for a supplier
   */
  static async getBySupplierId(supplierId: number): Promise<SupplierContact[]> {
    try {
      const prisma = databaseService.getClient();
      const contacts = await prisma.supplierContact.findMany({
        where: { supplierId },
        orderBy: [
          { isPrimary: 'desc' },
          { name: 'asc' },
        ],
      });
      return contacts;
    } catch (error) {
      logger.error('Error getting contacts by supplier ID', { supplierId, error });
      throw error;
    }
  }

  /**
   * Create contact
   */
  static async create(input: CreateSupplierContactInput, userId: number): Promise<SupplierContact> {
    try {
      const prisma = databaseService.getClient();

      // Validate required fields
      if (!input.name || input.name.trim() === '') {
        throw new Error('Contact name is required');
      }

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

      // If setting as primary, unset other primary contacts for this supplier
      if (input.isPrimary) {
        await prisma.supplierContact.updateMany({
          where: {
            supplierId: input.supplierId,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      // Create contact
      const contact = await prisma.supplierContact.create({
        data: {
          supplierId: input.supplierId,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          role: input.role || null,
          isPrimary: input.isPrimary || false,
          notes: input.notes || null,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'create',
        entity: 'supplier_contact',
        entityId: contact.id,
        details: JSON.stringify({ name: contact.name, supplierId: contact.supplierId }),
      });

      logger.info('Supplier contact created successfully', { id: contact.id, name: contact.name });
      return contact;
    } catch (error) {
      logger.error('Error creating supplier contact', { input, error });
      throw error;
    }
  }

  /**
   * Update contact
   */
  static async update(
    id: number,
    input: UpdateSupplierContactInput,
    userId: number
  ): Promise<SupplierContact> {
    try {
      const prisma = databaseService.getClient();

      // Check if contact exists
      const existing = await prisma.supplierContact.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Contact with ID ${id} not found`);
      }

      // Validate required fields if they're being updated
      if (input.name !== undefined) {
        if (!input.name || input.name.trim() === '') {
          throw new Error('Contact name is required');
        }
      }

      // If setting as primary, unset other primary contacts for this supplier
      if (input.isPrimary === true) {
        await prisma.supplierContact.updateMany({
          where: {
            supplierId: existing.supplierId,
            isPrimary: true,
            id: { not: id },
          },
          data: {
            isPrimary: false,
          },
        });
      }

      // Update contact
      const contact = await prisma.supplierContact.update({
        where: { id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.email !== undefined && { email: input.email }),
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
          ...(input.notes !== undefined && { notes: input.notes }),
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'update',
        entity: 'supplier_contact',
        entityId: contact.id,
        details: JSON.stringify({ name: contact.name, supplierId: contact.supplierId }),
      });

      logger.info('Supplier contact updated successfully', { id: contact.id, name: contact.name });
      return contact;
    } catch (error) {
      logger.error('Error updating supplier contact', { id, input, error });
      throw error;
    }
  }

  /**
   * Delete contact
   */
  static async delete(id: number, userId: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      // Check if contact exists
      const contact = await prisma.supplierContact.findUnique({
        where: { id },
      });
      if (!contact) {
        throw new Error(`Contact with ID ${id} not found`);
      }

      // Delete contact
      await prisma.supplierContact.delete({
        where: { id },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'delete',
        entity: 'supplier_contact',
        entityId: id,
        details: JSON.stringify({ name: contact.name, supplierId: contact.supplierId }),
      });

      logger.info('Supplier contact deleted successfully', { id, name: contact.name });
    } catch (error) {
      logger.error('Error deleting supplier contact', { id, error });
      throw error;
    }
  }

  /**
   * Set contact as primary
   */
  static async setPrimary(id: number, userId: number): Promise<SupplierContact> {
    try {
      const prisma = databaseService.getClient();

      // Get contact to find supplier
      const contact = await prisma.supplierContact.findUnique({
        where: { id },
      });
      if (!contact) {
        throw new Error(`Contact with ID ${id} not found`);
      }

      // Unset other primary contacts for this supplier
      await prisma.supplierContact.updateMany({
        where: {
          supplierId: contact.supplierId,
          isPrimary: true,
          id: { not: id },
        },
        data: {
          isPrimary: false,
        },
      });

      // Set this contact as primary
      const updated = await prisma.supplierContact.update({
        where: { id },
        data: { isPrimary: true },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'update',
        entity: 'supplier_contact',
        entityId: id,
        details: JSON.stringify({ action: 'set_primary', name: updated.name }),
      });

      logger.info('Supplier contact set as primary', { id, name: updated.name });
      return updated;
    } catch (error) {
      logger.error('Error setting contact as primary', { id, error });
      throw error;
    }
  }
}

