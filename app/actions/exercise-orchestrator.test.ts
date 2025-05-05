import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateRequestParams, getOrGenerateExercise } from './exercise-orchestrator';
import * as helpers from './exercise-helpers';
import { success, failure, type ActionError } from '@/lib/utils/result-types';
import type {
  GenerateExerciseResult,
  ExerciseContent,
  ExerciseRequestParams,
} from '@/lib/domain/schemas';
import type { ExerciseGenerationParams } from '@/lib/domain/ai';

vi.mock('./exercise-helpers');

const validGenParams: ExerciseGenerationParams = {
  passageLanguage: 'en',
  questionLanguage: 'fr',
  level: 'A2',
  topic: 'Mock Topic',
  passageLangName: 'English',
  questionLangName: 'French',
  grammarGuidance: 'Mock Grammar',
  vocabularyGuidance: 'Mock Vocab',
};

const mockUserId = 1;

const mockExerciseContent: ExerciseContent = {
  paragraph: 'Generated Paragraph',
  question: 'Generated Question',
  options: { A: 'GenA', B: 'GenB', C: 'GenC', D: 'GenD' },
  correctAnswer: 'A',
  allExplanations: { A: 'EA', B: 'EB', C: 'EC', D: 'ED' },
  relevantText: 'Relevant Text',
  topic: 'Generated Topic',
};
const generatedSuccessData = { content: mockExerciseContent, id: 555 };
const generatedSuccessResult = success<typeof generatedSuccessData, ActionError>(
  generatedSuccessData
);

const generationFailError: ActionError = { error: 'Generation Failed' };
const generatedFailResult = failure<typeof generatedSuccessData, ActionError>(generationFailError);

const cacheFailError: ActionError = {
  error: 'Exercise generated but failed to save to cache (undefined ID).',
};
const cacheFailResult = failure<typeof generatedSuccessData, ActionError>(cacheFailError);

const cachedResult: GenerateExerciseResult = {
  quizData: {
    paragraph: 'Cached Para',
    question: 'Cached Q',
    options: { A: 'cA', B: 'cB', C: 'cC', D: 'cD' },
    topic: 'Cached Topic',
    language: 'en',
  },
  quizId: 999,
  cached: true,
  error: null,
};

