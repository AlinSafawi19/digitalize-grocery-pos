import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type BackupOperationType = 'backup' | 'restore';

export interface BackupOperationState {
  isInProgress: boolean;
  operationType: BackupOperationType | null;
  message: string;
  error: string | null;
}

const initialState: BackupOperationState = {
  isInProgress: false,
  operationType: null,
  message: '',
  error: null,
};

const backupSlice = createSlice({
  name: 'backup',
  initialState,
  reducers: {
    startBackupOperation: (
      state,
      action: PayloadAction<{ type: BackupOperationType; message: string }>
    ) => {
      state.isInProgress = true;
      state.operationType = action.payload.type;
      state.message = action.payload.message;
      state.error = null;
    },
    updateBackupOperationMessage: (state, action: PayloadAction<string>) => {
      state.message = action.payload;
    },
    completeBackupOperation: (state) => {
      state.isInProgress = false;
      state.operationType = null;
      state.message = '';
      state.error = null;
    },
    setBackupOperationError: (state, action: PayloadAction<string>) => {
      state.isInProgress = false;
      state.error = action.payload;
    },
    clearBackupOperationError: (state) => {
      state.error = null;
    },
  },
});

export const {
  startBackupOperation,
  updateBackupOperationMessage,
  completeBackupOperation,
  setBackupOperationError,
  clearBackupOperationError,
} = backupSlice.actions;

export default backupSlice.reducer;

