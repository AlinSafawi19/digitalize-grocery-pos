import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { DATABASE_PATH, USER_DATA_PATH } from '../../utils/constants';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { app } from 'electron';


class DatabaseService {
  private prisma: PrismaClient | null = null;
  private isInitialized = false;
  private currentDbPath: string = DATABASE_PATH;
  private isNetworkDatabase: boolean = false;

  /**
   * Determine the database path to use (network or local)
   */
  private async determineDatabasePath(): Promise<string> {
    try {
      // Get license data to check for network database path
      // Use dynamic import to avoid circular dependency
      const { licenseService } = await import('../license/license.service');
      const licenseData = await licenseService.getLicenseStatus();
      
      if (licenseData?.networkDbPath) {
        // Check if network database is accessible
        const isAccessible = await this.isNetworkPathAccessible(licenseData.networkDbPath);
        if (isAccessible) {
          logger.info('Using network database', { path: licenseData.networkDbPath });
          this.isNetworkDatabase = true;
          return licenseData.networkDbPath;
        } else {
          logger.warn('Network database not accessible, falling back to local database', {
            networkPath: licenseData.networkDbPath,
            localPath: DATABASE_PATH,
          });
        }
      }
      
      // Use local database (default or fallback)
      logger.info('Using local database', { path: DATABASE_PATH });
      this.isNetworkDatabase = false;
      return DATABASE_PATH;
    } catch (error) {
      logger.error('Error determining database path, using local database', error);
      this.isNetworkDatabase = false;
      return DATABASE_PATH;
    }
  }

