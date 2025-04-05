import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'comprehendo.sqlite');

let db: Database.Database;

// Define ColumnInfo interface centrally
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

try {
  if (isBuildPhase || !fs.existsSync(process.cwd())) {
    db = new Database(':memory:');
    console.log('[DB] Using in-memory database for build phase');
  } else {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      console.log(`[DB] Created database directory at ${DB_DIR}`);
    }

    db = new Database(DB_PATH);
    console.log(`[DB] Connected to database at ${DB_PATH}`);
  }

  db.pragma('foreign_keys = ON');
  console.log('[DB] Enabled foreign key constraints');

  console.log('[DB] Initializing database schema...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS generated_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      language TEXT NOT NULL,
      level TEXT NOT NULL,
      content TEXT NOT NULL,
      questions TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS usage_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT,
      language TEXT NOT NULL,
      level TEXT NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE -- Added ON DELETE CASCADE
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
      -- removed current_cefr_level and correct_streak
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

    -- Add indexes for sorting performance in admin view
    CREATE INDEX IF NOT EXISTS idx_generated_content_created_at ON generated_content(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_usage_stats_timestamp ON usage_stats(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);
    CREATE INDEX IF NOT EXISTS idx_user_language_progress_last_practiced ON user_language_progress(last_practiced DESC);
  `);

  // --- Column Migration/Cleanup ---

  // Check and remove old columns from 'users' table if they exist
  try {
    const userColumns = db.prepare('PRAGMA table_info(users)').all() as ColumnInfo[];
    const hasOldLevelColumn = userColumns.some((col) => col.name === 'current_cefr_level');
    const hasOldStreakColumn = userColumns.some((col) => col.name === 'correct_streak');

    // Use ALTER TABLE DROP COLUMN (Requires SQLite 3.35.0+)
    if (hasOldLevelColumn) {
      console.log('[DB] Dropping old current_cefr_level column from users table');
      // Wrap in another try-catch in case DROP COLUMN isn't supported
      try {
        db.exec('ALTER TABLE users DROP COLUMN current_cefr_level');
      } catch (dropError) {
        console.warn(
          '[DB] Could not drop current_cefr_level column (might require manual migration or newer SQLite): ',
          dropError
        );
      }
    }
    if (hasOldStreakColumn) {
      console.log('[DB] Dropping old correct_streak column from users table');
      try {
        db.exec('ALTER TABLE users DROP COLUMN correct_streak');
      } catch (dropError) {
        console.warn(
          '[DB] Could not drop correct_streak column (might require manual migration or newer SQLite): ',
          dropError
        );
      }
    }
  } catch (error) {
    console.warn('[DB] Error checking for old user progress columns:', error);
  }

  // Check for user_id in usage_stats
  try {
    const usageStatsColumns = db.prepare('PRAGMA table_info(usage_stats)').all() as ColumnInfo[];
    if (!usageStatsColumns.some((column) => column.name === 'user_id')) {
      console.log('[DB] Adding user_id column to usage_stats table');
      db.exec(
        `ALTER TABLE usage_stats ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`
      );
      console.log('[DB] Column added successfully');
    }
  } catch (error) {
    console.error('[DB] Error checking or adding user_id column to usage_stats:', error);
  }

  // Check for question_language in generated_content
  try {
    const generatedContentColumns = db
      .prepare('PRAGMA table_info(generated_content)')
      .all() as ColumnInfo[];
    if (!generatedContentColumns.some((column) => column.name === 'question_language')) {
      console.log('[DB] Adding question_language column to generated_content table');
      db.exec(`ALTER TABLE generated_content ADD COLUMN question_language TEXT`);
      console.log('[DB] Column added successfully');
    }
  } catch (error) {
    console.error('[DB] Error checking or adding question_language column:', error);
  }

  console.log('[DB] Schema initialization complete');

  // Proxy for logging (keep as is)
  const dbProxy = new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') {
        return function (sql: string) {
          const stmt: Database.Statement = target.prepare(sql);

          return new Proxy(stmt, {
            get(stmtTarget, stmtProp) {
              if (stmtProp === 'run' || stmtProp === 'get' || stmtProp === 'all') {
                return function (...args: unknown[]) {
                  const formattedParams = args.map((param) => {
                    if (typeof param === 'string' && param.length > 50) {
                      return param.substring(0, 47) + '...';
                    }
                    return param;
                  });

                  console.log(
                    `[DB] ${
                      String(stmtProp) === 'run' ? 'Executing' : 'Querying'
                    } with params: ${JSON.stringify(formattedParams)}`
                  );

                  if (stmtProp === 'run') {
                    return stmtTarget.run(...args);
                  } else if (stmtProp === 'get') {
                    return stmtTarget.get(...args);
                  } else if (stmtProp === 'all') {
                    return stmtTarget.all(...args);
                  }
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

  db = dbProxy;
  console.log('[DB] Database initialized successfully');
} catch (error) {
  console.error('[DB] Database initialization error:', error);

  if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
    throw error;
  }

  db = new Database(':memory:');
  console.warn('[DB] Using in-memory database as fallback');
}

export default db;
