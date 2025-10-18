import { sql, desc } from 'drizzle-orm';
import getDb, { schema } from 'app/lib/db';

interface TableNameResult {
  name: string;
}

interface CountResult {
  totalRows: number;
}

export interface PaginatedTableData {
  data: Record<string, unknown>[];
  totalRows: number;
  page: number;
  limit: number;
}

export const getAllTableNames = (): string[] => {
  try {
    const db = getDb();

    // Use Drizzle's query method instead of raw SQL
    const tables = db.all(sql`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);

    return (tables as unknown as TableNameResult[]).map((table) => table.name);
  } catch (error) {
    console.error('[AdminRepository] Error fetching table names:', error);
    throw error;
  }
};

const validateTableName = (tableName: string): void => {
  const allowedTableNames = getAllTableNames();
  if (!allowedTableNames.includes(tableName)) {
    console.error(`[AdminRepository] Attempt to access disallowed table: ${tableName}`);
    throw new Error('Invalid table name');
  }
};

const getOrderByClause = (tableName: string) => {
  if (tableName === 'quiz') return desc(schema.quiz.createdAt);
  if (tableName === 'users') return desc(schema.users.lastLogin);
  return desc(sql`ROWID`);
};

export const getTableData = (
  tableName: string,
  page: number,
  limit: number
): PaginatedTableData => {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const offset = (safePage - 1) * safeLimit;

  validateTableName(tableName);

  try {
    const db = getDb();

    const totalRowsResult = db.all(
      sql`SELECT COUNT(*) as totalRows FROM ${sql.identifier(tableName)}`
    );
    const totalRows = (totalRowsResult[0] as CountResult).totalRows;

    const dataResult = db.all(sql`
      SELECT * FROM ${sql.identifier(tableName)} 
      ORDER BY ${getOrderByClause(tableName)} 
      LIMIT ${safeLimit} OFFSET ${offset}
    `);

    return {
      data: dataResult as Record<string, unknown>[],
      totalRows,
      page: safePage,
      limit: safeLimit,
    };
  } catch (error) {
    console.error(`[AdminRepository] Error fetching paginated data for table ${tableName}:`, error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('Failed to fetch table data');
  }
};
