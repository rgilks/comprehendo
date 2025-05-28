import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { enableMapSet } from 'immer';

import { type UISlice, createUISlice } from './uiSlice';
import { type SettingsSlice, createSettingsSlice } from './settingsSlice';
import { type QuizSlice, createQuizSlice } from './quizSlice';
import { type AudioSlice, createAudioSlice } from './audioSlice';
import { type ProgressSlice, createProgressSlice } from './progressSlice';
import { type LanguageSlice, createLanguageSlice } from './languageSlice';
import { type QuizData } from '@/lib/domain/schemas';

export type { CEFRLevel } from '@/lib/domain/language-guidance';
export { CEFRLevelSchema } from '@/lib/domain/language-guidance';
export type { Language } from '@/lib/domain/language';
export { LanguageSchema } from '@/lib/domain/language';

export type { QuizData };

export type TextGeneratorState = UISlice &
  SettingsSlice &
  QuizSlice &
  AudioSlice &
  ProgressSlice &
  LanguageSlice;

enableMapSet();

export const useTextGeneratorStore = create<TextGeneratorState>()(
  persist(
    immer((...args) => ({
      ...createUISlice(...args),
      ...createSettingsSlice(...args),
      ...createQuizSlice(...args),
      ...createAudioSlice(...args),
      ...createProgressSlice(...args),
      ...createLanguageSlice(...args),
    })),
    {
      name: 'text-generator-store',
      storage: createJSONStorage(() => localStorage, {
        replacer: (_key, value) => {
          if (value instanceof Map) {
            return { __type: 'Map', value: Array.from(value.entries()) };
          }
          return value;
        },
        reviver: (_key, value) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const val = value as any;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (typeof val === 'object' && val !== null && val.__type === 'Map') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            return new Map(val.value);
          }
          return value;
        },
      }),
    }
  )
);

export default useTextGeneratorStore;
