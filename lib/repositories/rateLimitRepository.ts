import db from '@/lib/db';
import { z } from 'zod';

// Schema for validating data fetched from the database
const RateLimitRowSchema = z.object({
  request_count: z.number().int().positive(),
  window_start_time: z.string(), // ISO 8601 string from DB
});

// Type representing the validated rate limit data
export type RateLimit = z.infer<typeof RateLimitRowSchema>;

/**
 * Fetches and validates the current rate limit status for a given IP address.
 * Returns the validated rate limit data or null if not found or invalid.
 * Throws an error if the database query fails.
 */
export const getRateLimit = (ip: string): RateLimit | null => {
  try {
    const row = db
      .prepare('SELECT request_count, window_start_time FROM rate_limits WHERE ip_address = ?')
      .get(ip);

    if (!row) {
      return null; // No record found
    }

    // Validate the fetched data
    const parseResult = RateLimitRowSchema.safeParse(row);

    if (parseResult.success) {
      return parseResult.data;
    } else {
      // Log invalid data found in the DB
      console.warn(
        `[RateLimitRepository] Invalid rate limit data found for IP ${ip}:`,
        parseResult.error.errors
      );
      return null; // Treat invalid data as non-existent for rate limiting purposes
    }
  } catch (dbError) {
    console.error(`[RateLimitRepository] Error fetching rate limit for IP ${ip}:`, dbError);
    throw dbError; // Rethrow the DB error to be handled by the caller (e.g., checkRateLimit)
  }
};

/**
 * Increments the request count for a given IP address.
 * Assumes the record already exists and is within the rate limit window.
 * Throws an error if the database update fails.
 */
export const incrementRateLimit = (ip: string): void => {
  try {
    const result = db
      .prepare('UPDATE rate_limits SET request_count = request_count + 1 WHERE ip_address = ?')
      .run(ip);

    if (result.changes === 0) {
      // This shouldn't ideally happen if called correctly after getRateLimit confirms existence
      console.warn(
        `[RateLimitRepository] Increment failed: No rate limit record found for IP ${ip}.`
      );
      // Consider if this case requires creating the record instead, though checkRateLimit handles creation.
    }
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
export const resetRateLimit = (ip: string, windowStartTimeISO: string): void => {
  try {
    const result = db
      .prepare(
        'UPDATE rate_limits SET request_count = 1, window_start_time = ? WHERE ip_address = ?'
      )
      .run(windowStartTimeISO, ip);

    if (result.changes === 0) {
      // This might happen if the record was deleted between check and reset
      console.warn(`[RateLimitRepository] Reset failed: No rate limit record found for IP ${ip}.`);
      // Consider creating the record here as a fallback, similar to createRateLimit.
      // For now, we rely on the subsequent checkRateLimit call to create it if necessary.
    }
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
export const createRateLimit = (ip: string, windowStartTimeISO: string): void => {
  try {
    db.prepare(
      'INSERT INTO rate_limits (ip_address, request_count, window_start_time) VALUES (?, 1, ?)'
    ).run(ip, windowStartTimeISO);
  } catch (dbError) {
    // Handle potential unique constraint violation if a race condition occurs
    if (
      dbError instanceof Error &&
      dbError.message.includes('UNIQUE constraint failed: rate_limits.ip_address')
    ) {
      console.warn(
        `[RateLimitRepository] Race condition: Rate limit record for IP ${ip} already exists. Assuming creation succeeded elsewhere.`
      );
      // In this specific case, we can potentially ignore the error, as the record exists.
      // The next call to checkRateLimit will handle the existing record.
    } else {
      console.error(`[RateLimitRepository] Error creating rate limit for IP ${ip}:`, dbError);
      throw dbError; // Rethrow other DB errors
    }
  }
};
