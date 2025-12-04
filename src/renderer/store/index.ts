import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/auth.slice';
import cartSlice from './slices/cart.slice';
import settingsSlice from './slices/settings.slice';
import backupSlice from './slices/backup.slice';
// Import other slices as they are created
// import appSlice from './slices/app.slice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    cart: cartSlice,
    settings: settingsSlice,
    backup: backupSlice,
    // app: appSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: [],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.createdAt', 'payload.updatedAt', 'payload.timestamp'],
        // Ignore these paths in the state
        ignoredPaths: ['auth.user'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

