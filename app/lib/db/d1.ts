import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import { initializeSchema } from './d1-migrations';

let db: ReturnType<typeof drizzle> | null = null;
let isInitialized = false;

const initializeDatabase = (d1Database: unknown) => {
  if (db && isInitialized) {
    return db;
  }

  console.log('[DB] Starting Drizzle D1 database initialization...');

  try {
    db = drizzle(d1Database, { schema });
    initializeSchema(db);
    console.log('[DB] Drizzle D1 database initialized successfully.');
    isInitialized = true;
    return db;
  } catch (error) {
    console.error('Error creating Drizzle D1 database:', error);
    throw error;
  }
};

let initializedDbInstance: ReturnType<typeof drizzle> | null = null;

export const getDb = (d1Database: unknown) => {
  if (!initializedDbInstance) {
    initializedDbInstance = initializeDatabase(d1Database);
  }
  return initializedDbInstance;
};

export default getDb;
export { schema };
