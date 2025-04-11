import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
// --- Remove unused imports
// import { type Language, SPEECH_LANGUAGES } from '@/contexts/LanguageContext';
// import { type CEFRLevel } from '@/config/language-guidance';
// import { getProgress, submitAnswer } from '@/app/actions/userProgress';
// import { getSession } from 'next-auth/react';

// --- Quiz data schema (PARTIAL - for client state) --- START
// Re-import PartialQuizData from exercise action if needed, or define locally
// --- Remove unused import
// import type { PartialQuizData } from '@/app/actions/exercise';

// Define QuizData type used within the store
// Make QuizData a simple alias if it has no additional members
// --- Remove unused type alias (QuizData is re-exported below)
// type QuizData = PartialQuizData;
// interface QuizData extends PartialQuizData {
//   // Add any other client-side specific fields if necessary in the future
// }

// Define the shape of the pre-fetched quiz data
// --- Remove unused interface
// interface NextQuizInfo {
//   quizData: QuizData;
//   quizId: number;
// }

// --- Remove unused interface
// interface TranslationResponse {
//   responseStatus: number;
//   responseData: {
//     translatedText: string;
//   };
// }

// Define the API response schema for generation if needed for typing, otherwise remove
// Remove if `apiResponseSchema` was only for Zod parsing previously

// Import slice creators and types
import { type UISlice, createUISlice } from './uiSlice';
import { type SettingsSlice, createSettingsSlice } from './settingsSlice';
import { type QuizSlice, createQuizSlice, type QuizData } from './quizSlice';
import { type AudioSlice, createAudioSlice } from './audioSlice';
import { type ProgressSlice, createProgressSlice } from './progressSlice';

// --- Re-export shared types used across slices (optional but can be convenient) ---
export { type Language } from '@/contexts/LanguageContext';
export { type CEFRLevel } from '@/config/language-guidance';
// Do not re-export QuizData from actions/exercise
// export type { PartialQuizData as QuizData } from '@/app/actions/exercise';
// Re-export the correct QuizData type from quizSlice
export type { QuizData };

// --- Define the combined state type by intersecting slice types ---
export type TextGeneratorState = UISlice & SettingsSlice & QuizSlice & AudioSlice & ProgressSlice;

// --- Create the Zustand store by combining slices ---
export const useTextGeneratorStore = create<TextGeneratorState>()(
  immer((...args) => ({
    ...createUISlice(...args),
    ...createSettingsSlice(...args),
    ...createQuizSlice(...args),
    ...createAudioSlice(...args),
    ...createProgressSlice(...args),
  }))
);

// --- Optional: Initial setup logic (like checking speech support) ---
if (typeof window !== 'undefined') {
  const isSpeechSupported =
    'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  // Initialize speech support state directly after store creation
  useTextGeneratorStore.getState()._setIsSpeechSupported(isSpeechSupported);
  console.log('Speech Synthesis Supported:', isSpeechSupported);

  // Set initial generatedQuestionLanguage based on context (This needs to be called from a component)
  // Example: In TextGeneratorContainer useEffect:
  // const { language: contextLanguage } = useLanguage();
  // useEffect(() => {
  //   useTextGeneratorStore.getState().setGeneratedQuestionLanguage(contextLanguage);
  // }, [contextLanguage]);
}

export default useTextGeneratorStore;
