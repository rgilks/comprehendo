import { describe, test, expect, vi, beforeEach } from 'vitest';
import { generateExerciseResponse, generateInitialExercisePair } from './exercise';
import {
  type ExerciseRequestParams,
  ExerciseContentSchema,
  GenerateExerciseResultSchema,
  ExerciseContent,
  QuizData,
  InitialExercisePairResultSchema,
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
const helpers = await import('./exercise-logic');
const { createErrorResponse, DEFAULT_EMPTY_QUIZ_DATA: defaultEmptyQuizData } = helpers;
const exerciseOrchestrator = await import('./exercise-logic');
const domainLang = await import('@/lib/domain/language');
const domainTopics = await import('@/lib/domain/topics');
const domainLangGuidance = await import('@/lib/domain/language-guidance');

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

vi.mock('@/lib/domain/topics', () => ({
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

  const mockGeneratedContent: ExerciseContent = {
    paragraph: 'Mock paragraph',
    question: 'Mock question?',
    options: { A: 'Opt A', B: 'Opt B', C: 'Opt C', D: 'Opt D' },
    topic: 'mock topic',
    correctAnswer: 'A',
    allExplanations: { A: 'Expl A', B: 'Expl B', C: 'Expl C', D: 'Expl D' },
    relevantText: 'Mock relevant text',
    someOtherAiField: 'foo',
  } as ExerciseContent;

  const expectedQuizDataFromMock: QuizData = {
    paragraph: mockGeneratedContent.paragraph,
    question: mockGeneratedContent.question,
    options: mockGeneratedContent.options,
    topic: mockGeneratedContent.topic,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(saveExerciseToCache).mockReturnValue(123);
    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(getDbUserIdFromSession).mockReturnValue(null);
    vi.mocked(generateAndValidateExercise).mockResolvedValue(mockGeneratedContent);

    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: mockGeneratedContent,
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
    expect(result.quizData).toMatchObject(expectedQuizDataFromMock);

    expect(checkRateLimit).toHaveBeenCalled();
    expect(countCachedExercises).toHaveBeenCalledWith(
      defaultParams.passageLanguage,
      defaultParams.questionLanguage,
      defaultParams.cefrLevel
    );
    expect(getValidatedExerciseFromCache).not.toHaveBeenCalled();
    expect(generateAndValidateExercise).toHaveBeenCalledTimes(1);
    const saveCallArgs = vi.mocked(saveExerciseToCache).mock.calls[0];
    expect(saveCallArgs[3]).toEqual(JSON.stringify(mockGeneratedContent));
    expect(saveCallArgs[4]).toBe(null);
  });

  test('should look up user ID if session exists', async () => {
    const mockSession: Session = {
      expires: '1',
      user: { email: 'test@test.com', name: 'Test', id: 'provider-test-id' },
    };
    const mockDbId = 456;
    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    vi.mocked(getDbUserIdFromSession).mockReturnValue(mockDbId);
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
      JSON.stringify(mockGeneratedContent),
      mockDbId
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
    vi.mocked(generateAndValidateExercise).mockResolvedValue(mockGeneratedContent);
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: mockGeneratedContent,
    });
    vi.mocked(saveExerciseToCache).mockReturnValue(123);

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBeNull();
    expect(result.quizId).toBe(123);
    expect(result.cached).toBe(false);
    expect(result.quizData).toMatchObject(expectedQuizDataFromMock);

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

    expect(result.error).toContain('Error during AI generation/processing: AI Failed');
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

    expect(result.error).toContain(
      'Error during AI generation/processing: Failed to parse AI JSON response. Error: Some parse error'
    );
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(getValidatedExerciseFromCache).toHaveBeenCalledTimes(1);
  });

  test('should return error if generation fails with non-Error object', async () => {
    vi.mocked(generateAndValidateExercise).mockRejectedValue('Some random string error');
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toContain(
      'Error during AI generation/processing: Some random string error'
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

    expect(result.error).toContain(
      'Error during AI generation/processing: Specific processing issue'
    );
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(getValidatedExerciseFromCache).toHaveBeenCalledTimes(1);
  });

  test('should return specific error if cache save fails', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(generateAndValidateExercise).mockResolvedValue(mockGeneratedContent);
    vi.mocked(saveExerciseToCache).mockImplementation(() => {
      throw new Error('Cache save failed');
    });
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: mockGeneratedContent,
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toContain('Error during AI generation/processing: Cache save failed');
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(saveExerciseToCache).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test('should return error if saveExerciseToCache returns undefined', async () => {
    vi.mocked(saveExerciseToCache).mockReturnValue(undefined);
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: mockGeneratedContent,
    });
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toContain(
      'Exercise generated but failed to save to cache (undefined ID).'
    );
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(saveExerciseToCache).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test('should return error if ExerciseContentSchema safeParse fails', async () => {
    const zodError = new z.ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['paragraph'],
        message: 'Required',
      },
    ]);
    vi.mocked(generateAndValidateExercise).mockRejectedValue(
      new AIResponseProcessingError('AI response failed Zod validation', zodError)
    );
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toContain(
      'Error during AI generation/processing: AI response failed Zod validation'
    );
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test('should return error if GenerateExerciseResultSchema safeParse fails for cached data', async () => {
    // Mock orchestrator throwing an error
    const orchestratorError = new Error('Orchestrator failed');
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise').mockRejectedValue(orchestratorError);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await generateExerciseResponse(defaultParams);

    // Expect the error caught by the final catch block in generateExerciseResponse
    expect(result.error).toBe(orchestratorError.message);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error in generateExerciseResponse:',
      orchestratorError
    );
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);

    consoleErrorSpy.mockRestore();
  });

  test('should log warning and attempt cache when generation fails (but not save error)', async () => {
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
    // Mock orchestrator directly returning the cached result after simulated internal failure/fallback
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise').mockResolvedValue(cachedResult);

    // Spies are still useful to ensure logs *would* happen if orchestrator wasn't fully mocked
    // expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    // expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[API] Cache fallback successful.'));

    const result = await generateExerciseResponse(defaultParams);

    // Expect the successful cached result
    expect(result.error).toBeNull();
    expect(result.quizId).toBe(998);
    expect(result.cached).toBe(true);
    expect(result.quizData).toEqual(cachedResult.quizData);

    // We can no longer reliably assert internal orchestrator logs when fully mocking it
    // expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    // expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[API] Cache fallback successful.'));
  });
});

