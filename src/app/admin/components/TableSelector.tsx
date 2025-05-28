import React from 'react';
import { buttonBaseClass, primaryButtonClass, secondaryButtonClass } from './styles';

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
    return <p>No tables found.</p>; // Or some other placeholder
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
