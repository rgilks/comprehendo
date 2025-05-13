import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './db/schema';

const DB_DIR = process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'comprehendo.sqlite');

const isBuildPhase =
  process.env.NODE_ENV === 'production' && process.env['NEXT_PHASE'] === 'phase-production-build';

let betterSqliteInstance: Database.Database | null = null;
let drizzleDbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

const initializeDrizzle = (): ReturnType<typeof drizzle<typeof schema>> => {
  if (drizzleDbInstance) {
    return drizzleDbInstance;
  }

  console.log('[DB] Initializing Drizzle ORM...');

  try {
    if (isBuildPhase || !fs.existsSync(process.cwd())) {
      betterSqliteInstance = new Database(':memory:');
      console.log('[DB] Using in-memory database for build phase with Drizzle');
    } else {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
        console.log(`[DB] Created database directory at ${DB_DIR}`);
      }
      betterSqliteInstance = new Database(DB_PATH);
      console.log(`[DB] Connected to database at ${DB_PATH} for Drizzle`);
    }

    betterSqliteInstance.pragma('foreign_keys = ON');
    console.log('[DB] Enabled foreign key constraints for Drizzle');
    betterSqliteInstance.pragma('journal_mode = WAL');
    console.log('[DB] Set journal mode to WAL for Drizzle');

    drizzleDbInstance = drizzle(betterSqliteInstance, {
      schema,
      logger: process.env.NODE_ENV !== 'production',
    });

    console.log('[DB] Drizzle ORM initialized successfully.');
    return drizzleDbInstance;
  } catch (error) {
    console.error('Error initializing Drizzle ORM:', error);
    if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
      console.warn('[DB] CRITICAL: Falling back to in-memory database for Drizzle due to error!');
      betterSqliteInstance = new Database(':memory:');
      // We still need to initialize drizzle with the in-memory DB
      drizzleDbInstance = drizzle(betterSqliteInstance, { schema, logger: true });
      return drizzleDbInstance;
    }
    throw error;
  }
};

const db = initializeDrizzle();
export default db;
