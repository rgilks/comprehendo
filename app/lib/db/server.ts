import { getDb } from 'app/lib/db/adapter';

export const getServerDb = (d1Database?: unknown) => {
  return getDb(d1Database);
};
