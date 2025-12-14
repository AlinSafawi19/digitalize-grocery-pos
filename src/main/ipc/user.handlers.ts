import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  UserService,
  CreateUserInput,
  UpdateUserInput,
  UserListOptions,
} from '../services/user/user.service';
import { databaseService } from '../services/database/database.service';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { licenseService } from '../services/license/license.service';
import { PermissionService } from '../services/permission/permission.service';

/**
 * Register user management IPC handlers
 */
export function registerUserHandlers(): void {
  logger.info('Registering user management IPC handlers...');

  /**
   * Get user by ID handler
   * IPC: user:getById
   */
  ipcMain.handle('user:getById', async (_event, userId: number) => {
    try {
      const user = await UserService.getUserById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return { success: true, user };
    } catch (error) {
      logger.error('Error in user:getById handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Create user handler
   * IPC: user:create
   */
  ipcMain.handle('user:create', async (_event, input: CreateUserInput, createdBy: number) => {
    try {
      // Check if user has permission to create users
      const hasCreatePermission = await PermissionService.userHasPermission(createdBy, 'users.create');
      if (!hasCreatePermission) {
        return {
          success: false,
          error: 'You do not have permission to create users.',
        };
      }

      // Validate permission assignment if custom permissions are provided
      if (input.permissionIds && input.permissionIds.length > 0) {
        // Note: We don't know the target user ID yet, but we can validate that:
        // 1. Non-main users can't assign users/permissions permissions
        // 2. The actual filtering will happen in assignPermissionsToUser
        // Since new users will have ID > 1 (main user is ID = 1), we can validate with undefined targetUserId
        const canAssign = await PermissionService.canAssignPermissions(createdBy, input.permissionIds, undefined);
        if (!canAssign.canAssign) {
          return {
            success: false,
            error: canAssign.reason || 'You do not have permission to assign custom permissions.',
          };
        }
      }

      // Check license before creating user
      const licenseData = await licenseService.getLicenseStatus();
      if (!licenseData) {
        return {
          success: false,
          error: 'No license found. Please activate a license first.',
        };
      }

      // Check user count locally (from database) - allows offline operation
      const currentUserCount = await UserService.getTotalUserCount();
      
      // Try to get user limit from server, fallback to default (2) if offline
      let userLimit = 2; // Default fallback
      try {
        const checkResult = await licenseService.checkUserCreation();
        if (checkResult.userLimit > 0) {
          userLimit = checkResult.userLimit;
        }
      } catch {
        // Server unavailable - use default limit
        logger.warn('Server unavailable, using default user limit', { defaultLimit: userLimit });
      }

      if (currentUserCount >= userLimit) {
        return {
          success: false,
          error: `User limit reached (${currentUserCount}/${userLimit}). Cannot create more users.`,
        };
      }

      // Try to check with server first (if online)
      try {
        const checkResult = await licenseService.checkUserCreation();
        if (!checkResult.canCreate) {
          // Server says limit reached, but local count is lower - use local count (offline scenario)
          logger.warn('Server check failed, using local user count', {
            serverMessage: checkResult.message,
            localCount: currentUserCount,
            limit: userLimit,
          });
        }
      } catch {
        // Server unavailable - proceed with local validation
        logger.info('Server unavailable, proceeding with local validation', {
          localCount: currentUserCount,
          limit: userLimit,
        });
      }

      // Create user in local database (works offline)
      const user = await UserService.createUser(input);

      // Try to sync with server (non-blocking)
      try {
        const incrementResult = await licenseService.incrementUserCount();
        if (incrementResult.success) {
          logger.info('User count incremented in license server', {
            userCount: incrementResult.userCount,
            userLimit: incrementResult.userLimit,
          });
        } else {
          // Queue for later sync
          const { OperationQueueService } = await import('../services/sync/operation-queue.service');
          await OperationQueueService.queueOperation('incrementUserCount', { userId: user.id });
          logger.warn('User created offline, will sync when online', {
            userId: user.id,
            message: incrementResult.message,
          });
        }
      } catch (error) {
        // Queue for later sync
        const { OperationQueueService } = await import('../services/sync/operation-queue.service');
        await OperationQueueService.queueOperation('incrementUserCount', { userId: user.id });
        logger.warn('User created offline, will sync when online', {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return { success: true, user };
    } catch (error) {
      logger.error('Error in user:create handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get users list handler
   * IPC: user:getList
   */
  ipcMain.handle('user:getList', async (_event, options: UserListOptions, currentUserId?: number) => {
    try {
      // Pass the current user ID to exclude it from results
      const result = await UserService.getUsers({
        ...options,
        excludeUserId: currentUserId,
      });
      return { success: true, ...result };
    } catch (error) {
      logger.error('Error in user:getList handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Update user handler
   * IPC: user:update
   */
  ipcMain.handle('user:update', async (_event, id: number, input: UpdateUserInput, updatedBy: number) => {
    try {
      // Validate permission assignment if permissions are being updated
      if (input.permissionIds !== undefined && input.permissionIds.length > 0) {
        const canAssign = await PermissionService.canAssignPermissions(updatedBy, input.permissionIds, id);
        if (!canAssign.canAssign) {
          return {
            success: false,
            error: canAssign.reason || 'You do not have permission to assign these permissions.',
          };
        }
      }
      
      const user = await UserService.updateUser(id, input, updatedBy);
      return { success: true, user };
    } catch (error) {
      logger.error('Error in user:update handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Delete user handler
   * IPC: user:delete
   */
  ipcMain.handle('user:delete', async (_event, id: number, deletedBy: number) => {
    try {
      // Check license before deleting user
      const licenseData = await licenseService.getLicenseStatus();
      if (!licenseData) {
        return {
          success: false,
          error: 'No license found. Please activate a license first.',
        };
      }

      // Delete user from local database (works offline)
      await UserService.deleteUser(id, deletedBy);

      // Try to sync with server (non-blocking)
      try {
        const decrementResult = await licenseService.decrementUserCount();
        if (decrementResult.success) {
          logger.info('User count decremented in license server', {
            userCount: decrementResult.userCount,
            userLimit: decrementResult.userLimit,
          });
        } else {
          // Queue for later sync
          const { OperationQueueService } = await import('../services/sync/operation-queue.service');
          await OperationQueueService.queueOperation('decrementUserCount', { userId: id });
          logger.warn('User deleted offline, will sync when online', {
            userId: id,
            message: decrementResult.message,
          });
        }
      } catch (error) {
        // Queue for later sync
        const { OperationQueueService } = await import('../services/sync/operation-queue.service');
        await OperationQueueService.queueOperation('decrementUserCount', { userId: id });
        logger.warn('User deleted offline, will sync when online', {
          userId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return { success: true };
    } catch (error) {
      logger.error('Error in user:delete handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Check if users exist (public, no auth required)
   * IPC: user:hasUsers
   */
  ipcMain.handle('user:hasUsers', async () => {
    try {
      const hasUsers = await UserService.hasUsers();
      return { success: true, hasUsers };
    } catch (error) {
      logger.error('Error in user:hasUsers handler', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Get user limits from license
   * IPC: user:getLimits
   */
  ipcMain.handle('user:getLimits', async () => {
    try {
      const result = await licenseService.checkUserCreation();
      return {
        success: true,
        userCount: result.userCount,
        userLimit: result.userLimit,
        canCreate: result.canCreate,
        message: result.message,
      };
    } catch (error) {
      logger.error('Error in user:getLimits handler', error);
      return {
        success: false,
        userCount: 0,
        userLimit: 0,
        canCreate: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  });

  /**
   * Update own profile handler
   * IPC: user:updateProfile
   * Allows users to update their own username and password
   */
  ipcMain.handle(
    'user:updateProfile',
    async (
      _event,
      updates: { username?: string; currentPassword?: string; newPassword?: string },
      userId: number
    ) => {
      try {
        const prisma = databaseService.getClient();

        // Get current user
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          return {
            success: false,
            error: 'User not found',
          };
        }

        // Check if user is active
        if (!user.isActive) {
          return {
            success: false,
            error: 'Account is disabled. Please contact administrator.',
          };
        }

        // Prepare update data
        const updateData: Prisma.UserUpdateInput = {};

        // Update username if provided
        if (updates.username !== undefined && updates.username !== user.username) {
          // Check if username is already taken
          const existingUser = await prisma.user.findFirst({
            where: {
              username: updates.username,
              id: { not: userId },
            },
          });

          if (existingUser) {
            return {
              success: false,
              error: 'Username is already taken',
            };
          }

          // Validate username
          if (updates.username.trim().length < 3) {
            return {
              success: false,
              error: 'Username must be at least 3 characters long',
            };
          }

          if (!/^[a-zA-Z0-9_]+$/.test(updates.username)) {
            return {
              success: false,
              error: 'Username can only contain letters, numbers, and underscores',
            };
          }

          updateData.username = updates.username.trim();
        }

        // Update password if provided
        if (updates.newPassword) {
          // Require current password for password changes
          if (!updates.currentPassword) {
            return {
              success: false,
              error: 'Current password is required to change password',
            };
          }

          // Verify current password
          const isPasswordValid = await bcrypt.compare(updates.currentPassword, user.password);
          if (!isPasswordValid) {
            return {
              success: false,
              error: 'Current password is incorrect',
            };
          }

          // Validate new password
          if (updates.newPassword.length < 6) {
            return {
              success: false,
              error: 'New password must be at least 6 characters long',
            };
          }

          // Hash new password
          const saltRounds = 10;
          updateData.password = await bcrypt.hash(updates.newPassword, saltRounds);
        }

        // If no changes, return success
        if (Object.keys(updateData).length === 0) {
          return {
            success: true,
            user: {
              id: user.id,
              username: user.username,
              phone: user.phone,
            },
          };
        }

        // Update user
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: updateData,
          select: {
            id: true,
            username: true,
            phone: true,
          },
        });

        logger.info('User profile updated successfully', {
          userId: user.id,
          username: user.username,
          changes: Object.keys(updateData),
        });

        return {
          success: true,
          user: updatedUser,
        };
      } catch (error) {
        logger.error('Error in user:updateProfile handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  logger.info('User management IPC handlers registered');
}

