/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { CEFRTopics } from './schemas';
import topics from './topics.json';

export const topicsByLevel: CEFRTopics = topics;

export const getTopicsForLevel = (level: string): string[] => {
  const levelTopics = topicsByLevel[level];
  if (!levelTopics) return [];
  return levelTopics.flatMap((category) => category.topics);
};

export const getRandomTopicForLevel = (level: string): string => {
  const topics = getTopicsForLevel(level);
  if (topics.length === 0) return 'General knowledge';
  const randomIndex = Math.floor(Math.random() * topics.length);
  return topics[randomIndex];
};
