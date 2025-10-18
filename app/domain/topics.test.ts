import { describe, it, expect, vi } from 'vitest';
import { getTopicsForLevel, getRandomTopicForLevel } from 'app/domain/topics';

// Mock the topics data
vi.mock('app/domain/topics.json', () => ({
  default: {
    A1: [
      { category: 'Basic', topics: ['Family', 'Colors', 'Numbers'] },
      { category: 'Daily Life', topics: ['Food', 'Clothing'] },
    ],
    A2: [{ category: 'Intermediate', topics: ['Travel', 'Weather'] }],
    B1: [{ category: 'Advanced', topics: ['Technology', 'Environment'] }],
  },
}));

describe('topics', () => {
  describe('getTopicsForLevel', () => {
    it('should return flattened topics for A1 level', () => {
      const topics = getTopicsForLevel('A1');

      expect(topics).toEqual(['Family', 'Colors', 'Numbers', 'Food', 'Clothing']);
    });

    it('should return flattened topics for A2 level', () => {
      const topics = getTopicsForLevel('A2');

      expect(topics).toEqual(['Travel', 'Weather']);
    });

    it('should return flattened topics for B1 level', () => {
      const topics = getTopicsForLevel('B1');

      expect(topics).toEqual(['Technology', 'Environment']);
    });

    it('should return empty array for unknown level', () => {
      const topics = getTopicsForLevel('Unknown');

      expect(topics).toEqual([]);
    });
  });

  describe('getRandomTopicForLevel', () => {
    it('should return a random topic from the level', () => {
      const topic = getRandomTopicForLevel('A1');

      expect(['Family', 'Colors', 'Numbers', 'Food', 'Clothing']).toContain(topic);
    });

    it('should return different topics on multiple calls', () => {
      const topics = new Set();

      // Call multiple times to increase chance of getting different topics
      for (let i = 0; i < 20; i++) {
        topics.add(getRandomTopicForLevel('A1'));
      }

      // Should have multiple different topics (not guaranteed but very likely)
      expect(topics.size).toBeGreaterThan(1);
    });

    it('should return "General knowledge" for level with no topics', () => {
      const topic = getRandomTopicForLevel('Unknown');

      expect(topic).toBe('General knowledge');
    });
  });
});
