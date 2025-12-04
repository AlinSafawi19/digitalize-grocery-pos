import { app } from 'electron';
import path from 'path';

// App Constants
export const APP_NAME = process.env.APP_NAME;
export const APP_VERSION = process.env.APP_VERSION;

// Paths
export const USER_DATA_PATH = app.getPath('userData');
export const DATABASE_DIR = path.join(USER_DATA_PATH, 'database');
export const DATABASE_PATH = path.join(DATABASE_DIR, 'digitalizePOS.db');
export const LICENSE_DIR = path.join(USER_DATA_PATH, 'license');
export const LICENSE_PATH = path.join(LICENSE_DIR, 'license.dat');
export const BACKUP_DIR = path.join(USER_DATA_PATH, 'backups');
export const RECEIPTS_DIR = path.join(USER_DATA_PATH, 'receipts');
export const REPORTS_DIR = path.join(USER_DATA_PATH, 'reports');
export const LOGS_DIR = path.join(USER_DATA_PATH, 'logs');

// License Server
// Default to localhost for development, override with env var for production
// NOTE: If .env file is not loaded, this will be undefined - dotenv must load first!
export const LICENSE_SERVER_URL =
  process.env.LICENSE_SERVER_URL || 'http://localhost:3000';
// Use env var if set, otherwise fallback to a dev default
// For production, always set APP_SECRET via environment variable
// NOTE: If .env file is not loaded, this will be undefined - dotenv must load first!
// Fallback to a dev default to prevent crashes, but warn in production
export const APP_SECRET = process.env.APP_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[CRITICAL] APP_SECRET is not set! This is required for production.');
    throw new Error('APP_SECRET environment variable is required but not set');
  }
  return 'dev-secret-change-in-production';
})();

// Database
export const DATABASE_URL = `file:${DATABASE_PATH}`;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
