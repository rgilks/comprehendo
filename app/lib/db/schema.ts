import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    providerId: text('provider_id').notNull(),
    provider: text('provider').notNull(),
    name: text('name'),
    email: text('email'),
    image: text('image'),
    firstLogin: text('first_login').default(sql`CURRENT_TIMESTAMP`),
    lastLogin: text('last_login').default(sql`CURRENT_TIMESTAMP`),
    language: text('language').default('en'),
  },
  (table) => [
    primaryKey({ columns: [table.providerId, table.provider] }),
    index('idx_users_last_login').on(table.lastLogin),
  ]
);

export const quiz = sqliteTable(
  'quiz',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    language: text('language').notNull(),
    level: text('level').notNull(),
    content: text('content').notNull(),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    questionLanguage: text('question_language'),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [index('idx_quiz_created_at').on(table.createdAt)]
);

export const userLanguageProgress = sqliteTable(
  'user_language_progress',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    languageCode: text('language_code').notNull(),
    cefrLevel: text('cefr_level').notNull().default('A1'),
    correctStreak: integer('correct_streak').notNull().default(0),
    lastPracticed: text('last_practiced').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.languageCode] }),
    index('idx_user_language_progress_last_practiced').on(table.lastPracticed),
  ]
);

export const questionFeedback = sqliteTable(
  'question_feedback',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    quizId: integer('quiz_id')
      .notNull()
      .references(() => quiz.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isGood: integer('is_good').notNull(),
    userAnswer: text('user_answer'),
    isCorrect: integer('is_correct'),
    submittedAt: text('submitted_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_question_feedback_quiz_id').on(table.quizId),
    index('idx_question_feedback_user_id').on(table.userId),
  ]
);

export const rateLimits = sqliteTable('rate_limits', {
  ipAddress: text('ip_address').primaryKey(),
  requestCount: integer('request_count').notNull().default(1),
  windowStartTime: text('window_start_time')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const translationCache = sqliteTable(
  'translation_cache',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceWord: text('source_word').notNull(),
    sourceLanguage: text('source_language').notNull(),
    targetLanguage: text('target_language').notNull(),
    translatedText: text('translated_text').notNull(),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_translation_cache_lookup').on(
      table.sourceWord,
      table.sourceLanguage,
      table.targetLanguage
    ),
    primaryKey({ columns: [table.sourceWord, table.sourceLanguage, table.targetLanguage] }),
  ]
);

export const aiApiUsage = sqliteTable(
  'ai_api_usage',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    date: text('date').notNull().unique(),
    requestCount: integer('request_count').notNull().default(0),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_ai_api_usage_date').on(table.date)]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Quiz = typeof quiz.$inferSelect;
export type NewQuiz = typeof quiz.$inferInsert;

export type UserLanguageProgress = typeof userLanguageProgress.$inferSelect;
export type NewUserLanguageProgress = typeof userLanguageProgress.$inferInsert;

export type QuestionFeedback = typeof questionFeedback.$inferSelect;
export type NewQuestionFeedback = typeof questionFeedback.$inferInsert;

export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;

export type TranslationCache = typeof translationCache.$inferSelect;
export type NewTranslationCache = typeof translationCache.$inferInsert;

export type AiApiUsage = typeof aiApiUsage.$inferSelect;
export type NewAiApiUsage = typeof aiApiUsage.$inferInsert;
