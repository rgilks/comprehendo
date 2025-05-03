import db from '@/lib/db';

const MAX_REQUESTS_PER_HOUR = 100;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

interface RateLimitRow {
  request_count: number;
  window_start_time: string; // ISO 8601 string from SQLite TIMESTAMP
}

/**
 * Checks and updates the rate limit for a given IP address.
 *
 * @param ip - The IP address to check the rate limit for.
 * @returns True if the request is allowed, false if rate limited.
 */
export const checkRateLimit = (ip: string): boolean => {
  try {
    const now = Date.now();
    const nowISO = new Date(now).toISOString();

    console.log(`[RateLimiter] Checking rate limit for IP: ${ip}`);

    const rateLimitRow = db
      .prepare('SELECT request_count, window_start_time FROM rate_limits WHERE ip_address = ?')
      .get(ip) as RateLimitRow | undefined;

    if (rateLimitRow) {
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
      console.log(`[RateLimiter] No rate limit record found for IP: ${ip}. Creating new record.`);
      db.prepare(
        'INSERT INTO rate_limits (ip_address, request_count, window_start_time) VALUES (?, 1, ?)'
      ).run(ip, nowISO);
      return true;
    }
  } catch (error) {
    console.error('[RateLimiter] Error checking rate limit:', error);
    return false;
  }
};
