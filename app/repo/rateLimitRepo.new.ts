import { z } from 'zod';
import { eq, lt } from 'drizzle-orm';
import getDb, { schema } from 'app/lib/db';

const RateLimitRowSchema = z.object({
  requestCount: z.number().int().positive(),
  windowStartTime: z.string(),
});

export type RateLimit = z.infer<typeof RateLimitRowSchema>;

export const getRateLimit = async (ip: string): Promise<RateLimit | null> => {
  try {
    const db = await getDb();

    const result = await db
      .select({
        requestCount: schema.rateLimits.requestCount,
        windowStartTime: schema.rateLimits.windowStartTime,
      })
      .from(schema.rateLimits)
      .where(eq(schema.rateLimits.ipAddress, ip))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const parseResult = RateLimitRowSchema.safeParse(result[0]);

    if (parseResult.success) {
      return parseResult.data;
    } else {
      console.warn(
        `[RateLimitRepository] Invalid rate limit data found for IP ${ip}:`,
        parseResult.error.issues
      );
      return null;
    }
  } catch (dbError) {
    console.error(`[RateLimitRepository] Error fetching rate limit for IP ${ip}:`, dbError);
    throw dbError;
  }
};

export const incrementRateLimit = async (ip: string): Promise<void> => {
  try {
    const db = await getDb();

    const result = await db
      .update(schema.rateLimits)
      .set({ requestCount: sql`${schema.rateLimits.requestCount} + 1` })
      .where(eq(schema.rateLimits.ipAddress, ip));

    if (result.changes === 0) {
      console.warn(
        `[RateLimitRepository] Increment failed: No rate limit record found for IP ${ip}.`
      );
    }
  } catch (dbError) {
    console.error(`[RateLimitRepository] Error incrementing rate limit for IP ${ip}:`, dbError);
    throw dbError;
  }
};

export const resetRateLimit = async (ip: string, windowStartTimeISO: string): Promise<void> => {
  try {
    const db = await getDb();

    const result = await db
      .update(schema.rateLimits)
      .set({
        requestCount: 1,
        windowStartTime: windowStartTimeISO,
      })
      .where(eq(schema.rateLimits.ipAddress, ip));

    if (result.changes === 0) {
      console.warn(`[RateLimitRepository] Reset failed: No rate limit record found for IP ${ip}.`);
    }
  } catch (dbError) {
    console.error(`[RateLimitRepository] Error resetting rate limit for IP ${ip}:`, dbError);
    throw dbError;
  }
};

export const createRateLimit = async (ip: string, windowStartTimeISO: string): Promise<void> => {
  try {
    const db = await getDb();

    await db.insert(schema.rateLimits).values({
      ipAddress: ip,
      requestCount: 1,
      windowStartTime: windowStartTimeISO,
    });
  } catch (dbError) {
    if (
      dbError instanceof Error &&
      dbError.message.includes('UNIQUE constraint failed: rate_limits.ip_address')
    ) {
      console.warn(
        `[RateLimitRepository] Race condition: Rate limit record for IP ${ip} already exists. Assuming creation succeeded elsewhere.`
      );
    } else {
      console.error(`[RateLimitRepository] Error creating rate limit for IP ${ip}:`, dbError);
      throw dbError;
    }
  }
};

export const cleanupOldRateLimits = async (maxAgeHours: number = 24): Promise<void> => {
  try {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

    const db = await getDb();

    const result = await db
      .delete(schema.rateLimits)
      .where(lt(schema.rateLimits.windowStartTime, cutoffTime.toISOString()));

    console.log(`[RateLimitRepository] Cleaned up ${result.changes} old rate limit entries`);
  } catch (error) {
    console.error('[RateLimitRepository] Error cleaning up old rate limits:', error);
  }
};
