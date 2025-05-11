import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateProgress, submitAnswer, getProgress, submitFeedback } from '@/app/actions/progress';
import { calculateAndUpdateProgress } from '@/lib/progressUtils';
import { getAuthenticatedSessionUser } from '@/app/actions/authUtils';
import { findQuizById } from '@/lib/repositories/quizRepository';
import { getProgress as findUserProgress } from '@/lib/repositories/progressRepository';
import { createFeedback } from '@/lib/repositories/feedbackRepository';

vi.mock('@/lib/progressUtils');
vi.mock('@/app/actions/authUtils');
vi.mock('@/lib/repositories/quizRepository');
vi.mock('@/lib/repositories/progressRepository');
vi.mock('@/lib/repositories/feedbackRepository');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findQuizById).mockClear();
  vi.mocked(findUserProgress).mockClear();
  vi.mocked(createFeedback).mockClear();
});

const MOCK_USER_ID = 1;
const MOCK_LANGUAGE = 'en';
const MOCK_QUIZ_ID = 101;

// Mock data returned by findQuizById (matching QuizSchema in repository)
const MOCK_RAW_QUIZ_REPO_RETURN = {
  id: MOCK_QUIZ_ID,
  language: 'en',
  level: 'A2',
  question_language: 'en',
  user_id: null,
  created_at: new Date().toISOString(),
  content: {
    // This nested content matches QuizContentSchema in repo
    passage: 'This is the paragraph text related to the question.',
    question: 'What is X?',
    options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
    answer: 'B', // Correct answer key as per repo schema
    explanation: 'Explanation for B', // Single explanation as per repo schema
  },
};

// Mock data structure expected by getParsedQuizData after parsing against QuizDataSchema
const MOCK_PARSED_QUIZ_DATA_CONTENT = {
  // Fields required by QuizDataSchema
  paragraph: 'This is the paragraph text related to the question.',
  question: 'What is X?',
  options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
  correctAnswer: 'B', // Correct answer key
  allExplanations: {
    // Full explanations object
    A: 'Explanation for A',
    B: 'Explanation for B',
    C: 'Explanation for C',
    D: 'Explanation for D',
  },
  relevantText: 'Some relevant text.', // Relevant text snippet
  // Optional fields from QuizDataSchema
  id: MOCK_QUIZ_ID,
  language: 'en',
  topic: 'Test Topic',
  correctExplanation: 'Explanation for B',
};

const MOCK_PROGRESS_DATA = {
  user_id: MOCK_USER_ID,
  language_code: MOCK_LANGUAGE,
  cefr_level: 'B2' as const,
  correct_streak: 5,
  last_practiced: new Date(),
};

