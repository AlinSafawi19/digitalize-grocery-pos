export interface Permission {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionListResult {
  success: boolean;
  permissions?: Permission[];
  error?: string;
}

/**
 * Permission Service (Renderer)
 * Handles permission API calls via IPC
 */

// Cache for permission checks to avoid redundant IPC calls
// Key format: `${userId}:${permissionCode}`
const permissionCache = new Map<string, { result: boolean; timestamp: number }>();
const CACHE_TTL = 60000; // Cache for 60 seconds

// Clear cache when user changes or on logout
export function clearPermissionCache() {
  permissionCache.clear();
}

/**
 * Permission Service (Renderer)
 * Handles permission API calls via IPC
 */
export class PermissionService {
  /**
   * Get all permissions
   */
  static async getAllPermissions(): Promise<PermissionListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('permission:getAll');
      return result as PermissionListResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get permissions by category
   */
  static async getPermissionsByCategory(category: string): Promise<PermissionListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('permission:getByCategory', category);
      return result as PermissionListResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get user permissions
   */
  static async getUserPermissions(userId: number): Promise<PermissionListResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('permission:getUserPermissions', userId);
      return result as PermissionListResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Check if user has a specific permission
   * Uses caching to avoid redundant IPC calls
   */
  static async userHasPermission(userId: number, permissionCode: string): Promise<boolean> {
    const cacheKey = `${userId}:${permissionCode}`;
    const now = Date.now();
    
    // Check cache first
    const cached = permissionCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      return cached.result;
    }

    try {
      const result = await window.electron.ipcRenderer.invoke('permission:userHasPermission', userId, permissionCode) as {
        success: boolean;
        hasPermission?: boolean;
      };
      const hasPermission = result.success && result.hasPermission === true;
      
      // Cache the result
      permissionCache.set(cacheKey, { result: hasPermission, timestamp: now });
      
      return hasPermission;
    } catch {
      // Cache negative result too
      permissionCache.set(cacheKey, { result: false, timestamp: now });
      return false;
    }
  }

  /**
   * Initialize default permissions in the database
   */
  static async initializeDefaultPermissions(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('permission:initializeDefaults') as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get default cashier permission codes
   */
  static getDefaultCashierPermissionCodes(): string[] {
    return [
      'transactions.view',
      'transactions.create',
      'transactions.update',
      'products.view',
      'categories.view',
      'inventory.view',
      'reports.view',
      'pricing.view',
    ];
  }

  /**
   * Assign permissions to user
   */
  static async assignPermissionsToUser(userId: number, permissionIds: number[]): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('permission:assignToUser', userId, permissionIds) as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

