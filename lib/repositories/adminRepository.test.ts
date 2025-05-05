import { describe, it, expect, vi, beforeEach } from 'vitest';
// import db from '@/lib/db'; // Mock this dependency - REMOVED
import { AdminRepository, type PaginatedTableData } from './adminRepository';

// Mock the db dependency directly
// vi.mock('@/lib/db', () => {
//   const mockDb = {
//     prepare: vi.fn(),
//     all: vi.fn(),
//     get: vi.fn(),
//     transaction: vi.fn((cb) => cb()), // Mock transaction to just execute the callback
//   };
//   // Make prepare chainable for methods like .all() and .get()
//   mockDb.prepare.mockImplementation(() => mockDb);
//   return { default: mockDb };
// });

// Create mockDb object directly
const mockDb = {
  prepare: vi.fn(),
  all: vi.fn(),
  get: vi.fn(),
  // transaction: vi.fn((cb) => cb()), // Old mock
  // Mock transaction to return a function that executes the callback, mimicking better-sqlite3
  transaction: vi.fn().mockImplementation((cb) => {
    // Return a function that, when called, executes the original callback
    return (...args: any[]) => cb(...args);
  }),
};
// Ensure prepare is chainable
mockDb.prepare.mockImplementation(() => mockDb);

// Cast the mocked db for easier use and type safety - NO LONGER NEEDED AS GLOBAL MOCK
// const mockDb = db as unknown as {
//   prepare: Mock;
//   all: Mock;
//   get: Mock;
//   transaction: Mock;
// };

let adminRepository: AdminRepository;

describe('AdminRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks before each test
    mockDb.prepare.mockClear();
    mockDb.all.mockClear();
    mockDb.get.mockClear();
    mockDb.transaction.mockClear();
    // Ensure prepare chaining is reset correctly if needed
    mockDb.prepare.mockImplementation(() => mockDb);

    // Instantiate repository with the directly created mocked DB
    adminRepository = new AdminRepository(mockDb as any); // Use the local mockDb

    // REMOVED Explicit assignment as we pass the mock directly now
    // (adminRepository as any).db.prepare = mockDb.prepare;
    // (adminRepository as any).db.all = mockDb.all;
    // (adminRepository as any).db.get = mockDb.get;
    // (adminRepository as any).db.transaction = mockDb.transaction;
  });

  describe('getAllTableNames', () => {
    it('should return a list of table names excluding sqlite_ internal tables', () => {
      const mockTables = [
        { name: 'users' },
        { name: 'quiz' },
        // { name: 'sqlite_sequence' }, // Kept comment explaining removal
        { name: 'question_feedback' },
      ];
      mockDb.all.mockReturnValue(mockTables);

      const tableNames = adminRepository.getAllTableNames();

      expect(tableNames).toEqual(['users', 'quiz', 'question_feedback']);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      );
      expect(mockDb.all).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array if the database query fails', () => {
      const dbError = new Error('DB Error');
      mockDb.all.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const tableNames = adminRepository.getAllTableNames();

      expect(tableNames).toEqual([]);
      expect(errorSpy).toHaveBeenCalledWith(
        '[AdminRepository] Error fetching table names:',
        dbError
      );
      errorSpy.mockRestore();
    });
  });

  describe('getTableData', () => {
    const tableName = 'users';
    const page = 2;
    const limit = 5;

    beforeEach(() => {
      // Mock getAllTableNames used internally for validation
      vi.spyOn(adminRepository, 'getAllTableNames').mockReturnValue(['users', 'quiz']);
    });

    it('should fetch paginated data and total row count for a valid table', () => {
      const mockData = [{ id: 6, name: 'User 6' }];
      const mockTotalRows = 15;
      mockDb.get.mockReturnValue({ totalRows: mockTotalRows });
      mockDb.all.mockReturnValue(mockData);

      const result = adminRepository.getTableData(tableName, page, limit);

      expect(result).toEqual<PaginatedTableData>({
        data: mockData,
        totalRows: mockTotalRows,
        page: page,
        limit: limit,
      });

      // Check count query
      expect(mockDb.prepare).toHaveBeenCalledWith(
        `SELECT COUNT(*) as totalRows FROM "${tableName}"`
      );
      expect(mockDb.get).toHaveBeenCalledTimes(1);

      // Check data query with default ordering for 'users'
      expect(mockDb.prepare).toHaveBeenCalledWith(
        `SELECT * FROM "${tableName}" ORDER BY last_login DESC LIMIT ? OFFSET ?`
      );
      expect(mockDb.all).toHaveBeenCalledWith(limit, (page - 1) * limit);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1); // Ensure transaction was used
    });

    it('should use default ROWID ordering for unknown tables', () => {
      vi.spyOn(adminRepository, 'getAllTableNames').mockReturnValue(['unknown_table']);
      mockDb.get.mockReturnValue({ totalRows: 1 });
      mockDb.all.mockReturnValue([{ col: 'value' }]);

      adminRepository.getTableData('unknown_table', 1, 10);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        `SELECT * FROM "unknown_table" ORDER BY ROWID DESC LIMIT ? OFFSET ?`
      );
    });

    it('should use specific ordering for the quiz table', () => {
      mockDb.get.mockReturnValue({ totalRows: 5 });
      mockDb.all.mockReturnValue([{ id: 1, content: 'test' }]);

      adminRepository.getTableData('quiz', 1, 10);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        `SELECT * FROM "quiz" ORDER BY created_at DESC LIMIT ? OFFSET ?`
      );
    });

    it('should throw an error if the table name is not allowed', () => {
      const invalidTableName = 'system_internals';
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => adminRepository.getTableData(invalidTableName, page, limit)).toThrow(
        'Invalid table name'
      );
      expect(mockDb.transaction).not.toHaveBeenCalled(); // Transaction shouldn't start
      expect(errorSpy).toHaveBeenCalledWith(
        `[AdminRepository] Attempt to access disallowed table: ${invalidTableName}`
      );
      errorSpy.mockRestore();
    });

    it('should throw an error if the database transaction fails', () => {
      const dbError = new Error('Transaction failed');
      mockDb.transaction.mockImplementationOnce(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => adminRepository.getTableData(tableName, page, limit)).toThrow(
        `Failed to fetch table data for ${tableName}: ${dbError.message}`
      );
      expect(errorSpy).toHaveBeenCalledWith(
        `[AdminRepository] Error fetching paginated data for table ${tableName}:`,
        dbError
      );
      errorSpy.mockRestore();
    });

    it('should handle count returning null or undefined', () => {
      mockDb.get.mockReturnValue(null); // Simulate count failing
      mockDb.all.mockReturnValue([]);

      const result = adminRepository.getTableData(tableName, page, limit);

      expect(result.totalRows).toBe(0);
      expect(result.data).toEqual([]);
    });
  });
});
