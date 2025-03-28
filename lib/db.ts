import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Define database directory and path
const DB_DIR =
  process.env.NODE_ENV === "production"
    ? "/data"
    : path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "comprehend.sqlite");

// Initialize database connection
let db: Database.Database;

// Check if we're in the build phase
const isBuildPhase =
  process.env.NODE_ENV === "production" &&
  (!process.env.NEXT_PHASE ||
    process.env.NEXT_PHASE === "phase-production-build");

try {
  // During build phase or if we can't access the filesystem, use in-memory database
  if (isBuildPhase || !fs.existsSync(process.cwd())) {
    db = new Database(":memory:");
    console.log("[DB] Using in-memory database for build phase");
  } else {
    // Only create directory in development or when running the actual server
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      console.log(`[DB] Created database directory at ${DB_DIR}`);
    }

    db = new Database(DB_PATH);
    console.log(`[DB] Connected to database at ${DB_PATH}`);
  }

  // Enable foreign keys
  db.pragma("foreign_keys = ON");
  console.log("[DB] Enabled foreign key constraints");

  // Initialize database schema if needed
  console.log("[DB] Initializing database schema...");
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
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("[DB] Schema initialization complete");

  // Create a proxy to intercept and log database operations
  const dbProxy = new Proxy(db, {
    get(target, prop) {
      if (prop === "prepare") {
        return function (sql: string) {
          const stmt = target.prepare(sql);

          return new Proxy(stmt, {
            get(stmtTarget, stmtProp) {
              if (stmtProp === "run" || stmtProp === "get") {
                return function (...args: any[]) {
                  console.log(
                    `[DB] ${
                      stmtProp === "run" ? "Executing" : "Querying"
                    } with params:`,
                    args
                  );
                  const result = (stmtTarget as any)[stmtProp](...args);
                  return result;
                };
              }
              return (stmtTarget as any)[stmtProp];
            },
          });
        };
      }
      return (target as any)[prop];
    },
  });

  db = dbProxy;
  console.log("[DB] Database initialized successfully");
} catch (error) {
  console.error("[DB] Database initialization error:", error);

  // In production server, we want to fail hard if database setup fails
  if (process.env.NODE_ENV === "production" && !isBuildPhase) {
    throw error;
  }

  // In development or build phase, create an in-memory database as fallback
  db = new Database(":memory:");
  console.warn("[DB] Using in-memory database as fallback");
}

export default db;
