'use server';

import db from '../../lib/db';
import { unstable_getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/authOptions';

async function isAdmin(): Promise<boolean> {
  const session = await unstable_getServerSession(authOptions);
  return (session?.user as { isAdmin?: boolean })?.isAdmin === true;
}

interface TableNameResult {
  name: string;
}

function getAllTableNames(): string[] {
  try {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .all() as TableNameResult[]; // Use specific type
    return tables.map((table) => table.name);
  } catch (error) {
    console.error('[Admin Actions] Error fetching table names:', error);
    return [];
  }
}

interface PaginatedTableData {
  data: Record<string, unknown>[];
  totalRows: number;
  page: number;
  limit: number;
}

interface CountResult {
  totalRows: number;
}

export async function getTableNames(): Promise<{ error?: string; data?: string[] }> {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' };
  }
  const tableNames = getAllTableNames();
  return { data: tableNames };
}

export async function getTableData(
  tableName: string,
  page: number = 1,
  limit: number = 10 // Default to 10 rows per page
): Promise<{ error?: string; data?: PaginatedTableData }> {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' };
  }

  const allowedTableNames = getAllTableNames();
  if (!allowedTableNames.includes(tableName)) {
    console.warn(`[Admin Actions] Attempt to access disallowed table: ${tableName}`);
    return { error: 'Invalid table name' };
  }

  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const offset = (safePage - 1) * safeLimit;

  try {
    let orderByClause = 'ORDER BY ROWID DESC';
    if (tableName === 'generated_content' && allowedTableNames.includes('generated_content')) {
      orderByClause = 'ORDER BY created_at DESC';
    } else if (tableName === 'usage_stats' && allowedTableNames.includes('usage_stats')) {
      orderByClause = 'ORDER BY timestamp DESC';
    } else if (tableName === 'users' && allowedTableNames.includes('users')) {
      orderByClause = 'ORDER BY last_login DESC';
    }

    const result = db.transaction(() => {
      const countResult = db
        .prepare(`SELECT COUNT(*) as totalRows FROM "${tableName}"`)
        .get() as CountResult; // Use specific type
      const totalRows = countResult.totalRows;

      const query = `SELECT * FROM "${tableName}" ${orderByClause} LIMIT ? OFFSET ?`;
      const paginatedData = db.prepare(query).all(safeLimit, offset);

      return {
        data: paginatedData as Record<string, unknown>[],
        totalRows,
        page: safePage,
        limit: safeLimit,
      };
    })();

    return { data: result };
  } catch (error) {
    console.error(`[Admin Actions] Error fetching paginated data for table ${tableName}:`, error);
    return { error: 'Failed to fetch table data' };
  }
}
