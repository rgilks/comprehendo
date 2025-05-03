import React from 'react';
import { DataTableControls } from './DataTableControls';
import { DataTableBody } from './DataTableBody';

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

      {/* Table */}
      {!error && (
        <DataTableBody
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
