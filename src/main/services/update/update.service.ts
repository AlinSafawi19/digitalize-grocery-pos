import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { logger } from '../../utils/logger';

export class UpdateService {
  private static updateWindow: BrowserWindow | null = null;
  private static updateCheckInterval: NodeJS.Timeout | null = null;
  private static readonly CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // Check every 4 hours
  private static readonly INITIAL_CHECK_DELAY_MS = 30 * 1000; // Check 30 seconds after app start

  /**
   * Initialize the auto-updater
   * This should be called once when the app starts
   */
  static initialize() {
    // Configure auto-updater
    autoUpdater.autoDownload = false; // Don't auto-download, let user decide
    autoUpdater.autoInstallOnAppQuit = true; // Install on app quit if update is downloaded

    // Update server URL is automatically read from package.json "publish" section
    // Currently configured to: https://downloads.digitalizepos.com

    // Event handlers
    autoUpdater.on('checking-for-update', () => {
      logger.info('Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
      logger.info('Update available', { version: info.version });
      this.notifyUpdateAvailable({
        version: info.version,
        releaseDate: info.releaseDate || new Date().toISOString(),
        releaseNotes: info.releaseNotes,
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      logger.info('Update not available', { version: info.version });
    });

    autoUpdater.on('error', (error) => {
      logger.error('Auto-updater error', error);
      // Don't show error to user in production - just log it
      // Updates are optional and shouldn't block the app
    });

    autoUpdater.on('download-progress', (progressObj) => {
      logger.info('Update download progress', { percent: progressObj.percent });
      this.notifyDownloadProgress(progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      logger.info('Update downloaded', { version: info.version });
      this.notifyUpdateDownloaded({
        version: info.version,
        releaseDate: info.releaseDate || new Date().toISOString(),
        releaseNotes: info.releaseNotes,
      });
    });

    // Start periodic update checks
    this.startPeriodicChecks();
  }

  /**
   * Start periodic update checks
   */
  private static startPeriodicChecks() {
    // Initial check after a delay (to not block app startup)
    setTimeout(() => {
      this.checkForUpdates();
    }, this.INITIAL_CHECK_DELAY_MS);

    // Set up periodic checks
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Check for updates manually
   */
  static async checkForUpdates(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      // Only check in production (not in development)
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        logger.info('Skipping update check in development mode');
        return { available: false };
      }

      const result = await autoUpdater.checkForUpdates();
      if (result && result.updateInfo) {
        return {
          available: result.updateInfo.version !== autoUpdater.currentVersion.version,
          version: result.updateInfo.version,
        };
      }
      return { available: false };
    } catch (error) {
      logger.error('Error checking for updates', error);
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Download the available update
   */
  static async downloadUpdate(): Promise<{ success: boolean; error?: string }> {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      logger.error('Error downloading update', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Install the downloaded update and restart the app
   */
  static async installUpdate(): Promise<void> {
    try {
      autoUpdater.quitAndInstall(false, true); // Don't force, but restart after install
    } catch (error) {
      logger.error('Error installing update', error);
      throw error;
    }
  }

  /**
   * Get current app version
   */
  static getCurrentVersion(): string {
    return autoUpdater.currentVersion.version;
  }

  /**
   * Notify renderer process that an update is available
   */
  private static notifyUpdateAvailable(info: { version: string; releaseDate: string; releaseNotes?: string | null | Array<{ version?: string; note?: string | null }> }) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      // Convert releaseNotes to string if it's an array
      let releaseNotes: string | undefined;
      if (typeof info.releaseNotes === 'string') {
        releaseNotes = info.releaseNotes;
      } else if (Array.isArray(info.releaseNotes)) {
        releaseNotes = info.releaseNotes
          .map(note => note.note || note.version || '')
          .filter(Boolean)
          .join('\n');
      }
      
      window.webContents.send('update:available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes,
      });
    });
  }

  /**
   * Notify renderer process of download progress
   */
  private static notifyDownloadProgress(progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      window.webContents.send('update:download-progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });
  }

  /**
   * Notify renderer process that update is downloaded
   */
  private static notifyUpdateDownloaded(info: { version: string; releaseDate: string; releaseNotes?: string | null | Array<{ version?: string; note?: string | null }> }) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      // Convert releaseNotes to string if it's an array
      let releaseNotes: string | undefined;
      if (typeof info.releaseNotes === 'string') {
        releaseNotes = info.releaseNotes;
      } else if (Array.isArray(info.releaseNotes)) {
        releaseNotes = info.releaseNotes
          .map(note => note.note || note.version || '')
          .filter(Boolean)
          .join('\n');
      }
      
      window.webContents.send('update:downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes,
      });
    });
  }

  /**
   * Cleanup on app quit
   */
  static cleanup() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }
}