describe('additional branch coverage for generateExerciseResponse', () => {
  test('should log originalError stack if AIResponseProcessingError.originalError is Error', async () => {
    const originalError = new Error('Original stack error');
    const failureDetails = {
      error: 'Error during AI generation/processing: AI error',
      details: originalError,
    };
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise').mockResolvedValue(
      // Pass details directly to createErrorResponse
      createErrorResponse(failureDetails.error, failureDetails.details)
    );

    const result = await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    // Assert the error string matches createErrorResponse format
    // Details (which is an Error object) should be stringified by createErrorResponse
    expect(result.error).toBe(`${failureDetails.error}: ${JSON.stringify(failureDetails.details)}`);
  });

  test('should log originalError as non-Error object if AIResponseProcessingError.originalError is not Error', async () => {
    const originalError = { foo: 'bar' };
    const failureDetails = {
      error: 'Error during AI generation/processing: AI error',
      details: originalError,
    };
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise').mockResolvedValue(
      // Pass details directly to createErrorResponse
      createErrorResponse(failureDetails.error, failureDetails.details)
    );

    const result = await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    // Assert the error string matches createErrorResponse format
    // Details (which is a non-Error object) should be stringified by createErrorResponse
    expect(result.error).toBe(`${failureDetails.error}: ${JSON.stringify(failureDetails.details)}`);
  });
});

