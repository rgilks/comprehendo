import { z } from 'zod';
import { eq, lt, sql } from 'drizzle-orm';
import getDb from 'app/lib/db';
import { schema } from 'app/lib/db/adapter';

const _AIApiUsageRowSchema = z.object({
  id: z.number(),
  date: z.string(),
  requestCount: z.number(),
  createdAt: z.string(),
});

export type AIApiUsageRow = z.infer<typeof _AIApiUsageRowSchema>;

export const getTodayUsage = async (): Promise<number> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const db = await getDb();

    const result = await db
      .select({ requestCount: schema.aiApiUsage.requestCount })
      .from(schema.aiApiUsage)
      .where(eq(schema.aiApiUsage.date, today))
      .limit(1);

    return result[0]?.requestCount ?? 0;
  } catch (error) {
    console.error("[AIApiUsage] Error fetching today's usage:", error);
    return 0;
  }
};

export const incrementTodayUsage = async (): Promise<boolean> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const maxDailyRequests = parseInt(process.env['MAX_DAILY_AI_REQUESTS'] || '1000', 10);

    const currentUsage = await getTodayUsage();
    if (currentUsage >= maxDailyRequests) {
      console.warn(`[AIApiUsage] Daily limit exceeded: ${currentUsage}/${maxDailyRequests}`);
      return false;
    }

    const db = await getDb();

    await db
      .insert(schema.aiApiUsage)
      .values({
        date: today,
        requestCount: 1,
      })
      .onConflictDoUpdate({
        target: schema.aiApiUsage.date,
        set: {
          requestCount: sql`${schema.aiApiUsage.requestCount} + 1`,
        },
      });

    console.log(`[AIApiUsage] Incremented daily usage: ${currentUsage + 1}/${maxDailyRequests}`);
    return true;
  } catch (error) {
    console.error('[AIApiUsage] Error incrementing usage:', error);
    return false;
  }
};

export const cleanupOldUsageRecords = async (maxAgeDays: number = 30): Promise<void> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const db = await getDb();

    const result = await db
      .delete(schema.aiApiUsage)
      .where(lt(schema.aiApiUsage.date, cutoffDate.toISOString().split('T')[0]));

    console.log(`[AIApiUsage] Cleaned up ${result.changes} old usage records`);
  } catch (error) {
    console.error('[AIApiUsage] Error cleaning up old usage records:', error);
  }
};
