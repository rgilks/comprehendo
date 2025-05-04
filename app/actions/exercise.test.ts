import { describe, test, expect, vi, beforeEach } from 'vitest';
import { generateExerciseResponse, tryGetCachedExercise } from './exercise';
import {
  type ExerciseRequestParams,
  ExerciseContentSchema,
  GenerateExerciseResultSchema,
} from '@/lib/domain/schemas';
import { AIResponseProcessingError } from '@/lib/ai/exercise-generator';
import type { Session } from 'next-auth';
import type { GenerateExerciseResult } from '@/lib/domain/schemas';
import { z } from 'zod';

const { getServerSession } = await import('next-auth');
const rateLimiter = await import('@/lib/rate-limiter');
const exerciseCache = await import('@/lib/exercise-cache');
const aiGenerator = await import('@/lib/ai/exercise-generator');
const authUtils = await import('@/lib/authUtils');

vi.mock('@/lib/db', () => ({
  default: {
    prepare: vi.fn().mockReturnThis(),
    get: vi.fn(),
    run: vi.fn(),
  },
}));

vi.mock('next-auth', async (importOriginal) => {
  const mod = await importOriginal<typeof import('next-auth')>();
  return {
    ...mod,
    getServerSession: vi.fn(),
  };
});

vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn((header: string) => (header === 'x-forwarded-for' ? '127.0.0.1' : 'mock-header')),
  })),
}));

vi.mock('@/config/languages', () => ({
  LANGUAGES: {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
  },
  Language: {} as any,
}));

vi.mock('@/config/topics', () => ({
  getRandomTopicForLevel: vi.fn(() => 'mock topic'),
}));

vi.mock('@/lib/authOptions', () => ({
  authOptions: { mock: 'authOptions' },
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(() => true),
}));

vi.mock('@/lib/exercise-cache', () => ({
  getValidatedExerciseFromCache: vi.fn(() => undefined),
  saveExerciseToCache: vi.fn((_, __, ___, ____, _____) => 123),
  countCachedExercises: vi.fn(() => 0),
}));

vi.mock('@/lib/ai/exercise-generator', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/ai/exercise-generator')>();
  return {
    generateAndValidateExercise: vi.fn(),
    AIResponseProcessingError: mod.AIResponseProcessingError,
  };
});

vi.mock('@/lib/authUtils', () => ({
  getDbUserIdFromSession: vi.fn(() => null),
}));

vi.mock('@/lib/domain/language');

vi.mock('@/lib/domain/language-guidance', async (importOriginal) => {
  const { z } = await import('zod');
  const actual = await importOriginal<typeof import('@/lib/domain/language-guidance')>();
  return {
    ...actual,
    getGrammarGuidance: vi.fn().mockReturnValue('mock grammar guidance'),
    getVocabularyGuidance: vi.fn().mockReturnValue('mock vocabulary guidance'),
    CEFRLevelSchema: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  };
});

