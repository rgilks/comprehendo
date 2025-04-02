'use server';

import db from '../../lib/db';
// Use unstable_getServerSession for NextAuth v4
import { unstable_getServerSession } from 'next-auth/next';
// Import the exported authOptions from the new location
import { authOptions } from '../../lib/authOptions';
// Removed unused Session import
// import { Session } from 'next-auth';

// Helper function to check admin status using unstable_getServerSession
async function isAdmin(): Promise<boolean> {
  // Pass authOptions to unstable_getServerSession
  const session = await unstable_getServerSession(authOptions);
  // Adjust type check for the session object returned by unstable_getServerSession
  // It might already include custom properties if defined in session callback
  return (session?.user as { isAdmin?: boolean })?.isAdmin === true;
}

// Define type for table name query result
interface TableNameResult {
  name: string;
}

// Helper function to get all table names safely
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

// Define the structure for the paginated response
interface PaginatedTableData {
  data: Record<string, unknown>[]; // Use unknown instead of any
  totalRows: number;
  page: number;
  limit: number;
}

// Define type for COUNT query result
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
  page: number = 1, // Default to page 1
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

  // Basic validation for page and limit
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit))); // Limit max rows per page
  const offset = (safePage - 1) * safeLimit;

  try {
    // Determine default sorting
    let orderByClause = 'ORDER BY ROWID DESC'; // Default fallback
    if (tableName === 'generated_content' && allowedTableNames.includes('generated_content')) {
      orderByClause = 'ORDER BY created_at DESC';
    } else if (tableName === 'usage_stats' && allowedTableNames.includes('usage_stats')) {
      orderByClause = 'ORDER BY timestamp DESC';
    } else if (tableName === 'users' && allowedTableNames.includes('users')) {
      orderByClause = 'ORDER BY last_login DESC';
    }
    // Note: This doesn't dynamically check if the columns actually exist
    // It assumes they do based on known schema for specific tables.

    // Use transaction for atomicity
    const result = db.transaction(() => {
      // Get total row count
      const countResult = db
        .prepare(`SELECT COUNT(*) as totalRows FROM "${tableName}"`)
        .get() as CountResult; // Use specific type
      const totalRows = countResult.totalRows;

      // Get paginated and sorted data
      // IMPORTANT: Directly embedding orderByClause is safe ONLY because we constructed it
      // from fixed strings based on the validated tableName. DO NOT use user input here directly.
      const query = `SELECT * FROM "${tableName}" ${orderByClause} LIMIT ? OFFSET ?`;
      const paginatedData = db.prepare(query).all(safeLimit, offset);

      return {
        data: paginatedData as Record<string, unknown>[], // Use unknown
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