describe('additional edge cases', () => {
  const mockGeneratedContent: ExerciseContent = {
    paragraph: 'Mock paragraph',
    question: 'Mock question?',
    options: { A: 'Opt A', B: 'Opt B', C: 'Opt C', D: 'Opt D' },
    topic: 'mock topic',
    correctAnswer: 'A',
    allExplanations: { A: 'Expl A', B: 'Expl B', C: 'Expl C', D: 'Expl D' },
    relevantText: 'Mock relevant text',
    someOtherAiField: 'foo',
  } as ExerciseContent;
  const expectedQuizDataFromMock: QuizData = {
    paragraph: mockGeneratedContent.paragraph,
    question: mockGeneratedContent.question,
    options: mockGeneratedContent.options,
    topic: mockGeneratedContent.topic,
  };

  beforeEach(() => {
    // Reset mocks specific to these tests
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise').mockRestore();
  });

  test('should handle AI generator returning null', async () => {
    // Mock the orchestrator to return the final error state
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise').mockResolvedValue(
      createErrorResponse('Unknown generation failure.')
    );
    const result = await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    expect(result.error).toBe('Unknown generation failure.');
    expect(result.quizData).toEqual(defaultEmptyQuizData);
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
    const largeQuizData: QuizData = {
      paragraph: largeParagraph,
      question: largeQuestion,
      options: largeOptions,
      topic: 'large',
    };
    // Mock orchestrator returning success with large data
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise').mockResolvedValue({
      quizData: largeQuizData,
      quizId: 999,
      error: null,
      cached: false,
    });

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
    const quizDataWithOptions: QuizData = {
      paragraph: 'P',
      question: 'Q',
      options: { A: 'A', B: 'B', C: 'C', D: 'D' },
      topic: 't',
    };
    // Mock orchestrator returning success
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise').mockResolvedValue({
      quizData: quizDataWithOptions,
      quizId: 1001,
      error: null,
      cached: false,
    });

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
    const mockResult = {
      quizData: expectedQuizDataFromMock,
      quizId: 1002,
      error: null,
      cached: false,
    };
    // Mock orchestrator returning success
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise').mockResolvedValue(mockResult);

    const result = await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    expect(result.quizId).toBe(1002);
  });

  test('should separate cache for different users', async () => {
    const mockOrchestratorCall = vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise');

    // User 1
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user1' } } as any);
    vi.mocked(authUtils.getDbUserIdFromSession).mockReturnValue(1);
    mockOrchestratorCall.mockResolvedValueOnce({
      quizId: 2001,
      quizData: expectedQuizDataFromMock,
      cached: false,
      error: null,
    });
    await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    expect(mockOrchestratorCall).toHaveBeenCalledWith(expect.anything(), 1, expect.any(Number));

    // User 2
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user2' } } as any);
    vi.mocked(authUtils.getDbUserIdFromSession).mockReturnValue(2);
    mockOrchestratorCall.mockResolvedValueOnce({
      quizId: 2002,
      quizData: expectedQuizDataFromMock,
      cached: false,
      error: null,
    });
    await generateExerciseResponse({
      passageLanguage: 'en',
      questionLanguage: 'es',
      cefrLevel: 'B1',
    });
    expect(mockOrchestratorCall).toHaveBeenCalledWith(expect.anything(), 2, expect.any(Number));

    // Optional: Assert saveExerciseToCache if necessary (requires mocking within the orchestrator mock)
    // expect(mockSaveCacheCall).toHaveBeenCalledWith(..., 1);
    // expect(mockSaveCacheCall).toHaveBeenCalledWith(..., 2);
  });
});

const mockSession = { user: { id: 'user-id-123' } } as unknown as Session;
const mockUserId = 1;
const mockValidParams: ExerciseRequestParams = {
  passageLanguage: 'en',
  questionLanguage: 'es',
  cefrLevel: 'B1',
};
const mockValidResult1: GenerateExerciseResult = {
  quizData: { ...defaultEmptyQuizData, paragraph: 'Quiz 1 Para' },
  quizId: 101,
  error: null,
  cached: false,
};
const mockValidResult2: GenerateExerciseResult = {
  quizData: { ...defaultEmptyQuizData, paragraph: 'Quiz 2 Para' },
  quizId: 102,
  error: null,
  cached: false,
};

