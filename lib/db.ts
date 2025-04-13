import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as Sentry from '@sentry/nextjs';

const DB_DIR = process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'comprehendo.sqlite');

const isBuildPhase =
  process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

let db: Database.Database | null = null;
let dbProxyInstance: Database.Database | null = null;
let isInitialized = false;

function initializeDatabase(): Database.Database {
  if (db && dbProxyInstance && isInitialized) {
    return dbProxyInstance;
  }

  console.log('[DB] Starting database initialization...');

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

    console.log('[DB] Initializing/verifying database schema...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS quiz (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language TEXT NOT NULL,
        level TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        question_language TEXT,
        user_id INTEGER 
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
        language TEXT DEFAULT 'en',
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

      CREATE TABLE IF NOT EXISTS question_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        rating TEXT NOT NULL CHECK(rating IN ('good', 'bad')), 
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id) REFERENCES quiz (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_quiz_created_at ON quiz(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);
      CREATE INDEX IF NOT EXISTS idx_user_language_progress_last_practiced ON user_language_progress(last_practiced DESC);
      CREATE INDEX IF NOT EXISTS idx_question_feedback_quiz_id ON question_feedback (quiz_id);
      CREATE INDEX IF NOT EXISTS idx_question_feedback_user_id ON question_feedback (user_id);
      
      CREATE TABLE IF NOT EXISTS rate_limits (
        ip_address TEXT PRIMARY KEY,
        requests TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('[DB] Schema initialization/verification complete');

    dbProxyInstance = new Proxy(db, {
      get: (target, prop) => {
        if (prop === 'prepare') {
          return (sql: string) => {
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
    Sentry.captureException(error);
    if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
      console.warn('[DB] CRITICAL: Falling back to in-memory database due to error!');
      db = new Database(':memory:');
      dbProxyInstance = db;
      isInitialized = true;
      return dbProxyInstance;
    }
    throw error;
  }
}

const initializedDbInstance = initializeDatabase();
export default initializedDbInstance;
