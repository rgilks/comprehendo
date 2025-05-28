import db from '@/lib/db';

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

// eslint-disable-next-line @typescript-eslint/require-await
export const getAllTableNames = async (): Promise<string[]> => {
  try {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .all() as TableNameResult[];
    return tables.map((table) => table.name);
  } catch (error) {
    console.error('[AdminRepository] Error fetching table names:', error);
    throw error;
  }
};

const validateTableName = async (tableName: string): Promise<void> => {
  const allowedTableNames = await getAllTableNames();
  if (!allowedTableNames.includes(tableName)) {
    console.error(`[AdminRepository] Attempt to access disallowed table: ${tableName}`);
    throw new Error('Invalid table name');
  }
};

const getOrderByClause = (tableName: string): string => {
  if (tableName === 'quiz') return 'ORDER BY created_at DESC';
  if (tableName === 'users') return 'ORDER BY last_login DESC';
  return 'ORDER BY ROWID DESC';
};

export const getTableData = async (
  tableName: string,
  page: number,
  limit: number
): Promise<PaginatedTableData> => {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const offset = (safePage - 1) * safeLimit;
  await validateTableName(tableName);
  const orderByClause = getOrderByClause(tableName);
  try {
    const result = db.transaction(() => {
      const countResult = db.prepare(`SELECT COUNT(*) as totalRows FROM "${tableName}"`).get() as
        | CountResult
        | undefined;
      const totalRows = countResult?.totalRows ?? 0;
      const query = `SELECT * FROM "${tableName}" ${orderByClause} LIMIT ? OFFSET ?`;
      const paginatedData = db.prepare(query).all(safeLimit, offset);
      return {
        data: paginatedData as Record<string, unknown>[],
        totalRows,
        page: safePage,
        limit: safeLimit,
      };
    })();
    return result;
  } catch (error) {
    console.error(`[AdminRepository] Error fetching paginated data for table ${tableName}:`, error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('Failed to fetch table data');
  }
};
