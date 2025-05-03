import React from 'react';
import { renderTableCellValue } from '@/lib/utils/rendering';

interface DataTableBodyProps<T extends Record<string, unknown>> {
  headers: (keyof T)[];
  data: T[];
  isLoading: boolean;
  minBodyHeight: number;
  onRowClick: (rowData: T) => void;
}

export const DataTableBody = <T extends Record<string, unknown>>({
  headers,
  data,
  isLoading,
  minBodyHeight,
  onRowClick,
}: DataTableBodyProps<T>) => {
  const getRowKey = (row: T, index: number): string | number => {
    // Prefer using a unique ID if available
    const id = row['id'];
    if (id && (typeof id === 'string' || typeof id === 'number')) {
      return id;
    }
    // Fallback to index if no id is present
    return index;
  };

  return (
    <div
      className={`overflow-x-auto relative ${isLoading ? 'opacity-60' : ''} transition-opacity duration-200`}
    >
      <table className="min-w-full bg-white border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            {headers.length > 0 ? (
              headers.map((key) => (
                <th
                  key={key as string}
                  className="py-1 px-2 sm:py-2 sm:px-4 border-b text-left text-gray-900 font-semibold"
                >
                  {key as string}
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
          {!isLoading && data.length > 0 ? (
            data.map((row, rowIndex) => (
              <tr
                key={getRowKey(row, rowIndex)} // Use unique ID or index as key
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  onRowClick(row);
                }}
              >
                {headers.map((header, _colIndex) => (
                  <td
                    key={`${getRowKey(row, rowIndex)}-${header as string}`} // Ensure unique key
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
    </div>
  );
};