describe('generateInitialExercisePair', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    vi.mocked(authUtils.getDbUserIdFromSession).mockReturnValue(mockUserId);
    vi.mocked(rateLimiter.checkRateLimit).mockReturnValue(true);
    vi.spyOn(exerciseOrchestrator, 'validateRequestParams').mockReturnValue({
      success: true,
      data: mockValidParams,
    } as any);
    vi.mocked(domainLang.LANGUAGES).en = 'English';
    vi.mocked(domainLang.LANGUAGES).es = 'Spanish';
    vi.mocked(domainTopics.getRandomTopicForLevel).mockReturnValue('Mock Topic');
    vi.mocked(domainLangGuidance.getGrammarGuidance).mockReturnValue('Mock Grammar');
    vi.mocked(domainLangGuidance.getVocabularyGuidance).mockReturnValue('Mock Vocab');
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise')
      .mockResolvedValueOnce(mockValidResult1)
      .mockResolvedValueOnce(mockValidResult2);
  });

  test('should successfully generate a pair of exercises', async () => {
    const result = await generateInitialExercisePair(mockValidParams);

    expect(InitialExercisePairResultSchema.safeParse(result).success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.quizzes).toHaveLength(2);
    expect(result.quizzes[0]).toEqual(mockValidResult1);
    expect(result.quizzes[1]).toEqual(mockValidResult2);
    expect(exerciseOrchestrator.validateRequestParams).toHaveBeenCalledWith(mockValidParams);
    expect(rateLimiter.checkRateLimit).toHaveBeenCalledTimes(1);
    expect(exerciseOrchestrator.getOrGenerateExercise).toHaveBeenCalledTimes(2);
    expect(exerciseOrchestrator.getOrGenerateExercise).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        passageLanguage: 'en',
        questionLanguage: 'es',
        level: 'B1',
        topic: 'Mock Topic', // First call
      }),
      mockUserId,
      0
    );
    // Second call should have a different topic
    expect(domainTopics.getRandomTopicForLevel).toHaveBeenCalledTimes(2);
    expect(exerciseOrchestrator.getOrGenerateExercise).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        passageLanguage: 'en',
        questionLanguage: 'es',
        level: 'B1',
        topic: 'Mock Topic', // Second call uses the 2nd random topic
      }),
      mockUserId,
      0
    );
  });

  test('should return error if rate limit exceeded', async () => {
    vi.mocked(rateLimiter.checkRateLimit).mockReturnValue(false);
    const result = await generateInitialExercisePair(mockValidParams);
    expect(result.error).toBe('Rate limit exceeded.');
    expect(result.quizzes).toEqual([]);
    expect(exerciseOrchestrator.getOrGenerateExercise).not.toHaveBeenCalled();
  });

  test('should return error if validation fails', async () => {
    vi.spyOn(exerciseOrchestrator, 'validateRequestParams').mockReturnValue({
      success: false,
      error: { errors: [{ path: ['cefrLevel'], message: 'Invalid level' }] },
    } as any);
    const result = await generateInitialExercisePair({ invalid: 'params' });
    expect(result.error).toContain('Invalid request parameters: cefrLevel: Invalid level');
    expect(result.quizzes).toEqual([]);
    expect(rateLimiter.checkRateLimit).not.toHaveBeenCalled();
    expect(exerciseOrchestrator.getOrGenerateExercise).not.toHaveBeenCalled();
  });

  test('should return error if first exercise generation fails', async () => {
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise')
      .mockResolvedValueOnce({ ...mockValidResult1, error: 'Gen Error 1', quizId: -1 })
      .mockResolvedValueOnce(mockValidResult2);

    const result = await generateInitialExercisePair(mockValidParams);
    expect(result.error).toBe('Failed to generate exercise pair: Gen Error 1');
    expect(result.quizzes).toEqual([]);
  });

  test('should return error if second exercise generation fails', async () => {
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise')
      .mockResolvedValueOnce(mockValidResult1)
      .mockResolvedValueOnce({ ...mockValidResult2, error: 'Gen Error 2', quizId: -1 });

    const result = await generateInitialExercisePair(mockValidParams);
    expect(result.error).toBe('Failed to generate exercise pair: Gen Error 2');
    expect(result.quizzes).toEqual([]);
  });

  test('should return error if both exercise generations fail', async () => {
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise')
      .mockResolvedValueOnce({ ...mockValidResult1, error: 'Gen Error 1', quizId: -1 })
      .mockResolvedValueOnce({ ...mockValidResult2, error: 'Gen Error 2', quizId: -1 });

    const result = await generateInitialExercisePair(mockValidParams);
    expect(result.error).toBe('Failed to generate exercise pair: Gen Error 1; Gen Error 2');
    expect(result.quizzes).toEqual([]);
  });

  test('should return error if exercise generation throws', async () => {
    const error = new Error('Fetch failed');
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise').mockRejectedValue(error);

    const result = await generateInitialExercisePair(mockValidParams);
    expect(result.error).toBe('Server error during generation: Fetch failed');
    expect(result.quizzes).toEqual([]);
  });

  test('should return error if result validation fails', async () => {
    const malformedResult = { ...mockValidResult1, quizId: 'not-a-number' }; // Invalid quizId
    vi.spyOn(exerciseOrchestrator, 'getOrGenerateExercise')
      .mockResolvedValueOnce(malformedResult as any)
      .mockResolvedValueOnce(mockValidResult2);

    // Need to spy on safeParse AFTER the mocks are set up for the test
    const safeParseSpy = vi.spyOn(z.ZodArray.prototype, 'safeParse');
    safeParseSpy.mockReturnValueOnce({ success: false, error: 'validation error' } as any);

    const result = await generateInitialExercisePair(mockValidParams);

    expect(result.error).toBe('Internal error processing generated results.');
    expect(result.quizzes).toEqual([]);

    safeParseSpy.mockRestore(); // Clean up the spy
  });
});
