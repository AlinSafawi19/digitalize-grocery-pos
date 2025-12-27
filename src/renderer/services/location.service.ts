import { ipcRenderer } from 'electron';

// Location Types
export interface Location {
  id: number;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  isDefault: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface LocationListResult {
  success: boolean;
  locations?: Location[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  error?: string;
}

/**
 * Location Service
 * Handles location operations from renderer process
 */
export class LocationService {
  /**
   * Get location by ID
   */
  static async getById(id: number): Promise<Location | null> {
    try {
      const result = await ipcRenderer.invoke('location:getById', id);
      if (result.success && result.location) {
        return result.location;
      }
      return null;
    } catch (error) {
      console.error('Error getting location by ID', error);
      throw error;
    }
  }

  /**
   * Get all locations
   */
  static async getAll(activeOnly: boolean = false): Promise<Location[]> {
    try {
      const result = await ipcRenderer.invoke('location:getAll', activeOnly);
      if (result.success && result.locations) {
        return result.locations;
      }
      return [];
    } catch (error) {
      console.error('Error getting all locations', error);
      return [];
    }
  }

  /**
   * Get locations list
   */
  static async getList(options: LocationListOptions): Promise<LocationListResult> {
    try {
      const result = await ipcRenderer.invoke('location:getList', options);
      return result;
    } catch (error) {
      console.error('Error getting location list', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get location list',
      };
    }
  }

  /**
   * Create location
   */
  static async create(
    input: CreateLocationInput,
    createdById: number
  ): Promise<{ success: boolean; location?: Location; error?: string }> {
    try {
      const result = await ipcRenderer.invoke('location:create', input, createdById);
      return result;
    } catch (error) {
      console.error('Error creating location', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create location',
      };
    }
  }

  /**
   * Update location
   */
  static async update(
    id: number,
    input: UpdateLocationInput,
    updatedById: number
  ): Promise<{ success: boolean; location?: Location; error?: string }> {
    try {
      const result = await ipcRenderer.invoke('location:update', id, input, updatedById);
      return result;
    } catch (error) {
      console.error('Error updating location', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update location',
      };
    }
  }

  /**
   * Delete location
   */
  static async delete(
    id: number,
    deletedById: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await ipcRenderer.invoke('location:delete', id, deletedById);
      return result;
    } catch (error) {
      console.error('Error deleting location', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete location',
      };
    }
  }

  /**
   * Get default location
   */
  static async getDefault(): Promise<Location | null> {
    try {
      const result = await ipcRenderer.invoke('location:getDefault');
      if (result.success && result.location) {
        return result.location;
      }
      return null;
    } catch (error) {
      console.error('Error getting default location', error);
      return null;
    }
  }

  /**
   * Ensure default location exists
   */
  static async ensureDefault(createdById: number = 1): Promise<{ success: boolean; location?: Location; error?: string }> {
    try {
      const result = await ipcRenderer.invoke('location:ensureDefault', createdById);
      return result;
    } catch (error) {
      console.error('Error ensuring default location', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to ensure default location',
      };
    }
  }
}

