import { z } from 'zod';
import guidance from './guidance.json';

export const CEFRLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export type CEFRLevel = z.infer<typeof CEFRLevelSchema>;

export interface ComplexityMetrics {
  sentence_length: { min: number; max: number; target: number };
  vocabulary_complexity: number;
  grammar_complexity: number;
  max_syllables_per_word: number;
  max_clauses_per_sentence: number;
}

export const getVocabularyGuidance = (level: CEFRLevel): string => guidance.vocabulary[level];
export const getGrammarGuidance = (level: CEFRLevel): string => guidance.grammar[level];
export const getComplexityMetrics = (level: CEFRLevel): ComplexityMetrics =>
  guidance.complexity_metrics[level];

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const CEFR_LEVEL_INDICES: Record<CEFRLevel, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
  C2: 5,
};
