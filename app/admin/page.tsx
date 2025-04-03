'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link'; // Import Link
import { getTableNames, getTableData } from './actions'; // Import server actions

// Simple SVG Icons (can be replaced with library icons if preferred)
const RefreshIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-4 h-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-4 h-4"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-4 h-4"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
  </svg>
);

export default function AdminPage() {
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [selectedRowData, setSelectedRowData] = useState<Record<string, unknown> | null>(null); // State for selected row
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10); // Or your preferred default
  const [totalRows, setTotalRows] = useState<number>(0);

  const [isLoadingTables, setIsLoadingTables] = useState<boolean>(true);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch table names on mount
    async function fetchTableNames() {
      setIsLoadingTables(true);
      setError(null);
      const result = await getTableNames();
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setTableNames(result.data);
      }
      setIsLoadingTables(false);
    }
    void fetchTableNames(); // Use void for floating promise
  }, []);

  // Function to fetch data for the selected table and page
  const fetchDataForTable = useCallback(async (tableName: string, page: number, limit: number) => {
    setIsLoadingData(true);
    setError(null);
    // Don't clear tableData here to avoid flash
    // setTableData([]); // <- Removed this line
    const result = await getTableData(tableName, page, limit);
    if (result.error) {
      setError(result.error);
      setTableData([]); // Clear data on error
    } else if (result.data) {
      setTableData(result.data.data);
      setTotalRows(result.data.totalRows);
      setCurrentPage(result.data.page);
      setRowsPerPage(result.data.limit);
    }
    setIsLoadingData(false);
  }, []);

  // Handler for selecting a table
  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setSelectedRowData(null); // Clear selected row when table changes
    setCurrentPage(1); // Reset to first page when table changes
    void fetchDataForTable(tableName, 1, rowsPerPage); // Use void
  };

  // Handlers for pagination controls
  const handlePreviousPage = () => {
    if (selectedTable && currentPage > 1) {
      void fetchDataForTable(selectedTable, currentPage - 1, rowsPerPage); // Use void
    }
  };

  const handleNextPage = () => {
    if (selectedTable && currentPage < Math.ceil(totalRows / rowsPerPage)) {
      void fetchDataForTable(selectedTable, currentPage + 1, rowsPerPage); // Use void
    }
  };

  // Handler for refresh button - now goes to page 1
  const handleRefresh = () => {
    if (selectedTable) {
      setCurrentPage(1); // Set current page state to 1
      void fetchDataForTable(selectedTable, 1, rowsPerPage); // Fetch page 1
    }
  };

  // Handler to go back from detail view
  const handleBackFromDetail = () => {
    setSelectedRowData(null);
  };

  const totalPages = Math.ceil(totalRows / rowsPerPage);

  // Estimate row height for min-height calculation (adjust if needed based on actual rendering)
  const estimatedRowHeight = 41; // Approx px height for py-2 padding + text-sm font
  const minBodyHeight = rowsPerPage * estimatedRowHeight;

  // Common button classes
  const buttonBaseClass =
    'px-4 py-2 inline-flex items-center gap-2 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
  const primaryButtonClass = `${buttonBaseClass} text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`;
  const secondaryButtonClass = `${buttonBaseClass} text-gray-700 bg-gray-200 hover:bg-gray-300 focus:ring-indigo-500`;
  const refreshButtonClass = `${buttonBaseClass} text-white bg-green-600 hover:bg-green-700 focus:ring-green-500`;

  // ----- Row Detail View Component -----
  const RowDetailView = ({
    rowData,
    onBack,
  }: {
    rowData: Record<string, unknown>;
    onBack: () => void;
  }) => {
    const renderValue = (key: string, value: unknown) => {
      // 1. Null/Undefined Check
      if (value === null || value === undefined) {
        return <span className="text-gray-500 italic">NULL</span>;
      }

      // 2. Boolean Check
      if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
      }

      // 3. Date Formatting (for specific keys like 'created_at')
      if (typeof value === 'string' && (key === 'created_at' || key === 'updated_at')) {
        try {
          const date = new Date(value);
          // Check if the date is valid before formatting
          if (!isNaN(date.getTime())) {
            return date.toLocaleString(undefined, {
              // Use locale-sensitive formatting
              dateStyle: 'medium',
              timeStyle: 'medium',
            });
          }
        } catch (e) {
          console.info('Info: Could not parse date string:', value, e); // Use console.info
          // Ignore error if parsing fails, fall through to other checks
        }
      }

      // 4. Enhanced JSON String Parsing
      if (typeof value === 'string') {
        // Try to extract JSON, potentially surrounded by other text/markers
        const jsonMatch =
          value.match(/^.*?({\[\\s\\S]*?}).*?$/) || value.match(/^.*?(\\[[\\s\\S]*?\\]).*?$/);
        const potentialJson = jsonMatch ? jsonMatch[1] : value; // Use matched JSON or original string
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const parsedJson = JSON.parse(potentialJson);
          // If parsing succeeds, format it
          return (
            <pre className="bg-gray-100 p-2 rounded overflow-auto text-sm whitespace-pre-wrap break-words">
              {JSON.stringify(parsedJson, null, 2)}
            </pre>
          );
        } catch (e) {
          console.info('Info: Could not parse potential JSON:', potentialJson, e); // Use console.info
          // If parsing fails, treat as a regular string (fall through)
        }
        // Return the original string if it wasn't parseable JSON
        return value;
      }

      // 5. Other Object Formatting
      if (typeof value === 'object') {
        return (
          <pre className="bg-gray-100 p-2 rounded overflow-auto text-sm whitespace-pre-wrap break-words">
            {JSON.stringify(value, null, 2)}
          </pre>
        );
      }

      // 6. Fallback to String Conversion
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return String(value);
    };

    return (
      <div>
        <button
          onClick={onBack}
          className={`${secondaryButtonClass} mb-4 px-3 py-1 sm:px-4 sm:py-2`}
        >
          &larr; Back to {selectedTable || 'Table'}
        </button>
        <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
          <dl>
            {Object.entries(rowData).map(([key, value], index) => (
              <div
                key={key}
                className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} px-4 py-3 sm:px-6`}
              >
                <dt className="text-sm font-medium text-gray-600 break-words mb-1">{key}</dt>
                <dd className="text-sm text-gray-900 break-words">{renderValue(key, value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    );
  };
  // ----- End Row Detail View -----

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Comprehendo admin</h1>
        <div className="mb-4">
          <Link href="/" className="text-blue-600 hover:underline">
            &larr; Back to App
          </Link>
        </div>

        {/* Conditional Rendering: Show detail view or table selection/view */}
        {selectedRowData ? (
          <RowDetailView rowData={selectedRowData} onBack={handleBackFromDetail} />
        ) : (
          <>
            {isLoadingTables && <p>Loading table names...</p>}
            {error && !selectedTable && (
              <p className="text-red-500">Error loading tables: {error}</p>
            )}

            {/* Table Selection */}
            {!isLoadingTables && tableNames.length > 0 && (
              <div className="mb-6">
                <div className="flex gap-3 overflow-x-auto whitespace-nowrap py-2">
                  {tableNames.map((name) => (
                    <button
                      key={name}
                      onClick={() => handleTableSelect(name)}
                      className={`${buttonBaseClass} ${selectedTable === name ? primaryButtonClass : secondaryButtonClass}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Table View Area - Only show if a table is selected */}
            {selectedTable && (
              <div className="min-h-[340px]">
                {error && (
                  <p className="text-red-500 mb-4">
                    Error loading data for {selectedTable}: {error}
                  </p>
                )}

                {/* Pagination Controls - Added flex-col/sm:flex-row and gap for mobile stacking */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0 mb-4 text-sm min-h-[38px]">
                  {/* Conditional Button: Refresh on Page 1, Previous otherwise */}
                  {currentPage === 1 ? (
                    <button
                      onClick={handleRefresh}
                      disabled={isLoadingData || !!error} // Disable on error too
                      className={`${refreshButtonClass} ${totalRows === 0 || !!error ? 'invisible' : ''} px-3 py-1 sm:px-4 sm:py-2`}
                    >
                      <RefreshIcon />
                      <span>{isLoadingData ? 'Refreshing...' : 'Refresh'}</span>{' '}
                      {/* Simplified text */}
                    </button>
                  ) : (
                    <button
                      onClick={handlePreviousPage}
                      disabled={isLoadingData} // Only disable when loading if not page 1
                      className={`${secondaryButtonClass} px-3 py-1 sm:px-4 sm:py-2`}
                    >
                      <ChevronLeftIcon />
                      <span>Previous</span>
                    </button>
                  )}

                  {/* Hide text if no rows or error */}
                  <span
                    className={`text-gray-300 ${totalRows === 0 || !!error ? 'invisible' : ''}`}
                  >
                    Page {currentPage} of {totalPages} (Total: {totalRows} rows)
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={
                      currentPage >= totalPages || isLoadingData || totalRows === 0 || !!error
                    }
                    className={`${secondaryButtonClass} ${totalRows === 0 || !!error ? 'invisible' : ''} px-3 py-1 sm:px-4 sm:py-2`}
                  >
                    <span>Next</span>
                    <ChevronRightIcon />
                  </button>
                </div>

                {/* Table Display Wrapper - Apply opacity and transition during load */}
                <div
                  className={`overflow-x-auto relative ${isLoadingData ? 'opacity-60' : ''} transition-opacity duration-200`}
                >
                  {!error && (
                    <table className="min-w-full bg-white border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          {tableData.length > 0 ? (
                            Object.keys(tableData[0]).map((key) => (
                              <th
                                key={key}
                                className="py-1 px-2 sm:py-2 sm:px-4 border-b text-left text-gray-900 font-semibold"
                              >
                                {key}
                              </th>
                            ))
                          ) : (
                            <th className="py-1 px-2 sm:py-2 sm:px-4 border-b text-left text-gray-900 font-semibold">
                              &nbsp;
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody style={{ minHeight: `${minBodyHeight}px` }}>
                        {!isLoadingData && tableData.length > 0
                          ? tableData.map((row, rowIndex) => (
                              <tr
                                key={rowIndex}
                                className="hover:bg-gray-50 cursor-pointer" // Added cursor-pointer
                                onClick={() => setSelectedRowData(row)} // Added onClick handler
                              >
                                {Object.values(row).map((value, colIndex) => (
                                  <td
                                    key={colIndex}
                                    className="py-1 px-2 sm:py-2 sm:px-4 border-b text-gray-900 text-sm"
                                  >
                                    {typeof value === 'string'
                                      ? value.length > 100
                                        ? `${value.substring(0, 100)}...`
                                        : value
                                      : value === null || value === undefined
                                        ? 'NULL'
                                        : typeof value === 'object'
                                          ? JSON.stringify(value)
                                          : // eslint-disable-next-line @typescript-eslint/no-base-to-string
                                            String(value)}
                                  </td>
                                ))}
                              </tr>
                            ))
                          : !error && (
                              <tr>
                                <td
                                  colSpan={
                                    tableData.length > 0 ? Object.keys(tableData[0]).length : 1
                                  }
                                  className="py-4 px-4 text-center text-gray-500"
                                >
                                  {isLoadingData ? '' : 'No data found in this table.'}
                                </td>
                              </tr>
                            )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