describe('generateExerciseResponse', () => {
  const checkRateLimit = rateLimiter.checkRateLimit;
  const countCachedExercises = exerciseCache.countCachedExercises;
  const getValidatedExerciseFromCache = exerciseCache.getValidatedExerciseFromCache;
  const saveExerciseToCache = exerciseCache.saveExerciseToCache;
  const generateAndValidateExercise = aiGenerator.generateAndValidateExercise;
  const getDbUserIdFromSession = authUtils.getDbUserIdFromSession;

  const defaultParams: ExerciseRequestParams = {
    passageLanguage: 'en',
    questionLanguage: 'es',
    cefrLevel: 'B1',
  };

  const mockValidatedAiData = {
    paragraph: 'Mock paragraph',
    question: 'Mock question?',
    options: { A: 'Opt A', B: 'Opt B', C: 'Opt C', D: 'Opt D' },
    topic: 'mock topic',
    correctAnswer: 'A',
    allExplanations: { A: 'Expl A', B: 'Expl B', C: 'Expl C', D: 'Expl D' },
    relevantText: 'Mock relevant text',
  };

  const mockRawAiResponse = {
    ...mockValidatedAiData,
    someOtherAiField: 'foo',
  };

  const defaultEmptyQuizData = {
    paragraph: '',
    question: '',
    options: { A: '', B: '', C: '', D: '' },
    language: null,
    topic: null,
  };

  const expectedQuizDataFromMock = {
    paragraph: 'Mock paragraph',
    question: 'Mock question?',
    options: { A: 'Opt A', B: 'Opt B', C: 'Opt C', D: 'Opt D' },
    topic: 'mock topic',
    language: 'en',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(saveExerciseToCache).mockReturnValue(123);
    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(getDbUserIdFromSession).mockReturnValue(null);
    vi.mocked(generateAndValidateExercise).mockResolvedValue(mockRawAiResponse);

    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: mockValidatedAiData,
    });

    vi.spyOn(GenerateExerciseResultSchema, 'safeParse').mockImplementation((data) => {
      if (typeof data === 'object' && data !== null && 'quizData' in data) {
        return { success: true, data: data as GenerateExerciseResult };
      }
      return { success: false, error: new z.ZodError([]) };
    });
  });

  test('should return generated exercise when allowed and cache is low', async () => {
    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBeNull();
    expect(result.quizId).toBe(123);
    expect(result.cached).toBe(false);
    expect(result.quizData).toEqual(expectedQuizDataFromMock);

    expect(checkRateLimit).toHaveBeenCalled();
    expect(countCachedExercises).toHaveBeenCalledWith(
      defaultParams.passageLanguage,
      defaultParams.questionLanguage,
      defaultParams.cefrLevel
    );
    expect(getValidatedExerciseFromCache).not.toHaveBeenCalled();
    expect(generateAndValidateExercise).toHaveBeenCalledTimes(1);
    const saveCallArgs = vi.mocked(saveExerciseToCache).mock.calls[0];
    expect(saveCallArgs[3]).toEqual(JSON.stringify(mockValidatedAiData));
    expect(saveCallArgs[4]).toBe(null);
  });

  test('should look up user ID if session exists', async () => {
    const mockSession: Session = { expires: '1', user: { email: 'test@test.com', name: 'Test' } };
    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    vi.mocked(getDbUserIdFromSession).mockReturnValue(456);
    vi.mocked(saveExerciseToCache).mockReturnValue(124);

    await generateExerciseResponse(defaultParams);

    expect(getServerSession).toHaveBeenCalled();
    expect(getDbUserIdFromSession).toHaveBeenCalledWith(mockSession);
    expect(countCachedExercises).toHaveBeenCalledWith(
      defaultParams.passageLanguage,
      defaultParams.questionLanguage,
      defaultParams.cefrLevel
    );
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(saveExerciseToCache).toHaveBeenCalledWith(
      defaultParams.passageLanguage,
      defaultParams.questionLanguage,
      defaultParams.cefrLevel,
      JSON.stringify(mockValidatedAiData),
      456
    );
  });

  test('should return cached exercise when rate limit exceeded', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(false);
    const cachedExerciseResult: GenerateExerciseResult = {
      quizData: {
        paragraph: 'Cached para',
        question: 'Q',
        options: { A: 'a', B: 'b', C: 'c', D: 'd' },
        topic: 't',
        language: 'en',
      },
      quizId: 777,
      error: null,
      cached: true,
    };
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(cachedExerciseResult);
    vi.spyOn(GenerateExerciseResultSchema, 'safeParse').mockReturnValue({
      success: true,
      data: cachedExerciseResult,
    });

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBeNull();
    expect(result.quizId).toBe(777);
    expect(result.quizData).toEqual(cachedExerciseResult.quizData);
    expect(result.cached).toBe(true);
    expect(checkRateLimit).toHaveBeenCalled();
    expect(getValidatedExerciseFromCache).toHaveBeenCalledWith(
      defaultParams.passageLanguage,
      defaultParams.questionLanguage,
      defaultParams.cefrLevel,
      null
    );
    expect(generateAndValidateExercise).not.toHaveBeenCalled();
    expect(countCachedExercises).not.toHaveBeenCalled();
  });

  test('should return rate limit error if rate limited and no cache found', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(false);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBe('Rate limit exceeded and no cached question available.');
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(result.cached).toBe(false);
    expect(checkRateLimit).toHaveBeenCalled();
    expect(getValidatedExerciseFromCache).toHaveBeenCalled();
    expect(countCachedExercises).not.toHaveBeenCalled();
    expect(generateAndValidateExercise).not.toHaveBeenCalled();
  });

  test('should return cached exercise when cache count is high', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(1000);
    const cachedExerciseResult: GenerateExerciseResult = {
      quizData: {
        paragraph: 'Cached para high',
        question: 'Q2',
        options: { A: 'a', B: 'b', C: 'c', D: 'd' },
        topic: 't2',
        language: 'en',
      },
      quizId: 888,
      error: null,
      cached: true,
    };
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(cachedExerciseResult);
    vi.spyOn(GenerateExerciseResultSchema, 'safeParse').mockReturnValue({
      success: true,
      data: cachedExerciseResult,
    });

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBeNull();
    expect(result.quizId).toBe(888);
    expect(result.cached).toBe(true);
    expect(result.quizData).toEqual(cachedExerciseResult.quizData);
    expect(checkRateLimit).toHaveBeenCalled();
    expect(countCachedExercises).toHaveBeenCalled();
    expect(getValidatedExerciseFromCache).toHaveBeenCalled();
    expect(generateAndValidateExercise).not.toHaveBeenCalled();
  });

  test('should attempt generation if cache count is high but cache lookup fails', async () => {
    vi.mocked(countCachedExercises).mockReturnValue(1000);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(generateAndValidateExercise).mockResolvedValue(mockRawAiResponse);
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: mockValidatedAiData,
    });
    vi.mocked(saveExerciseToCache).mockReturnValue(123);

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBeNull();
    expect(result.quizId).toBe(123);
    expect(result.cached).toBe(false);
    expect(result.quizData).toEqual(expectedQuizDataFromMock);

    expect(checkRateLimit).toHaveBeenCalled();
    expect(countCachedExercises).toHaveBeenCalled();
    expect(getValidatedExerciseFromCache).toHaveBeenCalledTimes(1);
    expect(generateAndValidateExercise).toHaveBeenCalledTimes(1);
    expect(saveExerciseToCache).toHaveBeenCalledTimes(1);
  });

  test('should return error if generation fails (AI call error) and no cache fallback', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(generateAndValidateExercise).mockRejectedValue(new Error('AI Failed'));

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBe('An unexpected error occurred during exercise generation: AI Failed');
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(getValidatedExerciseFromCache).toHaveBeenCalledTimes(1);
  });

  test('should return error if generation fails (JSON parsing) and no cache fallback', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(generateAndValidateExercise).mockRejectedValue(
      new AIResponseProcessingError('Failed to parse AI JSON response. Error: Some parse error')
    );

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBe('Failed to parse AI JSON response. Error: Some parse error');
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(getValidatedExerciseFromCache).toHaveBeenCalledTimes(1);
  });

  test('should return error if generation fails with non-Error object', async () => {
    vi.mocked(generateAndValidateExercise).mockRejectedValue('Some random string error');
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBe(
      'An unexpected error occurred during exercise generation: An unknown error occurred during exercise generation'
    );
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(getValidatedExerciseFromCache).toHaveBeenCalledTimes(1);
  });

  test('should return validation error for invalid input params', async () => {
    const invalidParams = {
      passageLanguage: 'invalid-lang',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    };

    const result = await generateExerciseResponse(invalidParams as any);

    expect(result.error).toMatch(/Invalid request parameters: passageLanguage:/);
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).not.toHaveBeenCalled();
    expect(saveExerciseToCache).not.toHaveBeenCalled();
  });

  test('should return specific error if AI response processing fails', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    const specificError = new AIResponseProcessingError('Specific processing issue');
    vi.mocked(generateAndValidateExercise).mockRejectedValue(specificError);

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBe('Specific processing issue');
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(getValidatedExerciseFromCache).toHaveBeenCalledTimes(1);
  });

  test('should return specific error if cache save fails', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(generateAndValidateExercise).mockResolvedValue(mockRawAiResponse);
    vi.mocked(saveExerciseToCache).mockImplementation(() => {
      throw new Error('Cache save failed');
    });
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: mockValidatedAiData,
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBe('Failed to save generated exercise to cache.');
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(saveExerciseToCache).toHaveBeenCalled();
    expect(getValidatedExerciseFromCache).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[API:tryGenerate] Failed to save exercise to cache:'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  test('should return error if saveExerciseToCache returns undefined', async () => {
    vi.mocked(saveExerciseToCache).mockReturnValue(undefined);
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: mockValidatedAiData,
    });
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBe('Failed to save generated exercise to cache.');
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(saveExerciseToCache).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[API:tryGenerate] Failed to save exercise to cache:'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  test('should return error if ExerciseContentSchema safeParse fails', async () => {
    const invalidAiData = { ...mockRawAiResponse, paragraph: undefined };
    vi.mocked(generateAndValidateExercise).mockResolvedValue(invalidAiData as any);
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: false,
      error: new z.ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['paragraph'],
          message: 'Required',
        },
      ]),
    });
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBe('Failed to validate AI response structure.');
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(ExerciseContentSchema.safeParse).toHaveBeenCalledWith(invalidAiData);
    expect(saveExerciseToCache).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[API] AI response failed validation:'),
      expect.any(Array),
      expect.stringContaining('Original Data:'),
      invalidAiData
    );

    consoleErrorSpy.mockRestore();
  });

  test('should return error if GenerateExerciseResultSchema safeParse fails for cached data', async () => {
    const invalidCachedData = {
      quizData: {
        paragraph: 'Cached para',
        question: 'Q',
        options: {},
        topic: 't',
        language: 'en',
      },
      quizId: 999,
      error: null,
      cached: true,
    };
    vi.mocked(countCachedExercises).mockReturnValue(1000);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(invalidCachedData as any);
    vi.spyOn(GenerateExerciseResultSchema, 'safeParse').mockReturnValue({
      success: false,
      error: new z.ZodError([]),
    });

    vi.mocked(generateAndValidateExercise).mockResolvedValue(mockRawAiResponse);
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: mockValidatedAiData,
    });
    vi.mocked(saveExerciseToCache).mockReturnValue(125);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBeNull();
    expect(result.quizId).toBe(125);
    expect(result.cached).toBe(false);
    expect(result.quizData).toEqual(expectedQuizDataFromMock);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[API] Cached data failed validation:'),
      expect.any(Array),
      expect.stringContaining('Original Data:'),
      invalidCachedData
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[API] Cache count high, but cache lookup failed. Attempting generation.'
    );
    expect(generateAndValidateExercise).toHaveBeenCalledTimes(1);
    expect(saveExerciseToCache).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  test('should log warning and attempt cache when generation fails (but not save error)', async () => {
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(generateAndValidateExercise).mockRejectedValue(new Error('Gen Failed'));
    const cachedResult: GenerateExerciseResult = {
      quizData: {
        paragraph: 'Fallback',
        question: '?',
        options: { A: 'a', B: 'b', C: 'c', D: 'd' },
        topic: 'fb',
        language: 'en',
      },
      quizId: 998,
      error: null,
      cached: true,
    };
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(cachedResult);
    vi.spyOn(GenerateExerciseResultSchema, 'safeParse').mockReturnValue({
      success: true,
      data: cachedResult,
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBeNull();
    expect(result.quizId).toBe(998);
    expect(result.cached).toBe(true);
    expect(result.quizData).toEqual(cachedResult.quizData);

    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[API] Generation failed (low cache), attempting cache fallback.'
    );
    expect(getValidatedExerciseFromCache).toHaveBeenCalledTimes(1);
    expect(saveExerciseToCache).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });
});

