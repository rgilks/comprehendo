import { expect } from 'vitest';
import { getTableNames, getTableData } from './actions';
import { getServerSession } from 'next-auth';
import { Mock } from 'vitest';
import * as adminRepository from '@/lib/repositories/adminRepository';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: vi.fn(() => ({
    events: {
      on: vi.fn(),
      off: vi.fn(),
    },
  })),
}));

vi.mock('@/lib/authOptions', () => ({
  authOptions: {},
}));

vi.mock('@/lib/repositories/adminRepository', () => ({
  getAllTableNames: vi.fn(),
  getTableData: vi.fn(),
}));

const originalEnv = process.env;

describe('Admin actions security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, ADMIN_EMAILS: 'admin@example.com,another@example.com' };

    // Default mocks for repository functions
    vi.mocked(adminRepository.getAllTableNames).mockReturnValue(['users', 'logs']);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getTableNames authorization', () => {
    it('should return false if user is not logged in', async () => {
      (getServerSession as Mock).mockResolvedValue(null);
      const result = await getTableNames();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return false if user has no email', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Test User' },
      });
      const result = await getTableNames();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return false if user email is not in ADMIN_EMAILS', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Test User', email: 'user@example.com' },
      });
      const result = await getTableNames();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return true if user email is in ADMIN_EMAILS', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      vi.mocked(adminRepository.getAllTableNames).mockReturnValue(['table1', 'table2']);
      const result = await getTableNames();
      expect(result).toEqual({ data: expect.any(Array) });
    });

    it('should handle empty ADMIN_EMAILS environment variable', async () => {
      process.env['ADMIN_EMAILS'] = '';
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      const result = await getTableNames();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should handle errors from repository.getAllTableNames when it throws an Error instance', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      const errorMessage = 'Repo error';
      vi.mocked(adminRepository.getAllTableNames).mockImplementation(() => {
        throw new Error(errorMessage);
      });
      const result = await getTableNames();
      expect(result).toEqual({ error: 'Failed to fetch table names' });
    });

    it('should handle errors from repository.getAllTableNames when it throws a string', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      const errorContent = 'Repo string error';
      vi.mocked(adminRepository.getAllTableNames).mockImplementation(() => {
        throw new Error(errorContent);
      });
      const result = await getTableNames();
      expect(result).toEqual({ error: 'Failed to fetch table names' });
    });
  });

  describe('getTableData function', () => {
    it('should return unauthorized error if user is not an admin', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Test User', email: 'user@example.com' },
      });
      const result = await getTableData('users');
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return data if user is an admin', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });

      const mockPaginatedData: adminRepository.PaginatedTableData = {
        data: [{ id: 1, name: 'User 1' }],
        totalRows: 10,
        page: 1,
        limit: 10,
      };
      vi.mocked(adminRepository.getTableData).mockReturnValue(mockPaginatedData);

      const result = await getTableData('users');
      expect(result).toHaveProperty('data');
      const data = result.data as {
        data: unknown[];
        totalRows: number;
        page: number;
        limit: number;
      };
      expect(data).toEqual(
        expect.objectContaining({
          data: expect.any(Array),
          totalRows: expect.any(Number),
          page: expect.any(Number),
          limit: expect.any(Number),
        })
      );
    });

    it('should handle errors from repository.getTableData when it throws an Error instance', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      const repoErrorMessage = 'DB is down';
      vi.mocked(adminRepository.getTableData).mockImplementation(() => {
        throw new Error(repoErrorMessage);
      });
      const result = await getTableData('some_table');
      expect(result).toEqual({ error: repoErrorMessage });
    });

    it('should handle errors from repository.getTableData when it throws a string', async () => {
      (getServerSession as Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      const errorContent = 'DB string error';
      vi.mocked(adminRepository.getTableData).mockImplementation(() => {
        throw new Error(errorContent);
      });
      const result = await getTableData('some_table');
      expect(result).toEqual({ error: errorContent });
    });
  });
});
