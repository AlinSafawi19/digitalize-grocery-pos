import { Location, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';

export interface CreateLocationInput {
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  isDefault?: boolean;
}

export interface UpdateLocationInput {
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface LocationListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'code' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Location Service
 * Handles location management operations
 */
export class LocationService {
  /**
   * Create a new location
   */
  static async createLocation(
    input: CreateLocationInput,
    createdById: number
  ): Promise<{ success: boolean; location?: Location; error?: string }> {
    try {
      const prisma = databaseService.getClient();
      const { name, code, isDefault = false } = input;

      // Check if name already exists
      const existingByName = await prisma.location.findUnique({
        where: { name },
      });

      if (existingByName) {
        return {
          success: false,
          error: 'Location with this name already exists',
        };
      }

      // Check if code already exists (if provided)
      if (code) {
        const existingByCode = await prisma.location.findUnique({
          where: { code },
        });

        if (existingByCode) {
          return {
            success: false,
            error: 'Location with this code already exists',
          };
        }
      }

      // If setting as default, unset other defaults
      if (isDefault) {
        await prisma.location.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      // Create location
      const location = await prisma.location.create({
        data: {
          name,
          code,
          address: input.address,
          phone: input.phone,
          email: input.email,
          description: input.description,
          isDefault,
          isActive: true,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId: createdById,
        action: 'create',
        entity: 'location',
        entityId: location.id,
        details: JSON.stringify({
          name: location.name,
          code: location.code,
        }),
      });

      logger.info('Location created', { locationId: location.id, name: location.name });
      return {
        success: true,
        location,
      };
    } catch (error) {
      logger.error('Error creating location', { input, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get location by ID
   */
  static async getById(id: number): Promise<Location | null> {
    try {
      const prisma = databaseService.getClient();
      const location = await prisma.location.findUnique({
        where: { id },
      });

      return location;
    } catch (error) {
      logger.error('Error getting location by ID', { id, error });
      throw error;
    }
  }

  /**
   * Get all locations
   */
  static async getAll(activeOnly: boolean = false): Promise<Location[]> {
    try {
      const prisma = databaseService.getClient();
      const locations = await prisma.location.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        orderBy: [
          { isDefault: 'desc' },
          { name: 'asc' },
        ],
      });

      return locations;
    } catch (error) {
      logger.error('Error getting all locations', { error });
      throw error;
    }
  }

  /**
   * Get locations list with pagination
   */
  static async getList(
    options: LocationListOptions
  ): Promise<{
    success: boolean;
    locations?: Location[];
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
    error?: string;
  }> {
    try {
      const prisma = databaseService.getClient();
      const {
        page = 1,
        pageSize = 20,
        search,
        isActive,
        sortBy = 'name',
        sortOrder = 'asc',
      } = options;

      const skip = (page - 1) * pageSize;
      const take = pageSize;

      // Build where clause
      const where: Prisma.LocationWhereInput = {};

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { code: { contains: search } },
          { address: { contains: search } },
        ];
      }

      // Build orderBy clause
      let orderBy: Prisma.LocationOrderByWithRelationInput = {};
      switch (sortBy) {
        case 'name':
          orderBy = { name: sortOrder };
          break;
        case 'code':
          orderBy = { code: sortOrder };
          break;
        case 'createdAt':
          orderBy = { createdAt: sortOrder };
          break;
        default:
          orderBy = { name: 'asc' };
      }

      // Get total count
      const total = await prisma.location.count({ where });

      // Get locations
      const locations = await prisma.location.findMany({
        where,
        skip,
        take,
        orderBy,
      });

      const totalPages = Math.ceil(total / pageSize);

      return {
        success: true,
        locations,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting location list', { options, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update location
   */
  static async updateLocation(
    id: number,
    input: UpdateLocationInput,
    updatedById: number
  ): Promise<{ success: boolean; location?: Location; error?: string }> {
    try {
      const prisma = databaseService.getClient();
      const { name, code, isDefault } = input;

      // Get existing location
      const existingLocation = await prisma.location.findUnique({
        where: { id },
      });

      if (!existingLocation) {
        return {
          success: false,
          error: 'Location not found',
        };
      }

      // Check if name already exists (if changed)
      if (name && name !== existingLocation.name) {
        const existingByName = await prisma.location.findUnique({
          where: { name },
        });

        if (existingByName) {
          return {
            success: false,
            error: 'Location with this name already exists',
          };
        }
      }

      // Check if code already exists (if changed)
      if (code && code !== existingLocation.code) {
        const existingByCode = await prisma.location.findUnique({
          where: { code },
        });

        if (existingByCode) {
          return {
            success: false,
            error: 'Location with this code already exists',
          };
        }
      }

      // If setting as default, unset other defaults
      if (isDefault && !existingLocation.isDefault) {
        await prisma.location.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      // Update location
      const updateData: Prisma.LocationUpdateInput = {};
      if (name !== undefined) updateData.name = name;
      if (code !== undefined) updateData.code = code;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (isDefault !== undefined) updateData.isDefault = isDefault;

      const location = await prisma.location.update({
        where: { id },
        data: updateData,
      });

      // Log audit
      await AuditLogService.log({
        userId: updatedById,
        action: 'update',
        entity: 'location',
        entityId: id,
        details: JSON.stringify({
          changes: updateData,
        }),
      });

      logger.info('Location updated', { locationId: id, updateData });
      return {
        success: true,
        location,
      };
    } catch (error) {
      logger.error('Error updating location', { id, input, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete location (soft delete by setting isActive to false)
   */
  static async deleteLocation(
    id: number,
    deletedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const prisma = databaseService.getClient();

      // Get existing location
      const existingLocation = await prisma.location.findUnique({
        where: { id },
      });

      if (!existingLocation) {
        return {
          success: false,
          error: 'Location not found',
        };
      }

      // Check if location has inventory
      const inventoryCount = await prisma.inventoryLocation.count({
        where: { locationId: id },
      });

      if (inventoryCount > 0) {
        return {
          success: false,
          error: 'Cannot delete location with existing inventory. Please deactivate it instead.',
        };
      }

      // Check if location has active transfers
      const activeTransfers = await prisma.stockTransfer.count({
        where: {
          OR: [
            { fromLocationId: id },
            { toLocationId: id },
          ],
          status: {
            in: ['pending', 'in_transit'],
          },
        },
      });

      if (activeTransfers > 0) {
        return {
          success: false,
          error: 'Cannot delete location with active transfers. Please complete or cancel transfers first.',
        };
      }

      // Soft delete by setting isActive to false
      await prisma.location.update({
        where: { id },
        data: { isActive: false },
      });

      // Log audit
      await AuditLogService.log({
        userId: deletedById,
        action: 'delete',
        entity: 'location',
        entityId: id,
        details: JSON.stringify({
          name: existingLocation.name,
        }),
      });

      logger.info('Location deleted', { locationId: id });
      return {
        success: true,
      };
    } catch (error) {
      logger.error('Error deleting location', { id, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get default location
   */
  static async getDefaultLocation(): Promise<Location | null> {
    try {
      const prisma = databaseService.getClient();
      const location = await prisma.location.findFirst({
        where: {
          isDefault: true,
          isActive: true,
        },
      });

      return location;
    } catch (error) {
      logger.error('Error getting default location', { error });
      throw error;
    }
  }

  /**
   * Ensure default location exists
   * Creates a default location if none exists
   */
  static async ensureDefaultLocation(createdById: number = 1): Promise<{ success: boolean; location?: Location; error?: string }> {
    try {
      const prisma = databaseService.getClient();

      // Check if any location exists
      const existingLocation = await prisma.location.findFirst({
        where: { isActive: true },
      });

      if (existingLocation) {
        // If a location exists but none is marked as default, mark the first one as default
        const defaultLocation = await prisma.location.findFirst({
          where: { isDefault: true, isActive: true },
        });

        if (!defaultLocation) {
          await prisma.location.update({
            where: { id: existingLocation.id },
            data: { isDefault: true },
          });
          logger.info('Marked existing location as default', { locationId: existingLocation.id });
          return {
            success: true,
            location: { ...existingLocation, isDefault: true },
          };
        }

        return {
          success: true,
          location: defaultLocation || existingLocation,
        };
      }

      // No locations exist, create a default one
      const result = await this.createLocation(
        {
          name: 'Main Store',
          code: 'MAIN',
          description: 'Default main store location',
          isDefault: true,
        },
        createdById
      );

      if (result.success && result.location) {
        logger.info('Created default location', { locationId: result.location.id });
      }

      return result;
    } catch (error) {
      logger.error('Error ensuring default location', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

