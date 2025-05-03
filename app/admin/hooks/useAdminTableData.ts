import { useState, useEffect, useCallback } from 'react';
import { getTableNames, getTableData } from '../actions'; // Adjust path as needed

export const useAdminTableData = (initialRowsPerPage = 10) => {
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(initialRowsPerPage);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [isLoadingTables, setIsLoadingTables] = useState<boolean>(true);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Table Names
  useEffect(() => {
    const fetchTableNames = async () => {
      setIsLoadingTables(true);
      setError(null);
      try {
        const result = await getTableNames();
        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          setTableNames(result.data);
        }
      } catch (err) {
        console.error('Error fetching table names:', err);
        setError('Failed to load tables');
      } finally {
        setIsLoadingTables(false);
      }
    };
    void fetchTableNames();
  }, []);

  // Fetch Data for Selected Table
  const fetchDataForTable = useCallback(async (tableName: string, page: number, limit: number) => {
    setIsLoadingData(true);
    setError(null);
    try {
      const result = await getTableData(tableName, page, limit);
      if (result.error) {
        setError(result.error);
        setTableData([]); // Clear data on error
      } else if (result.data) {
        setTableData(result.data.data);
        setTotalRows(result.data.totalRows);
        setCurrentPage(result.data.page);
        setRowsPerPage(result.data.limit);
      } else {
        setTableData([]); // Ensure data is cleared if no data returned
        setTotalRows(0);
      }
    } catch (err) {
      console.error('Error fetching table data:', err);
      setError('Failed to load table data');
      setTableData([]); // Clear data on error
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const selectAndFetchTable = useCallback(
    async (tableName: string) => {
      setSelectedTable(tableName);
      setCurrentPage(1); // Reset to first page
      await fetchDataForTable(tableName, 1, rowsPerPage);
    },
    [fetchDataForTable, rowsPerPage]
  );

  const refreshData = useCallback(async () => {
    if (selectedTable) {
      setCurrentPage(1);
      await fetchDataForTable(selectedTable, 1, rowsPerPage);
    }
  }, [selectedTable, fetchDataForTable, rowsPerPage]);

  const goToPreviousPage = useCallback(async () => {
    if (selectedTable && currentPage > 1) {
      await fetchDataForTable(selectedTable, currentPage - 1, rowsPerPage);
    }
  }, [selectedTable, currentPage, fetchDataForTable, rowsPerPage]);

  const goToNextPage = useCallback(async () => {
    if (selectedTable && currentPage < Math.ceil(totalRows / rowsPerPage)) {
      await fetchDataForTable(selectedTable, currentPage + 1, rowsPerPage);
    }
  }, [selectedTable, currentPage, totalRows, rowsPerPage, fetchDataForTable]);

  const totalPages = Math.ceil(totalRows / rowsPerPage);

  return {
    tableNames,
    selectedTable,
    tableData,
    currentPage,
    rowsPerPage,
    totalRows,
    totalPages,
    isLoadingTables,
    isLoadingData,
    error,
    selectAndFetchTable, // Renamed from handleTableSelect
    refreshData, // Renamed from handleRefresh
    goToPreviousPage, // Renamed from handlePreviousPage
    goToNextPage, // Renamed from handleNextPage
    setSelectedTable, // Expose setter if needed for direct manipulation (e.g., clearing selection)
  };
};
