import { sql, desc, count } from 'drizzle-orm';
import getDb from 'app/repo/db';
import { schema } from 'app/lib/db/adapter';

interface TableNameResult {
  name: string;
}

export interface PaginatedTableData {
  data: Record<string, unknown>[];
  totalRows: number;
  page: number;
  limit: number;
}

export const getAllTableNames = async (): Promise<string[]> => {
  try {
    const db = await getDb();

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

const validateTableName = async (tableName: string): Promise<void> => {
  const allowedTableNames = await getAllTableNames();
  if (!allowedTableNames.includes(tableName)) {
    console.error(`[AdminRepository] Attempt to access disallowed table: ${tableName}`);
    throw new Error('Invalid table name');
  }
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

  try {
    const db = await getDb();

    let totalRows = 0;
    let dataResult: Record<string, unknown>[] = [];

    switch (tableName) {
      case 'users':
        totalRows = (await db.select({ count: count() }).from(schema.users))[0]?.count || 0;
        dataResult = await db
          .select()
          .from(schema.users)
          .orderBy(desc(schema.users.lastLogin))
          .limit(safeLimit)
          .offset(offset);
        break;
      case 'quiz':
        totalRows = (await db.select({ count: count() }).from(schema.quiz))[0]?.count || 0;
        dataResult = await db
          .select()
          .from(schema.quiz)
          .orderBy(desc(schema.quiz.createdAt))
          .limit(safeLimit)
          .offset(offset);
        break;
      case 'userLanguageProgress':
        totalRows =
          (await db.select({ count: count() }).from(schema.userLanguageProgress))[0]?.count || 0;
        dataResult = await db
          .select()
          .from(schema.userLanguageProgress)
          .orderBy(desc(schema.userLanguageProgress.lastPracticed))
          .limit(safeLimit)
          .offset(offset);
        break;
      case 'questionFeedback':
        totalRows =
          (await db.select({ count: count() }).from(schema.questionFeedback))[0]?.count || 0;
        dataResult = await db
          .select()
          .from(schema.questionFeedback)
          .orderBy(desc(schema.questionFeedback.submittedAt))
          .limit(safeLimit)
          .offset(offset);
        break;
      case 'rateLimits':
        totalRows = (await db.select({ count: count() }).from(schema.rateLimits))[0]?.count || 0;
        dataResult = await db
          .select()
          .from(schema.rateLimits)
          .orderBy(desc(sql`ROWID`))
          .limit(safeLimit)
          .offset(offset);
        break;
      case 'translationCache':
        totalRows =
          (await db.select({ count: count() }).from(schema.translationCache))[0]?.count || 0;
        dataResult = await db
          .select()
          .from(schema.translationCache)
          .orderBy(desc(schema.translationCache.createdAt))
          .limit(safeLimit)
          .offset(offset);
        break;
      case 'aiApiUsage':
        totalRows = (await db.select({ count: count() }).from(schema.aiApiUsage))[0]?.count || 0;
        dataResult = await db
          .select()
          .from(schema.aiApiUsage)
          .orderBy(desc(schema.aiApiUsage.createdAt))
          .limit(safeLimit)
          .offset(offset);
        break;
      default:
        throw new Error('Invalid table name');
    }

    return {
      data: dataResult,
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
