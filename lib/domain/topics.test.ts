import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// import * as topicsModule from './topics'; // Removed static import
import type { CEFRTopics } from './schemas';
import type * as TopicsModuleType from './topics'; // For typing the dynamically imported module

// Mock the topics.json module
vi.mock('./topics.json', () => ({
  default: {
    A1: [
      { name: 'Daily Life', topics: ['Family', 'Routines'] },
      { name: 'Places', topics: ['Home', 'School'] },
    ],
    A2: [{ name: 'Experiences', topics: ['Travel', 'Shopping'] }],
    B1: [
      // Level with a category that has no topics
      { name: 'Life Events', topics: [] },
      { name: 'Social Issues', topics: ['Environment', 'News'] },
    ],
    C0: [
      // Level specifically for testing no topics (all categories have empty topics arrays)
      { name: 'Empty Category 1', topics: [] },
      { name: 'Empty Category 2', topics: [] },
    ],
    // No B2 level for testing missing level case
  } as CEFRTopics,
}));

describe('topics functions', () => {
  let topicsByLevelImported: CEFRTopics;
  let getTopicsForLevelImported: (level: string) => string[];
  let getRandomTopicForLevelImported: (level: string) => string;
  // Removed: let actualTopicsModule: typeof TopicsModuleType; // Not strictly needed to store if only using its exports

  beforeEach(async () => {
    // Re-import the module to get the version with mocks
    const dynamicTopicsModule: typeof TopicsModuleType = await import('./topics');
    topicsByLevelImported = dynamicTopicsModule.topicsByLevel;
    getTopicsForLevelImported = dynamicTopicsModule.getTopicsForLevel;
    getRandomTopicForLevelImported = dynamicTopicsModule.getRandomTopicForLevel;
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore Math.random
    vi.resetModules(); // Important to reset module cache for mocks
  });

  describe('topicsByLevel', () => {
    it('should load topics from the mocked json', () => {
      expect(topicsByLevelImported['A1']).toBeDefined();
      expect(topicsByLevelImported['A1'][0].name).toBe('Daily Life');
      expect(topicsByLevelImported['A1'][0].topics).toEqual(['Family', 'Routines']);
    });
  });

  describe('getTopicsForLevel', () => {
    it('should return flattened topics for a valid level A1', () => {
      const topics = getTopicsForLevelImported('A1');
      expect(topics).toEqual(['Family', 'Routines', 'Home', 'School']);
    });

    it('should return flattened topics for a valid level A2', () => {
      const topics = getTopicsForLevelImported('A2');
      expect(topics).toEqual(['Travel', 'Shopping']);
    });

    it('should handle categories with no topics for B1', () => {
      const topics = getTopicsForLevelImported('B1');
      expect(topics).toEqual(['Environment', 'News']);
    });

    it('should return an empty array for a level with categories but no topics (C0)', () => {
      const topics = getTopicsForLevelImported('C0');
      expect(topics).toEqual([]);
    });

    it('should throw an error for a level not in topicsByLevel (B2)', () => {
      // This test behavior depends on topics.json not having B2
      // If B2 was present but empty, it would return []
      expect(() => getTopicsForLevelImported('B2')).toThrow();
    });

    it('should throw an error for a completely invalid level string', () => {
      expect(() => getTopicsForLevelImported('XYZ')).toThrow();
    });
  });

  describe('getRandomTopicForLevel', () => {
    it('should return a random topic from the level A1', () => {
      const mockMath = Object.create(global.Math);
      mockMath.random = () => 0.6; // Should pick 'Home' (index 2 of 4)
      global.Math = mockMath;

      const topic = getRandomTopicForLevelImported('A1');
      expect(['Family', 'Routines', 'Home', 'School']).toContain(topic);
      expect(topic).toBe('Home');
    });

    it('should return a specific topic when Math.random is mocked (A2 - first topic)', () => {
      const mockMath = Object.create(global.Math);
      mockMath.random = () => 0; // Should pick 'Travel'
      global.Math = mockMath;
      const topic = getRandomTopicForLevelImported('A2');
      expect(topic).toBe('Travel');
    });

    it('should return a specific topic when Math.random is mocked (A2 - last topic)', () => {
      const mockMath = Object.create(global.Math);
      mockMath.random = () => 0.99; // Should pick 'Shopping'
      global.Math = mockMath;
      const topic = getRandomTopicForLevelImported('A2');
      expect(topic).toBe('Shopping');
    });

    it('should return "General knowledge" if the level C0 has no topics', () => {
      const topic = getRandomTopicForLevelImported('C0');
      expect(topic).toBe('General knowledge');
    });

    it('should throw an error if getTopicsForLevel throws (e.g. invalid level B2)', () => {
      // getRandomTopicForLevel calls getTopicsForLevel. If getTopicsForLevel throws for 'B2',
      // getRandomTopicForLevel should also throw as it doesn't catch this error.
      expect(() => getRandomTopicForLevelImported('B2')).toThrow();
    });
  });
});
