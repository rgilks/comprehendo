import type { StateCreator } from 'zustand';
import { getProgress } from '@/app/actions/progress';
import { getSession } from 'next-auth/react';
import type { TextGeneratorState } from './textGeneratorStore';
import { ProgressUpdateResultSchema } from '@/lib/domain/progress';
import type { BaseSlice } from './baseSlice';
import { createBaseSlice } from './baseSlice';
import type { CEFRLevel } from '@/lib/domain/language-guidance';

export type ProgressStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ProgressSlice extends BaseSlice {
  status: ProgressStatus;
  userStreak: number | null;
  cefrLevel?: CEFRLevel;
  fetchProgress: () => Promise<void>;
}

export const createProgressSlice: StateCreator<
  TextGeneratorState,
  [['zustand/immer', never]],
  [],
  ProgressSlice
> = (set, get) => ({
  ...createBaseSlice(set),
  status: 'idle',
  userStreak: null,

  fetchProgress: async () => {
    set((state) => {
      state.status = 'loading';
      state.error = null;
    });

    try {
      const session = await getSession();
      const userId = (session?.user as { dbId?: number } | null)?.dbId;
      if (!userId) {
        set((state) => {
          state.status = 'idle';
          state.userStreak = null;
        });
        return;
      }
      const { passageLanguage } = get();
      const rawProgress = await getProgress({ language: passageLanguage });
      const validatedProgress = ProgressUpdateResultSchema.safeParse(rawProgress);
      if (!validatedProgress.success || validatedProgress.data.error) {
        set((state) => {
          state.status = 'error';
          state.userStreak = null;
          state.error = validatedProgress.success
            ? String(validatedProgress.data.error || 'Unknown error')
            : 'Invalid API response structure';
        });
        return;
      }
      const progress = validatedProgress.data;
      set((state) => {
        state.status = 'success';
        state.userStreak = progress.currentStreak;
        state.cefrLevel = progress.currentLevel;
        state.error = null;
      });
    } catch (error) {
      set((state) => {
        state.status = 'error';
        state.userStreak = null;
        state.error = error instanceof Error ? error.message : String(error);
      });
    }
  },
});
