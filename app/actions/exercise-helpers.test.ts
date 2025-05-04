import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tryGenerateAndCacheExercise, tryGetCachedExercise } from './exercise-helpers';
import {
  ExerciseContentSchema,
  GenerateExerciseResultSchema,
  type ExerciseRequestParams,
  type GenerateExerciseResult,
  type PartialQuizData,
} from '@/lib/domain/schemas';
import { ZodError } from 'zod';

const mockParams: ExerciseRequestParams = {
  passageLanguage: 'en',
  questionLanguage: 'es',
  cefrLevel: 'B1',
};
const mockUserId = 42;
const mockQuizData: PartialQuizData = {
  paragraph: 'p',
  question: 'q',
  options: { A: 'a', B: 'b', C: 'c', D: 'd' },
  topic: 't',
  language: 'en',
};
const mockValidatedContent = {
  ...mockQuizData,
  correctAnswer: 'A',
  allExplanations: { A: 'A', B: 'B', C: 'C', D: 'D' },
  relevantText: 'T',
};

vi.mock('@/lib/domain/language', () => ({ LANGUAGES: { en: 'English', es: 'Spanish' } }));
vi.mock('@/lib/domain/language-guidance', () => ({
  getGrammarGuidance: vi.fn(() => 'grammar'),
  getVocabularyGuidance: vi.fn(() => 'vocab'),
}));
vi.mock('@/config/topics', () => ({ getRandomTopicForLevel: vi.fn(() => 'topic') }));
vi.mock('@/lib/exercise-cache', () => ({
  saveExerciseToCache: vi.fn(() => 123),
  getValidatedExerciseFromCache: vi.fn(() => undefined),
}));
vi.mock('@/lib/ai/exercise-generator', () => ({
  generateAndValidateExercise: vi.fn(() => mockValidatedContent),
  AIResponseProcessingError: class extends Error {
    originalError: unknown;
    constructor(msg: string, orig: unknown) {
      super(msg);
      this.originalError = orig;
    }
  },
}));
vi.mock('@/lib/utils/exercise-response', () => ({
  createErrorResponse: vi.fn((msg: string) => ({
    quizData: {
      paragraph: '',
      question: '',
      options: { A: '', B: '', C: '', D: '' },
      topic: null,
      language: null,
    },
    quizId: -1,
    error: msg,
    cached: false,
  })),
}));

describe('tryGenerateAndCacheExercise', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns valid result on success', async () => {
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: { ...mockValidatedContent },
    });
    const result = await tryGenerateAndCacheExercise(mockParams, mockUserId);
    expect(result.quizId).toBe(123);
    expect(result.error).toBeNull();
    expect(result.quizData.paragraph).toBe('p');
  });

  it('returns error if AI returns null', async () => {
    const { generateAndValidateExercise } = await import('@/lib/ai/exercise-generator');
    vi.mocked(generateAndValidateExercise).mockResolvedValueOnce(null);
    const result = await tryGenerateAndCacheExercise(mockParams, mockUserId);
    expect(result.error).toBe('Failed to validate AI response structure.');
    expect(result.quizId).toBe(-1);
  });

  it('returns error if schema validation fails', async () => {
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: false,
      error: new ZodError([]),
    });
    const result = await tryGenerateAndCacheExercise(mockParams, mockUserId);
    expect(result.error).toBe('Failed to validate AI response structure.');
  });

  it('returns error if saveExerciseToCache throws', async () => {
    const { saveExerciseToCache } = await import('@/lib/exercise-cache');
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: { ...mockValidatedContent },
    });
    vi.mocked(saveExerciseToCache).mockImplementationOnce(() => {
      throw new Error('fail');
    });
    const result = await tryGenerateAndCacheExercise(mockParams, mockUserId);
    expect(result.error).toBe('Failed to save generated exercise to cache.');
  });

  it('returns error if saveExerciseToCache returns undefined', async () => {
    const { saveExerciseToCache } = await import('@/lib/exercise-cache');
    vi.spyOn(ExerciseContentSchema, 'safeParse').mockReturnValue({
      success: true,
      data: { ...mockValidatedContent },
    });
    vi.mocked(saveExerciseToCache).mockReturnValueOnce(undefined);
    const result = await tryGenerateAndCacheExercise(mockParams, mockUserId);
    expect(result.error).toBe('Failed to save generated exercise to cache.');
  });

  it('handles thrown AIResponseProcessingError with Error originalError', async () => {
    const { generateAndValidateExercise, AIResponseProcessingError } = await import(
      '@/lib/ai/exercise-generator'
    );
    const orig = new Error('orig');
    const err = new AIResponseProcessingError('fail', orig);
    vi.mocked(generateAndValidateExercise).mockRejectedValueOnce(err);
    const result = await tryGenerateAndCacheExercise(mockParams, mockUserId);
    expect(result.error).toMatch(/fail/);
  });

  it('handles thrown AIResponseProcessingError with non-Error originalError', async () => {
    const { generateAndValidateExercise, AIResponseProcessingError } = await import(
      '@/lib/ai/exercise-generator'
    );
    const err = new AIResponseProcessingError('fail', { foo: 1 });
    vi.mocked(generateAndValidateExercise).mockRejectedValueOnce(err);
    const result = await tryGenerateAndCacheExercise(mockParams, mockUserId);
    expect(result.error).toMatch(/fail/);
  });

  it('handles thrown non-Error', async () => {
    const { generateAndValidateExercise } = await import('@/lib/ai/exercise-generator');
    vi.mocked(generateAndValidateExercise).mockRejectedValueOnce('fail');
    const result = await tryGenerateAndCacheExercise(mockParams, mockUserId);
    expect(result.error).toMatch(/unexpected/);
  });
});

describe('tryGetCachedExercise', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null if no cache', async () => {
    const { getValidatedExerciseFromCache } = await import('@/lib/exercise-cache');
    vi.mocked(getValidatedExerciseFromCache).mockReturnValueOnce(undefined);
    const result = await tryGetCachedExercise(mockParams, mockUserId);
    expect(result).toBeNull();
  });

  it('returns parsed result if cache is valid', async () => {
    const { getValidatedExerciseFromCache } = await import('@/lib/exercise-cache');
    const cache: Omit<GenerateExerciseResult, 'cached'> = {
      quizData: mockQuizData,
      quizId: 1,
      error: null,
    };
    vi.mocked(getValidatedExerciseFromCache).mockReturnValueOnce(cache);
    vi.spyOn(GenerateExerciseResultSchema, 'safeParse').mockReturnValueOnce({
      success: true,
      data: { ...cache, cached: true },
    });
    const result = await tryGetCachedExercise(mockParams, mockUserId);
    expect(result && result.quizId).toBe(1);
    expect(result && result.cached).toBe(true);
  });

  it('returns null and logs if cache fails schema', async () => {
    const { getValidatedExerciseFromCache } = await import('@/lib/exercise-cache');
    const cache: Omit<GenerateExerciseResult, 'cached'> = {
      quizData: mockQuizData,
      quizId: 1,
      error: null,
    };
    vi.mocked(getValidatedExerciseFromCache).mockReturnValueOnce(cache);
    vi.spyOn(GenerateExerciseResultSchema, 'safeParse').mockReturnValueOnce({
      success: false,
      error: new ZodError([]),
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await tryGetCachedExercise(mockParams, mockUserId);
    expect(result).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
