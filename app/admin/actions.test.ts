import { getServerSession } from 'next-auth';
import { getTableNames, getTableData } from './actions';
import db from '@/lib/db';

// Mock actual function implementations since we're testing the actual code
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/authOptions', () => ({
  authOptions: {},
}));

// Mock the database implementation
jest.mock('@/lib/db', () => {
  const mockPrepare = jest.fn();
  const mockDb = {
    prepare: mockPrepare,
    transaction: jest.fn((cb) => cb()),
  };

  return mockDb;
});

// Mock environment variables
const originalEnv = process.env;

describe('Admin actions security', () => {
  // Set up and tear down for each test
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, ADMIN_EMAILS: 'admin@example.com,another@example.com' };

    // Setup database mocks
    const mockAll = jest.fn().mockReturnValue([{ name: 'users' }, { name: 'logs' }]);
    const mockGet = jest.fn().mockReturnValue({ totalRows: 10 });
    const mockRun = jest.fn();

    // Setup default prepare mock
    (db.prepare as jest.Mock).mockImplementation(() => ({
      all: mockAll,
      get: mockGet,
      run: mockRun,
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isAdmin function', () => {
    it('should return false if user is not logged in', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);
      const result = await getTableNames();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return false if user has no email', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { name: 'Test User' },
      });
      const result = await getTableNames();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return false if user email is not in ADMIN_EMAILS', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { name: 'Test User', email: 'user@example.com' },
      });
      const result = await getTableNames();
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return true if user email is in ADMIN_EMAILS', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      const result = await getTableNames();
      expect(result).toEqual({ data: expect.any(Array) });
    });

    it('should handle empty ADMIN_EMAILS environment variable', async () => {
      process.env.ADMIN_EMAILS = '';
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });
      const result = await getTableNames();
      expect(result).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('getTableData function', () => {
    it('should return unauthorized error if user is not an admin', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { name: 'Test User', email: 'user@example.com' },
      });
      const result = await getTableData('users');
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return data if user is an admin', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { name: 'Admin User', email: 'admin@example.com' },
      });

      const mockPaginatedData = [{ id: 1, name: 'User 1' }];
      (db.transaction as jest.Mock).mockImplementation(() => {
        return () => {
          return {
            data: mockPaginatedData,
            totalRows: 10,
            page: 1,
            limit: 10,
          };
        };
      });

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
  });
});