  /**
   * Check if network path is accessible (read/write)
   */
  private async isNetworkPathAccessible(networkPath: string): Promise<boolean> {
    try {
      // Check if path exists and is accessible
      const dirPath = path.dirname(networkPath);
      
      // Ensure directory exists (create if needed)
      try {
        await fs.ensureDir(dirPath);
      } catch (dirError) {
        logger.warn('Cannot create network database directory', {
          path: dirPath,
          error: dirError instanceof Error ? dirError.message : String(dirError),
        });
        return false;
      }
      
      // Check read/write permissions
      try {
        await fs.access(dirPath, fs.constants.R_OK | fs.constants.W_OK);
        
        // If database file exists, check if it's readable/writable
        if (await fs.pathExists(networkPath)) {
          await fs.access(networkPath, fs.constants.R_OK | fs.constants.W_OK);
        }
        
        return true;
      } catch (accessError) {
        logger.warn('Network database path not accessible', {
          path: networkPath,
          error: accessError instanceof Error ? accessError.message : String(accessError),
        });
        return false;
      }
    } catch (error) {
      logger.error('Error checking network database accessibility', {
        path: networkPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Generate default network database path
   */
  private getDefaultNetworkPath(licenseKey: string): string {
    // Default pattern: \\server\digitalizePOS\{licenseKey}\digitalizePOS.db
    // Can be overridden via environment variable
    const networkServer = process.env.NETWORK_DB_SERVER || '\\\\server\\digitalizePOS';
    return path.join(networkServer, licenseKey, 'digitalizePOS.db');
  }

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.prisma) {
      logger.info('Database already initialized');
      return;
    }

    try {
      // Determine database path (network or local)
      this.currentDbPath = await this.determineDatabasePath();
      
      // Ensure database directory exists
      const dbDir = path.dirname(this.currentDbPath);
      await fs.ensureDir(dbDir);
      logger.info(`Database directory ensured: ${dbDir}`);
      
      // Check for duplicate databases in alternative locations (warn if found)
      // Only check if using local database
      if (!this.isNetworkDatabase) {
        await this.checkForDuplicateDatabases();
      }

      // Set DATABASE_URL environment variable for Prisma
      const databaseUrl = `file:${this.currentDbPath}`;
      process.env.DATABASE_URL = databaseUrl;

      // Create Prisma Client
      // PERFORMANCE NOTE: SQLite doesn't use traditional connection pooling (file-based database)
      // Prisma Client manages connections efficiently for single-user desktop applications
      // The singleton pattern ensures only one client instance is used throughout the app
      this.prisma = new PrismaClient({
        log: [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'event' },
          { level: 'warn', emit: 'event' },
        ],
        // SQLite-specific optimizations (handled by better-sqlite3 driver)
        // Connection is managed efficiently by Prisma Client singleton pattern
      });

      // Log Prisma events
      this.prisma.$on('query' as never, (e: unknown) => {
        const event = e as { query?: string; params?: string; duration?: number };
        logger.debug('Prisma Query', { query: event.query, params: event.params, duration: event.duration });
      });

      this.prisma.$on('error' as never, (e: unknown) => {
        logger.error('Prisma Error', e);
      });

      this.prisma.$on('warn' as never, (e: unknown) => {
        logger.warn('Prisma Warning', e);
      });

      // Test connection
      await this.prisma.$connect();
      logger.info('Database connected successfully');

      // Run migrations if needed
      await this.runMigrations();

      this.isInitialized = true;
      logger.info('Database service initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Failed to initialize database', {
        message: errorMessage,
        stack: errorStack,
        error,
      });
      
      // Provide helpful error message
      if (errorMessage.includes('@prisma/client') || errorMessage.includes('PrismaClient')) {
        throw new Error(
          'Prisma Client not generated. Please run: npm run prisma:generate'
        );
      }
      
      throw error;
    }
  }

  /**
   * Run database migrations
   * Applies all pending migrations to ensure the database schema is up to date
   */
  private async runMigrations(): Promise<void> {
    try {
      if (!this.prisma) {
        throw new Error('Prisma client not initialized');
      }

      // Check if User table exists (indicates if initial migrations have been run)
      let needsInitialMigration = false;
      try {
        await this.prisma.$queryRaw`SELECT 1 FROM User LIMIT 1`;
      } catch (error: unknown) {
        // Table doesn't exist, need to run initial migrations
        // P2010 = Raw query error, P2021 = Table doesn't exist
        const err = error as { code?: string; message?: string };
        if (err.code === 'P2010' || err.code === 'P2021' || err.message?.includes('does not exist') || err.message?.includes('no such table')) {
          needsInitialMigration = true;
          logger.info('Database schema needs initial migration. Running migrations...');
        } else {
          throw error;
        }
      }

      // Always check for new migrations, even if User table exists
      // This ensures new migrations (like Product, Category, Supplier tables) are applied
      // Check if Product table exists to determine if Sprint 3 migrations are needed
      if (!needsInitialMigration) {
        try {
          await this.prisma.$queryRaw`SELECT 1 FROM Product LIMIT 1`;
          logger.info('Product table exists');
        } catch (error: unknown) {
          const err = error as { code?: string; message?: string };
          if (err.code === 'P2010' || err.code === 'P2021' || err.message?.includes('does not exist') || err.message?.includes('no such table')) {
            logger.info('New migrations detected (Product table missing). Running migrations...');
          }
        }
      }

      // Always read and execute migration files in order
      // The error handling will skip individual statements that are already applied
      // This ensures all tables are created even if some already exist
      // Use app.getAppPath() to get the correct path in both dev and production
      let appPath: string;
      try {
        appPath = app.getAppPath();
      } catch {
        // Fallback if app is not available
        logger.warn('Could not get app path, using __dirname fallback');
        appPath = __dirname;
      }
      
      const migrationsPath = path.join(appPath, 'prisma', 'migrations');
      
      // Fallback to __dirname if migrations path doesn't exist
      let finalMigrationsPath = migrationsPath;
      if (!(await fs.pathExists(finalMigrationsPath))) {
        finalMigrationsPath = path.join(__dirname, '../../../prisma/migrations');
        // Also try relative to process.cwd() for development
        if (!(await fs.pathExists(finalMigrationsPath))) {
          finalMigrationsPath = path.join(process.cwd(), 'prisma', 'migrations');
        }
      }
      
      if (!(await fs.pathExists(finalMigrationsPath))) {
        logger.warn(`Migrations directory not found at: ${finalMigrationsPath}`);
        logger.warn(`App path: ${appPath}`);
        logger.warn('Skipping migrations - this may cause errors if tables are missing');
        return;
      }

      logger.info(`Using migrations path: ${finalMigrationsPath}`);

      const migrationDirs = await fs.readdir(finalMigrationsPath);
      
      // Sort migration directories by name (they have timestamps)
      // Filter to only include directories
      const migrationDirsOnly = await Promise.all(
        migrationDirs.map(async (dir) => {
          const dirPath = path.join(finalMigrationsPath, dir);
          const stat = await fs.stat(dirPath);
          return stat.isDirectory() ? dir : null;
        })
      );
      
      const sortedMigrations = migrationDirsOnly
        .filter((dir): dir is string => dir !== null)
        .sort();

      logger.info(`Found ${sortedMigrations.length} migration(s) to apply`);

      for (const migrationDir of sortedMigrations) {
        const migrationFile = path.join(finalMigrationsPath, migrationDir, 'migration.sql');
        
        if (await fs.pathExists(migrationFile)) {
          const migrationSQL = await fs.readFile(migrationFile, 'utf-8');
          
          // Execute migration SQL - SQLite can handle multiple statements in one call
          // Remove comments and execute the SQL
          const cleanSQL = migrationSQL
            .split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n')
            .trim();

          if (cleanSQL) {
            try {
              // Split SQL into individual statements and execute them one by one
              // This allows partial success if some tables already exist
              const statements = cleanSQL
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.toLowerCase().startsWith('pragma'));

              let successCount = 0;
              let skipCount = 0;
              
              for (const statement of statements) {
                try {
                  await this.prisma.$executeRawUnsafe(statement);
                  successCount++;
                } catch (stmtError: unknown) {
                  const stmtErrorObj = stmtError as { message?: string };
                  const stmtErrorMessage = stmtErrorObj.message || String(stmtError);
                  // If statement fails because table/index already exists, skip it
                  if (stmtErrorMessage.includes('already exists') || 
                      stmtErrorMessage.includes('duplicate') ||
                      stmtErrorMessage.includes('UNIQUE constraint failed')) {
                    skipCount++;
                    logger.debug(`Skipping statement (already exists): ${statement.substring(0, 50)}...`);
                  } else {
                    // Re-throw if it's a different error
                    throw stmtError;
                  }
                }
              }

              if (successCount > 0) {
                logger.info(`Applied migration: ${migrationDir} (${successCount} statements executed, ${skipCount} skipped)`);
              } else if (skipCount > 0) {
                logger.info(`Migration ${migrationDir} appears to be already applied (all ${skipCount} statements skipped)`);
              }
            } catch (error: unknown) {
              // If migration fails completely, log the error
              const err = error as { message?: string; code?: string; stack?: string };
              const errorMessage = err.message || String(error);
              logger.error(`Failed to apply migration ${migrationDir}:`, {
                error: errorMessage,
                code: err.code,
                stack: err.stack,
              });
              // Don't throw - try to continue with other migrations
              // The app will fail when trying to use missing tables, which is better than silent failure
            }
          }
        }
      }

      logger.info('Database migrations completed successfully');
      
      // Verify that User table exists after migrations
      try {
        await this.prisma!.$queryRaw`SELECT 1 FROM User LIMIT 1`;
        logger.info('User table verified after migrations');
      } catch (verifyError: unknown) {
        const verifyErr = verifyError as { code?: string; message?: string };
        if (verifyErr.code === 'P2010' || verifyErr.code === 'P2021' || verifyErr.message?.includes('does not exist') || verifyErr.message?.includes('no such table')) {
          logger.error('CRITICAL: User table still does not exist after running migrations');
          throw new Error('Database migrations failed - User table was not created');
        }
        throw verifyError;
      }
    } catch (error) {
      logger.error('Failed to run migrations', error);
      // Re-throw migration errors so they can be handled properly
      // This ensures the app doesn't continue with an invalid database state
      throw error;
    }
  }

