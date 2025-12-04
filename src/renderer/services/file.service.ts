/**
 * File Service (Renderer)
 * Handles file operations via IPC
 */

/**
 * Show open file dialog
 */
export async function showOpenDialog(
  options: Electron.OpenDialogOptions
): Promise<Electron.OpenDialogReturnValue> {
  try {
    const result = await window.electron.ipcRenderer.invoke('file:showOpenDialog', options) as Electron.OpenDialogReturnValue;
    return result;
  } catch (error) {
    console.error('Error showing open dialog:', error);
    return {
      canceled: true,
      filePaths: [],
    };
  }
}

/**
 * Show save file dialog
 */
export async function showSaveDialog(
  options: Electron.SaveDialogOptions
): Promise<Electron.SaveDialogReturnValue> {
  try {
    const result = await window.electron.ipcRenderer.invoke('file:showSaveDialog', options) as Electron.SaveDialogReturnValue;
    return result;
  } catch (error) {
    console.error('Error showing save dialog:', error);
    return {
      canceled: true,
      filePath: undefined,
    };
  }
}

/**
 * Show folder selection dialog (for backup destination)
 */
export async function showFolderDialog(
  title: string = 'Select Backup Destination Folder'
): Promise<string | null> {
  try {
    const result = await showOpenDialog({
      title,
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Select Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  } catch (error) {
    console.error('Error showing folder dialog:', error);
    return null;
  }
}

