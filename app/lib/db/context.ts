let globalDb: unknown = null;

export const setGlobalDb = (db: unknown) => {
  globalDb = db;
};

export const getGlobalDb = async () => {
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

  return globalDb;
};