describe('additional branch coverage for generateExerciseResponse', () => {
  test('should log originalError stack if AIResponseProcessingError.originalError is Error', async () => {
    const { AIResponseProcessingError } = await import('@/lib/ai/exercise-generator');
    const originalError = new Error('Original stack error');
    const error = new AIResponseProcessingError('AI error', originalError);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(rateLimiter.checkRateLimit).mockReturnValue(true);
    vi.mocked(exerciseCache.countCachedExercises).mockReturnValue(0);
    vi.mocked(aiGenerator.generateAndValidateExercise).mockRejectedValue(error);
    vi.mocked(exerciseCache.getValidatedExerciseFromCache).mockReturnValue(undefined);
    await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    expect(spy).toHaveBeenCalledWith(
      '[API] Original AI Error:',
      originalError.message,
      originalError.stack
    );
    spy.mockRestore();
  });

  test('should log originalError as non-Error object if AIResponseProcessingError.originalError is not Error', async () => {
    const { AIResponseProcessingError } = await import('@/lib/ai/exercise-generator');
    const originalError = { foo: 'bar' };
    const error = new AIResponseProcessingError('AI error', originalError);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(rateLimiter.checkRateLimit).mockReturnValue(true);
    vi.mocked(exerciseCache.countCachedExercises).mockReturnValue(0);
    vi.mocked(aiGenerator.generateAndValidateExercise).mockRejectedValue(error);
    vi.mocked(exerciseCache.getValidatedExerciseFromCache).mockReturnValue(undefined);
    await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    expect(spy).toHaveBeenCalledWith('[API] Original AI Error (non-Error object):', originalError);
    spy.mockRestore();
  });

  test('should log and return null if cached data fails schema validation in tryGetCachedExercise', async () => {
    const invalidCachedData = {
      quizData: {
        paragraph: 'Cached para',
        question: 'Q',
        options: {},
        topic: 't',
        language: 'en',
      },
      quizId: 999,
      error: null,
      cached: true,
    };
    vi.mocked(exerciseCache.getValidatedExerciseFromCache).mockReturnValue(
      invalidCachedData as any
    );
    const safeParseSpy = vi
      .spyOn(GenerateExerciseResultSchema, 'safeParse')
      .mockReturnValue({ success: false, error: new z.ZodError([]) });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await tryGetCachedExercise(
      { passageLanguage: 'en', questionLanguage: 'es', cefrLevel: 'B1' },
      null
    );
    expect(result).toBeNull();
    expect(spy).toHaveBeenCalledWith(
      '[API] Cached data failed validation:',
      expect.any(Array),
      'Original Data:',
      invalidCachedData
    );
    spy.mockRestore();
    safeParseSpy.mockRestore();
  });
});

