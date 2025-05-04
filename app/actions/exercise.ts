'use server';

import { getServerSession, type Session } from 'next-auth';
import { headers } from 'next/headers';
import { authOptions } from '@/lib/authOptions';
import { getDbUserIdFromSession } from '../../lib/authUtils';
import { createErrorResponse } from '@/lib/utils/exercise-response';
import { tryGetCachedExercise } from './exercise-helpers';
import { countCachedExercises } from '@/lib/exercise-cache';
import { validateRequestParams, getOrGenerateExercise } from './exercise-orchestrator';
import { checkRateLimit } from '@/lib/rate-limiter';
import type { ZodIssue } from 'zod';
import type { GenerateExerciseResult } from '@/lib/domain/schemas';

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
      return cachedResult;
    }
    return createErrorResponse('Rate limit exceeded and no cached question available.');
  }
  const cachedCount = countCachedExercises(
    validParams.passageLanguage,
    validParams.questionLanguage,
    validParams.cefrLevel
  );
  return getOrGenerateExercise(validParams, userId, cachedCount);
};
