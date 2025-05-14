'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  getAllTableNames as repoGetAllTableNames,
  getTableData as repoGetTableData,
  type PaginatedTableData,
} from '@/lib/repo/adminRepository';

const isAdmin = async (): Promise<boolean> => {
  const session = await getServerSession(authOptions);

  if (!session?.user.email) {
    return false;
  }

  const adminEmails = (process.env['ADMIN_EMAILS'] || '')
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email);

  return adminEmails.includes(session.user.email);
};

export const getTableNames = async (): Promise<{ error?: string; data?: string[] }> => {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' };
  }
  try {
    const tableNames = repoGetAllTableNames();
    return { data: tableNames };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Admin Action:getTableNames] Error:', errorMessage);
    return { error: 'Failed to fetch table names' };
  }
};

export const getTableData = async (
  tableName: string,
  page: number = 1,
  limit: number = 10
): Promise<{ error?: string; data?: PaginatedTableData }> => {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' };
  }

  try {
    const result = repoGetTableData(tableName, page, limit);
    return { data: result };
  } catch (error) {
    console.error(`[Admin Actions] Error fetching paginated data for table ${tableName}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch table data';
    return { error: errorMessage };
  }
};
