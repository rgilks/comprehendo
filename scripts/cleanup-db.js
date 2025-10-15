#!/usr/bin/env node

/**
 * Database cleanup utility for Comprehendo
 *
 * This script cleans up old data to prevent database bloat:
 * - Old rate limit entries (older than 24 hours)
 * - Old translation cache entries (older than 30 days)
 * - Old AI API usage records (older than 30 days)
 *
 * Run this script periodically (e.g., via cron job) to maintain database health.
 *
 * Usage:
 *   node scripts/cleanup-db.js
 *   node scripts/cleanup-db.js --dry-run
 */

import { cleanupOldRateLimits } from '../app/repo/rateLimitRepo.ts';
import { cleanupOldTranslations } from '../app/repo/translationCacheRepo.ts';
import { cleanupOldUsageRecords } from '../app/repo/aiApiUsageRepo.ts';

const isDryRun = process.argv.includes('--dry-run');

console.log(`[Cleanup] Starting database cleanup${isDryRun ? ' (DRY RUN)' : ''}...`);

if (isDryRun) {
  console.log('[Cleanup] DRY RUN MODE - No changes will be made');
  console.log('[Cleanup] Would clean up:');
  console.log('  - Rate limit entries older than 24 hours');
  console.log('  - Translation cache entries older than 30 days');
  console.log('  - AI API usage records older than 30 days');
} else {
  try {
    // Clean up old rate limits (24 hours)
    cleanupOldRateLimits(24);

    // Clean up old translations (30 days)
    cleanupOldTranslations(30);

    // Clean up old AI usage records (30 days)
    cleanupOldUsageRecords(30);

    console.log('[Cleanup] Database cleanup completed successfully');
  } catch (error) {
    console.error('[Cleanup] Error during cleanup:', error);
    process.exit(1);
  }
}
