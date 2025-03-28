import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Define database directory and path
const DB_DIR =
  process.env.NODE_ENV === "production"
    ? "/data"
    : path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "comprehend.sqlite");

// Ensure the database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log(`[DB] Created database directory at ${DB_DIR}`);
}

// Initialize database connection
let db: Database.Database;
try {
  db = new Database(DB_PATH);
  console.log(`[DB] Connected to database at ${DB_PATH}`);

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

  // Add logging for all database operations
  const originalPrepare = db.prepare.bind(db);
  db.prepare = function <
    BindParameters extends unknown[] | {} = unknown[],
    Result = unknown
  >(sql: string): Database.Statement<BindParameters, Result> {
    console.log(`[DB] Preparing SQL: ${sql}`);
    const stmt = originalPrepare<BindParameters, Result>(sql);

    // Log when the statement is executed
    const originalRun = stmt.run.bind(stmt);
    stmt.run = function (...args: BindParameters) {
      console.log(`[DB] Executing SQL: ${sql}`, { args });
      return originalRun(...args);
    };

    // Log when the statement is queried
    const originalGet = stmt.get.bind(stmt);
    stmt.get = function (...args: BindParameters) {
      console.log(`[DB] Querying SQL: ${sql}`, { args });
      const result = originalGet(...args);
      console.log(`[DB] Query result:`, result);
      return result;
    };

    return stmt;
  };

  console.log("[DB] Database initialized successfully");
} catch (error) {
  console.error("[DB] Database initialization error:", error);

  // In production, we want to fail hard if database setup fails
  if (process.env.NODE_ENV === "production") {
    throw error;
  }

  // In development, create an in-memory database as fallback
  db = new Database(":memory:");
  console.warn("[DB] Using in-memory database as fallback");
}

export default db;
