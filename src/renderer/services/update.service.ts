/**
 * Update Service for Renderer Process
 * Handles communication with main process for app updates
 */

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

export interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export class UpdateService {
  /**
   * Check for updates manually
   */
  static async checkForUpdates(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('update:check') as {
        available: boolean;
        version?: string;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error checking for updates:', error);
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
      const result = await window.electron.ipcRenderer.invoke('update:download') as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error downloading update:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Install the downloaded update and restart
   */
  static async installUpdate(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('update:install') as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error installing update:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current app version
   */
  static async getCurrentVersion(): Promise<{ version: string; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('update:getVersion') as {
        version: string;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting version:', error);
      return {
        version: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Listen for update available event
   */
  static onUpdateAvailable(callback: (info: UpdateInfo) => void): () => void {
    return window.electron.ipcRenderer.on('update:available', (data: unknown) => {
      const info = data as UpdateInfo;
      callback(info);
    });
  }

  /**
   * Listen for download progress event
   */
  static onDownloadProgress(callback: (progress: DownloadProgress) => void): () => void {
    return window.electron.ipcRenderer.on('update:download-progress', (data: unknown) => {
      const progress = data as DownloadProgress;
      callback(progress);
    });
  }

  /**
   * Listen for update downloaded event
   */
  static onUpdateDownloaded(callback: (info: UpdateInfo) => void): () => void {
    return window.electron.ipcRenderer.on('update:downloaded', (data: unknown) => {
      const info = data as UpdateInfo;
      callback(info);
    });
  }
}

