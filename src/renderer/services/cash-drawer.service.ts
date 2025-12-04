/**
 * Cash Drawer Service (Renderer)
 * Handles cash drawer operations via IPC
 */
export class CashDrawerService {
  /**
   * Open cash drawer
   */
  static async openCashDrawer(
    printerName?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'cashDrawer:open',
        printerName
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Check if auto-open is enabled
   */
  static async isAutoOpenEnabled(): Promise<{ success: boolean; enabled?: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'cashDrawer:isAutoOpenEnabled'
      ) as { success: boolean; enabled?: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        enabled: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

