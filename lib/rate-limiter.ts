import db from '@/lib/db';
import { z } from 'zod';

const MAX_REQUESTS_PER_HOUR = parseInt(
  process.env['RATE_LIMIT_MAX_REQUESTS_PER_HOUR'] || '100',
  10
);
const RATE_LIMIT_WINDOW = parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '3600000', 10); // 1 hour in milliseconds

const RateLimitRowSchema = z.object({
  request_count: z.number().int().positive(),
  window_start_time: z.string(), // ISO 8601 string
});

export const checkRateLimit = (ip: string): boolean => {
  try {
    const now = Date.now();
    const nowISO = new Date(now).toISOString();

    console.log(`[RateLimiter] Checking rate limit for IP: ${ip}`);

    const row = db
      .prepare('SELECT request_count, window_start_time FROM rate_limits WHERE ip_address = ?')
      .get(ip);

    // Validate the structure of the row fetched from the database
    const parseResult = RateLimitRowSchema.safeParse(row);

    if (parseResult.success) {
      const rateLimitRow = parseResult.data;
      const windowStartTime = new Date(rateLimitRow.window_start_time).getTime();
      const isWithinWindow = now - windowStartTime < RATE_LIMIT_WINDOW;

      if (isWithinWindow) {
        if (rateLimitRow.request_count >= MAX_REQUESTS_PER_HOUR) {
          console.log(
            `[RateLimiter] Rate limit exceeded for IP: ${ip}. Count: ${rateLimitRow.request_count}, Window Start: ${rateLimitRow.window_start_time}`
          );
          return false;
        } else {
          db.prepare(
            'UPDATE rate_limits SET request_count = request_count + 1 WHERE ip_address = ?'
          ).run(ip);
          console.log(
            `[RateLimiter] Rate limit incremented for IP: ${ip}. New Count: ${
              rateLimitRow.request_count + 1
            }`
          );
          return true;
        }
      } else {
        console.log(`[RateLimiter] Rate limit window expired for IP: ${ip}. Resetting.`);
        db.prepare(
          'UPDATE rate_limits SET request_count = 1, window_start_time = ? WHERE ip_address = ?'
        ).run(nowISO, ip);
        return true;
      }
    } else {
      // Handle case where row is undefined or doesn't match schema (treat as new entry)
      if (row !== undefined) {
        // Log if the structure was invalid but a row existed
        console.warn(
          '[RateLimiter] Invalid rate limit data found for IP:',
          ip,
          parseResult.error.errors
        );
      }
      console.log(
        `[RateLimiter] No valid rate limit record found for IP: ${ip}. Creating new record.`
      );
      db.prepare(
        'INSERT INTO rate_limits (ip_address, request_count, window_start_time) VALUES (?, 1, ?)'
      ).run(ip, nowISO);
      return true;
    }
  } catch (error) {
    console.error('[RateLimiter] Error checking rate limit:', error);
    // Fail safe: If there's an error (e.g., DB connection), deny the request.
    return false;
  }
};
