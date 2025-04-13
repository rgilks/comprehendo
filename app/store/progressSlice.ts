import type { StateCreator } from 'zustand';
import { z } from 'zod';
import { getProgress } from '@/app/actions/userProgress';
import { getSession } from 'next-auth/react';
import type { TextGeneratorState } from './textGeneratorStore';
import type { CEFRLevel } from '@/config/language-guidance';
import * as Sentry from '@sentry/nextjs';

const GetProgressResultSchema = z.object({
  streak: z.number().optional().nullable(),
  currentLevel: z.string().optional().nullable(),
  error: z.string().optional().nullable(),
});

export interface ProgressSlice {
  isProgressLoading: boolean;
  userStreak: number | null;
  fetchUserProgress: () => Promise<void>;
}

export const createProgressSlice: StateCreator<
  TextGeneratorState,
  [['zustand/immer', never]],
  [],
  ProgressSlice
> = (set, get) => ({
  isProgressLoading: false,
  userStreak: null,

  fetchUserProgress: async () => {
    set((state) => {
      state.isProgressLoading = true;
    });
    const session = await getSession();
    if (!(session?.user as { dbId?: number })?.dbId) {
      set((state) => {
        state.userStreak = null;
        state.isProgressLoading = false;
      });
      return;
    }

    try {
      const { passageLanguage } = get();
      const rawProgress = await getProgress({ language: passageLanguage });

      const validatedProgress = GetProgressResultSchema.safeParse(rawProgress);

      if (!validatedProgress.success) {
        console.error('Zod validation error (getProgress):', validatedProgress.error);
        throw new Error(`Invalid API response structure: ${validatedProgress.error.message}`);
      }

      const progress = validatedProgress.data;

      if (progress.error) {
        throw new Error(progress.error);
      }

      set((state) => {
        state.userStreak = progress.streak ?? 0;
        if (progress.currentLevel) {
          state.cefrLevel = progress.currentLevel as CEFRLevel;
        }
      });

      if (progress.streak === null || progress.streak === undefined) {
        console.warn('No progress data found for user/language. Defaulting streak to 0.');
      }
    } catch (error: unknown) {
      console.error('Error fetching user progress:', String(error));
      Sentry.captureException(error);
      set((state) => {
        state.userStreak = null;
      });
      const errorMessage: string =
        error instanceof Error ? error.message : 'Unknown error fetching progress';
      get().setError(errorMessage);
    } finally {
      set((state) => {
        state.isProgressLoading = false;
      });
    }
  },
});
