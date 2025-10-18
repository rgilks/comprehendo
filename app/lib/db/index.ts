import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';
import { initializeSchema } from './migrations';

const DB_DIR = process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'comprehendo.sqlite');

const isBuildPhase =
  process.env.NODE_ENV === 'production' && process.env['NEXT_PHASE'] === 'phase-production-build';

let db: ReturnType<typeof drizzle> | null = null;
let isInitialized = false;

const initializeDatabase = () => {
  if (db && isInitialized) {
    return db;
  }

  console.log('[DB] Starting Drizzle database initialization...');

  try {
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

    db = drizzle(sqlite, { schema });

    initializeSchema(db);

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

let initializedDbInstance: ReturnType<typeof drizzle> | null = null;

export const getDb = () => {
  if (!initializedDbInstance) {
    initializedDbInstance = initializeDatabase();
  }
  return initializedDbInstance;
};

export default getDb;
export { schema };
