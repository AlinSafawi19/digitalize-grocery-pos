import axios, { AxiosInstance } from 'axios';
import { LICENSE_SERVER_URL } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { licenseStorage, LicenseData } from './licenseStorage';
import { credentialsStorage } from './credentialsStorage';
import { getHardwareId, getMachineName } from './hardwareFingerprint';
import { UserService } from '../user/user.service';
import { databaseService } from '../database/database.service';
import { NotificationService } from '../notifications/notification.service';

/**
 * License activation input - matches server's ActivateLicenseInput
 * Location is automatically retrieved from the license, no need to provide it
 * @see DigitalizePOS-LicenseServer/src/services/publicLicense.service.ts
 */
export interface ActivateLicenseInput {
  licenseKey: string;
}

/**
 * License activation result - matches server's ActivateLicenseResult
 * @see DigitalizePOS-LicenseServer/src/services/publicLicense.service.ts
 */
export interface ActivateLicenseResult {
  success: boolean;
  message: string;
  expiresAt?: Date;
  gracePeriodEnd?: Date;
  token?: string;
  locationId?: number;
  locationName?: string;
  locationAddress?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  // User credentials if user was auto-created
  userCredentials?: {
    username: string;
    password: string;
  };
}

/**
 * License validation result - matches server's ValidateLicenseResult
 * @see DigitalizePOS-LicenseServer/src/services/publicLicense.service.ts
 */
export interface ValidateLicenseResult {
  valid: boolean;
  message: string;
  expiresAt?: Date;
  gracePeriodEnd?: Date;
  daysRemaining?: number;
}

export class LicenseService {
  private apiClient: AxiosInstance;
  private hardwareId: string;
  private machineName: string;
  private cachedLicenseData: LicenseData | null | undefined = undefined; // undefined = not loaded yet, null = no license
  private lastWarningNotificationDate: number | null = null; // Track last warning notification date to avoid duplicates

