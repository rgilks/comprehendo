import db from '@/lib/drizzle-db';
import { rateLimits } from '@/lib/db/schema'; // Corrected to use actual export name
import { eq, sql } from 'drizzle-orm'; // Added sql import
import { type RateLimit, selectRateLimitSchema } from '@/lib/domain/schema'; // Zod schema and TS type

// RateLimitRowSchema is removed.

/**
 * Fetches and validates the current rate limit status for a given IP address.
 * Returns the validated rate limit data or null if not found.
 * Throws an error if the database query fails.
 */
export const getRateLimit = async (ip: string): Promise<RateLimit | null> => {
  try {
    const result = await db.select().from(rateLimits).where(eq(rateLimits.ipAddress, ip)).limit(1);

    if (result.length === 0) {
      return null;
    }
    // Drizzle's output for SQLite with { mode: 'timestamp' } might be numbers or strings.
    // selectRateLimitSchema expects Date for windowStartTime (from pg schema version).
    // This needs careful handling if the SQLite schema is primary here.
    // For now, assuming the structure from db/schema.ts (SQLite) will be compatible
    // or that selectRateLimitSchema (derived from pg) is the desired target shape.
    // A proper parse/validation step would be safer if types diverge significantly.
    const validatedData = selectRateLimitSchema.safeParse(result[0]);
    if (validatedData.success) {
      return validatedData.data;
    }
    console.warn(
      `[RateLimitRepository] Data for IP ${ip} from DB did not match target RateLimit schema:`,
      validatedData.error.format()
    );
    return null;
  } catch (dbError) {
    console.error(`[RateLimitRepository] Error fetching rate limit for IP ${ip}:`, dbError);
    throw dbError;
  }
};

/**
 * Increments the request count for a given IP address.
 * Assumes the record already exists and is within the rate limit window.
 * Throws an error if the database update fails.
 */
export const incrementRateLimit = async (ip: string): Promise<void> => {
  try {
    await db
      .update(rateLimits)
      .set({ requestCount: sql`${rateLimits.requestCount} + 1` })
      .where(eq(rateLimits.ipAddress, ip));
  } catch (dbError) {
    console.error(`[RateLimitRepository] Error incrementing rate limit for IP ${ip}:`, dbError);
    throw dbError;
  }
};

/**
 * Resets the request count to 1 and updates the window start time for a given IP address.
 * Used when the rate limit window has expired.
 * Throws an error if the database update fails.
 */
export const resetRateLimit = async (ip: string, windowStartTime: Date): Promise<void> => {
  try {
    // SQLite stores dates as numbers/strings. Drizzle handles conversion if schema matches.
    // The `windowStartTime` param is a Date, matching selectRateLimitSchema.
    await db
      .update(rateLimits)
      .set({ requestCount: 1, windowStartTime: windowStartTime })
      .where(eq(rateLimits.ipAddress, ip));
  } catch (dbError) {
    console.error(`[RateLimitRepository] Error resetting rate limit for IP ${ip}:`, dbError);
    throw dbError;
  }
};

/**
 * Creates a new rate limit record for a given IP address with a request count of 1.
 * Used when no existing valid record is found.
 * Throws an error if the database insert fails.
 */
export const createRateLimit = async (ip: string, windowStartTime: Date): Promise<void> => {
  try {
    await db.insert(rateLimits).values({
      ipAddress: ip,
      requestCount: 1,
      windowStartTime: windowStartTime, // Date object, Drizzle should handle for SQLite
    });
  } catch (dbError) {
    if (
      dbError instanceof Error &&
      dbError.message.toLowerCase().includes('unique constraint failed')
    ) {
      console.warn(
        `[RateLimitRepository] Race condition or existing: Rate limit record for IP ${ip} already exists.`
      );
    } else {
      console.error(`[RateLimitRepository] Error creating rate limit for IP ${ip}:`, dbError);
      throw dbError;
    }
  }
};
