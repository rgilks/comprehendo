import type { StateCreator } from 'zustand';
import { z } from 'zod'; // Import Zod
import { getProgress } from '@/app/actions/userProgress';
import { getSession } from 'next-auth/react';
import type { TextGeneratorState } from './textGeneratorStore'; // Import combined state type
import type { CEFRLevel } from '@/config/language-guidance';

// --- Zod Schema --- START
const GetProgressResultSchema = z.object({
  streak: z.number().optional().nullable(),
  currentLevel: z.string().optional().nullable(), // Assuming CEFRLevel is string-based
  error: z.string().optional().nullable(),
});
// --- Zod Schema --- END

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
    set({ isProgressLoading: true });
    const session = await getSession();
    // Use type assertion as temporary workaround, assuming dbId exists due to augmentation
    if (!(session?.user as any)?.dbId) {
      set({ userStreak: null, isProgressLoading: false });
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
      set({ userStreak: null });
      const errorMessage: string =
        error instanceof Error ? error.message : 'Unknown error fetching progress';
      get().setError(errorMessage);
    } finally {
      set({ isProgressLoading: false });
    }
  },
});
