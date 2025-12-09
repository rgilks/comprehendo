import { getGlobalDb } from 'app/lib/db/context';

export const getDb = async () => {
  return await getGlobalDb();
};

export default getDb;
