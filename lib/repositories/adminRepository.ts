import db from '@/lib/db'; // Import db

// Define interfaces for the results used within this repository
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
    const tables = db // Use imported db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .all() as TableNameResult[];
    return tables.map((table) => table.name);
  } catch (error) {
    console.error('[AdminRepository] Error fetching table names:', error);
    // Re-throw or return empty array? Returning empty array for now.
    // return [];
    throw error; // Re-throw DB errors
  }
};

export const getTableData = (
  tableName: string,
  page: number,
  limit: number
): PaginatedTableData => {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit))); // Keep limit reasonable
  const offset = (safePage - 1) * safeLimit;

  // Basic security: Validate table name against known tables first
  const allowedTableNames = getAllTableNames(); // Call the exported function
  if (!allowedTableNames.includes(tableName)) {
    console.error(`[AdminRepository] Attempt to access disallowed table: ${tableName}`);
    throw new Error('Invalid table name');
  }

  try {
    // Determine default ordering (can be refined)
    let orderByClause = 'ORDER BY ROWID DESC'; // Default safe ordering
    // Add specific default ordering for known tables if needed
    if (tableName === 'quiz') {
      orderByClause = 'ORDER BY created_at DESC';
    } else if (tableName === 'users') {
      orderByClause = 'ORDER BY last_login DESC';
    }
    // Add more else if clauses for other tables with specific default sorts

    // Use a transaction for consistency
    const result = db.transaction(() => {
      // Use imported db
      const countResult = db // Use imported db
        .prepare(`SELECT COUNT(*) as totalRows FROM "${tableName}"`)
        .get() as CountResult | undefined;

      const totalRows = countResult?.totalRows ?? 0;

      const query = `SELECT * FROM "${tableName}" ${orderByClause} LIMIT ? OFFSET ?`;
      const paginatedData = db.prepare(query).all(safeLimit, offset); // Use imported db

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
    // Re-throw the error to be handled by the server action
    throw new Error(
      `Failed to fetch table data for ${tableName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};
