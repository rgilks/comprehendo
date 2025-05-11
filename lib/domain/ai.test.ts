import { describe, it, expect } from 'vitest';
import { ExerciseGenerationParamsSchema } from './ai';
import { LanguageSchema } from './language';
import { CEFR_LEVELS } from './language-guidance';

describe('ExerciseGenerationParamsSchema', () => {
  const validParams = {
    topic: 'Test Topic',
    passageLanguage: LanguageSchema.enum.en,
    questionLanguage: LanguageSchema.enum.es,
    passageLangName: 'English',
    questionLangName: 'Spanish',
    level: CEFR_LEVELS[0], // A1
    grammarGuidance: 'Focus on present tense',
    vocabularyGuidance: 'Common household items',
  };

  it('should parse valid params successfully', () => {
    const result = ExerciseGenerationParamsSchema.safeParse(validParams);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validParams);
    }
  });

  it('should fail if topic is missing', () => {
    const params = { ...validParams, topic: undefined };
    const result = ExerciseGenerationParamsSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should fail if passageLanguage is invalid', () => {
    const params = { ...validParams, passageLanguage: 'INVALID_LANG' };
    const result = ExerciseGenerationParamsSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should fail if questionLanguage is not a Language enum value', () => {
    const params = { ...validParams, questionLanguage: 'NOT_A_LANGUAGE' };
    const result = ExerciseGenerationParamsSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should fail if level is not a CEFRLevel enum value', () => {
    const params = { ...validParams, level: 'INVALID_LEVEL' };
    const result = ExerciseGenerationParamsSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should fail if passageLangName is not a string', () => {
    const params = { ...validParams, passageLangName: 123 };
    const result = ExerciseGenerationParamsSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should fail if grammarGuidance is missing', () => {
    const params = { ...validParams, grammarGuidance: undefined };
    const result = ExerciseGenerationParamsSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should fail if vocabularyGuidance is not a string', () => {
    const params = { ...validParams, vocabularyGuidance: null }; // null is not a string
    const result = ExerciseGenerationParamsSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should pass with empty string for topic', () => {
    const params = { ...validParams, topic: '' };
    const result = ExerciseGenerationParamsSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should pass with empty string for grammarGuidance', () => {
    const params = { ...validParams, grammarGuidance: '' };
    const result = ExerciseGenerationParamsSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should pass with empty string for vocabularyGuidance', () => {
    const params = { ...validParams, vocabularyGuidance: '' };
    const result = ExerciseGenerationParamsSchema.safeParse(params);
    expect(result.success).toBe(true);
  });
});
