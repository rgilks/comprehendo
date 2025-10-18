#!/usr/bin/env node

import { drizzle } from 'drizzle-orm/d1';
import { initializeSchema } from './app/lib/db/d1-migrations';

const migrateD1Database = async (d1Database) => {
  console.log('Starting D1 database migration...');

  try {
    const db = drizzle(d1Database);
    await initializeSchema(db);
    console.log('D1 database migration completed successfully!');
  } catch (error) {
    console.error('Error during D1 migration:', error);
    throw error;
  }
};

export default migrateD1Database;
