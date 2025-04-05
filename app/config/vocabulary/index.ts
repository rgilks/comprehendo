/**
 * Vocabulary guidance based on the Cambridge English Vocabulary Profile (EVP)
 * https://www.englishprofile.org/wordlists/evp
 */

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/**
 * Provides vocabulary guidance for different CEFR levels
 */
export const vocabularyGuidance: Record<CEFRLevel, string> = {
  // A1 vocabulary guidance (beginner)
  A1: `
    Use only the most basic everyday vocabulary including:
    - Simple nouns: house, school, family, food, water, day, time, person, year, way, thing
    - Basic verbs: be, have, do, say, go, get, make, know, think, see, come, want, look, use, find, give
    - Common adjectives: good, new, first, last, long, great, little, big, small, happy, right, old, different, important
    - Basic adverbs: now, also, very, often, here, just, well, only, then, really
    - Common function words: I, you, he, she, it, we, they, my, your, the, a, an, this, these, in, on, at, for, to, of, with, and, but
    
    Use sentences with simple structures. Avoid phrasal verbs, idioms, or sophisticated vocabulary.
  `,

  // A2 vocabulary guidance (elementary)
  A2: `
    Build on A1 vocabulary, including:
    - Expanded everyday vocabulary: work, life, children, money, information, world, place, problem, hand, part, student
    - More verbs: take, help, talk, turn, start, play, move, like, work, live, feel, try, ask, need, become, leave
    - Additional adjectives: high, nice, young, interesting, easy, early, possible, sure, late, hard, special, ready, clear
    - More varied adverbs: too, always, sometimes, never, quickly, slowly, usually, together, again, still, almost, especially
    - Expanded function words and basic conjunctions: because, when, if, or, about, before, after
    
    Use mostly simple and compound sentences. Limit complex sentences. Some basic phrasal verbs are acceptable.
  `,

  // B1 vocabulary guidance (intermediate)
  B1: `Use intermediate vocabulary with some topic-specific terms. Simple phrasal verbs and some idioms are acceptable.`,

  // B2 vocabulary guidance (upper intermediate)
  B2: `Use varied vocabulary including abstract concepts and topic-specific terminology. Phrasal verbs and common idioms are fine.`,

  // C1 vocabulary guidance (advanced)
  C1: `Use sophisticated vocabulary including nuanced expressions and academic terminology. Varied phrasal verbs and idioms are appropriate.`,

  // C2 vocabulary guidance (proficiency)
  C2: `Use precise, nuanced vocabulary including specialized terminology. No restrictions on vocabulary complexity.`,
};

/**
 * Get vocabulary guidance for a specific CEFR level
 */
export function getVocabularyGuidance(level: CEFRLevel): string {
  return vocabularyGuidance[level] || '';
}
