import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { users, quiz, userLanguageProgress, questionFeedback, rateLimits } from '../db/schema.pg';

// Users
export const selectUserSchema = createSelectSchema(users);
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email({ message: 'Invalid email address' }).nullable().optional(),
  // Add any other specific refinements for insertUserSchema here
});
export type User = z.infer<typeof selectUserSchema>;
export type NewUser = z.infer<typeof insertUserSchema>;

// Quiz
export const selectQuizSchema = createSelectSchema(quiz);
export const insertQuizSchema = createInsertSchema(quiz);
export type Quiz = z.infer<typeof selectQuizSchema>;
export type NewQuiz = z.infer<typeof insertQuizSchema>;

// UserLanguageProgress
export const selectUserLanguageProgressSchema = createSelectSchema(userLanguageProgress);
export const insertUserLanguageProgressSchema = createInsertSchema(userLanguageProgress);
export type UserLanguageProgress = z.infer<typeof selectUserLanguageProgressSchema>;
export type NewUserLanguageProgress = z.infer<typeof insertUserLanguageProgressSchema>;

// QuestionFeedback
export const selectQuestionFeedbackSchema = createSelectSchema(questionFeedback);
export const insertQuestionFeedbackSchema = createInsertSchema(questionFeedback);
export type QuestionFeedback = z.infer<typeof selectQuestionFeedbackSchema>;
export type NewQuestionFeedback = z.infer<typeof insertQuestionFeedbackSchema>;

// RateLimits
export const selectRateLimitSchema = createSelectSchema(rateLimits);
export const insertRateLimitSchema = createInsertSchema(rateLimits);
export type RateLimit = z.infer<typeof selectRateLimitSchema>;
export type NewRateLimit = z.infer<typeof insertRateLimitSchema>;
