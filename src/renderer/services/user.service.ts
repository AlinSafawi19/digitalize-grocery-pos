export interface User {
  id: number;
  username: string;
  email: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  username: string;
  email?: string | null;
  password: string;
  permissionIds?: number[]; // Optional: specific permissions to assign. If not provided, default cashier permissions will be used.
}

export interface UpdateUserInput {
  username?: string;
  email?: string | null;
  password?: string;
  isActive?: boolean;
  permissionIds?: number[]; // Optional: specific permissions to assign. If provided, replaces all existing permissions.
}

export interface UserListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}

export interface UserListResult {
  success: boolean;
  users?: User[];
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

/**
 * User Service (Renderer)
 * Handles user (cashier) management API calls via IPC
 */
export class UserService {
  /**
   * Get user by ID
   */
  static async getUserById(userId: number): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('user:getById', userId);
      return result as { success: boolean; user?: User; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get users list
   */
  static async getUsers(options: UserListOptions, currentUserId?: number): Promise<UserListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('user:getList', options, currentUserId);
      return result as UserListResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Create user (cashier)
   */
  static async createUser(input: CreateUserInput, createdBy: number, permissionIds?: number[]): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const createInput = {
        ...input,
        permissionIds: permissionIds || input.permissionIds,
      };
      const result = await window.electron.ipcRenderer.invoke('user:create', createInput, createdBy);
      return result as { success: boolean; user?: User; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Update user
   */
  static async updateUser(id: number, input: UpdateUserInput, updatedBy: number): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('user:update', id, input, updatedBy);
      return result as { success: boolean; user?: User; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(id: number, deletedBy: number): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('user:delete', id, deletedBy);
      return result as { success: boolean; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get user limits from license
   */
  static async getUserLimits(): Promise<{
    success: boolean;
    userCount?: number;
    userLimit?: number;
    canCreate?: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('user:getLimits');
      return result as {
        success: boolean;
        userCount?: number;
        userLimit?: number;
        canCreate?: boolean;
        message?: string;
        error?: string;
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}
