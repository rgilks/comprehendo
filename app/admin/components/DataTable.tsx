import React from 'react';
import {
  ArrowPathIcon as HeroRefreshIcon,
  ChevronLeftIcon as HeroChevronLeftIcon,
  ChevronRightIcon as HeroChevronRightIcon,
} from '@heroicons/react/24/solid';

// Shared button styles (consider moving to a shared location)
const buttonBaseClass =
  'px-4 py-2 inline-flex items-center gap-2 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const secondaryButtonClass = `${buttonBaseClass} text-gray-700 bg-gray-200 hover:bg-gray-300 focus:ring-indigo-500`;
const refreshButtonClass = `${buttonBaseClass} text-white bg-green-600 hover:bg-green-700 focus:ring-green-500`;

interface DataTableProps {
  tableName: string;
  data: Record<string, unknown>[];
  totalRows: number;
  currentPage: number;
  rowsPerPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  onRowClick: (rowData: Record<string, unknown>) => void;
  onRefresh: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

// Utility to render cell values (could be enhanced/moved)
const renderTableCellValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined) {
    return <span className="text-gray-500 italic">NULL</span>;
  }
  if (typeof value === 'string') {
    return value.length > 100 ? `${value.substring(0, 100)}...` : value;
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'object') {
    try {
      const stringified = JSON.stringify(value);
      return stringified.length > 100 ? `${stringified.substring(0, 100)}...` : stringified;
    } catch (_e) {
      return '[Object]'; // Handle potential stringification errors
    }
  }
  // Fallback for other types (e.g., functions, symbols) - should ideally not happen with JSON-like data
  return '[Unsupported Value]';
};

export const DataTable: React.FC<DataTableProps> = ({
  tableName,
  data,
  totalRows,
  currentPage,
  rowsPerPage,
  totalPages,
  isLoading,
  error,
  onRowClick,
  onRefresh,
  onPreviousPage,
  onNextPage,
}) => {
  const estimatedRowHeight = 41; // Adjust as needed
  const minBodyHeight = rowsPerPage * estimatedRowHeight;
  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="min-h-[340px]">
      {error && (
        <p className="text-red-500 mb-4">
          Error loading data for {tableName}: {error}
        </p>
      )}

      {/* Pagination and Refresh Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0 mb-4 text-sm min-h-[38px]">
        {currentPage === 1 ? (
          <button
            onClick={onRefresh}
            disabled={isLoading || !!error}
            className={`${refreshButtonClass} ${totalRows === 0 || !!error ? 'invisible' : ''} px-3 py-1 sm:px-4 sm:py-2`}
          >
            <HeroRefreshIcon className="h-4 w-4" aria-hidden="true" />
            <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        ) : (
          <button
            onClick={onPreviousPage}
            disabled={currentPage <= 1 || isLoading}
            className={secondaryButtonClass}
          >
            <HeroChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        <span className={`text-gray-300 ${totalRows === 0 || !!error ? 'invisible' : ''}`}>
          Page {currentPage} of {totalPages} (Total: {totalRows} rows)
        </span>

        <button
          onClick={onNextPage}
          disabled={currentPage >= totalPages || isLoading}
          className={secondaryButtonClass}
        >
          <HeroChevronRightIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Table */}
      <div
        className={`overflow-x-auto relative ${isLoading ? 'opacity-60' : ''} transition-opacity duration-200`}
      >
        {!error && (
          <table className="min-w-full bg-white border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                {headers.length > 0 ? (
                  headers.map((key) => (
                    <th
                      key={key}
                      className="py-1 px-2 sm:py-2 sm:px-4 border-b text-left text-gray-900 font-semibold"
                    >
                      {key}
                    </th>
                  ))
                ) : (
                  <th className="py-1 px-2 sm:py-2 sm:px-4 border-b text-left text-gray-900 font-semibold">
                    &nbsp; {/* Placeholder for empty table */}
                  </th>
                )}
              </tr>
            </thead>
            <tbody style={{ minHeight: `${minBodyHeight}px` }}>
              {!isLoading && data.length > 0 ? (
                data.map((row, rowIndex) => (
                  <tr
                    key={rowIndex} // Consider using a unique ID from the row if available
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      onRowClick(row);
                    }}
                  >
                    {headers.map((header, colIndex) => (
                      <td
                        key={colIndex}
                        className="py-1 px-2 sm:py-2 sm:px-4 border-b text-gray-900 text-sm whitespace-nowrap"
                      >
                        {renderTableCellValue(row[header])}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="border-t border-gray-200 px-6 py-4 text-center"
                    colSpan={headers.length || 1}
                  >
                    {isLoading ? '' : 'No data found in this table.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
