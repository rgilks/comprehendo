import type { StateCreator } from 'zustand';
import type { Draft } from 'immer';

export interface BaseSlice {
  loading: boolean;
  error: string | null;
  showError: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const createBaseSlice = <
  T extends { loading: boolean; error: string | null; showError: boolean },
>(
  set: Parameters<StateCreator<T, [['zustand/immer', never]], [], T>>[0]
): BaseSlice => ({
  loading: false,
  error: null,
  showError: false,
  setLoading: (loading) => {
    set((state: Draft<T>) => {
      state.loading = loading;
    });
  },
  setError: (error) => {
    set((state: Draft<T>) => {
      state.error = error;
      state.showError = !!error;
    });
  },
});
