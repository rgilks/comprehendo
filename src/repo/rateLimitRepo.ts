import db from '@/lib/db';
import { z } from 'zod';

const RateLimitRowSchema = z.object({
  request_count: z.number().int().positive(),
  window_start_time: z.string(),
});

export type RateLimit = z.infer<typeof RateLimitRowSchema>;

export const getRateLimit = (ip: string): RateLimit | null => {
  try {
    const row = db
      .prepare('SELECT request_count, window_start_time FROM rate_limits WHERE ip_address = ?')
      .get(ip);

    if (!row) {
      return null;
    }

    const parseResult = RateLimitRowSchema.safeParse(row);

    if (parseResult.success) {
      return parseResult.data;
    } else {
      console.warn(
        `[RateLimitRepository] Invalid rate limit data found for IP ${ip}:`,
        parseResult.error.errors
      );
      return null;
    }
  } catch (dbError) {
    console.error(`[RateLimitRepository] Error fetching rate limit for IP ${ip}:`, dbError);
    throw dbError;
  }
};

export const incrementRateLimit = (ip: string): void => {
  try {
    const result = db
      .prepare('UPDATE rate_limits SET request_count = request_count + 1 WHERE ip_address = ?')
      .run(ip);

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

export const resetRateLimit = (ip: string, windowStartTimeISO: string): void => {
  try {
    const result = db
      .prepare(
        'UPDATE rate_limits SET request_count = 1, window_start_time = ? WHERE ip_address = ?'
      )
      .run(windowStartTimeISO, ip);

    if (result.changes === 0) {
      console.warn(`[RateLimitRepository] Reset failed: No rate limit record found for IP ${ip}.`);
    }
  } catch (dbError) {
    console.error(`[RateLimitRepository] Error resetting rate limit for IP ${ip}:`, dbError);
    throw dbError;
  }
};

export const createRateLimit = (ip: string, windowStartTimeISO: string): void => {
  try {
    db.prepare(
      'INSERT INTO rate_limits (ip_address, request_count, window_start_time) VALUES (?, 1, ?)'
    ).run(ip, windowStartTimeISO);
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
