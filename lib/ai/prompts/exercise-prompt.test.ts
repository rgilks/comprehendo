import { describe, it, expect } from 'vitest';
import { generateExercisePrompt } from './exercise-prompt';
import type { ExerciseGenerationParams } from './exercise-prompt';
import type { Language } from '@/lib/domain/language';
import type { CEFRLevel } from '@/lib/domain/language-guidance';

const samplePromptParams: ExerciseGenerationParams = {
  topic: 'Daily Routines',
  passageLanguage: 'fr' as Language,
  questionLanguage: 'en' as Language,
  passageLangName: 'French',
  questionLangName: 'English',
  level: 'A2' as CEFRLevel,
  grammarGuidance: 'Present tense verbs',
  vocabularyGuidance: 'Words related to daily activities',
};

describe('generateExercisePrompt', () => {
  it('should generate the correct prompt string based on parameters', () => {
    const prompt = generateExercisePrompt(samplePromptParams);
    expect(prompt).toContain('- Topic: Daily Routines');
    expect(prompt).toContain('- Passage Language: French (fr)');
    expect(prompt).toContain('- Question Language: English (en)');
    expect(prompt).toContain('- CEFR Level: A2');
    expect(prompt).toContain('- Grammar Guidance: Present tense verbs');
    expect(prompt).toContain('- Vocabulary Guidance: Words related to daily activities');
    expect(prompt).toContain('Output Format: Respond ONLY with a valid JSON object');
    expect(prompt).toContain('Instructions:');
    expect(prompt).toContain('Example JSON structure:');
    expect(prompt).toContain('Ensure the entire output is a single, valid JSON object');
    expect(prompt).toContain('CRITICAL REQUIREMENT');
  });

  it('should correctly interpolate all parameters', () => {
    const params: ExerciseGenerationParams = {
      topic: 'Leisure Activities',
      passageLanguage: 'es' as Language,
      questionLanguage: 'de' as Language,
      passageLangName: 'Spanish',
      questionLangName: 'German',
      level: 'B1' as CEFRLevel,
      grammarGuidance: 'Past tense',
      vocabularyGuidance: 'Hobbies',
    };
    const prompt = generateExercisePrompt(params);

    expect(prompt).toContain('- Topic: Leisure Activities');
    expect(prompt).toContain('- Passage Language: Spanish (es)');
    expect(prompt).toContain('- Question Language: German (de)');
    expect(prompt).toContain('- CEFR Level: B1');
    expect(prompt).toContain('- Grammar Guidance: Past tense');
    expect(prompt).toContain('- Vocabulary Guidance: Hobbies');
    expect(prompt).toContain(
      'Create a short paragraph (3-6 sentences) in es suitable for a B1 learner'
    );
    expect(prompt).toContain('Write ONE multiple-choice question in de');
    expect(prompt).toContain('Provide four answer options (A, B, C, D) in de');
    expect(prompt).toContain(
      'Provide **concise explanations** (in de) for **ALL options (A, B, C, D)**'
    );
    expect(prompt).toContain(
      'Extract the specific sentence or phrase from the original paragraph (in es)'
    );
    expect(prompt).toContain('"paragraph": (string) The generated paragraph in es');
    expect(prompt).toContain('"question": (string) The multiple-choice question in de');
    expect(prompt).toContain(
      '"options": (object) An object with keys "A", "B", "C", "D", where each value is an answer option string in de'
    );
    expect(prompt).toContain(
      '"allExplanations": (object) An object with keys "A", "B", "C", "D", where each value is the concise explanation string in de'
    );
    expect(prompt).toContain(
      '"relevantText": (string) The sentence or phrase from the paragraph in es'
    );
  });
});
