import { describe, it, expect } from 'vitest';
import { ExerciseSchema, CEFRLevelSchema, LanguageSchema } from './exercise';

describe('ExerciseSchema', () => {
  const validExercise = {
    paragraph: 'This is a sample paragraph for the exercise.',
    topic: 'Sample Topic',
    question: 'What is the main idea of the paragraph?',
    options: {
      A: 'Option A',
      B: 'Option B',
      C: 'Option C',
      D: 'Option D',
    },
    correctAnswer: 'A',
    allExplanations: {
      A: 'Explanation for A',
      B: 'Explanation for B',
      C: 'Explanation for C',
      D: 'Explanation for D',
    },
    relevantText: 'sample paragraph',
  };

  it('should parse a valid exercise successfully', () => {
    const result = ExerciseSchema.safeParse(validExercise);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validExercise);
    }
  });

  it('should fail if paragraph is missing', () => {
    const exercise = { ...validExercise, paragraph: undefined };
    const result = ExerciseSchema.safeParse(exercise);
    expect(result.success).toBe(false);
  });

  it('should fail if paragraph is an empty string', () => {
    const exercise = { ...validExercise, paragraph: '' };
    const result = ExerciseSchema.safeParse(exercise);
    expect(result.success).toBe(false);
  });

  it('should fail if topic is an empty string', () => {
    const exercise = { ...validExercise, topic: '' };
    const result = ExerciseSchema.safeParse(exercise);
    expect(result.success).toBe(false);
  });

  it('should fail if question is missing', () => {
    const exercise = { ...validExercise, question: undefined };
    const result = ExerciseSchema.safeParse(exercise);
    expect(result.success).toBe(false);
  });

  it('should fail if options.A is an empty string', () => {
    const exercise = { ...validExercise, options: { ...validExercise.options, A: '' } };
    const result = ExerciseSchema.safeParse(exercise);
    expect(result.success).toBe(false);
  });

  it('should fail if correctAnswer is invalid', () => {
    const exercise = { ...validExercise, correctAnswer: 'E' };
    const result = ExerciseSchema.safeParse(exercise);
    expect(result.success).toBe(false);
  });

  it('should fail if allExplanations.B is an empty string', () => {
    const exercise = {
      ...validExercise,
      allExplanations: { ...validExercise.allExplanations, B: '' },
    };
    const result = ExerciseSchema.safeParse(exercise);
    expect(result.success).toBe(false);
  });

  it('should fail if relevantText is an empty string', () => {
    const exercise = { ...validExercise, relevantText: '' };
    const result = ExerciseSchema.safeParse(exercise);
    expect(result.success).toBe(false);
  });

  it('should fail if options is not an object', () => {
    const exercise = { ...validExercise, options: 'not-an-object' };
    const result = ExerciseSchema.safeParse(exercise);
    expect(result.success).toBe(false);
  });

  it('should fail if a required option field (e.g., C) is missing', () => {
    const invalidOptions = { ...validExercise.options };
    delete (invalidOptions as any).C; // Type assertion to allow deletion for test
    const exercise = { ...validExercise, options: invalidOptions };
    const result = ExerciseSchema.safeParse(exercise);
    expect(result.success).toBe(false);
  });
});

// Tests for CEFRLevelSchema and LanguageSchema can be minimal as they are simple enums
// but we should ensure they parse their defined values and reject others.

describe('CEFRLevelSchema in exercise.ts', () => {
  it('should parse valid CEFR levels', () => {
    expect(CEFRLevelSchema.safeParse('A1').success).toBe(true);
    expect(CEFRLevelSchema.safeParse('C2').success).toBe(true);
  });

  it('should reject invalid CEFR levels', () => {
    expect(CEFRLevelSchema.safeParse('D1').success).toBe(false);
    expect(CEFRLevelSchema.safeParse('').success).toBe(false);
  });
});

describe('LanguageSchema in exercise.ts', () => {
  it('should parse valid language codes', () => {
    expect(LanguageSchema.safeParse('en').success).toBe(true);
    expect(LanguageSchema.safeParse('la').success).toBe(true); // Latin, specific to this file
    expect(LanguageSchema.safeParse('zh').success).toBe(true);
  });

  it('should reject invalid language codes', () => {
    expect(LanguageSchema.safeParse('english').success).toBe(false);
    expect(LanguageSchema.safeParse('xx').success).toBe(false);
  });
});
