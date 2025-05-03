import { describe, test, expect, vi, beforeEach } from 'vitest';
import { generateExerciseResponse, type ExerciseRequestParams } from './exercise';
import { AIResponseProcessingError } from '@/lib/ai/exercise-generator';
// import type { QuizRow } from '@/lib/exercise-cache'; // Removed unused import
import type { Session } from 'next-auth';

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

  const mockValidAiResponseContent = JSON.stringify({
    paragraph: 'Mock paragraph',
    question: 'Mock question?',
    options: { A: 'Opt A', B: 'Opt B', C: 'Opt C', D: 'Opt D' },
    correctAnswer: 'A',
    allExplanations: { A: 'Expl A', B: 'Expl B', C: 'Expl C', D: 'Expl D' },
    relevantText: 'Mock relevant text',
    topic: 'Mock Topic',
  });

  const expectedFullAiDataObject = JSON.parse(mockValidAiResponseContent);

  const expectedPartialQuizData = {
    paragraph: 'Mock paragraph',
    question: 'Mock question?',
    options: { A: 'Opt A', B: 'Opt B', C: 'Opt C', D: 'Opt D' },
    topic: 'Mock Topic',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(countCachedExercises).mockReturnValue(0);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(saveExerciseToCache).mockReturnValue(123);
    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(getDbUserIdFromSession).mockReturnValue(null);
    vi.mocked(generateAndValidateExercise).mockResolvedValue(expectedFullAiDataObject);
  });

  test('should return generated exercise when allowed and cache is low', async () => {
    const result = await generateExerciseResponse(defaultParams);

    expect(checkRateLimit).toHaveBeenCalledWith('127.0.0.1');
    expect(countCachedExercises).toHaveBeenCalledWith(
      defaultParams.passageLanguage,
      defaultParams.questionLanguage,
      defaultParams.cefrLevel
    );
    expect(generateAndValidateExercise).toHaveBeenCalledWith({
      topic: 'mock topic',
      passageLanguage: defaultParams.passageLanguage,
      questionLanguage: defaultParams.questionLanguage,
      passageLangName: expect.any(String),
      questionLangName: expect.any(String),
      level: defaultParams.cefrLevel,
      grammarGuidance: expect.any(String),
      vocabularyGuidance: expect.any(String),
    });
    expect(saveExerciseToCache).toHaveBeenCalledTimes(1);
    const saveCallArgs = vi.mocked(saveExerciseToCache).mock.calls[0];
    expect(saveCallArgs[0]).toBe(defaultParams.passageLanguage);
    expect(saveCallArgs[1]).toBe(defaultParams.questionLanguage);
    expect(saveCallArgs[2]).toBe(defaultParams.cefrLevel);
    expect(saveCallArgs[3]).toBe(JSON.stringify(expectedFullAiDataObject));
    expect(saveCallArgs[4]).toBe(null);
    expect(result).toEqual({
      quizData: expectedPartialQuizData,
      quizId: 123,
      cached: false,
    });
    expect(getDbUserIdFromSession).toHaveBeenCalledWith(null);
  });

  test('should look up user ID if session exists', async () => {
    const mockSession: Session = {
      user: { id: 'github-123', provider: 'github', name: 'Test User', email: 'test@example.com' },
      expires: 'never',
    };
    const dbUserId = 456;
    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    vi.mocked(getDbUserIdFromSession).mockReturnValue(dbUserId);

    await generateExerciseResponse(defaultParams);

    expect(getDbUserIdFromSession).toHaveBeenCalledWith(mockSession);
    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(saveExerciseToCache).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      JSON.stringify(expectedFullAiDataObject),
      dbUserId
    );
  });

  test('should return cached exercise when rate limit exceeded', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(false);
    const cachedQuizId = 999;
    const mockValidatedCacheResult = {
      quizData: expectedPartialQuizData,
      quizId: cachedQuizId,
    };
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(mockValidatedCacheResult);

    const result = await generateExerciseResponse(defaultParams);

    expect(checkRateLimit).toHaveBeenCalled();
    expect(generateAndValidateExercise).not.toHaveBeenCalled();
    expect(saveExerciseToCache).not.toHaveBeenCalled();
    expect(getDbUserIdFromSession).toHaveBeenCalledWith(null);
    expect(getValidatedExerciseFromCache).toHaveBeenCalledWith(
      defaultParams.passageLanguage,
      defaultParams.questionLanguage,
      defaultParams.cefrLevel,
      null
    );
    expect(result).toEqual({
      ...mockValidatedCacheResult,
      cached: true,
    });
  });

  test('should return cached exercise when cache count is high', async () => {
    vi.mocked(countCachedExercises).mockReturnValue(100);
    const cachedQuizId = 888;
    const mockValidatedCacheResult = {
      quizData: expectedPartialQuizData,
      quizId: cachedQuizId,
    };
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(mockValidatedCacheResult);

    const result = await generateExerciseResponse(defaultParams);

    expect(checkRateLimit).toHaveBeenCalled();
    expect(countCachedExercises).toHaveBeenCalled();
    expect(generateAndValidateExercise).not.toHaveBeenCalled();
    expect(saveExerciseToCache).not.toHaveBeenCalled();
    expect(getDbUserIdFromSession).toHaveBeenCalledWith(null);
    expect(getValidatedExerciseFromCache).toHaveBeenCalledWith(
      defaultParams.passageLanguage,
      defaultParams.questionLanguage,
      defaultParams.cefrLevel,
      null
    );
    expect(result).toEqual({
      ...mockValidatedCacheResult,
      cached: true,
    });
  });

  test('should return error if generation fails (AI call error)', async () => {
    const aiError = new Error('AI Failed');
    vi.mocked(generateAndValidateExercise).mockRejectedValue(aiError);

    const result = await generateExerciseResponse(defaultParams);

    expect(result).toEqual({
      error: 'An unexpected error occurred during exercise generation: AI Failed',
      quizData: { paragraph: '', question: '', options: { A: '', B: '', C: '', D: '' } },
      quizId: -1,
      cached: false,
    });
    expect(saveExerciseToCache).not.toHaveBeenCalled();
  });

  test('should return error if generation fails (JSON parsing)', async () => {
    const parseError = new AIResponseProcessingError(
      'Failed to parse AI JSON response. Error: Some parse error'
    );
    vi.mocked(generateAndValidateExercise).mockRejectedValue(parseError);

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toMatch(/Failed to parse AI JSON response/);
    expect(result.quizId).toBe(-1);
    expect(result.cached).toBe(false);
    expect(saveExerciseToCache).not.toHaveBeenCalled();
  });

  test('should return error if generation fails (Zod validation)', async () => {
    const validationError = new AIResponseProcessingError(
      'AI response failed validation. Errors: Some validation error'
    );
    vi.mocked(generateAndValidateExercise).mockRejectedValue(validationError);

    const result = await generateExerciseResponse(defaultParams);

    expect(result.error).toMatch(/AI response failed validation/);
    expect(result.quizId).toBe(-1);
    expect(result.cached).toBe(false);
    expect(saveExerciseToCache).not.toHaveBeenCalled();
  });

  test('should return specific error if AI response processing fails', async () => {
    const processingError = new AIResponseProcessingError('Specific processing issue');
    vi.mocked(generateAndValidateExercise).mockRejectedValue(processingError);

    const result = await generateExerciseResponse(defaultParams);

    expect(result).toEqual({
      error: 'Specific processing issue',
      quizData: { paragraph: '', question: '', options: { A: '', B: '', C: '', D: '' } },
      quizId: -1,
      cached: false,
    });
  });

  test('should return error if cache save fails', async () => {
    vi.mocked(saveExerciseToCache).mockReturnValue(undefined);

    const result = await generateExerciseResponse(defaultParams);

    expect(generateAndValidateExercise).toHaveBeenCalled();
    expect(saveExerciseToCache).toHaveBeenCalled();
    expect(result).toEqual({
      quizData: expectedPartialQuizData,
      quizId: -1,
      error: 'Failed to save exercise to cache.',
      cached: false,
    });
  });

  test('should return error if cache fetch succeeds but data is invalid', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(false);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);

    const result = await generateExerciseResponse(defaultParams);

    expect(getValidatedExerciseFromCache).toHaveBeenCalled();
    expect(result.error).toBe('Could not retrieve or generate a question.');
    expect(result.quizId).toBe(-1);
  });

  test('should return final error if rate limited and cache miss', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(false);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);

    const result = await generateExerciseResponse(defaultParams);

    expect(getValidatedExerciseFromCache).toHaveBeenCalled();
    expect(result.error).toBe('Could not retrieve or generate a question.');
    expect(result.quizId).toBe(-1);
  });

  test('should return validation error for invalid CEFR level', async () => {
    const paramsWithInvalidLevel = { ...defaultParams, cefrLevel: 'Z9' };
    const result = await generateExerciseResponse(paramsWithInvalidLevel);

    expect(result).toEqual({
      quizData: { paragraph: '', question: '', options: { A: '', B: '', C: '', D: '' } },
      quizId: -1,
      error: 'Invalid CEFR level: Z9',
    });
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  test('should use session.user.dbId for cache lookup if available', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(false);
    const mockSessionWithDbId: Session = {
      user: { id: 'prov-456', provider: 'google', dbId: 789 },
      expires: 'never',
    };
    vi.mocked(getServerSession).mockResolvedValue(mockSessionWithDbId);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);

    await generateExerciseResponse(defaultParams);

    expect(getDbUserIdFromSession).not.toHaveBeenCalled();
    expect(getValidatedExerciseFromCache).toHaveBeenCalledWith(
      defaultParams.passageLanguage,
      defaultParams.questionLanguage,
      defaultParams.cefrLevel,
      789
    );
  });

  test('should call user lookup for cache if session has no dbId', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(false);
    const mockSessionWithoutDbId: Session = {
      user: { id: 'prov-456', provider: 'google' },
      expires: 'never',
    };
    const lookedUpUserId = 999;
    vi.mocked(getServerSession).mockResolvedValue(mockSessionWithoutDbId);
    vi.mocked(getValidatedExerciseFromCache).mockReturnValue(undefined);
    vi.mocked(getDbUserIdFromSession).mockReturnValue(lookedUpUserId);

    await generateExerciseResponse(defaultParams);

    expect(getDbUserIdFromSession).toHaveBeenCalledWith(mockSessionWithoutDbId);
    expect(getValidatedExerciseFromCache).toHaveBeenCalledWith(
      defaultParams.passageLanguage,
      defaultParams.questionLanguage,
      defaultParams.cefrLevel,
      lookedUpUserId
    );
  });
});
