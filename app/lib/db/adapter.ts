import { drizzle } from 'drizzle-orm/d1';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';
import { initializeSchema } from './migrations';
import { initializeSchema as initializeD1Schema } from './d1-migrations';

const DB_DIR = process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'comprehendo.sqlite');

const isBuildPhase =
  process.env.NODE_ENV === 'production' && process.env['NEXT_PHASE'] === 'phase-production-build';

export type DatabaseInstance = ReturnType<typeof drizzle> | ReturnType<typeof drizzleSqlite>;

let db: DatabaseInstance | null = null;
let isInitialized = false;

const initializeDatabase = (d1Database?: unknown): DatabaseInstance => {
  if (db && isInitialized) {
    return db;
  }

  console.log('[DB] Starting Drizzle database initialization...');

  try {
    if (d1Database) {
      console.log('[DB] Using Cloudflare D1 database');
      db = drizzle(d1Database as Parameters<typeof drizzle>[0], { schema });
      initializeD1Schema(db);
    } else {
      console.log('[DB] Using SQLite database');
      let sqlite;

      if (isBuildPhase || !fs.existsSync(process.cwd())) {
        sqlite = new Database(':memory:');
        console.log('[DB] Using in-memory database for build phase');
      } else {
        if (!fs.existsSync(DB_DIR)) {
          fs.mkdirSync(DB_DIR, { recursive: true });
          console.log(`[DB] Created database directory at ${DB_DIR}`);
        }
        sqlite = new Database(DB_PATH);
        console.log(`[DB] Connected to database at ${DB_PATH}`);
      }

      db = drizzleSqlite(sqlite, { schema });
      initializeSchema(db);
    }

    console.log('[DB] Drizzle database initialized successfully.');
    isInitialized = true;
    return db;
  } catch (error) {
    console.error('Error creating Drizzle database:', error);
    if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
      console.error('[DB] CRITICAL: Database initialization failed in production!');
      throw new Error(
        `Database initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    throw error;
  }
};

let initializedDbInstance: DatabaseInstance | null = null;

export const getDb = (d1Database?: unknown): DatabaseInstance => {
  if (!initializedDbInstance) {
    initializedDbInstance = initializeDatabase(d1Database);
  }
  return initializedDbInstance;
};

export default getDb;
export { schema };
