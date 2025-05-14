const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
const schema = require('../lib/db/schema'); // Adjust this path if your schema export is different or aliased

console.log('[MIGRATE SCRIPT] Starting database migration process...');

const DB_DIR_FROM_SCRIPT =
  process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data');
const DB_PATH_FROM_SCRIPT = path.join(DB_DIR_FROM_SCRIPT, 'comprehendo.sqlite');
const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

let dbInstanceForMigration;

try {
  console.log(`[MIGRATE SCRIPT] Target database directory: ${DB_DIR_FROM_SCRIPT}`);
  console.log(`[MIGRATE SCRIPT] Target database path: ${DB_PATH_FROM_SCRIPT}`);
  console.log(`[MIGRATE SCRIPT] Migrations folder: ${MIGRATIONS_DIR}`);

  if (!fs.existsSync(DB_DIR_FROM_SCRIPT)) {
    fs.mkdirSync(DB_DIR_FROM_SCRIPT, { recursive: true });
    console.log(`[MIGRATE SCRIPT] Created database directory at ${DB_DIR_FROM_SCRIPT}`);
  }

  dbInstanceForMigration = new Database(DB_PATH_FROM_SCRIPT);
  console.log(`[MIGRATE SCRIPT] Connected to database at ${DB_PATH_FROM_SCRIPT}.`);

  dbInstanceForMigration.pragma('journal_mode = WAL');
  console.log('[MIGRATE SCRIPT] Set journal mode to WAL.');
  dbInstanceForMigration.pragma('foreign_keys = ON');
  console.log('[MIGRATE SCRIPT] Enabled foreign key constraints.');

  const drizzleMigrator = drizzle(dbInstanceForMigration, {
    schema,
  });

  console.log('[MIGRATE SCRIPT] Applying Drizzle migrations...');
  migrate(drizzleMigrator, { migrationsFolder: MIGRATIONS_DIR });
  console.log('[MIGRATE SCRIPT] Drizzle migrations applied successfully.');

  console.log('[MIGRATE SCRIPT] Database migration process finished.');
} catch (error) {
  console.error('[MIGRATE SCRIPT] Error during database migration process:', error);
  process.exitCode = 1; // Set exit code to 1 on error
} finally {
  if (dbInstanceForMigration) {
    dbInstanceForMigration.close();
    console.log('[MIGRATE SCRIPT] Database connection closed.');
  }
  // process.exit() will use process.exitCode if set, otherwise 0
  console.log(`[MIGRATE SCRIPT] Exiting with code ${process.exitCode || 0}.`);
  process.exit();
}
