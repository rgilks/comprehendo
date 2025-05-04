import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateRequestParams, getOrGenerateExercise } from './exercise-orchestrator';
import * as helpers from './exercise-helpers';
import type { ExerciseRequestParams } from '@/lib/domain/schemas';

const validParams: ExerciseRequestParams = {
  passageLanguage: 'en',
  questionLanguage: 'fr',
  cefrLevel: 'A2',
};

describe('validateRequestParams', () => {
  it('validates correct params', () => {
    const result = validateRequestParams(validParams);
    expect(result.success).toBe(true);
  });

  it('invalidates incorrect params', () => {
    const result = validateRequestParams({ ...validParams, cefrLevel: 'Z9' });
    expect(result.success).toBe(false);
  });
});

describe('getOrGenerateExercise', () => {
  const userId = 1;
  const quizId = 123;
  const quizData = {
    paragraph: 'p',
    question: 'q',
    options: { A: 'a', B: 'b', C: 'c', D: 'd' },
    topic: 't',
    language: 'en',
  };
  const successResult = { quizData, quizId, error: null, cached: false };
  const cacheResult = { quizData, quizId, error: null, cached: true };
  const failResult = {
    quizData,
    quizId: -1,
    error: 'Failed to validate AI response structure.',
    cached: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns generated exercise if cache is low and generation succeeds', async () => {
    vi.spyOn(helpers, 'tryGenerateAndCacheExercise').mockResolvedValue(successResult);
    const result = await getOrGenerateExercise(validParams, userId, 10);
    expect(result).toEqual(successResult);
  });

  it('returns cached exercise if cache is low, generation fails, but cache fallback succeeds', async () => {
    vi.spyOn(helpers, 'tryGenerateAndCacheExercise').mockResolvedValue(failResult);
    vi.spyOn(helpers, 'tryGetCachedExercise').mockResolvedValue(cacheResult);
    const result = await getOrGenerateExercise(validParams, userId, 10);
    expect(result).toEqual(cacheResult);
  });

  it('returns generation result if cache is low, generation and cache fallback both fail', async () => {
    vi.spyOn(helpers, 'tryGenerateAndCacheExercise').mockResolvedValue(failResult);
    vi.spyOn(helpers, 'tryGetCachedExercise').mockResolvedValue(null);
    const result = await getOrGenerateExercise(validParams, userId, 10);
    expect(result).toEqual(failResult);
  });

  it('returns cached exercise if cache is high and cache lookup succeeds', async () => {
    vi.spyOn(helpers, 'tryGetCachedExercise').mockResolvedValue(cacheResult);
    const result = await getOrGenerateExercise(validParams, userId, 200);
    expect(result).toEqual(cacheResult);
  });

  it('returns generated exercise if cache is high, cache lookup fails, but generation succeeds', async () => {
    vi.spyOn(helpers, 'tryGetCachedExercise').mockResolvedValue(null);
    vi.spyOn(helpers, 'tryGenerateAndCacheExercise').mockResolvedValue(successResult);
    const result = await getOrGenerateExercise(validParams, userId, 200);
    expect(result).toEqual(successResult);
  });

  it('returns generation result if cache is high, cache lookup and generation both fail', async () => {
    vi.spyOn(helpers, 'tryGetCachedExercise').mockResolvedValue(null);
    vi.spyOn(helpers, 'tryGenerateAndCacheExercise').mockResolvedValue(failResult);
    const result = await getOrGenerateExercise(validParams, userId, 200);
    expect(result).toEqual(failResult);
  });

  it('calls console.warn when generation fails and cache fallback is attempted (low cache)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(helpers, 'tryGenerateAndCacheExercise').mockResolvedValue(failResult);
    vi.spyOn(helpers, 'tryGetCachedExercise').mockResolvedValue(cacheResult);
    await getOrGenerateExercise(validParams, userId, 10);
    expect(warn).toHaveBeenCalledWith(
      '[API] Generation failed (low cache), attempting cache fallback.'
    );
  });

  it('calls console.warn when cache lookup fails and generation is attempted (high cache)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(helpers, 'tryGetCachedExercise').mockResolvedValue(null);
    vi.spyOn(helpers, 'tryGenerateAndCacheExercise').mockResolvedValue(successResult);
    await getOrGenerateExercise(validParams, userId, 200);
    expect(warn).toHaveBeenCalledWith(
      '[API] Cache count high, but cache lookup failed. Attempting generation.'
    );
  });
});
