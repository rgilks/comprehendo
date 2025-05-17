import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  primaryKey,
  index,
  unique,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    providerId: text('provider_id').notNull(),
    provider: text('provider').notNull(),
    name: text('name'),
    email: text('email'),
    image: text('image'),
    firstLogin: timestamp('first_login').defaultNow(),
    lastLogin: timestamp('last_login').defaultNow(),
    language: text('language').default('en'),
  },
  (table) => [
    unique('users_provider_id_provider_unique').on(table.providerId, table.provider),
    index('idx_users_last_login').on(table.lastLogin),
  ]
);

export const quiz = pgTable(
  'quiz',
  {
    id: serial('id').primaryKey(),
    language: text('language').notNull(),
    level: text('level').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    questionLanguage: text('question_language'),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [index('idx_quiz_created_at').on(table.createdAt)]
);

export const userLanguageProgress = pgTable(
  'user_language_progress',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    languageCode: text('language_code').notNull(),
    cefrLevel: text('cefr_level').notNull().default('A1'),
    correctStreak: integer('correct_streak').notNull().default(0),
    lastPracticed: timestamp('last_practiced').defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.languageCode] }),
    index('idx_user_language_progress_last_practiced').on(table.lastPracticed),
  ]
);

export const questionFeedback = pgTable(
  'question_feedback',
  {
    id: serial('id').primaryKey(),
    quizId: integer('quiz_id')
      .notNull()
      .references(() => quiz.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isGood: boolean('is_good').notNull(),
    userAnswer: text('user_answer'),
    isCorrect: boolean('is_correct'),
    submittedAt: timestamp('submitted_at').defaultNow(),
  },
  (table) => [
    index('idx_question_feedback_quiz_id').on(table.quizId),
    index('idx_question_feedback_user_id').on(table.userId),
  ]
);

export const rateLimits = pgTable('rate_limits', {
  ipAddress: text('ip_address').primaryKey(),
  requestCount: integer('request_count').notNull().default(1),
  windowStartTime: timestamp('window_start_time').notNull().defaultNow(),
});
