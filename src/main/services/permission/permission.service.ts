import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { Prisma } from '@prisma/client';

export interface Permission {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePermissionInput {
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
}

export interface UserPermission {
  userId: number;
  permissionId: number;
  permission: Permission;
}

/**
 * Permission Service
 * Handles permission management and user permission assignments
 */
export class PermissionService {
  /**
   * Default permissions that should exist in the system
   */
  private static readonly DEFAULT_PERMISSIONS: CreatePermissionInput[] = [
    // Products
    { code: 'products.view', name: 'View Products', description: 'View product list and details', category: 'products' },
    { code: 'products.create', name: 'Create Products', description: 'Create new products', category: 'products' },
    { code: 'products.update', name: 'Update Products', description: 'Edit existing products', category: 'products' },
    { code: 'products.delete', name: 'Delete Products', description: 'Delete products', category: 'products' },
    
    // Categories
    { code: 'categories.view', name: 'View Categories', description: 'View category list and details', category: 'categories' },
    { code: 'categories.create', name: 'Create Categories', description: 'Create new categories', category: 'categories' },
    { code: 'categories.update', name: 'Update Categories', description: 'Edit existing categories', category: 'categories' },
    { code: 'categories.delete', name: 'Delete Categories', description: 'Delete categories', category: 'categories' },
    
    // Transactions
    { code: 'transactions.view', name: 'View Transactions', description: 'View transaction list and details', category: 'transactions' },
    { code: 'transactions.create', name: 'Create Transactions', description: 'Create new sales transactions', category: 'transactions' },
    { code: 'transactions.update', name: 'Update Transactions', description: 'Edit existing transactions', category: 'transactions' },
    { code: 'transactions.void', name: 'Void Transactions', description: 'Void transactions (transactions cannot be deleted, only voided)', category: 'transactions' },
    
    // Inventory
    { code: 'inventory.view', name: 'View Inventory', description: 'View inventory levels and stock', category: 'inventory' },
    { code: 'inventory.update', name: 'Update Inventory', description: 'Adjust inventory levels', category: 'inventory' },
    
    // Purchase Orders
    { code: 'purchase_orders.view', name: 'View Purchase Orders', description: 'View purchase order list and details', category: 'purchase_orders' },
    { code: 'purchase_orders.create', name: 'Create Purchase Orders', description: 'Create new purchase orders', category: 'purchase_orders' },
    { code: 'purchase_orders.update', name: 'Update Purchase Orders', description: 'Edit existing purchase orders', category: 'purchase_orders' },
    { code: 'purchase_orders.delete', name: 'Delete Purchase Orders', description: 'Delete purchase orders', category: 'purchase_orders' },
    
    // Suppliers
    { code: 'suppliers.view', name: 'View Suppliers', description: 'View supplier list and details', category: 'suppliers' },
    { code: 'suppliers.create', name: 'Create Suppliers', description: 'Create new suppliers', category: 'suppliers' },
    { code: 'suppliers.update', name: 'Update Suppliers', description: 'Edit existing suppliers', category: 'suppliers' },
    { code: 'suppliers.delete', name: 'Delete Suppliers', description: 'Delete suppliers', category: 'suppliers' },
    
    // Users
    { code: 'users.view', name: 'View Users', description: 'View user list and details', category: 'users' },
    { code: 'users.create', name: 'Create Users', description: 'Create new users', category: 'users' },
    { code: 'users.update', name: 'Update Users', description: 'Edit existing users', category: 'users' },
    { code: 'users.delete', name: 'Delete Users', description: 'Delete users', category: 'users' },
    
    // Reports
    { code: 'reports.view', name: 'View Reports', description: 'View and generate reports', category: 'reports' },
    { code: 'reports.export', name: 'Export Reports', description: 'Export reports to files', category: 'reports' },
    
    // Pricing
    { code: 'pricing.view', name: 'View Pricing', description: 'View pricing rules and promotions', category: 'pricing' },
    { code: 'pricing.create', name: 'Create Pricing', description: 'Create pricing rules and promotions', category: 'pricing' },
    { code: 'pricing.update', name: 'Update Pricing', description: 'Edit pricing rules and promotions', category: 'pricing' },
    { code: 'pricing.delete', name: 'Delete Pricing', description: 'Delete pricing rules and promotions', category: 'pricing' },
    
    // Permissions
    { code: 'permissions.view', name: 'View Permissions', description: 'View user permissions', category: 'permissions' },
    { code: 'permissions.manage', name: 'Manage Permissions', description: 'Assign and revoke user permissions', category: 'permissions' },
    
    // Alerts
    { code: 'alerts.manage', name: 'Manage Alert Rules', description: 'Create, edit, and delete alert rules', category: 'alerts' },
    { code: 'alerts.view', name: 'View Alerts', description: 'View alert history', category: 'alerts' },
    
    // Barcode Labels
    { code: 'barcode_labels.view', name: 'View Barcode Labels', description: 'View barcode label templates', category: 'barcode_labels' },
    { code: 'barcode_labels.create', name: 'Create Barcode Labels', description: 'Create new barcode label templates', category: 'barcode_labels' },
    { code: 'barcode_labels.update', name: 'Update Barcode Labels', description: 'Edit existing barcode label templates', category: 'barcode_labels' },
    { code: 'barcode_labels.delete', name: 'Delete Barcode Labels', description: 'Delete barcode label templates', category: 'barcode_labels' },
    { code: 'barcode.manage', name: 'Manage Barcode Labels', description: 'Full access to manage barcode label templates', category: 'barcode_labels' },
  ];

