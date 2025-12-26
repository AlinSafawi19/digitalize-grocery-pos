import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { clearPermissionCache } from '../../services/permission.service';
import { clearRoutePermissionCache } from '../../hooks/usePermission';

export interface User {
  id: number;
  username: string;
  phone: string | null;
  isActive: boolean;
}

export interface AuthState {
  user: User | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface LoginResult {
  success: boolean;
  error?: string;
  user?: User;
  sessionToken?: string;
}

interface LogoutResult {
  success: boolean;
  error?: string;
}

interface GetCurrentUserResult {
  success: boolean;
  error?: string;
  user?: User;
}

interface ValidateSessionResult {
  success: boolean;
  error?: string;
  isValid?: boolean;
}

const initialState: AuthState = {
  user: null,
  sessionToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { username: string; password: string; rememberMe?: boolean }) => {
    const result = await window.electron.ipcRenderer.invoke('auth:login', credentials) as LoginResult;
    if (!result.success) {
      throw new Error(result.error || 'Login failed');
    }
    // Store session token and rememberMe preference in localStorage
    if (result.sessionToken) {
      localStorage.setItem('sessionToken', result.sessionToken);
    }
    if (credentials.rememberMe && result.user) {
      localStorage.setItem('rememberMe', 'true');
      // Store userId for reference (but use sessionToken for auth)
      localStorage.setItem('userId', result.user.id.toString());
    } else {
      localStorage.removeItem('rememberMe');
      localStorage.removeItem('userId');
    }
    return { 
      user: result.user!, 
      sessionToken: result.sessionToken || null,
      rememberMe: credentials.rememberMe || false 
    };
  }
);

export const logout = createAsyncThunk('auth/logout', async (userId: number, { getState }) => {
  const state = getState() as { auth: AuthState };
  const sessionToken = state.auth.sessionToken;
  
  const result = await window.electron.ipcRenderer.invoke('auth:logout', userId, sessionToken) as LogoutResult;
  if (!result.success) {
    throw new Error(result.error || 'Logout failed');
  }
  // Clear session token, rememberMe preference and userId on logout
  localStorage.removeItem('sessionToken');
  localStorage.removeItem('rememberMe');
  localStorage.removeItem('userId');
  return true;
});

export const getCurrentUser = createAsyncThunk('auth/getCurrentUser', async (sessionToken: string) => {
  const result = await window.electron.ipcRenderer.invoke('auth:getCurrentUser', sessionToken) as GetCurrentUserResult;
  if (!result.success) {
    throw new Error(result.error || 'Failed to get current user');
  }
  return result.user!;
});

export const validateSession = createAsyncThunk(
  'auth/validateSession',
  async (sessionToken: string) => {
    const result = await window.electron.ipcRenderer.invoke('auth:validateSession', sessionToken) as ValidateSessionResult;
    if (!result.success) {
      throw new Error(result.error || 'Session validation failed');
    }
    return result.isValid ?? false;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    clearAuth: (state) => {
      state.user = null;
      state.sessionToken = null;
      state.isAuthenticated = false;
      state.error = null;
      // Clear permission caches when auth is cleared
      clearPermissionCache();
      clearRoutePermissionCache();
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.sessionToken = action.payload.sessionToken;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Login failed';
        state.isAuthenticated = false;
      });

    // Logout
    builder
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.sessionToken = null;
        state.isAuthenticated = false;
        state.error = null;
        // Clear permission caches on logout
        clearPermissionCache();
        clearRoutePermissionCache();
      })
      .addCase(logout.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Logout failed';
        // Clear permission caches even on logout error
        clearPermissionCache();
        clearRoutePermissionCache();
      });

    // Get current user
    builder
      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(getCurrentUser.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
      });

    // Validate session
    builder
      .addCase(validateSession.fulfilled, (state, action) => {
        if (!action.payload) {
          state.user = null;
          state.sessionToken = null;
          state.isAuthenticated = false;
        }
      })
      .addCase(validateSession.rejected, (state) => {
        state.user = null;
        state.sessionToken = null;
        state.isAuthenticated = false;
      });
  },
});

export const { clearError, setUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;

