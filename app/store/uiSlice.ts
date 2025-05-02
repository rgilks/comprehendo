import type { StateCreator } from 'zustand';
import type { TextGeneratorState } from './textGeneratorStore';

export interface UISlice {
  loading: boolean;
  error: string | null;
  showLoginPrompt: boolean;
  showContent: boolean;
  showQuestionSection: boolean;
  showExplanation: boolean;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setShowLoginPrompt: (show: boolean) => void;
  setShowContent: (show: boolean) => void;
  setShowQuestionSection: (show: boolean) => void;
  setShowExplanation: (show: boolean) => void;
}

export const createUISlice: StateCreator<
  TextGeneratorState,
  [['zustand/immer', never]],
  [],
  UISlice
> = (set, _get) => ({
  loading: false,
  error: null,
  showLoginPrompt: true,
  showContent: false,
  showQuestionSection: false,
  showExplanation: false,

  setError: (error) => {
    set((state) => {
      state.error = error;
    });
  },
  setLoading: (loading) => {
    set((state) => {
      state.loading = loading;
    });
  },
  setShowLoginPrompt: (show) => {
    set((state) => {
      state.showLoginPrompt = show;
    });
  },
  setShowContent: (show) => {
    set((state) => {
      state.showContent = show;
    });
  },
  setShowQuestionSection: (show) => {
    set((state) => {
      state.showQuestionSection = show;
    });
  },
  setShowExplanation: (show) => {
    set((state) => {
      state.showExplanation = show;
    });
  },
});
