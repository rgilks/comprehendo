import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { generateAndValidateExercise } from './exercise-generator';
import { QuizDataSchema, type QuizData } from '@/lib/domain/schemas';
import { generateExercisePrompt } from '@/lib/ai/prompts/exercise-prompt';
import { ExerciseGenerationParamsSchema, type ExerciseGenerationParams } from '@/lib/domain/ai';

// Mock the imported functions
vi.mock('@/lib/ai/prompts/exercise-prompt');

// Explicitly mock ONLY callGoogleAI within the module factory
vi.mock('./exercise-generator', async (importOriginal) => {
  const original = await importOriginal<typeof import('./exercise-generator')>();
  return {
    ...original, // Keep other exports
    callGoogleAI: vi.fn(), // Replace callGoogleAI with a mock function
  };
});

// Mock the AI Client (still needed by google-ai-api.ts if not mocked, though less critical now)
vi.mock('@/lib/ai/client', () => ({
  getGoogleAIClient: vi.fn(() => ({
    models: {
      // Provide a mock function that returns an object with a text property
      generateContent: vi.fn().mockResolvedValue({ text: 'default mock response' }),
    },
  })),
}));

// Remove the vi.mock calls for Zod schemas
// vi.mock('@/lib/domain/ai', ...);
// vi.mock('@/lib/domain/schemas', ...);

const mockedGenerateExercisePrompt = generateExercisePrompt as MockedFunction<
  typeof generateExercisePrompt
>;

// Spies for Zod methods - declared but setup in beforeEach/tests
let mockExerciseParamsParseSpy: vi.SpyInstance;
let mockQuizDataSafeParseSpy: vi.SpyInstance;

// Use the mocked callGoogleAI via the alias
const mockCallGoogleAI = vi.fn();

// Define valid parameters for testing generateAndValidateExercise
const validParams: ExerciseGenerationParams = {
  topic: 'Test Topic',
  passageLanguage: 'en',
  questionLanguage: 'es',
  passageLangName: 'English',
  questionLangName: 'Spanish',
  level: 'B1',
  grammarGuidance: 'Past tense',
  vocabularyGuidance: 'Travel words',
};

// Define a valid AI response structure matching QuizDataSchema
const validAiResponseJson: QuizData = {
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
    // Restore mocks for schema methods if they were mocked individually in tests
    // mockExerciseParamsParse.mockImplementation(ExerciseGenerationParamsSchema.parse);
    // mockQuizDataSafeParse.mockImplementation(QuizDataSchema.safeParse);
    // Remove reset for the old mock variable
    // mockCallGoogleAI.mockReset();
  });

  // Add tests for generateAndValidateExercise
  describe('generateAndValidateExercise', () => {
    beforeEach(() => {
      // Reset mocks
      vi.resetAllMocks();
      mockedGenerateExercisePrompt.mockReturnValue('mock prompt');

      // Set the return value for the mocked callGoogleAI
      mockCallGoogleAI.mockResolvedValue(JSON.stringify(validAiResponseJson));

      // Setup spies on the actual schema methods
      mockExerciseParamsParseSpy = vi.spyOn(ExerciseGenerationParamsSchema, 'parse');
      mockQuizDataSafeParseSpy = vi.spyOn(QuizDataSchema, 'safeParse');
    });

    afterEach(() => {
      // Restore original implementations after each test
      vi.restoreAllMocks();
    });

    it('should successfully generate and validate an exercise', async () => {
      const result = await generateAndValidateExercise(validParams);

      // mockExerciseParamsParse.mockImplementation(ExerciseGenerationParamsSchema.parse);
      expect(mockExerciseParamsParseSpy).toHaveBeenCalledWith(validParams);
      expect(mockedGenerateExercisePrompt).toHaveBeenCalledWith(validParams);
      expect(mockCallGoogleAI).toHaveBeenCalledWith('mock prompt');
      // mockQuizDataSafeParse.mockImplementation(QuizDataSchema.safeParse);
      expect(mockQuizDataSafeParseSpy).toHaveBeenCalledWith(validAiResponseJson);
      expect(result).toEqual(validAiResponseJson);
    });

    it('should throw if input parameters fail validation', async () => {
      const invalidParams = { ...validParams, level: undefined }; // Make params invalid
      // No need to mock ExerciseGenerationParamsSchema.parse throwing,
      // just pass invalid data and let the actual Zod schema handle it.

      await expect(generateAndValidateExercise(invalidParams as any)).rejects.toThrow(); // Zod error

      // mockExerciseParamsParse.mockImplementation(ExerciseGenerationParamsSchema.parse);
      expect(mockExerciseParamsParseSpy).toHaveBeenCalledWith(invalidParams);
      expect(mockedGenerateExercisePrompt).not.toHaveBeenCalled();
      expect(mockCallGoogleAI).not.toHaveBeenCalled();
      // mockQuizDataSafeParse.mockImplementation(QuizDataSchema.safeParse);
      expect(mockQuizDataSafeParseSpy).not.toHaveBeenCalled();
    });

    it('should throw AIResponseProcessingError if AI response is not valid JSON', async () => {
      const invalidJsonResponse = 'not json{';
      mockCallGoogleAI.mockResolvedValue(invalidJsonResponse);

      // Check error message text
      await expect(generateAndValidateExercise(validParams)).rejects.toThrow(
        /Failed to parse AI JSON response/
      );
      // Check original error message is included if possible (depends on actual error thrown)
      // await expect(generateAndValidateExercise(validParams)).rejects.toThrow(
      //     expect.objectContaining({ message: expect.stringMatching(/Failed to parse AI JSON/) })
      // );

      expect(mockCallGoogleAI).toHaveBeenCalledWith('mock prompt');
      expect(mockQuizDataSafeParseSpy).not.toHaveBeenCalled();
    });

    it('should throw AIResponseProcessingError if AI response fails Zod validation', async () => {
      const invalidDataResponse = { ...validAiResponseJson, question: undefined };
      mockCallGoogleAI.mockResolvedValue(JSON.stringify(invalidDataResponse));

      // Check error message text
      await expect(generateAndValidateExercise(validParams)).rejects.toThrow(
        /AI response failed validation/
      );
      // await expect(generateAndValidateExercise(validParams)).rejects.toThrow(
      //     expect.objectContaining({ message: expect.stringMatching(/AI response failed validation/) })
      // );

      expect(mockCallGoogleAI).toHaveBeenCalledWith('mock prompt');
      expect(mockQuizDataSafeParseSpy).toHaveBeenCalledWith(invalidDataResponse);
    });

    it('should handle AI providing undefined topic by setting it to null', async () => {
      const responseWithUndefinedTopic = { ...validAiResponseJson, topic: undefined };
      // Update the mock's implementation for this test
      mockCallGoogleAI.mockResolvedValue(JSON.stringify(responseWithUndefinedTopic));

      const result = await generateAndValidateExercise(validParams);

      // mockQuizDataSafeParse.mockImplementation(QuizDataSchema.safeParse);
      expect(mockQuizDataSafeParseSpy).toHaveBeenCalledWith(responseWithUndefinedTopic);
      expect(result).toEqual({ ...validAiResponseJson, topic: null }); // Expect topic to be null
    });
  });
});
