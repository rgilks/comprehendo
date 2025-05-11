import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as logic from './exercise-logic';
import { generateAndValidateExercise } from '@/lib/ai/exercise-generator';
import { saveExerciseToCache, getValidatedExerciseFromCache } from '@/lib/exercise-cache';
import type { ExerciseGenerationParams } from '@/lib/domain/ai';
import type {
  ExerciseContent,
  ExerciseRequestParams,
  GenerateExerciseResult,
} from '@/lib/domain/schemas';

vi.mock('@/lib/exercise-cache');
vi.mock('@/lib/ai/exercise-generator');

const {
  tryGenerateAndCacheExercise,
  tryGetCachedExercise,
  createErrorResponse,
  DEFAULT_EMPTY_QUIZ_DATA,
  validateRequestParams,
  getOrGenerateExercise,
} = logic;

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

describe('Exercise Logic Functions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('tryGenerateAndCacheExercise', () => {
    it('returns success with ExerciseContent and id on successful generation and cache', async () => {
      vi.mocked(generateAndValidateExercise).mockResolvedValue(mockExerciseContent);
      vi.mocked(saveExerciseToCache).mockReturnValue(123);
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
    it('returns failure if generateAndValidateExercise throws an error', async () => {
      const error = new Error('AI failed');
      vi.mocked(generateAndValidateExercise).mockRejectedValue(error);
      const result = await tryGenerateAndCacheExercise(mockParams, mockLanguage, mockUserId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.error).toContain('Error during AI generation/processing: AI failed');
      }
      expect(saveExerciseToCache).not.toHaveBeenCalled();
    });
    it('returns failure if generateAndValidateExercise throws a non-standard error', async () => {
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
    it('returns failure if saveExerciseToCache returns undefined', async () => {
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
    it('returns failure if saveExerciseToCache throws an error', async () => {
      const cacheError = new Error('Cache save failed');
      vi.mocked(generateAndValidateExercise).mockResolvedValue(mockExerciseContent);
      vi.mocked(saveExerciseToCache).mockImplementation(() => {
        throw cacheError;
      });
      const result = await tryGenerateAndCacheExercise(mockParams, mockLanguage, mockUserId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.error).toBe('Error during AI generation/processing: Cache save failed');
      }
    });
  });

  describe('tryGetCachedExercise', () => {
    it('returns cached exercise if found', async () => {
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
    it('returns null if no cached exercise is found', async () => {
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
    it('creates a standard error response object', () => {
      const errorMsg = 'Test error';
      const response = createErrorResponse(errorMsg);
      expect(response).toEqual({
        quizData: DEFAULT_EMPTY_QUIZ_DATA,
        quizId: -1,
        error: errorMsg,
        cached: false,
      });
    });
    it('includes details if provided', () => {
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

  describe('validateRequestParams', () => {
    it('validates correct params', () => {
      const validParams = { passageLanguage: 'en', questionLanguage: 'fr', cefrLevel: 'A2' };
      const result = validateRequestParams(validParams);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.passageLanguage).toBe(validParams.passageLanguage);
        expect(result.data.questionLanguage).toBe(validParams.questionLanguage);
        expect(result.data.cefrLevel).toBe(validParams.cefrLevel);
      }
    });
    it('invalidates incorrect params', () => {
      const invalidParams = { passageLanguage: 'en', questionLanguage: 'fr', cefrLevel: 'Z9' };
      const result = validateRequestParams(invalidParams);
      expect(result.success).toBe(false);
    });
  });

  describe('getOrGenerateExercise', () => {
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
    const generatedSuccessData = { content: mockExerciseContent, id: 555 };
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
    beforeEach(() => {
      vi.resetAllMocks();
    });
    it('returns generated exercise if cache is low and generation succeeds', async () => {
      vi.mocked(generateAndValidateExercise).mockResolvedValue(mockExerciseContent);
      vi.mocked(saveExerciseToCache).mockReturnValue(555);
      vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
      const result = await getOrGenerateExercise(validGenParams, mockUserId, 10);
      expect(result.quizId).toBe(generatedSuccessData.id);
      expect(result.cached).toBe(false);
      expect(result.error).toBeNull();
      expect(result.quizData.paragraph).toBe(mockExerciseContent.paragraph);
    });
    it('returns cached exercise if cache is low, generation fails, but cache fallback succeeds', async () => {
      vi.mocked(generateAndValidateExercise).mockRejectedValue(new Error('Generation Failed'));
      vi.mocked(getValidatedExerciseFromCache).mockReturnValue({
        quizData: cachedResult.quizData,
        quizId: cachedResult.quizId,
      });
      const result = await getOrGenerateExercise(validGenParams, mockUserId, 10);
      expect(result).toEqual(cachedResult);
    });
    it('returns generation error if cache is low, generation and cache fallback both fail', async () => {
      vi.mocked(generateAndValidateExercise).mockRejectedValue(new Error('Generation Failed'));
      vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
      const result = await getOrGenerateExercise(validGenParams, mockUserId, 10);
      expect(result.error).toContain('Generation Failed');
      expect(result.quizId).toBe(-1);
    });
    it('returns generation error if cache is low and generation fails (terminal cache error)', async () => {
      vi.mocked(generateAndValidateExercise).mockResolvedValue(mockExerciseContent);
      vi.mocked(saveExerciseToCache).mockReturnValue(undefined);
      vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
      const result = await getOrGenerateExercise(validGenParams, mockUserId, 10);
      expect(result.error).toContain(
        'Exercise generated but failed to save to cache (undefined ID).'
      );
      expect(result.quizId).toBe(-1);
    });
    it('returns cached exercise if cache is high and cache lookup succeeds', async () => {
      vi.mocked(getValidatedExerciseFromCache).mockReturnValue({
        quizData: cachedResult.quizData,
        quizId: cachedResult.quizId,
      });
      const result = await getOrGenerateExercise(validGenParams, mockUserId, 200);
      expect(result).toEqual(cachedResult);
    });
    it('returns generated exercise if cache is high, cache lookup fails, but generation succeeds', async () => {
      vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
      vi.mocked(generateAndValidateExercise).mockResolvedValue(mockExerciseContent);
      vi.mocked(saveExerciseToCache).mockReturnValue(555);
      const result = await getOrGenerateExercise(validGenParams, mockUserId, 200);
      expect(result.quizId).toBe(generatedSuccessData.id);
      expect(result.cached).toBe(false);
      expect(result.error).toBeNull();
      expect(result.quizData.paragraph).toBe(mockExerciseContent.paragraph);
    });
    it('returns generation error if cache is high, cache lookup and generation both fail', async () => {
      vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
      vi.mocked(generateAndValidateExercise).mockRejectedValue(new Error('Generation Failed'));
      const result = await getOrGenerateExercise(validGenParams, mockUserId, 200);
      expect(result.error).toContain('Generation Failed');
      expect(result.quizId).toBe(-1);
    });
  });
});
