import {
  getRateLimit,
  incrementRateLimit,
  resetRateLimit,
  createRateLimit,
} from '@/lib/repositories/rateLimitRepository';

// Constants should ideally be defined closer to where they are used or in a config file.
// For now, keep them here but remove the unused schema.
const MAX_REQUESTS_PER_HOUR = parseInt(
  process.env['RATE_LIMIT_MAX_REQUESTS_PER_HOUR'] || '100',
  10
);
const RATE_LIMIT_WINDOW = parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '3600000', 10); // 1 hour in milliseconds

export const checkRateLimit = (ip: string): boolean => {
  try {
    const now = Date.now();
    const nowISO = new Date(now).toISOString();

    console.log(`[RateLimiter] Checking rate limit for IP: ${ip}`);

    const rateLimitRow = getRateLimit(ip);

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
          incrementRateLimit(ip);
          console.log(
            `[RateLimiter] Rate limit incremented for IP: ${ip}. New Count: ${
              rateLimitRow.request_count + 1
            }`
          );
          return true;
        }
      } else {
        console.log(`[RateLimiter] Rate limit window expired for IP: ${ip}. Resetting.`);
        resetRateLimit(ip, nowISO);
        return true;
      }
    } else {
      console.log(
        `[RateLimiter] No valid rate limit record found for IP: ${ip}. Creating new record.`
      );
      createRateLimit(ip, nowISO);
      return true;
    }
  } catch (error) {
    console.error('[RateLimiter] Error checking rate limit:', error);
    // Fail safe: If there's an error (e.g., DB connection), deny the request.
    return false;
  }
};
