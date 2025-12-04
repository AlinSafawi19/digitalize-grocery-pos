import { User } from '../store/slices/auth.slice';

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Authentication Service (Renderer)
 * Handles authentication API calls via IPC
 */
export class AuthService {
  /**
   * Login user
   */
  static async login(credentials: LoginCredentials): Promise<LoginResult> {
    try {
      const result = await window.electron.ipcRenderer.invoke('auth:login', credentials) as LoginResult;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred during login',
      };
    }
  }

  /**
   * Logout user
   */
  static async logout(userId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('auth:logout', userId) as { success: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred during logout',
      };
    }
  }

  /**
   * Get current user
   */
  static async getCurrentUser(userId: number): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('auth:getCurrentUser', userId) as { success: boolean; user?: User; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Validate session
   */
  static async validateSession(userId: number): Promise<{ success: boolean; isValid?: boolean; error?: string }> {
    try {
      const result = await window.electron.ipcRenderer.invoke('auth:validateSession', userId) as { success: boolean; isValid?: boolean; error?: string };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}