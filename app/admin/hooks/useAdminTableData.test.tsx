import { renderHook, waitFor, act } from '@testing-library/react';
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAdminTableData } from './useAdminTableData';
import { getTableNames, getTableData } from '../actions';

// Mock the server actions
vi.mock('../actions', () => ({
  getTableNames: vi.fn(),
  getTableData: vi.fn(),
}));

describe('useAdminTableData', () => {
  // Cast mocks to the correct type for type safety
  const mockGetTableNames = getTableNames as Mock;
  const mockGetTableData = getTableData as Mock;

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useAdminTableData());

    expect(result.current.tableNames).toEqual([]);
    expect(result.current.selectedTable).toBeNull();
    expect(result.current.tableData).toEqual([]);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.rowsPerPage).toBe(10); // Default
    expect(result.current.totalRows).toBe(0);
    expect(result.current.totalPages).toBe(0);
    expect(result.current.isLoadingTables).toBe(true); // Starts loading tables
    expect(result.current.isLoadingData).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should fetch table names on mount', async () => {
    const mockTableNames = ['users', 'products'];
    mockGetTableNames.mockResolvedValue({ data: mockTableNames });

    const { result } = renderHook(() => useAdminTableData());

    expect(result.current.isLoadingTables).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoadingTables).toBe(false);
    });

    expect(mockGetTableNames).toHaveBeenCalledTimes(1);
    expect(result.current.tableNames).toEqual(mockTableNames);
    expect(result.current.error).toBeNull();
  });

  it('should handle error when fetching table names', async () => {
    const errorMessage = 'Failed to fetch names';
    mockGetTableNames.mockResolvedValue({ error: errorMessage });

    const { result } = renderHook(() => useAdminTableData());

    await waitFor(() => {
      expect(result.current.isLoadingTables).toBe(false);
    });

    expect(mockGetTableNames).toHaveBeenCalledTimes(1);
    expect(result.current.tableNames).toEqual([]);
    expect(result.current.error).toBe(errorMessage);
  });

  it('should fetch data when a table is selected', async () => {
    const tableName = 'users';
    const mockData = [{ id: 1, name: 'Alice' }];
    const totalRows = 1;
    mockGetTableNames.mockResolvedValue({ data: [tableName] }); // Needed for initial load
    mockGetTableData.mockResolvedValue({ data: { data: mockData, totalRows, page: 1, limit: 10 } });

    const { result } = renderHook(() => useAdminTableData());

    // Wait for table names to load first
    await waitFor(() => {
      expect(result.current.isLoadingTables).toBe(false);
    });

    // Select table
    act(() => {
      // Intentionally not awaiting the promise here, let waitFor handle it
      void result.current.selectAndFetchTable(tableName);
    });

    // Use waitFor to observe the loading state becoming true
    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(true);
    });

    // Now wait for loading to finish (data fetch completes)
    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    // Assert final state after loading
    expect(mockGetTableData).toHaveBeenCalledWith(tableName, 1, 10);
    expect(result.current.selectedTable).toBe(tableName);
    expect(result.current.tableData).toEqual(mockData);
    expect(result.current.totalRows).toBe(totalRows);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('should handle error when fetching table data', async () => {
    const tableName = 'users';
    const errorMessage = 'Failed to fetch data';
    mockGetTableNames.mockResolvedValue({ data: [tableName] });
    mockGetTableData.mockResolvedValue({ error: errorMessage });

    const { result } = renderHook(() => useAdminTableData());
    await waitFor(() => {
      expect(result.current.isLoadingTables).toBe(false);
    });

    await act(async () => {
      await result.current.selectAndFetchTable(tableName);
    });

    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    expect(mockGetTableData).toHaveBeenCalledWith(tableName, 1, 10);
    expect(result.current.selectedTable).toBe(tableName);
    expect(result.current.tableData).toEqual([]);
    expect(result.current.totalRows).toBe(0);
    expect(result.current.error).toBe(errorMessage);
  });

  it('should paginate to the next page', async () => {
    const tableName = 'products';
    const initialData = [{ id: 1 }];
    const nextData = [{ id: 2 }];
    const totalRows = 15;
    const rowsPerPage = 5;

    mockGetTableNames.mockResolvedValue({ data: [tableName] });
    // Initial fetch
    mockGetTableData.mockResolvedValueOnce({
      data: { data: initialData, totalRows, page: 1, limit: rowsPerPage },
    });
    // Next page fetch
    mockGetTableData.mockResolvedValueOnce({
      data: { data: nextData, totalRows, page: 2, limit: rowsPerPage },
    });

    const { result } = renderHook(() => useAdminTableData(rowsPerPage));
    await waitFor(() => {
      expect(result.current.isLoadingTables).toBe(false);
    });

    // Select table and fetch first page
    await act(async () => {
      await result.current.selectAndFetchTable(tableName);
    });
    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.tableData).toEqual(initialData);
    expect(result.current.totalPages).toBe(Math.ceil(totalRows / rowsPerPage)); // 3

    // Go to next page
    await act(async () => {
      await result.current.goToNextPage();
    });
    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    expect(mockGetTableData).toHaveBeenCalledTimes(2);
    expect(mockGetTableData).toHaveBeenNthCalledWith(2, tableName, 2, rowsPerPage);
    expect(result.current.currentPage).toBe(2);
    expect(result.current.tableData).toEqual(nextData);
  });

  it('should paginate to the previous page', async () => {
    const tableName = 'products';
    const page1Data = [{ id: 1 }];
    const page2Data = [{ id: 2 }];
    const totalRows = 15;
    const rowsPerPage = 5;

    mockGetTableNames.mockResolvedValue({ data: [tableName] });
    // Initial fetch (page 1)
    mockGetTableData.mockResolvedValueOnce({
      data: { data: page1Data, totalRows, page: 1, limit: rowsPerPage },
    });
    // Fetch for page 2
    mockGetTableData.mockResolvedValueOnce({
      data: { data: page2Data, totalRows, page: 2, limit: rowsPerPage },
    });
    // Fetch for page 1 (previous)
    mockGetTableData.mockResolvedValueOnce({
      data: { data: page1Data, totalRows, page: 1, limit: rowsPerPage },
    });

    const { result } = renderHook(() => useAdminTableData(rowsPerPage));
    await waitFor(() => {
      expect(result.current.isLoadingTables).toBe(false);
    });

    // Select table and fetch page 1
    await act(async () => {
      await result.current.selectAndFetchTable(tableName);
    });
    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    // Go to page 2
    await act(async () => {
      await result.current.goToNextPage();
    });
    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });
    expect(result.current.currentPage).toBe(2);
    expect(result.current.tableData).toEqual(page2Data);

    // Go back to page 1
    await act(async () => {
      await result.current.goToPreviousPage();
    });
    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    expect(mockGetTableData).toHaveBeenCalledTimes(3);
    expect(mockGetTableData).toHaveBeenNthCalledWith(3, tableName, 1, rowsPerPage);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.tableData).toEqual(page1Data);
  });

  it('should not paginate beyond the last page', async () => {
    const tableName = 'products';
    const data = [{ id: 1 }];
    const totalRows = 5;
    const rowsPerPage = 5;

    mockGetTableNames.mockResolvedValue({ data: [tableName] });
    mockGetTableData.mockResolvedValue({ data: { data, totalRows, page: 1, limit: rowsPerPage } });

    const { result } = renderHook(() => useAdminTableData(rowsPerPage));
    await waitFor(() => {
      expect(result.current.isLoadingTables).toBe(false);
    });
    await act(async () => {
      await result.current.selectAndFetchTable(tableName);
    });
    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(1);

    // Try to go next
    await act(async () => {
      await result.current.goToNextPage();
    });

    // Should not fetch again
    expect(mockGetTableData).toHaveBeenCalledTimes(1);
    expect(result.current.currentPage).toBe(1); // Stays on page 1
  });

  it('should not paginate before the first page', async () => {
    const tableName = 'products';
    const data = [{ id: 1 }];
    const totalRows = 5;
    const rowsPerPage = 5;

    mockGetTableNames.mockResolvedValue({ data: [tableName] });
    mockGetTableData.mockResolvedValue({ data: { data, totalRows, page: 1, limit: rowsPerPage } });

    const { result } = renderHook(() => useAdminTableData(rowsPerPage));
    await waitFor(() => {
      expect(result.current.isLoadingTables).toBe(false);
    });
    await act(async () => {
      await result.current.selectAndFetchTable(tableName);
    });
    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    expect(result.current.currentPage).toBe(1);

    // Try to go previous
    await act(async () => {
      await result.current.goToPreviousPage();
    });

    // Should not fetch again
    expect(mockGetTableData).toHaveBeenCalledTimes(1);
    expect(result.current.currentPage).toBe(1); // Stays on page 1
  });

  it('should refresh data for the current table', async () => {
    const tableName = 'orders';
    const initialData = [{ id: 10 }];
    const refreshedData = [{ id: 11 }]; // Simulate data change
    const totalRows = 1;
    mockGetTableNames.mockResolvedValue({ data: [tableName] });
    mockGetTableData
      .mockResolvedValueOnce({ data: { data: initialData, totalRows, page: 1, limit: 10 } }) // Initial
      .mockResolvedValueOnce({ data: { data: refreshedData, totalRows, page: 1, limit: 10 } }); // Refresh

    const { result } = renderHook(() => useAdminTableData());
    await waitFor(() => {
      expect(result.current.isLoadingTables).toBe(false);
    });

    // Select and fetch initial data
    await act(async () => {
      await result.current.selectAndFetchTable(tableName);
    });
    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });
    expect(result.current.tableData).toEqual(initialData);
    expect(mockGetTableData).toHaveBeenCalledTimes(1);
    expect(mockGetTableData).toHaveBeenCalledWith(tableName, 1, 10);

    // Refresh
    await act(async () => {
      await result.current.refreshData();
    });
    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    expect(result.current.isLoadingData).toBe(false);
    expect(mockGetTableData).toHaveBeenCalledTimes(2);
    // Refresh should always fetch page 1
    expect(mockGetTableData).toHaveBeenNthCalledWith(2, tableName, 1, 10);
    expect(result.current.tableData).toEqual(refreshedData);
    expect(result.current.currentPage).toBe(1); // Stays on page 1 after refresh
  });

  it('should not refresh if no table is selected', async () => {
    mockGetTableNames.mockResolvedValue({ data: ['table1'] });

    const { result } = renderHook(() => useAdminTableData());
    await waitFor(() => {
      expect(result.current.isLoadingTables).toBe(false);
    });

    await act(async () => {
      await result.current.refreshData();
    });

    expect(mockGetTableData).not.toHaveBeenCalled();
    expect(result.current.isLoadingData).toBe(false);
  });

  it('should handle thrown error when fetching table names', async () => {
    const thrownError = new Error('Network Failure');
    mockGetTableNames.mockRejectedValue(thrownError);

    const { result } = renderHook(() => useAdminTableData());

    await waitFor(() => {
      expect(result.current.isLoadingTables).toBe(false);
    });

    expect(mockGetTableNames).toHaveBeenCalledTimes(1);
    expect(result.current.tableNames).toEqual([]);
    expect(result.current.error).toBe('Failed to load tables'); // Specific error from catch block
  });

  it('should handle thrown error when fetching table data', async () => {
    const tableName = 'users';
    const thrownError = new Error('Network Failure during data fetch');
    mockGetTableNames.mockResolvedValue({ data: [tableName] }); // Need this for setup
    mockGetTableData.mockRejectedValue(thrownError);

    const { result } = renderHook(() => useAdminTableData());
    await waitFor(() => {
      expect(result.current.isLoadingTables).toBe(false);
    });

    act(() => {
      void result.current.selectAndFetchTable(tableName);
    });

    // Wait for loading to start and then finish (due to error)
    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(true);
    });
    await waitFor(() => {
      expect(result.current.isLoadingData).toBe(false);
    });

    expect(mockGetTableData).toHaveBeenCalledWith(tableName, 1, 10);
    expect(result.current.selectedTable).toBe(tableName);
    expect(result.current.tableData).toEqual([]); // Data should be cleared
    expect(result.current.error).toBe('Failed to load table data'); // Specific error from catch block
  });
});
