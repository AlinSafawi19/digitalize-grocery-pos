import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  LocationService,
  CreateLocationInput,
  UpdateLocationInput,
  LocationListOptions,
} from '../services/location/location.service';

/**
 * Register location management IPC handlers
 */
export function registerLocationHandlers(): void {
  logger.info('Registering location management IPC handlers...');

  /**
   * Get location by ID handler
   * IPC: location:getById
   */
  ipcMain.handle(
    'location:getById',
    async (_event, id: number) => {
      try {
        const location = await LocationService.getById(id);
        if (!location) {
          return {
            success: false,
            error: 'Location not found',
          };
        }

        return { success: true, location };
      } catch (error) {
        logger.error('Error in location:getById handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get all locations handler
   * IPC: location:getAll
   */
  ipcMain.handle(
    'location:getAll',
    async (_event, activeOnly: boolean = false) => {
      try {
        const locations = await LocationService.getAll(activeOnly);
        return { success: true, locations };
      } catch (error) {
        logger.error('Error in location:getAll handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get locations list handler
   * IPC: location:getList
   */
  ipcMain.handle(
    'location:getList',
    async (_event, options: LocationListOptions) => {
      try {
        const result = await LocationService.getList(options);
        return result;
      } catch (error) {
        logger.error('Error in location:getList handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Create location handler
   * IPC: location:create
   */
  ipcMain.handle(
    'location:create',
    async (_event, input: CreateLocationInput, createdById: number) => {
      try {
        const result = await LocationService.createLocation(input, createdById);
        return result;
      } catch (error) {
        logger.error('Error in location:create handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update location handler
   * IPC: location:update
   */
  ipcMain.handle(
    'location:update',
    async (_event, id: number, input: UpdateLocationInput, updatedById: number) => {
      try {
        const result = await LocationService.updateLocation(id, input, updatedById);
        return result;
      } catch (error) {
        logger.error('Error in location:update handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Delete location handler
   * IPC: location:delete
   */
  ipcMain.handle(
    'location:delete',
    async (_event, id: number, deletedById: number) => {
      try {
        const result = await LocationService.deleteLocation(id, deletedById);
        return result;
      } catch (error) {
        logger.error('Error in location:delete handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get default location handler
   * IPC: location:getDefault
   */
  ipcMain.handle(
    'location:getDefault',
    async () => {
      try {
        const location = await LocationService.getDefaultLocation();
        return { success: true, location };
      } catch (error) {
        logger.error('Error in location:getDefault handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Ensure default location exists handler
   * IPC: location:ensureDefault
   */
  ipcMain.handle(
    'location:ensureDefault',
    async (_event, createdById: number = 1) => {
      try {
        const result = await LocationService.ensureDefaultLocation(createdById);
        return result;
      } catch (error) {
        logger.error('Error in location:ensureDefault handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );
}

