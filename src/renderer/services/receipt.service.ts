/**
 * Receipt Service (Renderer)
 * Handles receipt operations via IPC
 */
export class ReceiptService {
  /**
   * Generate receipt for a transaction
   */
  static async generateReceipt(
    transactionId: number,
    requestedById: number
  ): Promise<{ success: boolean; filepath?: string; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'receipt:generate',
        transactionId,
        requestedById
      ) as { success: boolean; filepath?: string; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get receipt file path for a transaction
   */
  static async getReceiptPath(
    transactionId: number,
    requestedById: number
  ): Promise<{ success: boolean; filepath?: string | null; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'receipt:getPath',
        transactionId,
        requestedById
      ) as { success: boolean; filepath?: string | null; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete receipt
   */
  static async deleteReceipt(
    transactionId: number,
    requestedById: number
  ): Promise<{ success: boolean; deleted?: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'receipt:delete',
        transactionId,
        requestedById
      ) as { success: boolean; deleted?: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Print receipt
   */
  static async printReceipt(
    filepath: string,
    printerName?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'file:print',
        filepath,
        printerName
      ) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      console.error('Error printing receipt:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

