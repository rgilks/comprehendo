import React from 'react';

export const buttonBaseClass =
  'px-4 py-2 inline-flex items-center gap-2 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const primaryButtonClass = `${buttonBaseClass} text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`;
export const secondaryButtonClass = `${buttonBaseClass} text-gray-700 bg-gray-200 hover:bg-gray-300 focus:ring-indigo-500`;
interface TableSelectorProps {
  tableNames: string[];
  selectedTable: string | null;
  onSelectTable: (tableName: string) => void;
  isLoading: boolean;
  error: string | null;
}

export const TableSelector: React.FC<TableSelectorProps> = ({
  tableNames,
  selectedTable,
  onSelectTable,
  isLoading,
  error,
}) => {
  if (isLoading) {
    return <p>Loading table names...</p>;
  }

  if (error) {
    return <p className="text-red-500">Error loading tables: {error}</p>;
  }

  if (tableNames.length === 0) {
    return <p>No tables found.</p>;
  }

  return (
    <div className="mb-6">
      <div
        className="flex gap-3 overflow-x-auto whitespace-nowrap py-2"
        role="group"
        aria-label="Table selection"
      >
        {tableNames.map((name) => (
          <button
            key={name}
            onClick={() => {
              onSelectTable(name);
            }}
            className={`${buttonBaseClass} ${selectedTable === name ? primaryButtonClass : secondaryButtonClass}`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
};
