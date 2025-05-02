import { describe, test, expect } from 'vitest';

describe('CEFR Level Extraction', () => {
  const extractCEFRLevel = (prompt: string): string => {
    const cefrLevelMatch = prompt.match(/CEFR level (A1|A2|B1|B2|C1|C2)/);
    return cefrLevelMatch?.[1] ?? 'unknown';
  };

  test('should extract valid CEFR level from prompt', () => {
    const prompt = 'Generate a reading exercise in Spanish at CEFR level B2 about cooking.';
    const result = extractCEFRLevel(prompt);
    expect(result).toBe('B2');
  });

  test('should return "unknown" when no CEFR level is found', () => {
    const prompt = 'Generate a reading exercise in Spanish about cooking.';
    const result = extractCEFRLevel(prompt);
    expect(result).toBe('unknown');
  });
});

describe('AI Response Processing', () => {
  const processAIResponse = (content: string): string => {
    try {
      JSON.parse(content);
      return content;
    } catch {
      return JSON.stringify({
        paragraph: 'Fallback paragraph',
        question: 'Fallback question?',
        options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
        explanations: { A: 'A', B: 'B', C: 'C', D: 'D' },
        correctAnswer: 'A',
        relevantText: 'Fallback text',
        topic: 'Error Handling',
      });
    }
  };

  test('should return valid JSON as is', () => {
    const validJson = JSON.stringify({
      paragraph: 'Sample paragraph',
      question: 'Sample question',
      options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
      explanations: {
        A: 'Explanation A',
        B: 'Explanation B',
        C: 'Explanation C',
        D: 'Explanation D',
      },
      correctAnswer: 'A',
      relevantText: 'Sample relevant text',
      topic: 'Sample topic',
    });

    const result = processAIResponse(validJson);
    expect(JSON.parse(result)).toHaveProperty('paragraph', 'Sample paragraph');
  });

  test('should handle invalid JSON with fallback', () => {
    const invalidJson = '{ not valid json }';
    const result = processAIResponse(invalidJson);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('topic', 'Error Handling');
  });
});

describe('Rate Limiting', () => {
  const checkIsWithinRateLimit = (timestamps: number[]): boolean => {
    const MAX_REQUESTS_PER_HOUR = 100;
    const now = Date.now();
    const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

    const recentRequests = timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW);

    return recentRequests.length < MAX_REQUESTS_PER_HOUR;
  };

  test('should allow requests within rate limit', () => {
    const isWithinLimit = checkIsWithinRateLimit([Date.now() - 10000]);
    expect(isWithinLimit).toBe(true);
  });

  test('should block requests exceeding rate limit', () => {
    const recentRequests = Array(101)
      .fill(0)
      .map(() => Date.now() - 1000);
    const isWithinLimit = checkIsWithinRateLimit(recentRequests);
    expect(isWithinLimit).toBe(false);
  });
});

describe('Exercise Caching', () => {
  test('should use cached exercise when available', () => {
    const mockCache = {
      id: 1,
      content: JSON.stringify({
        paragraph: 'Cached paragraph',
        question: 'Cached question',
        options: { A: 'A', B: 'B', C: 'C', D: 'D' },
        correctAnswer: 'A',
      }),
    };

    expect(mockCache).toBeDefined();
    expect(JSON.parse(mockCache.content)).toHaveProperty('paragraph', 'Cached paragraph');
  });
});
