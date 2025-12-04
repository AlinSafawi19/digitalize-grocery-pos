import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { SettingsService } from '../../services/settings.service';

export interface BusinessRules {
  roundingMethod: string;
  allowNegativeStock: boolean;
}

export interface SettingsState {
  businessRules: BusinessRules;
  isLoading: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  businessRules: {
    roundingMethod: 'round',
    allowNegativeStock: false,
  },
  isLoading: false,
  error: null,
};

// Async thunk to load business rules
export const loadBusinessRules = createAsyncThunk(
  'settings/loadBusinessRules',
  async (userId: number) => {
    try {
      const result = await SettingsService.getBusinessRules(userId);
      if (!result.success) {
        // If loading fails, return defaults instead of throwing
        // This prevents "Failed to load settings" errors after activation
        return {
          roundingMethod: 'round',
          allowNegativeStock: false,
        };
      }
      return result.businessRules || {
        roundingMethod: 'round',
        allowNegativeStock: false,
      };
    } catch (error) {
      // Catch any unexpected errors and return defaults
      console.error('Error loading business rules, using defaults:', error);
      return {
        roundingMethod: 'round',
        allowNegativeStock: false,
      };
    }
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setBusinessRules: (state, action: PayloadAction<BusinessRules>) => {
      state.businessRules = action.payload;
    },
    setRoundingMethod: (state, action: PayloadAction<string>) => {
      state.businessRules.roundingMethod = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadBusinessRules.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadBusinessRules.fulfilled, (state, action) => {
        state.isLoading = false;
        state.businessRules = action.payload;
        state.error = null;
      })
      .addCase(loadBusinessRules.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to load business rules';
      });
  },
});

export const { setBusinessRules, setRoundingMethod, clearError } = settingsSlice.actions;
export default settingsSlice.reducer;

