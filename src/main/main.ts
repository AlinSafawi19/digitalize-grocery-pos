// Load environment variables from .env file FIRST, before any other imports
import dotenv from 'dotenv';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

// Get the project root directory
// Strategy: Try multiple methods to find the project root
let projectRoot: string | null = null;

// Method 1: Try process.cwd() (works when running from npm scripts)
const cwd = process.cwd();
if (existsSync(join(cwd, 'package.json')) && existsSync(join(cwd, '.env'))) {
  projectRoot = cwd;
}

// Method 2: Try relative to current file location
if (!projectRoot) {
  const currentFile = fileURLToPath(import.meta.url);
  // In development: src/main/main.ts -> project root is 3 levels up
  // In production: dist-electron/main.js -> project root is 2 levels up
  const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  const candidateRoot = isDev 
    ? resolve(currentFile, '..', '..', '..')  // src/main/main.ts -> ../../../
    : resolve(currentFile, '..', '..');        // dist-electron/main.js -> ../../
  
  if (existsSync(join(candidateRoot, 'package.json'))) {
    projectRoot = candidateRoot;
  }
}

// Method 3: Fallback to cwd if nothing else works
if (!projectRoot) {
  projectRoot = cwd;
}

// Load .env file from project root
const envPath = join(projectRoot, '.env');
const result = dotenv.config({ path: envPath });

// Always log in development to help debug
if (process.env.NODE_ENV !== 'production') {
  if (result.error) {
    console.error(`[dotenv] ERROR: Could not load .env file from ${envPath}:`, result.error.message);
  }
}

// Note: ASAR is disabled in package.json to ensure Prisma client module resolution works correctly

// Now import everything else
import { app, BrowserWindow, session, nativeImage } from 'electron';
import fs from 'fs-extra';

import { databaseService } from './services/database/database.service';
import { licenseService } from './services/license/license.service';
import { logger } from './utils/logger';
import { registerIpcHandlers } from './ipc';
import { ReportCacheService } from './services/reports/report-cache.service';
import { ReportSchedulerService } from './services/reports/report-scheduler.service';
import { NotificationCountCronService } from './services/notifications/notification-count-cron.service';
import { ensureSumatraPDF } from './ipc/file.handlers';
import { UpdateService } from './services/update/update.service';

// CRITICAL: Set app name explicitly to ensure consistent userData path
// This prevents multiple databases from being created with different app names
// Electron uses package.json "name" field, but we set it explicitly to be safe
const packageJsonPath = join(projectRoot || cwd, 'package.json');
let appName = 'digitalize-grocery-pos'; // Default fallback
try {
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = fs.readJsonSync(packageJsonPath);
    appName = packageJson.name || appName;
  }
} catch {
  // logger might not be available yet, silently use default
}
// Set app name BEFORE app is ready to ensure consistent userData path
// This must be done before any Electron APIs that use userData are called
if (!app.isReady()) {
  app.setName(appName);
}

// __dirname is already defined above for dotenv config
// In packaged apps, we need to use app.getAppPath() instead of import.meta.url
let distDir: string;
if (app.isPackaged) {
  // In packaged app: main.js is at resources/app/dist-electron/main.js
  distDir = join(app.getAppPath(), 'dist-electron');
} else {
  // In development: use import.meta.url
  distDir = fileURLToPath(new URL('.', import.meta.url));
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = join(distDir, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : join(process.env.DIST, '../');

let win: BrowserWindow | null = null;
// Preload script path - vite-plugin-electron puts it in the same directory as main.js
const preload = join(distDir, 'preload.js');
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST || '', 'index.html');

// Log paths for debugging
logger.info('Path configuration:', {
  distDir,
  dist: process.env.DIST,
  vitePublic: process.env.VITE_PUBLIC,
  preload,
  indexHtml,
  isPackaged: app.isPackaged,
  appPath: app.isPackaged ? app.getAppPath() : 'N/A (dev mode)',
});

// Get Windows icon path
function getIconPath(): string | undefined {
  // Try multiple possible paths for icon files
  // In development: icons are in public/ folder at project root
  // In production: icons are in dist/ folder (Vite copies public/ to dist/)
  const possibleBasePaths = [
    // Most likely: public folder at project root (development)
    projectRoot ? join(projectRoot, 'public') : '',
    // Production: dist folder (Vite copies public/ to dist/)
    process.env.DIST || '',
    // Alternative production path
    process.env.VITE_PUBLIC || '',
    // Fallback: try public subfolder in these paths
    join(process.env.VITE_PUBLIC || '', 'public'),
    join(process.env.DIST || '', 'public'),
    // Last resort: project root itself
    projectRoot || '',
  ].filter(Boolean);
  
  // Windows requires .ico files, not SVG
  // Try .ico first, then fallback to .png
  for (const basePath of possibleBasePaths) {
    const icoPath = resolve(join(basePath, 'icon.ico'));
    if (existsSync(icoPath)) {
      logger.info(`Found Windows icon at: ${icoPath}`);
      return icoPath;
    }
  }
  for (const basePath of possibleBasePaths) {
    const pngPath = resolve(join(basePath, 'icon.png'));
    if (existsSync(pngPath)) {
      logger.info(`Found Windows icon (PNG fallback) at: ${pngPath}`);
      return pngPath;
    }
  }
  
  logger.warn('No icon file found. Tried paths:', possibleBasePaths);
  return undefined;
}

async function createWindow() {
  const iconPath = getIconPath();
  
  // Log icon path for debugging
  if (iconPath) {
    logger.info(`Setting window icon to: ${iconPath}`);
  } else {
    logger.warn('No icon path found for window');
  }
  
  // Create native image from icon path if available
  let iconImage: Electron.NativeImage | undefined;
  if (iconPath) {
    try {
      iconImage = nativeImage.createFromPath(iconPath);
      if (iconImage.isEmpty()) {
        logger.warn(`Icon image is empty for path: ${iconPath}`);
        iconImage = undefined;
      }
    } catch (error) {
      console.error(`[Icon] Error loading icon:`, error);
      logger.error('Failed to load icon image', error);
      iconImage = undefined;
    }
  }
  
  win = new BrowserWindow({
    title: 'DigitalizePOS',
    width: 1200,
    height: 800,
    ...(iconImage ? { icon: iconImage } : iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
    logger.info('Window loaded successfully');
  });

  // Handle load errors
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logger.error('Failed to load window', {
      errorCode,
      errorDescription,
      validatedURL,
      indexHtml,
    });
  });

  // Log when page starts loading
  win.webContents.on('did-start-loading', () => {
    logger.info('Window started loading', { url: url || indexHtml });
  });

  if (url) {
    // electron-vite-vue#298
    win.loadURL(url);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    // Check if index.html exists before loading
    if (!fs.existsSync(indexHtml)) {
      logger.error('index.html not found at:', indexHtml);
      logger.error('Available files in DIST:', fs.existsSync(process.env.DIST || '') 
        ? fs.readdirSync(process.env.DIST || '').join(', ')
        : 'DIST directory does not exist');
    } else {
      logger.info('Loading index.html from:', indexHtml);
    }
    win.loadFile(indexHtml).catch((error) => {
      logger.error('Error loading index.html', error);
    });
  }
}

