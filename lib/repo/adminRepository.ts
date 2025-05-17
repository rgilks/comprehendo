import { sql, SQL } from 'drizzle-orm';
import db from '@/lib/db';

interface TableNameResult {
  name: string;
}

interface CountQueryResult {
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
    const query = sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%' AND name NOT LIKE 'drizzle_%' AND name NOT LIKE 'fly_storage_%'`;
    const tables = db.all<TableNameResult>(query);
    return tables.map((table) => table.name);
  } catch (error) {
    console.error('[AdminDrizzleRepository] Error fetching table names:', error);
    throw new Error('Failed to fetch table names');
  }
};

const validateTableName = (tableName: string): void => {
  const allowedTableNames = getAllTableNames();
  if (!allowedTableNames.includes(tableName)) {
    console.error(`[AdminDrizzleRepository] Attempt to access disallowed table: ${tableName}`);
    throw new Error('Invalid table name');
  }
};

const getOrderByClause = (tableName: string): SQL => {
  if (tableName === 'quiz') return sql`ORDER BY created_at DESC`;
  if (tableName === 'users') return sql`ORDER BY last_login DESC`;
  return sql`ORDER BY ROWID DESC`;
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
  const orderByClause = getOrderByClause(tableName);

  try {
    const countSql = sql`SELECT COUNT(*) as totalRows FROM ${sql.raw(tableName)}`;
    const countResult = db.get<CountQueryResult>(countSql);
    const totalRows = countResult.totalRows;

    const query = sql`SELECT * FROM ${sql.raw(tableName)} ${orderByClause} LIMIT ${safeLimit} OFFSET ${offset}`;
    const paginatedData = db.all<Record<string, unknown>>(query);

    return {
      data: paginatedData,
      totalRows,
      page: safePage,
      limit: safeLimit,
    };
  } catch (error) {
    console.error(
      `[AdminDrizzleRepository] Error fetching paginated data for table ${tableName}:`,
      error
    );
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch table data for ${tableName}: ${message}`);
  }
};
