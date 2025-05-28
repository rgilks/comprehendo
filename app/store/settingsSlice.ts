import type { StateCreator } from 'zustand';
import { type LearningLanguage } from 'app/domain/language';
import { type CEFRLevel } from 'app/domain/language-guidance';
import type { Language, TextGeneratorState } from './textGeneratorStore';
import type { BaseSlice } from './baseSlice';
import { createBaseSlice } from './baseSlice';

export interface SettingsSlice extends BaseSlice {
  passageLanguage: LearningLanguage;
  generatedPassageLanguage: LearningLanguage | null;
  generatedQuestionLanguage: Language | null;
  cefrLevel: CEFRLevel;
  setPassageLanguage: (lang: LearningLanguage) => void;
  setGeneratedPassageLanguage: (lang: LearningLanguage | null) => void;
  setGeneratedQuestionLanguage: (lang: Language | null) => void;
  setCefrLevel: (level: CEFRLevel) => void;
}

export const createSettingsSlice: StateCreator<
  TextGeneratorState,
  [['zustand/immer', never]],
  [],
  SettingsSlice
> = (set, get) => ({
  ...createBaseSlice(set),
  passageLanguage: 'en',
  generatedPassageLanguage: null,
  generatedQuestionLanguage: null,
  cefrLevel: 'A1',

  setGeneratedPassageLanguage: (lang) => {
    set((state) => {
      state.generatedPassageLanguage = lang;
    });
  },
  setGeneratedQuestionLanguage: (lang) => {
    set((state) => {
      state.generatedQuestionLanguage = lang;
    });
  },
  setCefrLevel: (level) => {
    set((state) => {
      state.cefrLevel = level;
    });
  },

  setPassageLanguage: (lang) => {
    get().stopPassageSpeech();

    get().setQuizData(null);
    get().setSelectedAnswer(null);
    get().setIsAnswered(false);
    get().setRelevantTextRange(null);
    get().setNextQuizAvailable(null);

    set((state) => {
      state.passageLanguage = lang;
      state.generatedPassageLanguage = null;
      state.error = null;
      state.loading = false;
    });

    get().setShowExplanation(false);
    get().setShowQuestionSection(false);
    get().setShowContent(false);

    get().updateAvailableVoices(lang);
    void get().fetchProgress();
  },
});