describe('additional edge cases', () => {
  test('should handle AI generator returning null', async () => {
    vi.mocked(aiGenerator.generateAndValidateExercise).mockResolvedValue(null as any);
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: false,
      error: new z.ZodError([
        {
          code: 'invalid_type',
          expected: 'object',
          received: 'null',
          path: [],
          message: 'Required',
        },
      ]),
    });
    const result = await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    expect(result.error).toBe('Failed to validate AI response structure.');
    expect(result.quizData).toEqual({
      paragraph: '',
      question: '',
      options: { A: '', B: '', C: '', D: '' },
      language: null,
      topic: null,
    });
    expect(result.quizId).toBe(-1);
  });

  test('should handle large input values', async () => {
    const largeParagraph = 'A'.repeat(10000);
    const largeQuestion = 'Q'.repeat(5000);
    const largeOptions = {
      A: 'A'.repeat(1000),
      B: 'B'.repeat(1000),
      C: 'C'.repeat(1000),
      D: 'D'.repeat(1000),
    };
    const largeAiData = {
      paragraph: largeParagraph,
      question: largeQuestion,
      options: largeOptions,
      topic: 'large',
      correctAnswer: 'A',
      allExplanations: { A: 'A', B: 'B', C: 'C', D: 'D' },
      relevantText: 'T',
    };
    vi.mocked(aiGenerator.generateAndValidateExercise).mockResolvedValue(largeAiData);
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: largeAiData,
    });
    vi.mocked(exerciseCache.saveExerciseToCache).mockReturnValue(999);
    const result = await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    expect(result.quizData.paragraph.length).toBe(10000);
    expect(result.quizData.question.length).toBe(5000);
    expect(result.quizData.options.A.length).toBe(1000);
    expect(result.quizId).toBe(999);
  });

  test('should always return all option letters', async () => {
    const aiData = {
      paragraph: 'P',
      question: 'Q',
      options: { A: 'A', B: 'B', C: 'C', D: 'D' },
      topic: 't',
      correctAnswer: 'A',
      allExplanations: { A: 'A', B: 'B', C: 'C', D: 'D' },
      relevantText: 'T',
    };
    vi.mocked(aiGenerator.generateAndValidateExercise).mockResolvedValue(aiData);
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({ success: true, data: aiData });
    vi.mocked(exerciseCache.saveExerciseToCache).mockReturnValue(1001);
    const result = await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    expect(Object.keys(result.quizData.options)).toEqual(['A', 'B', 'C', 'D']);
  });

  test('should handle malformed session object', async () => {
    vi.mocked(getServerSession).mockResolvedValue({} as any);
    vi.mocked(authUtils.getDbUserIdFromSession).mockReturnValue(null);
    const aiData = {
      paragraph: 'P',
      question: 'Q',
      options: { A: 'A', B: 'B', C: 'C', D: 'D' },
      topic: 't',
      correctAnswer: 'A',
      allExplanations: { A: 'A', B: 'B', C: 'C', D: 'D' },
      relevantText: 'T',
    };
    vi.mocked(aiGenerator.generateAndValidateExercise).mockResolvedValue(aiData);
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({ success: true, data: aiData });
    vi.mocked(exerciseCache.saveExerciseToCache).mockReturnValue(1002);
    const result = await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    expect(result.quizId).toBe(1002);
  });

  test('should separate cache for different users', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: 'a@b.com' },
      expires: '1',
    } as any);
    vi.mocked(authUtils.getDbUserIdFromSession).mockReturnValue(1);
    vi.mocked(exerciseCache.saveExerciseToCache).mockReturnValue(2001);
    const aiData = {
      paragraph: 'P',
      question: 'Q',
      options: { A: 'A', B: 'B', C: 'C', D: 'D' },
      topic: 't',
      correctAnswer: 'A',
      allExplanations: { A: 'A', B: 'B', C: 'C', D: 'D' },
      relevantText: 'T',
    };
    vi.mocked(aiGenerator.generateAndValidateExercise).mockResolvedValue(aiData);
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({ success: true, data: aiData });
    await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    vi.mocked(authUtils.getDbUserIdFromSession).mockReturnValue(2);
    vi.mocked(exerciseCache.saveExerciseToCache).mockReturnValue(2002);
    await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    expect(exerciseCache.saveExerciseToCache).toHaveBeenCalledWith(
      'en',
      'es',
      'B1',
      expect.any(String),
      1
    );
    expect(exerciseCache.saveExerciseToCache).toHaveBeenCalledWith(
      'en',
      'es',
      'B1',
      expect.any(String),
      2
    );
  });
});