describe('Exercise Orchestrator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(helpers.tryGetCachedExercise).mockResolvedValue(null);
    vi.mocked(helpers.tryGenerateAndCacheExercise).mockResolvedValue(generatedSuccessResult);
    vi.mocked(helpers.createErrorResponse).mockImplementation((error, details) => ({
      quizData: helpers.DEFAULT_EMPTY_QUIZ_DATA,
      quizId: -1,
      error: `${error}${details ? `: ${JSON.stringify(details)}` : ''}`,
      cached: false,
    }));
  });

  describe('validateRequestParams', () => {
    it('validates correct params', () => {
      const result = validateRequestParams(validGenParams);
      expect(result.success).toBe(true);
    });

    it('invalidates incorrect params', () => {
      const result = validateRequestParams({ ...validGenParams, level: 'Z9' });
      expect(result.success).toBe(false);
    });
  });

  describe('getOrGenerateExercise', () => {
    it('returns generated exercise if cache is low and generation succeeds', async () => {
      vi.mocked(helpers.tryGenerateAndCacheExercise).mockResolvedValue(generatedSuccessResult);

      const result = await getOrGenerateExercise(validGenParams, mockUserId, 10);

      expect(result.quizId).toBe(generatedSuccessData.id);
      expect(result.cached).toBe(false);
      expect(result.error).toBeNull();
      expect(result.quizData.paragraph).toBe(mockExerciseContent.paragraph);
      expect(helpers.tryGenerateAndCacheExercise).toHaveBeenCalledTimes(1);
      expect(helpers.tryGetCachedExercise).not.toHaveBeenCalled();
    });

    it('returns cached exercise if cache is low, generation fails (non-terminal), but cache fallback succeeds', async () => {
      vi.mocked(helpers.tryGenerateAndCacheExercise).mockResolvedValue(generatedFailResult);
      vi.mocked(helpers.tryGetCachedExercise).mockResolvedValue(cachedResult);

      const result = await getOrGenerateExercise(validGenParams, mockUserId, 10);

      expect(result).toEqual(cachedResult);
      expect(helpers.tryGenerateAndCacheExercise).toHaveBeenCalledTimes(1);
      expect(helpers.tryGetCachedExercise).toHaveBeenCalledTimes(1);
    });

    it('returns generation error if cache is low, generation and cache fallback both fail', async () => {
      vi.mocked(helpers.tryGenerateAndCacheExercise).mockResolvedValue(generatedFailResult);
      vi.mocked(helpers.tryGetCachedExercise).mockResolvedValue(null);

      const result = await getOrGenerateExercise(validGenParams, mockUserId, 10);

      expect(result.error).toContain(generationFailError.error);
      expect(result.quizId).toBe(-1);
      expect(helpers.createErrorResponse).toHaveBeenCalledWith(
        generationFailError.error,
        undefined
      );
      expect(helpers.tryGenerateAndCacheExercise).toHaveBeenCalledTimes(1);
      expect(helpers.tryGetCachedExercise).toHaveBeenCalledTimes(1);
    });

    it('returns generation error if cache is low and generation fails (terminal cache error)', async () => {
      vi.mocked(helpers.tryGenerateAndCacheExercise).mockResolvedValue(cacheFailResult);

      const result = await getOrGenerateExercise(validGenParams, mockUserId, 10);

      expect(result.error).toContain(cacheFailError.error);
      expect(result.quizId).toBe(-1);
      expect(helpers.createErrorResponse).toHaveBeenCalledWith(cacheFailError.error, undefined);
      expect(helpers.tryGenerateAndCacheExercise).toHaveBeenCalledTimes(1);
      expect(helpers.tryGetCachedExercise).not.toHaveBeenCalled();
    });

    it('returns cached exercise if cache is high and cache lookup succeeds', async () => {
      vi.mocked(helpers.tryGetCachedExercise).mockResolvedValue(cachedResult);

      const result = await getOrGenerateExercise(validGenParams, mockUserId, 200);

      expect(result).toEqual(cachedResult);
      expect(helpers.tryGetCachedExercise).toHaveBeenCalledTimes(1);
      expect(helpers.tryGenerateAndCacheExercise).not.toHaveBeenCalled();
    });

    it('returns generated exercise if cache is high, cache lookup fails, but generation succeeds', async () => {
      vi.mocked(helpers.tryGetCachedExercise).mockResolvedValue(null);
      vi.mocked(helpers.tryGenerateAndCacheExercise).mockResolvedValue(generatedSuccessResult);

      const result = await getOrGenerateExercise(validGenParams, mockUserId, 200);

      expect(result.quizId).toBe(generatedSuccessData.id);
      expect(result.cached).toBe(false);
      expect(result.error).toBeNull();
      expect(result.quizData.paragraph).toBe(mockExerciseContent.paragraph);
      expect(helpers.tryGetCachedExercise).toHaveBeenCalledTimes(1);
      expect(helpers.tryGenerateAndCacheExercise).toHaveBeenCalledTimes(1);
    });

    it('returns generation error if cache is high, cache lookup and generation both fail', async () => {
      vi.mocked(helpers.tryGetCachedExercise).mockResolvedValue(null);
      vi.mocked(helpers.tryGenerateAndCacheExercise).mockResolvedValue(generatedFailResult);

      const result = await getOrGenerateExercise(validGenParams, mockUserId, 200);

      expect(result.error).toContain(generationFailError.error);
      expect(result.quizId).toBe(-1);
      expect(helpers.createErrorResponse).toHaveBeenCalledWith(
        generationFailError.error,
        undefined
      );
      expect(helpers.tryGetCachedExercise).toHaveBeenCalledTimes(1);
      expect(helpers.tryGenerateAndCacheExercise).toHaveBeenCalledTimes(1);
    });

    it('calls console.warn when generation fails and cache fallback is attempted (low cache)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(helpers.tryGenerateAndCacheExercise).mockResolvedValue(generatedFailResult);
      vi.mocked(helpers.tryGetCachedExercise).mockResolvedValue(cachedResult);
      await getOrGenerateExercise(validGenParams, mockUserId, 10);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[API] Generation failed (low cache): Generation Failed')
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          '[API] Attempting cache fallback after non-terminal generation error.'
        )
      );
    });

    it('calls console.warn when cache lookup fails and generation is attempted (high cache)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(helpers.tryGetCachedExercise).mockResolvedValue(null);
      vi.mocked(helpers.tryGenerateAndCacheExercise).mockResolvedValue(generatedSuccessResult);
      await getOrGenerateExercise(validGenParams, mockUserId, 200);
      expect(warn).toHaveBeenCalledWith(
        '[API] Cache count high, but cache lookup failed. Attempting generation.'
      );
    });
  });
});
