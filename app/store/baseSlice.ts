import type { Draft } from 'immer';

export interface BaseSlice {
  loading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const createBaseSlice = (
  set: (fn: (state: Draft<BaseSlice>) => void) => void
): BaseSlice => ({
  loading: false,
  error: null,
  setLoading: (loading) => {
    set((state) => {
      state.loading = loading;
    });
  },
  setError: (error) => {
    set((state) => {
      state.error = error;
    });
  },
});