  /**
   * Initialize default permissions in the database
   * This should be called during system setup
   */
  static async initializeDefaultPermissions(): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      
      logger.info('Initializing default permissions...');
      
      for (const permissionData of this.DEFAULT_PERMISSIONS) {
        // Check if permission already exists
        const existing = await prisma.permission.findUnique({
          where: { code: permissionData.code },
        });
        
        if (!existing) {
          await prisma.permission.create({
            data: permissionData,
          });
          logger.info('Created default permission', { code: permissionData.code });
        }
      }
      
      logger.info('Default permissions initialized successfully');
    } catch (error) {
      logger.error('Error initializing default permissions', error);
      throw error;
    }
  }

  /**
   * Get all permissions
   * Automatically initializes default permissions if they don't exist
   */
  static async getAllPermissions(): Promise<Permission[]> {
    try {
      const prisma = databaseService.getClient();
      
      // Ensure default permissions are initialized
      await this.initializeDefaultPermissions();
      
      const permissions = await prisma.permission.findMany({
        orderBy: [
          { category: 'asc' },
          { name: 'asc' },
        ],
      });
      
      return permissions;
    } catch (error) {
      logger.error('Error getting all permissions', error);
      throw error;
    }
  }

  /**
   * Get permissions by category
   */
  static async getPermissionsByCategory(category: string): Promise<Permission[]> {
    try {
      const prisma = databaseService.getClient();
      const permissions = await prisma.permission.findMany({
        where: { category },
        orderBy: { name: 'asc' },
      });
      
      return permissions;
    } catch (error) {
      logger.error('Error getting permissions by category', error);
      throw error;
    }
  }

  /**
   * Get permission by code
   */
  static async getPermissionByCode(code: string): Promise<Permission | null> {
    try {
      const prisma = databaseService.getClient();
      const permission = await prisma.permission.findUnique({
        where: { code },
      });
      
      return permission;
    } catch (error) {
      logger.error('Error getting permission by code', error);
      throw error;
    }
  }

  /**
   * Get all permissions for a user
   */
  static async getUserPermissions(userId: number): Promise<Permission[]> {
    try {
      const prisma = databaseService.getClient();
      const userPermissions = await prisma.userPermission.findMany({
        where: { userId },
        include: { permission: true },
      });
      
      return userPermissions.map(up => up.permission);
    } catch (error) {
      logger.error('Error getting user permissions', error);
      throw error;
    }
  }

  /**
   * Check if user has a specific permission
   */
  static async userHasPermission(userId: number, permissionCode: string): Promise<boolean> {
    try {
      const prisma = databaseService.getClient();
      const userPermission = await prisma.userPermission.findFirst({
        where: {
          userId,
          permission: {
            code: permissionCode,
          },
        },
      });
      
      return !!userPermission;
    } catch (error) {
      logger.error('Error checking user permission', error);
      return false;
    }
  }

  /**
   * Check if user has any of the specified permissions
   */
  static async userHasAnyPermission(userId: number, permissionCodes: string[]): Promise<boolean> {
    try {
      const prisma = databaseService.getClient();
      const userPermission = await prisma.userPermission.findFirst({
        where: {
          userId,
          permission: {
            code: {
              in: permissionCodes,
            },
          },
        },
      });
      
      return !!userPermission;
    } catch (error) {
      logger.error('Error checking user permissions', error);
      return false;
    }
  }

  /**
   * Assign all permissions to a user
   * Used for the default user created during license activation
   */
  static async assignAllPermissionsToUser(userId: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      
      // Get all permissions
      const allPermissions = await prisma.permission.findMany();
      
      if (allPermissions.length === 0) {
        logger.warn('No permissions found in database. Initializing default permissions...');
        await this.initializeDefaultPermissions();
        // Get permissions again after initialization
        const permissions = await prisma.permission.findMany();
        await this.assignPermissionsToUser(userId, permissions.map(p => p.id));
        return;
      }
      
      // Assign all permissions to user
      await this.assignPermissionsToUser(userId, allPermissions.map(p => p.id));
      
      logger.info('All permissions assigned to user', { userId });
    } catch (error) {
      logger.error('Error assigning all permissions to user', error);
      throw error;
    }
  }

  /**
   * Assign specific permissions to a user
   * @param userId The user to assign permissions to
   * @param permissionIds The permission IDs to assign
   * @param assignedBy The user ID who is assigning these permissions (for validation)
   */
  static async assignPermissionsToUser(userId: number, permissionIds: number[], assignedBy?: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      
      // If assignedBy is provided and the target user is not the main user (ID = 1),
      // filter out users and permissions category permissions
      let filteredPermissionIds = permissionIds;
      if (assignedBy !== undefined && userId !== 1) {
        // Get all permissions to check their categories
        const allPerms = await prisma.permission.findMany({
          where: { id: { in: permissionIds } },
          select: { id: true, category: true },
        });
        
        // Filter out users and permissions category permissions
        filteredPermissionIds = allPerms
          .filter(p => p.category !== 'users' && p.category !== 'permissions')
          .map(p => p.id);
        
        if (filteredPermissionIds.length !== permissionIds.length) {
          logger.warn('Filtered out users/permissions permissions for non-main user', {
            userId,
            originalCount: permissionIds.length,
            filteredCount: filteredPermissionIds.length,
          });
        }
      }
      
      // Remove existing permissions for this user
      await prisma.userPermission.deleteMany({
        where: { userId },
      });
      
      // Create new user permissions
      if (filteredPermissionIds.length > 0) {
        await prisma.userPermission.createMany({
          data: filteredPermissionIds.map(permissionId => ({
            userId,
            permissionId,
          })),
        });
      }
      
      logger.info('Permissions assigned to user', { userId, count: filteredPermissionIds.length });
    } catch (error) {
      logger.error('Error assigning permissions to user', error);
      throw error;
    }
  }

  /**
   * Remove all permissions from a user
   */
  static async removeAllPermissionsFromUser(userId: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      
      await prisma.userPermission.deleteMany({
        where: { userId },
      });
      
      logger.info('All permissions removed from user', { userId });
    } catch (error) {
      logger.error('Error removing permissions from user', error);
      throw error;
    }
  }

  /**
   * Add a permission to a user
   */
  static async addPermissionToUser(userId: number, permissionId: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      
      await prisma.userPermission.create({
        data: {
          userId,
          permissionId,
        },
      });
      
      logger.info('Permission added to user', { userId, permissionId });
    } catch (error) {
      // Ignore duplicate errors
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        logger.debug('Permission already assigned to user', { userId, permissionId });
        return;
      }
      logger.error('Error adding permission to user', error);
      throw error;
    }
  }

  /**
   * Remove a permission from a user
   */
  static async removePermissionFromUser(userId: number, permissionId: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      
      await prisma.userPermission.deleteMany({
        where: {
          userId,
          permissionId,
        },
      });
      
      logger.info('Permission removed from user', { userId, permissionId });
    } catch (error) {
      logger.error('Error removing permission from user', error);
      throw error;
    }
  }

  /**
   * Validate if a user can assign specific permissions to another user
   * Rules:
   * - Main user (ID = 1) can assign any permissions
   * - If user has 'users.create' but not 'permissions.manage', they can only create users with default permissions
   * - User with 'permissions.manage' can assign permissions, but NOT users/permissions category permissions (only main user can)
   * - Non-main users cannot assign users or permissions category permissions to anyone
   */
  static async canAssignPermissions(assignerId: number, permissionIds: number[], targetUserId?: number): Promise<{
    canAssign: boolean;
    reason?: string;
  }> {
    try {
      // If no custom permissions, allow (will use defaults)
      if (!permissionIds || permissionIds.length === 0) {
        return { canAssign: true };
      }

      const prisma = databaseService.getClient();
      
      // Get the permissions being assigned to check their categories
      const permissions = await prisma.permission.findMany({
        where: { id: { in: permissionIds } },
        select: { id: true, category: true, code: true },
      });
      
      // Check if any permissions are in users or permissions category
      const restrictedPermissions = permissions.filter(
        p => p.category === 'users' || p.category === 'permissions'
      );
      
      // Only main user (ID = 1) can assign users/permissions permissions
      // Also, only main user can receive users/permissions permissions
      if (restrictedPermissions.length > 0) {
        if (assignerId !== 1) {
          return {
            canAssign: false,
            reason: 'Only the main user can assign users or permissions management permissions.',
          };
        }
        if (targetUserId !== undefined && targetUserId !== 1) {
          return {
            canAssign: false,
            reason: 'Users and permissions management permissions can only be assigned to the main user.',
          };
        }
      }

      // Check if user has permissions.manage (full control for non-restricted permissions)
      const hasManagePermissions = await this.userHasPermission(assignerId, 'permissions.manage');
      if (hasManagePermissions || assignerId === 1) {
        return { canAssign: true };
      }

      // If user doesn't have permissions.manage, they can't assign custom permissions
      return {
        canAssign: false,
        reason: 'You need "Manage Permissions" permission to assign custom permissions to users.',
      };
    } catch (error) {
      logger.error('Error checking if user can assign permissions', error);
      return {
        canAssign: false,
        reason: 'Error validating permissions',
      };
    }
  }

  /**
   * Assign cashier permissions to a user
   * Cashiers typically need permissions to:
   * - View and create transactions
   * - View products and categories
   * - View inventory
   * - View reports
   */
  static async assignCashierPermissionsToUser(userId: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      
      // Ensure default permissions are initialized
      await this.initializeDefaultPermissions();
      
      // Define cashier permission codes
      const cashierPermissionCodes = [
        'transactions.view',
        'transactions.create',
        'transactions.update',
        'products.view',
        'categories.view',
        'inventory.view',
        'reports.view',
        'pricing.view',
      ];
      
      // Get permission IDs by codes
      const permissions = await prisma.permission.findMany({
        where: {
          code: {
            in: cashierPermissionCodes,
          },
        },
      });
      
      if (permissions.length === 0) {
        logger.warn('No cashier permissions found in database', { userId });
        return;
      }
      
      // Assign permissions to user
      const permissionIds = permissions.map(p => p.id);
      await this.assignPermissionsToUser(userId, permissionIds);
      
      logger.info('Cashier permissions assigned to user', { 
        userId, 
        count: permissions.length,
        permissions: cashierPermissionCodes,
      });
    } catch (error) {
      logger.error('Error assigning cashier permissions to user', error);
      throw error;
    }
  }
}

