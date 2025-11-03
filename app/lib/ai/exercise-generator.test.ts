/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAndValidateExercise } from 'app/lib/ai/exercise-generator';
import { AIResponseProcessingError } from 'app/lib/ai/google-ai-api';
import type { ExerciseGenerationOptions } from 'app/lib/ai/exercise-generator';

// Mock the dependencies
vi.mock('app/lib/ai/prompts/exercise-prompt', () => ({
  generateExercisePrompt: vi.fn().mockReturnValue('Mock prompt'),
}));

vi.mock('app/lib/ai/google-ai-api', () => ({
  callGoogleAI: vi.fn(),
  AIResponseProcessingError: class AIResponseProcessingError extends Error {
    constructor(message: string, cause?: unknown) {
      super(message);
      this.name = 'AIResponseProcessingError';
      this.cause = cause;
    }
  },
}));

vi.mock('app/lib/ai/together-ai-api', () => ({
  callTogetherAI: vi.fn(),
}));

vi.mock('app/lib/ai/question-validator', () => ({
  validateQuestionQuality: vi.fn(),
}));

vi.mock('app/domain/schemas', () => ({
  ExerciseContentSchema: {
    safeParse: vi.fn(),
  },
}));

describe('exercise generator', () => {
  const mockOptions: ExerciseGenerationOptions = {
    topic: 'Technology',
    passageLanguage: 'en',
    questionLanguage: 'en',
    level: 'B1',
    language: 'en',
    passageLangName: 'English',
    questionLangName: 'English',
    grammarGuidance: 'Basic grammar',
    vocabularyGuidance: 'Basic vocabulary',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['AI_PROVIDER'];
  });

  it('should generate and validate exercise successfully with Google AI', async () => {
    process.env['AI_PROVIDER'] = 'google';
    const { callGoogleAI } = await import('app/lib/ai/google-ai-api');
    const { ExerciseContentSchema } = await import('app/domain/schemas');
    const { validateQuestionQuality } = await import('app/lib/ai/question-validator');

    const mockAIResponse = {
      question: 'What is the main topic?',
      options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
      correctAnswer: 'A',
      allExplanations: { A: 'Correct', B: 'Wrong', C: 'Wrong', D: 'Wrong' },
      relevantText: 'Main topic text',
      paragraph: 'This is a paragraph about the main topic text.',
    };

    vi.mocked(callGoogleAI).mockResolvedValue(mockAIResponse);
    vi.mocked(ExerciseContentSchema.safeParse).mockReturnValue({
      success: true,
      data: mockAIResponse,
    });
    vi.mocked(validateQuestionQuality).mockReturnValue({
      isValid: true,
      reason: 'Valid',
      metrics: {} as never,
    });

    const result = await generateAndValidateExercise(mockOptions);

    expect(result).toEqual(mockAIResponse);
    expect(vi.mocked(callGoogleAI)).toHaveBeenCalledWith('Mock prompt');
  });

  it('should generate and validate exercise successfully with Together AI', async () => {
    process.env['AI_PROVIDER'] = 'together';
    const { callTogetherAI } = await import('app/lib/ai/together-ai-api');
    const { ExerciseContentSchema } = await import('app/domain/schemas');
    const { validateQuestionQuality } = await import('app/lib/ai/question-validator');

    const mockAIResponse = {
      question: 'What is the main topic?',
      options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
      correctAnswer: 'A',
      allExplanations: { A: 'Correct', B: 'Wrong', C: 'Wrong', D: 'Wrong' },
      relevantText: 'Main topic text',
      paragraph: 'This is a paragraph about the main topic text.',
    };

    vi.mocked(callTogetherAI).mockResolvedValue(mockAIResponse);
    vi.mocked(ExerciseContentSchema.safeParse).mockReturnValue({
      success: true,
      data: mockAIResponse,
    });
    vi.mocked(validateQuestionQuality).mockReturnValue({
      isValid: true,
      reason: 'Valid',
      metrics: {} as never,
    });

    const result = await generateAndValidateExercise(mockOptions);

    expect(result).toEqual(mockAIResponse);
    expect(vi.mocked(callTogetherAI)).toHaveBeenCalledWith('Mock prompt');
  });

  it('should throw error after max retries on AI call failure', async () => {
    process.env['AI_PROVIDER'] = 'google';
    const { callGoogleAI } = await import('app/lib/ai/google-ai-api');

    vi.mocked(callGoogleAI).mockRejectedValue(new Error('AI call failed'));

    await expect(generateAndValidateExercise(mockOptions, 1)).rejects.toThrow(
      AIResponseProcessingError
    );
  });

  it('should handle AI call failure', async () => {
    process.env['AI_PROVIDER'] = 'google';
    const { callGoogleAI } = await import('app/lib/ai/google-ai-api');

    vi.mocked(callGoogleAI).mockRejectedValue(new Error('AI call failed'));

    await expect(generateAndValidateExercise(mockOptions)).rejects.toThrow(
      AIResponseProcessingError
    );
  });

  it('should handle invalid AI response format', async () => {
    process.env['AI_PROVIDER'] = 'google';
    const { callGoogleAI } = await import('app/lib/ai/google-ai-api');

    vi.mocked(callGoogleAI).mockResolvedValue('Invalid response');

    await expect(generateAndValidateExercise(mockOptions)).rejects.toThrow(
      AIResponseProcessingError
    );
  });

  it('should handle schema validation failure', async () => {
    process.env['AI_PROVIDER'] = 'google';
    const { callGoogleAI } = await import('app/lib/ai/google-ai-api');
    const { ExerciseContentSchema } = await import('app/domain/schemas');

    vi.mocked(callGoogleAI).mockResolvedValue({ invalid: 'data' });
    vi.mocked(ExerciseContentSchema.safeParse).mockReturnValue({
      success: false,
      error: new Error('Schema validation failed') as never,
    });

    await expect(generateAndValidateExercise(mockOptions)).rejects.toThrow(
      AIResponseProcessingError
    );
  });
});
