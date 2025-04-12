import type { StateCreator } from 'zustand';
import type { TextGeneratorState } from './textGeneratorStore';

export interface UISlice {
  loading: boolean;
  error: string | null;
  showLoginPrompt: boolean;
  showContent: boolean;
  showQuestionSection: boolean;
  showExplanation: boolean;
  questionDelayTimeoutRef: NodeJS.Timeout | null;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setShowLoginPrompt: (show: boolean) => void;
  setShowContent: (show: boolean) => void;
  setShowQuestionSection: (show: boolean) => void;
  setShowExplanation: (show: boolean) => void;
  setQuestionDelayTimeoutRef: (ref: NodeJS.Timeout | null) => void;
  clearQuestionDelayTimeout: () => void;
}

export const createUISlice: StateCreator<
  TextGeneratorState,
  [['zustand/immer', never]],
  [],
  UISlice
> = (set, get) => ({
  loading: false,
  error: null,
  showLoginPrompt: true,
  showContent: false,
  showQuestionSection: false,
  showExplanation: false,
  questionDelayTimeoutRef: null,

  setError: (error) =>
    set((state) => {
      state.error = error;
    }),
  setLoading: (loading) =>
    set((state) => {
      state.loading = loading;
    }),
  setShowLoginPrompt: (show) =>
    set((state) => {
      state.showLoginPrompt = show;
    }),
  setShowContent: (show) =>
    set((state) => {
      state.showContent = show;
    }),
  setShowQuestionSection: (show) =>
    set((state) => {
      state.showQuestionSection = show;
    }),
  setShowExplanation: (show) =>
    set((state) => {
      state.showExplanation = show;
    }),
  setQuestionDelayTimeoutRef: (ref) =>
    set((state) => {
      state.questionDelayTimeoutRef = ref;
    }),

  clearQuestionDelayTimeout: () => {
    const timeoutRef = get().questionDelayTimeoutRef;
    if (timeoutRef) {
      clearTimeout(timeoutRef);
      set((state) => {
        state.questionDelayTimeoutRef = null;
      });
    }
  },
});
