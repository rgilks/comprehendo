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
import type { GenerateExerciseResult } from '@/lib/domain/schemas';
import { LANGUAGES } from '@/lib/domain/language';
import { getRandomTopicForLevel } from '@/lib/domain/topics';
import { getGrammarGuidance, getVocabularyGuidance } from '@/lib/domain/language-guidance';
import type { ExerciseGenerationParams } from '@/lib/domain/ai';

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
