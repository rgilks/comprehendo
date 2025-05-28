import type { StateCreator } from 'zustand';
import type { TextGeneratorState } from './textGeneratorStore';
import type { BaseSlice } from './baseSlice';
import { createBaseSlice } from './baseSlice';

export interface UISlice extends BaseSlice {
  showLoginPrompt: boolean;
  showContent: boolean;
  showQuestionSection: boolean;
  showExplanation: boolean;
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
  ...createBaseSlice(set),
  showLoginPrompt: true,
  showContent: false,
  showQuestionSection: false,
  showExplanation: false,

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
