import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'comprehendo.sqlite');

let db: Database.Database;

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
      user_id INTEGER REFERENCES users(id) -- Ensure user_id exists here too
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

    -- Add indexes for sorting performance in admin view
    CREATE INDEX IF NOT EXISTS idx_generated_content_created_at ON generated_content(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_usage_stats_timestamp ON usage_stats(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);
  `);

  try {
    interface ColumnInfo {
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }

    const columns = db.prepare('PRAGMA table_info(usage_stats)').all() as ColumnInfo[];

    const hasUserIdColumn = columns.some((column) => column.name === 'user_id');

    if (!hasUserIdColumn) {
      console.log('[DB] Adding user_id column to usage_stats table');
      db.exec(`
        ALTER TABLE usage_stats 
        ADD COLUMN user_id INTEGER REFERENCES users(id)
      `);
      console.log('[DB] Column added successfully');
    }
  } catch (error) {
    console.error('[DB] Error checking or adding column:', error);
  }

  try {
    interface ColumnInfo {
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }

    const columns = db.prepare('PRAGMA table_info(generated_content)').all() as ColumnInfo[];

    const hasQuestionLangColumn = columns.some((column) => column.name === 'question_language');

    if (!hasQuestionLangColumn) {
      console.log('[DB] Adding question_language column to generated_content table');
      db.exec(`
        ALTER TABLE generated_content 
        ADD COLUMN question_language TEXT
      `);
      console.log('[DB] Column added successfully');
    }
  } catch (error) {
    console.error('[DB] Error checking or adding question_language column:', error);
  }

  console.log('[DB] Schema initialization complete');

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
                  return Reflect.get(stmtTarget, stmtProp);
                };
              }
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              return Reflect.get(stmtTarget, stmtProp);
            },
          });
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return Reflect.get(target, prop);
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
