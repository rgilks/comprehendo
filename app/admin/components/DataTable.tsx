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
  const estimatedRowHeight = 41; // Adjust as needed
  const minBodyHeight = rowsPerPage * estimatedRowHeight;

  return (
    <div>
      {error && (
        <p className="text-red-500 mb-4">
          Error loading data for {tableName}: {error}
        </p>
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
        <DataTableBody
          headers={headers as string[]}
          data={data}
          isLoading={isLoading}
          minBodyHeight={minBodyHeight}
          onRowClick={onRowClick}
        />
      )}
    </div>
  );
};