  /**
   * Get Prisma Client instance
   */
  getClient(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.prisma;
  }

  /**
   * Check if database is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.prisma !== null;
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
      this.isInitialized = false;
      logger.info('Database disconnected');
    }
  }

  /**
   * Get database file path (current path being used)
   */
  getDatabasePath(): string {
    return this.currentDbPath;
  }

  /**
   * Check if currently using network database
   */
  isUsingNetworkDatabase(): boolean {
    return this.isNetworkDatabase;
  }

  /**
   * Reinitialize database (e.g., after network path configuration)
   */
  async reinitialize(): Promise<void> {
    logger.info('Reinitializing database...');
    // Disconnect existing connection
    if (this.prisma) {
      await this.disconnect();
    }
    // Reinitialize with new path
    await this.initialize();
  }

  /**
   * Check if database file exists
   */
  async databaseExists(): Promise<boolean> {
    return await fs.pathExists(this.currentDbPath);
  }

  /**
   * Check if network database exists and is accessible
   */
  async checkNetworkDatabaseExists(networkPath: string): Promise<boolean> {
    try {
      // Check if directory is accessible
      const dirPath = path.dirname(networkPath);
      try {
        await fs.access(dirPath, fs.constants.R_OK | fs.constants.W_OK);
      } catch {
        return false;
      }
      
      // Check if database file exists
      if (await fs.pathExists(networkPath)) {
        // Verify it's readable/writable
        try {
          await fs.access(networkPath, fs.constants.R_OK | fs.constants.W_OK);
          return true;
        } catch {
          return false;
        }
      }
      
      // Directory exists but database doesn't - can be created
      return true;
    } catch (error) {
      logger.debug('Error checking network database existence', {
        path: networkPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Check for duplicate databases in alternative locations
   * Warns if multiple databases exist to prevent data inconsistency
   */
  private async checkForDuplicateDatabases(): Promise<void> {
    try {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      const currentAppName = path.basename(USER_DATA_PATH);
      const possibleAppNames = ['digitalize-grocery-pos'];
      
      const alternativeDbPaths: string[] = [];
      for (const altName of possibleAppNames) {
        if (altName !== currentAppName) {
          const altPath = path.join(appData, altName, 'database', 'digitalizePOS.db');
          if (await fs.pathExists(altPath)) {
            const stats = await fs.stat(altPath);
            if (stats.size > 0) {
              alternativeDbPaths.push(altPath);
            }
          }
        }
      }
      
      if (alternativeDbPaths.length > 0) {
        logger.warn('⚠️  Multiple database files detected!', {
          currentDatabase: DATABASE_PATH,
          alternativeDatabases: alternativeDbPaths,
          warning: 'This can cause data inconsistency. Consider running the seed script to clean up duplicate databases.',
        });
      }
    } catch (error) {
      // Don't fail initialization if check fails
      logger.debug('Could not check for duplicate databases', error);
    }
  }
}

// Singleton instance
export const databaseService = new DatabaseService();

