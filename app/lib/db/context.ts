import type { DatabaseInstance } from './adapter';

let globalDb: DatabaseInstance | null = null;

export const setGlobalDb = (db: DatabaseInstance) => {
  globalDb = db;
};

export const getGlobalDb = async (): Promise<DatabaseInstance> => {
  if (globalDb) {
    return globalDb;
  }

  // Fallback for development - use the original SQLite database
  if (process.env.NODE_ENV === 'development') {
    const { getDb } = await import('app/lib/db/adapter');
    const db = getDb();
    globalDb = db;
    return db;
  }

  throw new Error('Database not initialized');
};
