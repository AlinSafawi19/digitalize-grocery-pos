import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';

export interface CreateUserInput {
  username: string;
  phone?: string | null;
  password: string;
  permissionIds?: number[]; // Optional: specific permissions to assign. If not provided, default cashier permissions will be used.
}


export interface UpdateUserInput {
  username?: string;
  phone?: string | null;
  password?: string;
  isActive?: boolean;
  permissionIds?: number[]; // Optional: specific permissions to assign. If provided, replaces all existing permissions.
}

export interface UserListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  excludeUserId?: number; // Exclude this user ID from results (typically the logged-in user)
}

/**
 * User Service
 * Handles user-related operations including user creation
 */
export class UserService {
  /**
   * Create an user
   * @param input User creation data
   * @returns Promise<{ id: number; username: string; phone: string | null }>
   */
  static async createUser(input: CreateUserInput): Promise<{
    id: number;
    username: string;
    phone: string | null;
  }> {
    try {
      const prisma = databaseService.getClient();

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username: input.username },
            ...(input.phone ? [{ phone: input.phone }] : []),
          ],
        },
      });

      if (existingUser) {
        logger.info('User already exists', {
          username: input.username,
          phone: input.phone,
        });
        return {
          id: existingUser.id,
          username: existingUser.username,
          phone: existingUser.phone,
        };
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(input.password, saltRounds);

      const user = await prisma.user.create({
        data: {
          username: input.username,
          phone: input.phone || null,
          password: passwordHash,
          isActive: true,
        } as Prisma.UserUncheckedCreateInput,
        select: {
          id: true,
          username: true,
          phone: true,
        },
      });

      logger.info('User created successfully', {
        id: user.id,
        username: user.username,
        phone: user.phone,
      });

      // Check if this is the first user (default user) - ID 1 indicates the first user in SQLite
      const isFirstUser = user.id === 1;

      // Initialize default settings for the new account
      // This is critical - if it fails, we should retry or at least log it prominently
      try {
        const { SettingsService } = await import('../settings/settings.service');
        await SettingsService.initializeDefaultSettings(user.id);
        logger.info('Default settings initialized for user', { userId: user.id });
      } catch (settingsError) {
        // Log prominently - this is important for first-time setup
        logger.error('CRITICAL: Failed to initialize default settings during user creation', {
          error: settingsError instanceof Error ? settingsError.message : 'Unknown error',
          stack: settingsError instanceof Error ? settingsError.stack : undefined,
          userId: user.id,
          note: 'Settings will be initialized on first access, but this may cause "Failed to load settings" errors',
        });
        // Don't fail user creation, but this will be handled by getBusinessRules if needed
      }

      // Assign permissions based on user type
        try {
          const { PermissionService } = await import('../permission/permission.service');
          // Initialize default permissions if they don't exist
          await PermissionService.initializeDefaultPermissions();
        
        if (isFirstUser) {
          // If this is the first user (default user), assign all permissions
          await PermissionService.assignAllPermissionsToUser(user.id);
          logger.info('All permissions assigned to default user', { userId: user.id });
        } else {
          // For cashiers (non-first users), assign permissions
          if (input.permissionIds && input.permissionIds.length > 0) {
            // Use provided permissions (will be filtered if user is not main user)
            // Note: This is called during user creation, so we don't have an assigner ID yet
            // The filtering will happen in assignPermissionsToUser based on the target user ID
            await PermissionService.assignPermissionsToUser(user.id, input.permissionIds);
            logger.info('Custom permissions assigned to user', { userId: user.id, count: input.permissionIds.length });
          } else {
            // Use default cashier permissions
            await PermissionService.assignCashierPermissionsToUser(user.id);
            logger.info('Default cashier permissions assigned to user', { userId: user.id });
          }
        }
      } catch (permissionError) {
          // Log but don't fail user creation if permission assignment fails
        logger.error('Failed to assign permissions to user (user creation still successful)', permissionError);
      }

      return user;
    } catch (error) {
      const err = error as {
        message?: string;
        name?: string;
        code?: string;
        meta?: unknown;
        stack?: string;
      };
      logger.error('Error creating user (FULL ERROR)', {
        message: err?.message,
        name: err?.name,
        code: err?.code,
        meta: err?.meta,
        stack: err?.stack,
      });
      throw error;
    }
  }

  /**
   * Check if any users exist in the database
   * @returns Promise<boolean>
   */
  static async hasUsers(): Promise<boolean> {
    try {
      const prisma = databaseService.getClient();
      const userCount = await prisma.user.count();
      
      // Log for debugging
      logger.info('Checking if users exist in database', { userCount, hasUsers: userCount > 0 });
      
      // Also log all users if any exist (for debugging)
      if (userCount > 0) {
        const users = await prisma.user.findMany({
          select: { id: true, username: true, phone: true, createdAt: true }
        });
        logger.info('Users found in database', { users });
      }
      
      return userCount > 0;
    } catch (error) {
      logger.error('Error checking if users exist', error);
      throw error;
    }
  }

  /**
   * Get total count of all users in the database
   * @returns Promise<number> Total user count
   */
  static async getTotalUserCount(): Promise<number> {
    try {
      const prisma = databaseService.getClient();
      const userCount = await prisma.user.count();
      
      logger.info('Total user count retrieved', { userCount });
      
      return userCount;
    } catch (error) {
      logger.error('Error getting total user count', error);
      throw error;
    }
  }

  /**
   * Generate a default password from customer phone/identifier or name
   * @param customerIdentifier Customer phone number or other identifier
   * @param customerName Customer name
   * @returns string Default password
   */
  static generateDefaultPassword(
    customerIdentifier?: string | null,
    customerName?: string | null
  ): string {
    // Use identifier if available, otherwise use name, otherwise use default
    const base = customerIdentifier || customerName || 'user';
    // Generate a simple password: first 8 chars of base + "123!"
    const basePart = base.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
    return `${basePart}123!`;
  }

  /**
   * Generate a username from customer phone/identifier or name
   * @param customerIdentifier Customer phone number or other identifier
   * @param customerName Customer name
   * @returns string Username
   */
  static generateUsername(
    customerIdentifier?: string | null,
    customerName?: string | null
  ): string {
    // Use identifier if available (remove non-alphanumeric chars), otherwise use name, otherwise use default
    if (customerIdentifier) {
      // Remove all non-alphanumeric characters and take first part if it contains @ (for backward compatibility)
      const cleaned = customerIdentifier.includes('@') 
        ? customerIdentifier.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
        : customerIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleaned || 'user';
    }
    if (customerName) {
      return customerName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    }
    return 'user';
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: number): Promise<{
    id: number;
    username: string;
    phone: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    try {
      const prisma = databaseService.getClient();
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          phone: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        ...user
      };
    } catch (error) {
      logger.error('Error getting user by ID', error);
      throw error;
    }
  }

  /**
   * Get list of users with pagination
   */
  static async getUsers(options: UserListOptions = {}): Promise<{
    users: Array<{
      id: number;
      username: string;
      phone: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const where: Prisma.UserWhereInput = {};
      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }
      if (options.search) {
        where.OR = [
          { username: { contains: options.search } },
          { phone: { contains: options.search } },
        ];
      }
      // Always exclude the auto-created user (ID = 1) and the logged-in user
      where.id = {
        notIn: [
          1, // Auto-created user
          ...(options.excludeUserId && options.excludeUserId !== 1 ? [options.excludeUserId] : []),
        ],
      };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            username: true,
            phone: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      return {
        users: users.map((user) => ({
          ...user
        })),
        total,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error('Error getting users', error);
      throw error;
    }
  }


  /**
   * Update user
   */
  static async updateUser(
    id: number,
    input: UpdateUserInput,
    updatedBy: number
  ): Promise<{
    id: number;
    username: string;
    phone: string | null;
  }> {
    try {
      const prisma = databaseService.getClient();

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        throw new Error('User not found');
      }

      // Check if username/phone conflicts
      if (input.username || input.phone) {
        const conflictUser = await prisma.user.findFirst({
          where: {
            AND: [
              { id: { not: id } },
              {
                OR: [
                  ...(input.username ? [{ username: input.username }] : []),
                  ...(input.phone ? [{ phone: input.phone }] : []),
                ],
              },
            ],
          },
        });

        if (conflictUser) {
          throw new Error('Username or phone already in use');
        }
      }

      // Prepare update data
      const updateData: Prisma.UserUpdateInput = {};
      if (input.username !== undefined) {
        updateData.username = input.username;
      }
      if (input.phone !== undefined) {
        updateData.phone = input.phone;
      }
      if (input.isActive !== undefined) {
        updateData.isActive = input.isActive;
      }
      if (input.password) {
        const saltRounds = 10;
        updateData.password = await bcrypt.hash(input.password, saltRounds);
      }

      // Update user
      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          username: true,
          phone: true,
        },
      });

      // Update permissions if provided
      if (input.permissionIds !== undefined) {
        try {
          const { PermissionService } = await import('../permission/permission.service');
          // Validate permission assignment
          const canAssign = await PermissionService.canAssignPermissions(updatedBy, input.permissionIds, id);
          if (!canAssign.canAssign) {
            throw new Error(canAssign.reason || 'Cannot assign these permissions');
          }
          await PermissionService.assignPermissionsToUser(id, input.permissionIds, updatedBy);
          logger.info('Permissions updated for user', { userId: id, count: input.permissionIds.length });
        } catch (permissionError) {
          // Fail user update if permission assignment fails
          logger.error('Failed to update permissions for user', permissionError);
          throw permissionError;
        }
      }

      // Log audit
      await AuditLogService.log({
        userId: updatedBy,
        action: 'update',
        entity: 'user',
        entityId: id,
        details: JSON.stringify({ changes: Object.keys(updateData) }),
      });

      logger.info('User updated successfully', {
        id: user.id,
        username: user.username,
      });

      return user;
    } catch (error) {
      logger.error('Error updating user', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(id: number, deletedBy: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Don't allow deleting yourself
      if (id === deletedBy) {
        throw new Error('Cannot delete your own account');
      }

      // Delete user
      await prisma.user.delete({
        where: { id },
      });

      // Log audit
      await AuditLogService.log({
        userId: deletedBy,
        action: 'delete',
        entity: 'user',
        entityId: id,
        details: JSON.stringify({ username: user.username }),
      });

      logger.info('User deleted successfully', {
        id,
        username: user.username,
      });
    } catch (error) {
      logger.error('Error deleting user', error);
      throw error;
    }
  }
}

