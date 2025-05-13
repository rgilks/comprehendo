import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    providerId: text('provider_id').notNull(),
    provider: text('provider').notNull(),
    name: text('name'),
    email: text('email'),
    image: text('image'),
    firstLogin: integer('first_login', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    lastLogin: integer('last_login', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    language: text('language').default('en'),
  },
  (table) => ({
    providerUniqueConstraint: uniqueIndex('sqlite_autoindex_users_1').on(
      table.providerId,
      table.provider
    ),
    lastLoginIdx: index('idx_users_last_login').on(table.lastLogin),
  })
);

export const quiz = sqliteTable(
  'quiz',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    language: text('language').notNull(),
    level: text('level').notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    questionLanguage: text('question_language'),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    createdAtIdx: index('idx_quiz_created_at').on(table.createdAt),
  })
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
    lastPracticed: integer('last_practiced', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.languageCode] }),
    lastPracticedIdx: index('idx_user_language_progress_last_practiced').on(table.lastPracticed),
  })
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
    submittedAt: integer('submitted_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    quizIdIdx: index('idx_question_feedback_quiz_id').on(table.quizId),
    userIdIdx: index('idx_question_feedback_user_id').on(table.userId),
  })
);

export const rateLimits = sqliteTable('rate_limits', {
  ipAddress: text('ip_address').primaryKey(),
  requestCount: integer('request_count').notNull().default(1),
  windowStartTime: integer('window_start_time', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// Note: The unique constraint on users(provider_id, provider) was named 'sqlite_autoindex_users_1'
// This is often an auto-generated name by SQLite. Drizzle allows specifying a custom name.
// If you have a specific name you prefer for this constraint, you can change it in the users table definition.

// The sql import is needed for CURRENT_TIMESTAMP default values
import { sql } from 'drizzle-orm';
