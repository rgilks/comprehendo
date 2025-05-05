import type { StateCreator } from 'zustand';
import { getProgress } from '@/app/actions/progress';
import { getSession } from 'next-auth/react';
import type { TextGeneratorState } from './textGeneratorStore';
import type { CEFRLevel } from '@/lib/domain/language-guidance';
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

    const session = await getSession();
    const userId = (session?.user as { dbId?: number } | null)?.dbId;

    let finalStreak: number | null = null;
    let finalLevel: CEFRLevel | null | undefined = undefined;
    let errorMessage: string | null = null;

    if (!userId) {
      // No user, final state (loading false, streak null) set in finally
    } else {
      try {
        const { passageLanguage } = get();
        const rawProgress = await getProgress({ language: passageLanguage });

        const validatedProgress = ProgressUpdateResultSchema.safeParse(rawProgress);

        if (!validatedProgress.success) {
          console.error('Zod validation error (getProgress):', validatedProgress.error);
          throw new Error(`Invalid API response structure: ${validatedProgress.error.message}`);
        }

        const progress = validatedProgress.data;

        if (progress.error) {
          throw new Error(progress.error);
        }

        finalStreak = progress.currentStreak;
        finalLevel = progress.currentLevel;
      } catch (error: unknown) {
        console.error('Error fetching user progress:', String(error));
        if (error instanceof Error) {
          errorMessage = error.message;
        } else {
          errorMessage = String(error) || 'Unknown error fetching progress';
        }
        finalStreak = null;
        finalLevel = undefined;
      }
    }

    set((state) => {
      state.isProgressLoading = false;
      state.userStreak = finalStreak;
      if (finalLevel) {
        state.cefrLevel = finalLevel;
      }
      state.error = errorMessage;
      state.showError = !!errorMessage;
    });
  },
});
