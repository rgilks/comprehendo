import type { StateCreator } from 'zustand';
import { getProgress } from '@/actions/progress';
import { getSession } from 'next-auth/react';
import type { TextGeneratorState } from './textGeneratorStore';
import { ProgressUpdateResultSchema } from '@/lib/domain/progress';
import type { BaseSlice } from './baseSlice';
import { createBaseSlice } from './baseSlice';

export interface ProgressSlice extends BaseSlice {
  isProgressLoading: boolean;
  userStreak: number | null;
  fetchProgress: () => Promise<void>;
}

export const createProgressSlice: StateCreator<
  TextGeneratorState,
  [['zustand/immer', never]],
  [],
  ProgressSlice
> = (set, get) => ({
  ...createBaseSlice(set),
  isProgressLoading: false,
  userStreak: null,

  fetchProgress: async () => {
    set((state) => {
      state.isProgressLoading = true;
    });

    try {
      const session = await getSession();
      const userId = (session?.user as { dbId?: number } | null)?.dbId;
      if (!userId) {
        set((state) => {
          state.isProgressLoading = false;
          state.userStreak = null;
        });
        return;
      }
      const { passageLanguage } = get();
      const rawProgress = await getProgress({ language: passageLanguage });
      const validatedProgress = ProgressUpdateResultSchema.safeParse(rawProgress);
      if (!validatedProgress.success || validatedProgress.data.error) {
        set((state) => {
          state.isProgressLoading = false;
          state.userStreak = null;
          state.error = validatedProgress.success
            ? String(validatedProgress.data.error || 'Unknown error')
            : 'Invalid API response structure';
          state.showError = true;
        });
        return;
      }
      const progress = validatedProgress.data;
      set((state) => {
        state.isProgressLoading = false;
        state.userStreak = progress.currentStreak;
        state.cefrLevel = progress.currentLevel;
        state.error = null;
        state.showError = false;
      });
    } catch (error) {
      set((state) => {
        state.isProgressLoading = false;
        state.userStreak = null;
        state.error = error instanceof Error ? error.message : String(error);
        state.showError = true;
      });
    }
  },
});
