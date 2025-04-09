import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// --- Configuration ---
const DB_DIR = process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'comprehendo.sqlite');

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

const isBuildPhase =
  process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

// --- Singleton Instance Holder ---
let dbInstance: Database.Database | null = null;
let dbProxyInstance: Database.Database | null = null;
let isInitialized = false;

// --- Initialization Function ---
function initializeDatabase(): Database.Database {
  if (dbInstance && dbProxyInstance && isInitialized) {
    // Return the existing proxied instance if already initialized
    return dbProxyInstance;
  }

  console.log('[DB] Starting database initialization...');

  try {
    // Determine if we should use memory or file
    if (isBuildPhase || !fs.existsSync(process.cwd())) {
      dbInstance = new Database(':memory:');
      console.log('[DB] Using in-memory database for build phase');
    } else {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
        console.log(`[DB] Created database directory at ${DB_DIR}`);
      }
      dbInstance = new Database(DB_PATH);
      console.log(`[DB] Connected to database at ${DB_PATH}`);
    }

    dbInstance.pragma('foreign_keys = ON');
    console.log('[DB] Enabled foreign key constraints');

    console.log('[DB] Initializing/verifying database schema...');
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS generated_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language TEXT NOT NULL,
        level TEXT NOT NULL,
        content TEXT NOT NULL,
        questions TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        question_language TEXT,
        seed_value INTEGER,
        user_id INTEGER -- Removed FK here for ALTER TABLE compatibility
      );
      
      CREATE TABLE IF NOT EXISTS usage_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT,
        language TEXT NOT NULL,
        level TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        name TEXT,
        email TEXT,
        image TEXT,
        first_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider_id, provider)
      );
      
      CREATE TABLE IF NOT EXISTS user_language_progress (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        language_code TEXT NOT NULL,
        cefr_level TEXT NOT NULL DEFAULT 'A1',
        correct_streak INTEGER NOT NULL DEFAULT 0,
        last_practiced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, language_code)
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_generated_content_created_at ON generated_content(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_usage_stats_timestamp ON usage_stats(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);
      CREATE INDEX IF NOT EXISTS idx_user_language_progress_last_practiced ON user_language_progress(last_practiced DESC);
    `);

    // --- Column Migration/Cleanup (Only run once per instance) ---
    // Add user_id to usage_stats if it doesn't exist
    const usageStatsColumns = dbInstance
      .prepare('PRAGMA table_info(usage_stats)')
      .all() as ColumnInfo[];
    if (!usageStatsColumns.some((column) => column.name === 'user_id')) {
      console.log('[DB] Adding user_id column to usage_stats table');
      dbInstance.exec(
        `ALTER TABLE usage_stats ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`
      );
      console.log('[DB] Column user_id added successfully to usage_stats');
    }

    // Add question_language to generated_content if it doesn't exist
    const generatedContentColumns = dbInstance
      .prepare('PRAGMA table_info(generated_content)')
      .all() as ColumnInfo[];
    if (!generatedContentColumns.some((column) => column.name === 'question_language')) {
      console.log('[DB] Adding question_language column to generated_content table');
      dbInstance.exec(`ALTER TABLE generated_content ADD COLUMN question_language TEXT`);
      console.log('[DB] Column question_language added successfully to generated_content');
    }

    // Add seed_value to generated_content if it doesn't exist
    if (!generatedContentColumns.some((column) => column.name === 'seed_value')) {
      console.log('[DB] Adding seed_value column to generated_content table');
      dbInstance.exec(`ALTER TABLE generated_content ADD COLUMN seed_value INTEGER`);
      console.log('[DB] Column seed_value added successfully to generated_content');
    }

    // Add user_id to generated_content if it doesn't exist
    if (!generatedContentColumns.some((column) => column.name === 'user_id')) {
      console.log('[DB] Adding user_id column to generated_content table');
      // Add the column; FK constraint is not added here due to potential SQLite limitations with ALTER TABLE.
      dbInstance.exec(`ALTER TABLE generated_content ADD COLUMN user_id INTEGER`);
      console.log('[DB] Column user_id added successfully to generated_content');
    }

    // Check and remove old columns from 'users' table if they exist (requires SQLite 3.35.0+)
    const userColumns = dbInstance.prepare('PRAGMA table_info(users)').all() as ColumnInfo[];
    const hasOldLevelColumn = userColumns.some((col) => col.name === 'current_cefr_level');
    const hasOldStreakColumn = userColumns.some((col) => col.name === 'correct_streak');
    if (hasOldLevelColumn) {
      console.log('[DB] Attempting to drop old current_cefr_level column from users table');
      try {
        dbInstance.exec('ALTER TABLE users DROP COLUMN current_cefr_level');
      } catch (e) {
        console.warn('[DB] Could not drop current_cefr_level:', e);
      }
    }
    if (hasOldStreakColumn) {
      console.log('[DB] Attempting to drop old correct_streak column from users table');
      try {
        dbInstance.exec('ALTER TABLE users DROP COLUMN correct_streak');
      } catch (e) {
        console.warn('[DB] Could not drop correct_streak:', e);
      }
    }

    console.log('[DB] Schema initialization/verification complete');

    // --- Create Proxy for Logging (Only once) ---
    dbProxyInstance = new Proxy(dbInstance, {
      get: (target, prop) => {
        if (prop === 'prepare') {
          return (sql: string) => {
            // Memoize prepared statements for performance
            const cachedStmt = target.prepare(sql);
            return new Proxy(cachedStmt, {
              get: (stmtTarget, stmtProp) => {
                if (stmtProp === 'run' || stmtProp === 'get' || stmtProp === 'all') {
                  return (...args: unknown[]) => {
                    const formattedParams = args.map((param) => {
                      if (typeof param === 'string' && param.length > 50) {
                        return param.substring(0, 47) + '...';
                      }
                      return param;
                    });
                    console.log(
                      `[DB] ${
                        String(stmtProp) === 'run' ? 'Executing' : 'Querying'
                      }: ${sql.split('\n')[0]}... Params: ${JSON.stringify(formattedParams)}`
                    );
                    if (stmtProp === 'run') return stmtTarget.run(...args);
                    if (stmtProp === 'get') return stmtTarget.get(...args);
                    if (stmtProp === 'all') return stmtTarget.all(...args);
                    return Reflect.get(stmtTarget, stmtProp) as unknown;
                  };
                }
                return Reflect.get(stmtTarget, stmtProp) as unknown;
              },
            });
          };
        }
        return Reflect.get(target, prop) as unknown;
      },
    });

    isInitialized = true;
    console.log('[DB] Database initialized successfully and proxy created.');
    return dbProxyInstance;
  } catch (error) {
    console.error('[DB] Database initialization error:', error);
    // Fallback to in-memory DB if initialization fails in production (outside build)
    if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
      console.warn('[DB] CRITICAL: Falling back to in-memory database due to error!');
      dbInstance = new Database(':memory:');
      // Re-attempt minimal setup for in-memory fallback?
      dbProxyInstance = dbInstance; // Use non-proxied instance for fallback
      isInitialized = true; // Mark as initialized to prevent loops
      return dbProxyInstance;
    }
    // During dev or build, rethrow the error if it's critical
    throw error;
  }
}

// --- Export Singleton Instance ---
// Initialize on first import and export the instance.
const db = initializeDatabase();
export default db;
