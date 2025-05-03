import { describe, test, expect, vi } from 'vitest';
import { generateExerciseResponse } from './exercise';
import { type ExerciseRequestParams, ExerciseContentSchema } from '@/lib/domain/schemas';
import { AIResponseProcessingError } from '@/lib/ai/exercise-generator';
// import type { QuizRow } from '@/lib/exercise-cache'; // Removed unused import
import type { Session } from 'next-auth';
import type { GenerateExerciseResult } from '@/lib/domain/schemas'; // Import the type
// Directly import the schema to spy on it
// import { ValidatedAiDataSchema } from '@/lib/domain/schemas';
// Re-add zod import
import { z } from 'zod';
// Remove unused imports
// import { z } from 'zod';
// import { ValidatedAiDataSchema as RealValidatedAiDataSchema } from '@/lib/domain/schemas';
import { LanguageSchema as RealLanguageSchema } from '@/lib/domain/language'; // Keep this import for reference if needed, but don't use in mock

// --- Mocks ---
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

vi.mock('@/config/language-guidance', () => ({
  getGrammarGuidance: vi.fn(() => 'mock grammar guidance'),
  getVocabularyGuidance: vi.fn(() => 'mock vocabulary guidance'),
  CEFRLevel: {} as any,
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

vi.mock('@/lib/domain/language', () => ({
  LANGUAGES: { en: 'English', es: 'Spanish' }, // Mock only needed languages
  // LanguageSchema: RealLanguageSchema, // REMOVED - Avoid using real implementation in mock factory
  // Provide a minimal stand-in if absolutely necessary, otherwise let the original be used by dependent modules
  LanguageSchema: {
    // Minimal mock if needed, e.g., for basic type checks, but might be better to omit
    // parse: vi.fn((x) => x), // Example: pass-through parse
    // _def: {}, // Example placeholder
    // options: ['en', 'es'] // Example placeholder
  }, // Let's try omitting it first, hoping the original is resolved by dependent modules
}));

vi.mock('@/lib/domain/language-guidance', () => ({
  getGrammarGuidance: vi.fn().mockReturnValue('mock grammar guidance'),
  getVocabularyGuidance: vi.fn().mockReturnValue('mock vocabulary guidance'),
}));

// --- Test Suite ---
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

  // This represents the data *returned by the AI* and validated against ValidatedAiDataSchema
  const mockValidatedAiData = {
    paragraph: 'Mock paragraph',
    question: 'Mock question?',
    options: { A: 'Opt A', B: 'Opt B', C: 'Opt C', D: 'Opt D' },
    topic: 'mock topic', // Use the topic returned by the mock getRandomTopicForLevel
    correctAnswer: 'A',
    allExplanations: { A: 'Expl A', B: 'Expl B', C: 'Expl C', D: 'Expl D' },
    relevantText: 'Mock relevant text',
  };

  // This represents the data structure *before* Zod validation in the action
  // It might include extra fields from the AI that are dropped by ValidatedAiDataSchema
  const mockRawAiResponse = {
    ...mockValidatedAiData,
    correctAnswer: 'A',
    allExplanations: { A: 'Expl A', B: 'Expl B', C: 'Expl C', D: 'Expl D' },
    relevantText: 'Mock relevant text',
    // Topic casing might differ here depending on mock setup vs. processing
    // Let's assume the raw AI response might have different casing for the test
    topic: 'Mock Topic Raw',
  };

  // This represents the default empty data sent on errors
  const defaultEmptyQuizData = {
    paragraph: '',
    question: '',
    options: { A: '', B: '', C: '', D: '' },
    language: null,
    topic: null,
  };

  // Use beforeEach to set up default spy behavior
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(saveExerciseToCache).mockReturnValue(123);
    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(getDbUserIdFromSession).mockReturnValue(null);
    vi.mocked(generateAndValidateExercise).mockResolvedValue(mockRawAiResponse);

    // Spy on the imported schema's safeParse method
    // Default to success, returning the validated data shape
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: mockValidatedAiData,
    });
  });

  // Test the successful path first
  test('should return generated exercise when allowed and cache is low', async () => {
    // beforeEach sets up mocks, no need to repeat here unless overriding

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBeNull();
    expect(result.quizId).toBe(123);
    expect(result.cached).toBe(false);
    expect(result.quizData).toEqual({
      paragraph: 'Mock paragraph',
      question: 'Mock question?',
      options: { A: 'Opt A', B: 'Opt B', C: 'Opt C', D: 'Opt D' },
      topic: 'mock topic', // Expect the mock topic
      language: 'en',
    });

    expect(checkRateLimit).toHaveBeenCalled();
    expect(countCachedExercises).toHaveBeenCalledWith(
      defaultParams.passageLanguage,
      defaultParams.questionLanguage,
      defaultParams.cefrLevel
    );
    expect(getValidatedExerciseFromCache).not.toHaveBeenCalled(); // Cache count was low
    expect(generateAndValidateExercise).toHaveBeenCalledTimes(1);
    expect(generateAndValidateExercise).toHaveBeenCalledWith({
      topic: 'mock topic', // Expect the mock topic from getRandomTopicForLevel
      passageLanguage: 'en',
      questionLanguage: 'es',
      passageLangName: 'English',
      questionLangName: 'Spanish',
      level: 'B1',
      grammarGuidance: 'mock grammar guidance',
      vocabularyGuidance: 'mock vocabulary guidance',
    });
    expect(saveExerciseToCache).toHaveBeenCalledTimes(1);
    const saveCallArgs = vi.mocked(saveExerciseToCache).mock.calls[0];
    expect(saveCallArgs[0]).toBe(defaultParams.passageLanguage);
    expect(saveCallArgs[1]).toBe(defaultParams.questionLanguage);
    expect(saveCallArgs[2]).toBe(defaultParams.cefrLevel);
    expect(saveCallArgs[3]).toEqual(JSON.stringify(mockValidatedAiData));
    expect(saveCallArgs[4]).toBe(null);
  });

  test('should look up user ID if session exists', async () => {
    // Override default mocks from beforeEach
    const mockSession: Session = { expires: '1', user: { email: 'test@test.com', name: 'Test' } };
    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    vi.mocked(getDbUserIdFromSession).mockReturnValue(456);
    vi.mocked(saveExerciseToCache).mockReturnValue(124); // Different ID

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
      JSON.stringify(mockValidatedAiData), // Check the stringified validated data
      456 // User ID
    );
  });

  test('should return cached exercise when rate limit exceeded', async () => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockReturnValue(false);
    // Provide a more complete mock conforming to GenerateExerciseResultSchema structure
    const cachedExerciseResult: GenerateExerciseResult = {
      quizData: {
        paragraph: 'Cached para',
        question: 'Q',
        options: { A: 'a', B: 'b', C: 'c', D: 'd' },
        topic: 't',
        language: 'en',
      },
      quizId: 777,
      error: null, // Explicitly null
      cached: true, // It's cached data
    };
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(cachedExerciseResult);

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBeNull();
    expect(result.quizId).toBe(777);
    expect(result.quizData).toEqual(cachedExerciseResult.quizData);
    expect(result.cached).toBe(true);
    expect(getValidatedExerciseFromCache).toHaveBeenCalled();
    expect(generateAndValidateExercise).not.toHaveBeenCalled();
  });

  test('should return cached exercise when cache count is high', async () => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(1000);
    // Provide a more complete mock conforming to GenerateExerciseResultSchema structure
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

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBeNull();
    expect(result.quizId).toBe(888);
    expect(result.cached).toBe(true);
    expect(countCachedExercises).toHaveBeenCalled();
    expect(getValidatedExerciseFromCache).toHaveBeenCalled();
    expect(generateAndValidateExercise).not.toHaveBeenCalled();
  });

  test('should return error if generation fails (AI call error)', async () => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(generateAndValidateExercise).mockRejectedValue(new Error('AI Failed'));

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBe('Could not retrieve or generate a question.');
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
  });

  test('should return error if generation fails (JSON parsing)', async () => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(generateAndValidateExercise).mockRejectedValue(
      new AIResponseProcessingError('Failed to parse AI JSON response. Error: Some parse error')
    );

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBe('Could not retrieve or generate a question.');
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
  });

  test('should return validation error for invalid input params', async () => {
    vi.clearAllMocks();
    const invalidParams = {
      ...defaultParams,
      passageLanguage: 'invalid-lang',
    };

    const result = await generateExerciseResponse(invalidParams as unknown);

    expect(result.error).toContain(
      'Invalid request parameters: passageLanguage: Invalid passage language'
    );
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).not.toHaveBeenCalled();
    expect(saveExerciseToCache).not.toHaveBeenCalled();
  });

  test('should return specific error if AI response processing fails', async () => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(generateAndValidateExercise).mockRejectedValue(
      new AIResponseProcessingError('Specific processing issue')
    );

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBe('Could not retrieve or generate a question.');
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
  });

  test('should return error if cache save fails', async () => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(generateAndValidateExercise).mockResolvedValue(mockRawAiResponse);
    // Mock saveExerciseToCache to throw an error
    vi.mocked(saveExerciseToCache).mockImplementation(() => {
      throw new Error('Cache save failed');
    });

    // Spy on console.error to ensure the specific failure is logged
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await generateExerciseResponse(defaultParams);

    // Action might return generic error structure even if specific log happens
    expect(result.error).toBe('Could not retrieve or generate a question.');
    expect(result.quizData).toEqual(defaultEmptyQuizData); // Should clear data on save fail
    expect(result.quizId).toBe(-1);
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(saveExerciseToCache).toHaveBeenCalled(); // It was called, but failed
    // Verify the specific error was logged internally
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[API:tryGenerate] Failed to save exercise to cache:'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore(); // Clean up spy
  });

  test('should return error if safeParse fails', async () => {
    // Mock generateAndValidateExercise to return data that would fail the *real* schema
    // Then check that the action calls our *mocked* safeParse
    const invalidAiData = { ...mockRawAiResponse, paragraph: undefined }; // Missing required field
    vi.mocked(generateAndValidateExercise).mockResolvedValue(invalidAiData as any);
    // Override the spy for this specific test to return failure
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: false,
      error: new z.ZodError([]), // Provide a basic ZodError
    });

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toBe('Could not retrieve or generate a question.');
    expect(result.quizData).toEqual(defaultEmptyQuizData);
    expect(result.quizId).toBe(-1);
    expect(ExerciseContentSchema.safeParse).toHaveBeenCalledWith(invalidAiData);
    expect(saveExerciseToCache).not.toHaveBeenCalled();
  });
});
