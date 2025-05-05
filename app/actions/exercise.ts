'use server';

import { getServerSession, type Session } from 'next-auth';
import { headers } from 'next/headers';
import { authOptions } from '@/lib/authOptions';
import { getDbUserIdFromSession } from '../../lib/authUtils';
import { createErrorResponse, tryGetCachedExercise } from './exercise-helpers';
import { countCachedExercises } from '@/lib/exercise-cache';
import { validateRequestParams, getOrGenerateExercise } from './exercise-orchestrator';
import { checkRateLimit } from '@/lib/rate-limiter';
import type { ZodIssue } from 'zod';
import { z } from 'zod';
import type { GenerateExerciseResult } from '@/lib/domain/schemas';
import { LANGUAGES } from '@/lib/domain/language';
import { getRandomTopicForLevel } from '@/lib/domain/topics';
import { getGrammarGuidance, getVocabularyGuidance } from '@/lib/domain/language-guidance';
import type { ExerciseGenerationParams } from '@/lib/domain/ai';
import {
  // InitialExercisePairResultSchema, // Unused schema
  type InitialExercisePairResult,
  GenerateExerciseResultSchema,
} from '@/lib/domain/schemas';

// --- Main Action ---

export const generateExerciseResponse = async (
  requestParams: unknown
): Promise<GenerateExerciseResult> => {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  const session: Session | null = await getServerSession(authOptions);
  const userId = getDbUserIdFromSession(session);

  const validationResult = validateRequestParams(requestParams);
  if (!validationResult.success) {
    const errorMsg = `Invalid request parameters: ${validationResult.error.errors
      .map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')}`;
    return createErrorResponse(errorMsg);
  }
  const validParams = validationResult.data;

  const isAllowed = checkRateLimit(ip);

  if (!isAllowed) {
    const cachedResult = await tryGetCachedExercise(validParams, userId);
    if (cachedResult) {
      console.log(`Rate limit exceeded for IP ${ip} but returning cached question.`);
      return cachedResult;
    }
    console.warn(`Rate limit exceeded for IP ${ip} and no cached question available.`);
    return createErrorResponse('Rate limit exceeded and no cached question available.');
  }

  const genParams: ExerciseGenerationParams = {
    passageLanguage: validParams.passageLanguage,
    questionLanguage: validParams.questionLanguage,
    level: validParams.cefrLevel,
    passageLangName: LANGUAGES[validParams.passageLanguage],
    questionLangName: LANGUAGES[validParams.questionLanguage],
    topic: getRandomTopicForLevel(validParams.cefrLevel),
    grammarGuidance: getGrammarGuidance(validParams.cefrLevel),
    vocabularyGuidance: getVocabularyGuidance(validParams.cefrLevel),
  };

  const cachedCount = countCachedExercises(
    genParams.passageLanguage,
    genParams.questionLanguage,
    genParams.level
  );

  try {
    const result = await getOrGenerateExercise(genParams, userId, cachedCount);
    if (result.quizId === -1 && result.error == null) {
      return { ...result, error: 'Internal Error: Failed to generate or retrieve exercise.' };
    }
    return result;
  } catch (error) {
    console.error('Error in generateExerciseResponse:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during exercise generation process';
    return createErrorResponse(errorMessage);
  }
};

// --- New Action for Initial Pair ---

export const generateInitialExercisePair = async (
  requestParams: unknown
): Promise<InitialExercisePairResult> => {
  // const actionStartTime = Date.now(); // Unused var
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  const session: Session | null = await getServerSession(authOptions);
  const userId = getDbUserIdFromSession(session);

  const validationResult = validateRequestParams(requestParams); // Reuse existing validation
  if (!validationResult.success) {
    const errorMsg = `Invalid request parameters: ${validationResult.error.errors
      .map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')}`;
    return { quizzes: [], error: errorMsg }; // Return error in the new format
  }
  const validParams = validationResult.data;

  // --- 2. Rate Limiting (Counts as one action call) ---
  const isAllowed = checkRateLimit(ip);
  if (!isAllowed) {
    // Maybe try returning cached *pair*? For now, just deny.
    return { quizzes: [], error: 'Rate limit exceeded.' };
  }

  // --- 3. Prepare Generation Params (Same for both calls) ---
  const genParams: ExerciseGenerationParams = {
    passageLanguage: validParams.passageLanguage,
    questionLanguage: validParams.questionLanguage,
    level: validParams.cefrLevel,
    passageLangName: LANGUAGES[validParams.passageLanguage],
    questionLangName: LANGUAGES[validParams.questionLanguage],
    topic: getRandomTopicForLevel(validParams.cefrLevel),
    grammarGuidance: getGrammarGuidance(validParams.cefrLevel),
    vocabularyGuidance: getVocabularyGuidance(validParams.cefrLevel),
  };
  const genParams2 = { ...genParams, topic: getRandomTopicForLevel(validParams.cefrLevel) };

  // --- 4. Concurrent Generation Attempt ---
  let results: [GenerateExerciseResult, GenerateExerciseResult] | null = null;
  let errorResult: { quizzes: []; error: string } | null = null;

  try {
    const generationPromises = [
      getOrGenerateExercise(genParams, userId, 0),
      getOrGenerateExercise(genParams2, userId, 0),
    ];

    const settledResults = await Promise.all(generationPromises);

    if (settledResults.every((r) => r.error === null && r.quizId !== -1)) {
      const validatedResults = z.array(GenerateExerciseResultSchema).safeParse(settledResults);
      if (validatedResults.success) {
        results = validatedResults.data as [GenerateExerciseResult, GenerateExerciseResult];
      } else {
        errorResult = { quizzes: [], error: 'Internal error processing generated results.' };
      }
    } else {
      const errors = settledResults.map((r) => r.error).filter((e) => e !== null);
      errorResult = {
        quizzes: [],
        error: `Failed to generate exercise pair: ${errors.join('; ')}`,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown generation error';
    errorResult = { quizzes: [], error: `Server error during generation: ${message}` };
  }

  // --- 5. Return Result ---
  if (results) {
    // console.log(`[Action:InitialPair] Successfully generated pair. Total time: ${Date.now() - actionStartTime}ms`); // Remove reference to unused var
    return { quizzes: results, error: null };
  } else {
    // console.log(`[Action:InitialPair] Failed to generate pair. Total time: ${Date.now() - actionStartTime}ms`); // Remove reference to unused var
    return errorResult ?? { quizzes: [], error: 'Unknown failure generating exercise pair.' };
  }
};