  constructor() {
    this.hardwareId = getHardwareId();
    this.machineName = getMachineName();
    
    this.apiClient = axios.create({
      baseURL: LICENSE_SERVER_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get default network database path for a license
   */
  private getDefaultNetworkDatabasePath(licenseKey: string): string {
    // Default pattern: \\server\digitalizePOS\{licenseKey}\digitalizePOS.db
    // Can be overridden via environment variable
    const networkServer = process.env.NETWORK_DB_SERVER || '\\\\server\\digitalizePOS';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    return path.join(networkServer, licenseKey, 'digitalizePOS.db');
  }

  /**
   * Clear license cache (call after activation/deactivation)
   */
  private clearCache(): void {
    this.cachedLicenseData = undefined;
  }

  /**
   * Send credentials via WhatsApp using the license server
   */
  private async sendCredentialsWhatsApp(data: {
    licenseKey: string;
    username: string;
    password: string;
    locationName: string;
    locationAddress: string;
    customerName?: string | null;
    customerPhone?: string | null;
  }): Promise<void> {
    try {
      // Only send WhatsApp message if customer phone is available
      if (!data.customerPhone) {
        logger.info('Skipping credentials WhatsApp message: customer phone not available');
        return;
      }

      logger.info('Sending credentials WhatsApp message...', { phone: data.customerPhone });
      
      const response = await this.apiClient.post('/api/license/send-credentials', {
        licenseKey: data.licenseKey,
        username: data.username,
        password: data.password,
        locationName: data.locationName,
        locationAddress: data.locationAddress,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
      });

      if (response.data.success) {
        logger.info('Credentials WhatsApp message sent successfully', { phone: data.customerPhone });
      } else {
        logger.warn('Credentials WhatsApp message may not have been sent', {
          phone: data.customerPhone,
          message: response.data.message,
        });
      }
    } catch (error: unknown) {
      // Don't throw - just log the error
      const err = error as { message?: string };
      logger.error('Error sending credentials WhatsApp message', {
        error: err.message,
        phone: data.customerPhone,
      });
      // Re-throw only for logging purposes, but caller should catch it
      throw error;
    }
  }

  /**
   * Activate a license key
   */
  async activateLicense(input: ActivateLicenseInput): Promise<ActivateLicenseResult> {
    try {
      // Validate required fields
      if (!input.licenseKey || input.licenseKey.trim() === '') {
        return {
          success: false,
          message: 'License key is required',
        };
      }

      // Check if a license is already activated on this device
      // Allow reactivation of the same license, but block activation of a different license
      const existingLicense = await this.getLicenseStatus();
      if (existingLicense) {
        // Normalize both license keys for comparison
        const normalizedExistingKey = existingLicense.licenseKey.trim().toUpperCase().replace(/-/g, '');
        const normalizedNewKey = input.licenseKey.trim().toUpperCase().replace(/-/g, '');
        
        // If it's a different license, block activation
        if (normalizedExistingKey !== normalizedNewKey) {
          logger.warn('License activation blocked: device already has a different license activated', {
            existingLicenseKey: existingLicense.licenseKey.substring(0, 8) + '...',
            newLicenseKey: input.licenseKey.substring(0, 8) + '...',
          });
          return {
            success: false,
            message: 'This device already has a license activated. You cannot activate a different license on the same device. If you need more users, please contact your license supplier to add more users to your existing license.',
          };
        }
        // If it's the same license, allow the activation to proceed (server will handle reactivation logic)
        logger.info('Same license detected, allowing reactivation attempt', {
          licenseKey: input.licenseKey.substring(0, 8) + '...',
        });
      }

      logger.info('Activating license...', { licenseKey: input.licenseKey.substring(0, 8) + '...' });
      
      // Location is automatically retrieved from the license on the server
      const requestBody: {
        licenseKey: string;
        hardwareId: string;
        machineName: string;
        appType: 'grocery';
      } = {
        licenseKey: input.licenseKey,
        hardwareId: this.hardwareId,
        machineName: this.machineName,
        appType: 'grocery', // This is the grocery POS application
      };

      const response = await this.apiClient.post('/api/license/activate', requestBody);

      if (response.data.success) {
        // Check if this is a reactivation of an already active license
        const isReactivatingActive = response.data.isReactivatingActive === true;
        
        // If reactivating an active license, preserve existing expiration date and data
        let existingLicenseData: LicenseData | null = null;
        if (isReactivatingActive) {
          existingLicenseData = await this.getLicenseStatus();
          if (existingLicenseData) {
            logger.info('Reactivating active license - preserving existing expiration date and data', {
              existingExpiresAt: new Date(existingLicenseData.expiresAt).toISOString(),
            });
          }
        }

        // Validate that expiry info is present - if not, treat activation as failed (fail-safe)
        // For reactivation of active license, we'll use existing expiration date
        if (!isReactivatingActive && !response.data.expiresAt) {
          logger.error('License activation succeeded but expiry info is missing - activation cancelled');
          return {
            success: false,
            message: 'License activation failed: expiry information is missing from server response.',
          };
        }

        // Determine network database path for shared database
        // Check if network database already exists (another device activated this license)
        let networkDbPath: string | undefined;
        const defaultNetworkPath = this.getDefaultNetworkDatabasePath(input.licenseKey);
        
        // Check if network database exists and is accessible
        const { databaseService } = await import('../database/database.service');
        const networkDbExists = await databaseService.checkNetworkDatabaseExists(defaultNetworkPath);
        
        if (networkDbExists) {
          // Network database exists - use it (another device already activated)
          networkDbPath = defaultNetworkPath;
          logger.info('Network database found for license, will use shared database', {
            licenseKey: input.licenseKey.substring(0, 8) + '...',
            networkPath: networkDbPath,
          });
          
          // Reinitialize database to use network path BEFORE user operations
          try {
            // Temporarily set network path in license data cache for database service to pick up
            this.cachedLicenseData = {
              ...this.cachedLicenseData!,
              networkDbPath: defaultNetworkPath,
            } as LicenseData;
            
            // Reinitialize database with network path
            await databaseService.reinitialize();
            logger.info('Database reinitialized with network path before user operations');
          } catch (reinitError) {
            logger.error('Failed to reinitialize database with network path', {
              error: reinitError instanceof Error ? reinitError.message : String(reinitError),
            });
            // Continue - will use local database as fallback
          }
        } else {
          // Check if this is the first device (local database is empty or doesn't exist)
          const localDbExists = await databaseService.databaseExists();
          if (!localDbExists) {
            // First device - use default network path (will be created)
            networkDbPath = defaultNetworkPath;
            logger.info('First device activation - will use network database', {
              licenseKey: input.licenseKey.substring(0, 8) + '...',
              networkPath: networkDbPath,
            });
            
            // Reinitialize database to use network path BEFORE user operations
            try {
              // Temporarily set network path in license data cache
              this.cachedLicenseData = {
                ...this.cachedLicenseData!,
                networkDbPath: defaultNetworkPath,
              } as LicenseData;
              
              // Reinitialize database with network path
              await databaseService.reinitialize();
              logger.info('Database reinitialized with network path (first device)');
            } catch (reinitError) {
              logger.error('Failed to reinitialize database with network path', {
                error: reinitError instanceof Error ? reinitError.message : String(reinitError),
              });
              // Continue - will use local database as fallback
            }
          } else {
            // Local database exists - keep using local (migration scenario)
            // Don't set networkDbPath, will use local database
            logger.info('Local database exists, will continue using local database', {
              licenseKey: input.licenseKey.substring(0, 8) + '...',
            });
          }
        }

        // Prepare license data (but don't save yet - wait until all operations succeed)
        // If reactivating active license, preserve existing expiration date; otherwise use server date
        const licenseData: LicenseData = {
          licenseKey: input.licenseKey,
          hardwareId: this.hardwareId,
          locationName: response.data.locationName,
          locationAddress: response.data.locationAddress,
          activatedAt: isReactivatingActive && existingLicenseData 
            ? existingLicenseData.activatedAt  // Preserve original activation date
            : Date.now(),
          expiresAt: isReactivatingActive && existingLicenseData
            ? existingLicenseData.expiresAt  // Preserve existing expiration date
            : new Date(response.data.expiresAt).getTime(),
          gracePeriodEnd: isReactivatingActive && existingLicenseData
            ? existingLicenseData.gracePeriodEnd  // Preserve existing grace period
            : (response.data.gracePeriodEnd ? new Date(response.data.gracePeriodEnd).getTime() : 0),
          lastValidation: Date.now(),
          validationToken: response.data.token || '',
          networkDbPath, // Store network database path
          version: 1,
        };

        // Update cache BEFORE user creation so that initializeDefaultSettings() can access license data
        // This ensures store information (locationName, locationAddress) is auto-populated during settings initialization
        this.cachedLicenseData = licenseData;

        // Auto-create user on first activation (if no users exist)
        let userCredentials: { username: string; password: string } | undefined;
        let activationSucceeded = false;
        
        // Ensure database is initialized and ready - this is critical for user creation
        try {
          if (!databaseService.isReady()) {
            logger.info('Database not ready, initializing...');
            try {
              await databaseService.initialize();
              // Wait a bit to ensure database is fully ready
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (initError: unknown) {
              const initErr = initError as { message?: string };
              logger.error('Database initialization failed during license activation', {
                error: initErr.message,
                note: 'This may be due to missing migrations. Activation will be cancelled.',
              });
              throw new Error(`Database initialization failed: ${initErr.message || 'Unknown error'}`);
            }
          }

          // Verify database is ready before proceeding
          if (!databaseService.isReady()) {
            throw new Error('Database initialization failed - database is not ready');
          }

          // Verify User table exists (migrations completed successfully)
          try {
            const prisma = databaseService.getClient();
            await prisma.$queryRaw`SELECT 1 FROM User LIMIT 1`;
            logger.info('User table verified - migrations completed successfully');
          } catch (verifyError: unknown) {
            const verifyErr = verifyError as { code?: string; message?: string };
            if (verifyErr.code === 'P2010' || verifyErr.code === 'P2021' || verifyErr.message?.includes('does not exist') || verifyErr.message?.includes('no such table')) {
              logger.error('CRITICAL: User table does not exist - migrations may have failed');
              throw new Error('Database migrations failed - User table does not exist. Please check migration logs.');
            }
            throw verifyError;
          }

          logger.info('Database is ready, checking for existing users...');
          
          // Only proceed with user creation if database is ready
          const hasUsers = await UserService.hasUsers();
          
          // Log for debugging
          logger.info('License activation - checking for existing users', { 
            hasUsers, 
            isReactivatingActive 
          });
          
          // Don't create user if reactivating an already active license (preserve existing data)
          // Only create user if this is a new activation or reactivating a deactivated license
          if (!hasUsers && !isReactivatingActive) {
            const customerName = response.data.customerName;
            const customerPhone = response.data.customerPhone;
            
            // Generate credentials first (so we can return them even if creation fails)
            // Use phone number or customer name for username generation
            const username = UserService.generateUsername(customerPhone || customerName || 'user', customerName);
            const password = UserService.generateDefaultPassword(customerPhone || customerName || 'user', customerName);
            
            logger.info('No users exist - creating user with credentials', { 
              username,
              phone: customerPhone,
              name: customerName 
            });
            
            try {
              const user = await UserService.createUser({
                username,
                phone: null, // Phone will be set from customer phone if available
                password,
              });

              // Verify user was actually created by checking if it exists
              logger.info('User creation returned, verifying user exists...', { userId: user.id, username });
              
              // Double-check user exists in database (with retry in case of timing issues)
              let verifyUser = null;
              let retries = 3;
              while (retries > 0 && !verifyUser) {
                verifyUser = await UserService.getUserById(user.id);
                if (!verifyUser) {
                  retries--;
                  if (retries > 0) {
                    logger.warn(`User not found, retrying... (${retries} retries left)`);
                    await new Promise(resolve => setTimeout(resolve, 200));
                  }
                }
              }
              
              if (!verifyUser) {
                // Final check using hasUsers to see if ANY user exists
                const hasAnyUsers = await UserService.hasUsers();
                if (hasAnyUsers) {
                  logger.warn('User creation verification failed, but users exist in database - user may have been created');
                  // Continue anyway - user might exist but verification failed
                } else {
                  throw new Error(`User creation reported success but user ${user.id} not found in database after retries`);
                }
              } else {
                logger.info('User verified in database', { 
                  userId: verifyUser.id, 
                  username: verifyUser.username,
                  phone: verifyUser.phone 
                });
              }

              // Credentials are sent via WhatsApp only, not returned to UI
              // Store credentials for logging purposes only (not returned to UI)
              userCredentials = { username, password };
              
              logger.info('User created and verified - credentials will be sent via WhatsApp only', { 
                userId: user.id, 
                username,
                hasCredentials: !!userCredentials 
              });

              // Save credentials persistently so they can be retrieved later if missed
              try {
                await credentialsStorage.save({
                  username,
                  password,
                  createdAt: Date.now(),
                  licenseKey: input.licenseKey,
                });
                logger.info('Credentials saved to persistent storage', { username });
              } catch (saveError) {
                // Log but don't fail if saving credentials fails
                logger.error('Failed to save credentials to persistent storage', saveError);
              }

              // Send credentials via WhatsApp (non-blocking, don't fail activation if this fails)
              try {
                await this.sendCredentialsWhatsApp({
                  licenseKey: input.licenseKey,
                  username,
                  password,
                  locationName: response.data.locationName || '',
                  locationAddress: response.data.locationAddress || '',
                  customerName: response.data.customerName,
                  customerPhone: response.data.customerPhone,
                });
              } catch (whatsappError) {
                // Log but don't fail activation if WhatsApp sending fails
                logger.warn('Failed to send credentials WhatsApp message (activation still successful)', {
                  error: whatsappError instanceof Error ? whatsappError.message : 'Unknown error',
                });
              }

              logger.info('User auto-created during license activation', {
                userId: user.id,
                username: user.username,
                phone: user.phone,
                note: `Default password: ${password}`,
              });
              
              activationSucceeded = true;
            } catch (userError: unknown) {
              // Log the full error details for debugging
              const userErr = userError as { message?: string; stack?: string };
              logger.error('Failed to create user during license activation', {
                error: userErr.message,
                stack: userErr.stack,
                username,
                phone: customerPhone,
                name: customerName,
              });
              
              // User creation failed - do not proceed with activation
              throw new Error(`Failed to create user during activation: ${userErr.message || 'Unknown error'}`);
            }
          } else {
            logger.info('Users already exist, skipping user creation');
            
            // If reactivating an active license, skip sync to preserve existing data
            if (isReactivatingActive) {
              logger.info('Reactivating active license - skipping user count sync to preserve data');
              activationSucceeded = true;
            } else {
              // If users already exist, this is likely a reactivation of a deactivated license
              // Sync user count with license server to ensure accuracy
              // If sync fails, we should not proceed with activation
              const syncResult = await this.syncUserCount();
              if (!syncResult.success) {
                logger.error('Failed to sync user count after reactivation', {
                  message: syncResult.message,
                });
                throw new Error(`Failed to sync user count with license server: ${syncResult.message || 'Unknown error'}`);
              }
              
              logger.info('User count synced successfully after reactivation', {
                userCount: syncResult.userCount,
                userLimit: syncResult.userLimit,
              });
              
              activationSucceeded = true;
            }
          }
        } catch (dbError: unknown) {
          // Database initialization, user creation, or sync failed - do not activate
          const err = dbError as { message?: string; stack?: string; constructor?: { name?: string } };
          logger.error('Failed during license activation - activation cancelled', {
            error: err.message,
            stack: err.stack,
            errorType: err.constructor?.name,
          });
          
          // Clear cache since activation failed
          this.cachedLicenseData = null;
          
          // Return error - do not save license data
          return {
            success: false,
            message: err.message || 'Failed to complete license activation. Please try again.',
          };
        }

        // Only save license data if all operations succeeded
        if (activationSucceeded) {
          await licenseStorage.save(licenseData);
          
          // Update cache
          this.cachedLicenseData = licenseData;
          
          // Database was already reinitialized earlier if network path was set
          // Just log success
          logger.info('License activated successfully', {
            networkDbPath: networkDbPath || 'local database',
          });
          
          // Log what we're returning
          logger.info('Returning activation result', { 
            success: true, 
            credentialsSentViaWhatsApp: !!userCredentials,
            userCredentialsUsername: userCredentials?.username 
          });
          
          return {
            success: true,
            message: response.data.message || 'License activated successfully',
            expiresAt: new Date(response.data.expiresAt),
            gracePeriodEnd: new Date(response.data.gracePeriodEnd),
            token: response.data.token,
            locationId: response.data.locationId,
            locationName: response.data.locationName,
            locationAddress: response.data.locationAddress,
            customerName: response.data.customerName,
            customerPhone: response.data.customerPhone,
            // Also return credentials so UI can display them on first activation
            // (credentials are still sent via WhatsApp and stored securely)
            userCredentials,
          };
        } else {
          logger.error('License activation did not complete successfully - not saving license data');
          // Clear cache since activation failed
          this.cachedLicenseData = null;
          return {
            success: false,
            message: 'License activation failed. Please try again.',
          };
        }
      } else {
        logger.warn('License activation failed', { message: response.data.message });
        return {
          success: false,
          message: response.data.message || 'License activation failed',
        };
      }
    } catch (error: unknown) {
      logger.error('License activation error', error);
      const err = error as { code?: string; response?: { data?: { message?: string } }; message?: string };
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        return {
          success: false,
          message: 'Cannot connect to license server. Please check your internet connection.',
        };
      }
      
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to activate license',
      };
    }
  }

  /**
   * Validate license (online validation)
   */
  async validateLicense(licenseKey?: string): Promise<ValidateLicenseResult> {
    try {
      // Load license data if key not provided
      let key = licenseKey;
      if (!key) {
        const licenseData = await this.getLicenseStatus();
        if (!licenseData) {
          return {
            valid: false,
            message: 'No license found. Please activate a license.',
          };
        }
        key = licenseData.licenseKey;
      }

      logger.info('Validating license...', { licenseKey: key.substring(0, 8) + '...' });
      
      const response = await this.apiClient.post('/api/license/validate', {
        licenseKey: key,
        hardwareId: this.hardwareId, // Optional - sent for tracking but not required
      });

      if (response.data.valid) {
        // Check if expiry info is present - if not, treat as invalid (fail-safe)
        if (!response.data.expiresAt) {
          logger.error('License validation returned valid but no expiry info - treating as invalid');
          return {
            valid: false,
            message: 'License validation failed: expiry information is missing',
          };
        }

        // Update license data
        const licenseData = await this.getLicenseStatus();
        if (licenseData) {
          licenseData.lastValidation = Date.now();
          if (response.data.expiresAt) {
            licenseData.expiresAt = new Date(response.data.expiresAt).getTime();
          }
          if (response.data.gracePeriodEnd) {
            licenseData.gracePeriodEnd = new Date(response.data.gracePeriodEnd).getTime();
          }
          if (response.data.token) {
            licenseData.validationToken = response.data.token;
          }
          await licenseStorage.save(licenseData);
          // Update cache
          this.cachedLicenseData = licenseData;
        }
        
        logger.info('License validated successfully');
        
        // Check and create expiration warning notifications if needed
        if (response.data.daysRemaining !== undefined) {
          await this.checkAndCreateExpirationNotification(response.data.daysRemaining);
        }
        
        return {
          valid: true,
          message: response.data.message || 'License is valid',
          expiresAt: response.data.expiresAt ? new Date(response.data.expiresAt) : undefined,
          gracePeriodEnd: response.data.gracePeriodEnd ? new Date(response.data.gracePeriodEnd) : undefined,
          daysRemaining: response.data.daysRemaining,
        };
      } else {
        logger.warn('License validation failed', { message: response.data.message });
        return {
          valid: false,
          message: response.data.message || 'License validation failed',
        };
      }
    } catch (error: unknown) {
      logger.error('License validation error', error);
      const err = error as { code?: string; response?: { data?: { message?: string } }; message?: string };
      // If offline, check cached validation
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        return this.validateCachedLicense();
      }
      
      return {
        valid: false,
        message: err.response?.data?.message || err.message || 'Failed to validate license',
      };
    }
  }

  /**
   * Validate cached license (offline validation)
   * Checks if cached validation is still valid (max 14 days)
   */
  async validateCachedLicense(): Promise<ValidateLicenseResult> {
    try {
      const licenseData = await this.getLicenseStatus();
      
      if (!licenseData) {
        return {
          valid: false,
          message: 'No license found. Please activate a license.',
        };
      }

      // Hardware ID check removed - users can login from any device

      // Check if expiry info exists - if not, treat as expired (fail-safe)
      if (!licenseData.expiresAt) {
        logger.warn('No expiry info in cached license data - treating as expired');
        return {
          valid: false,
          message: 'License expiry information is missing. Please connect to the internet to validate.',
        };
      }

      // Check if cached validation is still valid (max 14 days)
      const daysSinceValidation = (Date.now() - licenseData.lastValidation) / (1000 * 60 * 60 * 24);
      if (daysSinceValidation > 14) {
        return {
          valid: false,
          message: 'Cached license validation expired. Please connect to the internet to validate.',
        };
      }

      // Check if license expired (no grace period - expiration is exact end date)
      const now = Date.now();
      if (now > licenseData.expiresAt) {
        return {
          valid: false,
          message: 'License has expired. Please renew your subscription.',
        };
      }

      // License is valid
      const daysRemaining = Math.ceil((licenseData.expiresAt - now) / (1000 * 60 * 60 * 24));
      
      // Check and create expiration warning notifications if needed
      await this.checkAndCreateExpirationNotification(daysRemaining);
      
      return {
        valid: true,
        message: 'License is valid (cached validation)',
        expiresAt: new Date(licenseData.expiresAt),
        gracePeriodEnd: new Date(licenseData.gracePeriodEnd),
        daysRemaining,
      };
    } catch (error) {
      logger.error('Cached license validation error', error);
      return {
        valid: false,
        message: 'Failed to validate cached license',
      };
    }
  }

  /**
   * Refresh license status from server (clears cache and validates)
   * Useful after payments to get updated expiration date
   */
  async refreshLicenseStatus(): Promise<LicenseData | null> {
    this.clearCache();
    await this.validateLicense();
    return this.getLicenseStatus();
  }

  /**
   * Get current license status (with caching)
   */
  async getLicenseStatus(): Promise<LicenseData | null> {
    if (this.cachedLicenseData !== undefined) {
      return this.cachedLicenseData;
    }
    this.cachedLicenseData = await licenseStorage.load();
    return this.cachedLicenseData;
  }

  /**
   * Check if license is activated (with caching)
   * Note: This checks for local license file. For cross-device access, use isValid() instead.
   */
  async isActivated(): Promise<boolean> {
    if (this.cachedLicenseData !== undefined) {
      return this.cachedLicenseData !== null;
    }
    this.cachedLicenseData = await licenseStorage.load();
    return this.cachedLicenseData !== null;
  }

  /**
   * Check if license is valid (works across devices)
   * Validates online - if local license not found, tries to validate using location info from settings
   * This allows users to login from any device with valid credentials
   */
  async isValid(): Promise<boolean> {
    try {
      // First check if we have local license data
      const licenseData = await this.getLicenseStatus();
      if (licenseData) {
        // If we have local data, validate it
        const validation = await this.validateLicense();
        return validation.valid;
      }

      // If no local license file (e.g., on a different device), we can still validate
      // by checking if there are users in the database (which means license was activated before)
      // and the license server will validate based on location/subscription
      // For now, if users exist, assume license is valid (will be validated on first API call)
      // This allows login from any device
      try {
        const hasUsers = await UserService.hasUsers();
        if (hasUsers) {
          // Users exist, which means license was activated before
          // License validation will happen on first API call (e.g., when checking expiration)
          // For now, return true to allow access - actual validation happens in isExpired()
          return true;
        }
      } catch (error) {
        logger.error('Error checking for users', error);
      }

      // No users and no local license - license not activated yet
      return false;
    } catch (error) {
      logger.error('Error checking license validity', error);
      return false;
    }
  }

  /**
   * Check if license is expired
   * Attempts to validate with server first to refresh cache, then falls back to cached data if offline
   * If expiry info cannot be obtained, treats license as expired (fail-safe)
   * Works across devices - if no local license, checks if users exist (license was activated)
   */
  async isExpired(): Promise<boolean> {
    const licenseData = await this.getLicenseStatus();
    if (!licenseData) {
      // No local license file (e.g., on different device)
      // Check if users exist - if they do, license was activated before
      // We can't validate without license key, so we'll need to get it from settings or validate differently
      // For now, if users exist, assume license might be valid (but we can't check expiration without key)
      // Return false (not expired) to allow access - actual validation will happen on API calls
      try {
        const hasUsers = await UserService.hasUsers();
        if (hasUsers) {
          // Users exist - license was activated before, allow access
          // Note: We can't check actual expiration without license key
          // The license server will validate on API calls
          return false; // Assume not expired if users exist
        }
      } catch (error) {
        logger.error('Error checking for users in isExpired', error);
      }
      return true; // No license and no users means expired/not activated
    }

    // Try to validate with server to refresh cache (especially after payments)
    // This ensures we get the latest expiration date from the server
    try {
      const validationResult = await this.validateLicense();
      if (validationResult.valid && validationResult.expiresAt) {
        // Cache was updated by validateLicense, get fresh data
        const updatedLicenseData = await this.getLicenseStatus();
        if (updatedLicenseData && updatedLicenseData.expiresAt) {
          const now = Date.now();
          return now > updatedLicenseData.expiresAt;
        } else {
          // If we can't get expiry info after validation, treat as expired (fail-safe)
          logger.warn('License validation succeeded but expiry info is missing - treating as expired');
          return true;
        }
      } else {
        // Validation failed or no expiry info - treat as expired (fail-safe)
        logger.warn('License validation failed or expiry info missing - treating as expired');
        return true;
      }
    } catch (error) {
      // If validation fails (e.g., offline), check cached data
      logger.debug('License validation failed in isExpired, checking cached data', error);
      
      // If cached data has expiry info, use it
      if (licenseData.expiresAt) {
        const now = Date.now();
        return now > licenseData.expiresAt;
      } else {
        // No expiry info in cache - treat as expired (fail-safe)
        logger.warn('No expiry info available in cache - treating as expired');
        return true;
      }
    }
  }

  /**
   * Get payment history for the current license
   */
  async getPaymentHistory(): Promise<Array<{
    id: number;
    amount: number;
    paymentDate: Date | string; // Can be Date or UTC string from API
    isAnnualSubscription?: boolean;
    paymentType?: 'initial' | 'annual' | 'user';
  }>> {
    try {
      const licenseData = await this.getLicenseStatus();
      if (!licenseData) {
        logger.warn('No license found for payment history');
        return [];
      }

      logger.info('Fetching payment history...', { licenseKey: licenseData.licenseKey.substring(0, 8) + '...' });
      
      const response = await this.apiClient.get(`/api/license/${encodeURIComponent(licenseData.licenseKey)}`);

      // Log response structure for debugging
      logger.debug('Payment history API response', {
        hasSuccess: !!response.data.success,
        hasData: !!response.data.data,
        hasPayments: !!response.data.data?.payments,
        paymentsType: Array.isArray(response.data.data?.payments) ? 'array' : typeof response.data.data?.payments,
        paymentsLength: Array.isArray(response.data.data?.payments) ? response.data.data.payments.length : 'N/A',
      });

      if (response.data.success && response.data.data?.payments) {
        const payments = response.data.data.payments.map((payment: { id: number; amount: number | string; paymentDate: string; isAnnualSubscription?: boolean; paymentType?: 'initial' | 'annual' | 'user' }) => ({
          id: payment.id,
          amount: parseFloat(payment.amount.toString()),
          // Keep as string to preserve UTC, formatDate will handle timezone conversion
          paymentDate: payment.paymentDate,
          isAnnualSubscription: payment.isAnnualSubscription || false,
          paymentType: payment.paymentType,
        }));
        
        logger.info('Payment history fetched successfully', { count: payments.length });
        return payments;
      }

      // Log why payments weren't returned
      if (!response.data.success) {
        logger.warn('Payment history API returned success: false', { message: response.data.message });
      } else if (!response.data.data) {
        logger.warn('Payment history API response missing data field');
      } else if (!response.data.data.payments) {
        logger.warn('Payment history API response missing payments field', {
          availableFields: Object.keys(response.data.data || {}),
        });
      }

      return [];
    } catch (error: unknown) {
      logger.error('Error fetching payment history', error);
      const err = error as { code?: string };
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        logger.warn('Cannot connect to license server for payment history');
        return [];
      }
      
      return [];
    }
  }

