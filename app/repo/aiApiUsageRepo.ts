import db from 'app/repo/db';
import { z } from 'zod';

const _AIApiUsageRowSchema = z.object({
  id: z.number(),
  date: z.string(),
  request_count: z.number(),
  created_at: z.string(),
});

export type AIApiUsageRow = z.infer<typeof _AIApiUsageRowSchema>;

export const getTodayUsage = (): number => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const row = db.prepare('SELECT request_count FROM ai_api_usage WHERE date = ?').get(today) as
      | { request_count: number }
      | undefined;

    return row?.request_count ?? 0;
  } catch (error) {
    console.error("[AIApiUsage] Error fetching today's usage:", error);
    return 0;
  }
};

export const incrementTodayUsage = (): boolean => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const maxDailyRequests = parseInt(process.env['MAX_DAILY_AI_REQUESTS'] || '1000', 10);

    // Check current usage
    const currentUsage = getTodayUsage();
    if (currentUsage >= maxDailyRequests) {
      console.warn(`[AIApiUsage] Daily limit exceeded: ${currentUsage}/${maxDailyRequests}`);
      return false;
    }

    // Increment usage
    db.prepare(
      `
      INSERT INTO ai_api_usage (date, request_count) 
      VALUES (?, 1) 
      ON CONFLICT(date) DO UPDATE SET request_count = request_count + 1
    `
    ).run(today);

    console.log(`[AIApiUsage] Incremented daily usage: ${currentUsage + 1}/${maxDailyRequests}`);
    return true;
  } catch (error) {
    console.error('[AIApiUsage] Error incrementing usage:', error);
    return false;
  }
};

export const cleanupOldUsageRecords = (maxAgeDays: number = 30): void => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const result = db
      .prepare('DELETE FROM ai_api_usage WHERE date < ?')
      .run(cutoffDate.toISOString().split('T')[0]);

    console.log(`[AIApiUsage] Cleaned up ${result.changes} old usage records`);
  } catch (error) {
    console.error('[AIApiUsage] Error cleaning up old usage records:', error);
  }
};
