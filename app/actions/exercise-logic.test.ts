import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as logic from './exercise-logic';
import { generateAndValidateExercise } from '@/lib/ai/exercise-generator';
import { saveExerciseToCache, getValidatedExerciseFromCache } from '@/lib/exercise-cache';
import { ExerciseRequestParamsSchema, GenerateExerciseResultSchema } from '@/lib/domain/schemas';
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

const mockParams = {
  topic: 'Test Topic',
  passageLanguage: 'en',
  questionLanguage: 'es',
  passageLangName: 'English',
  questionLangName: 'Spanish',
  level: 'B1',
  grammarGuidance: 'Past tense',
  vocabularyGuidance: 'Travel words',
} as const satisfies ExerciseGenerationParams;

const mockRequestParams = {
  passageLanguage: 'en',
  questionLanguage: 'es',
  cefrLevel: 'B1',
} as const satisfies ExerciseRequestParams;

const mockUserId = 123;
const mockLanguage = 'en';

const mockExerciseContent = {
  paragraph: 'p',
  question: 'q',
  options: { A: 'A', B: 'B', C: 'C', D: 'D' },
  correctAnswer: 'A',
  allExplanations: { A: 'EA', B: 'EB', C: 'EC', D: 'ED' },
  relevantText: 'rt',
  topic: 'Test Topic',
} as const satisfies ExerciseContent;

const mockCacheResult = {
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
} as const satisfies GenerateExerciseResult;

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
    it.each([
      [new Error('AI failed'), 'Error during AI generation/processing: AI failed'],
      [new Error('Generic failure'), 'Error during AI generation/processing: Generic failure'],
      [123, 'Error during AI generation/processing: 123'],
      [null, 'Error during AI generation/processing: null'],
    ])('returns failure if generateAndValidateExercise throws %p', async (thrown, expectedMsg) => {
      vi.mocked(generateAndValidateExercise).mockRejectedValue(thrown);
      const result = await tryGenerateAndCacheExercise(mockParams, mockLanguage, mockUserId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.error).toContain(expectedMsg);
        expect(typeof result.error.error).toBe('string');
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
      vi.mocked(generateAndValidateExercise).mockResolvedValue(mockExerciseContent);
      vi.mocked(saveExerciseToCache).mockImplementation(() => {
        throw new Error('Cache save failed');
      });
      const result = await tryGenerateAndCacheExercise(mockParams, mockLanguage, mockUserId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.error).toBe('Error during AI generation/processing: Cache save failed');
      }
    });
    it('returns failure if saveExerciseToCache throws a non-Error value', async () => {
      vi.mocked(generateAndValidateExercise).mockResolvedValue(mockExerciseContent);
      vi.mocked(saveExerciseToCache).mockImplementation(() => {
        throw new Error('123');
      });
      const result = await tryGenerateAndCacheExercise(mockParams, mockLanguage, mockUserId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.error).toBe('Error during AI generation/processing: 123');
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
      expect(GenerateExerciseResultSchema.safeParse(result).success).toBe(true);
    });
    it('returns null if no cached exercise is found', async () => {
      vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
      const result = await tryGetCachedExercise(mockRequestParams, mockUserId);
      expect(result).toBeNull();
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
      expect(GenerateExerciseResultSchema.safeParse(response).success).toBe(true);
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
      expect(GenerateExerciseResultSchema.safeParse(response).success).toBe(true);
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
        expect(ExerciseRequestParamsSchema.safeParse(result.data).success).toBe(true);
      }
    });
    it('invalidates incorrect params', () => {
      const invalidParams = { passageLanguage: 'en', questionLanguage: 'fr', cefrLevel: 'Z9' };
      const result = validateRequestParams(invalidParams);
      expect(result.success).toBe(false);
    });
    it('invalidates missing params', () => {
      const result = validateRequestParams({});
      expect(result.success).toBe(false);
    });
  });

  describe('getOrGenerateExercise', () => {
    const validGenParams = {
      passageLanguage: 'en',
      questionLanguage: 'fr',
      level: 'A2',
      topic: 'Mock Topic',
      passageLangName: 'English',
      questionLangName: 'French',
      grammarGuidance: 'Mock Grammar',
      vocabularyGuidance: 'Mock Vocab',
    } as const satisfies ExerciseGenerationParams;
    const mockUserId = 1;
    const generatedSuccessData = { content: mockExerciseContent, id: 555 };
    const cachedResult = {
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
    } as const satisfies GenerateExerciseResult;
    beforeEach(() => {
      vi.resetAllMocks();
    });
    it.each([
      [10, false],
      [99, false],
      [100, true],
      [200, true],
    ])(
      'returns correct result for cachedCount=%i (preferGenerate=%s)',
      async (cachedCount, preferCache) => {
        if (preferCache) {
          vi.mocked(getValidatedExerciseFromCache).mockReturnValue({
            quizData: cachedResult.quizData,
            quizId: cachedResult.quizId,
          });
          const result = await getOrGenerateExercise(validGenParams, mockUserId, cachedCount);
          expect(result).toEqual(cachedResult);
          expect(GenerateExerciseResultSchema.safeParse(result).success).toBe(true);
        } else {
          vi.mocked(generateAndValidateExercise).mockResolvedValue(mockExerciseContent);
          vi.mocked(saveExerciseToCache).mockReturnValue(555);
          vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
          const result = await getOrGenerateExercise(validGenParams, mockUserId, cachedCount);
          expect(result.quizId).toBe(generatedSuccessData.id);
          expect(result.cached).toBe(false);
          expect(result.error).toBeNull();
          expect(result.quizData.paragraph).toBe(mockExerciseContent.paragraph);
          expect(GenerateExerciseResultSchema.safeParse(result).success).toBe(true);
        }
      }
    );
    it('returns generation error if cache is low, generation and cache fallback both fail', async () => {
      vi.mocked(generateAndValidateExercise).mockRejectedValue(new Error('Generation Failed'));
      vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
      const result = await getOrGenerateExercise(validGenParams, mockUserId, 10);
      expect(result.error).toContain('Generation Failed');
      expect(result.quizId).toBe(-1);
      expect(GenerateExerciseResultSchema.safeParse(result).success).toBe(true);
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
      expect(GenerateExerciseResultSchema.safeParse(result).success).toBe(true);
    });
    it('returns generation error if cache is high, cache lookup and generation both fail', async () => {
      vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
      vi.mocked(generateAndValidateExercise).mockRejectedValue(new Error('Generation Failed'));
      const result = await getOrGenerateExercise(validGenParams, mockUserId, 200);
      expect(result.error).toContain('Generation Failed');
      expect(result.quizId).toBe(-1);
      expect(GenerateExerciseResultSchema.safeParse(result).success).toBe(true);
    });
  });
});