  /**
   * Get subscription information including next payment fee
   */
  async getSubscriptionInfo(): Promise<{
    nextPaymentFee: number | null;
    nextPaymentDate: Date | null;
    currentSubscription: {
      annualFee: number;
      endDate: Date;
      status: string;
    } | null;
  }> {
    try {
      const licenseData = await this.getLicenseStatus();
      if (!licenseData) {
        logger.warn('No license found for subscription info');
        return {
          nextPaymentFee: null,
          nextPaymentDate: null,
          currentSubscription: null,
        };
      }

      logger.info('Fetching subscription info...', { licenseKey: licenseData.licenseKey.substring(0, 8) + '...' });
      
      const response = await this.apiClient.get(`/api/license/${encodeURIComponent(licenseData.licenseKey)}`);

      if (response.data.success && response.data.data) {
        const licenseInfo = response.data.data;
        const subscriptions = licenseInfo.subscriptions || [];
        const isFreeTrial = licenseInfo.isFreeTrial || false;
        const userLimit = licenseInfo.userLimit || 2;
        const initialPrice = licenseInfo.initialPrice ? parseFloat(licenseInfo.initialPrice.toString()) : 350;
        const pricePerUser = licenseInfo.pricePerUser ? parseFloat(licenseInfo.pricePerUser.toString()) : 25;
        
        // Find active subscription or the most recent one
        const activeSubscription = subscriptions.find((sub: { status: string }) => sub.status === 'active') || subscriptions[0];
        
        if (activeSubscription) {
          const endDate = new Date(activeSubscription.endDate);
          const annualPrice = parseFloat(activeSubscription.annualFee.toString());
          let nextPaymentFee: number;
          
          if (isFreeTrial) {
            // If free trial: next fee = initial price + extra users cost (if userLimit > 2)
            let extraUserCost = 0;
            if (userLimit > 2) {
              const extraUsers = userLimit - 2;
              extraUserCost = extraUsers * pricePerUser;
            }
            nextPaymentFee = initialPrice + extraUserCost;
            logger.info('Free trial - calculating next payment fee', { 
              initialPrice, 
              userLimit,
              pricePerUser,
              extraUsers: userLimit > 2 ? userLimit - 2 : 0,
              extraUserCost, 
              nextPaymentFee 
            });
          } else {
            // If not free trial: next fee = annual price
            nextPaymentFee = annualPrice;
            logger.info('Not free trial - using annual price', { nextPaymentFee });
          }
          
          return {
            nextPaymentFee,
            nextPaymentDate: endDate,
            currentSubscription: {
              annualFee: parseFloat(activeSubscription.annualFee.toString()),
              endDate,
              status: activeSubscription.status,
            },
          };
        }
      }

      return {
        nextPaymentFee: null,
        nextPaymentDate: null,
        currentSubscription: null,
      };
    } catch (error: unknown) {
      logger.error('Error fetching subscription info', error);
      const err = error as { code?: string };
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        logger.warn('Cannot connect to license server for subscription info');
      }
      
      return {
        nextPaymentFee: null,
        nextPaymentDate: null,
        currentSubscription: null,
      };
    }
  }

  /**
   * Check if user creation is allowed
   * @returns Promise<{ canCreate: boolean; userCount: number; userLimit: number; message?: string }>
   */
  async checkUserCreation(): Promise<{
    canCreate: boolean;
    userCount: number;
    userLimit: number;
    message?: string;
  }> {
    try {
      const licenseData = await this.getLicenseStatus();
      if (!licenseData) {
        return {
          canCreate: false,
          userCount: 0,
          userLimit: 0,
          message: 'No license found. Please activate a license first.',
        };
      }

      logger.info('Checking if user creation is allowed...', {
        licenseKey: licenseData.licenseKey.substring(0, 8) + '...',
      });

      const response = await this.apiClient.post('/api/license/check-user-creation', {
        licenseKey: licenseData.licenseKey,
        hardwareId: this.hardwareId, // Optional - sent for tracking but not required
      });

      if (response.data.success) {
        return {
          canCreate: response.data.data.canCreate,
          userCount: response.data.data.userCount,
          userLimit: response.data.data.userLimit,
          message: response.data.data.message,
        };
      } else {
        return {
          canCreate: false,
          userCount: response.data.data?.userCount || 0,
          userLimit: response.data.data?.userLimit || 0,
          message: response.data.message || 'Failed to check user creation status',
        };
      }
    } catch (error: unknown) {
      logger.error('Error checking user creation', error);
      const err = error as { code?: string; response?: { data?: { message?: string } }; message?: string };
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        return {
          canCreate: false,
          userCount: 0,
          userLimit: 0,
          message: 'Cannot connect to license server. Please check your internet connection.',
        };
      }
      return {
        canCreate: false,
        userCount: 0,
        userLimit: 0,
        message: err.response?.data?.message || err.message || 'Failed to check user creation status',
      };
    }
  }

  /**
   * Increment user count when a user is created
   * @returns Promise<{ success: boolean; userCount: number; userLimit: number; message: string }>
   */
  async incrementUserCount(): Promise<{
    success: boolean;
    userCount: number;
    userLimit: number;
    message: string;
  }> {
    try {
      const licenseData = await this.getLicenseStatus();
      if (!licenseData) {
        return {
          success: false,
          userCount: 0,
          userLimit: 0,
          message: 'No license found. Please activate a license first.',
        };
      }

      logger.info('Incrementing user count in license server...', {
        licenseKey: licenseData.licenseKey.substring(0, 8) + '...',
      });

      const response = await this.apiClient.post('/api/license/increment-user-count', {
        licenseKey: licenseData.licenseKey,
        hardwareId: this.hardwareId, // Optional - sent for tracking but not required
      });

      if (response.data.success) {
        return {
          success: true,
          userCount: response.data.data.userCount,
          userLimit: response.data.data.userLimit,
          message: response.data.data.message || response.data.message || 'User count incremented successfully',
        };
      } else {
        return {
          success: false,
          userCount: response.data.data?.userCount || 0,
          userLimit: response.data.data?.userLimit || 0,
          message: response.data.message || 'Failed to increment user count',
        };
      }
    } catch (error: unknown) {
      logger.error('Error incrementing user count', error);
      const err = error as { code?: string; response?: { data?: { message?: string } }; message?: string };
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        return {
          success: false,
          userCount: 0,
          userLimit: 0,
          message: 'Cannot connect to license server. Please check your internet connection.',
        };
      }
      return {
        success: false,
        userCount: 0,
        userLimit: 0,
        message: err.response?.data?.message || err.message || 'Failed to increment user count',
      };
    }
  }

  /**
   * Decrement user count when a user is deleted
   * @returns Promise<{ success: boolean; userCount: number; userLimit: number; message: string }>
   */
  async decrementUserCount(): Promise<{
    success: boolean;
    userCount: number;
    userLimit: number;
    message: string;
  }> {
    try {
      const licenseData = await this.getLicenseStatus();
      if (!licenseData) {
        return {
          success: false,
          userCount: 0,
          userLimit: 0,
          message: 'No license found. Please activate a license first.',
        };
      }

      logger.info('Decrementing user count in license server...', {
        licenseKey: licenseData.licenseKey.substring(0, 8) + '...',
      });

      const response = await this.apiClient.post('/api/license/decrement-user-count', {
        licenseKey: licenseData.licenseKey,
        hardwareId: this.hardwareId, // Optional - sent for tracking but not required
      });

      if (response.data.success) {
        return {
          success: true,
          userCount: response.data.data.userCount,
          userLimit: response.data.data.userLimit,
          message: response.data.data.message || response.data.message || 'User count decremented successfully',
        };
      } else {
        return {
          success: false,
          userCount: response.data.data?.userCount || 0,
          userLimit: response.data.data?.userLimit || 0,
          message: response.data.message || 'Failed to decrement user count',
        };
      }
    } catch (error: unknown) {
      logger.error('Error decrementing user count', error);
      const err = error as { code?: string; response?: { data?: { message?: string } }; message?: string };
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        return {
          success: false,
          userCount: 0,
          userLimit: 0,
          message: 'Cannot connect to license server. Please check your internet connection.',
        };
      }
      return {
        success: false,
        userCount: 0,
        userLimit: 0,
        message: err.response?.data?.message || err.message || 'Failed to decrement user count',
      };
    }
  }

  /**
   * Sync user count with license server
   * Used when reactivating a license to ensure userCount matches actual users
   * @returns Promise<{ success: boolean; userCount: number; userLimit: number; message: string }>
   */
  async syncUserCount(): Promise<{
    success: boolean;
    userCount: number;
    userLimit: number;
    message: string;
  }> {
    try {
      const licenseData = await this.getLicenseStatus();
      if (!licenseData) {
        return {
          success: false,
          userCount: 0,
          userLimit: 0,
          message: 'No license found. Please activate a license first.',
        };
      }

      // Get actual user count from database
      const { UserService } = await import('../user/user.service');
      const actualUserCount = await UserService.getTotalUserCount();

      logger.info('Syncing user count with license server...', {
        licenseKey: licenseData.licenseKey.substring(0, 8) + '...',
        actualUserCount,
      });

      const response = await this.apiClient.post('/api/license/sync-user-count', {
        licenseKey: licenseData.licenseKey,
        hardwareId: this.hardwareId, // Optional - sent for tracking but not required
        actualUserCount,
      });

      if (response.data.success) {
        return {
          success: true,
          userCount: response.data.data.userCount,
          userLimit: response.data.data.userLimit,
          message: response.data.data.message || response.data.message || 'User count synced successfully',
        };
      } else {
        return {
          success: false,
          userCount: response.data.data?.userCount || 0,
          userLimit: response.data.data?.userLimit || 0,
          message: response.data.message || 'Failed to sync user count',
        };
      }
    } catch (error: unknown) {
      logger.error('Error syncing user count', error);
      const err = error as { code?: string; response?: { data?: { message?: string } }; message?: string };
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        return {
          success: false,
          userCount: 0,
          userLimit: 0,
          message: 'Cannot connect to license server. Please check your internet connection.',
        };
      }
      return {
        success: false,
        userCount: 0,
        userLimit: 0,
        message: err.response?.data?.message || err.message || 'Failed to sync user count',
      };
    }
  }

  /**
   * Check and create expiration warning notification if needed
   * Creates notifications for licenses expiring in 3 days or 1 day
   * Prevents duplicate notifications by checking if one was already created today
   */
  private async checkAndCreateExpirationNotification(daysRemaining: number): Promise<void> {
    try {
      // Only create notifications for 3 days and 1 day remaining
      if (daysRemaining !== 3 && daysRemaining !== 1) {
        return;
      }

      // Check if we've already created a notification for this warning level today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();
      
      // Use a simple in-memory check to avoid duplicate notifications on the same day
      // Reset if it's a new day
      if (this.lastWarningNotificationDate !== null) {
        const lastNotificationDate = new Date(this.lastWarningNotificationDate);
        lastNotificationDate.setHours(0, 0, 0, 0);
        if (lastNotificationDate.getTime() === todayTimestamp) {
          // Already created a notification today, skip
          return;
        }
      }

      // Check if a notification for this warning level already exists today
      const prisma = databaseService.getClient();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const existingNotification = await prisma.notification.findFirst({
        where: {
          type: 'license_warning',
          createdAt: {
            gte: todayStart,
            lte: todayEnd,
          },
          title: {
            contains: `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`,
          },
        },
      });

      if (existingNotification) {
        // Notification already exists for today, skip
        this.lastWarningNotificationDate = Date.now();
        return;
      }

      // Create the notification
      const licenseData = await this.getLicenseStatus();
      const isFreeTrial = licenseData?.expiresAt 
        ? Math.ceil((licenseData.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)) <= 10
        : false;

      const licenseType = isFreeTrial ? 'free trial' : 'license';
      const actionText = isFreeTrial
        ? 'purchase a full license to continue using DigitalizePOS'
        : 'renew your license to continue using DigitalizePOS';

      const message = daysRemaining === 1
        ? `⚠️ URGENT: Your ${licenseType} expires tomorrow! Please ${actionText} immediately to avoid service interruption.`
        : `Your ${licenseType} will expire in ${daysRemaining} days. Please ${actionText} before the expiration date to avoid service interruption.`;

      await NotificationService.createLicenseWarningNotification(message, daysRemaining);
      this.lastWarningNotificationDate = Date.now();

      logger.info('Expiration warning notification created', {
        daysRemaining,
        licenseType,
      });
    } catch (error) {
      logger.error('Failed to create expiration warning notification', error);
      // Don't throw - notification creation failure shouldn't break license validation
    }
  }

  /**
   * Initialize license service
   * Validates license on startup
   */
  async initialize(): Promise<ValidateLicenseResult> {
    logger.info('Initializing license service...');
    
    // Check if license is activated
    const isActivated = await this.isActivated();
    if (!isActivated) {
      logger.info('No license activated');
      return {
        valid: false,
        message: 'No license activated. Please activate a license to continue.',
      };
    }

    // Validate license (online first, fallback to cached)
    return await this.validateLicense();
  }
}

// Singleton instance
export const licenseService = new LicenseService();

