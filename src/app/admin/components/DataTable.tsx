import React from 'react';
import { DataTableControls } from './DataTableControls';
import { DataTableBody } from './DataTableBody';

interface DataTableProps<T extends Record<string, unknown>> {
  tableName: string;
  headers: (keyof T)[];
  data: T[];
  totalRows: number;
  currentPage: number;
  rowsPerPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  onRowClick: (rowData: T) => void;
  onRefresh: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export const DataTable = <T extends Record<string, unknown>>({
  tableName,
  headers,
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
}: DataTableProps<T>) => {
  const estimatedRowHeight = 41;
  const minBodyHeight = rowsPerPage * estimatedRowHeight;

  return (
    <div className="overflow-x-auto shadow-md sm:rounded-lg bg-gray-800">
      {error && (
        <div className="p-4 mb-4 text-sm text-red-200 bg-red-800 rounded-lg" role="alert">
          <span className="font-medium">Error!</span> Error loading data for {tableName}: {error}
        </div>
      )}

      <DataTableControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalRows={totalRows}
        isLoading={isLoading}
        error={error}
        onRefresh={onRefresh}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
      />

      {!error && (
        <DataTableBody<T>
          headers={headers}
          data={data}
          isLoading={isLoading}
          minBodyHeight={minBodyHeight}
          onRowClick={onRowClick}
        />
      )}
    </div>
  );
};
