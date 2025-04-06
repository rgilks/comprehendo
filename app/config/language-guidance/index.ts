/**
 * Language guidance based on Cambridge English Profiles:
 * - Cambridge English Vocabulary Profile (EVP): https://www.englishprofile.org/wordlists/evp
 * - Cambridge English Grammar Profile (EGP): https://www.englishprofile.org/english-grammar-profile/egp-online
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
 * Provides grammar guidance for different CEFR levels based on the Cambridge English Grammar Profile
 */
export const grammarGuidance: Record<CEFRLevel, string> = {
  // A1 grammar guidance (beginner)
  A1: `
    Use only the most basic grammatical structures:
    - Simple present tense for facts, habits and routines ("I live in London")
    - Present continuous for actions happening now ("She is reading")
    - Simple imperatives ("Please sit down")
    - Basic modals: can/can't for ability ("I can swim")
    - Simple questions with be, do, and question words (what, where, when)
    - There is/are for existence ("There is a book on the table")
    - Simple connectors: and, but, or, because
    - Avoid complex tenses, passive voice, conditionals, or complex clauses
    
    Keep sentences short (5-10 words) and direct with SVO word order.
  `,

  // A2 grammar guidance (elementary)
  A2: `
    Build on A1 structures, adding:
    - Simple past tense for completed actions ("I visited Paris last year")
    - Going to future ("She's going to study tomorrow")
    - Will for simple predictions ("It will rain tomorrow")
    - Common phrasal verbs ("wake up", "turn on")
    - Comparatives and superlatives ("bigger", "the best")
    - Basic prepositions of time and place
    - Simple conditionals (first conditional: "If it rains, I'll stay home")
    - More connectors: so, then, after that
    
    Sentences can be longer (8-12 words) with occasional compound sentences using basic connectors.
  `,

  // B1 grammar guidance (intermediate)
  B1: `Use a mix of simple and more complex sentences with varied tenses. Can use present perfect, past continuous, and second conditional structures.`,

  // B2 grammar guidance (upper intermediate)
  B2: `Use complex sentence structures with subordinate clauses. Include varied tenses, passive voice, reported speech, and all conditional forms.`,

  // C1 grammar guidance (advanced)
  C1: `Use sophisticated grammar including complex conditionals, subtle tense distinctions, cleft sentences, inversion, and varied emphasis structures.`,

  // C2 grammar guidance (proficiency)
  C2: `Use all complex grammatical structures with full accuracy and subtlety, including rare constructions and sophisticated rhetorical devices.`,
};

/**
 * Get vocabulary guidance for a specific CEFR level
 */
export const getVocabularyGuidance = (level: CEFRLevel): string => {
  return vocabularyGuidance[level] || '';
};

/**
 * Get grammar guidance for a specific CEFR level
 */
export const getGrammarGuidance = (level: CEFRLevel): string => {
  return grammarGuidance[level] || '';
};