describe('User Progress Server Actions', () => {
  describe('updateProgress', () => {
    const params = { isCorrect: true, language: MOCK_LANGUAGE };

    it('should return Unauthorized if user is not authenticated', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue(null);
      const result = await updateProgress(params);
      expect(result.error).toBe('Unauthorized');
      expect(result.currentLevel).toBe('A1');
      expect(vi.mocked(calculateAndUpdateProgress)).not.toHaveBeenCalled();
    });

    it('should return Invalid parameters for invalid input', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      const invalidParams = { isCorrect: 'yes' as any, language: 'e' };
      const result = await updateProgress(invalidParams);
      expect(result.error).toBe('Invalid parameters');
      expect(result.currentLevel).toBe('A1');
      expect(vi.mocked(calculateAndUpdateProgress)).not.toHaveBeenCalled();
    });

    it('should call calculateAndUpdateProgress and return its result on success', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      const mockProgressResult = {
        currentLevel: 'B1' as const,
        currentStreak: 1,
        leveledUp: false,
      };
      vi.mocked(calculateAndUpdateProgress).mockReturnValue(mockProgressResult);

      const result = await updateProgress(params);

      expect(vi.mocked(calculateAndUpdateProgress)).toHaveBeenCalledWith(
        MOCK_USER_ID,
        params.language,
        params.isCorrect
      );
      expect(result).toEqual(expect.objectContaining(mockProgressResult));
      expect(result.error).toBeUndefined();
    });

    it('should return error from calculateAndUpdateProgress if it fails', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      const mockErrorResult = {
        currentLevel: 'A1' as const,
        currentStreak: 0,
        leveledUp: false,
        error: 'DB Error',
      };
      vi.mocked(calculateAndUpdateProgress).mockReturnValue(mockErrorResult);

      const result = await updateProgress(params);

      expect(result).toEqual(mockErrorResult);
    });
  });

  describe('submitAnswer', () => {
    const baseParams = { learn: MOCK_LANGUAGE, lang: 'de', id: MOCK_QUIZ_ID };

    it('should return Invalid request parameters for invalid input', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      const invalidParams = { ...baseParams, ans: 'too long' };
      const result = await submitAnswer(invalidParams);
      expect(result.error).toBe('Invalid request parameters.');
      expect(vi.mocked(findQuizById)).not.toHaveBeenCalled();
    });

    it('should return Missing or invalid quiz ID if id is missing', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      const invalidParams = { ...baseParams, id: undefined };
      const result = await submitAnswer(invalidParams);
      expect(result.error).toBe('Missing or invalid quiz ID.');
    });

    it('should return Quiz data unavailable if quiz is not found', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      vi.mocked(findQuizById).mockReturnValue(null);

      const result = await submitAnswer({ ...baseParams, ans: 'a' });

      expect(vi.mocked(findQuizById)).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(result.error).toBe(`Quiz with ID ${MOCK_QUIZ_ID} not found.`);
    });

    it('should return Quiz data unavailable if quiz content parsing fails against QuizDataSchema', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      const repoReturnWithMalformedContent = {
        ...MOCK_RAW_QUIZ_REPO_RETURN,
        content: { ...MOCK_RAW_QUIZ_REPO_RETURN.content, question: undefined }, // Missing required question
      };
      vi.mocked(findQuizById).mockReturnValue(repoReturnWithMalformedContent as any);

      const result = await submitAnswer({ ...baseParams, ans: 'a' });
      expect(vi.mocked(findQuizById)).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(result.error).toMatch(/Failed to parse content for quiz ID .* against QuizDataSchema/);
    });

    it('should process correct answer, generate feedback, and update progress for authenticated user', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      const repoReturnWithValidContent = {
        ...MOCK_RAW_QUIZ_REPO_RETURN,
        content: { ...MOCK_PARSED_QUIZ_DATA_CONTENT },
      };
      vi.mocked(findQuizById).mockReturnValue(repoReturnWithValidContent as any);
      const mockProgressResult = {
        currentLevel: 'B1' as const,
        currentStreak: 1,
        leveledUp: false,
      };
      vi.mocked(calculateAndUpdateProgress).mockReturnValue(mockProgressResult);

      const params = { ...baseParams, ans: 'B' };
      const result = await submitAnswer(params);

      expect(vi.mocked(findQuizById)).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(result.feedback?.isCorrect).toBe(true);
      expect(result.feedback?.correctAnswer).toBe('B');
      expect(result.feedback?.correctExplanation).toBe('Explanation for B');
      expect(result.feedback?.chosenIncorrectExplanation).toBeNull();
      expect(result.feedback?.relevantText).toBe('Some relevant text.');
      expect(vi.mocked(calculateAndUpdateProgress)).toHaveBeenCalledWith(
        MOCK_USER_ID,
        MOCK_LANGUAGE,
        true
      );
      expect(result).toEqual(expect.objectContaining(mockProgressResult));
      expect(result.error).toBeUndefined();
    });

    it('should process incorrect answer, generate feedback, and update progress for authenticated user', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      const repoReturnWithValidContent = {
        ...MOCK_RAW_QUIZ_REPO_RETURN,
        content: { ...MOCK_PARSED_QUIZ_DATA_CONTENT },
      };
      vi.mocked(findQuizById).mockReturnValue(repoReturnWithValidContent as any);
      const mockProgressResult = {
        currentLevel: 'A1' as const,
        currentStreak: 0,
        leveledUp: false,
      };
      vi.mocked(calculateAndUpdateProgress).mockReturnValue(mockProgressResult);

      const params = { ...baseParams, ans: 'A' };
      const result = await submitAnswer(params);

      expect(vi.mocked(findQuizById)).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(result.feedback?.isCorrect).toBe(false);
      expect(result.feedback?.correctAnswer).toBe('B');
      expect(result.feedback?.chosenIncorrectExplanation).toBe('Explanation for A');
      expect(vi.mocked(calculateAndUpdateProgress)).toHaveBeenCalledWith(
        MOCK_USER_ID,
        MOCK_LANGUAGE,
        false
      );
      expect(result).toEqual(expect.objectContaining(mockProgressResult));
      expect(result.error).toBeUndefined();
    });

    it('should generate feedback but not update progress for anonymous user', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue(null);
      const repoReturnWithValidContent = {
        ...MOCK_RAW_QUIZ_REPO_RETURN,
        content: { ...MOCK_PARSED_QUIZ_DATA_CONTENT },
      };
      vi.mocked(findQuizById).mockReturnValue(repoReturnWithValidContent as any);

      const params = { ...baseParams, ans: 'B', cefrLevel: 'B1' };
      const result = await submitAnswer(params);

      expect(vi.mocked(findQuizById)).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(result.feedback?.isCorrect).toBe(true);
      expect(vi.mocked(calculateAndUpdateProgress)).not.toHaveBeenCalled();
      expect(result.currentLevel).toBe('B1');
      expect(result.currentStreak).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('should return error from calculateAndUpdateProgress if it fails during progress update', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      const repoReturnWithValidContent = {
        ...MOCK_RAW_QUIZ_REPO_RETURN,
        content: { ...MOCK_PARSED_QUIZ_DATA_CONTENT },
      };
      vi.mocked(findQuizById).mockReturnValue(repoReturnWithValidContent as any);
      const mockErrorResult = {
        currentLevel: 'A1' as const,
        currentStreak: 0,
        leveledUp: false,
        error: 'DB Error on Update',
      };
      vi.mocked(calculateAndUpdateProgress).mockReturnValue(mockErrorResult);

      const params = { ...baseParams, ans: 'B' };
      const result = await submitAnswer(params);

      expect(vi.mocked(findQuizById)).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(result.feedback?.isCorrect).toBe(true);
      expect(vi.mocked(calculateAndUpdateProgress)).toHaveBeenCalledWith(
        MOCK_USER_ID,
        MOCK_LANGUAGE,
        true
      );
      expect(result.error).toBe(mockErrorResult.error);
      expect(result.currentLevel).toBe(mockErrorResult.currentLevel);
      expect(result.currentStreak).toBe(mockErrorResult.currentStreak);
    });
  });

  describe('getProgress', () => {
    const params = { language: MOCK_LANGUAGE };

    it('should return Unauthorized if user is not authenticated', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue(null);
      const result = await getProgress(params);
      expect(result.error).toBe('Unauthorized: User not logged in.');
      expect(result.currentLevel).toBe('A1');
      expect(result.currentStreak).toBe(0);
      expect(result).not.toHaveProperty('leveledUp');
      expect(vi.mocked(findUserProgress)).not.toHaveBeenCalled();
    });

    it('should return Invalid parameters for invalid input', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      const invalidParams = { language: 'e' };
      const result = await getProgress(invalidParams);
      expect(result.error).toBe('Invalid parameters provided.');
      expect(result.currentLevel).toBe('A1');
      expect(result.currentStreak).toBe(0);
      expect(result).not.toHaveProperty('leveledUp');
      expect(vi.mocked(findUserProgress)).not.toHaveBeenCalled();
    });

    it('should fetch and return existing progress for authenticated user', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      vi.mocked(findUserProgress).mockReturnValue(MOCK_PROGRESS_DATA);

      const result = await getProgress(params);

      expect(vi.mocked(findUserProgress)).toHaveBeenCalledWith(MOCK_USER_ID, params.language);
      expect(result.currentLevel).toBe(MOCK_PROGRESS_DATA.cefr_level);
      expect(result.currentStreak).toBe(MOCK_PROGRESS_DATA.correct_streak);
      expect(result.leveledUp).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should return default progress if no record exists for authenticated user', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      vi.mocked(findUserProgress).mockReturnValue(null);

      const result = await getProgress(params);

      expect(vi.mocked(findUserProgress)).toHaveBeenCalledWith(MOCK_USER_ID, params.language);
      expect(result.currentLevel).toBe('A1');
      expect(result.currentStreak).toBe(0);
      expect(result.leveledUp).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should handle repository error during progress fetch', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      const repoError = new Error('Repo Connection Lost');
      vi.mocked(findUserProgress).mockImplementation(() => {
        throw repoError;
      });

      const result = await getProgress(params);

      expect(vi.mocked(findUserProgress)).toHaveBeenCalledWith(MOCK_USER_ID, params.language);
      expect(result.currentLevel).toBe('A1');
      expect(result.currentStreak).toBe(0);
      expect(result.leveledUp).toBe(false);
      expect(result.error).toBe('Repository error fetching progress: Repo Connection Lost');
    });
  });

  describe('submitFeedback', () => {
    const params = {
      quizId: MOCK_QUIZ_ID,
      is_good: 1,
      passageLanguage: 'en',
      questionLanguage: 'de',
      currentLevel: 'B1',
    };

    it('should return Unauthorized if user is not authenticated', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue(null);
      const result = await submitFeedback(params);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
      expect(vi.mocked(findQuizById)).not.toHaveBeenCalled();
      expect(vi.mocked(createFeedback)).not.toHaveBeenCalled();
    });

    it('should return Invalid parameters for invalid input', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      const invalidParams = { ...params, quizId: -5 };
      const result = await submitFeedback(invalidParams);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid parameters');
      expect(vi.mocked(findQuizById)).not.toHaveBeenCalled();
      expect(vi.mocked(createFeedback)).not.toHaveBeenCalled();
    });

    it('should return Quiz not found if quiz ID does not exist', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      vi.mocked(findQuizById).mockReturnValue(null);

      const result = await submitFeedback(params);

      expect(vi.mocked(findQuizById)).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Quiz not found.');
      expect(vi.mocked(createFeedback)).not.toHaveBeenCalled();
    });

    it('should call createFeedback and return success if quiz exists and repo call succeeds', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      vi.mocked(findQuizById).mockReturnValue(MOCK_RAW_QUIZ_REPO_RETURN as any);
      vi.mocked(createFeedback).mockReturnValue(1);

      const feedbackParams = { ...params, userAnswer: 'B', isCorrect: true };
      const result = await submitFeedback(feedbackParams);

      expect(vi.mocked(findQuizById)).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(vi.mocked(createFeedback)).toHaveBeenCalledWith({
        quiz_id: MOCK_QUIZ_ID,
        user_id: MOCK_USER_ID,
        is_good: true,
        user_answer: 'B',
        is_correct: true,
      });
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle optional userAnswer and isCorrect (passing undefined/boolean to repo)', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      vi.mocked(findQuizById).mockReturnValue(MOCK_RAW_QUIZ_REPO_RETURN as any);
      vi.mocked(createFeedback).mockReturnValue(1);

      const feedbackParams1 = { ...params, is_good: 0, isCorrect: false };
      await submitFeedback(feedbackParams1);
      expect(vi.mocked(createFeedback)).toHaveBeenCalledWith({
        quiz_id: MOCK_QUIZ_ID,
        user_id: MOCK_USER_ID,
        is_good: false,
        user_answer: undefined,
        is_correct: false,
      });

      const feedbackParams2 = { ...params, is_good: 1 };
      await submitFeedback(feedbackParams2);
      expect(vi.mocked(createFeedback)).toHaveBeenCalledWith({
        quiz_id: MOCK_QUIZ_ID,
        user_id: MOCK_USER_ID,
        is_good: true,
        user_answer: undefined,
        is_correct: undefined,
      });
    });

    it('should return error if repository createFeedback fails', async () => {
      vi.mocked(getAuthenticatedSessionUser).mockResolvedValue({ dbId: MOCK_USER_ID });
      vi.mocked(findQuizById).mockReturnValue(MOCK_RAW_QUIZ_REPO_RETURN as any);
      const repoError = new Error('Insert failed');
      vi.mocked(createFeedback).mockImplementation(() => {
        throw repoError;
      });

      const result = await submitFeedback(params);

      expect(vi.mocked(findQuizById)).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(vi.mocked(createFeedback)).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Repository error saving feedback.');
    });
  });
});
