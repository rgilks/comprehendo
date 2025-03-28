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
}

// Initialize database connection
let db: Database.Database;
try {
  db = new Database(DB_PATH);

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Initialize database schema if needed
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

  console.log("Database initialized successfully at", DB_PATH);
} catch (error) {
  console.error("Database initialization error:", error);

  // In production, we want to fail hard if database setup fails
  if (process.env.NODE_ENV === "production") {
    throw error;
  }

  // In development, create an in-memory database as fallback
  db = new Database(":memory:");
  console.warn("Using in-memory database as fallback");
}

export default db;
