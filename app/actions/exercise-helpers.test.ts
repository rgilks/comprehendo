import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  tryGenerateAndCacheExercise,
  tryGetCachedExercise,
  createErrorResponse,
  DEFAULT_EMPTY_QUIZ_DATA,
} from './exercise-helpers';
import { saveExerciseToCache, getValidatedExerciseFromCache } from '@/lib/exercise-cache';
import {
  generateAndValidateExercise,
  AIResponseProcessingError,
} from '@/lib/ai/exercise-generator';
import type { ExerciseGenerationParams } from '@/lib/domain/ai';
import type {
  ExerciseContent,
  ExerciseRequestParams,
  GenerateExerciseResult,
} from '@/lib/domain/schemas';
// Mocks
vi.mock('@/lib/exercise-cache');
vi.mock('@/lib/ai/exercise-generator');

// Mock data
const mockParams: ExerciseGenerationParams = {
  topic: 'Test Topic',
  passageLanguage: 'en',
  questionLanguage: 'es',
  passageLangName: 'English',
  questionLangName: 'Spanish',
  level: 'B1',
  grammarGuidance: 'Past tense',
  vocabularyGuidance: 'Travel words',
};

const mockRequestParams: ExerciseRequestParams = {
  passageLanguage: 'en',
  questionLanguage: 'es',
  cefrLevel: 'B1',
};

const mockUserId = 123;
const mockLanguage = 'en';

const mockExerciseContent: ExerciseContent = {
  paragraph: 'p',
  question: 'q',
  options: { A: 'A', B: 'B', C: 'C', D: 'D' },
  correctAnswer: 'A',
  allExplanations: { A: 'EA', B: 'EB', C: 'EC', D: 'ED' },
  relevantText: 'rt',
  topic: 'Test Topic',
};

const mockCacheResult: GenerateExerciseResult = {
  quizData: {
    paragraph: 'cached_p',
    question: 'cached_q',
    options: { A: 'cA', B: 'cB', C: 'cC', D: 'cD' },
    topic: 'Cached Topic',
    language: 'en',
  },
  quizId: 999,
  cached: true,
  error: null,
};

describe('Exercise Helper Functions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('tryGenerateAndCacheExercise', () => {
    it('should return success with ExerciseContent and id on successful generation and cache', async () => {
      vi.mocked(generateAndValidateExercise).mockResolvedValue(mockExerciseContent);
      vi.mocked(saveExerciseToCache).mockReturnValue(123); // Assume cache save returns ID 123

      const result = await tryGenerateAndCacheExercise(mockParams, mockLanguage, mockUserId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toEqual(mockExerciseContent);
        expect(result.data.id).toBe(123);
      }
      expect(generateAndValidateExercise).toHaveBeenCalledWith({
        ...mockParams,
        language: mockLanguage,
      });
      expect(saveExerciseToCache).toHaveBeenCalledWith(
        mockParams.passageLanguage,
        mockParams.questionLanguage,
        mockParams.level,
        JSON.stringify(mockExerciseContent),
        mockUserId
      );
    });

    it('should return failure if generateAndValidateExercise throws an error', async () => {
      const aiError = new AIResponseProcessingError('AI failed');
      vi.mocked(generateAndValidateExercise).mockRejectedValue(aiError);

      const result = await tryGenerateAndCacheExercise(mockParams, mockLanguage, mockUserId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.error).toContain('Error during AI generation/processing: AI failed');
      }
      expect(saveExerciseToCache).not.toHaveBeenCalled();
    });

    it('should return failure if generateAndValidateExercise throws a non-standard error', async () => {
      const genericError = new Error('Generic failure');
      vi.mocked(generateAndValidateExercise).mockRejectedValue(genericError);

      const result = await tryGenerateAndCacheExercise(mockParams, mockLanguage, mockUserId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.error).toContain(
          'Error during AI generation/processing: Generic failure'
        );
      }
      expect(saveExerciseToCache).not.toHaveBeenCalled();
    });

    it('should return failure if saveExerciseToCache returns undefined', async () => {
      vi.mocked(generateAndValidateExercise).mockResolvedValue(mockExerciseContent);
      vi.mocked(saveExerciseToCache).mockReturnValue(undefined);

      const result = await tryGenerateAndCacheExercise(mockParams, mockLanguage, mockUserId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.error).toBe(
          'Exercise generated but failed to save to cache (undefined ID).'
        );
      }
    });

    it('should return failure if saveExerciseToCache throws an error', async () => {
      const cacheError = new Error('Cache save failed');
      vi.mocked(generateAndValidateExercise).mockResolvedValue(mockExerciseContent);
      vi.mocked(saveExerciseToCache).mockImplementation(() => {
        throw cacheError;
      });

      const result = await tryGenerateAndCacheExercise(mockParams, mockLanguage, mockUserId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.error).toBe(
          'Exercise generated but failed to save to cache. Please try again.'
        );
        expect(result.error.details).toBe(cacheError);
      }
    });
  });

  describe('tryGetCachedExercise', () => {
    it('should return cached exercise if found', async () => {
      vi.mocked(getValidatedExerciseFromCache).mockReturnValue({
        quizData: mockCacheResult.quizData,
        quizId: mockCacheResult.quizId,
      });

      const result = await tryGetCachedExercise(mockRequestParams, mockUserId);

      expect(result).toEqual(mockCacheResult);
      expect(getValidatedExerciseFromCache).toHaveBeenCalledWith(
        mockRequestParams.passageLanguage,
        mockRequestParams.questionLanguage,
        mockRequestParams.cefrLevel,
        mockUserId
      );
    });

    it('should return null if no cached exercise is found', async () => {
      vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);

      const result = await tryGetCachedExercise(mockRequestParams, mockUserId);

      expect(result).toBeNull();
      expect(getValidatedExerciseFromCache).toHaveBeenCalledWith(
        mockRequestParams.passageLanguage,
        mockRequestParams.questionLanguage,
        mockRequestParams.cefrLevel,
        mockUserId
      );
    });
  });

  describe('createErrorResponse', () => {
    it('should create a standard error response object', () => {
      const errorMsg = 'Test error';
      const response = createErrorResponse(errorMsg);
      expect(response).toEqual({
        quizData: DEFAULT_EMPTY_QUIZ_DATA,
        quizId: -1,
        error: errorMsg,
        cached: false,
      });
    });

    it('should include details if provided', () => {
      const errorMsg = 'Test error';
      const details = { code: 500 };
      const response = createErrorResponse(errorMsg, details);
      expect(response).toEqual({
        quizData: DEFAULT_EMPTY_QUIZ_DATA,
        quizId: -1,
        error: `${errorMsg}: ${JSON.stringify(details)}`,
        cached: false,
      });
    });
  });
});
