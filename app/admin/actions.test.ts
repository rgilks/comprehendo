import { expect, Mock } from 'vitest';
import {
  getTableNames as getTableNamesAction,
  getTableData as getTableDataAction,
} from './actions';
import { getServerSession } from 'next-auth';
import {
  getAllTableNames,
  getTableData,
  type PaginatedTableData,
} from '@/lib/repo/adminRepository';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/authOptions', () => ({
  authOptions: {},
}));

vi.mock('@/lib/repo/adminRepository', () => ({
  getAllTableNames: vi.fn(),
  getTableData: vi.fn(),
}));

const originalEnv = process.env;

describe('Admin actions security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, ADMIN_EMAILS: 'admin@example.com,another@example.com' };

    // Default mocks for repository functions
    (getAllTableNames as Mock).mockReturnValue(['users', 'logs']);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getTableNames authorization', () => {
    it('should return false if user is not logged in', async () => {
      (getServerSession as Mock).mockResolvedValue(null);
      const result = await getTableNamesAction();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return false if user has no email', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Test User' },
      });
      const result = await getTableNamesAction();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return false if user email is not in ADMIN_EMAILS', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Test User', email: 'user@example.com' },
      });
      const result = await getTableNamesAction();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return true if user email is in ADMIN_EMAILS', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      const expectedTableNames = ['table1', 'table2'];
      (getAllTableNames as Mock).mockReturnValue(expectedTableNames);
      const result = await getTableNamesAction();
      expect(result).toEqual({ data: expectedTableNames });
    });

    it('should handle empty ADMIN_EMAILS environment variable', async () => {
      process.env['ADMIN_EMAILS'] = '';
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      const result = await getTableNamesAction();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should handle errors from repository.getAllTableNames when it throws an Error instance', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      const errorMessage = 'Repo error';
      (getAllTableNames as Mock).mockImplementation(() => {
        throw new Error(errorMessage);
      });
      const result = await getTableNamesAction();
      expect(result).toEqual({ error: 'Failed to fetch table names' });
    });

    it('should handle errors from repository.getAllTableNames when it throws a string', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      const errorContent = 'Repo string error';
      (getAllTableNames as Mock).mockImplementation(() => {
        throw new Error(errorContent);
      });
      const result = await getTableNamesAction();
      expect(result).toEqual({ error: 'Failed to fetch table names' });
    });
  });

  describe('getTableData function', () => {
    it('should return unauthorized error if user is not an admin', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Test User', email: 'user@example.com' },
      });
      const result = await getTableDataAction('users');
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return data if user is an admin', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });

      const mockPaginatedData: PaginatedTableData = {
        data: [{ id: 1, name: 'User 1' }],
        totalRows: 10,
        page: 1,
        limit: 10,
      };
      (getTableData as Mock).mockReturnValue(mockPaginatedData);

      const result = await getTableDataAction('users');
      expect(result).toHaveProperty('data');
      expect(result.data).toEqual(mockPaginatedData);
    });

    it('should handle errors from repository.getTableData when it throws an Error instance', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      const repoErrorMessage = 'DB is down';
      (getTableData as Mock).mockImplementation(() => {
        throw new Error(repoErrorMessage);
      });
      const result = await getTableDataAction('some_table');
      expect(result).toEqual({ error: repoErrorMessage });
    });

    it('should handle errors from repository.getTableData when it throws a string', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      const errorContent = 'DB string error';
      (getTableData as Mock).mockImplementation(() => {
        throw new Error(errorContent);
      });
      const result = await getTableDataAction('some_table');
      expect(result).toEqual({ error: errorContent });
    });
  });
});
