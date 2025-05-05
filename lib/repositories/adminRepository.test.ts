import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { getAllTableNames, getTableData, type PaginatedTableData } from './adminRepository';
import db from '../db'; // Import db to be mocked

// Mock the db dependency
vi.mock('../db', () => {
  const mockDb = {
    prepare: vi.fn(),
    all: vi.fn(),
    get: vi.fn(),
    // Mock transaction to return a function that executes the callback
    transaction: vi.fn().mockImplementation((cb) => {
      return (...args: any[]) => cb(...args);
    }),
  };
  // Ensure prepare is chainable
  mockDb.prepare.mockImplementation(() => mockDb);
  return { default: mockDb }; // Export as default as the repository uses it
});

// Cast the imported mock for easier use in tests
const mockDb = db as unknown as {
  prepare: Mock;
  all: Mock;
  get: Mock;
  transaction: Mock;
};

// No need for AdminRepository instance anymore
// let adminRepository: AdminRepository;

describe('Admin Repository Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks before each test
    mockDb.prepare.mockClear().mockImplementation(() => mockDb); // Ensure chaining is reset
    mockDb.all.mockClear();
    mockDb.get.mockClear();
    mockDb.transaction.mockClear().mockImplementation((cb) => {
      // Reset transaction mock as well
      return (...args: any[]) => cb(...args);
    });

    // No instantiation needed
    // adminRepository = new AdminRepository(mockDb as any);
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

      // Call the standalone function
      const tableNames = getAllTableNames();

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

      // Call the standalone function
      const tableNames = getAllTableNames();

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

    it('should fetch paginated data and total row count for a valid table', () => {
      const mockData = [{ id: 6, name: 'User 6' }];
      const mockTotalRows = 15;
      // Mock the db calls directly
      mockDb.all // Mock for getAllTableNames call within getTableData
        .mockReturnValueOnce([{ name: 'users' }, { name: 'quiz' }]);
      mockDb.get.mockReturnValueOnce({ totalRows: mockTotalRows }); // Mock for count query
      mockDb.all.mockReturnValueOnce(mockData); // Mock for data query

      // Call the standalone function
      const result = getTableData(tableName, page, limit);

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
      mockDb.all // Mock for getAllTableNames
        .mockReturnValueOnce([{ name: 'unknown_table' }]);
      mockDb.get.mockReturnValue({ totalRows: 1 });
      mockDb.all.mockReturnValue([{ col: 'value' }]);

      // Call the standalone function
      getTableData('unknown_table', 1, 10);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        `SELECT * FROM "unknown_table" ORDER BY ROWID DESC LIMIT ? OFFSET ?`
      );
    });

    it('should use specific ordering for the quiz table', () => {
      mockDb.all // Mock for getAllTableNames
        .mockReturnValueOnce([{ name: 'users' }, { name: 'quiz' }]);
      mockDb.get.mockReturnValue({ totalRows: 5 });
      mockDb.all.mockReturnValue([{ id: 1, content: 'test' }]);

      // Call the standalone function
      getTableData('quiz', 1, 10);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        `SELECT * FROM "quiz" ORDER BY created_at DESC LIMIT ? OFFSET ?`
      );
    });

    it('should throw an error if the table name is not allowed', () => {
      mockDb.all // Mock for getAllTableNames
        .mockReturnValueOnce([{ name: 'users' }, { name: 'quiz' }]);
      const invalidTableName = 'system_internals';
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Call the standalone function
      expect(() => getTableData(invalidTableName, page, limit)).toThrow('Invalid table name');
      expect(mockDb.transaction).not.toHaveBeenCalled(); // Transaction shouldn't start
      expect(errorSpy).toHaveBeenCalledWith(
        `[AdminRepository] Attempt to access disallowed table: ${invalidTableName}`
      );
      errorSpy.mockRestore();
    });

    it('should throw an error if the database transaction fails', () => {
      mockDb.all // Mock for getAllTableNames
        .mockReturnValueOnce([{ name: 'users' }, { name: 'quiz' }]);
      const dbError = new Error('Transaction failed');
      // Make the transaction function itself throw the error
      mockDb.transaction.mockImplementationOnce(() => {
        return () => {
          throw dbError;
        }; // Throw when the transaction function is executed
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Call the standalone function
      expect(() => getTableData(tableName, page, limit)).toThrow(
        `Failed to fetch table data for ${tableName}: ${dbError.message}`
      );
      expect(errorSpy).toHaveBeenCalledWith(
        `[AdminRepository] Error fetching paginated data for table ${tableName}:`,
        dbError
      );
      errorSpy.mockRestore();
    });

    it('should handle count returning null or undefined', () => {
      mockDb.all // Mock for getAllTableNames
        .mockReturnValueOnce([{ name: 'users' }, { name: 'quiz' }]);
      mockDb.get.mockReturnValue(null); // Simulate count failing
      mockDb.all.mockReturnValue([]);

      // Call the standalone function
      const result = getTableData(tableName, page, limit);

      expect(result.totalRows).toBe(0);
      expect(result.data).toEqual([]);
    });
  });
});