// Set Content Security Policy
function setContentSecurityPolicy() {
  // In development, we need 'unsafe-eval' for Vite HMR
  // In production, we use a stricter policy without unsafe-eval
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
  
  const csp = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: ws: wss:;"
    : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  // Note: Electron will show a security warning in development about 'unsafe-eval'
  // This is expected and harmless - it's required for Vite HMR
  // The warning will NOT appear in production builds (when app.isPackaged === true)
  if (isDev) {
    logger.info('CSP set for development (includes unsafe-eval for Vite HMR)');
  } else {
    logger.info('CSP set for production (strict policy without unsafe-eval)');
  }
}

// Initialize application
async function initializeApp() {
  try {
    logger.info('Initializing DigitalizePOS...');

    // Set Content Security Policy
    setContentSecurityPolicy();

    // Initialize database
    await databaseService.initialize();
    logger.info('Database initialized successfully');

    // Register IPC handlers
    registerIpcHandlers();
    
    // Start periodic cache cleanup for reports
    ReportCacheService.startPeriodicCleanup();
    logger.info('IPC handlers registered');

    // Start report scheduler service
    ReportSchedulerService.start();
    logger.info('Report scheduler service started');

    // Start notification count cron service
    NotificationCountCronService.start();
    logger.info('Notification count cron service started');

    // Initialize update service (non-blocking, checks in background)
    if (app.isPackaged) {
      UpdateService.initialize();
      logger.info('Update service initialized');
    } else {
      logger.info('Update service skipped (development mode)');
    }

    // Start operation queue processing for offline sync
    const { OperationQueueService } = await import('./services/sync/operation-queue.service');
    OperationQueueService.startPeriodicProcessing(60000); // Process every minute
    logger.info('Operation queue processing started');

    // Initialize license validation
    const licenseValidation = await licenseService.initialize();
    if (!licenseValidation.valid) {
      logger.warn('License validation failed', { message: licenseValidation.message });
      // Note: In production, you might want to block app access here
      // For now, we'll just log a warning
    } else {
      logger.info('License validated successfully', {
        daysRemaining: licenseValidation.daysRemaining,
      });
    }

    // Pre-download SumatraPDF in the background (non-blocking)
    // This ensures it's ready when the user prints their first receipt
    ensureSumatraPDF()
      .then((sumatraPath) => {
        if (sumatraPath) {
          logger.info('SumatraPDF ready for printing', { path: sumatraPath });
        } else {
          logger.warn('SumatraPDF download failed during initialization, will retry on first print');
        }
      })
      .catch((error) => {
        logger.warn('Error pre-downloading SumatraPDF', { 
          error: error instanceof Error ? error.message : String(error) 
        });
        // Don't block app startup - will retry on first print
      });

    // Create main window
    await createWindow();

    logger.info('Application initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize application', error);
    app.quit();
  }
}

// Quit when all windows are closed
app.on('window-all-closed', async () => {
  await databaseService.disconnect();
  app.quit();
  win = null;
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app quit
app.on('before-quit', async () => {
  logger.info('Application shutting down...');
  UpdateService.cleanup();
  await databaseService.disconnect();
});

app.whenReady().then(initializeApp);

