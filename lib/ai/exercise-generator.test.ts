import { describe, it, expect, vi, beforeEach, type MockedFunction, afterEach } from 'vitest';
import {
  generateAndValidateExercise,
  type ExerciseGenerationOptions,
  AIResponseProcessingError,
} from './exercise-generator';
import { ExerciseContentSchema, type ExerciseContent } from '@/lib/domain/schemas';
import { generateExercisePrompt } from '@/lib/ai/prompts/exercise-prompt';
import * as GoogleApiModule from '@/lib/ai/google-ai-api';

// Mock the imported functions
vi.mock('@/lib/ai/prompts/exercise-prompt');

// Mock the google-ai-api module directly
vi.mock('@/lib/ai/google-ai-api', async (importOriginal) => {
  const original = await importOriginal<typeof GoogleApiModule>();
  return {
    ...original,
    callGoogleAI: vi.fn(),
  };
});

// Mock the AI Client
vi.mock('@/lib/ai/client', () => ({
  getGoogleAIClient: vi.fn(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({ text: 'default mock response' }),
    },
  })),
}));

const mockedGenerateExercisePrompt = generateExercisePrompt as MockedFunction<
  typeof generateExercisePrompt
>;

import { callGoogleAI } from '@/lib/ai/google-ai-api';

const mockedCallGoogleAI = callGoogleAI as MockedFunction<typeof GoogleApiModule.callGoogleAI>;

// Spy for Zod validation
let mockExerciseContentSafeParseSpy: any;

// Define valid parameters
const validParams: ExerciseGenerationOptions = {
  topic: 'Test Topic',
  language: 'en',
  passageLanguage: 'en',
  questionLanguage: 'es',
  passageLangName: 'English',
  questionLangName: 'Spanish',
  level: 'B1',
  grammarGuidance: 'Past tense',
  vocabularyGuidance: 'Travel words',
};

// Define a valid AI response
const validAiResponseJson: ExerciseContent = {
  paragraph: 'This is a test paragraph.',
  topic: 'Test Topic',
  question: 'What is this?',
  options: { A: 'Test A', B: 'Test B', C: 'Test C', D: 'Test D' },
  correctAnswer: 'A',
  allExplanations: {
    A: 'Correct because...',
    B: 'Incorrect because...',
    C: 'Incorrect because...',
    D: 'Incorrect because...',
  },
  relevantText: 'test paragraph',
};

describe('AI Exercise Generation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('generateAndValidateExercise', () => {
    beforeEach(() => {
      vi.resetAllMocks();
      mockedGenerateExercisePrompt.mockReturnValue('mock prompt');
      mockedCallGoogleAI.mockResolvedValue(validAiResponseJson);
      mockExerciseContentSafeParseSpy = vi.spyOn(ExerciseContentSchema, 'safeParse');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should successfully generate and validate an exercise', async () => {
      const result = await generateAndValidateExercise(validParams);
      expect(mockedGenerateExercisePrompt).toHaveBeenCalledWith(validParams);
      expect(mockedCallGoogleAI).toHaveBeenCalledWith('mock prompt');
      expect(mockExerciseContentSafeParseSpy).toHaveBeenCalledWith(validAiResponseJson);
      expect(result).toEqual(validAiResponseJson);
    });

    it('should re-throw error from generateExercisePrompt if prompt generation fails', async () => {
      const invalidParams = { ...validParams, level: undefined }; // Invalid data
      const promptError = new Error('Prompt generation failed due to invalid level');
      mockedGenerateExercisePrompt.mockImplementation(() => {
        throw promptError;
      });

      // We expect the error thrown by generateExercisePrompt
      await expect(generateAndValidateExercise(invalidParams as any)).rejects.toThrow(promptError);

      expect(mockedGenerateExercisePrompt).toHaveBeenCalledWith(invalidParams);
      expect(mockedCallGoogleAI).not.toHaveBeenCalled();
      expect(mockExerciseContentSafeParseSpy).not.toHaveBeenCalled();
    });

    it('should throw AIResponseProcessingError if callGoogleAI fails', async () => {
      const apiError = new AIResponseProcessingError('Google AI call failed');
      mockedCallGoogleAI.mockRejectedValue(apiError);

      await expect(generateAndValidateExercise(validParams)).rejects.toThrow(apiError);

      expect(mockedCallGoogleAI).toHaveBeenCalledWith('mock prompt');
      expect(mockExerciseContentSafeParseSpy).not.toHaveBeenCalled();
    });

    it('should throw AIResponseProcessingError if AI response fails Zod validation', async () => {
      const invalidDataResponse = { ...validAiResponseJson, question: undefined };
      mockedCallGoogleAI.mockResolvedValue(invalidDataResponse); // AI returns invalid data

      await expect(generateAndValidateExercise(validParams)).rejects.toThrow(
        AIResponseProcessingError
      );
      await expect(generateAndValidateExercise(validParams)).rejects.toThrow(
        /AI response failed structure validation/
      );

      expect(mockedCallGoogleAI).toHaveBeenCalledWith('mock prompt');
      expect(mockExerciseContentSafeParseSpy).toHaveBeenCalledWith(invalidDataResponse);
    });

    it('should handle successful validation when AI response topic is null', async () => {
      const responseWithNullTopic = { ...validAiResponseJson, topic: null };
      mockedCallGoogleAI.mockResolvedValue(responseWithNullTopic);

      const result = await generateAndValidateExercise(validParams);

      expect(mockedCallGoogleAI).toHaveBeenCalledWith('mock prompt');
      expect(mockExerciseContentSafeParseSpy).toHaveBeenCalledWith(responseWithNullTopic);
      expect(result).toEqual(responseWithNullTopic);
    });

    it('should handle successful validation when AI response topic is missing', async () => {
      const responseWithoutTopic = { ...validAiResponseJson };
      delete (responseWithoutTopic as Partial<ExerciseContent>).topic;
      mockedCallGoogleAI.mockResolvedValue(responseWithoutTopic);

      const result = await generateAndValidateExercise(validParams);

      expect(mockedCallGoogleAI).toHaveBeenCalledWith('mock prompt');
      expect(mockExerciseContentSafeParseSpy).toHaveBeenCalledWith(responseWithoutTopic);
      // Check result doesn't have topic
      expect(result).toEqual(expect.not.objectContaining({ topic: expect.anything() }));
      expect(result).toEqual(responseWithoutTopic);
    });
  });
});
